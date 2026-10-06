import Link from "next/link"

import { cn } from "@/lib/utils"
import type { Movement, MovementType } from "@/lib/inventory/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyRow, SizeText, fmtQty } from "./primitives"

const TYPE_CLASS: Record<MovementType, string> = {
  IN: "bg-brand-soft text-brand",
  OUT: "bg-destructive/10 text-destructive",
  TRANSFER: "bg-secondary text-foreground",
  ADJUST: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
}

const TYPE_LABEL: Record<MovementType, string> = {
  IN: "Received",
  OUT: "Issued",
  TRANSFER: "Transfer",
  ADJUST: "Adjusted",
}

function when(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function MovementsTable({ items, showProduct = true }: { items: Movement[]; showProduct?: boolean }) {
  if (!items.length) return <EmptyRow>No stock movements yet.</EmptyRow>
  return (
    <div className="overflow-x-auto border-t border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">When</TableHead>
            <TableHead>Type</TableHead>
            {showProduct ? <TableHead>Item</TableHead> : null}
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Where</TableHead>
            <TableHead className="pr-5">Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((m) => (
            <TableRow key={m.id} className="border-border/70">
              <TableCell className="pl-5 whitespace-nowrap text-muted-foreground tabular">{when(m.occurred_at)}</TableCell>
              <TableCell>
                <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium", TYPE_CLASS[m.type])}>
                  {TYPE_LABEL[m.type]}
                </span>
              </TableCell>
              {showProduct ? (
                <TableCell>
                  <Link href={`/inventory/${m.size.variant.product.id}`} className="underline-offset-4 hover:underline">
                    {m.size.variant.product.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    <SizeText size={m.size} />
                  </div>
                </TableCell>
              ) : null}
              <TableCell className="text-right font-medium tabular">
                {m.type === "OUT" ? "−" : m.type === "ADJUST" && Number(m.quantity) < 0 ? "" : "+"}
                {fmtQty(Math.abs(Number(m.quantity)))}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {m.type === "TRANSFER"
                  ? `${m.from_location?.code ?? "?"} → ${m.to_location?.code ?? "?"}`
                  : (m.from_location ?? m.to_location)?.code ?? "—"}
                {m.type === "ADJUST" && typeof m.payload?.counted === "string" ? (
                  <div>counted {m.payload.counted} (was {String(m.payload.previous)})</div>
                ) : null}
              </TableCell>
              <TableCell className="pr-5 text-xs text-muted-foreground">
                {m.reference_type && m.reference_id ? (
                  <span className="font-mono">{m.reference_type}:{m.reference_id}</span>
                ) : m.reference_id ? (
                  m.reference_id
                ) : null}
                {m.reason ? <div>{m.reason}</div> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
