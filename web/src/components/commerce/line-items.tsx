"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { PlusIcon, SearchIcon, XIcon } from "lucide-react"

import type { Line } from "@/components/inventory/quick-stock-sheet"
import {
  fmtAmount,
  previewTotals,
  type DiscountType,
  type PreviewTotals,
  type Rounding,
} from "@/lib/commerce/totals"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectField } from "@/components/inventory/select-field"
import { ScanButton } from "@/components/inventory/scanner/scan-button"
import {
  DeductionLadder,
  type LadderRow,
} from "@/components/commerce/deduction-ladder"
import { fmtQty } from "@/components/inventory/primitives"

export interface Row {
  key: string
  line: Line | null
  quantity: string
  price: string
  discountType: DiscountType
  discount: string
}

const DISCOUNT_OPTIONS = [
  { value: "NONE", label: "No discount" },
  { value: "PERCENT", label: "%" },
  { value: "AMOUNT", label: "Amount" },
]

/** One style/colour, with every size it comes in. */
interface VariantGroup {
  key: string
  product: string
  variant: string
  code: string | null
  sizes: Line[]
  available: number
  unit: string
  text: string
}

/** The sizes a variant is bought in, with how many of each. */
export interface Pick {
  line: Line
  quantity: string
}

function groupByVariant(lines: Line[]): VariantGroup[] {
  const byVariant = new Map<string, VariantGroup>()
  for (const line of lines) {
    const existing = byVariant.get(line.variantId)
    if (existing) {
      existing.sizes.push(line)
      // Decimals arrive as strings; this total only labels the row, and the
      // stored figures are always recomputed server-side.
      existing.available += Number(line.totals.available) || 0
      continue
    }
    byVariant.set(line.variantId, {
      key: line.variantId,
      product: line.product,
      variant: line.variant,
      code: line.code,
      sizes: [line],
      available: Number(line.totals.available) || 0,
      unit: line.unit,
      // Every size's SKUs and barcodes stay searchable, so typing one still
      // finds the variant it belongs to.
      text: line.text,
    })
  }
  for (const group of byVariant.values()) {
    if (group.sizes.length > 1) {
      group.text = group.sizes.map((s) => s.text).join(" ")
    }
  }
  return [...byVariant.values()]
}

/** A variant with one unnamed size is a single unit; there is nothing to pick. */
const isSingleUnit = (group: VariantGroup) =>
  group.sizes.length === 1 && group.sizes[0].label === "Default"

/**
 * Search by product or variant, then choose the sizes.
 *
 * Listing every size in the results is wrong for the way stock is actually
 * bought and sold: a style comes in a size run, and a buyer wants S-M-L-XL of
 * one colour in one go, not four searches for the same shirt. So the list is
 * one row per variant, and picking one opens its sizes with a quantity each.
 *
 * A scanned barcode still identifies exactly one size, so it skips the size
 * step and adds that line directly.
 */
