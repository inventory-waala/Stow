import Link from "next/link"
import { SearchIcon } from "lucide-react"

import type { Order, OrderStatus } from "@/lib/orders/types"
import { ORDER_STATUSES } from "@/lib/orders/types"
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

export function OrderFilters({ q, status }: { q?: string; status?: OrderStatus }) {
  return (
    <form action="/orders" className="flex w-full max-w-lg items-center gap-2">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search invoice or customer"
          className="pl-8"
          aria-label="Search orders"
        />
      </div>
      <select
        name="status"
        defaultValue={status ?? ""}
        aria-label="Filter by status"
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        <option value="">All statuses</option>
        {ORDER_STATUSES.map((s) => (
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

export function OrdersTable({ items }: { items: Order[] }) {
  if (!items.length) {
    return <EmptyRow>No orders yet. Raise one to sell stock to a customer.</EmptyRow>
  }

  return (
    <div className="overflow-x-auto border-t border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Invoice</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Lines</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="pr-5 text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="pl-5">
                <Link
                  href={`/orders/${order.id}`}
                  className="font-mono text-sm font-medium hover:underline"
                >
                  {order.invoice_no}
                </Link>
                {order.reserved_at && !order.stock_posted_at ? (
                  <span className="block text-xs text-muted-foreground">stock held</span>
                ) : null}
                {order.stock_posted_at ? (
                  <span className="block text-xs text-muted-foreground">shipped</span>
                ) : null}
              </TableCell>
              <TableCell>
                <span className="block truncate">{order.customer?.name ?? "—"}</span>
                {order.customer?.phone ? (
                  <span className="block font-mono text-xs text-muted-foreground">
                    {order.customer.phone}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {new Date(order.order_date).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right font-mono tabular">
                {order.items?.length ?? 0}
              </TableCell>
              <TableCell className="text-right font-mono tabular">
                {fmtMoney(order.total_amount, order.currency)}
              </TableCell>
              <TableCell className="pr-5 text-right">
                <StatusBadge status={order.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
