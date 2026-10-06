import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrisma } from '../../common/prisma-errors';
import { Page } from '../../common/dto/pagination.dto';
import { InventoryClient } from '../../inventory/inventory.client';
import { computeTotals } from './purchase-totals';
import { dec, str } from '../../common/money';
import {
  CreatePurchaseDto,
  ListPurchasesDto,
  PurchaseItemDto,
  ReceivePurchaseDto,
  UpdatePurchaseDto,
} from './dto/purchase.dto';
import { Prisma, PurchaseStatus } from '../../../generated/prisma/client';

/**
 * Which statuses a purchase order may move to. RECEIVED is deliberately absent
 * from every entry: it is reached only through receive(), which posts the stock
 * and records that it did.
 */
const TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  DRAFT: ['PENDING', 'ORDERED', 'APPROVED', 'CANCELLED'],
  PENDING: ['DRAFT', 'ORDERED', 'APPROVED', 'CANCELLED'],
  ORDERED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ORDERED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

/** Statuses from which stock may be received. */
const RECEIVABLE: PurchaseStatus[] = ['DRAFT', 'PENDING', 'ORDERED', 'APPROVED'];

const PURCHASE_INCLUDE = {
  supplier: true,
  items: { orderBy: { created_at: 'asc' } },
} satisfies Prisma.PurchaseOrderInclude;

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryClient,
  ) {}

  async list(tenantId: string, query: ListPurchasesDto): Promise<Page<any>> {
    const where: Prisma.PurchaseOrderWhereInput = {
      tenant_id: tenantId,
      deleted_at: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplier ? { supplier_id: query.supplier } : {}),
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
              { supplier: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [rows, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: [{ order_date: 'desc' }, { created_at: 'desc' }],
        take: limit,
        skip: offset,
        include: PURCHASE_INCLUDE,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { items: rows.map(serialize), total, limit, offset };
  }

  async get(tenantId: string, id: string) {
    return serialize(await this.findOrFail(tenantId, id));
  }

  async create(
    tenantId: string,
    userId: string | undefined,
    dto: CreatePurchaseDto,
    token: string,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplier_id, tenant_id: tenantId, deleted_at: null },
    });
    if (!supplier) throw new BadRequestException('Supplier not found');

    const resolved = await this.resolveItems(dto.items, token);
    const totals = computeTotals(dto);
    const invoiceNo =
      dto.invoice_no?.trim() || (await this.nextInvoiceNo(tenantId));

    try {
      const created = await this.prisma.purchaseOrder.create({
        data: {
          tenant_id: tenantId,
          supplier_id: dto.supplier_id,
          invoice_no: invoiceNo,
          status: dto.status ?? 'DRAFT',
          order_date: dto.order_date ? new Date(dto.order_date) : new Date(),
          subtotal: totals.subtotal,
          discount_type: dto.discount_type ?? 'NONE',
          discount: totals.discount,
          taxable_amount: totals.taxable_amount,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          total_amount: totals.total_amount,
          notes: dto.notes,
          remarks: dto.remarks,
          location_id: dto.location_id,
          created_by: userId,
          items: {
            create: totals.lines.map((line, i) => ({
              tenant_id: tenantId,
              size_id: dto.items[i].size_id,
              product_name: resolved[i].product_name,
              variant_name: resolved[i].variant_name,
              size_label: resolved[i].size_label,
              sku: resolved[i].sku,
              quantity: line.quantity,
              unit_price: line.unit_price,
              discount_type: line.discount_type,
              discount: line.discount,
              total_price: line.total_price,
            })),
          },
        },
        include: PURCHASE_INCLUDE,
      });
      return serialize(created);
    } catch (error) {
      rethrowPrisma(error, 'Purchase order');
    }
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePurchaseDto,
    token: string,
  ) {
    const existing = await this.findOrFail(tenantId, id);
    if (existing.status === 'RECEIVED' || existing.stock_posted_at) {
      throw new ConflictException(
        'A received purchase order cannot be edited; its stock has already been posted',
      );
    }
    if (existing.status === 'CANCELLED') {
      throw new ConflictException('A cancelled purchase order cannot be edited');
    }

    if (dto.supplier_id) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplier_id, tenant_id: tenantId, deleted_at: null },
      });
      if (!supplier) throw new BadRequestException('Supplier not found');
    }

    // Items are replaced wholesale rather than diffed: a purchase order is
    // edited as a document, and the totals have to be recomputed anyway.
    const items = dto.items;
    const resolved = items ? await this.resolveItems(items, token) : null;
    const totals = computeTotals({
      items:
        items ??
        existing.items.map((i) => ({
          quantity: i.quantity.toString(),
          unit_price: i.unit_price.toString(),
          discount_type: i.discount_type,
          discount: i.discount.toString(),
        })),
      discount_type: dto.discount_type ?? existing.discount_type,
      discount: dto.discount ?? existing.discount.toString(),
      cgst_rate: dto.cgst_rate ?? rateOf(existing.cgst, existing.taxable_amount),
      sgst_rate: dto.sgst_rate ?? rateOf(existing.sgst, existing.taxable_amount),
      igst_rate: dto.igst_rate ?? rateOf(existing.igst, existing.taxable_amount),
    });

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (items && resolved) {
          await tx.purchaseItem.deleteMany({ where: { purchase_id: id } });
          await tx.purchaseItem.createMany({
            data: totals.lines.map((line, i) => ({
              tenant_id: tenantId,
              purchase_id: id,
              size_id: items[i].size_id,
              product_name: resolved[i].product_name,
              variant_name: resolved[i].variant_name,
              size_label: resolved[i].size_label,
              sku: resolved[i].sku,
              quantity: line.quantity,
              unit_price: line.unit_price,
              discount_type: line.discount_type,
              discount: line.discount,
              total_price: line.total_price,
            })),
          });
        }
        return tx.purchaseOrder.update({
          where: { id },
          data: {
            ...(dto.supplier_id ? { supplier_id: dto.supplier_id } : {}),
            ...(dto.invoice_no ? { invoice_no: dto.invoice_no } : {}),
            ...(dto.order_date ? { order_date: new Date(dto.order_date) } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
            ...(dto.location_id !== undefined
              ? { location_id: dto.location_id }
              : {}),
            ...(dto.discount_type ? { discount_type: dto.discount_type } : {}),
            subtotal: totals.subtotal,
            discount: totals.discount,
            taxable_amount: totals.taxable_amount,
            cgst: totals.cgst,
            sgst: totals.sgst,
            igst: totals.igst,
            total_amount: totals.total_amount,
          },
          include: PURCHASE_INCLUDE,
        });
      });
      return serialize(updated);
    } catch (error) {
      rethrowPrisma(error, 'Purchase order');
    }
  }

  async setStatus(tenantId: string, id: string, status: PurchaseStatus) {
    const existing = await this.findOrFail(tenantId, id);
    if (status === existing.status) return serialize(existing);

    if (status === 'RECEIVED') {
      throw new BadRequestException(
        'Use POST /purchases/:id/receive to receive stock against this order',
      );
    }
    if (!TRANSITIONS[existing.status].includes(status)) {
      throw new ConflictException(
        `Cannot move a ${existing.status} purchase order to ${status}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include: PURCHASE_INCLUDE,
    });
    return serialize(updated);
  }

  /**
   * Posts one IN movement per line to inventory-service, then records the
   * receipt.
   *
   * `stock_posted_at` makes this idempotent: receiving twice is rejected rather
   * than doubling the stock. justanidea incremented stock when the purchase was
   * *created*, whatever its status, so a draft or cancelled order still moved
   * the books.
   *
   * Stock is posted before the status is written. If posting fails midway the
   * order stays un-received and the movements that did land are identifiable in
   * inventory by reference_type/reference_id, so the receipt can be retried
   * after reconciling. The reverse order would risk an order marked received
   * with no stock behind it.
   */
  async receive(
    tenantId: string,
    id: string,
    dto: ReceivePurchaseDto,
    token: string,
  ) {
    const existing = await this.findOrFail(tenantId, id);

    if (existing.stock_posted_at) {
      throw new ConflictException(
        `Stock for this purchase order was already posted at ${existing.stock_posted_at.toISOString()}`,
      );
    }
    if (!RECEIVABLE.includes(existing.status)) {
      throw new ConflictException(
        `Cannot receive a ${existing.status} purchase order`,
      );
    }
    if (existing.items.length === 0) {
      throw new ConflictException('Purchase order has no lines to receive');
    }

    const locationId = dto.location_id ?? existing.location_id ?? undefined;

    for (const item of existing.items) {
      await this.inventory.createMovement(
        {
          size_id: item.size_id,
          type: 'IN',
          quantity: item.quantity.toString(),
          to_location_id: locationId,
          reference_type: 'purchase',
          reference_id: existing.id,
          reason: `Received on purchase order ${existing.invoice_no}`,
        },
        token,
      );
    }

    const now = new Date();
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        received_at: now,
        stock_posted_at: now,
        ...(locationId ? { location_id: locationId } : {}),
      },
      include: PURCHASE_INCLUDE,
    });
    this.logger.log(
      `Received purchase order ${existing.invoice_no} (${existing.items.length} lines)`,
    );
    return serialize(updated);
  }

  /** Soft delete, refused once stock has been posted. */
  async remove(tenantId: string, id: string) {
    const existing = await this.findOrFail(tenantId, id);
    if (existing.stock_posted_at) {
      throw new ConflictException(
        'A received purchase order cannot be deleted; cancel it with a stock ' +
          'adjustment in inventory instead',
      );
    }
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id, deleted: true };
  }

  private async findOrFail(tenantId: string, id: string) {
    const purchase = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: PURCHASE_INCLUDE,
    });
    if (!purchase) throw new NotFoundException('Purchase order not found');
    return purchase;
  }

  /**
   * Looks each line's stock unit up in inventory-service so the product,
   * variant and size names can be copied onto the document. This also
   * validates that the size exists and belongs to the caller's tenant —
   * inventory scopes the lookup by the same token.
   */
  private async resolveItems(items: PurchaseItemDto[], token: string) {
    const unique = [...new Set(items.map((i) => i.size_id))];
    const lookups = new Map<string, Awaited<ReturnType<typeof this.inventory.getSize>>>();
    for (const sizeId of unique) {
      lookups.set(sizeId, await this.inventory.getSize(sizeId, token));
    }
    return items.map((item) => {
      const size = lookups.get(item.size_id)!;
      return {
        product_name: size.product?.name ?? 'Unknown product',
        variant_name: size.variant?.name ?? 'Unknown variant',
        size_label: size.label ?? '',
        sku: size.sku ?? null,
      };
    });
  }

  /** PO-YYYYMMDD-NNNN, sequential per tenant per day. */
  private async nextInvoiceNo(tenantId: string): Promise<string> {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PO-${stamp}-`;
    const last = await this.prisma.purchaseOrder.findFirst({
      where: { tenant_id: tenantId, invoice_no: { startsWith: prefix } },
      orderBy: { invoice_no: 'desc' },
      select: { invoice_no: true },
    });
    const seq = last ? Number(last.invoice_no.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}

/** Percentage a stored tax amount represents of the taxable value. */
function rateOf(amount: any, taxable: any): string {
  const t = dec(taxable?.toString());
  if (t.isZero()) return '0';
  return dec(amount?.toString()).mul(100).div(t).toDecimalPlaces(4).toString();
}

/**
 * Decimals leave this service as strings so JSON never silently loses
 * precision, and tax rates are echoed back so a client can repopulate the form
 * it submitted.
 */
function serialize(purchase: any) {
  return {
    ...purchase,
    subtotal: str(dec(purchase.subtotal?.toString())),
    discount: str(dec(purchase.discount?.toString())),
    taxable_amount: str(dec(purchase.taxable_amount?.toString())),
    cgst: str(dec(purchase.cgst?.toString())),
    sgst: str(dec(purchase.sgst?.toString())),
    igst: str(dec(purchase.igst?.toString())),
    total_amount: str(dec(purchase.total_amount?.toString())),
    cgst_rate: rateOf(purchase.cgst, purchase.taxable_amount),
    sgst_rate: rateOf(purchase.sgst, purchase.taxable_amount),
    igst_rate: rateOf(purchase.igst, purchase.taxable_amount),
    items: (purchase.items ?? []).map((item: any) => ({
      ...item,
      quantity: str(dec(item.quantity?.toString())),
      unit_price: str(dec(item.unit_price?.toString())),
      discount: str(dec(item.discount?.toString())),
      total_price: str(dec(item.total_price?.toString())),
    })),
  };
}
