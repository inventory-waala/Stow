import { SectionNav } from "@/components/layout/section-nav"

export default function PurchasesLayout({ children }: LayoutProps<"/purchases">) {
  return (
    // The (app) layout adds no vertical rhythm, so each section supplies its
    // own. `*:min-w-0` stops a wide table stretching the grid instead of
    // scrolling inside its panel.
    <div className="grid gap-6 *:min-w-0">
      {/* Suppliers sits outside this route, so the tab points away from the
          section; it is still where you go next from a purchase order. */}
      <SectionNav
        items={[
          { href: "/purchases", label: "Purchase orders", match: "prefix" },
          { href: "/suppliers", label: "Suppliers" },
        ]}
      />
      {children}
    </div>
  )
}
