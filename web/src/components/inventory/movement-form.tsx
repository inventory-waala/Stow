"use client"

import { useActionState, useState } from "react"

import { moveStockAction } from "@/lib/inventory/actions"
import type { Location, MovementType, StockTotals } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FormAlert, fmtQty } from "./primitives"
import { SelectField } from "./select-field"

export const MOVEMENT_TYPES: Array<{ value: MovementType; label: string; hint: string }> = [
  { value: "IN", label: "Receive", hint: "Stock coming in (purchase, return)." },
  { value: "OUT", label: "Issue", hint: "Stock going out (sale, damage)." },
  { value: "TRANSFER", label: "Transfer", hint: "Move between two locations." },
  { value: "ADJUST", label: "Stock take", hint: "Set the counted quantity; the difference is logged." },
]

/** The stock line a movement is recorded against. */
export interface MovementTarget {
  sizeId: string
  productId: string
  unit: string
  totals: StockTotals
}

/**
 * The movement form proper — type, quantity, locations, reference, reason —
 * for one stock line. Used by the per-line "Move" sheet on a product page
 * and by the quick "Move stock" sheet on the inventory list.
 */
export function MovementForm({ target, locations }: { target: MovementTarget; locations: Location[] }) {
  const [state, action, pending] = useActionState(moveStockAction, undefined)
  const [type, setType] = useState<MovementType>("IN")
  const defaultLoc = locations.find((l) => l.is_default)?.id ?? locations[0]?.id ?? ""
  const locationOptions = locations.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }))
  const meta = MOVEMENT_TYPES.find((t) => t.value === type)!
  const showFrom = type !== "IN"
  const showTo = type === "IN" || type === "TRANSFER"

  return (
    <form action={action} className="flex h-full flex-col">
      <input type="hidden" name="size_id" value={target.sizeId} />
      <input type="hidden" name="product_id" value={target.productId} />

      <div className="grid gap-5 px-4 pb-4">
        <FormAlert state={state} />

        <div className="grid gap-2">
          <Label>Movement</Label>
          <div className="grid grid-cols-2 gap-2">
            {MOVEMENT_TYPES.map((t) => (
              <label
                key={t.value}
                className={
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors " +
                  (type === t.value ? "border-brand bg-brand-soft text-brand" : "border-border/70 hover:bg-secondary")
                }
              >
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => setType(t.value)}
                  className="sr-only"
                  disabled={pending}
                />
                {t.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{meta.hint}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="ms-qty">{type === "ADJUST" ? "Counted quantity" : "Quantity"}</Label>
          <Input id="ms-qty" name="quantity" inputMode="decimal" required autoFocus disabled={pending} placeholder="0" />
          <p className="text-xs text-muted-foreground">
            Unit: {target.unit} · on hand {fmtQty(target.totals.quantity)}, available {fmtQty(target.totals.available)}
          </p>
        </div>

        {showFrom ? (
          <div className="grid gap-2">
            <Label htmlFor="ms-from">{type === "ADJUST" ? "Location" : "From"}</Label>
            <SelectField id="ms-from" name="from_location_id" options={locationOptions} defaultValue={defaultLoc} disabled={pending} />
          </div>
        ) : null}
        {showTo ? (
          <div className="grid gap-2">
            <Label htmlFor="ms-to">To</Label>
            <SelectField
              id="ms-to"
              name="to_location_id"
              options={locationOptions}
              defaultValue={type === "TRANSFER" ? (locations.find((l) => l.id !== defaultLoc)?.id ?? defaultLoc) : defaultLoc}
              disabled={pending}
            />
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="ms-ref">Reference</Label>
          <Input id="ms-ref" name="reference" placeholder="purchase:PO-1042" maxLength={200} disabled={pending} />
          <p className="text-xs text-muted-foreground">
            Optional. Use <span className="font-mono">type:id</span> to link a document.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ms-reason">Reason</Label>
          <Input id="ms-reason" name="reason" maxLength={200} disabled={pending} placeholder="Weekly stock take" />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end gap-2 border-t border-border/70 p-4">
        <Button type="submit" disabled={pending || !locations.length} className="rounded-full">
          {pending ? "Recording..." : `Record ${meta.label.toLowerCase()}`}
        </Button>
      </div>
    </form>
  )
}
