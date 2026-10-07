import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrisma } from '../../common/prisma-errors';
import { InventoryClient } from '../../inventory/inventory.client';
import { computeTotals } from './order-totals';
import { dec, str } from '../../common/money';
import {
  CreateOrderDto,
  FulfilOrderDto,
  ListOrdersDto,
  OrderItemDto,
  UpdateOrderDto,
} from './dto/order.dto';
import { OrderStatus, Prisma } from '../../../generated/prisma/client';

/**
 * Permitted status moves. CONFIRMED and FULFILLED are absent from every entry:
 * they are reached only through confirm() and fulfil(), which touch stock in
 * inventory-service and record that they did.
 *
 * REVIEW is the pricing gate: an order goes back and forth between PENDING and
 * REVIEW while the special discount is agreed, and only an APPROVED order is
 * meant to commit stock.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['PENDING', 'REVIEW', 'CANCELLED'],
  PENDING: ['DRAFT', 'REVIEW', 'CANCELLED'],
  REVIEW: ['PENDING', 'APPROVED', 'CANCELLED'],
  APPROVED: ['REVIEW', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  FULFILLED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

/**
 * Stock may be reserved from any stage before it has shipped. Reserving locks
 * the lines, so in practice this is done once the figures are agreed — an
 * order in REVIEW that has reserved stock cannot have its discount changed
 * until the reservation is released.
 */
const CONFIRMABLE: OrderStatus[] = ['DRAFT', 'PENDING', 'REVIEW', 'APPROVED'];

/** An approved order may ship directly without a separate reservation step. */
const FULFILLABLE: OrderStatus[] = ['CONFIRMED', 'APPROVED', 'PENDING'];

