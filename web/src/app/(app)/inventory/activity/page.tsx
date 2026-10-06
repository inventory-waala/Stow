import Link from "next/link"

import { getLowStock, getMovements } from "@/lib/inventory/data"
import { PageHeader } from "@/components/layout/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MovementsTable } from "@/components/inventory/movements-table"
import { EmptyRow, Panel, ServiceNotice, SizeText, fmtQty } from "@/components/inventory/primitives"

export const metadata = { title: "Stock activity" }

export default async function ActivityPage() {
  const [movements, low] = await Promise.all([getMovements({ limit: 100 }), getLowStock()])

  return (
    <>
      <PageHeader title="Stock activity" description="Every movement, newest first, plus anything below its reorder point." />

      <Panel title="Below reorder point" description="Variants whose available quantity is under the threshold you set.">
        {!low.ok ? (
          <ServiceNotice message={low.error} />
        ) : low.data.items.length ? (
          <div className="overflow-x-auto border-t border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Item</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="pr-5 text-right">Reorder at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {low.data.items.map((l) => (
                  <TableRow key={l.id} className="border-border/70">
                    <TableCell className="pl-5">
                      <Link href={`/inventory/${l.size.variant.product.id}`} className="underline-offset-4 hover:underline">
                        {l.size.variant.product.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        <SizeText size={l.size} />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.location.name}</TableCell>
                    <TableCell className="text-right font-medium tabular text-destructive">
                      {fmtQty(Number(l.quantity) - Number(l.reserved))}
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular">{fmtQty(l.reorder_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyRow>Nothing is below its reorder point.</EmptyRow>
        )}
      </Panel>

      <Panel title="Movements" description={movements.ok ? `${movements.data.total} recorded` : undefined}>
        {!movements.ok ? <ServiceNotice message={movements.error} /> : <MovementsTable items={movements.data.items} />}
      </Panel>
    </>
  )
}
