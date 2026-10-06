import { getLocations } from "@/lib/inventory/data"
import { PageHeader } from "@/components/layout/page-header"
import { LocationsList, NewLocationForm } from "@/components/inventory/locations-panel"
import { Panel, ServiceNotice } from "@/components/inventory/primitives"

export const metadata = { title: "Locations" }

export default async function LocationsPage() {
  const locations = await getLocations()

  return (
    <>
      <PageHeader
        title="Locations"
        description="Warehouses, stores, shelves and bins. Nest them as deep as you need; stock is tracked per variant per location."
      />

      {!locations.ok ? (
        <ServiceNotice message={locations.error} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel title="Your locations" description="Movements default to the starred location when none is chosen.">
            <LocationsList locations={locations.data} />
          </Panel>
          <Panel title="New location" description="A second warehouse, a zone inside one, or a shelf.">
            <NewLocationForm locations={locations.data} />
          </Panel>
        </div>
      )}
    </>
  )
}
