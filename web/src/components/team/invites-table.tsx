"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { resendInviteAction, revokeInviteAction } from "@/lib/team/actions"
import type { TeamInvite } from "@/lib/team/types"
import { cn } from "@/lib/utils"
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

export function InvitesTable({
  items,
  canInvite,
}: {
  items: TeamInvite[]
  canInvite: boolean
}) {
  const [pending, startTransition] = useTransition()

  if (!items.length) {
    return <EmptyRow>No invitations waiting to be accepted.</EmptyRow>
  }

  function run(action: () => Promise<{ error?: string; success?: string } | undefined>) {
    startTransition(async () => {
      const result = await action()
      if (result?.error) toast.error(result.error)
      else if (result?.success) toast.success(result.success)
    })
  }

  return (
    <div className="overflow-x-auto border-t border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Invited</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className={cn(canInvite ? "" : "pr-5", "text-right")}>
              Expires
            </TableHead>
            {canInvite ? <TableHead className="pr-5" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((invite) => {
            const expired = new Date(invite.expires_at) < new Date()
            return (
              <TableRow key={invite.id}>
                <TableCell className="pl-5">
                  <span className="block font-medium">{invite.email}</span>
                  <span className="block text-xs text-muted-foreground">
                    Sent {new Date(invite.created_at).toLocaleDateString()}
                  </span>
                </TableCell>
                <TableCell className="capitalize">{invite.role.name}</TableCell>
                <TableCell
                  className={cn(
                    "text-right text-sm",
                    canInvite ? "" : "pr-5",
                    expired ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {expired
                    ? "Expired"
                    : new Date(invite.expires_at).toLocaleDateString()}
                </TableCell>
                {canInvite ? (
                  <TableCell className="pr-5 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      className="rounded-full"
                      onClick={() => run(() => resendInviteAction(invite.id))}
                    >
                      {/* Resending issues a new token, which is also what
                          makes the old link stop working. */}
                      {expired ? "Send again" : "Resend"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      className="rounded-full text-destructive"
                      onClick={() => run(() => revokeInviteAction(invite.id))}
                    >
                      Withdraw
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
