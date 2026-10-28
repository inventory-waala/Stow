"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useDismissSidebar } from "@/hooks/use-dismiss-sidebar"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: { title: string; url: string; icon: LucideIcon }[]
}) {
  const pathname = usePathname()
  const dismiss = useDismissSidebar()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const active =
              pathname === item.url || pathname.startsWith(`${item.url}/`)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={active}
                  className="h-9 rounded-lg px-2.5 transition-colors duration-200"
                  onClick={dismiss}
                  render={<Link href={item.url} />}
                >
                  <item.icon
                    strokeWidth={active ? 2 : 1.5}
                    className={cn(active ? "text-brand" : "text-muted-foreground")}
                  />
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
