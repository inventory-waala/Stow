import { applyDiscount, D, dec, Decimal, money, ZERO } from '../../common/money';
import { DiscountType } from '../../../generated/prisma/client';

export interface LineInput {
  quantity: string;
  rate: string;
  discount_type?: DiscountType;
  discount?: string;
}

export interface LineTotals {
  quantity: Decimal;
  rate: Decimal;
  discount_type: DiscountType;
  discount: Decimal;
  total: Decimal;
}

export interface DocumentTotals {
  lines: LineTotals[];
  subtotal: Decimal;
  discount: Decimal;
  special_discount: Decimal;
  taxable_amount: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  total_amount: Decimal;
}

export interface DocumentInput {
  items: LineInput[];
  discount_type?: DiscountType;
  discount?: string;
  special_discount_type?: DiscountType;
  special_discount?: string;
  cgst_rate?: string;
  sgst_rate?: string;
  igst_rate?: string;
}

/**
 * Single source of truth for what an order adds up to. Totals are always
 * derived here and never taken from the request, so a stored invoice cannot
 * disagree with its own lines.
 *
 * Order of operations: line discount, then the bill discount on the line sum,
 * then the special discount on what remains, then tax. Each discount therefore
 * applies to the value after the previous one, and tax is charged on the fully
 * discounted amount, which is what GST requires.
 */
export function computeTotals(input: DocumentInput): DocumentTotals {
  const lines: LineTotals[] = input.items.map((item) => {
    const quantity = dec(item.quantity);
    const rate = dec(item.rate);
    const base = money(quantity.mul(rate));
    const discountType = item.discount_type ?? 'NONE';
    const discount = applyDiscount(base, {
      type: discountType,
      value: dec(item.discount),
    });
    return {
      quantity,
      rate,
      discount_type: discountType,
      discount,
      total: money(base.sub(discount)),
    };
  });

  const subtotal = money(
    lines.reduce((sum, l) => sum.add(l.total), ZERO as Decimal),
  );

  const billDiscount = applyDiscount(subtotal, {
    type: input.discount_type ?? 'NONE',
    value: dec(input.discount),
  });
  const afterBill = money(subtotal.sub(billDiscount));

  const specialDiscount = applyDiscount(afterBill, {
    type: input.special_discount_type ?? 'NONE',
    value: dec(input.special_discount),
  });
  const taxable = money(afterBill.sub(specialDiscount));

  const rate = (value?: string) => D.min(D.max(dec(value), 0), 100);
  const cgst = money(taxable.mul(rate(input.cgst_rate)).div(100));
  const sgst = money(taxable.mul(rate(input.sgst_rate)).div(100));
  const igst = money(taxable.mul(rate(input.igst_rate)).div(100));

  return {
    lines,
    subtotal,
    discount: billDiscount,
    special_discount: specialDiscount,
    taxable_amount: taxable,
    cgst,
    sgst,
    igst,
    total_amount: money(taxable.add(cgst).add(sgst).add(igst)),
  };
}
