"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { CheckCircle2Icon, PlusIcon } from "lucide-react"

import { createPurchase, type ActionState } from "@/lib/purchases/actions"
import type { Supplier } from "@/lib/purchases/types"
import type { Location, ProductListItem } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { FormAlert } from "@/components/inventory/primitives"
import { SelectField } from "@/components/inventory/select-field"
import { flattenLines } from "@/components/inventory/quick-stock-sheet"
import { LineItemsEditor } from "@/components/commerce/line-items"

function CreatedNotice({ state, onDismiss }: { state: ActionState; onDismiss: () => void }) {
  if (!state?.success || !state.id) return null
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand-soft p-3 text-sm text-brand"
    >
      <span className="inline-flex items-center gap-2">
        <CheckCircle2Icon className="size-4" />
        {state.success}. Raise another below, or
        <Link
          href={`/purchases/${state.id}`}
          className="font-medium underline underline-offset-4"
        >
          open it to receive
        </Link>
        .
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-xs underline-offset-4 hover:underline"
      >
        Dismiss
      </button>
    </div>
  )
}

/**
 * Raises a purchase order. Creating it never moves stock — that happens on the
 * detail page when the goods actually arrive — so this form is safe to submit
 * as soon as the supplier invoice is in hand.
 *
 * Like the new-product sheet, it stays open after a successful save so several
 * invoices can be entered in a row.
 */
export function NewPurchaseSheet({
  suppliers,
  products,
  locations,
}: {
  suppliers: Supplier[]
  products: ProductListItem[]
  locations: Location[]
}) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const [state, action, pending] = useActionState(createPurchase, undefined)
  const [dismissed, setDismissed] = useState(false)

  const lines = flattenLines(products)
  const supplierOptions = suppliers
    .filter((s) => s.status === "ACTIVE")
    .map((s) => ({ value: s.id, label: s.code ? `${s.name} (${s.code})` : s.name }))
  const locationOptions = [
    { value: "", label: "Default location" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ]

  const created = state?.success && state.id && !dismissed ? state : undefined

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setSession((n) => n + 1)
          setDismissed(false)
        }
        setOpen(o)
      }}
    >
      <SheetTrigger
        render={
          <Button className="rounded-full px-4" disabled={!supplierOptions.length}>
            <PlusIcon className="size-4" />
            New purchase
          </Button>
        }
      />
      {/* The primitive's data-[side=right]:sm:max-w-sm outranks a plain
          max-w utility, hence the `!`. Line items need the room, so this
          takes 40% of a wide screen and never drops below 32rem. */}
      <SheetContent className="w-full overflow-y-auto sm:max-w-[max(32rem,40vw)]!">
        <SheetHeader>
          <SheetTitle>New purchase order</SheetTitle>
          <SheetDescription>
            Record what you bought. Stock only moves when you receive it.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <CreatedNotice state={created} onDismiss={() => setDismissed(true)} />
        </div>

        <form key={session} action={action} className="space-y-5 px-4 pb-4">
          {state?.error ? <FormAlert state={state} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier_id">Supplier</Label>
              <SelectField
                id="supplier_id"
                name="supplier_id"
                options={supplierOptions}
                placeholder="Choose a supplier"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice_no">Supplier invoice no.</Label>
              <Input
                id="invoice_no"
                name="invoice_no"
                placeholder="Auto-generated if blank"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order_date">Invoice date</Label>
              <Input
                id="order_date"
                name="order_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location_id">Receive into</Label>
              <SelectField
                id="location_id"
                name="location_id"
                options={locationOptions}
                defaultValue=""
              />
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Lines</h4>
            <LineItemsEditor
              lines={lines}
              priceField="unit_price"
              priceLabel="Unit price"
              defaultPriceOf={() => ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending} className="rounded-full">
              {pending ? "Saving…" : "Save purchase order"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
