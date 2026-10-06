"use client"

import { useActionState } from "react"
import { BanIcon, LockIcon, TruckIcon } from "lucide-react"

import {
  cancelOrder,
  confirmOrder,
  fulfilOrder,
  setOrderStatus,
} from "@/lib/orders/actions"
import {
  CANCELLABLE,
  CONFIRMABLE,
  FULFILLABLE,
  SETTABLE_STATUSES,
  type Order,
} from "@/lib/orders/types"
import type { Location } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FormAlert } from "@/components/inventory/primitives"
import { SelectField } from "@/components/inventory/select-field"

/**
 * The stock lifecycle, laid out in the order it happens: confirm holds the
 * goods, fulfil ships them, cancel gives a held quantity back. Each is its own
 * form so a failure in one does not clear the others.
 */
export function StockActions({
  order,
  locations,
}: {
  order: Order
  locations: Location[]
}) {
  const [confirmState, confirm, confirming] = useActionState(confirmOrder, undefined)
  const [fulfilState, fulfil, fulfilling] = useActionState(fulfilOrder, undefined)
  const [cancelState, cancel, cancelling] = useActionState(cancelOrder, undefined)

  if (order.stock_posted_at) {
    return (
      <p className="text-sm text-muted-foreground">
        Shipped on {new Date(order.stock_posted_at).toLocaleString()}. The stock
        movements are on the inventory activity log, tagged to this order.
      </p>
    )
  }

  const locationOptions = [
    { value: "", label: "Default location" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ]

  return (
    <div className="space-y-4">
      <FormAlert state={confirmState ?? fulfilState ?? cancelState} />

      {CONFIRMABLE.includes(order.status) ? (
        <form action={confirm} className="space-y-2">
          <input type="hidden" name="id" value={order.id} />
          <Button
            type="submit"
            variant="outline"
            disabled={confirming}
            className="w-full rounded-full"
          >
            <LockIcon className="size-4" />
            {confirming ? "Reserving…" : "Confirm and reserve stock"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Holds the quantities so nothing else can sell them. Fails if stock is
            short.
          </p>
        </form>
      ) : null}

      {order.reserved_at ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          Stock reserved {new Date(order.reserved_at).toLocaleString()}. The lines
          cannot be edited while it is held.
        </p>
      ) : null}

      {FULFILLABLE.includes(order.status) ? (
        <form action={fulfil} className="space-y-2">
          <input type="hidden" name="id" value={order.id} />
          <div className="space-y-1.5">
            <Label htmlFor="fulfil_location">Ship from</Label>
            <SelectField
              id="fulfil_location"
              name="location_id"
              options={locationOptions}
              defaultValue={order.location_id ?? ""}
            />
          </div>
          <Button type="submit" disabled={fulfilling} className="w-full rounded-full">
            <TruckIcon className="size-4" />
            {fulfilling
              ? "Shipping…"
              : `Ship ${order.items.length} line${order.items.length === 1 ? "" : "s"}`}
          </Button>
          <p className="text-xs text-muted-foreground">
            Takes the quantities out of stock. This can only be done once.
          </p>
        </form>
      ) : null}

      {CANCELLABLE.includes(order.status) ? (
        <form action={cancel}>
          <input type="hidden" name="id" value={order.id} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={cancelling}
            className="w-full rounded-full text-destructive hover:text-destructive"
          >
            <BanIcon className="size-4" />
            {cancelling ? "Cancelling…" : "Cancel order"}
          </Button>
        </form>
      ) : null}
    </div>
  )
}

/** The non-stock status moves. */
export function OrderStatusActions({ order }: { order: Order }) {
  const [state, action, pending] = useActionState(setOrderStatus, undefined)
  const next = SETTABLE_STATUSES[order.status]

  if (!next.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No status change is available from {order.status.toLowerCase()}.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={order.id} />
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
