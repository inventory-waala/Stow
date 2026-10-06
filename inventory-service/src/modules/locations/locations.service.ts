import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrisma } from '../../common/prisma-errors';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { Prisma } from '../../../generated/prisma/client';

export const DEFAULT_LOCATION = { code: 'MAIN', name: 'Main store' };

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    await this.ensureDefault(tenantId);
    return this.prisma.location.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ is_default: 'desc' }, { parent_id: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { stock: true, children: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.location.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!row) throw new NotFoundException('Location not found');
    return row;
  }

  /**
   * Single-site tenants never pick a location, so one is created lazily the
   * first time the tenant touches locations or stock.
   */
  async ensureDefault(tenantId: string) {
    const existing = await this.prisma.location.findFirst({
      where: { tenant_id: tenantId, is_default: true },
    });
    if (existing) return existing;
    const any = await this.prisma.location.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
    });
    if (any) {
      return this.prisma.location.update({
        where: { id: any.id },
        data: { is_default: true },
      });
    }
    try {
      return await this.prisma.location.create({
        data: { tenant_id: tenantId, ...DEFAULT_LOCATION, is_default: true },
      });
    } catch (e: any) {
      // Two first requests racing: the other one won, use its row.
      if (e?.code === 'P2002') {
        return this.prisma.location.findFirstOrThrow({
          where: { tenant_id: tenantId, code: DEFAULT_LOCATION.code },
        });
      }
      throw e;
    }
  }

  async create(tenantId: string, dto: CreateLocationDto) {
    if (dto.parent_id) await this.get(tenantId, dto.parent_id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.is_default) await this.clearDefault(tx, tenantId);
        return tx.location.create({
          data: {
            tenant_id: tenantId,
            code: dto.code,
            name: dto.name,
            description: dto.description,
            parent_id: dto.parent_id,
            is_default: dto.is_default ?? false,
            attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
          },
        });
      });
    } catch (e) {
      rethrowPrisma(e, 'Location');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateLocationDto) {
    const existing = await this.get(tenantId, id);
    if (dto.parent_id) {
      if (dto.parent_id === id) {
        throw new BadRequestException('A location cannot be its own parent');
      }
      await this.get(tenantId, dto.parent_id);
      if (await this.isDescendant(dto.parent_id, id)) {
        throw new BadRequestException(
          'Cannot move a location under one of its own descendants',
        );
      }
    }
    if (dto.is_default === false && existing.is_default) {
      throw new BadRequestException(
        'Mark another location as default instead of unsetting this one',
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.is_default) await this.clearDefault(tx, tenantId);
        return tx.location.update({
          where: { id },
          data: {
            code: dto.code,
            name: dto.name,
            description: dto.description,
            parent_id: dto.parent_id,
            is_default: dto.is_default,
            attributes: dto.attributes as Prisma.InputJsonValue,
          },
        });
      });
    } catch (e) {
      rethrowPrisma(e, 'Location');
    }
  }

  async remove(tenantId: string, id: string) {
    const loc = await this.get(tenantId, id);
    if (loc.is_default) {
      throw new ConflictException('The default location cannot be deleted');
    }
    const [children, stocked] = await Promise.all([
      this.prisma.location.count({ where: { parent_id: id } }),
      this.prisma.stockLevel.count({
        where: { location_id: id, OR: [{ quantity: { not: 0 } }, { reserved: { not: 0 } }] },
      }),
    ]);
    if (children > 0 || stocked > 0) {
      throw new ConflictException(
        `Location has ${children} sub-locations and ${stocked} stocked variants; move them first`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.stockLevel.deleteMany({ where: { location_id: id } }),
      this.prisma.location.delete({ where: { id } }),
    ]);
    return { id };
  }

  private clearDefault(tx: Prisma.TransactionClient, tenantId: string) {
    return tx.location.updateMany({
      where: { tenant_id: tenantId, is_default: true },
      data: { is_default: false },
    });
  }

  private async isDescendant(candidate: string, ancestor: string) {
    let current: string | null = candidate;
    for (let depth = 0; current && depth < 64; depth++) {
      if (current === ancestor) return true;
      const row: { parent_id: string | null } | null =
        await this.prisma.location.findUnique({
          where: { id: current },
          select: { parent_id: true },
        });
      current = row?.parent_id ?? null;
    }
    return false;
  }
}
