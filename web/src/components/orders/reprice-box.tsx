"use client"

import { useActionState } from "react"

import { repriceOrder } from "@/lib/orders/actions"
import { IS_REPRICEABLE, type Order } from "@/lib/orders/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FormAlert } from "@/components/inventory/primitives"
import { SelectField } from "@/components/inventory/select-field"

const DISCOUNT_OPTIONS = [
  { value: "NONE", label: "No discount" },
  { value: "PERCENT", label: "%" },
  { value: "AMOUNT", label: "Amount" },
]

/** "18.0000" → "18" so the input shows what someone would have typed. */
const trim = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? String(n) : ""
}

/**
 * The review gate. Lines are fixed by this point; what is still open is the
 * bill discount, the special discount agreed with the customer, and the tax
 * rates. Everything is recomputed server-side from the lines.
 */
export function RepriceBox({ order }: { order: Order }) {
  const [state, action, pending] = useActionState(repriceOrder, undefined)

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
        <Label className="text-xs">Bill discount</Label>
        <div className="flex gap-2">
          <SelectField
            name="discount_type"
            options={DISCOUNT_OPTIONS}
            defaultValue={order.discount_type}
            aria-label="Bill discount type"
            className="w-32"
          />
          <Input
            name="discount"
            inputMode="decimal"
            defaultValue={trim(order.discount)}
            placeholder="0"
            aria-label="Bill discount value"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Special discount</Label>
        <div className="flex gap-2">
          <SelectField
            name="special_discount_type"
            options={DISCOUNT_OPTIONS}
            defaultValue={order.special_discount_type}
            aria-label="Special discount type"
            className="w-32"
          />
          <Input
            name="special_discount"
            inputMode="decimal"
            defaultValue={trim(order.special_discount)}
            placeholder="0"
            aria-label="Special discount value"
          />
        </div>
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
