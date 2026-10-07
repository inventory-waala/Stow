"use client"

import { useActionState } from "react"
import { CheckCircle2Icon, CircleAlertIcon } from "lucide-react"

import { updateTenantAction } from "@/lib/auth/actions"
import type { Tenant } from "@/lib/auth/auth-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/**
 * Renames or re-describes the workspace in place. The server takes the
 * workspace from the token, so there is no id to post and no way to aim this
 * at a different one.
 */
export function WorkspaceDetailsForm({ tenant }: { tenant: Tenant }) {
  const [state, action, pending] = useActionState(updateTenantAction, undefined)

  return (
    <form action={action} className="space-y-5">
      {state?.error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <CircleAlertIcon className="size-4 shrink-0" />
          {state.error}
        </div>
      ) : null}
      {state?.success ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand-soft p-3 text-sm text-brand"
        >
          <CheckCircle2Icon className="size-4 shrink-0" />
          {state.success}
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="workspace-name">Company name</Label>
        <Input
          id="workspace-name"
          name="name"
          defaultValue={tenant.name}
          required
          maxLength={100}
          disabled={pending}
          aria-invalid={state?.field === "name" || undefined}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="workspace-description">Description</Label>
        <Textarea
          id="workspace-description"
          name="description"
          defaultValue={tenant.description ?? ""}
          placeholder="What this company sells and where"
          className="resize-none"
          rows={3}
          maxLength={500}
          disabled={pending}
          aria-invalid={state?.field === "description" || undefined}
        />
        <p className="text-xs text-muted-foreground">
          Shown at the top of this page.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="rounded-full px-6">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}
