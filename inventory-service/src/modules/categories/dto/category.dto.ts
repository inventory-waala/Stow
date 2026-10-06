import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsJsonObject } from '../../../common/json.decorator';

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(SLUG, { message: 'slug must be lowercase letters, digits or -' })
  slug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(SLUG, { message: 'slug must be lowercase letters, digits or -' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Pass null to move the category to the root. */
  @IsOptional()
  @IsString()
  parent_id?: string | null;

  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;
}
