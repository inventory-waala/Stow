import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsJsonObject } from '../../../common/json.decorator';
import { BarcodeType, ProductStatus } from '../../../../generated/prisma/client';

/** Decimal columns travel as strings so no precision is lost in JSON. */
const DECIMAL = /^-?\d{1,14}(\.\d{1,4})?$/;

export class CreateBarcodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  value: string;

  @IsOptional()
  @IsEnum(BarcodeType)
  type?: BarcodeType;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsJsonObject()
  metadata?: Record<string, unknown>;
}

/** One stock unit of a variant. Prices are per size and may be filled in later. */
export class CreateSizeDto {
  /** Must be on the variant type's axis list. Omit for single-unit variants. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sku?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(DECIMAL, { message: 'cost_price must be a decimal with up to 4 places' })
  cost_price?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(DECIMAL, { message: 'sell_price must be a decimal with up to 4 places' })
  sell_price?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsJsonObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateBarcodeDto)
  barcodes?: CreateBarcodeDto[];
}

export class UpdateSizeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sku?: string | null;

  /** `null` clears a price. */
  @IsOptional()
  @IsNumberString()
  @Matches(DECIMAL, { message: 'cost_price must be a decimal with up to 4 places' })
  cost_price?: string | null;

  @IsOptional()
  @IsNumberString()
  @Matches(DECIMAL, { message: 'sell_price must be a decimal with up to 4 places' })
  sell_price?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsJsonObject()
  metadata?: Record<string, unknown>;
}

/**
 * A named version of a product with its own properties (validated by its
 * variant type) and the sizes it comes in. Each variant picks its own type.
 */
export class CreateVariantDto {
  @IsString({ message: 'name is required' })
  @MinLength(1, { message: 'name is required' })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  variant_type_id?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  supplier_id?: string;

  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsJsonObject()
  metadata?: Record<string, unknown>;

  /** Omit for a single-unit variant; one "Default" size is created. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateSizeDto)
  sizes?: CreateSizeDto[];
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'name cannot be empty' })
  @MaxLength(200)
  name?: string;

  /** Changing the type re-checks attributes and every live size against it. */
  @IsOptional()
  @IsString()
  variant_type_id?: string | null;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  supplier_id?: string | null;

  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsJsonObject()
  metadata?: Record<string, unknown>;
}
