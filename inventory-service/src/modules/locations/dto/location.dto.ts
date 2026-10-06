import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsJsonObject } from '../../../common/json.decorator';

const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class CreateLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE, { message: 'code may contain letters, digits, . _ -' })
  code: string;

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
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE, { message: 'code may contain letters, digits, . _ -' })
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  parent_id?: string | null;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsJsonObject()
  attributes?: Record<string, unknown>;
}
