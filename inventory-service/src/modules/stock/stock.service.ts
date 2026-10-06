import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, DB_SCHEMA } from '../../prisma/prisma.service';
import { Page } from '../../common/dto/pagination.dto';
import { LocationsService } from '../locations/locations.service';
import { AuthUser } from '../../auth/auth-user';
import {
  CreateMovementDto,
  ListMovementsDto,
  ListStockDto,
  ReservationDto,
  SetReorderDto,
} from './dto/stock.dto';
import { Prisma } from '../../../generated/prisma/client';

type Tx = Prisma.TransactionClient;
type Decimal = Prisma.Decimal;
const D = Prisma.Decimal;

interface LockedLevel {
  id: string;
  quantity: Decimal;
  reserved: Decimal;
}

const sizeSelect = {
  id: true,
  label: true,
  sku: true,
  unit: true,
  variant: {
    select: {
      id: true,
      name: true,
      product: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.SizeSelect;

const levelInclude = {
  size: { select: sizeSelect },
  location: { select: { id: true, code: true, name: true } },
} satisfies Prisma.StockLevelInclude;

/**
 * Every write here is one transaction: lock the affected stock_levels rows
 * (SELECT ... FOR UPDATE, ordered by id so transfers can't deadlock), check
 * the invariant, apply the delta, append the ledger row.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
  ) {}

  // ── Reads ────────────────────────────────────────────────────────────────

  async list(tenantId: string, q: ListStockDto): Promise<Page<any>> {
    const where: Prisma.StockLevelWhereInput = {
      tenant_id: tenantId,
      size: { deleted_at: null },
      ...(q.size ? { size_id: q.size } : {}),
      ...(q.variant ? { size: { variant_id: q.variant } } : {}),
      ...(q.product ? { size: { variant: { product_id: q.product } } } : {}),
      ...(q.location ? { location_id: q.location } : {}),
    };
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;

    if (q.below_reorder) {
      // Column-to-column comparison isn't expressible in Prisma's where.
      const ids = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "${Prisma.raw(DB_SCHEMA)}"."stock_levels"
        WHERE tenant_id = ${tenantId}
          AND reorder_at IS NOT NULL
          AND quantity - reserved < reorder_at`;
      where.id = { in: ids.map((r) => r.id) };
    }

    const [total, items] = await Promise.all([
      this.prisma.stockLevel.count({ where }),
      this.prisma.stockLevel.findMany({
        where,
        include: levelInclude,
        orderBy: [{ updated_at: 'desc' }],
        take: limit,
        skip: offset,
      }),
    ]);
    return { items, total, limit, offset };
  }

  async forSize(tenantId: string, sizeId: string) {
    await this.assertSize(tenantId, sizeId);
    const levels = await this.prisma.stockLevel.findMany({
      where: { size_id: sizeId },
      include: { location: { select: { id: true, code: true, name: true } } },
      orderBy: { location: { name: 'asc' } },
    });
    let quantity = new D(0);
    let reserved = new D(0);
    for (const l of levels) {
      quantity = quantity.plus(l.quantity);
      reserved = reserved.plus(l.reserved);
    }
    return {
      size_id: sizeId,
      levels,
      totals: {
        quantity: quantity.toString(),
        reserved: reserved.toString(),
        available: quantity.minus(reserved).toString(),
      },
    };
  }

  async movements(tenantId: string, q: ListMovementsDto): Promise<Page<any>> {
    const where: Prisma.StockMovementWhereInput = {
      tenant_id: tenantId,
      ...(q.size ? { size_id: q.size } : {}),
      ...(q.variant ? { size: { variant_id: q.variant } } : {}),
      ...(q.product ? { size: { variant: { product_id: q.product } } } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.reference_type ? { reference_type: q.reference_type } : {}),
      ...(q.reference_id ? { reference_id: q.reference_id } : {}),
      ...(q.location
        ? { OR: [{ from_location_id: q.location }, { to_location_id: q.location }] }
        : {}),
      ...(q.from || q.to
        ? {
            occurred_at: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const [total, items] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: {
          size: { select: sizeSelect },
          from_location: { select: { id: true, code: true, name: true } },
          to_location: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ occurred_at: 'desc' }, { created_at: 'desc' }],
        take: limit,
        skip: offset,
      }),
    ]);
    return { items, total, limit, offset };
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  async move(tenantId: string, actor: AuthUser, dto: CreateMovementDto) {
    await this.assertSize(tenantId, dto.size_id);
    const plan = await this.plan(tenantId, dto);

    return this.prisma.$transaction(async (tx) => {
      const ids = [plan.from, plan.to].filter(Boolean) as string[];
      const levelIds = await Promise.all(
        ids.map((loc) => this.ensureLevel(tx, tenantId, dto.size_id, loc)),
      );
      const locked = await this.lock(tx, levelIds);
      const byLocation = new Map<string, LockedLevel>();
      ids.forEach((loc, i) => byLocation.set(loc, locked.get(levelIds[i])!));

      let delta = plan.delta;
      const payload: Record<string, unknown> = { ...(dto.payload ?? {}) };

      if (plan.from) {
        const src = byLocation.get(plan.from)!;
        if (dto.type === 'ADJUST') {
          if (dto.counted !== undefined) {
            delta = new D(dto.counted).minus(src.quantity);
            payload.previous = src.quantity.toString();
            payload.counted = dto.counted;
          }
          const next = src.quantity.plus(delta);
          if (next.lt(0)) {
            throw new ConflictException(
              `Adjustment would take stock below zero (have ${src.quantity})`,
            );
          }
          if (next.lt(src.reserved)) {
            throw new ConflictException(
              `Adjustment would leave less than the ${src.reserved} currently reserved`,
            );
          }
          await tx.stockLevel.update({
            where: { id: src.id },
            data: { quantity: next },
          });
        } else {
          const available = src.quantity.minus(src.reserved);
          if (available.lt(delta)) {
            throw new ConflictException(
              `Insufficient stock: ${available} available, ${delta} requested`,
            );
          }
          await tx.stockLevel.update({
            where: { id: src.id },
            data: { quantity: { decrement: delta } },
          });
        }
      }
      if (plan.to) {
        const dst = byLocation.get(plan.to)!;
        await tx.stockLevel.update({
          where: { id: dst.id },
          data: { quantity: { increment: delta } },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          tenant_id: tenantId,
          size_id: dto.size_id,
          type: dto.type,
          quantity: delta,
          from_location_id: plan.from,
          to_location_id: plan.to,
          actor_id: actor.id,
          reference_type: dto.reference_type,
          reference_id: dto.reference_id,
          reason: dto.reason,
          payload: payload as Prisma.InputJsonValue,
          occurred_at: dto.occurred_at ? new Date(dto.occurred_at) : undefined,
        },
      });
      const levels = await tx.stockLevel.findMany({
        where: { id: { in: levelIds } },
        include: { location: { select: { id: true, code: true, name: true } } },
      });
      return { movement, levels };
    });
  }

  async reserve(tenantId: string, dto: ReservationDto) {
    await this.assertSize(tenantId, dto.size_id);
    const locationId = await this.resolveLocation(tenantId, dto.location_id);
    const qty = new D(dto.quantity);
    if (qty.lte(0)) throw new BadRequestException('quantity must be > 0');

    return this.prisma.$transaction(async (tx) => {
      const id = await this.ensureLevel(tx, tenantId, dto.size_id, locationId);
      const level = (await this.lock(tx, [id])).get(id)!;
      const available = level.quantity.minus(level.reserved);
      if (available.lt(qty)) {
        throw new ConflictException(
          `Insufficient stock to reserve: ${available} available, ${qty} requested`,
        );
      }
      return tx.stockLevel.update({
        where: { id },
        data: { reserved: { increment: qty } },
        include: levelInclude,
      });
    });
  }

  async release(tenantId: string, dto: ReservationDto) {
    await this.assertSize(tenantId, dto.size_id);
    const locationId = await this.resolveLocation(tenantId, dto.location_id);
    const qty = new D(dto.quantity);
    if (qty.lte(0)) throw new BadRequestException('quantity must be > 0');

    return this.prisma.$transaction(async (tx) => {
      const id = await this.ensureLevel(tx, tenantId, dto.size_id, locationId);
      const level = (await this.lock(tx, [id])).get(id)!;
      if (level.reserved.lt(qty)) {
        throw new ConflictException(
          `Only ${level.reserved} is reserved; cannot release ${qty}`,
        );
      }
      return tx.stockLevel.update({
        where: { id },
        data: { reserved: { decrement: qty } },
        include: levelInclude,
      });
    });
  }

  async setReorder(tenantId: string, dto: SetReorderDto) {
    await this.assertSize(tenantId, dto.size_id);
    const locationId = await this.resolveLocation(tenantId, dto.location_id);
    return this.prisma.stockLevel.upsert({
      where: {
        size_id_location_id: {
          size_id: dto.size_id,
          location_id: locationId,
        },
      },
      create: {
        tenant_id: tenantId,
        size_id: dto.size_id,
        location_id: locationId,
        reorder_at: dto.reorder_at ?? null,
      },
      update: { reorder_at: dto.reorder_at ?? null },
      include: levelInclude,
    });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /** Resolves which locations a movement touches and the base delta. */
  private async plan(tenantId: string, dto: CreateMovementDto) {
    const qty = dto.quantity !== undefined ? new D(dto.quantity) : undefined;

    switch (dto.type) {
      case 'IN': {
        this.requirePositive(qty);
        return {
          from: undefined,
          to: await this.resolveLocation(tenantId, dto.to_location_id),
          delta: qty!,
        };
      }
      case 'OUT': {
        this.requirePositive(qty);
        return {
          from: await this.resolveLocation(tenantId, dto.from_location_id),
          to: undefined,
          delta: qty!,
        };
      }
      case 'TRANSFER': {
        this.requirePositive(qty);
        const from = await this.resolveLocation(tenantId, dto.from_location_id);
        const to = await this.resolveLocation(tenantId, dto.to_location_id);
        if (from === to) {
          throw new BadRequestException(
            'TRANSFER needs two different locations',
          );
        }
        return { from, to, delta: qty! };
      }
      case 'ADJUST': {
        if (dto.counted === undefined && (qty === undefined || qty.isZero())) {
          throw new BadRequestException(
            'ADJUST needs a non-zero quantity delta or a counted value',
          );
        }
        if (dto.from_location_id && dto.to_location_id) {
          throw new BadRequestException('ADJUST takes a single location');
        }
        const loc = await this.resolveLocation(
          tenantId,
          dto.from_location_id ?? dto.to_location_id,
        );
        // Modelled as "from" so the same branch handles both signs of delta.
        return { from: loc, to: undefined, delta: qty ?? new D(0) };
      }
    }
  }

  private requirePositive(qty: Decimal | undefined) {
    if (!qty || qty.lte(0)) {
      throw new BadRequestException('quantity must be > 0');
    }
  }

  private async resolveLocation(tenantId: string, id?: string) {
    if (!id) return (await this.locations.ensureDefault(tenantId)).id;
    return (await this.locations.get(tenantId, id)).id;
  }

  private async assertSize(tenantId: string, sizeId: string) {
    const s = await this.prisma.size.findFirst({
      where: { id: sizeId, tenant_id: tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!s) throw new NotFoundException('Size not found');
  }

  /** Returns the stock_levels id for (size, location), creating a zero row if needed. */
  private async ensureLevel(
    tx: Tx,
    tenantId: string,
    sizeId: string,
    locationId: string,
  ) {
    const row = await tx.stockLevel.upsert({
      where: {
        size_id_location_id: { size_id: sizeId, location_id: locationId },
      },
      create: { tenant_id: tenantId, size_id: sizeId, location_id: locationId },
      update: {},
      select: { id: true },
    });
    return row.id;
  }

  private async lock(tx: Tx, ids: string[]) {
    const rows = await tx.$queryRaw<
      { id: string; quantity: string; reserved: string }[]
    >`
      SELECT id, quantity::text AS quantity, reserved::text AS reserved
      FROM "${Prisma.raw(DB_SCHEMA)}"."stock_levels"
      WHERE id IN (${Prisma.join(ids)})
      ORDER BY id
      FOR UPDATE`;
    const out = new Map<string, LockedLevel>();
    for (const r of rows) {
      out.set(r.id, {
        id: r.id,
        quantity: new D(r.quantity),
        reserved: new D(r.reserved),
      });
    }
    if (out.size !== ids.length) {
      throw new ConflictException('Stock row disappeared during the update');
    }
    return out;
  }
}
