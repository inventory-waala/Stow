"use client"

import * as React from "react"
import {
  ArchiveIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  Settings2Icon,
  TruckIcon,
  UsersIcon,
} from "lucide-react"

import type { Tenant } from "@/lib/auth/auth-service"
import { Logo } from "@/components/brand/logo"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser, type NavUserData } from "@/components/nav-user"
import { TenantSwitcher } from "@/components/tenant-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"

// Route map carried over from the previous app. Buy side (Purchases,
// Suppliers) then sell side (Orders, Customers); Team and Reports are still
// placeholders waiting on their services.
const navMain = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Inventory", url: "/inventory", icon: ArchiveIcon },
  { title: "Purchases", url: "/purchases", icon: ClipboardListIcon },
  { title: "Suppliers", url: "/suppliers", icon: TruckIcon },
  { title: "Orders", url: "/orders", icon: ReceiptIcon },
  { title: "Customers", url: "/customers", icon: BriefcaseIcon },
  { title: "Team", url: "/team", icon: UsersIcon },
  { title: "Reports", url: "/reports", icon: ChartBarIcon },
]

const navSecondary = [
  { title: "Settings", url: "/settings", icon: Settings2Icon },
  { title: "Get help", url: "mailto:help@stow.app", icon: CircleHelpIcon },
]

export function AppSidebar({
  user,
  tenants,
  activeTenantId,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: NavUserData
  tenants: Tenant[]
  activeTenantId: string | null
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-3 px-3 pt-4 pb-3">
        <Logo href="/dashboard" className="px-1" />
        <TenantSwitcher tenants={tenants} activeTenantId={activeTenantId} />
      </SidebarHeader>
      <SidebarContent className="px-1">
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="px-3 pb-3">
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
