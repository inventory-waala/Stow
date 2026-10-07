"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { CheckCircle2Icon, PlusIcon } from "lucide-react"

import { createOrder, type ActionState } from "@/lib/orders/actions"
import type { Customer } from "@/lib/orders/types"
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
        <Link href={`/orders/${state.id}`} className="font-medium underline underline-offset-4">
          open it to confirm
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
 * Raises a sales order. Creating one never touches stock: confirming reserves
 * it and fulfilling ships it, both from the detail page. A line left without a
 * rate takes the catalog sell price at the moment the order is written.
 */
export function NewOrderSheet({
  customers,
  products,
  locations,
}: {
  customers: Customer[]
  products: ProductListItem[]
  locations: Location[]
}) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const [state, action, pending] = useActionState(createOrder, undefined)
  const [dismissed, setDismissed] = useState(false)

  const lines = flattenLines(products)
  const customerOptions = customers
    .filter((c) => c.status === "ACTIVE")
    .map((c) => ({ value: c.id, label: c.code ? `${c.name} (${c.code})` : c.name }))
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
          <Button className="rounded-full px-4" disabled={!customerOptions.length}>
            <PlusIcon className="size-4" />
            New order
          </Button>
        }
      />
      <SheetContent className="w-full overflow-y-auto sm:max-w-[max(32rem,40vw)]!">
        <SheetHeader>
          <SheetTitle>New order</SheetTitle>
          <SheetDescription>
            Build the invoice. Stock is only held when you confirm it.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <CreatedNotice state={created} onDismiss={() => setDismissed(true)} />
        </div>

        <form key={session} action={action} className="space-y-5 px-4 pb-4">
          {state?.error ? <FormAlert state={state} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="customer_id">Customer</Label>
              <SelectField
                id="customer_id"
                name="customer_id"
                options={customerOptions}
                placeholder="Choose a customer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice_no">Invoice no.</Label>
              <Input id="invoice_no" name="invoice_no" placeholder="Auto-generated if blank" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order_date">Order date</Label>
              <Input
                id="order_date"
                name="order_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location_id">Ship from</Label>
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
              priceField="rate"
              priceLabel="Rate"
              withSpecialDiscount
            />
            <p className="text-xs text-muted-foreground">
              Leave a rate blank to use the catalog sell price.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending} className="rounded-full">
              {pending ? "Saving…" : "Save order"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
