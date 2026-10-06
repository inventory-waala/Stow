"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireToken } from "@/lib/inventory/data"
import { nest, rows } from "@/lib/inventory/form-data"
import { describeError } from "./data"
import { transactionApi, type NewOrderLine } from "./transaction-service"
import type { OrderStatus } from "./types"

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
type Discount = (typeof DISCOUNT_TYPES)[number]

const asDiscount = (v: unknown): Discount =>
  DISCOUNT_TYPES.includes(v as never) ? (v as Discount) : "NONE"

function fail(err: unknown): ActionState {
  return { error: describeError(err) }
}

function firstIssue(error: z.ZodError): ActionState {
  const issue = error.issues[0]
  return { error: issue.message, field: String(issue.path[0] ?? "") }
}

/** Every view that shows stock or orders, after stock has moved. */
function revalidateStock(id?: string) {
  revalidatePath("/orders")
  if (id) revalidatePath(`/orders/${id}`)
  revalidatePath("/inventory")
  revalidatePath("/inventory/activity")
}

// ── Customers ───────────────────────────────────────────────────────────

const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: optionalStr,
  phone: optionalStr,
  email: optionalStr,
  address: optionalStr,
  state: optionalStr,
  gstin: optionalStr,
  pan: optionalStr,
  notes: optionalStr,
})

export async function createCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = customerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return firstIssue(parsed.error)
  try {
    const token = await requireToken()
    const customer = await transactionApi.createCustomer(token, parsed.data)
    revalidatePath("/customers")
    revalidatePath("/orders")
    return { success: `Added ${customer.name}`, id: customer.id }
  } catch (err) {
    return fail(err)
  }
}

export async function updateCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing customer" }
  const parsed = customerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return firstIssue(parsed.error)
  try {
    const token = await requireToken()
    await transactionApi.updateCustomer(token, id, parsed.data)
    revalidatePath("/customers")
    return { success: "Saved" }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing customer" }
  try {
    const token = await requireToken()
    await transactionApi.deleteCustomer(token, id)
    revalidatePath("/customers")
    return { success: "Customer removed" }
  } catch (err) {
    return fail(err)
  }
}

// ── Orders ──────────────────────────────────────────────────────────────

/**
 * Reads the dynamic line rows as `items[0][size_id]`, … A row with no size or
 * a zero quantity is dropped, so a stray half-filled row does not fail the
 * submission. An empty rate is omitted entirely, which makes the service fall
 * back to the catalog sell price.
 */
function readLines(data: Record<string, unknown>): NewOrderLine[] {
  const out: NewOrderLine[] = []
  for (const row of rows<Record<string, string>>(data.items)) {
    const sizeId = row.size_id?.trim()
    const quantity = row.quantity?.trim()
    if (!sizeId || !quantity || Number(quantity) <= 0) continue

    const qty = decimal.safeParse(quantity)
    if (!qty.success) throw new Error(`Quantity for one line: ${qty.error.issues[0].message}`)

    const rawRate = row.rate?.trim()
    let parsedRate: string | undefined
    if (rawRate) {
      const r = decimal.safeParse(rawRate)
      if (!r.success) throw new Error(`Rate for one line: ${r.error.issues[0].message}`)
      parsedRate = r.data
    }

    const discountType = asDiscount(row.discount_type)
    out.push({
      size_id: sizeId,
      quantity: qty.data,
      ...(parsedRate ? { rate: parsedRate } : {}),
      ...(discountType !== "NONE"
        ? { discount_type: discountType, discount: row.discount?.trim() || "0" }
        : {}),
    })
  }
  return out
}

const orderHeadSchema = z.object({
  customer_id: z.string().trim().min(1, "Choose a customer"),
  invoice_no: optionalStr,
  order_date: optionalStr,
  notes: optionalStr,
  remarks: optionalStr,
  location_id: optionalStr,
  discount: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  special_discount: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  cgst_rate: rate,
  sgst_rate: rate,
  igst_rate: rate,
})

export async function createOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const data = nest(formData)
  const parsed = orderHeadSchema.safeParse(data)
  if (!parsed.success) return firstIssue(parsed.error)

  let items: NewOrderLine[]
  try {
    items = readLines(data)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Check the lines" }
  }
  if (!items.length) {
    return { error: "Add at least one line with a quantity", field: "items" }
  }

  const discountType = asDiscount(data.discount_type)
  const specialType = asDiscount(data.special_discount_type)

  try {
    const token = await requireToken()
    const order = await transactionApi.createOrder(token, {
      ...parsed.data,
      status: String(data.status ?? "DRAFT") as OrderStatus,
      items,
      discount_type: discountType,
      ...(discountType === "NONE" ? { discount: undefined } : {}),
      special_discount_type: specialType,
      ...(specialType === "NONE" ? { special_discount: undefined } : {}),
    })
    revalidatePath("/orders")
    return { success: `${order.invoice_no} created`, id: order.id }
  } catch (err) {
    return fail(err)
  }
}

export async function setOrderStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  const status = String(formData.get("status") ?? "") as OrderStatus
  if (!id || !status) return { error: "Missing order or status" }
  try {
    const token = await requireToken()
    await transactionApi.setOrderStatus(token, id, status)
    revalidatePath("/orders")
    revalidatePath(`/orders/${id}`)
    return { success: `Marked ${status.toLowerCase()}` }
  } catch (err) {
    return fail(err)
  }
}

/** Holds the goods without shipping them. Fails with a 409 if stock is short. */
export async function confirmOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing order" }
  try {
    const token = await requireToken()
    await transactionApi.confirmOrder(token, id)
    revalidateStock(id)
    return { success: "Stock reserved for this order" }
  } catch (err) {
    return fail(err)
  }
}

/** Releases the reservation and takes the stock out. Only possible once. */
export async function fulfilOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing order" }
  const locationId = String(formData.get("location_id") ?? "").trim()
  try {
    const token = await requireToken()
    const order = await transactionApi.fulfilOrder(token, id, {
      ...(locationId ? { location_id: locationId } : {}),
    })
    revalidateStock(id)
    return {
      success: `Shipped ${order.items.length} line${order.items.length === 1 ? "" : "s"}`,
    }
  } catch (err) {
    return fail(err)
  }
}

export async function cancelOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing order" }
  try {
    const token = await requireToken()
    await transactionApi.cancelOrder(token, id)
    revalidateStock(id)
    return { success: "Order cancelled and any reserved stock released" }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteOrder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "")
  if (!id) return { error: "Missing order" }
  try {
    const token = await requireToken()
    await transactionApi.deleteOrder(token, id)
    revalidatePath("/orders")
    return { success: "Order deleted" }
  } catch (err) {
    return fail(err)
  }
}
