import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { IsJsonObject } from '../../../common/json.decorator';
import {
  DeductionBase,
  DeductionBasis,
  DiscountType,
  OrderStatus,
  RoundingMode,
} from '../../../../generated/prisma/client';

const POSITIVE_DECIMAL = /^\d{1,14}(\.\d{1,4})?$/;
const RATE = /^(100(\.0{1,4})?|\d{1,2}(\.\d{1,4})?)$/;

export class OrderItemDto {
  /** inventory-service `variant_sizes.id` — the stockable unit being sold. */
  @IsString()
  size_id: string;

  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, {
    message: 'quantity must be a positive decimal with up to 4 places',
  })
  quantity: string;

  /**
   * Price charged. Omit to take the size's sell_price from inventory-service at
   * the moment the order is written.
   */
  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, {
    message: 'rate must be a positive decimal with up to 4 places',
  })
  rate?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  discount_type?: DiscountType;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, { message: 'discount must be a positive decimal' })
  discount?: string;
}

/**
 * One rung of the invoice footer. `code` and `label` are free text: the names
 * are whatever the trade calls them, and the array order is the ladder order.
 */
export class OrderDeductionDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(120)
  label: string;

  @IsEnum(DeductionBasis)
  basis: DeductionBasis;

  @IsOptional()
  @IsEnum(DeductionBase)
  applies_to?: DeductionBase;

  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, { message: 'value must be a positive decimal' })
  value: string;

  @IsOptional()
  @IsJsonObject({ message: 'params must be an object' })
  params?: Record<string, unknown>;
}

export class CreateOrderDto {
  @IsString()
  customer_id: string;

  /** Auto-generated as INV-YYYYMMDD-NNNN if omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  invoice_no?: string;

  @IsOptional()
  @IsDateString()
  order_date?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  /**
   * The footer ladder, in the order it applies. Each rung takes its cut of
   * what the previous one left unless it says `applies_to: GROSS`.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderDeductionDto)
  deductions?: OrderDeductionDto[];

  @IsOptional()
  @IsEnum(RoundingMode)
  rounding?: RoundingMode;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, {
    message: 'rounding_precision must be a positive decimal',
  })
  rounding_precision?: string;

  /** Tax rates as percentages; the amounts are computed from the taxable value. */
  @IsOptional()
  @IsNumberString()
  @Matches(RATE, {
    message: 'cgst_rate must be a percentage between 0 and 100',
  })
  cgst_rate?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(RATE, {
    message: 'sgst_rate must be a percentage between 0 and 100',
  })
  sgst_rate?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(RATE, {
    message: 'igst_rate must be a percentage between 0 and 100',
  })
  igst_rate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  /** Which inventory location the goods leave from. */
  @IsOptional()
  @IsString()
  location_id?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  invoice_no?: string;

  @IsOptional()
  @IsDateString()
  order_date?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  /** Replaces the whole ladder when present; omit to leave it untouched. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderDeductionDto)
  deductions?: OrderDeductionDto[];

  @IsOptional()
  @IsEnum(RoundingMode)
  rounding?: RoundingMode;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL)
  rounding_precision?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(RATE)
  cgst_rate?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(RATE)
  sgst_rate?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(RATE)
  igst_rate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsOptional()
  @IsString()
  location_id?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class FulfilOrderDto {
  /** Overrides the order's location for this shipment. */
  @IsOptional()
  @IsString()
  location_id?: string;
}

export class ListOrdersDto extends PaginationDto {
  /** Matches invoice number or customer name. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  customer?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** Inclusive bounds on total_amount. */
  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, {
    message: 'min_amount must be a positive decimal',
  })
  min_amount?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, {
    message: 'max_amount must be a positive decimal',
  })
  max_amount?: string;
}
