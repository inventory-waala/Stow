import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { SupplierStatus } from '../../../../generated/prisma/client';

/**
 * GSTIN is 15 chars: 2 state code, 10 PAN, 1 entity, 1 'Z', 1 checksum.
 * Validated by shape only — the checksum is not verified here.
 */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export class CreateSupplierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  division?: string;

  @IsOptional()
  @IsString()
  @Matches(GSTIN, { message: 'gstin must be a 15-character GSTIN' })
  gstin?: string;

  @IsOptional()
  @IsString()
  @Matches(PAN, { message: 'pan must be a 10-character PAN' })
  pan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cin?: string;

  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateSupplierDto extends CreateSupplierDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare name: string;
}

export class ListSuppliersDto extends PaginationDto {
  /** Matches name, code, GSTIN or phone. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;
}
