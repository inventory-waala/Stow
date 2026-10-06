"use client"

import Link from "next/link"
import { useActionState } from "react"
import { CircleAlertIcon } from "lucide-react"

import { createTenantAction } from "@/lib/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function WorkspaceForm() {
  const [state, action, pending] = useActionState(createTenantAction, undefined)

  return (
    <div className="mx-auto max-w-xl py-6 lg:py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Create a workspace
        </h1>
        <p className="mt-3 max-w-[50ch] text-muted-foreground">
          One workspace per company. You become its owner and can invite the team
          afterwards.
        </p>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-secondary/50 p-1.5">
        <form action={action} className="space-y-6 rounded-[1.125rem] bg-card p-6 sm:p-8">
          {state?.error ? (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <CircleAlertIcon className="size-4" />
              {state.error}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="name">Company name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Larkspur Home"
              required
              maxLength={100}
              disabled={pending}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What this company sells and where"
              className="resize-none"
              rows={3}
              maxLength={500}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">Shown on the workspace page.</p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <Link
              href="/settings/workspace"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Back
            </Link>
            <Button
              type="submit"
              disabled={pending}
              className="rounded-full px-6 transition-transform duration-300 ease-spring active:scale-[0.98]"
            >
              {pending ? "Creating..." : "Create workspace"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
