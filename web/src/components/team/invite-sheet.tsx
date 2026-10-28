"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { UserPlusIcon } from "lucide-react"
import { toast } from "sonner"

import { inviteMemberAction } from "@/lib/team/actions"
import type { TeamRoleDetail } from "@/lib/team/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SelectField } from "@/components/inventory/select-field"
import { FormAlert } from "@/components/inventory/primitives"

/**
 * Sends an invitation. The role is chosen here rather than after they join,
 * so an invited person has the right access the moment they accept.
 */
export function InviteSheet({ roles }: { roles: TeamRoleDetail[] }) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const [state, action, pending] = useActionState(inviteMemberAction, undefined)
  // useActionState keeps the last result, so a reopened sheet would close
  // again on a stale success. Only react to one we have not seen.
  const handled = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!state?.success || state.success === handled.current) return
    handled.current = state.success
    setOpen(false)
    toast.success(state.success)
  }, [state])

  // Default to the least privileged role, so sending without thinking about
  // it grants the least.
  const fallback = roles[roles.length - 1]?.id ?? ""

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setSession((n) => n + 1)
        setOpen(next)
      }}
    >
      <SheetTrigger
        render={
          <Button className="rounded-full px-4">
            <UserPlusIcon className="size-4" />
            Invite member
          </Button>
        }
      />
      <SheetContent className="w-full sm:max-w-md!">
        <SheetHeader>
          <SheetTitle>Invite someone</SheetTitle>
          <SheetDescription>
            They get an email with a link that expires in 7 days. It only works
            for the address you send it to.
          </SheetDescription>
        </SheetHeader>

        <form key={session} action={action} className="space-y-5 px-4 pb-4">
          <FormAlert state={state} />

          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              placeholder="name@company.com"
              required
              autoFocus
              disabled={pending}
              aria-invalid={state?.field === "email" || undefined}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <SelectField
              id="invite-role"
              name="role_id"
              defaultValue={fallback}
              disabled={pending}
              options={roles.map((role) => ({
                value: role.id,
                label: role.name[0].toUpperCase() + role.name.slice(1),
              }))}
            />
          </div>

          <SheetFooter>
            <Button type="submit" disabled={pending} className="rounded-full">
              {pending ? "Sending…" : "Send invitation"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
