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
import { DiscountType, OrderStatus } from '../../../../generated/prisma/client';

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

  @IsOptional()
  @IsEnum(DiscountType)
  discount_type?: DiscountType;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL)
  discount?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  special_discount_type?: DiscountType;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL)
  special_discount?: string;

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

  @IsOptional()
  @IsEnum(DiscountType)
  discount_type?: DiscountType;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL)
  discount?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  special_discount_type?: DiscountType;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL)
  special_discount?: string;

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
