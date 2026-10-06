import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrisma } from '../../common/prisma-errors';
import {
  StockTotals,
  summarizeStock,
  sumTotals,
  totalsFor,
} from '../../common/stock-summary';
import { Page } from '../../common/dto/pagination.dto';
import { ProductSchemaService } from './product-schema.service';
import {
  CreateProductDto,
  ListProductsDto,
  UpdateProductDto,
} from './dto/product.dto';
import { CreateSizeDto, CreateVariantDto } from '../variants/dto/variant.dto';
import { Prisma } from '../../../generated/prisma/client';

const listInclude = {
  category: { select: { id: true, slug: true, name: true } },
  variants: {
    where: { deleted_at: null },
    select: {
      id: true,
      name: true,
      sizes: {
        where: { deleted_at: null },
        orderBy: [{ sort: 'asc' }, { created_at: 'asc' }],
        select: {
          id: true,
          label: true,
          sku: true,
          unit: true,
          sell_price: true,
          currency: true,
          barcodes: { select: { value: true, is_primary: true }, orderBy: { is_primary: 'desc' } },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export const variantTypeSelect = {
  id: true,
  key: true,
  name: true,
  axis_key: true,
  attribute_schema: true,
  updated_at: true,
} satisfies Prisma.VariantTypeSelect;

export const sizeInclude = {
  barcodes: { orderBy: { is_primary: 'desc' } },
  stock: {
    include: { location: { select: { id: true, code: true, name: true } } },
  },
} satisfies Prisma.SizeInclude;

const detailInclude = {
  category: { select: { id: true, slug: true, name: true } },
  variants: {
    where: { deleted_at: null },
    orderBy: [{ sort: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
    include: {
      variant_type: { select: variantTypeSelect },
      sizes: {
        where: { deleted_at: null },
        orderBy: [{ sort: 'asc' }, { created_at: 'asc' }],
        include: sizeInclude,
      },
    },
  },
} satisfies Prisma.ProductInclude;

/** Attaches per-size and per-variant stock totals to variants that carry their sizes. */
export function withStock<
  S extends { id: string },
  V extends { sizes: S[] },
>(totals: Map<string, StockTotals>, variants: V[]) {
  return variants.map((v) => {
    const sizes = v.sizes.map((s) => ({ ...s, stock_totals: totalsFor(totals, s.id) }));
    return { ...v, sizes, stock_totals: sumTotals(sizes.map((s) => s.stock_totals)) };
  });
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schema: ProductSchemaService,
  ) {}

  async list(tenantId: string, q: ListProductsDto): Promise<Page<any>> {
    const where: Prisma.ProductWhereInput = {
      tenant_id: tenantId,
      deleted_at: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { category_id: q.category } : {}),
      ...(q.tag ? { tags: { has: q.tag } } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { code: { contains: q.q, mode: 'insensitive' } },
              {
                variants: {
                  some: {
                    deleted_at: null,
                    OR: [
                      { name: { contains: q.q, mode: 'insensitive' } },
                      {
                        sizes: {
                          some: {
                            deleted_at: null,
                            OR: [
                              { sku: { contains: q.q, mode: 'insensitive' } },
                              { barcodes: { some: { value: q.q } } },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    if (q.attr && Object.keys(q.attr).length) {
      where.AND = Object.entries(q.attr).map(([key, value]) => ({
        attributes: { path: [key], equals: coerce(value) },
      }));
    }

    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: listInclude,
        orderBy: { updated_at: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    const totals = await summarizeStock(
      this.prisma,
      rows.flatMap((p) => p.variants.flatMap((v) => v.sizes.map((s) => s.id))),
    );
    const items = rows.map((p) => {
      const variants = withStock(totals, p.variants);
      return {
        ...p,
        variants,
        variant_count: variants.length,
        size_count: variants.reduce((n, v) => n + v.sizes.length, 0),
        stock: sumTotals(variants.map((v) => v.stock_totals)),
      };
    });
    return { items, total, limit, offset };
  }

  async get(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: detailInclude,
    });
    if (!product) throw new NotFoundException('Product not found');

    const totals = await summarizeStock(
      this.prisma,
      product.variants.flatMap((v) => v.sizes.map((s) => s.id)),
    );
    const variants = withStock(totals, product.variants).map((v) => ({
      ...v,
      variant_type: v.variant_type ? this.schema.presentType(v.variant_type) : null,
    }));
    return {
      ...product,
      variants,
      stock: sumTotals(variants.map((v) => v.stock_totals)),
    };
  }

  async create(tenantId: string, dto: CreateProductDto) {
    if (dto.category_id) await this.assertCategory(tenantId, dto.category_id);

    const names = new Set<string>();
    const variants: Prisma.VariantCreateWithoutProductInput[] = [];
    for (const [i, v] of dto.variants.entries()) {
      if (names.has(v.name)) {
        throw new BadRequestException(`Variant "${v.name}" is listed twice`);
      }
      names.add(v.name);
      variants.push(await this.prepareVariant(tenantId, v, i));
    }

    try {
      const created = await this.prisma.product.create({
        data: {
          tenant_id: tenantId,
          name: dto.name,
          code: dto.code,
          description: dto.description,
          status: dto.status,
          category_id: dto.category_id,
          tags: dto.tags ?? [],
          attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
          variants: { create: variants },
        },
        select: { id: true },
      });
      return this.get(tenantId, created.id);
    } catch (e) {
      rethrowPrisma(e, 'Product');
    }
  }

  /**
   * Validates one incoming variant against its own variant type and returns
   * the nested create input (variant + sizes + barcodes). Shared with the
   * variants module so both write paths enforce the same rules.
   */
  async prepareVariant(
    tenantId: string,
    v: CreateVariantDto,
    sort: number,
  ): Promise<Prisma.VariantCreateWithoutProductInput> {
    const vtype = await this.schema.resolveVariantType(tenantId, v.variant_type_id);
    this.schema.assertVariantAttributes(vtype, v.attributes);
    const given = v.sizes ?? [];
    const labels = this.schema.resolveSizeLabels(vtype, given.map((s) => s.label));
    // A single-unit variant may still carry prices/sku on its one size.
    const sizes: CreateSizeDto[] = labels.map((label, i) => ({ ...(given[i] ?? {}), label }));
    return {
      tenant_id: tenantId,
      name: v.name,
      status: v.status,
      supplier_id: v.supplier_id,
      sort,
      attributes: (v.attributes ?? {}) as Prisma.InputJsonValue,
      metadata: (v.metadata ?? {}) as Prisma.InputJsonValue,
      variant_type: vtype ? { connect: { id: vtype.id } } : undefined,
      sizes: { create: sizes.map((s, i) => sizeCreateInput(tenantId, s, i)) },
    };
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
    });
    if (!existing) throw new NotFoundException('Product not found');
    if (dto.category_id) await this.assertCategory(tenantId, dto.category_id);

    try {
      await this.prisma.product.update({
        where: { id },
        data: {
          name: dto.name,
          code: dto.code,
          description: dto.description,
          status: dto.status,
          category_id: dto.category_id,
          tags: dto.tags,
          attributes: dto.attributes as Prisma.InputJsonValue,
          metadata: dto.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      rethrowPrisma(e, 'Product');
    }
    return this.get(tenantId, id);
  }

  /** Soft delete; stock rows are kept so the ledger stays auditable. */
  async remove(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.size.updateMany({
        where: { variant: { product_id: id }, deleted_at: null },
        data: { deleted_at: now },
      }),
      this.prisma.variant.updateMany({
        where: { product_id: id, deleted_at: null },
        data: { deleted_at: now, status: 'ARCHIVED' },
      }),
      this.prisma.product.update({
        where: { id },
        data: { deleted_at: now, status: 'ARCHIVED' },
      }),
    ]);
    return { id };
  }

  private async assertCategory(tenantId: string, categoryId: string) {
    const c = await this.prisma.category.findFirst({
      where: { id: categoryId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Category not found');
  }
}

/** Shared by product / variant create (nested) and size create. */
export function sizeCreateInput(
  tenantId: string,
  s: CreateSizeDto,
  sort: number,
): Prisma.SizeCreateWithoutVariantInput {
  return {
    tenant_id: tenantId,
    label: s.label!,
    sku: s.sku,
    cost_price: s.cost_price,
    sell_price: s.sell_price,
    currency: s.currency,
    unit: s.unit,
    sort: s.sort ?? sort,
    attributes: (s.attributes ?? {}) as Prisma.InputJsonValue,
    metadata: (s.metadata ?? {}) as Prisma.InputJsonValue,
    barcodes: s.barcodes?.length
      ? {
          create: s.barcodes.map((b, i) => ({
            tenant_id: tenantId,
            value: b.value,
            type: b.type,
            is_primary: b.is_primary ?? i === 0,
            metadata: (b.metadata ?? {}) as Prisma.InputJsonValue,
          })),
        }
      : undefined,
  };
}

/** Query-string values arrive as strings; match numbers/booleans stored as such too. */
function coerce(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}
