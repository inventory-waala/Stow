export type DiscountType = "NONE" | "PERCENT" | "AMOUNT"

export interface PreviewLine {
  quantity: string
  price: string
  discountType: DiscountType
  discount: string
}

/**
 * One stored rung, as a service returns it. `label` is what prints and `code`
 * is the stable key to report on; both are free text because the names are
 * whatever the trade calls them.
 */
export interface Deduction {
  id: string
  sequence: number
  code: string
  label: string
  basis: DeductionBasis
  applies_to: DeductionBase
  value: string
  amount: string
}

export type DeductionBasis = "PERCENT" | "AMOUNT"
export type DeductionBase = "RUNNING" | "GROSS"
export type Rounding = "NONE" | "NORMAL" | "UP" | "DOWN"

/** One rung of the footer ladder, as the form holds it. */
export interface PreviewDeduction {
  code: string
  label: string
  basis: DeductionBasis
  appliesTo?: DeductionBase
  value: string
}

export interface PreviewInput {
  lines: PreviewLine[]
  deductions: PreviewDeduction[]
  cgstRate: string
  sgstRate: string
  igstRate: string
  rounding?: Rounding
  roundingPrecision?: string
}

export interface PreviewTotals {
  lineTotals: number[]
  /** Resolved amount per rung, in ladder order. */
  deductionAmounts: number[]
  subtotal: number
  discount: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  roundOff: number
  total: number
}

const num = (v: string | undefined) => {
  const n = Number((v ?? "").trim())
  return Number.isFinite(n) ? n : 0
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

function resolve(
  base: number,
  type: DiscountType | DeductionBasis,
  value: string
): number {
  if (type === "PERCENT") return (base * clamp(num(value), 0, 100)) / 100
  if (type === "AMOUNT") return clamp(num(value), 0, base)
  return 0
}

/**
 * Live preview of what a document will total, mirroring the server's
 * purchase-totals.ts / order-totals.ts: line discount, then the footer ladder
 * in sequence, then tax on what remains, then rounding.
 *
 * Plain numbers are fine here because this only paints the form. The stored
 * figures are always recomputed server-side in decimal, so a rounding
 * difference in the preview cannot reach the database.
 */
export function previewTotals(input: PreviewInput): PreviewTotals {
  const lineTotals = input.lines.map((line) => {
    const base = num(line.quantity) * num(line.price)
    return base - resolve(base, line.discountType, line.discount)
  })

  const subtotal = lineTotals.reduce((a, b) => a + b, 0)

  // Cascades: each rung takes its cut of what the last one left, unless it is
  // quoted off the gross.
  let running = subtotal
  const deductionAmounts = input.deductions.map((d) => {
    const base = d.appliesTo === "GROSS" ? subtotal : running
    const amount = Math.min(resolve(base, d.basis, d.value), running)
    running -= amount
    return amount
  })
  const discount = deductionAmounts.reduce((a, b) => a + b, 0)
  const taxable = running

  const cgst = (taxable * clamp(num(input.cgstRate), 0, 100)) / 100
  const sgst = (taxable * clamp(num(input.sgstRate), 0, 100)) / 100
  const igst = (taxable * clamp(num(input.igstRate), 0, 100)) / 100

  const payable = taxable + cgst + sgst + igst
  const roundOff = resolveRounding(
    payable,
    input.rounding ?? "NONE",
    num(input.roundingPrecision) || 1
  )

  return {
    lineTotals,
    deductionAmounts,
    subtotal,
    discount,
    taxable,
    cgst,
    sgst,
    igst,
    roundOff,
    total: payable + roundOff,
  }
}

function resolveRounding(total: number, mode: Rounding, precision: number): number {
  if (mode === "NONE" || precision <= 0) return 0
  const units = total / precision
  const rounded =
    mode === "UP"
      ? Math.ceil(units)
      : mode === "DOWN"
        ? Math.floor(units)
        : Math.round(units)
  return rounded * precision - total
}

export function fmtAmount(value: number, currency = "INR"): string {
  if (!Number.isFinite(value)) return "—"
  try {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    })
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}
