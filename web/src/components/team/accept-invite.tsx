"use client"

import { useActionState, useTransition } from "react"
import { toast } from "sonner"

import {
  acceptInviteAction,
  acceptInviteWithRegistrationAction,
} from "@/lib/team/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FormAlert } from "@/components/inventory/primitives"

/** Accepting as the signed-in user: one button, the token does the rest. */
export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      disabled={pending}
      className="w-full rounded-full"
      onClick={() =>
        startTransition(async () => {
          const result = await acceptInviteAction(token)
          if (result?.error) toast.error(result.error)
        })
      }
    >
      {pending ? "Joining…" : "Accept invitation"}
    </Button>
  )
}

/**
 * Accepting by creating the account the invitation was sent to.
 *
 * The email is fixed and shown rather than typed: it is what the token was
 * issued against, so an editable field could only ever be wrong.
 */
export function AcceptInviteForm({
  token,
  email,
}: {
  token: string
  email: string
}) {
  const [state, action, pending] = useActionState(
    acceptInviteWithRegistrationAction,
    undefined
  )

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <FormAlert state={state} />

      <div className="grid gap-2">
        <Label htmlFor="invite-account-email">Email</Label>
        <Input id="invite-account-email" value={email} disabled readOnly />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="invite-name">Your name</Label>
        <Input
          id="invite-name"
          name="name"
          required
          autoFocus
          maxLength={100}
          disabled={pending}
          aria-invalid={state?.field === "name" || undefined}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="invite-password">Password</Label>
        <Input
          id="invite-password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={64}
          disabled={pending}
          aria-invalid={state?.field === "password" || undefined}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="w-full rounded-full"
      >
        {pending ? "Creating account…" : "Join the workspace"}
      </Button>
    </form>
  )
}
