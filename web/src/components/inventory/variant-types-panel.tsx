"use client"

import { useActionState, useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"

import {
  createVariantTypeAction,
  deleteVariantTypeAction,
  updateVariantTypeAction,
} from "@/lib/inventory/actions"
import { VARIANT_TYPE_TEMPLATES, fieldsToSchema, schemaToFields } from "@/lib/inventory/schema-builder"
import type { Json, VariantType } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
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
import { FieldBuilder } from "./field-builder"
import { EmptyRow, FormAlert } from "./primitives"
import { SelectField } from "./select-field"
import { Chips, TypeNameFields, deriveKey } from "./type-sheet-parts"

/** Columns every variant has regardless of type; shown so the type reads as complete. */
const BUILT_IN: Array<{ label: string; type: string; required: boolean; note?: string }> = [
  { label: "Name", type: "Text", required: true, note: "what the variant is called" },
  { label: "Cost price", type: "Money", required: false, note: "per value of the field that splits stock" },
  { label: "Sell price", type: "Money", required: false, note: "per value" },
  { label: "SKU", type: "Text", required: false, note: "per value; unique within the workspace" },
  { label: "Barcode", type: "Text", required: false, note: "per value; scannable" },
]

function BuiltInFields() {
  return (
    <div className="overflow-hidden rounded-xl border border-dashed border-border/70">
      <div className="flex items-center justify-between bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
        <span>Built in — on every variant</span>
        <span>can&apos;t be removed</span>
      </div>
      <div className="divide-y divide-border/70">
        {BUILT_IN.map((f) => (
          <div key={f.label} className="grid grid-cols-[minmax(0,1.6fr)_minmax(8rem,1fr)_auto] items-center gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <span>{f.label}</span>
              {f.note ? <span className="ml-2 text-xs text-muted-foreground">{f.note}</span> : null}
            </div>
            <span className="text-muted-foreground">{f.type}</span>
            <span className={"w-16 text-center text-xs " + (f.required ? "font-medium text-brand" : "text-muted-foreground")}>
              {f.required ? "Required" : "Optional"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Create / edit a variant type: the fields a variant records. One of them
 * may be ticked as the field that splits stock (Size, Capacity, Pack…) —
 * each of its values is then priced and stocked on its own.
 */
function VariantTypeSheet({ type, trigger }: { type?: VariantType; trigger: React.ReactElement }) {
  // Remount the form on every open so a closed sheet never carries stale state.
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setSession((n) => n + 1)
        setOpen(o)
      }}
    >
      <SheetTrigger render={trigger} />
      <VariantTypeSheetForm key={session} type={type} />
    </Sheet>
  )
}

function VariantTypeSheetForm({ type }: { type?: VariantType }) {
  const editing = !!type
  const [state, action, pending] = useActionState(
    editing ? updateVariantTypeAction.bind(null, type.id) : createVariantTypeAction,
    undefined
  )
  const [delState, delAction, deleting] = useActionState(
    async () => (type ? deleteVariantTypeAction(type.id) : undefined),
    undefined
  )
  const [name, setName] = useState(type?.name ?? "")
  const [key, setKey] = useState(type?.key ?? "")
  const [keyTouched, setKeyTouched] = useState(editing)
  const [templateId, setTemplateId] = useState("")
  const template = VARIANT_TYPE_TEMPLATES.find((t) => t.id === templateId)
  const count = type?._count?.variants ?? 0

  const schema: Json | undefined = editing ? type.attribute_schema : template ? fieldsToSchema(template.fields) : undefined
  const builderKey = editing ? type.id : templateId || "blank"

  return (
    <SheetContent className="w-full overflow-y-auto sm:max-w-2xl!">
      <form action={action} className="flex h-full flex-col">
        <SheetHeader>
          <SheetTitle>{editing ? type.name : "New variant type"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "Changing this doesn't alter existing variants; ones that no longer fit are listed as violations."
              : "Decide what a variant of this kind records. Tick the one field whose values are priced and stocked separately."}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-4">
          <FormAlert state={state ?? delState} />

          {!editing ? (
            <div className="grid gap-2">
              <Label htmlFor="vt-template">Start from</Label>
              <SelectField
                id="vt-template"
                value={templateId}
                onValueChange={(id) => {
                  setTemplateId(id)
                  const t = VARIANT_TYPE_TEMPLATES.find((x) => x.id === id)
                  if (t && !name) {
                    setName(t.name)
                    if (!keyTouched) setKey(deriveKey(t.name))
                  }
                }}
                disabled={pending}
                options={[{ value: "", label: "Blank" }, ...VARIANT_TYPE_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))]}
              />
              {template ? <p className="text-xs text-muted-foreground">{template.description}</p> : null}
            </div>
          ) : null}

          <TypeNameFields
            idPrefix="vt"
            editing={editing}
            existingKey={type?.key}
            description={type?.description ?? ""}
            name={name}
            setName={setName}
            keyValue={key}
            setKey={setKey}
            keyTouched={keyTouched}
            setKeyTouched={setKeyTouched}
            disabled={pending}
            namePlaceholder="e.g. Sized apparel"
          />

          <div className="grid gap-3">
            <div>
              <Label>Fields</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                What each variant records. Tick <span className="font-medium text-foreground">Splits stock</span> on the one field — Size, Capacity, Pack, Shade —
                whose values each get their own price and stock. Leave none ticked for a single stock line.
              </p>
            </div>
            <BuiltInFields />
            <FieldBuilder
              key={builderKey}
              name="attribute"
              schema={schema}
              withAxis
              disabled={pending}
              emptyText="No fields yet. Variants of this type only have a name and one stock line."
            />
          </div>
        </div>

        <SheetFooter className="mt-auto flex-row items-center justify-between">
          {editing ? (
            <Button
              type="submit"
              formAction={delAction}
              variant="ghost"
              disabled={pending || deleting || count > 0}
              title={count > 0 ? "Reassign its variants first" : undefined}
              className="rounded-full text-destructive hover:text-destructive"
              onClick={(e) => {
                if (!confirm(`Delete variant type "${type.name}"?`)) e.preventDefault()
              }}
            >
              <Trash2Icon className="size-4" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={pending || deleting} className="rounded-full px-6">
            {pending ? "Saving..." : editing ? "Save changes" : "Create variant type"}
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  )
}

export function NewVariantTypeButton() {
  return (
    <VariantTypeSheet
      trigger={
        <Button className="rounded-full px-4">
          <PlusIcon className="size-4" strokeWidth={2} />
          New variant type
        </Button>
      }
    />
  )
}

export function VariantTypesList({ types }: { types: VariantType[] }) {
  if (!types.length) {
    return (
      <EmptyRow>
        No variant types yet. Variants can still be added untyped; add a type to give them fields and a stock split.
      </EmptyRow>
    )
  }
  return (
    <div className="grid gap-3 border-t border-border/70 p-5 sm:grid-cols-2 xl:grid-cols-3">
      {types.map((t) => {
        const fields = schemaToFields(t.attribute_schema).filter((f) => f.key !== t.axis_key).map((f) => f.label)
        const count = t._count?.variants ?? 0
        return (
          <VariantTypeSheet
            key={t.id}
            type={t}
            trigger={
              <button
                type="button"
                className="grid content-start gap-3 rounded-xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-brand/50 hover:bg-secondary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.description || <span className="font-mono">{t.key}</span>}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground tabular">
                    {count} variant{count === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid content-start gap-1.5">
                  {t.axis_label ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground">Stock per {t.axis_label.toLowerCase()}:</span>
                      {t.axis_free ? <span className="text-xs text-muted-foreground">any value</span> : <Chips items={t.axis_values} tone="size" />}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">One stock line per variant</p>
                  )}
                  <Chips items={fields} tone="variant" />
                </div>
              </button>
            }
          />
        )
      })}
    </div>
  )
}
