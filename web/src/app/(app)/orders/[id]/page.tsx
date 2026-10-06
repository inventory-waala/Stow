import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { getOrder } from "@/lib/orders/data"
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
import { OrderStatusActions, StockActions } from "@/components/orders/order-actions"
import { RepriceBox } from "@/components/orders/reprice-box"
import { IS_REPRICEABLE } from "@/lib/orders/types"

export async function generateMetadata({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params
  const order = await getOrder(id)
  return { title: order.ok ? order.data.invoice_no : "Order" }
}

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params
  const [order, locations] = await Promise.all([getOrder(id), getLocations()])

  if (!order.ok) {
    return (
      <>
        <PageHeader title="Order" description="" />
        <ServiceNotice message={order.error} />
      </>
    )
  }

  const o = order.data
  if (!o?.id) notFound()
  const currency = o.currency || "INR"

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <span className="font-mono">{o.invoice_no}</span>
            <StatusBadge status={o.status} />
          </span>
        }
        description={`${o.customer?.name ?? "Unknown customer"} · ${new Date(
          o.order_date
        ).toLocaleDateString()}`}
        action={
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            All orders
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Lines"
          description={`${o.items.length} line${o.items.length === 1 ? "" : "s"}`}
        >
          <div className="overflow-x-auto border-t border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="pr-5 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.items.map((item) => (
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
                      {fmtMoney(item.rate, currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {item.discount_type === "NONE"
                        ? "—"
                        : item.discount_type === "PERCENT"
                          ? `${Number(item.discount)}%`
                          : fmtMoney(item.discount, currency)}
                    </TableCell>
                    <TableCell className="pr-5 text-right font-mono tabular">
                      {fmtMoney(item.total, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <dl className="space-y-1.5 border-t border-border/70 p-5 text-sm">
            <Figure label="Subtotal" value={fmtMoney(o.subtotal, currency)} />
            {Number(o.discount) ? (
              <Figure label="Bill discount" value={`− ${fmtMoney(o.discount, currency)}`} />
            ) : null}
            {Number(o.special_discount) ? (
              <Figure
                label="Special discount"
                value={`− ${fmtMoney(o.special_discount, currency)}`}
              />
            ) : null}
            <Figure label="Taxable" value={fmtMoney(o.taxable_amount, currency)} />
            {Number(o.cgst) ? (
              <Figure label={`CGST (${trim(o.cgst_rate)}%)`} value={fmtMoney(o.cgst, currency)} />
            ) : null}
            {Number(o.sgst) ? (
              <Figure label={`SGST (${trim(o.sgst_rate)}%)`} value={fmtMoney(o.sgst, currency)} />
            ) : null}
            {Number(o.igst) ? (
              <Figure label={`IGST (${trim(o.igst_rate)}%)`} value={fmtMoney(o.igst, currency)} />
            ) : null}
            <div className="mt-2 border-t border-border/70 pt-2">
              <Figure label="Total" value={fmtMoney(o.total_amount, currency)} strong />
            </div>
          </dl>
        </Panel>

        <div className="space-y-4">
          {/* Pricing comes before stock in the workflow, so it comes first on
              the page while the order is still open to it. */}
          {IS_REPRICEABLE.includes(o.status) && !o.reserved_at ? (
            <Panel
              title="Review figures"
              description="Settle discounts and tax before approving"
            >
              <div className="px-5 pb-5">
                <RepriceBox order={o} />
              </div>
            </Panel>
          ) : null}

          <Panel title="Stock">
            <div className="px-5 pb-5">
              <StockActions order={o} locations={locations.ok ? locations.data : []} />
            </div>
          </Panel>

          <Panel title="Status">
            <div className="px-5 pb-5">
              <OrderStatusActions order={o} />
            </div>
          </Panel>

          {o.notes || o.remarks ? (
            <Panel title="Notes">
              <div className="space-y-2 px-5 pb-5 text-sm text-muted-foreground">
                {o.notes ? <p>{o.notes}</p> : null}
                {o.remarks ? <p>{o.remarks}</p> : null}
              </div>
            </Panel>
          ) : null}

          <Panel title="Customer">
            <dl className="space-y-1.5 px-5 pb-5 text-sm">
              <Figure label="Name" value={o.customer?.name ?? "—"} />
              {o.customer?.gstin ? <Figure label="GSTIN" value={o.customer.gstin} /> : null}
              {o.customer?.phone ? <Figure label="Phone" value={o.customer.phone} /> : null}
              {o.customer?.state ? <Figure label="State" value={o.customer.state} /> : null}
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
