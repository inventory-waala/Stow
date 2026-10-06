import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsJsonObject } from '../../../common/json.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ProductStatus } from '../../../../generated/prisma/client';
import { CreateVariantDto } from '../../variants/dto/variant.dto';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[];

  /** Free-form properties of the product; anything the tenant wants to record. */
  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsJsonObject()
  metadata?: Record<string, unknown>;

  /**
   * At least one. Each variant picks its own variant type and lists its
   * sizes; a product with no real variation has one variant with one size.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'A product needs at least one named variant' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  category_id?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[];

  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsJsonObject()
  metadata?: Record<string, unknown>;
}

export class ListProductsDto extends PaginationDto {
  /** Case-insensitive match on name or code. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tag?: string;

  /** `?attr[fabric]=cotton` — exact match on a top-level attribute key. */
  @IsOptional()
  @IsJsonObject()
  attr?: Record<string, string>;
}
