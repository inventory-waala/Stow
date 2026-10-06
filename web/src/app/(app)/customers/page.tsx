import { getCustomers } from "@/lib/orders/data"
import { PageHeader } from "@/components/layout/page-header"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { CustomersTable, NewCustomerSheet } from "@/components/orders/customers-panel"

export const metadata = { title: "Customers" }

export default async function CustomersPage() {
  const customers = await getCustomers()

  return (
    <div className="grid gap-6 *:min-w-0">
      <PageHeader
        title="Customers"
        description="Who you sell to, and their tax identity."
        action={<NewCustomerSheet />}
      />

      {!customers.ok ? (
        <ServiceNotice message={customers.error} />
      ) : (
        <Panel
          title="Customers"
          description={`${customers.data.total} customer${customers.data.total === 1 ? "" : "s"}`}
        >
          <CustomersTable items={customers.data.items} />
        </Panel>
      )}
    </div>
  )
}
