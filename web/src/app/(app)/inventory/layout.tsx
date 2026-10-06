import { InventorySubNav } from "@/components/inventory/sub-nav"

export default function InventoryLayout({ children }: LayoutProps<"/inventory">) {
  return (
    <div className="grid gap-6">
      <InventorySubNav />
      {children}
    </div>
  )
}
