import Link from "next/link"

import { getPurchases, getSuppliers } from "@/lib/purchases/data"
import { getLocations, getProducts } from "@/lib/inventory/data"
import type { PurchaseStatus } from "@/lib/purchases/types"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { NewPurchaseSheet } from "@/components/purchases/new-purchase-sheet"
import { PurchaseFilters, PurchasesTable } from "@/components/purchases/purchases-table"

export const metadata = { title: "Purchases" }

export default async function PurchasesPage({ searchParams }: PageProps<"/purchases">) {
  const { q, status } = await searchParams
  const query = typeof q === "string" && q ? q : undefined
  const statusFilter =
    typeof status === "string" && status ? (status as PurchaseStatus) : undefined

  const [purchases, suppliers, products, locations] = await Promise.all([
    getPurchases({ q: query, status: statusFilter }),
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              nativeButton={false}
              render={<Link href="/purchases/suppliers" />}
            >
              Suppliers
            </Button>
            <NewPurchaseSheet
              suppliers={suppliers.ok ? suppliers.data.items : []}
              products={products.ok ? products.data.items : []}
              locations={locations.ok ? locations.data : []}
            />
          </div>
        }
      />

      {!suppliers.ok ? <ServiceNotice message={suppliers.error} /> : null}

      {!purchases.ok ? (
        <ServiceNotice message={purchases.error} />
      ) : (
        <Panel
          title={query || statusFilter ? "Matching purchase orders" : "Purchase orders"}
          description={`${purchases.data.total} order${purchases.data.total === 1 ? "" : "s"}`}
          action={<PurchaseFilters q={query} status={statusFilter} />}
        >
          <PurchasesTable items={purchases.data.items} />
        </Panel>
      )}

      {suppliers.ok && !suppliers.data.items.length ? (
        <p className="text-sm text-muted-foreground">
          Add a supplier first — a purchase order always has one.{" "}
          <Link href="/purchases/suppliers" className="underline underline-offset-4">
            Manage suppliers
          </Link>
          .
        </p>
      ) : null}
    </>
  )
}
