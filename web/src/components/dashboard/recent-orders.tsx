import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { ORDERS, type OrderStatus } from "@/components/dashboard/data"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS: Record<OrderStatus, string> = {
  Shipped: "bg-brand-soft text-brand",
  Packed: "bg-secondary text-foreground",
  "Awaiting pick": "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  "On hold": "bg-destructive/10 text-destructive",
}

export function RecentOrders() {
  return (
    <section className="min-w-0 rounded-2xl border border-border/70 bg-card shadow-ambient">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div>
          <h3 className="font-medium">Recent orders</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sales orders placed today and yesterday
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 rounded-full text-muted-foreground"
          nativeButton={false}
          render={<Link href="/orders" />}
        >
          All orders
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
      <div className="overflow-x-auto border-t border-border/70">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-5 text-right">Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ORDERS.map((o) => (
              <TableRow key={o.id} className="border-border/70">
                <TableCell className="pl-5 font-mono text-xs tabular">{o.id}</TableCell>
                <TableCell>{o.customer}</TableCell>
                <TableCell className="text-right tabular">{o.items}</TableCell>
                <TableCell className="text-right tabular">{o.total}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium",
                      STATUS[o.status]
                    )}
                  >
                    {o.status}
                  </span>
                </TableCell>
                <TableCell className="pr-5 text-right text-muted-foreground tabular">
                  {o.placed}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
