import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JsonSchemaValidator } from '../../common/json-schema.validator';
import { VariantType } from '../../../generated/prisma/client';

/** Label given to the one size of a variant whose type has no axis. */
export const SINGLE_UNIT_LABEL = 'Default';

/** The parts of a VariantType needed to describe its axis and validate against it. */
export type TypeLike = Pick<VariantType, 'id' | 'name' | 'attribute_schema' | 'axis_key' | 'updated_at'>;

/**
 * The field of a variant type whose values each get their own price and
 * stock. Derived from the schema property `axis_key` points at: a choice
 * field fixes the allowed values, a text field leaves them free.
 */
export interface Axis {
  key: string;
  label: string;
  /** Allowed values; empty means any value. */
  values: string[];
  free: boolean;
}

type SchemaProps = Record<string, Record<string, unknown>>;

/**
 * Resolves VariantTypes and validates tenant data against them. Shared by
 * products, variants and sizes so every write path enforces the same rules.
 */
@Injectable()
export class ProductSchemaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: JsonSchemaValidator,
  ) {}

  async resolveVariantType(
    tenantId: string,
    variantTypeId: string | null | undefined,
  ): Promise<VariantType | null> {
    if (!variantTypeId) return null;
    const type = await this.prisma.variantType.findFirst({
      where: { id: variantTypeId, tenant_id: tenantId },
    });
    if (!type) throw new NotFoundException('Variant type not found');
    return type;
  }

  axisOf(type: TypeLike | null | undefined): Axis | null {
    if (!type?.axis_key) return null;
    const props = ((type.attribute_schema as Record<string, unknown>)?.properties ?? {}) as SchemaProps;
    const prop = props[type.axis_key];
    if (!prop) return null;
    const values = Array.isArray(prop.enum) ? prop.enum.map(String) : [];
    return {
      key: type.axis_key,
      label: typeof prop.title === 'string' && prop.title ? prop.title : type.axis_key,
      values,
      free: values.length === 0,
    };
  }

  /** API shape of a variant type: the stored row plus its axis spelled out. */
  presentType<T extends TypeLike>(type: T) {
    const axis = this.axisOf(type);
    return {
      ...type,
      axis_label: axis?.label ?? null,
      axis_values: axis?.values ?? [],
      axis_free: axis?.free ?? false,
    };
  }

  /**
   * Variant.attributes hold every field of the type EXCEPT the axis field:
   * its values live on the sizes. The schema is validated with that property
   * (and any `required` entry for it) removed.
   */
  assertVariantAttributes(type: TypeLike | null, attributes: unknown) {
    if (!type) return;
    this.validator.assert(
      `${type.id}:vattr:${type.updated_at.toISOString()}:${type.axis_key ?? ''}`,
      this.attributeSchema(type),
      attributes ?? {},
      'variant attributes',
    );
  }

  attributeSchema(type: TypeLike): Record<string, unknown> {
    const schema = { ...(type.attribute_schema as Record<string, unknown>) };
    const axis = this.axisOf(type);
    if (!axis) return schema;
    const props = { ...((schema.properties ?? {}) as SchemaProps) };
    delete props[axis.key];
    schema.properties = props;
    if (Array.isArray(schema.required)) {
      schema.required = schema.required.filter((k) => k !== axis.key);
    }
    return schema;
  }

  /**
   * Resolves the size labels a variant will carry. With an axis: at least
   * one, all distinct, and on the choice list when there is one. Without:
   * exactly one "Default". Untyped: any labels, defaulting to one "Default".
   */
  resolveSizeLabels(
    type: TypeLike | null,
    labels: Array<string | undefined>,
  ): string[] {
    const given = labels.map((l) => (l ?? '').trim());
    const axis = this.axisOf(type);
    if (type && !axis) {
      if (given.length > 1) {
        throw new BadRequestException(
          `Variant type "${type.name}" is a single unit; it cannot have several sizes`,
        );
      }
      return [SINGLE_UNIT_LABEL];
    }
    if (!given.length) {
      if (axis) {
        throw new BadRequestException(
          `Pick at least one ${axis.label} for this variant`,
        );
      }
      return [SINGLE_UNIT_LABEL];
    }
    const seen = new Set<string>();
    for (const l of given) {
      if (!l) throw new BadRequestException('Every size needs a label');
      if (seen.has(l)) throw new BadRequestException(`"${l}" is listed twice`);
      seen.add(l);
      this.assertSizeLabel(type, l);
    }
    return given;
  }

  assertSizeLabel(type: TypeLike | null, label: string) {
    if (!type) return;
    const axis = this.axisOf(type);
    if (!axis) {
      if (label !== SINGLE_UNIT_LABEL) {
        throw new BadRequestException(
          `Variant type "${type.name}" is a single unit; sizes are not allowed`,
        );
      }
      return;
    }
    if (!axis.free && !axis.values.includes(label)) {
      throw new BadRequestException(
        `${axis.label} "${label}" is not allowed by variant type "${type.name}" (allowed: ${axis.values.join(', ')})`,
      );
    }
  }
}
