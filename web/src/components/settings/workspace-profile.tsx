import Link from "next/link"
import {
  ArrowUpRightIcon,
  Building2Icon,
  FingerprintIcon,
  ShieldCheckIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import type { Profile, Tenant } from "@/lib/auth/auth-service"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function Detail({
  icon: Icon,
  label,
  hint,
  className,
  children,
}: {
  icon: LucideIcon
  label: string
  hint: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("rounded-2xl bg-card p-5", className)}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon className="size-4" strokeWidth={1.5} />
        </span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

/** Workspace overview: a tinted tray holding the header and detail cards. */
export function WorkspaceProfile({
  tenant,
  user,
  tenantCount,
  editAction,
}: {
  tenant: Tenant
  user: Profile
  tenantCount: number
  /** Rendered beside "New workspace"; omitted when the caller may not edit. */
  editAction?: React.ReactNode
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-secondary/50 p-1.5">
      <div className="hero-wash rounded-[1.125rem] bg-card px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current workspace</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">{tenant.name}</h2>
            <p className="mt-2 max-w-[50ch] text-muted-foreground">
              {tenant.description || "No description yet."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="rounded-md bg-brand-soft text-brand hover:bg-brand-soft">
              Active
            </Badge>
            {user.roles[0] ? (
              <Badge variant="secondary" className="rounded-md">
                {user.roles[0]}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-1.5 p-1.5 pt-1.5 md:grid-cols-3">
        <Detail icon={FingerprintIcon} label="Workspace ID" hint="Tenant identifier">
          <p className="font-mono text-xs break-all text-muted-foreground tabular">{tenant.id}</p>
        </Detail>

        <Detail icon={UsersIcon} label="Your roles" hint="In this workspace">
          <div className="flex flex-wrap gap-1">
            {user.roles.length ? (
              user.roles.map((r) => (
                <Badge key={r} variant="secondary" className="rounded-md">
                  {r}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No roles assigned</p>
            )}
          </div>
        </Detail>

        <Detail icon={Building2Icon} label="Workspaces" hint="You belong to">
          <p className="font-mono text-2xl font-medium tracking-tight tabular">
            {tenantCount}
          </p>
        </Detail>

        <Detail
          icon={ShieldCheckIcon}
          label="Permissions"
          hint="Granted by your roles"
          className="md:col-span-3"
        >
          <div className="flex flex-wrap gap-1">
            {user.permissions.length ? (
              user.permissions.map((p) => (
                <Badge key={p} variant="outline" className="rounded-md font-mono text-xs">
                  {p}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No explicit permissions</p>
            )}
          </div>
        </Detail>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 p-3 pt-1.5">
        {editAction}
        <Button
          variant="outline"
          className="group rounded-full pr-1.5"
          nativeButton={false} render={<Link href="/workspace/new" />}
        >
          New workspace
          <span className="ml-2 flex size-7 items-center justify-center rounded-full bg-secondary transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px">
            <ArrowUpRightIcon className="size-3.5" />
          </span>
        </Button>
      </div>
    </div>
  )
}
