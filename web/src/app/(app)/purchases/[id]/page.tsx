import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { getPurchase } from "@/lib/purchases/data"
import { getLocations } from "@/lib/inventory/data"
import { PageHeader } from "@/components/layout/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fmtMoney, fmtQty, Panel, ServiceNotice } from "@/components/inventory/primitives"
import { StatusBadge } from "@/components/commerce/status-badge"
import { ReceiveBox, StatusActions } from "@/components/purchases/purchase-actions"

export async function generateMetadata({ params }: PageProps<"/purchases/[id]">) {
  const { id } = await params
  const purchase = await getPurchase(id)
  return { title: purchase.ok ? purchase.data.invoice_no : "Purchase order" }
}

export default async function PurchasePage({ params }: PageProps<"/purchases/[id]">) {
  const { id } = await params
  const [purchase, locations] = await Promise.all([getPurchase(id), getLocations()])

  if (!purchase.ok) {
    return (
      <>
        <PageHeader title="Purchase order" description="" />
        <ServiceNotice message={purchase.error} />
      </>
    )
  }

  const po = purchase.data
  if (!po?.id) notFound()
  const currency = po.currency || "INR"

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <span className="font-mono">{po.invoice_no}</span>
            <StatusBadge status={po.status} />
          </span>
        }
        description={`${po.supplier?.name ?? "Unknown supplier"} · ${new Date(
          po.order_date
        ).toLocaleDateString()}`}
        action={
          <Link
            href="/purchases"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            All purchases
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Lines"
          description={`${po.items.length} line${po.items.length === 1 ? "" : "s"}`}
        >
          <div className="overflow-x-auto border-t border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="pr-5 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-5">
                      <span className="block font-medium">{item.product_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.variant_name}
                        {item.size_label && item.size_label !== "Default"
                          ? ` · ${item.size_label}`
                          : ""}
                        {item.sku ? ` · ${item.sku}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {fmtQty(item.quantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {fmtMoney(item.unit_price, currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {item.discount_type === "NONE"
                        ? "—"
                        : item.discount_type === "PERCENT"
                          ? `${Number(item.discount)}%`
                          : fmtMoney(item.discount, currency)}
                    </TableCell>
                    <TableCell className="pr-5 text-right font-mono tabular">
                      {fmtMoney(item.total_price, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <dl className="space-y-1.5 border-t border-border/70 p-5 text-sm">
            <Figure label="Subtotal" value={fmtMoney(po.subtotal, currency)} />
            {Number(po.discount) ? (
              <Figure label="Bill discount" value={`− ${fmtMoney(po.discount, currency)}`} />
            ) : null}
            <Figure label="Taxable" value={fmtMoney(po.taxable_amount, currency)} />
            {Number(po.cgst) ? (
              <Figure label={`CGST (${trim(po.cgst_rate)}%)`} value={fmtMoney(po.cgst, currency)} />
            ) : null}
            {Number(po.sgst) ? (
              <Figure label={`SGST (${trim(po.sgst_rate)}%)`} value={fmtMoney(po.sgst, currency)} />
            ) : null}
            {Number(po.igst) ? (
              <Figure label={`IGST (${trim(po.igst_rate)}%)`} value={fmtMoney(po.igst, currency)} />
            ) : null}
            <div className="mt-2 border-t border-border/70 pt-2">
              <Figure label="Total" value={fmtMoney(po.total_amount, currency)} strong />
            </div>
          </dl>
        </Panel>

        <div className="space-y-4">
          <Panel title="Receive stock" className="p-0">
            <div className="px-5 pb-5">
              <ReceiveBox purchase={po} locations={locations.ok ? locations.data : []} />
            </div>
          </Panel>

          <Panel title="Status">
            <div className="px-5 pb-5">
              <StatusActions purchase={po} />
            </div>
          </Panel>

          {po.notes || po.remarks ? (
            <Panel title="Notes">
              <div className="space-y-2 px-5 pb-5 text-sm text-muted-foreground">
                {po.notes ? <p>{po.notes}</p> : null}
                {po.remarks ? <p>{po.remarks}</p> : null}
              </div>
            </Panel>
          ) : null}

          <Panel title="Supplier">
            <dl className="space-y-1.5 px-5 pb-5 text-sm">
              <Figure label="Name" value={po.supplier?.name ?? "—"} />
              {po.supplier?.gstin ? <Figure label="GSTIN" value={po.supplier.gstin} /> : null}
              {po.supplier?.phone ? <Figure label="Phone" value={po.supplier.phone} /> : null}
              {po.supplier?.state ? <Figure label="State" value={po.supplier.state} /> : null}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  )
}

/** "18.0000" → "18" so a whole rate reads cleanly in a label. */
function trim(rate: string): string {
  const n = Number(rate)
  return Number.isFinite(n) ? String(n) : rate
}

function Figure({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={`font-mono tabular ${strong ? "text-base font-medium" : ""}`}>{value}</dd>
    </div>
  )
}
