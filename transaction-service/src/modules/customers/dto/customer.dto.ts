import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CustomerStatus } from '../../../../generated/prisma/client';

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export class CreateCustomerDto {
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
  @Matches(GSTIN, { message: 'gstin must be a 15-character GSTIN' })
  gstin?: string;

  @IsOptional()
  @IsString()
  @Matches(PAN, { message: 'pan must be a 10-character PAN' })
  pan?: string;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateCustomerDto extends CreateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare name: string;
}

export class ListCustomersDto extends PaginationDto {
  /** Matches name, code, phone, email or GSTIN. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}
