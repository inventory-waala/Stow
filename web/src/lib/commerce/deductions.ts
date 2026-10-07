import { rows } from "@/lib/inventory/form-data"
import type { Deduction, DeductionBase, DeductionBasis, Rounding } from "@/lib/commerce/totals"

/** A rung as it travels to a service: no id, no resolved amount. */
export interface NewDeduction {
  code: string
  label: string
  basis: DeductionBasis
  applies_to: DeductionBase
  value: string
}

export const ROUNDING_MODES: Rounding[] = ["NONE", "NORMAL", "UP", "DOWN"]

export function asRounding(value: unknown): Rounding {
  const v = String(value ?? "NONE")
  return (ROUNDING_MODES as string[]).includes(v) ? (v as Rounding) : "NONE"
}

const DECIMAL = /^\d{1,14}(\.\d{1,4})?$/

/**
 * Reads the footer ladder out of a nested form body, in posted order — which
 * is the order it applies in.
 *
 * Rungs with no name or no value are dropped rather than rejected: the editor
 * leaves a blank row behind whenever someone adds one and changes their mind,
 * and an empty rung means nothing on a bill either way.
 */
export function readDeductions(data: Record<string, unknown>): NewDeduction[] {
  const out: NewDeduction[] = []

  for (const row of rows<Record<string, string>>(data.deductions)) {
    const label = (row.label ?? "").trim()
    const value = (row.value ?? "").trim()
    if (!label || !value || value === "0") continue
    if (!DECIMAL.test(value)) {
      throw new Error(`${label}: use a number with up to 4 decimals`)
    }
    const basis = row.basis === "AMOUNT" ? "AMOUNT" : "PERCENT"
    if (basis === "PERCENT" && Number(value) > 100) {
      throw new Error(`${label}: a percentage cannot be over 100`)
    }
    out.push({
      code: (row.code ?? "").trim() || codeFor(label),
      label: label.slice(0, 120),
      basis,
      applies_to: row.applies_to === "GROSS" ? "GROSS" : "RUNNING",
      value,
    })
  }

  return out
}

/** "Retail scheme" → RETAIL_SCHEME, the stable key to report on. */
export function codeFor(label: string): string {
  return (
    label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64) || "DEDUCTION"
  )
}

/** Stored rungs back into the shape the editor and preview want. */
export function toLadderRows(deductions: Deduction[]) {
  return deductions.map((d, i) => ({
    key: `stored-${d.id ?? i}`,
    code: d.code,
    label: d.label,
    basis: d.basis,
    appliesTo: d.applies_to,
    value: trimZeros(d.value),
  }))
}

/** "10.0000" → "10", so a stored figure edits the way it was typed. */
export function trimZeros(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}
