"use client"

import { useActionState, useCallback, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2Icon, PlusIcon } from "lucide-react"

import { createOrder, type ActionState } from "@/lib/orders/actions"
import type { Customer } from "@/lib/orders/types"
import type { Location, ProductListItem } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { FormAlert } from "@/components/inventory/primitives"
import { SelectField } from "@/components/inventory/select-field"
import { flattenLines } from "@/components/inventory/quick-stock-sheet"
import { LineItemsEditor } from "@/components/commerce/line-items"
import {
  ActionRail,
  ShortcutHelp,
  ShortcutHint,
  useEnterAdvances,
  useShortcutHelp,
  useVoucherKeys,
  type VoucherAction,
} from "@/components/commerce/voucher"

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
export function NewOrderDialog({
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
  const [lineCount, setLineCount] = useState(0)

  const formRef = useRef<HTMLFormElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const help = useShortcutHelp()
  const advance = useEnterAdvances()
  const onCountChange = useCallback((n: number) => setLineCount(n), [])

  const lines = flattenLines(products)
  const customerOptions = customers
    .filter((c) => c.status === "ACTIVE")
    .map((c) => ({ value: c.id, label: c.code ? `${c.name} (${c.code})` : c.name }))
  const locationOptions = [
    { value: "", label: "Default location" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ]

  /** Same key map as the purchase voucher, so the muscle memory carries. */
  const actions: VoucherAction[] = [
    {
      keys: "mod+s",
      label: pending ? "Saving…" : "Save invoice",
      hint: "Posts the order. Stock is only held when you confirm it.",
      primary: true,
      disabled: pending || lineCount === 0,
      run: () => formRef.current?.requestSubmit(),
    },
    {
      keys: "alt+l",
      label: "Add a line",
      hint: "Jumps to the product search",
      disabled: pending,
      run: () => searchRef.current?.focus(),
    },
    {
      keys: "alt+c",
      label: "Customer",
      hint: "Jumps back to the customer field",
      disabled: pending,
      run: () => document.getElementById("customer_id")?.focus(),
    },
    { keys: "?", label: "Keys", hint: "This list", run: help.show },
    {
      keys: "escape",
      label: "Close",
      hidden: true,
      run: () => (help.open ? help.hide() : setOpen(false)),
    },
  ]

  useVoucherKeys(actions, open)

  const created = state?.success && state.id && !dismissed ? state : undefined

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setSession((n) => n + 1)
          setDismissed(false)
        }
        setOpen(o)
      }}
    >
      <DialogTrigger
        render={
          <Button className="rounded-full px-4" disabled={!customerOptions.length}>
            <PlusIcon className="size-4" />
            New order
          </Button>
        }
      />
      <DialogContent className="relative max-h-[85svh] overflow-y-auto sm:max-w-5xl">
        <ShortcutHelp actions={actions} open={help.open} onClose={help.hide} />

        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Build the invoice. Stock is only held when you confirm it.
            <ShortcutHint onOpen={help.show} />
          </DialogDescription>
        </DialogHeader>

        <CreatedNotice state={created} onDismiss={() => setDismissed(true)} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_11rem]">
        <form
          key={session}
          ref={formRef}
          action={action}
          onKeyDown={advance}
          className="space-y-5"
        >
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
              searchRef={searchRef}
              onCountChange={onCountChange}
            />
            <p className="text-xs text-muted-foreground">
              Leave a rate blank to use the catalog sell price.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || lineCount === 0}
              className="rounded-full"
            >
              {pending ? "Saving…" : "Save order"}
            </Button>
          </DialogFooter>
        </form>

        <ActionRail
          actions={actions}
          className="lg:sticky lg:top-0 lg:h-fit lg:border-l lg:border-border/70 lg:pl-3"
        />
        </div>
      </DialogContent>
    </Dialog>
  )
}
