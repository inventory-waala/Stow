import { SectionNav } from "@/components/layout/section-nav"

export default function OrdersLayout({ children }: LayoutProps<"/orders">) {
  return (
    <div className="grid gap-6 *:min-w-0">
      {/* Customers sits outside this route, so the tab points away from the
          section; it is still where you go next from an order. */}
      <SectionNav
        items={[
          { href: "/orders", label: "Orders", match: "prefix" },
          { href: "/customers", label: "Customers" },
        ]}
      />
      {children}
    </div>
  )
}
