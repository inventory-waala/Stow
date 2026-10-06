"use client"

import { useState } from "react"
import { Code2Icon, PlusIcon, Trash2Icon } from "lucide-react"

import type { Json } from "@/lib/inventory/types"
import { schemaToFields, type FieldDef } from "@/lib/inventory/schema-builder"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SelectField } from "./select-field"

/** One DOM id per field; shared by the <Label htmlFor> and the input. */
const fieldId = (group: string, key: string) => `${group}-${key}`.replace(/[^a-z0-9_-]/gi, "-")

function FieldInput({
  id,
  name,
  field,
  value,
  disabled,
  compact,
}: {
  id: string
  name: string
  field: FieldDef
  value: unknown
  disabled?: boolean
  compact?: boolean
}) {
  const str = value === undefined || value === null ? "" : String(value)
  const cls = compact ? "h-8" : undefined
  switch (field.type) {
    case "boolean":
      return (
        <label className="flex h-8 items-center gap-2 text-sm">
          <Checkbox name={name} defaultChecked={value === true} disabled={disabled} />
          {compact ? field.label : "Yes"}
        </label>
      )
    case "select":
      return (
        <SelectField
          id={id}
          name={name}
          defaultValue={str || undefined}
          placeholder={compact ? field.label : "Choose…"}
          disabled={disabled}
          aria-label={compact ? field.label : undefined}
          options={field.options.map((o) => ({ value: o, label: o }))}
        />
      )
    case "number":
    case "integer": {
      const range =
        field.min !== undefined && field.max !== undefined
          ? `${field.min} – ${field.max}`
          : field.min !== undefined
            ? `≥ ${field.min}`
            : field.max !== undefined
              ? `≤ ${field.max}`
              : ""
      return (
        <Input
          id={id}
          name={name}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? (field.type === "integer" ? 1 : "any")}
          defaultValue={str}
          disabled={disabled}
          required={field.required}
          placeholder={compact ? [field.label, range].filter(Boolean).join(" ") : range || undefined}
          className={cls}
        />
      )
    }
    case "date":
      return <Input id={id} name={name} type="date" defaultValue={str} disabled={disabled} required={field.required} className={cls} />
    case "url":
      return <Input id={id} name={name} type="url" defaultValue={str} disabled={disabled} required={field.required} placeholder={compact ? field.label : "https://"} className={cls} />
    case "email":
      return <Input id={id} name={name} type="email" defaultValue={str} disabled={disabled} required={field.required} placeholder={compact ? field.label : undefined} className={cls} />
    case "longtext":
      return <Textarea id={id} name={name} rows={compact ? 2 : 3} defaultValue={str} disabled={disabled} required={field.required} placeholder={compact ? field.label : undefined} className="resize-none sm:col-span-2" />
    default:
      return <Input id={id} name={name} defaultValue={str} disabled={disabled} required={field.required} placeholder={compact ? field.label : undefined} className={cls} />
  }
}

type SchemaFieldsProps = {
  name: string
  schema: Json | undefined | null
  value?: Json
  disabled?: boolean
  /** Inline layout for variant rows: placeholders instead of labels. */
  compact?: boolean
  allowExtra?: boolean
  emptyHint?: string
  /** Keys rendered elsewhere (e.g. the size axis posted as a hidden input). */
  omit?: string[]
}

/**
 * Renders inputs for a JSON-object column from a type's schema. Posts
 * `<name>[key]` per typed field, `<name>_kv[i][key|value]` for extra
 * free-form fields, or `<name>_json` when the advanced editor is open.
 *
 * The inputs are uncontrolled (`defaultValue`), so when the saved `value`
 * changes underneath them — a product re-rendered after its own save — the
 * whole thing remounts instead of trying to change a default in place.
 */
export function SchemaFields(props: SchemaFieldsProps) {
  return <SchemaFieldsInner key={JSON.stringify(props.value ?? null)} {...props} />
}

function SchemaFieldsInner({
  name,
  schema,
  value,
  disabled,
  compact = false,
  allowExtra = true,
  emptyHint,
  omit,
}: {
  name: string
  schema: Json | undefined | null
  value?: Json
  disabled?: boolean
  /** Inline layout for variant rows: placeholders instead of labels. */
  compact?: boolean
  allowExtra?: boolean
  emptyHint?: string
  /** Keys rendered elsewhere (e.g. the size axis posted as a hidden input). */
  omit?: string[]
}) {
  const fields = schemaToFields(schema).filter((f) => !omit?.includes(f.key))
  const known = new Set(fields.map((f) => f.key))
  const extras = Object.entries(value ?? {}).filter(([k]) => !known.has(k))
  const [advanced, setAdvanced] = useState(false)
  const [kv, setKv] = useState<number[]>(() => extras.map((_, i) => i))
  const [next, setNext] = useState(extras.length)

  // Nothing to show and nothing to add: render nothing rather than a lone JSON link.
  if (!fields.length && !allowExtra && !emptyHint && !advanced) return null

  if (advanced) {
    return (
      <div className="grid gap-2">
        <Textarea
          name={`${name}_json`}
          rows={compact ? 2 : 5}
          defaultValue={JSON.stringify(value ?? {}, null, compact ? 0 : 2)}
          disabled={disabled}
          className="font-mono text-xs"
          aria-label="JSON"
        />
        <button type="button" onClick={() => setAdvanced(false)} className="justify-self-start text-xs text-muted-foreground underline-offset-4 hover:underline">
          Back to fields
        </button>
      </div>
    )
  }

  return (
    <div className={compact ? "grid gap-2" : "grid gap-4"}>
      {fields.length ? (
        <div className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2"}>
          {fields.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              {!compact ? (
                <Label htmlFor={fieldId(name, f.key)}>
                  {f.label}
                  {f.required ? <span className="text-destructive"> *</span> : null}
                </Label>
              ) : null}
              <FieldInput id={fieldId(name, f.key)} name={`${name}[${f.key}]`} field={f} value={value?.[f.key]} disabled={disabled} compact={compact} />
            </div>
          ))}
        </div>
      ) : emptyHint && !kv.length ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : null}

      {allowExtra
        ? kv.map((id, i) => {
            const [k, v] = extras[i] ?? ["", ""]
            return (
              <div key={id} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                <Input name={`${name}_kv[${id}][key]`} defaultValue={k} placeholder="Field name" disabled={disabled} aria-label="Field name" className="h-8" />
                <Input name={`${name}_kv[${id}][value]`} defaultValue={typeof v === "string" ? v : JSON.stringify(v)} placeholder="Value" disabled={disabled} aria-label="Field value" className="h-8" />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove field" disabled={disabled} onClick={() => setKv((r) => r.filter((x) => x !== id))}>
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            )
          })
        : null}

      <div className="flex items-center gap-3">
        {allowExtra ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setKv((r) => [...r, next])
              setNext((n) => n + 1)
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            <PlusIcon className="size-3" /> Add a custom field
          </button>
        ) : null}
        <button type="button" disabled={disabled} onClick={() => setAdvanced(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline">
          <Code2Icon className="size-3" /> Edit as JSON
        </button>
      </div>
    </div>
  )
}
