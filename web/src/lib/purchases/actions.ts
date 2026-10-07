"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireToken } from "@/lib/inventory/data"
import { nest, rows } from "@/lib/inventory/form-data"
import { asRounding, readDeductions } from "@/lib/commerce/deductions"
import { describeError } from "./data"
import { vendorApi, type NewPurchaseLine } from "./vendor-service"
import type { PurchaseStatus } from "./types"

export type ActionState =
  | { error?: string; field?: string; success?: string; id?: string }
  | undefined

const optionalStr = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v) => v || undefined)

const decimal = z
  .string()
  .trim()
  .regex(/^\d{1,14}(\.\d{1,4})?$/, "Use a number with up to 4 decimals")

const rate = z
  .string()
  .trim()
  .regex(/^(100(\.0{1,4})?|\d{1,2}(\.\d{1,4})?)$/, "Use a percentage between 0 and 100")
  .optional()
  .transform((v) => v || undefined)

const DISCOUNT_TYPES = ["NONE", "PERCENT", "AMOUNT"] as const

function fail(err: unknown): ActionState {
  return { error: describeError(err) }
}

function firstIssue(error: z.ZodError): ActionState {
  const issue = error.issues[0]
  return { error: issue.message, field: String(issue.path[0] ?? "") }
}

// ── Suppliers ───────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: optionalStr,
  phone: optionalStr,
  email: optionalStr,
  address: optionalStr,
  state: optionalStr,
  division: optionalStr,
  gstin: optionalStr,
  pan: optionalStr,
  cin: optionalStr,
  notes: optionalStr,
})

export async function createSupplier(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return firstIssue(parsed.error)
  try {
    const token = await requireToken()
    const supplier = await vendorApi.createSupplier(token, parsed.data)
    revalidatePath("/suppliers")
    revalidatePath("/purchases")
    return { success: `Added ${supplier.name}`, id: supplier.id }
  } catch (err) {
    return fail(err)
  }
}

export async function updateSupplier(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing supplier" }
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return firstIssue(parsed.error)
  try {
    const token = await requireToken()
    await vendorApi.updateSupplier(token, id, parsed.data)
    revalidatePath("/suppliers")
    return { success: "Saved" }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteSupplier(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing supplier" }
  try {
    const token = await requireToken()
    await vendorApi.deleteSupplier(token, id)
    revalidatePath("/suppliers")
    return { success: "Supplier removed" }
  } catch (err) {
    return fail(err)
  }
}

// ── Purchase orders ─────────────────────────────────────────────────────

/**
 * Reads the dynamic line rows the sheet posts as
 * `items[0][size_id]`, `items[0][quantity]`, … Rows with no size or a zero
 * quantity are dropped, so a half-filled row left behind in the form does not
 * fail the whole submission.
 */
function readLines(data: Record<string, unknown>): NewPurchaseLine[] {
  const out: NewPurchaseLine[] = []
  for (const row of rows<Record<string, string>>(data.items)) {
    const sizeId = row.size_id?.trim()
    const quantity = row.quantity?.trim()
    if (!sizeId || !quantity || Number(quantity) <= 0) continue

    const qty = decimal.safeParse(quantity)
    if (!qty.success) throw new Error(`Quantity for one line: ${qty.error.issues[0].message}`)
    const price = decimal.safeParse(row.unit_price?.trim() || "0")
    if (!price.success) throw new Error(`Unit price for one line: ${price.error.issues[0].message}`)

    const discountType = DISCOUNT_TYPES.includes(row.discount_type as never)
      ? (row.discount_type as (typeof DISCOUNT_TYPES)[number])
      : "NONE"

    out.push({
      size_id: sizeId,
      quantity: qty.data,
      unit_price: price.data,
      ...(discountType !== "NONE"
        ? { discount_type: discountType, discount: row.discount?.trim() || "0" }
        : {}),
    })
  }
  return out
}

const purchaseHeadSchema = z.object({
  supplier_id: z.string().trim().min(1, "Choose a supplier"),
  invoice_no: optionalStr,
  order_date: optionalStr,
  notes: optionalStr,
  remarks: optionalStr,
  location_id: optionalStr,
  rounding_precision: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  cgst_rate: rate,
  sgst_rate: rate,
  igst_rate: rate,
})

export async function createPurchase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const data = nest(formData)
  const parsed = purchaseHeadSchema.safeParse(data)
  if (!parsed.success) return firstIssue(parsed.error)

  let items: NewPurchaseLine[]
  try {
    items = readLines(data)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Check the lines" }
  }
  if (!items.length) {
    return { error: "Add at least one line with a quantity", field: "items" }
  }

  let deductions
  try {
    deductions = readDeductions(data)
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Check the deductions",
      field: "deductions",
    }
  }
  const status = String(data.status ?? "DRAFT") as PurchaseStatus

  try {
    const token = await requireToken()
    const purchase = await vendorApi.createPurchase(token, {
      ...parsed.data,
      status,
      items,
      deductions,
      rounding: asRounding(data.rounding),
    })
    revalidatePath("/purchases")
    return {
      success: `${purchase.invoice_no} created`,
      id: purchase.id,
    }
  } catch (err) {
    return fail(err)
  }
}

export async function setPurchaseStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  const status = String(formData.get("status") ?? "") as PurchaseStatus
  if (!id || !status) return { error: "Missing purchase order or status" }
  try {
    const token = await requireToken()
    await vendorApi.setPurchaseStatus(token, id, status)
    revalidatePath("/purchases")
    revalidatePath(`/purchases/${id}`)
    return { success: `Marked ${status.toLowerCase()}` }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Receives the goods. This is the only path that moves stock, and
 * vendor-service refuses a second attempt, so a double submit cannot double
 * the inventory.
 */
export async function receivePurchase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing purchase order" }
  const locationId = String(formData.get("location_id") ?? "").trim()
  try {
    const token = await requireToken()
    const purchase = await vendorApi.receivePurchase(token, id, {
      ...(locationId ? { location_id: locationId } : {}),
    })
    revalidatePath("/purchases")
    revalidatePath(`/purchases/${id}`)
    // Stock changed, so the inventory views are stale too.
    revalidatePath("/inventory")
    revalidatePath("/inventory/activity")
    return {
      success: `Received ${purchase.items.length} line${
        purchase.items.length === 1 ? "" : "s"
      } into stock`,
    }
  } catch (err) {
    return fail(err)
  }
}

export async function deletePurchase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing purchase order" }
  try {
    const token = await requireToken()
    await vendorApi.deletePurchase(token, id)
    revalidatePath("/purchases")
    return { success: "Purchase order deleted" }
  } catch (err) {
    return fail(err)
  }
}
