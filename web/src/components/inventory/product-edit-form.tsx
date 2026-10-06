"use client"

import { useActionState } from "react"

import { deleteProductAction, updateProductAction } from "@/lib/inventory/actions"
import type { Product } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormAlert } from "./primitives"
import { SchemaFields } from "./schema-fields"
import { SelectField } from "./select-field"

export function ProductEditForm({ product }: { product: Product }) {
  const [state, action, pending] = useActionState(
    updateProductAction.bind(null, product.id),
    undefined
  )
  const [delState, delAction, deleting] = useActionState(
    async () => deleteProductAction(product.id),
    undefined
  )

  return (
    <form action={action} className="grid gap-5 p-5 pt-0">
      <FormAlert state={state ?? delState} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pe-name">Name</Label>
          <Input id="pe-name" name="name" defaultValue={product.name} required maxLength={200} disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pe-code">Code</Label>
          <Input id="pe-code" name="code" defaultValue={product.code ?? ""} maxLength={128} disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pe-status">Status</Label>
          <SelectField
            id="pe-status"
            name="status"
            defaultValue={product.status}
            disabled={pending}
            options={(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const).map((s) => ({
              value: s,
              label: s.charAt(0) + s.slice(1).toLowerCase(),
            }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pe-tags">Tags</Label>
          <Input id="pe-tags" name="tags" defaultValue={product.tags.join(", ")} disabled={pending} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pe-desc">Description</Label>
          <Textarea id="pe-desc" name="description" rows={2} defaultValue={product.description ?? ""} maxLength={4000} disabled={pending} className="resize-none" />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Properties</Label>
          <SchemaFields
            name="attr"
            schema={undefined}
            value={product.attributes}
            disabled={pending}
            emptyHint="Nothing recorded yet. Add any property this product should carry — brand, HSN code, material…"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="submit"
          variant="ghost"
          formAction={delAction}
          disabled={pending || deleting}
          className="rounded-full text-destructive hover:text-destructive"
          onClick={(e) => {
            if (!confirm(`Delete "${product.name}"? Stock history is kept.`)) e.preventDefault()
          }}
        >
          {deleting ? "Deleting..." : "Delete product"}
        </Button>
        <Button type="submit" disabled={pending || deleting} className="rounded-full px-6">
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  )
}
