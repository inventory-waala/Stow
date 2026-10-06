import { getLocations, getProducts, getVariantTypes } from "@/lib/inventory/data"
import { PageHeader } from "@/components/layout/page-header"
import { NewProductSheet } from "@/components/inventory/new-product-sheet"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { ProductSearch, ProductsTable } from "@/components/inventory/products-table"
import { QuickStockSheet, ScanStockBox } from "@/components/inventory/quick-stock-sheet"

export const metadata = { title: "Inventory" }

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const { q } = await searchParams
  const query = typeof q === "string" ? q : undefined
  const [products, variantTypes, locations] = await Promise.all([getProducts({ q: query }), getVariantTypes(), getLocations()])
  const locs = locations.ok ? locations.data : []

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Products, their variants, and stock per size."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ScanStockBox products={products.ok ? products.data.items : []} locations={locs} />
            <QuickStockSheet products={products.ok ? products.data.items : []} locations={locs} />
            <NewProductSheet variantTypes={variantTypes.ok ? variantTypes.data : []} />
          </div>
        }
      />

      {!products.ok ? (
        <ServiceNotice message={products.error} />
      ) : (
        <Panel
          title={query ? `Results for “${query}”` : "Products"}
          description={`${products.data.total} product${products.data.total === 1 ? "" : "s"}`}
          action={<ProductSearch q={query} />}
        >
          <ProductsTable items={products.data.items} locations={locs} />
        </Panel>
      )}
    </>
  )
}
