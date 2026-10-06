import { getSuppliers } from "@/lib/purchases/data"
import { PageHeader } from "@/components/layout/page-header"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { NewSupplierSheet, SuppliersTable } from "@/components/purchases/suppliers-panel"

export const metadata = { title: "Suppliers" }

export default async function SuppliersPage() {
  const suppliers = await getSuppliers()

  return (
    <div className="grid gap-6 *:min-w-0">
      <PageHeader
        title="Suppliers"
        description="Who you buy from, and their tax identity."
        action={<NewSupplierSheet />}
      />

      {!suppliers.ok ? (
        <ServiceNotice message={suppliers.error} />
      ) : (
        <Panel
          title="Suppliers"
          description={`${suppliers.data.total} supplier${suppliers.data.total === 1 ? "" : "s"}`}
        >
          <SuppliersTable items={suppliers.data.items} />
        </Panel>
      )}
    </div>
  )
}
