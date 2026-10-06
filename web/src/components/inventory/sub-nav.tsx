"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

/** Section switcher under the Inventory page header. */
export function InventorySubNav() {
  const pathname = usePathname()
  const items = [
    { href: "/inventory", label: "Products", exact: false },
    { href: "/inventory/activity", label: "Activity", exact: true },
    { href: "/inventory/variant-types", label: "Variant types", exact: true },
    { href: "/inventory/locations", label: "Locations", exact: true },
  ]
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto">
      {items.map((it) => {
        const active =
          it.href === "/inventory"
            ? pathname === "/inventory" ||
              (pathname.startsWith("/inventory/") &&
                !items.slice(1).some((o) => pathname.startsWith(o.href)))
            : pathname === it.href
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}

