import Link from "next/link"
import { ArrowLeftRightIcon, SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Location, ProductListItem, ProductStatus } from "@/lib/inventory/types"
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
import { EmptyRow, fmtQty } from "./primitives"
import { QuickStockSheet } from "./quick-stock-sheet"

export const STATUS_CLASS: Record<ProductStatus, string> = {
  ACTIVE: "bg-brand-soft text-brand",
  DRAFT: "bg-secondary text-foreground",
  INACTIVE: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  ARCHIVED: "bg-destructive/10 text-destructive",
}

export function StatusPill({ status }: { status: ProductStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium",
        STATUS_CLASS[status]
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

/** GET form so the query lives in the URL and the page stays a server component. */
export function ProductSearch({ q }: { q?: string }) {
  return (
    <form action="/inventory" className="flex w-full max-w-sm items-center gap-2">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search name, code, SKU or barcode"
          className="pl-8"
          aria-label="Search products"
        />
      </div>
      <Button type="submit" variant="outline" className="rounded-full">
        Search
      </Button>
    </form>
  )
}

export function ProductsTable({ items, locations }: { items: ProductListItem[]; locations: Location[] }) {
  if (!items.length) {
    return <EmptyRow>No products yet. Create the first one to start tracking stock.</EmptyRow>
  }
  return (
    <div className="overflow-x-auto border-t border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Product</TableHead>
            <TableHead className="text-right">Variants</TableHead>
            <TableHead className="text-right">Sizes</TableHead>
            <TableHead className="text-right">On hand</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-5 text-right">Stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id} className="border-border/70">
              <TableCell className="pl-5">
                <Link href={`/inventory/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                  {p.name}
                </Link>
                {p.code ? (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{p.code}</span>
                ) : null}
                {p.tags.length ? (
                  <div className="mt-0.5 text-xs text-muted-foreground">{p.tags.join(" · ")}</div>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular">{p.variant_count}</TableCell>
              <TableCell className="text-right tabular">{p.size_count}</TableCell>
              <TableCell className="text-right tabular">{fmtQty(p.stock.quantity)}</TableCell>
              <TableCell className="text-right tabular">{fmtQty(p.stock.available)}</TableCell>
              <TableCell>
                <StatusPill status={p.status} />
              </TableCell>
              <TableCell className="pr-5 text-right">
                <QuickStockSheet
                  products={items}
                  locations={locations}
                  productId={p.id}
                  trigger={
                    <Button variant="ghost" size="sm" className="rounded-full" aria-label={`Move stock of ${p.name}`}>
                      <ArrowLeftRightIcon className="size-3.5" />
                      Move
                    </Button>
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
