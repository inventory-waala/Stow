"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { CircleAlertIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"

import { updateTenantAction } from "@/lib/auth/actions"
import type { Tenant } from "@/lib/auth/auth-service"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/**
 * Renames or re-describes the workspace. The server takes the workspace from
 * the token, so there is no id to post and no way to aim this at another one.
 *
 * On success the dialog closes and the page behind it has already been
 * revalidated, so the new name is visible straight away; the toast is there
 * because the change is otherwise easy to miss.
 */
export function EditWorkspaceDialog({ tenant }: { tenant: Tenant }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(updateTenantAction, undefined)
  // useActionState keeps the last result, so a reopened dialog would close
  // again on a stale success. Only react to one we have not seen.
  const handled = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!state?.success || state.success === handled.current) return
    handled.current = state.success
    setOpen(false)
    toast.success(state.success)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="rounded-full">
            <PencilIcon className="size-3.5" />
            Edit details
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>
            The name appears in the workspace switcher and on your invoices.
          </DialogDescription>
        </DialogHeader>

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

          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Company name</Label>
            <Input
              id="workspace-name"
              name="name"
              defaultValue={tenant.name}
              required
              maxLength={100}
              disabled={pending}
              autoFocus
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
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending} className="rounded-full px-6">
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
