"use client"

import { useActionState } from "react"
import { StarIcon, Trash2Icon } from "lucide-react"

import { createLocationAction, deleteLocationAction } from "@/lib/inventory/actions"
import type { Location } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyRow, FormAlert } from "./primitives"
import { SelectField } from "./select-field"

export function NewLocationForm({ locations }: { locations: Location[] }) {
  const [state, action, pending] = useActionState(createLocationAction, undefined)
  return (
    <form action={action} className="grid gap-4 p-5 pt-0">
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="loc-code">Code</Label>
          <Input id="loc-code" name="code" required placeholder="WH2" maxLength={64} disabled={pending} className="font-mono" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="loc-name">Name</Label>
          <Input id="loc-name" name="name" required placeholder="Second warehouse" maxLength={120} disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="loc-parent">Inside</Label>
          <SelectField
            id="loc-parent"
            name="parent_id"
            defaultValue=""
            disabled={pending}
            options={[
              { value: "", label: "Top level" },
              ...locations.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
            ]}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="is_default" disabled={pending} />
          Make this the default location
        </label>
        <Button type="submit" disabled={pending} className="rounded-full px-6">
          {pending ? "Adding..." : "Add location"}
        </Button>
      </div>
    </form>
  )
}

function DeleteLocationButton({ location }: { location: Location }) {
  const [state, action, pending] = useActionState(async () => deleteLocationAction(location.id), undefined)
  const blocked = location.is_default || (location._count?.children ?? 0) > 0
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${location.name}`}
        title={
          state?.error ??
          (location.is_default
            ? "The default location can't be deleted"
            : blocked
              ? "Move its sub-locations first"
              : "Delete location")
        }
        disabled={blocked || pending}
        className="text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          if (!confirm(`Delete location "${location.name}"?`)) e.preventDefault()
        }}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </form>
  )
}

/** Renders the tree with indentation; depth-first from the list the API returns. */
export function LocationsList({ locations }: { locations: Location[] }) {
  if (!locations.length) return <EmptyRow>No locations yet.</EmptyRow>

  const byParent = new Map<string | null, Location[]>()
  for (const l of locations) {
    const list = byParent.get(l.parent_id) ?? []
    list.push(l)
    byParent.set(l.parent_id, list)
  }
  const rows: Array<{ loc: Location; depth: number }> = []
  const walk = (parent: string | null, depth: number) => {
    for (const l of byParent.get(parent) ?? []) {
      rows.push({ loc: l, depth })
      walk(l.id, depth + 1)
    }
  }
  walk(null, 0)
  // Orphans (parent filtered out) still show, at the root.
  for (const l of locations) if (!rows.some((r) => r.loc.id === l.id)) rows.push({ loc: l, depth: 0 })

  return (
    <div className="divide-y divide-border/70 border-t border-border/70">
      {rows.map(({ loc, depth }) => (
        <div key={loc.id} className="flex items-center gap-3 px-5 py-3" style={{ paddingLeft: `${1.25 + depth * 1.5}rem` }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-medium">{loc.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{loc.code}</span>
              {loc.is_default ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">
                  <StarIcon className="size-3" /> default
                </span>
              ) : null}
            </div>
            {loc.description ? <p className="text-xs text-muted-foreground">{loc.description}</p> : null}
          </div>
          <span className="text-xs text-muted-foreground tabular">{loc._count?.stock ?? 0} stocked</span>
          <DeleteLocationButton location={loc} />
        </div>
      ))}
    </div>
  )
}
