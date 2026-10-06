"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export interface SectionNavItem {
  href: string
  label: string
  /**
   * "prefix" keeps the tab active on nested routes (a detail page), "exact"
   * only on the route itself. Defaults to "exact".
   */
  match?: "exact" | "prefix"
}

/**
 * Section switcher under a page header, as the inventory section has. Sibling
 * tabs are matched most-specific-first, so a "prefix" tab does not stay lit
 * while one of its own children is open.
 */
export function SectionNav({ items }: { items: SectionNavItem[] }) {
  const pathname = usePathname()

  const isActive = (item: SectionNavItem) => {
    const others = items.filter((o) => o.href !== item.href)
    if (item.match === "prefix") {
      const deeper = others.some(
        (o) => o.href.startsWith(item.href) && pathname.startsWith(o.href)
      )
      return !deeper && (pathname === item.href || pathname.startsWith(`${item.href}/`))
    }
    return pathname === item.href
  }

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
            isActive(item)
              ? "bg-secondary font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
