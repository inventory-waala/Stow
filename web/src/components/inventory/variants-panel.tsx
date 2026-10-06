"use client"

import { useActionState, useState } from "react"
import { PlusIcon, ScanBarcodeIcon, Trash2Icon, XIcon } from "lucide-react"

import {
  addBarcodeAction,
  addSizeAction,
  createVariantAction,
  deleteBarcodeAction,
  deleteSizeAction,
  deleteVariantAction,
} from "@/lib/inventory/actions"
import type { Location, Product, Size, Variant, VariantType } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MoveStockSheet } from "./move-stock-sheet"
import { EmptyRow, FormAlert, OptionsText, fmtMoney, fmtQty } from "./primitives"
import { BarcodeInput } from "./scanner/barcode-input"
import { SelectField } from "./select-field"
import { VariantForm } from "./variant-form"

function DeleteButton({
  label,
  confirmText,
  disabled,
  disabledHint,
  action,
}: {
  label: string
  confirmText: string
  disabled: boolean
  disabledHint: string
  action: () => Promise<{ error?: string } | undefined>
}) {
  const [state, run, pending] = useActionState(async () => action(), undefined)
  return (
    <form action={run} className="inline">
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        title={state?.error ?? (disabled ? disabledHint : label)}
        disabled={disabled || pending}
        className="text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          if (!confirm(confirmText)) e.preventDefault()
        }}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </form>
  )
}

/** Adds one size to an existing variant: from the type's list, or free text when untyped. */
function AddSizeForm({ productId, variant }: { productId: string; variant: Variant }) {
  const [state, action, pending] = useActionState(addSizeAction.bind(null, productId, variant.id), undefined)
  const type = variant.variant_type
  const used = new Set(variant.sizes.map((s) => s.label))
  const remaining = (type?.axis_values ?? []).filter((v) => !used.has(v))
  const strict = !!type?.axis_label && !type.axis_free
  const what = type?.axis_label?.toLowerCase() ?? "option"
  if (type && !type.axis_label) return null
  if (strict && !remaining.length) {
    return <p className="px-5 py-2 text-xs text-muted-foreground">All {what} values of this type are in use.</p>
  }
  return (
    <form action={action} className="grid gap-2 border-t border-border/70 bg-secondary/20 px-5 py-3">
      <FormAlert state={state} />
      <div className="grid gap-2 sm:grid-cols-[minmax(8rem,1fr)_1fr_1fr_1fr_1fr_auto]">
        {strict ? (
          <SelectField name="label" options={remaining.map((v) => ({ value: v, label: v }))} placeholder={`Add ${what}`} disabled={pending} aria-label={type!.axis_label!} />
        ) : (
          <Input name="label" placeholder={type ? `${type.axis_label}, e.g. 500 ml` : "Option, e.g. M"} maxLength={64} required disabled={pending} aria-label={type?.axis_label ?? "Option"} className="h-8" />
        )}
        <Input name="cost_price" placeholder="Cost price" inputMode="decimal" disabled={pending} aria-label="Cost price" className="h-8" />
        <Input name="sell_price" placeholder="Sell price" inputMode="decimal" disabled={pending} aria-label="Sell price" className="h-8" />
        <Input name="sku" placeholder="SKU" maxLength={128} disabled={pending} aria-label="SKU" className="h-8" />
        <BarcodeInput name="barcode" placeholder="Barcode (scan)" disabled={pending} aria-label="Barcode" inputClassName="h-8" />
        <Button type="submit" variant="outline" size="sm" disabled={pending} className="rounded-full">
          <PlusIcon className="size-4" />
          {pending ? "Adding..." : "Add"}
        </Button>
      </div>
    </form>
  )
}

/**
 * The barcode of one stock line: shows it with a remove cross, or a small
 * "Assign" that reveals an input a scanner can type into (Enter submits).
 */
function BarcodeCell({ productId, size }: { productId: string; size: Size }) {
  const [open, setOpen] = useState(false)
  const [state, add, adding] = useActionState(addBarcodeAction.bind(null, productId, size.id), undefined)
  const primary = size.barcodes.find((b) => b.is_primary) ?? size.barcodes[0]
  const [, remove, removing] = useActionState(async () => (primary ? deleteBarcodeAction(productId, primary.id) : undefined), undefined)

  if (primary) {
    return (
      <form action={remove} className="inline-flex items-center gap-1 font-mono text-xs">
        <span>{primary.value}</span>
        {size.barcodes.length > 1 ? <span className="text-muted-foreground">+{size.barcodes.length - 1}</span> : null}
        <button
          type="submit"
          disabled={removing}
          aria-label={`Remove barcode ${primary.value}`}
          title="Remove barcode"
          className="rounded text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            if (!confirm(`Remove barcode ${primary.value}?`)) e.preventDefault()
          }}
        >
          <XIcon className="size-3" />
        </button>
      </form>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        <ScanBarcodeIcon className="size-3.5" /> Assign
      </button>
    )
  }
  return (
    <form action={add} className="grid gap-1">
      <div className="flex items-center gap-1">
        <BarcodeInput name="value" autoFocus required disabled={adding} aria-label={`Barcode for ${size.label}`} inputClassName="h-7 w-36" size="icon-sm" submitOnScan />
        <Button type="submit" size="sm" variant="outline" disabled={adding} className="h-7 rounded-full px-2 text-xs">
          {adding ? "…" : "Save"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel" className="text-muted-foreground hover:text-foreground">
          <XIcon className="size-3.5" />
        </button>
      </div>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  )
}

