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
import {
  DiscountType,
  PurchaseStatus,
} from '../../../../generated/prisma/client';

const POSITIVE_DECIMAL = /^\d{1,14}(\.\d{1,4})?$/;
/** A tax or discount percentage, 0-100 with up to 4 decimals. */
const RATE = /^(100(\.0{1,4})?|\d{1,2}(\.\d{1,4})?)$/;

export class PurchaseItemDto {
  /** inventory-service `variant_sizes.id` — the stockable unit being bought. */
  @IsString()
  size_id: string;

  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, {
    message: 'quantity must be a positive decimal with up to 4 places',
  })
  quantity: string;

  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, {
    message: 'unit_price must be a positive decimal with up to 4 places',
  })
  unit_price: string;

  @IsOptional()
  @IsEnum(DiscountType)
  discount_type?: DiscountType;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, { message: 'discount must be a positive decimal' })
  discount?: string;
}

export class CreatePurchaseDto {
  @IsString()
  supplier_id: string;

  /** Supplier's invoice number. Auto-generated as PO-YYYYMMDD-NNNN if omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  invoice_no?: string;

  @IsOptional()
  @IsDateString()
  order_date?: string;

  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  /** Bill-level discount, applied to the sum of the lines. */
  @IsOptional()
  @IsEnum(DiscountType)
  discount_type?: DiscountType;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL, { message: 'discount must be a positive decimal' })
  discount?: string;

  /**
   * Tax *rates* as percentages, not amounts. The service computes the amounts
   * from the taxable value so the stored figures always reconcile with the
   * lines — a client cannot post a total that does not add up.
   */
  @IsOptional()
  @IsNumberString()
  @Matches(RATE, { message: 'cgst_rate must be a percentage between 0 and 100' })
  cgst_rate?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(RATE, { message: 'sgst_rate must be a percentage between 0 and 100' })
  sgst_rate?: string;

  @IsOptional()
  @IsNumberString()
  @Matches(RATE, { message: 'igst_rate must be a percentage between 0 and 100' })
  igst_rate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  /** Where received stock lands; null uses the tenant's default location. */
  @IsOptional()
  @IsString()
  location_id?: string;
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  supplier_id?: string;

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
  @Type(() => PurchaseItemDto)
  items?: PurchaseItemDto[];

  @IsOptional()
  @IsEnum(DiscountType)
  discount_type?: DiscountType;

  @IsOptional()
  @IsNumberString()
  @Matches(POSITIVE_DECIMAL)
  discount?: string;

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

export class UpdateStatusDto {
  @IsEnum(PurchaseStatus)
  status: PurchaseStatus;
}

export class ReceivePurchaseDto {
  /** Overrides the order's location for this receipt. */
  @IsOptional()
  @IsString()
  location_id?: string;
}

export class ListPurchasesDto extends PaginationDto {
  /** Matches invoice number or supplier name. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
