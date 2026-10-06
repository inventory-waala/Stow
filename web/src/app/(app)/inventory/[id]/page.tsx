import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import {
  getLocations,
  getMovements,
  getProduct,
  getVariantTypes,
} from "@/lib/inventory/data"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { MovementsTable } from "@/components/inventory/movements-table"
import { ProductEditForm } from "@/components/inventory/product-edit-form"
import { StatusPill } from "@/components/inventory/products-table"
import { Panel, ServiceNotice, fmtQty } from "@/components/inventory/primitives"
import { VariantsPanel } from "@/components/inventory/variants-panel"

export async function generateMetadata({ params }: PageProps<"/inventory/[id]">) {
  const { id } = await params
  const product = await getProduct(id)
  return { title: product.ok ? product.data.name : "Product" }
}

export default async function ProductPage({ params }: PageProps<"/inventory/[id]">) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product.ok) {
    if (/not found/i.test(product.error)) notFound()
    return <ServiceNotice message={product.error} />
  }
  const p = product.data

  const [variantTypes, locations, movements] = await Promise.all([
    getVariantTypes(),
    getLocations(),
    getMovements({ product: p.id, limit: 30 }),
  ])

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.name}
            <StatusPill status={p.status} />
          </span>
        }
        description={
          <>
            {p.code ? <span className="font-mono">{p.code} · </span> : null}
            {fmtQty(p.stock.quantity)} on hand, {fmtQty(p.stock.available)} available
          </>
        }
        action={
          <Button variant="outline" className="rounded-full" nativeButton={false} render={<Link href="/inventory" />}>
            <ArrowLeftIcon className="size-4" strokeWidth={1.75} />
            All products
          </Button>
        }
      />

      <Panel title="Variants" description="Each variant lists what it comes in; prices and stock are tracked per line.">
        <VariantsPanel product={p} variantTypes={variantTypes.ok ? variantTypes.data : []} locations={locations.ok ? locations.data : []} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Recent activity" description="Latest stock movements for this product.">
          {!movements.ok ? (
            <ServiceNotice message={movements.error} />
          ) : (
            <MovementsTable items={movements.data.items} showProduct={false} />
          )}
        </Panel>
        <Panel title="Details" description="Name, code, tags and any properties you want to record.">
          <ProductEditForm product={p} />
        </Panel>
      </div>
    </>
  )
}
