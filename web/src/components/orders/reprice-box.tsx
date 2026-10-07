"use client"

import { useActionState, useState } from "react"

import { repriceOrder } from "@/lib/orders/actions"
import { IS_REPRICEABLE, type Order } from "@/lib/orders/types"
import { toLadderRows, trimZeros } from "@/lib/commerce/deductions"
import type { Rounding } from "@/lib/commerce/totals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FormAlert } from "@/components/inventory/primitives"
import { SelectField } from "@/components/inventory/select-field"
import {
  DeductionLadder,
  type LadderRow,
} from "@/components/commerce/deduction-ladder"

/** "18.0000" → "18" so the input shows what someone would have typed. */
const trim = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? String(n) : ""
}

/**
 * The review gate. Lines are fixed by this point; what is still open is the
 * footer ladder agreed with the customer and the tax rates. Everything is
 * recomputed server-side from the lines, so this only posts the inputs.
 */
export function RepriceBox({ order }: { order: Order }) {
  const [state, action, pending] = useActionState(repriceOrder, undefined)
  const [ladder, setLadder] = useState<LadderRow[]>(() =>
    toLadderRows(order.deductions ?? [])
  )

  if (order.reserved_at || order.stock_posted_at) {
    return (
      <p className="text-sm text-muted-foreground">
        The figures are locked because stock is committed to this order. Cancel
        it to release the stock if they need to change.
      </p>
    )
  }

  if (!IS_REPRICEABLE.includes(order.status)) {
    return (
      <p className="text-sm text-muted-foreground">
        A {order.status.toLowerCase()} order is no longer repriceable. Move it
        back to review to change the figures.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={order.id} />
      <FormAlert state={state} />

      <div className="space-y-1.5">
        <Label className="text-xs">Deductions</Label>
        <p className="text-xs text-muted-foreground">
          Applied top to bottom; each takes its cut of what the one above left.
        </p>
        <DeductionLadder
          rows={ladder}
          onChange={setLadder}
          currency={order.currency || "INR"}
          disabled={pending}
        />
      </div>

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
          defaultValue={(order.rounding ?? "NONE") as Rounding}
          aria-label="Rounding"
        />
        <input
          type="hidden"
          name="rounding_precision"
          value={trimZeros(order.rounding_precision ?? "1")}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["cgst_rate", "CGST %", order.cgst_rate],
            ["sgst_rate", "SGST %", order.sgst_rate],
            ["igst_rate", "IGST %", order.igst_rate],
          ] as const
        ).map(([name, label, value]) => (
          <div key={name} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input
              name={name}
              inputMode="decimal"
              defaultValue={trim(value)}
              placeholder="0"
              aria-label={label}
            />
          </div>
        ))}
      </div>

      <Button type="submit" disabled={pending} variant="outline" className="w-full rounded-full">
        {pending ? "Saving…" : "Update figures"}
      </Button>
    </form>
  )
}
