"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { describeError, requireToken } from "./data"
import { nest, readObject, rows } from "./form-data"
import { inventoryApi, type NewSize, type NewVariant } from "./inventory-service"
import { AXIS_TYPES, axisKeyOf, fieldsToSchema, KEY_RE, type FieldDef, type FieldType } from "./schema-builder"
import type { Json, MovementType, VariantType } from "./types"

export type ActionState =
  | { error?: string; field?: string; success?: string; id?: string }
  | undefined

const optionalStr = z.string().trim().max(200).optional().transform((v) => v || undefined)
const decimal = z
  .string()
  .trim()
  .regex(/^\d{1,14}(\.\d{1,4})?$/, "Use a number with up to 4 decimals")

function fail(err: unknown): ActionState {
  return { error: describeError(err) }
}

function firstIssue(error: z.ZodError): ActionState {
  const issue = error.issues[0]
  return { error: issue.message, field: String(issue.path[0] ?? "") }
}

// ── Field builder → JSON Schema ─────────────────────────────────────────

const typeHeadSchema = z.object({
  key: z.string().trim().min(1, "Key is required").max(64).regex(/^[a-z0-9][a-z0-9_-]*$/, "Key: lowercase letters, digits, - or _"),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optionalStr,
})

const FIELD_TYPES = new Set<FieldType>(["text", "longtext", "number", "integer", "boolean", "select", "date", "url", "email"])

/**
 * Builds a JSON Schema from the field-builder rows (`<name>_fields[i][...]`),
 * or takes the raw schema when the advanced editor was used (`<name>_json`).
 */
function readSchema(data: Record<string, unknown>, name: string, label: string): Json {
  const raw = typeof data[`${name}_json`] === "string" ? (data[`${name}_json`] as string).trim() : ""
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error()
      return parsed as Json
    } catch {
      throw new Error(`${label} must be a JSON Schema object`)
    }
  }
  const fields: FieldDef[] = []
  const seen = new Set<string>()
  for (const r of rows<Record<string, string>>(data[`${name}_fields`])) {
    const fieldLabel = (r.label ?? "").trim()
    const key = (r.key ?? "").trim()
    if (!fieldLabel && !key) continue
    if (!KEY_RE.test(key)) {
      throw new Error(`${label}: "${key || fieldLabel}" needs a key like brand_name (lowercase, digits, _)`)
    }
    if (seen.has(key)) throw new Error(`${label}: field "${key}" is listed twice`)
    seen.add(key)
    const type = FIELD_TYPES.has(r.type as FieldType) ? (r.type as FieldType) : "text"
    const options = (r.options ?? "").split(",").map((o) => o.trim()).filter(Boolean)
    if (type === "select" && !options.length) {
      throw new Error(`${label}: "${fieldLabel || key}" needs at least one choice`)
    }
    const num = (v: string | undefined) => {
      const t = (v ?? "").trim()
      if (!t) return undefined
      const n = Number(t)
      if (!Number.isFinite(n)) throw new Error(`${label}: "${fieldLabel || key}" has a non-numeric limit`)
      return n
    }
    const bounds =
      type === "number" || type === "integer"
        ? { min: num(r.min), max: num(r.max), step: num(r.step) }
        : {}
    if (bounds.min !== undefined && bounds.max !== undefined && bounds.min > bounds.max) {
      throw new Error(`${label}: "${fieldLabel || key}" has min greater than max`)
    }
    if (bounds.step !== undefined && bounds.step <= 0) {
      throw new Error(`${label}: "${fieldLabel || key}" needs a step greater than 0`)
    }
    fields.push({ key, label: fieldLabel || key, type, required: r.required === "on", options, ...bounds, axis: r.axis === "on" && AXIS_TYPES.has(type) })
  }
  return fieldsToSchema(fields)
}

// ── Variant types ───────────────────────────────────────────────────────

const variantTypeSchema = typeHeadSchema

