import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrisma } from '../../common/prisma-errors';
import { summarizeStock, totalsFor } from '../../common/stock-summary';
import { ProductSchemaService } from '../products/product-schema.service';
import {
  ProductsService,
  sizeCreateInput,
  sizeInclude,
  variantTypeSelect,
  withStock,
} from '../products/products.service';
import {
  CreateBarcodeDto,
  CreateSizeDto,
  CreateVariantDto,
  UpdateSizeDto,
  UpdateVariantDto,
} from './dto/variant.dto';
import { Prisma } from '../../../generated/prisma/client';

const variantInclude = {
  product: { select: { id: true, name: true, code: true } },
  variant_type: { select: variantTypeSelect },
  sizes: {
    where: { deleted_at: null },
    orderBy: [{ sort: 'asc' }, { created_at: 'asc' }],
    include: sizeInclude,
  },
} satisfies Prisma.VariantInclude;

const sizeDetailInclude = {
  ...sizeInclude,
  variant: {
    select: {
      id: true,
      name: true,
      attributes: true,
      product: { select: { id: true, name: true, code: true } },
      variant_type: { select: variantTypeSelect },
    },
  },
} satisfies Prisma.SizeInclude;

@Injectable()
export class VariantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schema: ProductSchemaService,
    private readonly products: ProductsService,
  ) {}

  // ── Variants ─────────────────────────────────────────────────────────────

  async listForProduct(tenantId: string, productId: string) {
    await this.assertProduct(tenantId, productId);
    const rows = await this.prisma.variant.findMany({
      where: { product_id: productId, deleted_at: null },
      include: variantInclude,
      orderBy: [{ sort: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
    });
    return this.withTotals(rows);
  }

  async get(tenantId: string, id: string) {
    const v = await this.prisma.variant.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: variantInclude,
    });
    if (!v) throw new NotFoundException('Variant not found');
    return (await this.withTotals([v]))[0];
  }

  /** Variant types are returned with their axis described, not just its key. */
  private present<T extends { variant_type: Parameters<ProductSchemaService['presentType']>[0] | null }>(rows: T[]) {
    return rows.map((r) => ({
      ...r,
      variant_type: r.variant_type ? this.schema.presentType(r.variant_type) : null,
    }));
  }

  async create(tenantId: string, productId: string, dto: CreateVariantDto) {
    await this.assertProduct(tenantId, productId);
    const last = await this.prisma.variant.aggregate({
      where: { product_id: productId },
      _max: { sort: true },
    });
    const data = await this.products.prepareVariant(tenantId, dto, (last._max.sort ?? -1) + 1);
    try {
      const created = await this.prisma.variant.create({
        data: { ...data, product: { connect: { id: productId } } },
        select: { id: true },
      });
      return this.get(tenantId, created.id);
    } catch (e) {
      rethrowPrisma(e, 'Variant');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateVariantDto) {
    const existing = await this.prisma.variant.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: { sizes: { where: { deleted_at: null }, select: { label: true } } },
    });
    if (!existing) throw new NotFoundException('Variant not found');

    const typeChanged =
      dto.variant_type_id !== undefined &&
      dto.variant_type_id !== existing.variant_type_id;
    if (typeChanged || dto.attributes !== undefined) {
      const vtype = await this.schema.resolveVariantType(
        tenantId,
        typeChanged ? dto.variant_type_id : existing.variant_type_id,
      );
      this.schema.assertVariantAttributes(vtype, dto.attributes ?? existing.attributes);
      // A new type must accept every live size, or the variant would be left
      // in a state the type says is impossible.
      if (typeChanged) {
        this.schema.resolveSizeLabels(vtype, existing.sizes.map((s) => s.label));
      }
    }

    try {
      await this.prisma.variant.update({
        where: { id },
        data: {
          name: dto.name,
          status: dto.status,
          supplier_id: dto.supplier_id,
          variant_type_id: dto.variant_type_id,
          attributes: dto.attributes as Prisma.InputJsonValue,
          metadata: dto.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      rethrowPrisma(e, 'Variant');
    }
    return this.get(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    const v = await this.prisma.variant.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      select: { product_id: true },
    });
    if (!v) throw new NotFoundException('Variant not found');
    const siblings = await this.prisma.variant.count({
      where: { product_id: v.product_id, deleted_at: null },
    });
    if (siblings <= 1) {
      throw new ConflictException(
        'A product must keep at least one variant; delete the product instead',
      );
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.size.updateMany({
        where: { variant_id: id, deleted_at: null },
        data: { deleted_at: now },
      }),
      this.prisma.variant.update({
        where: { id },
        data: { deleted_at: now, status: 'ARCHIVED' },
      }),
    ]);
    return { id };
  }

  // ── Sizes ────────────────────────────────────────────────────────────────

  async getSize(tenantId: string, id: string) {
    const s = await this.prisma.size.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: sizeDetailInclude,
    });
    if (!s) throw new NotFoundException('Size not found');
    const totals = await summarizeStock(this.prisma, [s.id]);
    return {
      ...s,
      variant: { ...s.variant, variant_type: s.variant.variant_type ? this.schema.presentType(s.variant.variant_type) : null },
      stock_totals: totalsFor(totals, s.id),
    };
  }

  /** Scan path: resolve a barcode value to the size it is printed on. */
  async lookupByBarcode(tenantId: string, value: string) {
    const barcode = await this.prisma.barcode.findFirst({
      where: { tenant_id: tenantId, value, size: { deleted_at: null } },
      select: { size_id: true },
    });
    if (!barcode) throw new NotFoundException('No size has this barcode');
    return this.getSize(tenantId, barcode.size_id);
  }

  async addSize(tenantId: string, variantId: string, dto: CreateSizeDto) {
    const variant = await this.prisma.variant.findFirst({
      where: { id: variantId, tenant_id: tenantId, deleted_at: null },
      include: {
        variant_type: true,
        sizes: { where: { deleted_at: null }, select: { label: true, sort: true } },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    const vtype = variant.variant_type;
    if (vtype && !this.schema.axisOf(vtype)) {
      throw new BadRequestException(
        `Variant type "${vtype.name}" is a single unit; it cannot have more sizes`,
      );
    }
    const label = (dto.label ?? '').trim();
    if (!label) throw new BadRequestException('label is required');
    this.schema.assertSizeLabel(vtype, label);
    if (variant.sizes.some((s) => s.label === label)) {
      throw new ConflictException(`This variant already has size "${label}"`);
    }
    const sort = variant.sizes.reduce((m, s) => Math.max(m, s.sort), -1) + 1;
    try {
      const created = await this.prisma.size.create({
        data: {
          ...sizeCreateInput(tenantId, { ...dto, label }, sort),
          variant: { connect: { id: variantId } },
        },
        select: { id: true },
      });
      return this.getSize(tenantId, created.id);
    } catch (e) {
      rethrowPrisma(e, 'Size');
    }
  }

  async updateSize(tenantId: string, id: string, dto: UpdateSizeDto) {
    const existing = await this.prisma.size.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: { variant: { include: { variant_type: true } } },
    });
    if (!existing) throw new NotFoundException('Size not found');
    const label = dto.label?.trim();
    if (label !== undefined && label !== existing.label) {
      this.schema.assertSizeLabel(existing.variant.variant_type, label);
    }
    try {
      await this.prisma.size.update({
        where: { id },
        data: {
          label,
          sku: dto.sku,
          cost_price: dto.cost_price,
          sell_price: dto.sell_price,
          currency: dto.currency,
          unit: dto.unit,
          sort: dto.sort,
          attributes: dto.attributes as Prisma.InputJsonValue,
          metadata: dto.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      rethrowPrisma(e, 'Size');
    }
    return this.getSize(tenantId, id);
  }

  async removeSize(tenantId: string, id: string) {
    const s = await this.prisma.size.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      select: { variant_id: true },
    });
    if (!s) throw new NotFoundException('Size not found');
    const siblings = await this.prisma.size.count({
      where: { variant_id: s.variant_id, deleted_at: null },
    });
    if (siblings <= 1) {
      throw new ConflictException(
        'A variant must keep at least one size; delete the variant instead',
      );
    }
    await this.prisma.size.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id };
  }

  // ── Barcodes ─────────────────────────────────────────────────────────────

  async addBarcode(tenantId: string, sizeId: string, dto: CreateBarcodeDto) {
    await this.getSize(tenantId, sizeId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.is_primary) {
          await tx.barcode.updateMany({
            where: { size_id: sizeId, is_primary: true },
            data: { is_primary: false },
          });
        }
        const count = await tx.barcode.count({ where: { size_id: sizeId } });
        return tx.barcode.create({
          data: {
            tenant_id: tenantId,
            size_id: sizeId,
            value: dto.value,
            type: dto.type,
            is_primary: dto.is_primary ?? count === 0,
            metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
          },
        });
      });
    } catch (e) {
      rethrowPrisma(e, 'Barcode');
    }
  }

  async removeBarcode(tenantId: string, barcodeId: string) {
    const b = await this.prisma.barcode.findFirst({
      where: { id: barcodeId, tenant_id: tenantId },
    });
    if (!b) throw new NotFoundException('Barcode not found');
    await this.prisma.barcode.delete({ where: { id: barcodeId } });
    return { id: barcodeId };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async assertProduct(tenantId: string, productId: string) {
    const p = await this.prisma.product.findFirst({
      where: { id: productId, tenant_id: tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  private async withTotals<
    T extends { sizes: Array<{ id: string }>; variant_type: Parameters<ProductSchemaService['presentType']>[0] | null },
  >(rows: T[]) {
    const totals = await summarizeStock(
      this.prisma,
      rows.flatMap((r) => r.sizes.map((s) => s.id)),
    );
    return this.present(withStock(totals, rows));
  }
}
