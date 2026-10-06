import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsJsonObject } from '../../../common/json.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { MovementType } from '../../../../generated/prisma/client';

const DECIMAL = /^-?\d{1,14}(\.\d{1,4})?$/;
const POSITIVE_DECIMAL = /^\d{1,14}(\.\d{1,4})?$/;

export class CreateMovementDto {
  /** The size (stock unit) being moved. */
  @IsString()
  size_id: string;

  @IsEnum(MovementType)
  type: MovementType;

  /**
   * IN / OUT / TRANSFER: amount moved (> 0).
   * ADJUST: signed delta, or omit and pass `counted` instead.
   */
  @IsOptional()
  @IsNumberString()
  @Matches(DECIMAL, { message: 'quantity must be a decimal with up to 4 places' })
  quantity?: string;

  /** ADJUST only: the physically counted quantity; the delta is derived. */
  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, { message: 'counted must be a non-negative decimal' })
  counted?: string;

  /** Defaults to the tenant's default location where the type needs one. */
  @IsOptional()
  @IsString()
  from_location_id?: string;

  @IsOptional()
  @IsString()
  to_location_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsJsonObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  occurred_at?: string;
}

export class ReservationDto {
  @IsString()
  size_id: string;

  @IsOptional()
  @IsString()
  location_id?: string;

  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, { message: 'quantity must be a positive decimal' })
  quantity: string;
}

export class SetReorderDto {
  @IsString()
  size_id: string;

  @IsOptional()
  @IsString()
  location_id?: string;

  /** null clears the threshold. */
  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, { message: 'reorder_at must be a non-negative decimal' })
  reorder_at?: string | null;
}

export class ListStockDto extends PaginationDto {
  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  variant?: string;

  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  below_reorder?: boolean;
}

export class ListMovementsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  variant?: string;

  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @IsOptional()
  @IsString()
  reference_type?: string;

  @IsOptional()
  @IsString()
  reference_id?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
