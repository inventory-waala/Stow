import type { TeamMember } from "@/lib/team/types"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyRow } from "@/components/inventory/primitives"

/**
 * Only the statuses worth interrupting the row for. An active, verified member
 * gets no badge at all -- a column reading "Active" all the way down says
 * nothing.
 */
const STATUS: Record<string, { label: string; className: string }> = {
  PENDING_VERIFICATION: {
    label: "Unverified",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-destructive/10 text-destructive",
  },
  INACTIVE: {
    label: "Inactive",
    className: "bg-secondary text-muted-foreground",
  },
}

function initials(name: string | null, email: string) {
  const source = name?.trim() || email
  return (
    source
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  )
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
    >
      {children}
    </span>
  )
}

export function MembersTable({
  items,
  currentUserId,
}: {
  items: TeamMember[]
  currentUserId: string
}) {
  if (!items.length) {
    return <EmptyRow>Nobody here yet.</EmptyRow>
  }

  return (
    <div className="overflow-x-auto border-t border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="pr-5 text-right">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((member) => {
            const status = STATUS[member.status]
            return (
              <TableRow key={member.user_id}>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-secondary text-xs font-medium">
                        {initials(member.name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {member.name?.trim() || member.email}
                        </span>
                        {member.user_id === currentUserId ? (
                          <Pill className="bg-brand-soft text-brand">You</Pill>
                        ) : null}
                        {status ? (
                          <Pill className={status.className}>{status.label}</Pill>
                        ) : null}
                      </div>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {member.roles.map((role) => (
                      <Pill
                        key={role.id}
                        className={cn(
                          "capitalize",
                          role.name === "owner"
                            ? "bg-brand-soft text-brand"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {role.name}
                      </Pill>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="pr-5 text-right text-sm text-muted-foreground">
                  {new Date(member.joined_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
