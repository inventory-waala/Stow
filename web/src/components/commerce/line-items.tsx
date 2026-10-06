"use client"

import { useMemo, useState } from "react"
import { PlusIcon, SearchIcon, XIcon } from "lucide-react"

import type { Line } from "@/components/inventory/quick-stock-sheet"
import {
  fmtAmount,
  previewTotals,
  type DiscountType,
  type PreviewTotals,
} from "@/lib/commerce/totals"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectField } from "@/components/inventory/select-field"
import { ScanButton } from "@/components/inventory/scanner/scan-button"
import { fmtQty } from "@/components/inventory/primitives"

export interface Row {
  key: number
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

let nextKey = 1
const blankRow = (): Row => ({
  key: nextKey++,
  line: null,
  quantity: "1",
  price: "",
  discountType: "NONE",
  discount: "",
})

/** Search-and-pick over every stock unit in the catalog, including by barcode. */
function LinePicker({
  lines,
  onPick,
  label,
}: {
  lines: Line[]
  onPick: (line: Line) => void
  label: string
}) {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const results = useMemo(
    () => (needle ? lines.filter((l) => l.text.includes(needle)).slice(0, 8) : []),
    [lines, needle]
  )

  const pick = (line: Line) => {
    onPick(line)
    setQuery("")
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={label}
            className="pl-9"
            aria-label={label}
          />
        </div>
        <ScanButton
          title="Scan to add a line"
          hint="Scan or type a barcode"
          onScan={(code) => {
            const hit = lines.find((l) => l.barcodes.includes(code.trim()))
            if (hit) pick(hit)
            else setQuery(code)
          }}
        />
      </div>

      {needle && !results.length ? (
        <p className="text-sm text-muted-foreground">Nothing matches “{query}”.</p>
      ) : null}

      {results.length ? (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70">
          {results.map((line) => (
            <li key={line.sizeId}>
              <button
                type="button"
                onClick={() => pick(line)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/60"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{line.product}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {line.variant}
                    {line.label !== "Default" ? ` · ${line.label}` : ""}
                    {line.sku ? ` · ${line.sku}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {fmtQty(line.totals.available)} {line.unit}
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
  withSpecialDiscount = false,
  defaultPriceOf,
}: {
  lines: Line[]
  priceField: "unit_price" | "rate"
  priceLabel: string
  currency?: string
  /** Sales orders carry a second discount settled at review time. */
  withSpecialDiscount?: boolean
  defaultPriceOf?: (line: Line) => string
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [discountType, setDiscountType] = useState<DiscountType>("NONE")
  const [discount, setDiscount] = useState("")
  const [specialDiscountType, setSpecialDiscountType] = useState<DiscountType>("NONE")
  const [specialDiscount, setSpecialDiscount] = useState("")
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
    discountType,
    discount,
    specialDiscountType: withSpecialDiscount ? specialDiscountType : "NONE",
    specialDiscount: withSpecialDiscount ? specialDiscount : "0",
    cgstRate,
    sgstRate,
    igstRate,
  })

  const addLine = (line: Line) =>
    setRows((prev) => {
      // Adding the same unit twice bumps the quantity instead of making a
      // second row the server would treat as a separate line.
      const at = prev.findIndex((r) => r.line?.sizeId === line.sizeId)
      if (at >= 0) {
        const next = [...prev]
        next[at] = {
          ...next[at],
          quantity: String((Number(next[at].quantity) || 0) + 1),
        }
        return next
      }
      return [
        ...prev,
        {
          ...blankRow(),
          line,
          price: defaultPriceOf?.(line) ?? line.sellPrice ?? "",
        },
      ]
    })

  const patch = (key: number, change: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)))

  const drop = (key: number) => setRows((prev) => prev.filter((r) => r.key !== key))

  return (
    <div className="space-y-4">
      <LinePicker lines={lines} onPick={addLine} label="Search products, SKU or barcode" />

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
      <div className="grid gap-4 rounded-lg border border-border/70 p-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Bill discount</Label>
            <div className="flex gap-2">
              <SelectField
                name="discount_type"
                options={DISCOUNT_OPTIONS}
                value={discountType}
                onValueChange={(v) => setDiscountType(v as DiscountType)}
                aria-label="Bill discount type"
                className="w-36"
              />
              <Input
                name="discount"
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                disabled={discountType === "NONE"}
                placeholder="0"
                aria-label="Bill discount value"
              />
            </div>
          </div>

          {withSpecialDiscount ? (
            <div className="space-y-1">
              <Label className="text-xs">Special discount</Label>
              <div className="flex gap-2">
                <SelectField
                  name="special_discount_type"
                  options={DISCOUNT_OPTIONS}
                  value={specialDiscountType}
                  onValueChange={(v) => setSpecialDiscountType(v as DiscountType)}
                  aria-label="Special discount type"
                  className="w-36"
                />
                <Input
                  name="special_discount"
                  inputMode="decimal"
                  value={specialDiscount}
                  onChange={(e) => setSpecialDiscount(e.target.value)}
                  disabled={specialDiscountType === "NONE"}
                  placeholder="0"
                  aria-label="Special discount value"
                />
              </div>
            </div>
          ) : null}

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
          {totals.discount ? (
            <Figure label="Bill discount" value={`− ${fmtAmount(totals.discount, currency)}`} />
          ) : null}
          {withSpecialDiscount && totals.specialDiscount ? (
            <Figure
              label="Special discount"
              value={`− ${fmtAmount(totals.specialDiscount, currency)}`}
            />
          ) : null}
          <Figure label="Taxable" value={fmtAmount(totals.taxable, currency)} />
          {totals.cgst ? <Figure label="CGST" value={fmtAmount(totals.cgst, currency)} /> : null}
          {totals.sgst ? <Figure label="SGST" value={fmtAmount(totals.sgst, currency)} /> : null}
          {totals.igst ? <Figure label="IGST" value={fmtAmount(totals.igst, currency)} /> : null}
          <div className="mt-2 border-t border-border/70 pt-2">
            <Figure label="Total" value={fmtAmount(totals.total, currency)} strong />
          </div>
        </dl>
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