function LinePicker({
  lines,
  onPick,
  label,
  inputRef,
}: {
  lines: Line[]
  onPick: (picks: Pick[]) => void
  label: string
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [chosen, setChosen] = useState<VariantGroup | null>(null)
  const [qty, setQty] = useState<Record<string, string>>({})
  const listId = useId()

  const groups = useMemo(() => groupByVariant(lines), [lines])
  const needle = query.trim().toLowerCase()
  const results = useMemo(
    () => (needle ? groups.filter((g) => g.text.includes(needle)).slice(0, 8) : []),
    [groups, needle]
  )

  // A fresh set of hits means the old highlight is meaningless, and typing one
  // more letter must not leave the selection pointing past the end.
  const at = Math.min(active, Math.max(results.length - 1, 0))

  const reset = () => {
    setQuery("")
    setActive(0)
    setChosen(null)
    setQty({})
  }

  const addOne = (line: Line) => {
    onPick([{ line, quantity: "1" }])
    reset()
  }

  const choose = (group: VariantGroup) => {
    if (isSingleUnit(group)) {
      addOne(group.sizes[0])
      return
    }
    setChosen(group)
    setQty({})
  }

  const confirm = () => {
    if (!chosen) return
    const picks = chosen.sizes
      .filter((s) => Number(qty[s.sizeId]) > 0)
      .map((s) => ({ line: s, quantity: qty[s.sizeId] }))
    if (!picks.length) return
    onPick(picks)
    reset()
    inputRef?.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return
    // The list is the thing being driven here, so these keys never reach the
    // form's Enter-advances handler or the voucher's own bindings.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      event.stopPropagation()
      const by = event.key === "ArrowDown" ? 1 : -1
      // Wraps, so holding one arrow cycles instead of dead-ending.
      setActive((prev) => {
        const from = Math.min(prev, results.length - 1)
        return (from + by + results.length) % results.length
      })
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      choose(results[at])
    }
  }

  const chosenTotal = chosen
    ? chosen.sizes.reduce((sum, s) => sum + (Number(qty[s.sizeId]) || 0), 0)
    : 0
  const chosenCount = chosen
    ? chosen.sizes.filter((s) => Number(qty[s.sizeId]) > 0).length
    : 0

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
              setChosen(null)
            }}
            onKeyDown={onKeyDown}
            placeholder={label}
            className="pl-9"
            aria-label={label}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${at}` : undefined}
            autoComplete="off"
          />
        </div>
        <ScanButton
          title="Scan to add a line"
          hint="Scan or type a barcode"
          onScan={(code) => {
            // A barcode names one size exactly, so there is nothing to choose.
            const hit = lines.find((l) => l.barcodes.includes(code.trim()))
            if (hit) addOne(hit)
            else setQuery(code)
          }}
        />
      </div>

      {needle && !results.length && !chosen ? (
        <p className="text-sm text-muted-foreground">Nothing matches “{query}”.</p>
      ) : null}

      {chosen ? (
        <SizeChooser
          group={chosen}
          qty={qty}
          onQty={setQty}
          onBack={() => {
            setChosen(null)
            inputRef?.current?.focus()
          }}
          onConfirm={confirm}
          count={chosenCount}
          total={chosenTotal}
        />
      ) : results.length ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70"
        >
          {results.map((group, i) => (
            <li key={group.key} id={`${listId}-${i}`} role="option" aria-selected={i === at}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => choose(group)}
                // Hovering moves the highlight, so mouse and keyboard never
                // disagree about which row Enter would take.
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                  i === at ? "bg-secondary" : "hover:bg-secondary/60"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {group.product}
                    <span className="text-muted-foreground"> · </span>
                    {group.variant}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {isSingleUnit(group)
                      ? "Single unit"
                      : `${group.sizes.length} sizes · ${group.sizes
                          .map((s) => s.label)
                          .slice(0, 6)
                          .join(", ")}${group.sizes.length > 6 ? "…" : ""}`}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {fmtQty(String(group.available))} {group.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * The size run of one variant. Quantities default to nothing so the buyer
 * types only the sizes they actually want, and "All" fills every size with one
 * for the common case of a full run.
 */
function SizeChooser({
  group,
  qty,
  onQty,
  onBack,
  onConfirm,
  count,
  total,
}: {
  group: VariantGroup
  qty: Record<string, string>
  onQty: (next: Record<string, string>) => void
  onBack: () => void
  onConfirm: () => void
  count: number
  total: number
}) {
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
    firstRef.current?.select()
  }, [group.key])

  const set = (sizeId: string, value: string) => onQty({ ...qty, [sizeId]: value })
  const fillAll = () =>
    onQty(Object.fromEntries(group.sizes.map((s) => [s.sizeId, "1"])))

  return (
    <div
      className="rounded-lg border border-border/70 bg-secondary/30 p-3"
      onKeyDown={(e) => {
        // The chooser owns these: Enter adds the run, Escape goes back to the
        // search rather than closing the whole voucher.
        if (e.key === "Enter") {
          e.preventDefault()
          e.stopPropagation()
          onConfirm()
        }
        if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          onBack()
        }
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {group.product}
            <span className="text-muted-foreground"> · </span>
            {group.variant}
          </p>
          <p className="text-xs text-muted-foreground">
            How many of each size?
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={fillAll}>
            All
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onQty({})}>
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back to search"
            onClick={onBack}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
        {group.sizes.map((size, i) => {
          const value = qty[size.sizeId] ?? ""
          const on = Number(value) > 0
          return (
            <div
              key={size.sizeId}
              className={cn(
                "rounded-md border px-2 py-1.5 transition-colors",
                on ? "border-brand/40 bg-brand-soft/40" : "border-border/70 bg-background"
              )}
            >
              <label
                htmlFor={`size-${size.sizeId}`}
                className="block truncate text-xs font-medium"
                title={size.label}
              >
                {size.label}
              </label>
              <Input
                id={`size-${size.sizeId}`}
                ref={i === 0 ? firstRef : undefined}
                value={value}
                onChange={(e) => set(size.sizeId, e.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Quantity of ${size.label}`}
                className="mt-1 h-7 px-1.5 text-center font-mono"
              />
              <p className="mt-1 truncate text-center text-[10px] text-muted-foreground">
                {fmtQty(size.totals.available)} avail.
              </p>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {count
            ? `${count} size${count === 1 ? "" : "s"} · ${fmtQty(String(total))} ${group.unit}`
            : "Type a quantity against the sizes you want."}
        </p>
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          disabled={!count}
          onClick={onConfirm}
        >
          Add {count || ""} {count === 1 ? "line" : "lines"}
        </Button>
      </div>
    </div>
  )
}

