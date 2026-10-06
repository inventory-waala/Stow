import { Prisma } from '../../generated/prisma/client';

export type Decimal = Prisma.Decimal;
export const D = Prisma.Decimal;

/** Scale every money column in this service is stored at. */
export const MONEY_SCALE = 4;

export const ZERO = new D(0);

export function dec(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return ZERO;
  return new D(value as any);
}

/** Rounds half-up to the money scale, the convention on an invoice line. */
export function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(MONEY_SCALE, D.ROUND_HALF_UP);
}

/** Decimals leave this service as strings so JSON never loses precision. */
export function str(value: Decimal): string {
  return money(value).toFixed(MONEY_SCALE);
}

export type Discount = { type: 'NONE' | 'PERCENT' | 'AMOUNT'; value: Decimal };

/**
 * Resolves a discount against a base. A PERCENT discount is clamped to 0-100
 * and an AMOUNT discount to the base itself, so no document can total below
 * zero however the client fills the form.
 */
export function applyDiscount(base: Decimal, discount: Discount): Decimal {
  if (discount.type === 'NONE') return ZERO;
  if (discount.type === 'PERCENT') {
    const pct = D.min(D.max(discount.value, 0), 100);
    return money(base.mul(pct).div(100));
  }
  return D.min(D.max(discount.value, 0), base);
}
