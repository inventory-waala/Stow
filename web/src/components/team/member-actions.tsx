"use client"

import { useTransition } from "react"
import { CheckIcon, EllipsisVerticalIcon } from "lucide-react"
import { toast } from "sonner"

import {
  changeMemberRoleAction,
  leaveWorkspaceAction,
  removeMemberAction,
} from "@/lib/team/actions"
import type { TeamMember, TeamRoleDetail } from "@/lib/team/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Per-member menu: pick a role, or take them out of the workspace.
 *
 * The roles are listed flat rather than behind a submenu — there are four of
 * them, and a workspace that adds more still ends up with a short list.
 *
 * Every guard here is enforced by auth-service too; withholding an option
 * just avoids offering something that would come back as an error. The last
 * owner is the one case the server knows about and the client cannot: it
 * depends on how many other owners there are, so that one arrives as a
 * message rather than a disabled item.
 */
export function MemberActions({
  member,
  roles,
  isSelf,
}: {
  member: TeamMember
  roles: TeamRoleDetail[]
  isSelf: boolean
}) {
  const [pending, startTransition] = useTransition()
  const currentRoleId = member.roles[0]?.id

  function run(action: () => Promise<{ error?: string; success?: string } | undefined>) {
    startTransition(async () => {
      const result = await action()
      if (result?.error) toast.error(result.error)
      else if (result?.success) toast.success(result.success)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            className="size-8 rounded-lg"
            aria-label={`Manage ${member.name?.trim() || member.email}`}
          />
        }
      >
        <EllipsisVerticalIcon className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-xl">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Role
          </DropdownMenuLabel>
          {roles.map((role) => (
            <DropdownMenuItem
              key={role.id}
              className="gap-2.5 rounded-lg capitalize"
              onClick={() => {
                if (role.id === currentRoleId) return
                run(() => changeMemberRoleAction(member.user_id, role.id))
              }}
            >
              {role.name}
              {role.id === currentRoleId ? (
                <CheckIcon className="ml-auto size-4 text-brand" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {isSelf ? (
          <DropdownMenuItem
            className="rounded-lg text-destructive"
            onClick={() => run(() => leaveWorkspaceAction())}
          >
            Leave workspace
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="rounded-lg text-destructive"
            onClick={() => run(() => removeMemberAction(member.user_id))}
          >
            Remove from workspace
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