/**
 * The line table shared by the purchase and order forms. Each row posts as
 * `items[i][size_id]` etc., which the server actions expand with `nest()`.
 *
 * Totals shown here are a preview only: vendor-service and
 * transaction-service recompute them from the lines, so what is stored can
 * never disagree with what was bought.
 */
export function LineItemsEditor({
  lines,
  priceField,
  priceLabel,
  currency = "INR",
  defaultPriceOf,
  searchRef,
  onCountChange,
}: {
  lines: Line[]
  priceField: "unit_price" | "rate"
  priceLabel: string
  currency?: string
  defaultPriceOf?: (line: Line) => string
  /** Lets a key binding put the caret in the product search. */
  searchRef?: React.RefObject<HTMLInputElement | null>
  onCountChange?: (count: number) => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const keySeq = useRef(0)
  const instance = useId()
  const [ladder, setLadder] = useState<LadderRow[]>([])
  const [rounding, setRounding] = useState<Rounding>("NONE")
  const [cgstRate, setCgstRate] = useState("")
  const [sgstRate, setSgstRate] = useState("")
  const [igstRate, setIgstRate] = useState("")

  const totals: PreviewTotals = previewTotals({
    lines: rows.map((r) => ({
      quantity: r.quantity,
      price: r.price,
      discountType: r.discountType,
      discount: r.discount,
    })),
    deductions: ladder,
    cgstRate,
    sgstRate,
    igstRate,
    rounding,
  })

  /**
   * Keys are minted here rather than inside the updater below. A `setState`
   * updater has to be pure — React may run it more than once — and a
   * module-level counter would also reset on a Fast Refresh while the rows on
   * screen still held the old numbers, handing out a duplicate. The `useId`
   * prefix keeps two editors on one page from colliding.
   */
  const nextKey = () => `${instance}-${(keySeq.current += 1)}`

  /** A whole size run lands in one update, so the list never half-renders. */
  const addLines = (picks: Pick[]) => {
    const fresh: Row[] = picks.map(({ line, quantity }) => ({
      key: nextKey(),
      line,
      quantity,
      price: defaultPriceOf?.(line) ?? line.sellPrice ?? "",
      discountType: "NONE" as DiscountType,
      discount: "",
    }))

    setRows((prev) => {
      const next = [...prev]
      for (const row of fresh) {
        // Adding the same unit twice adds to that row instead of making a
        // second one the server would treat as a separate line.
        const at = next.findIndex((r) => r.line?.sizeId === row.line?.sizeId)
        if (at >= 0) {
          next[at] = {
            ...next[at],
            quantity: String(
              (Number(next[at].quantity) || 0) + (Number(row.quantity) || 0)
            ),
          }
        } else {
          next.push(row)
        }
      }
      return next
    })
  }

  useEffect(() => {
    onCountChange?.(rows.length)
  }, [rows.length, onCountChange])

  const patch = (key: string, change: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)))

  const drop = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key))

  return (
    <div className="space-y-4">
      <LinePicker
        lines={lines}
        onPick={addLines}
        label="Search products, SKU or barcode"
        inputRef={searchRef}
      />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No lines yet. Search above, or scan a barcode.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={row.key}
              className="rounded-lg border border-border/70 bg-secondary/30 p-3"
            >
              {/* Hidden fields are what actually submits; the visible inputs
                  are uncontrolled-by-name so the row index stays stable. */}
              <input type="hidden" name={`items[${i}][size_id]`} value={row.line?.sizeId ?? ""} />
              <input type="hidden" name={`items[${i}][quantity]`} value={row.quantity} />
              <input type="hidden" name={`items[${i}][${priceField}]`} value={row.price} />
              <input type="hidden" name={`items[${i}][discount_type]`} value={row.discountType} />
              <input type="hidden" name={`items[${i}][discount]`} value={row.discount} />

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.line?.product}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.line?.variant}
                    {row.line && row.line.label !== "Default" ? ` · ${row.line.label}` : ""}
                    {row.line?.sku ? ` · ${row.line.sku}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line"
                  onClick={() => drop(row.key)}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(e) => patch(row.key, { quantity: e.target.value })}
                    aria-label="Quantity"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{priceLabel}</Label>
                  <Input
                    inputMode="decimal"
                    value={row.price}
                    onChange={(e) => patch(row.key, { price: e.target.value })}
                    aria-label={priceLabel}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Discount</Label>
                  <SelectField
                    options={DISCOUNT_OPTIONS}
                    value={row.discountType}
                    onValueChange={(v) => patch(row.key, { discountType: v as DiscountType })}
                    aria-label="Discount type"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Value</Label>
                  <Input
                    inputMode="decimal"
                    value={row.discount}
                    onChange={(e) => patch(row.key, { discount: e.target.value })}
                    disabled={row.discountType === "NONE"}
                    aria-label="Discount value"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Line total</Label>
                  <p className="pt-2 font-mono text-sm tabular">
                    {fmtAmount(totals.lineTotals[i] ?? 0, currency)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bill level ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 rounded-lg border border-border/70 p-4">
        <div className="space-y-2">
          <Label className="text-xs">Deductions</Label>
          <p className="text-xs text-muted-foreground">
            Applied top to bottom; each takes its cut of what the one above
            left.
          </p>
          <DeductionLadder
            rows={ladder}
            onChange={setLadder}
            amounts={totals.deductionAmounts}
            currency={currency}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Round the total</Label>
            <SelectField
              name="rounding"
              options={[
                { value: "NONE", label: "No rounding" },
                { value: "NORMAL", label: "Nearest rupee" },
                { value: "UP", label: "Always up" },
                { value: "DOWN", label: "Always down" },
              ]}
              value={rounding}
              onValueChange={(v) => setRounding(v as Rounding)}
              aria-label="Rounding"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["cgst_rate", "CGST %", cgstRate, setCgstRate],
                ["sgst_rate", "SGST %", sgstRate, setSgstRate],
                ["igst_rate", "IGST %", igstRate, setIgstRate],
              ] as const
            ).map(([name, label, value, set]) => (
              <div key={name} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  name={name}
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="0"
                  aria-label={label}
                />
              </div>
            ))}
          </div>
        </div>

        <dl className="space-y-1.5 text-sm">
          <Figure label="Subtotal" value={fmtAmount(totals.subtotal, currency)} />
          {ladder.map((row, i) =>
            totals.deductionAmounts[i] ? (
              <Figure
                key={row.key}
                label={row.label || "Deduction"}
                value={`− ${fmtAmount(totals.deductionAmounts[i], currency)}`}
              />
            ) : null
          )}
          <Figure label="Taxable" value={fmtAmount(totals.taxable, currency)} />
          {totals.cgst ? <Figure label="CGST" value={fmtAmount(totals.cgst, currency)} /> : null}
          {totals.sgst ? <Figure label="SGST" value={fmtAmount(totals.sgst, currency)} /> : null}
          {totals.igst ? <Figure label="IGST" value={fmtAmount(totals.igst, currency)} /> : null}
          {totals.roundOff ? (
            <Figure label="Round off" value={fmtAmount(totals.roundOff, currency)} />
          ) : null}
          <div className="mt-2 border-t border-border/70 pt-2">
            <Figure label="Total" value={fmtAmount(totals.total, currency)} strong />
          </div>
        </dl>
        </div>
      </div>
    </div>
  )
}

function Figure({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>
        {label}
      </dt>
      <dd className={cn("font-mono tabular", strong && "text-base font-medium")}>{value}</dd>
    </div>
  )
}
