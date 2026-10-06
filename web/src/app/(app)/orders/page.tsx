import Link from "next/link"

import { getCustomers, getOrders } from "@/lib/orders/data"
import { getLocations, getProducts } from "@/lib/inventory/data"
import type { OrderStatus } from "@/lib/orders/types"
import { PageHeader } from "@/components/layout/page-header"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { NewOrderSheet } from "@/components/orders/new-order-sheet"
import { OrderFilters, OrdersTable } from "@/components/orders/orders-table"
import { SummaryStrip } from "@/components/commerce/summary-strip"

export const metadata = { title: "Orders" }

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const { q, status, min_amount, max_amount } = await searchParams
  const query = typeof q === "string" && q ? q : undefined
  const statusFilter =
    typeof status === "string" && status ? (status as OrderStatus) : undefined
  const minAmount = typeof min_amount === "string" && min_amount ? min_amount : undefined
  const maxAmount = typeof max_amount === "string" && max_amount ? max_amount : undefined

  const [orders, customers, products, locations] = await Promise.all([
    getOrders({
      q: query,
      status: statusFilter,
      min_amount: minAmount,
      max_amount: maxAmount,
    }),
    getCustomers(),
    getProducts(),
    getLocations(),
  ])

  return (
    <>
      <PageHeader
        title="Orders"
        description="Customer invoices, and the stock they take out."
        action={
          <NewOrderSheet
            customers={customers.ok ? customers.data.items : []}
            products={products.ok ? products.data.items : []}
            locations={locations.ok ? locations.data : []}
          />
        }
      />

      {!customers.ok ? <ServiceNotice message={customers.error} /> : null}

      {orders.ok ? <SummaryStrip summary={orders.data.summary} label="Sold" /> : null}

      {orders.ok ? (
        <OrderFilters
          q={query}
          status={statusFilter}
          minAmount={minAmount}
          maxAmount={maxAmount}
        />
      ) : null}

      {!orders.ok ? (
        <ServiceNotice message={orders.error} />
      ) : (
        <Panel
          title={
            query || statusFilter || minAmount || maxAmount ? "Matching orders" : "Orders"
          }
          description={`${orders.data.total} order${orders.data.total === 1 ? "" : "s"}`}
        >
          <OrdersTable items={orders.data.items} />
        </Panel>
      )}

      {customers.ok && !customers.data.items.length ? (
        <p className="text-sm text-muted-foreground">
          Add a customer first — an order always has one.{" "}
          <Link href="/customers" className="underline underline-offset-4">
            Manage customers
          </Link>
          .
        </p>
      ) : null}
    </>
  )
}