export async function createVariantTypeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = nest(formData)
  const parsed = variantTypeSchema.safeParse(data)
  if (!parsed.success) return firstIssue(parsed.error)
  try {
    const attribute_schema = readSchema(data, "attribute", "Variant fields")
    await inventoryApi.createVariantType(await requireToken(), {
      ...parsed.data,
      attribute_schema,
      axis_key: axisKeyOf(attribute_schema),
    })
  } catch (err) {
    return fail(err)
  }
  revalidatePath("/inventory/variant-types")
  return { success: `Variant type "${parsed.data.name}" created.` }
}

export async function updateVariantTypeAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = nest(formData)
  const parsed = variantTypeSchema.omit({ key: true }).safeParse(data)
  if (!parsed.success) return firstIssue(parsed.error)
  try {
    const attribute_schema = readSchema(data, "attribute", "Variant fields")
    await inventoryApi.updateVariantType(await requireToken(), id, {
      ...parsed.data,
      attribute_schema,
      axis_key: axisKeyOf(attribute_schema),
    })
  } catch (err) {
    return fail(err)
  }
  revalidatePath("/inventory/variant-types")
  revalidatePath("/inventory")
  return { success: "Saved." }
}

export async function deleteVariantTypeAction(id: string): Promise<ActionState> {
  try {
    await inventoryApi.deleteVariantType(await requireToken(), id)
  } catch (err) {
    return fail(err)
  }
  revalidatePath("/inventory/variant-types")
  return { success: "Variant type deleted." }
}

// ── Locations ───────────────────────────────────────────────────────────

const locationSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Code: letters, digits, . _ -"),
  name: z.string().trim().min(1, "Name is required").max(120),
  parent_id: optionalStr,
  is_default: z.string().optional().transform((v) => v === "on"),
})

export async function createLocationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = locationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return firstIssue(parsed.error)
  try {
    await inventoryApi.createLocation(await requireToken(), parsed.data)
  } catch (err) {
    return fail(err)
  }
  revalidatePath("/inventory/locations")
  return { success: `Location "${parsed.data.name}" created.` }
}

export async function deleteLocationAction(id: string): Promise<ActionState> {
  try {
    await inventoryApi.deleteLocation(await requireToken(), id)
  } catch (err) {
    return fail(err)
  }
  revalidatePath("/inventory/locations")
  return { success: "Location deleted." }
}

// ── Products ────────────────────────────────────────────────────────────

const optionalDecimal = z.string().trim().optional().transform((v) => v || undefined).pipe(decimal.optional())

/** One size row as the variant form posts it. Prices may be left for later. */
const sizeRow = z.object({
  label: optionalStr,
  sku: optionalStr,
  barcode: optionalStr,
  cost_price: optionalDecimal,
  sell_price: optionalDecimal,
})

const variantHead = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  variant_type_id: optionalStr,
})

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: optionalStr,
  description: z.string().trim().max(4000).optional().transform((v) => v || undefined),
  tags: z.string().trim().optional().transform((v) => (v ? v.split(",").map((t) => t.trim()).filter(Boolean) : undefined)),
})

/**
 * Reads one variant as the variant form posts it under a prefix:
 *   name, variant_type_id, vattr[key] (+ vattr_kv / vattr_json),
 *   sizes[i][label|sku|barcode|cost_price|sell_price]
 * The axis field is never in vattr — its values are the size labels. Sizes
 * are checked for shape only; the service applies the type's rules.
 */
