import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsJsonObject } from '../../../common/json.decorator';

const KEY = /^[a-z0-9][a-z0-9_-]*$/;

export class CreateVariantTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(KEY, { message: 'key must be lowercase letters, digits, - or _' })
  key: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** JSON Schema for Variant.attributes. */
  @IsOptional()
  @IsJsonObject()
  attribute_schema?: Record<string, unknown>;

  /**
   * Key of the ONE field (in attribute_schema) whose values each get their
   * own price and stock. Omit or send null for a single-unit variant type.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  axis_key?: string | null;

  @IsOptional()
  @IsJsonObject()
  metadata?: Record<string, unknown>;
}

export class UpdateVariantTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(KEY, { message: 'key must be lowercase letters, digits, - or _' })
  key?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsJsonObject()
  attribute_schema?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  axis_key?: string | null;

  @IsOptional()
  @IsJsonObject()
  metadata?: Record<string, unknown>;
}
