import { applyDiscount, D, dec, Decimal, money, ZERO } from '../../common/money';
import { DiscountType } from '../../../generated/prisma/client';

export interface LineInput {
  quantity: string;
  unit_price: string;
  discount_type?: DiscountType;
  discount?: string;
}

export interface LineTotals {
  quantity: Decimal;
  unit_price: Decimal;
  discount_type: DiscountType;
  discount: Decimal;
  total_price: Decimal;
}

export interface DocumentTotals {
  lines: LineTotals[];
  subtotal: Decimal;
  discount: Decimal;
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
  cgst_rate?: string;
  sgst_rate?: string;
  igst_rate?: string;
}

/**
 * Single source of truth for what a purchase order adds up to.
 *
 * Totals are always derived here and never taken from the request, so a stored
 * document cannot disagree with its own lines. justanidea computed these in the
 * browser and persisted whatever arrived.
 *
 * Order of operations: line discount, then bill discount on the line sum, then
 * tax on what remains. Tax is therefore charged on the discounted value, which
 * is what GST requires.
 */
export function computeTotals(input: DocumentInput): DocumentTotals {
  const lines: LineTotals[] = input.items.map((item) => {
    const quantity = dec(item.quantity);
    const unitPrice = dec(item.unit_price);
    const base = money(quantity.mul(unitPrice));
    const discountType = item.discount_type ?? 'NONE';
    const discount = applyDiscount(base, {
      type: discountType,
      value: dec(item.discount),
    });
    return {
      quantity,
      unit_price: unitPrice,
      discount_type: discountType,
      discount,
      total_price: money(base.sub(discount)),
    };
  });

  const subtotal = money(
    lines.reduce((sum, l) => sum.add(l.total_price), ZERO as Decimal),
  );

  const billDiscount = applyDiscount(subtotal, {
    type: input.discount_type ?? 'NONE',
    value: dec(input.discount),
  });

  const taxable = money(subtotal.sub(billDiscount));

  const rate = (value?: string) => D.min(D.max(dec(value), 0), 100);
  const cgst = money(taxable.mul(rate(input.cgst_rate)).div(100));
  const sgst = money(taxable.mul(rate(input.sgst_rate)).div(100));
  const igst = money(taxable.mul(rate(input.igst_rate)).div(100));

  return {
    lines,
    subtotal,
    discount: billDiscount,
    taxable_amount: taxable,
    cgst,
    sgst,
    igst,
    total_amount: money(taxable.add(cgst).add(sgst).add(igst)),
  };
}
