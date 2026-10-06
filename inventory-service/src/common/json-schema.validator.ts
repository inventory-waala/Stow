import { BadRequestException, Injectable } from '@nestjs/common';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Validates tenant data (Variant.attributes) against the JSON Schema stored
 * on the tenant's VariantType. Compiled validators are cached per
 * (id, updated_at) so a schema edit invalidates its entry.
 */
@Injectable()
export class JsonSchemaValidator {
  private readonly ajv = addFormats(
    new Ajv({ allErrors: true, strict: false, coerceTypes: false }),
  );
  private readonly cache = new Map<string, ValidateFunction>();

  /** Throws 400 when `schema` is not itself valid JSON Schema. */
  assertValidSchema(schema: unknown, label: string): void {
    if (!isPlainObject(schema)) {
      throw new BadRequestException(`${label} must be a JSON Schema object`);
    }
    if (!this.ajv.validateSchema(schema)) {
      throw new BadRequestException(
        `${label} is not valid JSON Schema: ${this.ajv.errorsText(this.ajv.errors)}`,
      );
    }
  }

  /**
   * Validates `data` and returns a list of human-readable problems; empty
   * when valid. An empty schema `{}` accepts anything.
   */
  problems(
    cacheKey: string,
    schema: Record<string, unknown>,
    data: unknown,
  ): string[] {
    let validate = this.cache.get(cacheKey);
    if (!validate) {
      validate = this.ajv.compile(schema);
      this.cache.set(cacheKey, validate);
    }
    if (validate(data)) return [];
    return (validate.errors ?? []).map((e) =>
      `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`.trim(),
    );
  }

  /** Same as `problems`, but throws a 400 naming the field. */
  assert(
    cacheKey: string,
    schema: Record<string, unknown>,
    data: unknown,
    field: string,
  ): void {
    const errors = this.problems(cacheKey, schema, data);
    if (errors.length) {
      throw new BadRequestException({
        message: `${field} does not match the variant type schema`,
        errors,
      });
    }
  }
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
