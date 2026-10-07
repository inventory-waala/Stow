"use client"

import { useId, useRef, useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"

import type {
  DeductionBase,
  DeductionBasis,
  PreviewDeduction,
} from "@/lib/commerce/totals"
import { fmtAmount } from "@/lib/commerce/totals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectField } from "@/components/inventory/select-field"

export interface LadderRow extends PreviewDeduction {
  /** Stable across re-renders so React keys survive a reorder. */
  key: string
}

/** Turns a label into the reporting key, so "Retail scheme" → RETAIL_SCHEME. */
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

/**
 * `key` is supplied by the caller rather than a module counter: a counter
 * resets on a Fast Refresh while the rows on screen keep the old numbers, and
 * the next add then hands out a duplicate React key.
 */
export function newRow(key: string, label = ""): LadderRow {
  return {
    key,
    code: "",
    label,
    basis: "PERCENT",
    appliesTo: "RUNNING",
    value: "",
  }
}

/** Names the trade uses most, offered as a starting point rather than a list. */
const SUGGESTED = ["Wholesale discount", "Retail scheme", "Trade discount", "Cash discount"]

/**
 * The bill footer between the line subtotal and the taxable value: as many
 * named rungs as the deal has, in the order they apply.
 *
 * Each row posts as `deductions[i][field]` so a plain form submit carries the
 * whole ladder, and the array order is the ladder order — which is arithmetic,
 * since a percentage takes its cut of what the previous rung left.
 */
export function DeductionLadder({
  name = "deductions",
  rows,
  onChange,
  amounts,
  currency = "INR",
  disabled,
}: {
  name?: string
  rows: LadderRow[]
  onChange: (rows: LadderRow[]) => void
  /** Resolved amounts from the live preview, one per row. */
  amounts?: number[]
  currency?: string
  disabled?: boolean
}) {
  const [adding, setAdding] = useState("")
  const keySeq = useRef(0)
  const instance = useId()

  const update = (key: string, patch: Partial<LadderRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const add = (label: string) => {
    onChange([...rows, newRow(`${instance}-${(keySeq.current += 1)}`, label)])
    setAdding("")
  }

  const move = (index: number, by: number) => {
    const next = [...rows]
    const to = index + by
    if (to < 0 || to >= next.length) return
    ;[next[index], next[to]] = [next[to], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div
          key={row.key}
          className="grid gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto]"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${name}-${i}-label`} className="text-xs">
              Name
            </Label>
            <Input
              id={`${name}-${i}-label`}
              value={row.label}
              onChange={(e) => update(row.key, { label: e.target.value })}
              placeholder="Trade discount"
              maxLength={120}
              disabled={disabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${name}-${i}-basis`} className="text-xs">
              Type
            </Label>
            <SelectField
              id={`${name}-${i}-basis`}
              value={row.basis}
              onValueChange={(v) => update(row.key, { basis: v as DeductionBasis })}
              options={[
                { value: "PERCENT", label: "%" },
                { value: "AMOUNT", label: currency },
              ]}
              disabled={disabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${name}-${i}-value`} className="text-xs">
              Value
            </Label>
            <Input
              id={`${name}-${i}-value`}
              value={row.value}
              onChange={(e) => update(row.key, { value: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              disabled={disabled}
            />
          </div>

          <div className="flex items-end justify-between gap-2 sm:justify-end">
            <span className="font-mono text-sm tabular text-muted-foreground">
              {amounts?.[i] !== undefined ? `− ${fmtAmount(amounts[i], currency)}` : null}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${row.label || "rung"} up`}
                disabled={disabled || i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${row.label || "rung"} down`}
                disabled={disabled || i === rows.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${row.label || "rung"}`}
                disabled={disabled}
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Posted, not shown: the percentage base is a per-rung detail most
              bills never vary, so it stays out of the way until it is needed. */}
          <input type="hidden" name={`${name}[${i}][code]`} value={row.code || codeFor(row.label)} />
          <input type="hidden" name={`${name}[${i}][label]`} value={row.label} />
          <input type="hidden" name={`${name}[${i}][basis]`} value={row.basis} />
          <input
            type="hidden"
            name={`${name}[${i}][applies_to]`}
            value={row.appliesTo ?? "RUNNING"}
          />
          <input type="hidden" name={`${name}[${i}][value]`} value={row.value || "0"} />

          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-4">
            <input
              type="checkbox"
              checked={row.appliesTo === "GROSS"}
              disabled={disabled}
              onChange={(e) =>
                update(row.key, { appliesTo: e.target.checked ? "GROSS" : "RUNNING" })
              }
              className="size-3.5 accent-current"
            />
            Take this off the subtotal instead of the running balance
          </label>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            if (adding.trim()) add(adding)
          }}
          placeholder="Add a deduction…"
          className="w-48"
          aria-label="Name of the deduction to add"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={disabled || !adding.trim()}
          onClick={() => add(adding)}
        >
          <PlusIcon className="size-3.5" />
          Add
        </Button>
        {SUGGESTED.filter((s) => !rows.some((r) => r.label === s)).map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => add(s)}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-solid hover:text-foreground"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  )
}
