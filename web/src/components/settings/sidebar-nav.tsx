"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export function SidebarNav({
  className,
  items,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  items: { href: string; title: string }[]
}) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        "-mx-1 flex gap-1 overflow-x-auto px-1 lg:-ml-3 lg:mr-0 lg:flex-col lg:px-0",
        className
      )}
      {...props}
    >
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-sm transition-colors duration-200 lg:rounded-lg lg:px-3",
              active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
