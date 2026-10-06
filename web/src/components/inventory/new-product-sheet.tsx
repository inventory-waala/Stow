"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2Icon, PlusIcon } from "lucide-react"

import { createProductAction, type ActionState } from "@/lib/inventory/actions"
import type { VariantType } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { FormAlert } from "./primitives"
import { SchemaFields } from "./schema-fields"
import { VariantForm } from "./variant-form"

/** The last product created in this sheet session, shown above a fresh form. */
function CreatedNotice({ state, onDismiss }: { state: ActionState; onDismiss: () => void }) {
  if (!state?.success || !state.id) return null
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand-soft p-3 text-sm text-brand">
      <span className="inline-flex items-center gap-2">
        <CheckCircle2Icon className="size-4" />
        {state.success} Add another below, or
        <Link href={`/inventory/${state.id}`} className="font-medium underline underline-offset-4">
          open it
        </Link>
        .
      </span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-xs underline-offset-4 hover:underline">
        Dismiss
      </button>
    </div>
  )
}

/**
 * The sheet stays open after a product is created so several can be added in
 * a row: the form remounts empty (new `session`) and the success is shown
 * above it with a link to the product.
 */
export function NewProductSheet({ variantTypes }: { variantTypes: VariantType[] }) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const [created, setCreated] = useState<ActionState>(undefined)

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setSession((n) => n + 1)
          setCreated(undefined)
        }
        setOpen(o)
      }}
    >
      <SheetTrigger
        render={
          <Button className="rounded-full px-4">
            <PlusIcon className="size-4" strokeWidth={2} />
            New product
          </Button>
        }
      />
      <NewProductForm
        key={session}
        variantTypes={variantTypes}
        created={created}
        onCreated={(state) => {
          setCreated(state)
          setSession((n) => n + 1)
        }}
        onDismiss={() => setCreated(undefined)}
      />
    </Sheet>
  )
}

function NewProductForm({
  variantTypes,
  created,
  onCreated,
  onDismiss,
}: {
  variantTypes: VariantType[]
  created: ActionState
  onCreated: (state: ActionState) => void
  onDismiss: () => void
}) {
  const [state, action, pending] = useActionState(createProductAction, undefined)
  const [rows, setRows] = useState<number[]>([0])
  const [nextRow, setNextRow] = useState(1)

  // A successful create hands the result to the sheet, which remounts this form empty.
  useEffect(() => {
    if (state?.success && state.id) onCreated(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <SheetContent className="w-full overflow-y-auto sm:max-w-2xl!">
      <form action={action} className="flex h-full flex-col">
        <SheetHeader>
          <SheetTitle>New product</SheetTitle>
          <SheetDescription>Name it, add any properties it should carry, then the variants it comes in — each with its own type.</SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-4">
          <CreatedNotice state={created} onDismiss={onDismiss} />
          <FormAlert state={state?.error ? state : undefined} />

          <div className="grid gap-2">
            <Label htmlFor="np-name">Name</Label>
            <Input id="np-name" name="name" required maxLength={200} disabled={pending} autoFocus placeholder="Product name" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="np-code">Code</Label>
              <Input id="np-code" name="code" maxLength={128} disabled={pending} placeholder="Optional, e.g. PRD-001" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="np-tags">Tags</Label>
              <Input id="np-tags" name="tags" disabled={pending} placeholder="Comma separated, e.g. bestseller, seasonal" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Properties</Label>
            <SchemaFields
              name="attr"
              schema={undefined}
              disabled={pending}
              emptyHint="Anything this product should carry — brand, HSN code, material. Optional."
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>Variants</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                disabled={pending}
                onClick={() => {
                  setRows((r) => [...r, nextRow])
                  setNextRow((n) => n + 1)
                }}
              >
                <PlusIcon className="size-3.5" />
                Add variant
              </Button>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              A variant is a named version — a colour, a style, a pack. Its variant type decides what it records and which field splits its stock.
            </p>
            {rows.map((id, i) => (
              <VariantForm
                key={id}
                prefix={`variants[${id}]`}
                variantTypes={variantTypes}
                disabled={pending}
                title={`Variant ${i + 1}`}
                onRemove={rows.length > 1 ? () => setRows((r) => r.filter((x) => x !== id)) : undefined}
              />
            ))}
          </div>
        </div>

        <SheetFooter className="mt-auto">
          <Button type="submit" disabled={pending} className="rounded-full">
            {pending ? "Creating..." : "Create product"}
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  )
}