function readVariant(raw: Record<string, unknown>, variantTypes: VariantType[]): NewVariant {
  const head = variantHead.safeParse(raw)
  if (!head.success) throw new Error(`Variant: ${head.error.issues[0].message}`)
  const vtype = head.data.variant_type_id ? variantTypes.find((t) => t.id === head.data.variant_type_id) : undefined
  if (head.data.variant_type_id && !vtype) throw new Error("Variant type not found")
  const sizes: NewSize[] = []
  for (const r of rows<Record<string, string>>(raw.sizes)) {
    const row = sizeRow.safeParse(r)
    if (!row.success) throw new Error(`${head.data.name}: ${row.error.issues[0].message}`)
    const { barcode, ...size } = row.data
    sizes.push({ ...size, barcodes: barcode ? [{ value: barcode }] : undefined })
  }
  return {
    name: head.data.name,
    variant_type_id: head.data.variant_type_id,
    attributes: readObject(raw, "vattr", vtype?.attribute_schema, `${head.data.name} details`),
    sizes,
  }
}

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = nest(formData)
  const parsed = productSchema.safeParse(data)
  if (!parsed.success) return firstIssue(parsed.error)

  let id: string
  try {
    const token = await requireToken()
    const variantTypes = await inventoryApi.variantTypes(token)
    // Products have no type: whatever the user adds is kept as free-form properties.
    const attributes = readObject(data, "attr", undefined, "Properties")
    const variants = rows<Record<string, unknown>>(data.variants).map((raw) => readVariant(raw, variantTypes))
    if (!variants.length) return { error: "Add at least one variant" }

    const created = await inventoryApi.createProduct(token, { ...parsed.data, attributes, variants })
    id = created.id
  } catch (err) {
    return fail(err)
  }
  // The sheet stays open for the next product; the list behind it refreshes.
  revalidatePath("/inventory")
  return { success: `“${parsed.data.name}” created.`, id }
}

const productEditSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z.string().trim().max(128).transform((v) => v || null),
  description: z.string().trim().max(4000).transform((v) => v || null),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]),
  tags: z.string().trim().transform((v) => v.split(",").map((t) => t.trim()).filter(Boolean)),
})

export async function updateProductAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = nest(formData)
  const parsed = productEditSchema.safeParse(data)
  if (!parsed.success) return firstIssue(parsed.error)
  try {
    await inventoryApi.updateProduct(await requireToken(), id, {
      ...parsed.data,
      attributes: readObject(data, "attr", undefined, "Properties"),
    })
  } catch (err) {
    return fail(err)
  }
  revalidatePath(`/inventory/${id}`)
  revalidatePath("/inventory")
  return { success: "Saved." }
}

export async function deleteProductAction(id: string): Promise<ActionState> {
  try {
    await inventoryApi.deleteProduct(await requireToken(), id)
  } catch (err) {
    return fail(err)
  }
  revalidatePath("/inventory")
  redirect("/inventory")
}

// ── Variants and sizes ──────────────────────────────────────────────────

/** Adds one variant to an existing product; the form posts it under `variant[...]`. */
export async function createVariantAction(productId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = nest(formData)
  try {
    const token = await requireToken()
    const variantTypes = await inventoryApi.variantTypes(token)
    const raw = (data.variant ?? {}) as Record<string, unknown>
    await inventoryApi.createVariant(token, productId, readVariant(raw, variantTypes))
  } catch (err) {
    return fail(err)
  }
  revalidatePath(`/inventory/${productId}`)
  return { success: "Variant added." }
}

export async function deleteVariantAction(productId: string, variantId: string): Promise<ActionState> {
  try {
    await inventoryApi.deleteVariant(await requireToken(), variantId)
  } catch (err) {
    return fail(err)
  }
  revalidatePath(`/inventory/${productId}`)
  return { success: "Variant removed." }
}

export async function addSizeAction(productId: string, variantId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = sizeRow.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return firstIssue(parsed.error)
  const { barcode, ...size } = parsed.data
  try {
    await inventoryApi.addSize(await requireToken(), variantId, { ...size, barcodes: barcode ? [{ value: barcode }] : undefined })
  } catch (err) {
    return fail(err)
  }
  revalidatePath(`/inventory/${productId}`)
  return { success: "Size added." }
}

const priceEdit = z.object({
  cost_price: z.string().trim().transform((v) => v || null).pipe(decimal.nullable()),
  sell_price: z.string().trim().transform((v) => v || null).pipe(decimal.nullable()),
  sku: z.string().trim().max(128).transform((v) => v || null),
})

