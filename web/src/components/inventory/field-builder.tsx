"use client"

import { useState } from "react"
import { Code2Icon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react"

import type { Json } from "@/lib/inventory/types"
import {
  AXIS_TYPES,
  FIELD_TYPES,
  PRESETS,
  fieldsToSchema,
  isBuilderCompatible,
  schemaToFields,
  type FieldDef,
  type FieldType,
} from "@/lib/inventory/schema-builder"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SelectField } from "./select-field"

type Row = FieldDef & { id: number; keyEdited: boolean; optionsText?: string }

/** "Warranty (months)" -> "warranty_months". The key is what the API stores under. */
export const toKey = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]/, "f$&")

const COLS = "grid-cols-[minmax(0,1.6fr)_minmax(8rem,1fr)_auto_auto_auto]"

/**
 * A no-code editor for one JSON Schema. Each field is one row: name, type,
 * required, and — when `withAxis` — whether this is the field that splits
 * stock (only one may be; only text / choice fields qualify). The storage
 * key is derived from the name and only shown when the user asks for it.
 * Posts rows as `<name>_fields[i][...]`; `<name>_json` when the schema uses
 * something the builder can't express.
 */
export function FieldBuilder({
  name,
  schema,
  disabled,
  withAxis = false,
  emptyText = "No fields yet — anything will be accepted.",
}: {
  name: string
  schema?: Json
  disabled?: boolean
  withAxis?: boolean
  emptyText?: string
}) {
  const [advanced, setAdvanced] = useState(!isBuilderCompatible(schema))
  const [showKeys, setShowKeys] = useState(false)
  const [rows, setRows] = useState<Row[]>(() =>
    schemaToFields(schema).map((f, i) => ({ ...f, id: i, keyEdited: f.key !== toKey(f.label) }))
  )
  const [next, setNext] = useState(rows.length)
  const [showPresets, setShowPresets] = useState(false)
  // The JSON view is a second editor over the same state: entering it
  // serialises the current rows, leaving it parses the text back into rows.
  const [jsonText, setJsonText] = useState(() =>
    schema && Object.keys(schema).length ? JSON.stringify(schema, null, 2) : ""
  )
  const [jsonError, setJsonError] = useState<string | null>(null)

  const toJson = () => {
    const defs: FieldDef[] = rows
      .filter((r) => r.label || r.key)
      .map(({ id: _id, keyEdited: _k, optionsText: _o, ...def }) => {
        void _id
        void _k
        void _o
        return { ...def, key: def.key || toKey(def.label) }
      })
    setJsonText(defs.length ? JSON.stringify(fieldsToSchema(defs), null, 2) : "")
    setJsonError(null)
    setAdvanced(true)
  }

  const toFields = () => {
    const text = jsonText.trim()
    let parsed: unknown = {}
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch (e) {
        setJsonError(`Not valid JSON: ${(e as Error).message}`)
        return
      }
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setJsonError("The schema must be a JSON object.")
      return
    }
    if (!isBuilderCompatible(parsed as Json)) {
      setJsonError(
        "This schema uses features the field editor can't show (nested objects, arrays, patterns…). Keep editing it as JSON, or simplify it first."
      )
      return
    }
    const defs = schemaToFields(parsed as Json)
    setRows(defs.map((f, i) => ({ ...f, id: next + i, keyEdited: f.key !== toKey(f.label) })))
    setNext((n) => n + defs.length)
    setJsonError(null)
    setAdvanced(false)
  }

  const update = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  /** Exactly one row may split stock; ticking one clears the others. */
  const setAxis = (id: number, on: boolean) =>
    setRows((rs) => rs.map((r) => ({ ...r, axis: r.id === id ? on : on ? false : r.axis })))

  const add = (def: FieldDef) => {
    setRows((rs) => {
      // A preset arriving as the axis only keeps it when nothing else splits stock yet.
      const axis = !!def.axis && !rs.some((r) => r.axis)
      return [...rs, { ...def, axis, id: next, keyEdited: def.key !== toKey(def.label) }]
    })
    setNext((n) => n + 1)
  }

  const usedKeys = new Set(rows.map((r) => r.key))
  const groups = [...new Set(PRESETS.map((p) => p.group))]
  const axisRow = rows.find((r) => r.axis)

  if (advanced) {
    return (
      <div className="grid gap-2">
        <Textarea
          name={`${name}_json`}
          rows={12}
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value)
            if (jsonError) setJsonError(null)
          }}
          placeholder='{"type":"object","properties":{}}'
          disabled={disabled}
          className="font-mono text-xs"
          aria-label="JSON Schema"
          aria-invalid={!!jsonError}
        />
        {jsonError ? <p className="text-xs text-destructive">{jsonError}</p> : null}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Raw JSON Schema. Saving uses exactly what is here{withAxis ? "; \"x-axis\" names the field that splits stock" : ""}.
          </p>
          <button type="button" onClick={toFields} disabled={disabled} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Back to fields
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {rows.length ? (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <div className={`grid ${COLS} items-center gap-2 border-b border-border/70 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground`}>
            <span>Field</span>
            <span>Type</span>
            <span className="w-16 text-center">Required</span>
            {withAxis ? (
              <span className="w-20 text-center" title="Each value of this field gets its own price and stock">
                Splits stock
              </span>
            ) : (
              <span className="w-0" />
            )}
            <span className="w-8" />
          </div>
          <div className="divide-y divide-border/70">
            {rows.map((r, i) => {
              const canAxis = AXIS_TYPES.has(r.type)
              return (
                <div key={r.id} className={"grid gap-2 px-3 py-2" + (r.axis ? " bg-brand-soft/40" : "")}>
                  <div className={`grid ${COLS} items-center gap-2`}>
                    <Input
                      name={`${name}_fields[${i}][label]`}
                      value={r.label}
                      onChange={(e) => {
                        const label = e.target.value
                        update(r.id, { label, key: r.keyEdited ? r.key : toKey(label) })
                      }}
                      placeholder="Field name"
                      required
                      disabled={disabled}
                      aria-label="Field name"
                      className="h-8"
                    />
                    <SelectField
                      name={`${name}_fields[${i}][type]`}
                      options={FIELD_TYPES}
                      value={r.type}
                      onValueChange={(v) => {
                        const type = (v || "text") as FieldType
                        update(r.id, { type, axis: r.axis && AXIS_TYPES.has(type) })
                      }}
                      disabled={disabled}
                      aria-label="Field type"
                    />
                    <div className="flex w-16 justify-center">
                      <Checkbox
                        name={`${name}_fields[${i}][required]`}
                        checked={r.required}
                        onCheckedChange={(c) => update(r.id, { required: c === true })}
                        disabled={disabled}
                        aria-label="Required"
                      />
                    </div>
                    {withAxis ? (
                      <div className="flex w-20 justify-center">
                        <Checkbox
                          name={`${name}_fields[${i}][axis]`}
                          checked={!!r.axis}
                          onCheckedChange={(c) => setAxis(r.id, c === true)}
                          disabled={disabled || !canAxis}
                          aria-label={`${r.label || "Field"} splits stock`}
                          title={canAxis ? "Each value gets its own price and stock" : "Only text or choice fields can split stock"}
                        />
                      </div>
                    ) : (
                      <span className="w-0" />
                    )}
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove field" disabled={disabled} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                      <Trash2Icon className="size-4" />
                    </Button>
                    {showKeys ? null : <input type="hidden" name={`${name}_fields[${i}][key]`} value={r.key} />}
                  </div>
                  {r.type === "number" || r.type === "integer" ? (
                    <div className="grid grid-cols-3 gap-2">
                      {(["min", "max", "step"] as const).map((k) => (
                        <div key={k} className="grid grid-cols-[auto_1fr] items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{k === "step" ? "Step" : k === "min" ? "Min" : "Max"}</span>
                          <Input
                            name={`${name}_fields[${i}][${k}]`}
                            type="number"
                            step={k === "step" ? "any" : r.type === "integer" ? 1 : "any"}
                            min={k === "step" ? 0 : undefined}
                            value={r[k] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value.trim()
                              update(r.id, { [k]: v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v) })
                            }}
                            placeholder={k === "step" ? (r.type === "integer" ? "1" : "any") : "none"}
                            disabled={disabled}
                            aria-label={`${r.label || "Field"} ${k}`}
                            className="h-7 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {r.type === "select" ? (
                    <Input
                      name={`${name}_fields[${i}][options]`}
                      value={r.optionsText ?? r.options.join(", ")}
                      onChange={(e) =>
                        update(r.id, {
                          optionsText: e.target.value,
                          options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                        })
                      }
                      placeholder="Choices, comma separated — e.g. Small, Medium, Large"
                      required
                      disabled={disabled}
                      aria-label="Choices, comma separated"
                      className="h-8 text-xs"
                    />
                  ) : null}
                  {r.axis ? (
                    <p className="text-xs text-brand">
                      Each variant lists the {r.label || "field"} values it comes in
                      {r.type === "select" ? " (from the choices above)" : " (typed freely)"}; every one is priced and stocked on its own.
                    </p>
                  ) : null}
                  {showKeys ? (
                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                      <span className="text-xs text-muted-foreground">key</span>
                      <Input
                        name={`${name}_fields[${i}][key]`}
                        value={r.key}
                        onChange={(e) => update(r.id, { key: e.target.value, keyEdited: true })}
                        pattern="[a-z][a-z0-9_]*"
                        required
                        disabled={disabled}
                        aria-label="Field key"
                        className="h-7 font-mono text-xs"
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{emptyText}</p>
      )}

      {withAxis && rows.length && !axisRow ? (
        <p className="text-xs text-muted-foreground">
          No field splits stock, so each variant of this type is one stock line. Tick “Splits stock” on a field like Size or Capacity to price and stock per value.
        </p>
      ) : null}

      {showPresets ? (
        <div className="grid gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3">
          {groups.map((g) => {
            const items = PRESETS.filter((p) => p.group === g && !usedKeys.has(p.key))
            if (!items.length) return null
            if (g === "Stock split" && !withAxis) return null
            return (
              <div key={g} className="grid gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">{g}</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const { group, ...def } = p
                        add({ ...def, axis: group === "Stock split" })
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs transition-colors hover:border-brand hover:text-brand"
                    >
                      <PlusIcon className="size-3" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {PRESETS.every((p) => usedKeys.has(p.key)) ? (
            <p className="text-xs text-muted-foreground">All common fields are already added.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={disabled}
            onClick={() => add({ key: "", label: "", type: "text", required: false, options: [] })}
          >
            <PlusIcon className="size-3.5" /> Add field
          </Button>
          <Button
            type="button"
            variant={showPresets ? "secondary" : "ghost"}
            size="sm"
            className="rounded-full"
            disabled={disabled}
            onClick={() => setShowPresets((s) => !s)}
          >
            <SparklesIcon className="size-3.5" /> Common fields
          </Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <button type="button" disabled={disabled} onClick={() => setShowKeys((s) => !s)} className="underline-offset-4 hover:underline">
            {showKeys ? "Hide keys" : "Show keys"}
          </button>
          <button type="button" disabled={disabled} onClick={toJson} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
            <Code2Icon className="size-3" /> JSON
          </button>
        </div>
      </div>
    </div>
  )
}
