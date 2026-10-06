"use client"

import { useActionState, useState } from "react"
import { PlusIcon } from "lucide-react"

import { createCustomer } from "@/lib/orders/actions"
import type { Customer } from "@/lib/orders/types"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyRow, FormAlert } from "@/components/inventory/primitives"
import { StatusBadge } from "@/components/commerce/status-badge"

const FIELDS: Array<{ name: string; label: string; placeholder?: string }> = [
  { name: "code", label: "Code", placeholder: "Internal reference" },
  { name: "phone", label: "Phone" },
  { name: "email", label: "Email" },
  { name: "gstin", label: "GSTIN", placeholder: "22AAAAA0000A1Z5" },
  { name: "pan", label: "PAN", placeholder: "AAAAA0000A" },
  { name: "state", label: "State" },
]

export function NewCustomerSheet() {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const [state, action, pending] = useActionState(createCustomer, undefined)

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setSession((n) => n + 1)
        setOpen(o)
      }}
    >
      <SheetTrigger
        render={
          <Button className="rounded-full px-4">
            <PlusIcon className="size-4" />
            New customer
          </Button>
        }
      />
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New customer</SheetTitle>
          <SheetDescription>
            Only a name is required. GSTIN and PAN are checked for shape, not
            against any registry.
          </SheetDescription>
        </SheetHeader>

        <form key={session} action={action} className="space-y-4 px-4 pb-4">
          <FormAlert state={state} />

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required autoFocus />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input id={f.name} name={f.name} placeholder={f.placeholder} />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending} className="rounded-full">
              {pending ? "Saving…" : "Add customer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function CustomersTable({ items }: { items: Customer[] }) {
  if (!items.length) {
    return <EmptyRow>No customers yet. Add one to raise an order.</EmptyRow>
  }
  return (
    <div className="overflow-x-auto border-t border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Customer</TableHead>
            <TableHead>GSTIN</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="pr-5 text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="pl-5">
                <span className="block font-medium">{c.name}</span>
                {c.code ? (
                  <span className="block font-mono text-xs text-muted-foreground">
                    {c.code}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-xs">{c.gstin ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.phone ?? c.email ?? "—"}
              </TableCell>
              <TableCell className="text-right font-mono tabular">
                {c._count?.orders ?? 0}
              </TableCell>
              <TableCell className="pr-5 text-right">
                <StatusBadge status={c.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