const ORDER_INCLUDE = {
  customer: true,
  items: { orderBy: { created_at: 'asc' } },
  // Ladder order is arithmetic: the footer has to read back the way it was
  // computed, so never rely on insertion order.
  deductions: { orderBy: { sequence: 'asc' } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryClient,
  ) { }

  async list(tenantId: string, query: ListOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      tenant_id: tenantId,
      deleted_at: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customer ? { customer_id: query.customer } : {}),
      ...(query.min_amount || query.max_amount
        ? {
          total_amount: {
            ...(query.min_amount ? { gte: query.min_amount } : {}),
            ...(query.max_amount ? { lte: query.max_amount } : {}),
          },
        }
        : {}),
      ...(query.from || query.to
        ? {
          order_date: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
        : {}),
      ...(query.q
        ? {
          OR: [
            { invoice_no: { contains: query.q, mode: 'insensitive' } },
            {
              customer: { name: { contains: query.q, mode: 'insensitive' } },
            },
          ],
        }
        : {}),
    };

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [rows, total, grouped] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: [{ order_date: 'desc' }, { created_at: 'desc' }],
        take: limit,
        skip: offset,
        include: ORDER_INCLUDE,
      }),
      this.prisma.order.count({ where }),
      // Aggregated over the whole filtered set, not just this page, so the
      // header figure does not change as you page through.
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { total_amount: true },
      }),
    ]);

    return {
      items: rows.map(serialize),
      total,
      limit,
      offset,
      summary: summarise(total, grouped),
    };
  }

  async get(tenantId: string, id: string) {
    return serialize(await this.findOrFail(tenantId, id));
  }

  async create(
    tenantId: string,
    userId: string | undefined,
    dto: CreateOrderDto,
    token: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customer_id, tenant_id: tenantId, deleted_at: null },
    });
    if (!customer) throw new BadRequestException('Customer not found');

    const resolved = await this.resolveItems(dto.items, token);
    const totals = computeTotals({ ...dto, items: resolved.lines });
    const invoiceNo =
      dto.invoice_no?.trim() || (await this.nextInvoiceNo(tenantId));

    try {
      const created = await this.prisma.order.create({
        data: {
          tenant_id: tenantId,
          customer_id: dto.customer_id,
          invoice_no: invoiceNo,
          status: dto.status ?? 'DRAFT',
          order_date: dto.order_date ? new Date(dto.order_date) : new Date(),
          subtotal: totals.subtotal,
          discount: totals.discount,
          taxable_amount: totals.taxable_amount,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          round_off: totals.round_off,
          rounding: dto.rounding ?? 'NONE',
          rounding_precision: dec(dto.rounding_precision ?? '1'),
          total_amount: totals.total_amount,
          notes: dto.notes,
          remarks: dto.remarks,
          location_id: dto.location_id,
          created_by: userId,
          deductions: {
            create: totals.deductions.map((d) => ({
              tenant_id: tenantId,
              sequence: d.sequence,
              code: d.code,
              label: d.label,
              basis: d.basis,
              applies_to: d.applies_to,
              value: d.value,
              amount: d.amount,
              params: d.params as Prisma.InputJsonValue,
            })),
          },
          items: {
            create: totals.lines.map((line, i) => ({
              tenant_id: tenantId,
              size_id: dto.items[i].size_id,
              product_name: resolved.names[i].product_name,
              variant_name: resolved.names[i].variant_name,
              size_label: resolved.names[i].size_label,
              sku: resolved.names[i].sku,
              quantity: line.quantity,
              rate: line.rate,
              discount_type: line.discount_type,
              discount: line.discount,
              total: line.total,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });
      return serialize(created);
    } catch (error) {
      rethrowPrisma(error, 'Order');
    }
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateOrderDto,
    token: string,
  ) {
    const existing = await this.findOrFail(tenantId, id);
    if (existing.stock_posted_at) {
      throw new ConflictException(
        'A fulfilled order cannot be edited; its stock has already been posted',
      );
    }
    if (existing.status === 'CANCELLED' || existing.status === 'RETURNED') {
      throw new ConflictException(
        `A ${existing.status} order cannot be edited`,
      );
    }
    if (existing.reserved_at) {
      throw new ConflictException(
        'This order holds reserved stock. Cancel it to release the reservation ' +
        'before editing the lines.',
      );
    }

    if (dto.customer_id) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customer_id, tenant_id: tenantId, deleted_at: null },
      });
      if (!customer) throw new BadRequestException('Customer not found');
    }

    const resolved = dto.items
      ? await this.resolveItems(dto.items, token)
      : null;

    const totals = computeTotals({
      items:
        resolved?.lines ??
        existing.items.map((i) => ({
          quantity: i.quantity.toString(),
          rate: i.rate.toString(),
          discount_type: i.discount_type,
          discount: i.discount.toString(),
        })),
      // A ladder is replaced whole or left alone; patching one rung in place
      // would make the sequence ambiguous.
      deductions:
        dto.deductions ??
        existing.deductions.map((d) => ({
          code: d.code,
          label: d.label,
          basis: d.basis,
          applies_to: d.applies_to,
          value: d.value.toString(),
          params: d.params as Record<string, unknown>,
        })),
      rounding: dto.rounding ?? existing.rounding,
      rounding_precision:
        dto.rounding_precision ?? existing.rounding_precision.toString(),
      cgst_rate:
        dto.cgst_rate ?? rateOf(existing.cgst, existing.taxable_amount),
      sgst_rate:
        dto.sgst_rate ?? rateOf(existing.sgst, existing.taxable_amount),
      igst_rate:
        dto.igst_rate ?? rateOf(existing.igst, existing.taxable_amount),
    });

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.items && resolved) {
          await tx.orderItem.deleteMany({ where: { order_id: id } });
          await tx.orderItem.createMany({
            data: totals.lines.map((line, i) => ({
              tenant_id: tenantId,
              order_id: id,
              size_id: dto.items![i].size_id,
              product_name: resolved.names[i].product_name,
              variant_name: resolved.names[i].variant_name,
              size_label: resolved.names[i].size_label,
              sku: resolved.names[i].sku,
              quantity: line.quantity,
              rate: line.rate,
              discount_type: line.discount_type,
              discount: line.discount,
              total: line.total,
            })),
          });
        }
        // Always rewritten: the amounts depend on the lines, so even an
        // untouched ladder resolves to new figures when the items change.
        await tx.orderDeduction.deleteMany({ where: { order_id: id } });
        if (totals.deductions.length) {
          await tx.orderDeduction.createMany({
            data: totals.deductions.map((d) => ({
              tenant_id: tenantId,
              order_id: id,
              sequence: d.sequence,
              code: d.code,
              label: d.label,
              basis: d.basis,
              applies_to: d.applies_to,
              value: d.value,
              amount: d.amount,
              params: d.params as Prisma.InputJsonValue,
            })),
          });
        }
        return tx.order.update({
          where: { id },
          data: {
            ...(dto.customer_id ? { customer_id: dto.customer_id } : {}),
            ...(dto.invoice_no ? { invoice_no: dto.invoice_no } : {}),
            ...(dto.order_date ? { order_date: new Date(dto.order_date) } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
            ...(dto.location_id !== undefined
              ? { location_id: dto.location_id }
              : {}),
            ...(dto.rounding ? { rounding: dto.rounding } : {}),
            ...(dto.rounding_precision
              ? { rounding_precision: dec(dto.rounding_precision) }
              : {}),
            subtotal: totals.subtotal,
            discount: totals.discount,
            taxable_amount: totals.taxable_amount,
            cgst: totals.cgst,
            sgst: totals.sgst,
            igst: totals.igst,
            round_off: totals.round_off,
            total_amount: totals.total_amount,
          },
          include: ORDER_INCLUDE,
        });
      });
      return serialize(updated);
    } catch (error) {
      rethrowPrisma(error, 'Order');
    }
  }

  async setStatus(tenantId: string, id: string, status: OrderStatus) {
    const existing = await this.findOrFail(tenantId, id);
    if (status === existing.status) return serialize(existing);

    if (status === 'CONFIRMED') {
      throw new BadRequestException(
        'Use POST /orders/:id/confirm to confirm this order and reserve stock',
      );
    }
    if (status === 'FULFILLED') {
      throw new BadRequestException(
        'Use POST /orders/:id/fulfil to ship this order and post stock',
      );
    }
    if (!TRANSITIONS[existing.status].includes(status)) {
      throw new ConflictException(
        `Cannot move a ${existing.status} order to ${status}`,
      );
    }
    // Cancelling an order holding a reservation must give the stock back,
    // otherwise it stays unavailable forever.
    if (status === 'CANCELLED' && existing.reserved_at) {
      throw new BadRequestException(
        'Use POST /orders/:id/cancel to cancel this order and release its reserved stock',
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: ORDER_INCLUDE,
    });
    return serialize(updated);
  }

  /**
   * Reserves stock for every line without moving it, so the goods are held
   * while the order is open. inventory-service rejects the reservation with a
   * 409 if the available quantity is short, and that status is passed through.
   */
  async confirm(tenantId: string, id: string, token: string) {
    const existing = await this.findOrFail(tenantId, id);
    if (existing.reserved_at) {
      throw new ConflictException('This order has already reserved its stock');
    }
    if (!CONFIRMABLE.includes(existing.status)) {
      throw new ConflictException(`Cannot confirm a ${existing.status} order`);
    }
    if (existing.items.length === 0) {
      throw new ConflictException('Order has no lines to confirm');
    }

    const locationId = existing.location_id ?? undefined;
    for (const item of existing.items) {
      await this.inventory.reserve(
        {
          size_id: item.size_id,
          location_id: locationId,
          quantity: item.quantity.toString(),
        },
        token,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: 'CONFIRMED', reserved_at: new Date() },
      include: ORDER_INCLUDE,
    });
    this.logger.log(`Confirmed order ${existing.invoice_no}`);
    return serialize(updated);
  }

  /**
   * Ships the order: releases the reservation and posts an OUT movement per
   * line, so the quantity leaves stock exactly once.
   *
   * `stock_posted_at` makes this idempotent. Stock is posted before the status
   * is written, so a partial failure leaves the order unfulfilled with the
   * landed movements identifiable in inventory by reference_type/reference_id.
   */
  async fulfil(
    tenantId: string,
    id: string,
    dto: FulfilOrderDto,
    token: string,
  ) {
    const existing = await this.findOrFail(tenantId, id);
    if (existing.stock_posted_at) {
      throw new ConflictException(
        `Stock for this order was already posted at ${existing.stock_posted_at.toISOString()}`,
      );
    }
    if (!FULFILLABLE.includes(existing.status)) {
      throw new ConflictException(`Cannot fulfil a ${existing.status} order`);
    }
    if (existing.items.length === 0) {
      throw new ConflictException('Order has no lines to fulfil');
    }

    const locationId = dto.location_id ?? existing.location_id ?? undefined;

    for (const item of existing.items) {
      // Release first: the reservation and the OUT movement would otherwise
      // both subtract from availability for the same goods.
      if (existing.reserved_at) {
        await this.inventory.release(
          {
            size_id: item.size_id,
            location_id: locationId,
            quantity: item.quantity.toString(),
          },
          token,
        );
      }
      await this.inventory.createMovement(
        {
          size_id: item.size_id,
          type: 'OUT',
          quantity: item.quantity.toString(),
          from_location_id: locationId,
          reference_type: 'order',
          reference_id: existing.id,
          reason: `Shipped on order ${existing.invoice_no}`,
        },
        token,
      );
    }

    const now = new Date();
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'FULFILLED',
        fulfilled_at: now,
        stock_posted_at: now,
        reserved_at: null,
        ...(locationId ? { location_id: locationId } : {}),
      },
      include: ORDER_INCLUDE,
    });
    this.logger.log(
      `Fulfilled order ${existing.invoice_no} (${existing.items.length} lines)`,
    );
    return serialize(updated);
  }

  /** Cancels the order, releasing any reservation it holds. */
  async cancel(tenantId: string, id: string, token: string) {
    const existing = await this.findOrFail(tenantId, id);
    if (existing.status === 'CANCELLED') return serialize(existing);
    if (existing.stock_posted_at) {
      throw new ConflictException(
        'A fulfilled order cannot be cancelled; record a return instead',
      );
    }

    if (existing.reserved_at) {
      for (const item of existing.items) {
        await this.inventory.release(
          {
            size_id: item.size_id,
            location_id: existing.location_id ?? undefined,
            quantity: item.quantity.toString(),
          },
          token,
        );
      }
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED', reserved_at: null },
      include: ORDER_INCLUDE,
    });
    return serialize(updated);
  }

  /** Soft delete, refused once stock has been posted. */
  async remove(tenantId: string, id: string) {
    const existing = await this.findOrFail(tenantId, id);
    if (existing.stock_posted_at) {
      throw new ConflictException(
        'A fulfilled order cannot be deleted; it is an accounting record',
      );
    }
    if (existing.reserved_at) {
      throw new ConflictException(
        'Cancel this order first so its reserved stock is released',
      );
    }
    await this.prisma.order.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id, deleted: true };
  }

  private async findOrFail(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /**
   * Looks each line's stock unit up in inventory-service to copy its names onto
   * the invoice, and to fall back to the catalog sell price when the caller
   * sent no rate. The lookup is tenant-scoped by the forwarded token, so an id
   * from another tenant cannot be sold.
   */
  private async resolveItems(items: OrderItemDto[], token: string) {
    const unique = [...new Set(items.map((i) => i.size_id))];
    const lookups = new Map<
      string,
      Awaited<ReturnType<typeof this.inventory.getSize>>
    >();
    for (const sizeId of unique) {
      lookups.set(sizeId, await this.inventory.getSize(sizeId, token));
    }

    const names = items.map((item) => {
      const size = lookups.get(item.size_id)!;
      return {
        product_name: size.product?.name ?? 'Unknown product',
        variant_name: size.variant?.name ?? 'Unknown variant',
        size_label: size.label ?? '',
        sku: size.sku ?? null,
      };
    });

    const lines = items.map((item) => {
      const size = lookups.get(item.size_id)!;
      const rate = item.rate ?? size.sell_price ?? null;
      if (rate === null) {
        throw new BadRequestException(
          `No rate given for ${size.product?.name ?? item.size_id} and the ` +
          `catalog has no sell price for it`,
        );
      }
      return {
        quantity: item.quantity,
        rate: String(rate),
        discount_type: item.discount_type,
        discount: item.discount,
      };
    });

    return { names, lines };
  }

  /** INV-YYYYMMDD-NNNN, sequential per tenant per day (as justanidea numbered). */
  private async nextInvoiceNo(tenantId: string): Promise<string> {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${stamp}-`;
    const last = await this.prisma.order.findFirst({
      where: { tenant_id: tenantId, invoice_no: { startsWith: prefix } },
      orderBy: { invoice_no: 'desc' },
      select: { invoice_no: true },
    });
    const seq = last ? Number(last.invoice_no.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}

/**
 * What the filtered set is worth, in total and per status — the sales figure
 * the list header shows. Aggregated in the database so paging cannot change it.
 */
function summarise(
  total: number,
  grouped: Array<{
    status: string;
    _count: { _all: number };
    _sum: { total_amount: any };
  }>,
) {
  const by_status: Record<string, { count: number; total_amount: string }> = {};
  let sum = dec(0);
  for (const row of grouped) {
    const amount = dec(row._sum.total_amount?.toString());
    sum = sum.add(amount);
    by_status[row.status] = {
      count: row._count._all,
      total_amount: str(amount),
    };
  }
  return { count: total, total_amount: str(sum), by_status };
}

/** Percentage a stored tax amount represents of the taxable value. */
function rateOf(amount: any, taxable: any): string {
  const t = dec(taxable?.toString());
  if (t.isZero()) return '0';
  return dec(amount?.toString()).mul(100).div(t).toDecimalPlaces(4).toString();
}

function serialize(order: any) {
  return {
    ...order,
    subtotal: str(dec(order.subtotal?.toString())),
    discount: str(dec(order.discount?.toString())),
    round_off: str(dec(order.round_off?.toString())),
    rounding_precision: str(dec(order.rounding_precision?.toString())),
    deductions: (order.deductions ?? []).map((d: any) => ({
      ...d,
      value: str(dec(d.value?.toString())),
      amount: str(dec(d.amount?.toString())),
    })),
    taxable_amount: str(dec(order.taxable_amount?.toString())),
    cgst: str(dec(order.cgst?.toString())),
    sgst: str(dec(order.sgst?.toString())),
    igst: str(dec(order.igst?.toString())),
    total_amount: str(dec(order.total_amount?.toString())),
    cgst_rate: rateOf(order.cgst, order.taxable_amount),
    sgst_rate: rateOf(order.sgst, order.taxable_amount),
    igst_rate: rateOf(order.igst, order.taxable_amount),
    items: (order.items ?? []).map((item: any) => ({
      ...item,
      quantity: str(dec(item.quantity?.toString())),
      rate: str(dec(item.rate?.toString())),
      discount: str(dec(item.discount?.toString())),
      total: str(dec(item.total?.toString())),
    })),
  };
}
