import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JsonSchemaValidator } from '../../common/json-schema.validator';
import { rethrowPrisma } from '../../common/prisma-errors';
import { ProductSchemaService } from '../products/product-schema.service';
import {
  CreateVariantTypeDto,
  UpdateVariantTypeDto,
} from './dto/variant-type.dto';
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class VariantTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schemas: JsonSchemaValidator,
    private readonly rules: ProductSchemaService,
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.variantType.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { variants: { where: { deleted_at: null } } } } },
    });
    return rows.map((r) => this.rules.presentType(r));
  }

  async get(tenantId: string, id: string) {
    return this.rules.presentType(await this.find(tenantId, id));
  }

  async create(tenantId: string, dto: CreateVariantTypeDto) {
    const schema = dto.attribute_schema ?? {};
    this.validate(schema, dto.axis_key);
    try {
      const row = await this.prisma.variantType.create({
        data: {
          tenant_id: tenantId,
          key: dto.key,
          name: dto.name,
          description: dto.description,
          attribute_schema: schema as Prisma.InputJsonValue,
          axis_key: dto.axis_key ?? null,
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
      return this.rules.presentType(row);
    } catch (e) {
      rethrowPrisma(e, 'Variant type');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateVariantTypeDto) {
    const existing = await this.find(tenantId, id);
    const schema = dto.attribute_schema ?? (existing.attribute_schema as Record<string, unknown>);
    const axisKey = dto.axis_key === undefined ? existing.axis_key : dto.axis_key;
    this.validate(schema, axisKey);
    try {
      const row = await this.prisma.variantType.update({
        where: { id },
        data: {
          key: dto.key,
          name: dto.name,
          description: dto.description,
          attribute_schema: dto.attribute_schema as Prisma.InputJsonValue,
          axis_key: axisKey,
          metadata: dto.metadata as Prisma.InputJsonValue,
        },
      });
      return this.rules.presentType(row);
    } catch (e) {
      rethrowPrisma(e, 'Variant type');
    }
  }

  async remove(tenantId: string, id: string) {
    await this.find(tenantId, id);
    const inUse = await this.prisma.variant.count({
      where: { variant_type_id: id, deleted_at: null },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `Variant type is used by ${inUse} variant(s); reassign them first`,
      );
    }
    await this.prisma.variantType.delete({ where: { id } });
    return { id };
  }

  /**
   * Variants whose attributes or sizes no longer fit the type after an edit.
   * Never blocks the edit; reported so the tenant can fix them.
   */
  async violations(tenantId: string, id: string) {
    const type = await this.find(tenantId, id);
    const variants = await this.prisma.variant.findMany({
      where: { variant_type_id: id, deleted_at: null },
      select: {
        id: true,
        name: true,
        attributes: true,
        product: { select: { id: true, name: true } },
        sizes: { where: { deleted_at: null }, select: { label: true } },
      },
    });
    const schema = this.rules.attributeSchema(type);
    const key = `${type.id}:vattr:${type.updated_at.toISOString()}:${type.axis_key ?? ''}`;
    const axis = this.rules.axisOf(type);
    const allowed = new Set(axis?.values ?? []);
    const out: Array<{
      product_id: string;
      product_name: string;
      variant_id: string;
      variant_name: string;
      errors: string[];
    }> = [];
    for (const v of variants) {
      const errors = this.schemas.problems(key, schema, v.attributes);
      if (axis && !axis.free) {
        for (const s of v.sizes) {
          if (!allowed.has(s.label)) errors.push(`${axis.label} "${s.label}" is not in the list`);
        }
      } else if (!axis && v.sizes.length > 1) {
        errors.push('single-unit type but the variant has several sizes');
      }
      if (errors.length) {
        out.push({
          product_id: v.product.id,
          product_name: v.product.name,
          variant_id: v.id,
          variant_name: v.name,
          errors,
        });
      }
    }
    return { variant_type_id: id, count: out.length, violations: out };
  }

  private async find(tenantId: string, id: string) {
    const type = await this.prisma.variantType.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!type) throw new NotFoundException('Variant type not found');
    return type;
  }

  /** The schema must be valid, and the axis (if any) must be one of its fields. */
  private validate(schema: Record<string, unknown>, axisKey: string | null | undefined) {
    this.schemas.assertValidSchema(schema, 'attribute_schema');
    if (!axisKey) return;
    const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const prop = props[axisKey];
    if (!prop) {
      throw new BadRequestException(
        `axis_key "${axisKey}" is not a field of this variant type`,
      );
    }
    if (prop.type !== 'string') {
      throw new BadRequestException(
        `The field that splits stock must be a text or choice field ("${axisKey}" is ${String(prop.type)})`,
      );
    }
  }
}