function SizesTable({ productId, variant, locations }: { productId: string; variant: Variant; locations: Location[] }) {
  const axis = variant.variant_type?.axis_label
  const single = !!variant.variant_type && !axis
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">{axis ?? (single ? "Unit" : "Option")}</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Barcode</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Sell</TableHead>
            <TableHead className="text-right">On hand</TableHead>
            <TableHead className="text-right">Reserved</TableHead>
            <TableHead>By location</TableHead>
            <TableHead className="pr-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variant.sizes.map((s: Size) => (
            <TableRow key={s.id} className="border-border/70 align-top">
              <TableCell className="pl-5 font-medium">{s.label}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{s.sku ?? "—"}</TableCell>
              <TableCell>
                <BarcodeCell productId={productId} size={s} />
              </TableCell>
              <TableCell className="text-right tabular">{fmtMoney(s.cost_price, s.currency)}</TableCell>
              <TableCell className="text-right tabular">{fmtMoney(s.sell_price, s.currency)}</TableCell>
              <TableCell className="text-right font-medium tabular">{fmtQty(s.stock_totals.quantity)}</TableCell>
              <TableCell className="text-right tabular text-muted-foreground">{fmtQty(s.stock_totals.reserved)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {s.stock.filter((l) => Number(l.quantity) !== 0 || Number(l.reserved) !== 0).map((l) => (
                  <div key={l.id} className="whitespace-nowrap">{l.location.code}: <span className="tabular text-foreground">{fmtQty(l.quantity)}</span></div>
                ))}
              </TableCell>
              <TableCell className="pr-5 text-right">
                <div className="inline-flex items-center gap-1">
                  <MoveStockSheet productId={productId} variantName={variant.name} size={s} locations={locations} />
                  {!single ? (
                    <DeleteButton
                      label={`Remove ${s.label}`}
                      confirmText={`Remove ${s.label} from ${variant.name}? Its stock history is kept.`}
                      disabled={variant.sizes.length <= 1}
                      disabledHint="A variant keeps at least one line"
                      action={() => deleteSizeAction(productId, s.id)}
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function AddVariantForm({ productId, variantTypes }: { productId: string; variantTypes: VariantType[] }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createVariantAction.bind(null, productId), undefined)
  if (!open) {
    return (
      <div className="border-t border-border/70 p-5">
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" /> Add a variant
        </Button>
      </div>
    )
  }
  return (
    <form action={action} className="grid gap-3 border-t border-border/70 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Add a variant</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          Cancel
        </button>
      </div>
      <FormAlert state={state} />
      <VariantForm prefix="variant" variantTypes={variantTypes} disabled={pending} />
      <div>
        <Button type="submit" size="sm" disabled={pending} className="rounded-full px-5">
          {pending ? "Adding..." : "Add variant"}
        </Button>
      </div>
    </form>
  )
}

export function VariantsPanel({
  product,
  variantTypes,
  locations,
}: {
  product: Product
  variantTypes: VariantType[]
  locations: Location[]
}) {
  return (
    <>
      {product.variants.length ? (
        <div className="grid divide-y divide-border/70 border-t border-border/70">
          {product.variants.map((v) => {
            const attrs = Object.entries(v.attributes ?? {})
            return (
              <section key={v.id} className="grid">
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {v.name}
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {v.variant_type?.name ?? "Untyped"}
                      </span>
                    </p>
                    {attrs.length ? (
                      <p className="text-xs text-muted-foreground">
                        <OptionsText options={v.attributes} />
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <span className="tabular text-foreground">{fmtQty(v.stock_totals.quantity)}</span> on hand ·{" "}
                      <span className="tabular text-foreground">{fmtQty(v.stock_totals.available)}</span> available
                    </span>
                    <DeleteButton
                      label={`Remove ${v.name}`}
                      confirmText={`Remove variant ${v.name} and its sizes? Stock history is kept.`}
                      disabled={product.variants.length <= 1}
                      disabledHint="A product keeps at least one variant"
                      action={() => deleteVariantAction(product.id, v.id)}
                    />
                  </div>
                </div>
                <SizesTable productId={product.id} variant={v} locations={locations} />
                <AddSizeForm productId={product.id} variant={v} />
              </section>
            )
          })}
        </div>
      ) : (
        <EmptyRow>No variants.</EmptyRow>
      )}
      <AddVariantForm productId={product.id} variantTypes={variantTypes} />
    </>
  )
}
