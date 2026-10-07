"use client"

import { useActionState, useCallback, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2Icon, PlusIcon } from "lucide-react"

import { createPurchase, type ActionState } from "@/lib/purchases/actions"
import type { Supplier } from "@/lib/purchases/types"
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
 * Stays open after a successful save so several invoices can be entered in a
 * row. A centred dialog rather than a side sheet: the line editor needs the
 * horizontal room more than the page behind it needs to stay visible.
 */
export function NewPurchaseDialog({
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
  const [lineCount, setLineCount] = useState(0)

  const formRef = useRef<HTMLFormElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const help = useShortcutHelp()
  const advance = useEnterAdvances()
  const onCountChange = useCallback((n: number) => setLineCount(n), [])

  /**
   * A voucher screen is driven from the keyboard, so every action has a key
   * and the key is printed next to it. Saving is deliberate: Enter walks the
   * fields, and only this posts the bill.
   */
  const actions: VoucherAction[] = [
    {
      keys: "mod+s",
      label: pending ? "Saving…" : "Save bill",
      hint: "Posts the purchase order. Stock still only moves on receipt.",
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
      keys: "alt+s",
      label: "Supplier",
      hint: "Jumps back to the supplier field",
      disabled: pending,
      run: () => document.getElementById("supplier_id")?.focus(),
    },
    {
      keys: "?",
      label: "Keys",
      hint: "This list",
      run: help.show,
    },
    {
      keys: "escape",
      label: "Close",
      hidden: true,
      run: () => (help.open ? help.hide() : setOpen(false)),
    },
  ]

  const lines = flattenLines(products)
  const supplierOptions = suppliers
    .filter((s) => s.status === "ACTIVE")
    .map((s) => ({ value: s.id, label: s.code ? `${s.name} (${s.code})` : s.name }))
  const locationOptions = [
    { value: "", label: "Default location" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
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
          <Button className="rounded-full px-4" disabled={!supplierOptions.length}>
            <PlusIcon className="size-4" />
            New purchase
          </Button>
        }
      />
      {/* DialogContent supplies the p-4, so nothing inside adds its own. The
          height cap keeps a long line list inside the viewport. */}
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-5xl">
        <ShortcutHelp actions={actions} open={help.open} onClose={help.hide} />

        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Record what you bought. Stock only moves when you receive it.
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
              searchRef={searchRef}
              onCountChange={onCountChange}
            />
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
              {pending ? "Saving…" : "Save purchase order"}
            </Button>
          </DialogFooter>
        </form>

        {/* Tally keeps this list down the right of the screen. Borrowed, with
            the keys spelled out next to real labels. */}
        <ActionRail
          actions={actions}
          className="lg:sticky lg:top-0 lg:h-fit lg:border-l lg:border-border/70 lg:pl-3"
        />
        </div>
      </DialogContent>
    </Dialog>
  )
}
