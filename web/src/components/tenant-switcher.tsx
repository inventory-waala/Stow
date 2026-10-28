"use client"

import Link from "next/link"
import { useTransition } from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { switchTenantAction } from "@/lib/auth/actions"
import { useDismissSidebar } from "@/hooks/use-dismiss-sidebar"
import type { Tenant } from "@/lib/auth/auth-service"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

function Tile({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand",
        className
      )}
    >
      {initials(name) || "?"}
    </span>
  )
}

export function TenantSwitcher({
  tenants,
  activeTenantId,
}: {
  tenants: Tenant[]
  activeTenantId: string | null
}) {
  const { isMobile } = useSidebar()
  const dismiss = useDismissSidebar()
  const [pending, startTransition] = useTransition()
  const active = tenants.find((t) => t.id === activeTenantId)

  function select(tenantId: string) {
    if (tenantId === activeTenantId) return
    dismiss()
    startTransition(async () => {
      const result = await switchTenantAction(tenantId)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                disabled={pending}
                className="rounded-xl border border-border/70 bg-card px-2 shadow-ambient aria-expanded:bg-secondary/60 hover:bg-secondary/60"
              />
            }
          >
            <Tile name={active?.name ?? ""} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {active?.name ?? "No workspace"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {pending
                  ? "Switching..."
                  : `${tenants.length} workspace${tenants.length === 1 ? "" : "s"}`}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60 rounded-xl"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={8}
          >
            {/* Base UI: a menu label is a *group* label and must live inside a group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Workspaces
              </DropdownMenuLabel>
              {tenants.map((tenant) => (
                <DropdownMenuItem
                  key={tenant.id}
                  onClick={() => select(tenant.id)}
                  className="gap-2.5 rounded-lg"
                >
                  <Tile name={tenant.name} className="size-6 rounded-md text-[10px]" />
                  <span className="truncate">{tenant.name}</span>
                  {tenant.id === activeTenantId ? (
                    <CheckIcon className="ml-auto size-4 text-brand" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              nativeButton={false}
              onClick={dismiss}
              render={<Link href="/workspace/new" />}
              className="gap-2.5 rounded-lg text-muted-foreground"
            >
              <span className="flex size-6 items-center justify-center rounded-md border border-dashed">
                <PlusIcon className="size-3.5" />
              </span>
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
