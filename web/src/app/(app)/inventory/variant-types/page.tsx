import { getVariantTypes } from "@/lib/inventory/data"
import { PageHeader } from "@/components/layout/page-header"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"
import { NewVariantTypeButton, VariantTypesList } from "@/components/inventory/variant-types-panel"

export const metadata = { title: "Variant types" }

export default async function VariantTypesPage() {
  const types = await getVariantTypes()

  return (
    <>
      <PageHeader
        title="Variant types"
        description="What a variant records, and which of its fields — size, capacity, pack, shade — splits its stock into separately priced lines."
        action={<NewVariantTypeButton />}
      />

      {!types.ok ? (
        <ServiceNotice message={types.error} />
      ) : (
        <Panel title="Your variant types" description={`${types.data.length} defined · click one to edit`}>
          <VariantTypesList types={types.data} />
        </Panel>
      )}
    </>
  )
}
