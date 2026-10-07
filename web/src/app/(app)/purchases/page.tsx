import Link from "next/link"

import { getPurchases, getSuppliers } from "@/lib/purchases/data"
import { getLocations, getProducts } from "@/lib/inventory/data"
import type { PurchaseStatus } from "@/lib/purchases/types"
import { PageHeader } from "@/components/layout/page-header"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { NewPurchaseDialog } from "@/components/purchases/new-purchase-dialog"
import { PurchaseFilters, PurchasesTable } from "@/components/purchases/purchases-table"
import { SummaryStrip } from "@/components/commerce/summary-strip"

export const metadata = { title: "Purchases" }

export default async function PurchasesPage({ searchParams }: PageProps<"/purchases">) {
  const { q, status, min_amount, max_amount } = await searchParams
  const query = typeof q === "string" && q ? q : undefined
  const statusFilter =
    typeof status === "string" && status ? (status as PurchaseStatus) : undefined
  const minAmount = typeof min_amount === "string" && min_amount ? min_amount : undefined
  const maxAmount = typeof max_amount === "string" && max_amount ? max_amount : undefined

  const [purchases, suppliers, products, locations] = await Promise.all([
    getPurchases({
      q: query,
      status: statusFilter,
      min_amount: minAmount,
      max_amount: maxAmount,
    }),
    getSuppliers(),
    getProducts(),
    getLocations(),
  ])

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Supplier invoices, and the stock they bring in."
        action={
          <NewPurchaseDialog
            suppliers={suppliers.ok ? suppliers.data.items : []}
            products={products.ok ? products.data.items : []}
            locations={locations.ok ? locations.data : []}
          />
        }
      />

      {!suppliers.ok ? <ServiceNotice message={suppliers.error} /> : null}

      {purchases.ok ? (
        <SummaryStrip summary={purchases.data.summary} label="Purchased" />
      ) : null}

      {/* Five controls are too many for the panel header, which would squeeze
          the title; they get their own row. */}
      {purchases.ok ? (
        <PurchaseFilters
          q={query}
          status={statusFilter}
          minAmount={minAmount}
          maxAmount={maxAmount}
        />
      ) : null}

      {!purchases.ok ? (
        <ServiceNotice message={purchases.error} />
      ) : (
        <Panel
          title={
            query || statusFilter || minAmount || maxAmount
              ? "Matching purchase orders"
              : "Purchase orders"
          }
          description={`${purchases.data.total} order${purchases.data.total === 1 ? "" : "s"}`}
        >
          <PurchasesTable items={purchases.data.items} />
        </Panel>
      )}

      {suppliers.ok && !suppliers.data.items.length ? (
        <p className="text-sm text-muted-foreground">
          Add a supplier first — a purchase order always has one.{" "}
          <Link href="/suppliers" className="underline underline-offset-4">
            Manage suppliers
          </Link>
          .
        </p>
      ) : null}
    </>
  )
}
