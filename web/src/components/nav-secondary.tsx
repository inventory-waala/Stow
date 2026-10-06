"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: { title: string; url: string; icon: LucideIcon }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const external = !item.url.startsWith("/")
            const active = !external && pathname.startsWith(item.url)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={active}
                  className="h-9 rounded-lg px-2.5 text-muted-foreground transition-colors duration-200 data-active:text-sidebar-accent-foreground"
                  render={external ? <a href={item.url} /> : <Link href={item.url} />}
                >
                  <item.icon strokeWidth={1.5} />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
