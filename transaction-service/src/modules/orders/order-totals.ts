import {
  applyDiscount,
  D,
  dec,
  Decimal,
  money,
  roundOff,
  type Rounding,
  ZERO,
} from '../../common/money';
import {
  DeductionBase,
  DeductionBasis,
  DiscountType,
} from '../../../generated/prisma/client';

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

/** One rung of the footer ladder as the client sends it. */
export interface DeductionInput {
  code: string;
  label: string;
  basis: DeductionBasis;
  applies_to?: DeductionBase;
  value: string;
  params?: Record<string, unknown>;
}

export interface DeductionTotals {
  sequence: number;
  code: string;
  label: string;
  basis: DeductionBasis;
  applies_to: DeductionBase;
  value: Decimal;
  amount: Decimal;
  params: Record<string, unknown>;
}

export interface DocumentTotals {
  lines: LineTotals[];
  deductions: DeductionTotals[];
  subtotal: Decimal;
  discount: Decimal;
  taxable_amount: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  round_off: Decimal;
  total_amount: Decimal;
}

export interface DocumentInput {
  items: LineInput[];
  deductions?: DeductionInput[];
  cgst_rate?: string;
  sgst_rate?: string;
  igst_rate?: string;
  rounding?: Rounding;
  rounding_precision?: string;
}

/**
 * Single source of truth for what an order adds up to. Totals are always
 * derived here and never taken from the request, so a stored invoice cannot
 * disagree with its own lines.
 *
 * Order of operations: line discount, then the footer ladder in sequence, then
 * tax on what remains, then rounding. Tax is charged on the fully discounted
 * amount, which is what GST requires.
 *
 * The ladder replaces the old discount + special_discount pair: those were two
 * rungs of the same idea, and a third would have needed another column.
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

  const { deductions, taxable } = applyLadder(subtotal, input.deductions ?? []);
  const discount = money(
    deductions.reduce((sum, d) => sum.add(d.amount), ZERO as Decimal),
  );

  const rate = (value?: string) => D.min(D.max(dec(value), 0), 100);
  const cgst = money(taxable.mul(rate(input.cgst_rate)).div(100));
  const sgst = money(taxable.mul(rate(input.sgst_rate)).div(100));
  const igst = money(taxable.mul(rate(input.igst_rate)).div(100));

  const payable = money(taxable.add(cgst).add(sgst).add(igst));
  const round = roundOff(
    payable,
    input.rounding ?? 'NONE',
    input.rounding_precision ? dec(input.rounding_precision) : new D(1),
  );

  return {
    lines,
    deductions,
    subtotal,
    discount,
    taxable_amount: taxable,
    cgst,
    sgst,
    igst,
    round_off: round,
    total_amount: money(payable.add(round)),
  };
}

/**
 * Walks the footer rungs in the order they were given.
 *
 * A RUNNING percentage takes its cut of what is left, so 10% then 5% then 2%
 * leaves 83.79% of the subtotal rather than 83% — stacked trade terms are
 * quoted that way and the difference is real money. Each rung is clamped to
 * the balance still standing, so no ladder can drive an invoice below zero
 * however the form is filled.
 */
function applyLadder(
  subtotal: Decimal,
  inputs: DeductionInput[],
): { deductions: DeductionTotals[]; taxable: Decimal } {
  let running = subtotal;
  const deductions: DeductionTotals[] = [];

  inputs.forEach((input, index) => {
    const base = input.applies_to === 'GROSS' ? subtotal : running;
    const value = dec(input.value);
    const amount =
      input.basis === 'PERCENT'
        ? money(base.mul(D.min(D.max(value, 0), 100)).div(100))
        : D.min(D.max(value, 0), base);
    // A GROSS rung can exceed what earlier rungs left; never go negative.
    const capped = D.min(amount, running);

    deductions.push({
      sequence: index,
      code: input.code,
      label: input.label,
      basis: input.basis,
      applies_to: input.applies_to ?? 'RUNNING',
      value,
      amount: money(capped),
      params: input.params ?? {},
    });

    running = money(running.sub(capped));
  });

  return { deductions, taxable: running };
}
