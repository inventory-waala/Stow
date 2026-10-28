"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { deleteRoleAction } from "@/lib/team/actions"
import type { Permission, TeamRoleDetail } from "@/lib/team/types"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyRow } from "@/components/inventory/primitives"
import { RoleSheet } from "@/components/team/role-sheet"

export function RolesTable({
  roles,
  catalogue,
  canManage,
}: {
  roles: TeamRoleDetail[]
  catalogue: Permission[]
  canManage: boolean
}) {
  const [pending, startTransition] = useTransition()

  if (!roles.length) {
    return <EmptyRow>This workspace has no roles yet.</EmptyRow>
  }

  function remove(role: TeamRoleDetail) {
    startTransition(async () => {
      const result = await deleteRoleAction(role.id)
      if (result?.error) toast.error(result.error)
      else if (result?.success) toast.success(result.success)
    })
  }

  return (
    <div className="overflow-x-auto border-t border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Role</TableHead>
            <TableHead className="text-right">Members</TableHead>
            <TableHead className="text-right">Permissions</TableHead>
            {canManage ? <TableHead className="pr-5" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="pl-5">
                <span className="block font-medium capitalize">{role.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {role.description ||
                    (role.is_system ? "Built in" : "No description")}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono tabular">
                {role.member_count ?? "—"}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {/* "Everything" rather than a count: owner is locked at the
                    whole catalogue, and a number invites comparison with a
                    total nobody has in front of them. */}
                {role.locked ? "Everything" : (role.permissions?.length ?? "—")}
              </TableCell>
              {canManage ? (
                <TableCell className="pr-5 text-right whitespace-nowrap">
                  <RoleSheet
                    role={role}
                    catalogue={catalogue}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        disabled={pending}
                      >
                        {role.locked ? "View" : "Edit"}
                      </Button>
                    }
                  />
                  {/* A preset cannot be deleted, and a role somebody holds is
                      refused by the service with a count in the message. */}
                  {role.is_system ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      className="rounded-full text-destructive"
                      onClick={() => remove(role)}
                    >
                      Delete
                    </Button>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
