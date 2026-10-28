"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

/** Section switcher under the Team page header. */
export function TeamSubNav() {
  const pathname = usePathname()
  const items = [
    { href: "/team", label: "Members" },
    { href: "/team/roles", label: "Roles" },
  ]

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
