"use client"

import { useMemo, useState, useTransition } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { saveRoleAction } from "@/lib/team/actions"
import type { Permission, TeamRoleDetail } from "@/lib/team/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import { FormAlert } from "@/components/inventory/primitives"

function groupByResource(catalogue: Permission[]) {
  const groups = new Map<string, Permission[]>()
  for (const permission of catalogue) {
    const group = groups.get(permission.resource) ?? []
    group.push(permission)
    groups.set(permission.resource, group)
  }
  return [...groups.entries()]
}

/**
 * Creates a role, or edits one that exists.
 *
 * Name and permissions are separate routes on the service — a preset's name is
 * fixed while what it grants is not — so only the parts that actually changed
 * are sent, and editing a preset's permissions never trips the rename refusal.
 */
export function RoleSheet({
  role,
  catalogue,
  trigger,
}: {
  role?: TeamRoleDetail
  catalogue: Permission[]
  /** `render` takes an element to become the trigger, not arbitrary nodes. */
  trigger?: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | undefined>()

  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [granted, setGranted] = useState<Set<string>>(
    () => new Set(role?.permissions ?? [])
  )

  const groups = useMemo(() => groupByResource(catalogue), [catalogue])
  const renameable = !role?.is_system
  const editable = !role?.locked

  /** Reset to the saved role each time it opens, so a cancel really cancels. */
  function onOpenChange(next: boolean) {
    if (next) {
      setName(role?.name ?? "")
      setDescription(role?.description ?? "")
      setGranted(new Set(role?.permissions ?? []))
      setError(undefined)
    }
    setOpen(next)
  }

  function toggle(permission: string, checked: boolean) {
    setGranted((current) => {
      const next = new Set(current)
      if (checked) next.add(permission)
      else next.delete(permission)
      return next
    })
  }

  function save() {
    setError(undefined)
    startTransition(async () => {
      const result = await saveRoleAction({
        id: role?.id,
        name: renameable ? name : undefined,
        description: renameable ? description : undefined,
        permissions: editable ? [...granted] : undefined,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      if (result?.success) toast.success(result.success)
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger
        render={
          trigger ?? (
            <Button className="rounded-full px-4">
              <PlusIcon className="size-4" />
              New role
            </Button>
          )
        }
      />
      <SheetContent className="flex w-full flex-col sm:max-w-lg!">
        <SheetHeader>
          <SheetTitle>{role ? `Edit ${role.name}` : "New role"}</SheetTitle>
          <SheetDescription>
            {role?.locked
              ? "This role always has full access. Its permissions cannot be changed."
              : "Tick what this role can do. People holding it pick up the change on their next page load."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          <FormAlert state={error ? { error } : undefined} />

          <div className="grid gap-2">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending || !renameable}
              maxLength={32}
              placeholder="packer"
            />
            {renameable ? (
              <p className="text-xs text-muted-foreground">
                Lower case, letters and numbers. It shows on the member list.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Built-in roles keep their names: the other services recognise
                them by name.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={pending || !renameable}
              rows={2}
              maxLength={200}
              className="resize-none"
              placeholder="What someone in this role does"
            />
          </div>

          <div className="space-y-4">
            <Label>Permissions</Label>
            {groups.map(([resource, permissions]) => (
              <div key={resource} className="rounded-xl border border-border/70 p-4">
                <p className="mb-3 text-sm font-medium">{resource}</p>
                <div className="space-y-3">
                  {permissions.map((permission) => (
                    <label
                      key={permission.name}
                      className={cn(
                        "flex cursor-pointer items-start gap-3",
                        !editable && "cursor-default opacity-70"
                      )}
                    >
                      <Checkbox
                        checked={granted.has(permission.name)}
                        disabled={pending || !editable}
                        onCheckedChange={(checked) =>
                          toggle(permission.name, checked === true)
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm">{permission.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {permission.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={save}
            disabled={pending || (!renameable && !editable)}
            className="rounded-full"
          >
            {pending ? "Saving…" : role ? "Save role" : "Create role"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
