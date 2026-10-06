import Link from "next/link"
import { SearchIcon } from "lucide-react"

import type { PurchaseOrder, PurchaseStatus } from "@/lib/purchases/types"
import { PURCHASE_STATUSES } from "@/lib/purchases/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyRow, fmtMoney } from "@/components/inventory/primitives"
import { StatusBadge } from "@/components/commerce/status-badge"

export function PurchaseFilters({
  q,
  status,
}: {
  q?: string
  status?: PurchaseStatus
}) {
  return (
    <form action="/purchases" className="flex w-full max-w-lg items-center gap-2">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search invoice or supplier"
          className="pl-8"
          aria-label="Search purchase orders"
        />
      </div>
      {/* A native select keeps this a server-rendered form with no client JS. */}
      <select
        name="status"
        defaultValue={status ?? ""}
        aria-label="Filter by status"
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        <option value="">All statuses</option>
        {PURCHASE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" className="rounded-full">
        Filter
      </Button>
    </form>
  )
}

export function PurchasesTable({ items }: { items: PurchaseOrder[] }) {
  if (!items.length) {
    return (
      <EmptyRow>
        No purchase orders yet. Raise one to bring stock in against a supplier invoice.
      </EmptyRow>
    )
  }

  return (
    <div className="overflow-x-auto border-t border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Invoice</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Lines</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="pr-5 text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((po) => (
            <TableRow key={po.id}>
              <TableCell className="pl-5">
                <Link
                  href={`/purchases/${po.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {po.invoice_no}
                </Link>
                {po.stock_posted_at ? (
                  <span className="block text-xs text-muted-foreground">in stock</span>
                ) : null}
              </TableCell>
              <TableCell>
                <span className="block truncate">{po.supplier?.name ?? "—"}</span>
                {po.supplier?.gstin ? (
                  <span className="block font-mono text-xs text-muted-foreground">
                    {po.supplier.gstin}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {new Date(po.order_date).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right font-mono tabular">
                {po.items?.length ?? 0}
              </TableCell>
              <TableCell className="text-right font-mono tabular">
                {fmtMoney(po.total_amount, po.currency)}
              </TableCell>
              <TableCell className="pr-5 text-right">
                <StatusBadge status={po.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
