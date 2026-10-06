"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const deriveKey = (n: string) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

/** Name / description / auto-derived key — shared by the product-type and variant-type sheets. */
export function TypeNameFields({
  idPrefix,
  editing,
  existingKey,
  description,
  name,
  setName,
  keyValue,
  setKey,
  keyTouched,
  setKeyTouched,
  disabled,
  namePlaceholder,
}: {
  idPrefix: string
  editing: boolean
  existingKey?: string
  description: string
  name: string
  setName: (v: string) => void
  keyValue: string
  setKey: (v: string) => void
  keyTouched: boolean
  setKeyTouched: (v: boolean) => void
  disabled?: boolean
  namePlaceholder: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
      <div className="grid content-start gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!keyTouched) setKey(deriveKey(e.target.value))
          }}
          required
          placeholder={namePlaceholder}
          maxLength={120}
          disabled={disabled}
          autoFocus={!editing}
        />
      </div>
      <div className="grid content-start gap-2">
        <Label htmlFor={`${idPrefix}-desc`}>Description</Label>
        <Input id={`${idPrefix}-desc`} name="description" defaultValue={description} maxLength={200} disabled={disabled} placeholder="Optional" />
      </div>
      <div className="sm:col-span-2">
        {editing ? (
          <p className="text-xs text-muted-foreground">
            Key: <span className="font-mono">{existingKey}</span>
          </p>
        ) : keyTouched ? (
          <div className="grid grid-cols-[auto_minmax(0,16rem)] items-center gap-2 text-xs text-muted-foreground">
            <span>Key</span>
            <Input
              name="key"
              value={keyValue}
              onChange={(e) => setKey(e.target.value)}
              required
              maxLength={64}
              disabled={disabled}
              aria-label="Key"
              className="h-7 font-mono text-xs"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Key: <span className="font-mono">{keyValue || "—"}</span>
            {" · "}
            <button type="button" className="underline-offset-4 hover:underline" onClick={() => setKeyTouched(true)}>
              edit
            </button>
            <input type="hidden" name="key" value={keyValue} />
          </p>
        )}
      </div>
    </div>
  )
}

export function Chips({ items, tone }: { items: string[]; tone: "product" | "variant" | "size" }) {
  if (!items.length) return null
  const cls =
    tone === "size"
      ? "bg-brand-soft text-brand"
      : tone === "variant"
        ? "bg-amber-500/12 text-amber-700 dark:text-amber-400"
        : "bg-secondary text-foreground"
  return (
    <div className="flex flex-wrap items-start gap-1">
      {items.slice(0, 8).map((l) => (
        <span key={l} className={`rounded-md px-1.5 py-0.5 text-xs ${cls}`}>
          {l}
        </span>
      ))}
      {items.length > 8 ? <span className="px-1 text-xs text-muted-foreground">+{items.length - 8}</span> : null}
    </div>
  )
}
