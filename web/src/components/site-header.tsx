"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PlusIcon } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  purchases: "Purchases",
  suppliers: "Suppliers",
  orders: "Orders",
  customers: "Customers",
  team: "Team",
  reports: "Reports",
  settings: "Settings",
  workspace: "Workspace",
  "quick-create": "Quick create",
}

function titleFromPath(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard"
  return TITLES[segment] ?? segment.replace(/-/g, " ")
}

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center border-b border-border/70 bg-background/80 backdrop-blur-md md:rounded-t-xl">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1.5 rounded-full text-muted-foreground" />
        <h1 className="text-sm font-medium">{titleFromPath(pathname)}</h1>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button
            size="sm"
            className="ml-1 h-8 rounded-full pr-3.5 pl-2.5"
            nativeButton={false}
            render={<Link href="/quick-create" />}
          >
            <PlusIcon className="size-4" strokeWidth={2} />
            New
          </Button>
        </div>
      </div>
    </header>
  )
}
