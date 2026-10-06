"use client"

import { useState } from "react"
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { schemaToFields } from "@/lib/inventory/schema-builder"
import type { VariantType } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BarcodeInput } from "./scanner/barcode-input"
import { SchemaFields } from "./schema-fields"
import { SelectField } from "./select-field"

/** Splits "S, M, L" (or one per line) into trimmed, de-duplicated labels. */
export const parseSizes = (text: string) => {
  const out: string[] = []
  for (const raw of text.split(/[,\n]/)) {
    const t = raw.trim()
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

function SizeRow({
  prefix,
  i,
  label,
  disabled,
  onRemove,
}: {
  prefix: string
  i: number
  label: string
  disabled?: boolean
  onRemove?: () => void
}) {
  return (
    <div className="grid grid-cols-[minmax(4rem,0.8fr)_1fr_1fr_1fr_1fr_auto] items-center gap-2 px-3 py-1.5">
      <span className="truncate text-sm font-medium">{label}</span>
      <input type="hidden" name={`${prefix}[sizes][${i}][label]`} value={label} />
      <Input name={`${prefix}[sizes][${i}][cost_price]`} placeholder="—" inputMode="decimal" disabled={disabled} aria-label={`${label} cost price`} className="h-8" />
      <Input name={`${prefix}[sizes][${i}][sell_price]`} placeholder="—" inputMode="decimal" disabled={disabled} aria-label={`${label} sell price`} className="h-8" />
      <Input name={`${prefix}[sizes][${i}][sku]`} placeholder="Optional" maxLength={128} disabled={disabled} aria-label={`${label} SKU`} className="h-8" />
      <BarcodeInput name={`${prefix}[sizes][${i}][barcode]`} placeholder="Scan…" disabled={disabled} aria-label={`${label} barcode`} inputClassName="h-8" />
      {onRemove ? (
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} disabled={disabled} onClick={onRemove}>
          <Trash2Icon className="size-4" />
        </Button>
      ) : (
        <span className="w-8" />
      )}
    </div>
  )
}

/**
 * One variant as the user builds it: name, its variant type, the type's
 * fields, and the sizes it comes in — each size with its own cost and sell
 * price. Posts everything under `prefix` (`variants[0]`, `variant`) so the
 * same server-side reader handles new products and added variants.
 */
export function VariantForm({
  prefix,
  variantTypes,
  disabled,
  title,
  onRemove,
}: {
  prefix: string
  variantTypes: VariantType[]
  disabled?: boolean
  title?: string
  onRemove?: () => void
}) {
  const [typeId, setTypeId] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [free, setFree] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const type = variantTypes.find((t) => t.id === typeId)
  // The axis field's values become the size rows, so it is not an input here.
  const fields = schemaToFields(type?.attribute_schema).filter((f) => f.key !== type?.axis_key)
  const axis = type?.axis_label ?? null
  const strict = !!axis && !type?.axis_free
  const single = !!type && !axis
  const uid = prefix.replace(/[^a-z0-9]/gi, "-")

  const toggle = (s: string) =>
    setSelected((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : type!.axis_values.filter((o) => o === s || cur.includes(o))))
  const addFree = () => {
    const labels = parseSizes(draft).filter((l) => !free.includes(l))
    if (labels.length) setFree((f) => [...f, ...labels])
    setDraft("")
  }

  const rows = single ? ["Default"] : strict ? selected : free
  const header = (
    <div className="grid grid-cols-[minmax(4rem,0.8fr)_1fr_1fr_1fr_1fr_auto] items-center gap-2 border-b border-border/70 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
      <span>{axis ?? (single ? "Unit" : "Option")}</span>
      <span>Cost price</span>
      <span>Sell price</span>
      <span>SKU</span>
      <span>Barcode</span>
      <span className="w-8" />
    </div>
  )

  return (
    <div className="grid gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3">
      {title || onRemove ? (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {onRemove ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove variant" disabled={disabled} onClick={onRemove}>
              <Trash2Icon className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-name`} className="text-xs text-muted-foreground">Variant name</Label>
          <Input id={`${uid}-name`} name={`${prefix}[name]`} placeholder="" maxLength={200} required disabled={disabled} className="h-8" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-type`} className="text-xs text-muted-foreground">Variant type</Label>
          <SelectField
            id={`${uid}-type`}
            name={`${prefix}[variant_type_id]`}
            value={typeId}
            onValueChange={(v) => {
              setTypeId(v)
              setSelected([])
              setFree([])
            }}
            disabled={disabled}
            options={[{ value: "", label: "Untyped" }, ...variantTypes.map((t) => ({ value: t.id, label: t.name }))]}
          />
        </div>
      </div>

      {fields.length ? (
        <SchemaFields key={typeId} name={`${prefix}[vattr]`} schema={type?.attribute_schema} omit={type?.axis_key ? [type.axis_key] : undefined} disabled={disabled} compact allowExtra={false} />
      ) : null}

      <div className="grid gap-2">
        {strict && type ? (
          <>
            <p className="text-xs text-muted-foreground">
              {axis} values this variant comes in — each has its own price. Leave a price empty to fill it in later.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {type.axis_values.map((s) => {
                const on = selected.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    aria-pressed={on}
                    onClick={() => toggle(s)}
                    className={
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors " +
                      (on ? "border-brand bg-brand-soft text-brand" : "border-border/70 bg-card hover:border-brand hover:text-brand")
                    }
                  >
                    {on ? <CheckIcon className="size-3" /> : <PlusIcon className="size-3" />}
                    {s}
                  </button>
                )
              })}
              <button
                type="button"
                disabled={disabled}
                onClick={() => setSelected(selected.length === type.axis_values.length ? [] : type.axis_values)}
                className="ml-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                {selected.length === type.axis_values.length ? "None" : "All"}
              </button>
            </div>
          </>
        ) : single ? (
          <p className="text-xs text-muted-foreground">Single unit — one stock line with its own price.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {axis
                ? `${axis} values this variant comes in — each has its own price and stock.`
                : "Options this variant comes in (sizes, capacities…), each priced and stocked on its own — or leave empty for a single unit."}
            </p>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addFree()
                  }
                }}
                placeholder={axis ? `Add ${axis.toLowerCase()} values — e.g. 250 ml, 500 ml` : "Add options — e.g. S, M, L"}
                disabled={disabled}
                aria-label={axis ? `Add ${axis.toLowerCase()} values` : "Add options"}
                className="h-8"
              />
              <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={disabled || !draft.trim()} onClick={addFree}>
                <PlusIcon className="size-3.5" /> Add
              </Button>
            </div>
          </>
        )}

        {rows.length ? (
          <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
            {header}
            <div className="divide-y divide-border/70">
              {rows.map((label, i) => (
                <SizeRow
                  key={label}
                  prefix={prefix}
                  i={i}
                  label={label}
                  disabled={disabled}
                  onRemove={!strict && !single ? () => setFree((f) => f.filter((x) => x !== label)) : undefined}
                />
              ))}
            </div>
          </div>
        ) : axis ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            {strict ? `Pick at least one ${axis.toLowerCase()}.` : `Add at least one ${axis.toLowerCase()} value.`}
          </p>
        ) : null}
      </div>
    </div>
  )
}
