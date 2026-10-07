import type {
  Deduction,
  Rounding,
} from "@/lib/commerce/totals"

export type DiscountType = "NONE" | "PERCENT" | "AMOUNT"

export type OrderStatus =
  | "DRAFT"
  | "PENDING"
  | "REVIEW"
  | "APPROVED"
  | "CONFIRMED"
  | "FULFILLED"
  | "CANCELLED"
  | "RETURNED"

export type CustomerStatus = "ACTIVE" | "INACTIVE"

export interface Customer {
  id: string
  code: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  state: string | null
  gstin: string | null
  pan: string | null
  status: CustomerStatus
  notes: string | null
  created_at: string
  _count?: { orders: number }
}

export interface OrderItem {
  id: string
  size_id: string
  product_name: string
  variant_name: string
  size_label: string
  sku: string | null
  quantity: string
  rate: string
  discount_type: DiscountType
  discount: string
  total: string
}

export interface Order {
  id: string
  customer_id: string
  invoice_no: string
  status: OrderStatus
  order_date: string
  subtotal: string
  /** Sum of every rung in `deductions`. */
  discount: string
  taxable_amount: string
  cgst: string
  sgst: string
  igst: string
  round_off: string
  rounding: Rounding
  rounding_precision: string
  total_amount: string
  cgst_rate: string
  sgst_rate: string
  igst_rate: string
  currency: string
  notes: string | null
  remarks: string | null
  location_id: string | null
  reserved_at: string | null
  stock_posted_at: string | null
  fulfilled_at: string | null
  created_at: string
  customer: Customer
  deductions: Deduction[]
  items: OrderItem[]
}

export const ORDER_STATUSES: OrderStatus[] = [
  "DRAFT",
  "PENDING",
  "REVIEW",
  "APPROVED",
  "CONFIRMED",
  "FULFILLED",
  "CANCELLED",
  "RETURNED",
]

/**
 * Statuses a user may set directly. CONFIRMED, FULFILLED and a cancellation
 * that must release a reservation all go through their own actions, because
 * they touch stock.
 *
 * REVIEW is the pricing gate: an order moves between PENDING and REVIEW while
 * the special discount is agreed, then on to APPROVED.
 */
export const SETTABLE_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["PENDING", "REVIEW"],
  PENDING: ["DRAFT", "REVIEW"],
  REVIEW: ["PENDING", "APPROVED"],
  APPROVED: ["REVIEW"],
  CONFIRMED: [],
  FULFILLED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
}

export const CONFIRMABLE: OrderStatus[] = ["DRAFT", "PENDING", "REVIEW", "APPROVED"]
export const FULFILLABLE: OrderStatus[] = ["CONFIRMED", "APPROVED", "PENDING"]
export const CANCELLABLE: OrderStatus[] = [
  "DRAFT",
  "PENDING",
  "REVIEW",
  "APPROVED",
  "CONFIRMED",
]

/** The stage where the special discount is meant to be settled. */
export const IS_REPRICEABLE: OrderStatus[] = ["DRAFT", "PENDING", "REVIEW"]

export type {
  Deduction,
  DeductionBase,
  DeductionBasis,
  Rounding,
} from "@/lib/commerce/totals"
