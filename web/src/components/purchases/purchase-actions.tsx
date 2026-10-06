"use client"

import { useActionState } from "react"
import { PackageCheckIcon } from "lucide-react"

import {
  receivePurchase,
  setPurchaseStatus,
  type ActionState,
} from "@/lib/purchases/actions"
import { RECEIVABLE, SETTABLE_STATUSES, type PurchaseOrder } from "@/lib/purchases/types"
import type { Location } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FormAlert } from "@/components/inventory/primitives"
import { SelectField } from "@/components/inventory/select-field"

/**
 * Receiving is the only action that writes to inventory, so it is deliberately
 * a separate confirmed step rather than one of the status buttons. The button
 * disappears once stock has been posted — vendor-service would refuse a second
 * attempt anyway, but there is no reason to offer it.
 */
export function ReceiveBox({
  purchase,
  locations,
}: {
  purchase: PurchaseOrder
  locations: Location[]
}) {
  const [state, action, pending] = useActionState(receivePurchase, undefined)

  if (purchase.stock_posted_at) {
    return (
      <p className="text-sm text-muted-foreground">
        Received into stock on{" "}
        {new Date(purchase.stock_posted_at).toLocaleString()}. The stock movements
        are on the inventory activity log, tagged to this order.
      </p>
    )
  }

  if (!RECEIVABLE.includes(purchase.status)) {
    return (
      <p className="text-sm text-muted-foreground">
        A {purchase.status.toLowerCase()} order cannot be received.
      </p>
    )
  }

  const options = [
    { value: "", label: "Default location" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ]

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={purchase.id} />
      <FormAlert state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="receive_location">Receive into</Label>
        <SelectField
          id="receive_location"
          name="location_id"
          options={options}
          defaultValue={purchase.location_id ?? ""}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full rounded-full">
        <PackageCheckIcon className="size-4" />
        {pending
          ? "Receiving…"
          : `Receive ${purchase.items.length} line${purchase.items.length === 1 ? "" : "s"} into stock`}
      </Button>
      <p className="text-xs text-muted-foreground">
        Adds the ordered quantities to inventory as IN movements against this
        invoice. This can only be done once.
      </p>
    </form>
  )
}

/** The non-stock status moves: pending, ordered, approved, cancelled. */
export function StatusActions({ purchase }: { purchase: PurchaseOrder }) {
  const [state, action, pending] = useActionState(setPurchaseStatus, undefined)
  const next = SETTABLE_STATUSES[purchase.status]

  if (!next.length) {
    return (
      <p className="text-sm text-muted-foreground">
        This order is {purchase.status.toLowerCase()} and cannot change status.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={purchase.id} />
      <FormAlert state={state} />
      <div className="flex flex-wrap gap-2">
        {next.map((status) => (
          <Button
            key={status}
            type="submit"
            name="status"
            value={status}
            variant="outline"
            size="sm"
            disabled={pending}
            className="rounded-full"
          >
            Mark {status.toLowerCase()}
          </Button>
        ))}
      </div>
    </form>
  )
}