export async function updateSizeAction(productId: string, sizeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = priceEdit.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return firstIssue(parsed.error)
  try {
    await inventoryApi.updateSize(await requireToken(), sizeId, parsed.data)
  } catch (err) {
    return fail(err)
  }
  revalidatePath(`/inventory/${productId}`)
  return { success: "Saved." }
}

/** Assigns a scanned/typed barcode to a stock line. */
export async function addBarcodeAction(productId: string, sizeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const value = String(formData.get("value") ?? "").trim()
  if (!value) return { error: "Scan or type the barcode first", field: "value" }
  if (value.length > 128) return { error: "Barcode is too long", field: "value" }
  try {
    await inventoryApi.addBarcode(await requireToken(), sizeId, { value })
  } catch (err) {
    return fail(err)
  }
  revalidatePath(`/inventory/${productId}`)
  revalidatePath("/inventory")
  return { success: "Barcode assigned." }
}

export async function deleteBarcodeAction(productId: string, barcodeId: string): Promise<ActionState> {
  try {
    await inventoryApi.deleteBarcode(await requireToken(), barcodeId)
  } catch (err) {
    return fail(err)
  }
  revalidatePath(`/inventory/${productId}`)
  revalidatePath("/inventory")
  return { success: "Barcode removed." }
}

export async function deleteSizeAction(productId: string, sizeId: string): Promise<ActionState> {
  try {
    await inventoryApi.deleteSize(await requireToken(), sizeId)
  } catch (err) {
    return fail(err)
  }
  revalidatePath(`/inventory/${productId}`)
  return { success: "Size removed." }
}

// ── Stock ───────────────────────────────────────────────────────────────

const movementSchema = z
  .object({
    size_id: z.string().min(1),
    product_id: z.string().min(1),
    type: z.enum(["IN", "OUT", "ADJUST", "TRANSFER"]),
    quantity: z.string().trim(),
    from_location_id: optionalStr,
    to_location_id: optionalStr,
    reason: optionalStr,
    reference: optionalStr,
  })
  .superRefine((v, ctx) => {
    const positive = /^\d{1,14}(\.\d{1,4})?$/.test(v.quantity) && Number(v.quantity) > 0
    if (v.type === "ADJUST") {
      if (!/^\d{1,14}(\.\d{1,4})?$/.test(v.quantity)) {
        ctx.addIssue({ code: "custom", path: ["quantity"], message: "Enter the counted quantity" })
      }
    } else if (!positive) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantity must be greater than 0" })
    }
    if (v.type === "TRANSFER" && v.from_location_id && v.from_location_id === v.to_location_id) {
      ctx.addIssue({ code: "custom", path: ["to_location_id"], message: "Pick two different locations" })
    }
  })

export async function moveStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = movementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return firstIssue(parsed.error)
  const v = parsed.data
  const [reference_type, reference_id] = v.reference?.includes(":")
    ? v.reference.split(":", 2).map((s) => s.trim())
    : [v.reference ? "note" : undefined, v.reference]

  try {
    await inventoryApi.move(await requireToken(), {
      size_id: v.size_id,
      type: v.type as MovementType,
      // ADJUST in the UI is always "I counted N"; the service derives the delta.
      ...(v.type === "ADJUST" ? { counted: v.quantity } : { quantity: v.quantity }),
      from_location_id: v.type === "IN" ? undefined : v.from_location_id,
      to_location_id: v.type === "OUT" || v.type === "ADJUST" ? undefined : v.to_location_id,
      reason: v.reason,
      reference_type,
      reference_id,
    })
  } catch (err) {
    return fail(err)
  }
  revalidatePath(`/inventory/${v.product_id}`)
  revalidatePath("/inventory")
  return { success: `${labelFor(v.type)} recorded.` }
}

function labelFor(type: string) {
  return { IN: "Receipt", OUT: "Issue", ADJUST: "Adjustment", TRANSFER: "Transfer" }[type] ?? type
}
