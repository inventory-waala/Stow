import type {
  Deduction,
  Rounding,
} from "@/lib/commerce/totals"

export type DiscountType = "NONE" | "PERCENT" | "AMOUNT"

export type PurchaseStatus =
  | "DRAFT"
  | "PENDING"
  | "ORDERED"
  | "APPROVED"
  | "RECEIVED"
  | "CANCELLED"

export type SupplierStatus = "ACTIVE" | "INACTIVE"

export interface Supplier {
  id: string
  code: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  state: string | null
  division: string | null
  gstin: string | null
  pan: string | null
  cin: string | null
  status: SupplierStatus
  notes: string | null
  created_at: string
  _count?: { purchases: number }
}

export interface PurchaseItem {
  id: string
  size_id: string
  product_name: string
  variant_name: string
  size_label: string
  sku: string | null
  /** Decimals arrive as strings so precision survives JSON. */
  quantity: string
  unit_price: string
  discount_type: DiscountType
  discount: string
  total_price: string
}

export interface PurchaseOrder {
  id: string
  supplier_id: string
  invoice_no: string
  status: PurchaseStatus
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
  /** Derived by the service from the stored amounts, to repopulate the form. */
  cgst_rate: string
  sgst_rate: string
  igst_rate: string
  currency: string
  notes: string | null
  remarks: string | null
  location_id: string | null
  received_at: string | null
  stock_posted_at: string | null
  created_at: string
  supplier: Supplier
  deductions: Deduction[]
  items: PurchaseItem[]
}

export const PURCHASE_STATUSES: PurchaseStatus[] = [
  "DRAFT",
  "PENDING",
  "ORDERED",
  "APPROVED",
  "RECEIVED",
  "CANCELLED",
]

/** Statuses a user may set directly; RECEIVED goes through the receive action. */
export const SETTABLE_STATUSES: Record<PurchaseStatus, PurchaseStatus[]> = {
  DRAFT: ["PENDING", "ORDERED", "APPROVED", "CANCELLED"],
  PENDING: ["DRAFT", "ORDERED", "APPROVED", "CANCELLED"],
  ORDERED: ["APPROVED", "CANCELLED"],
  APPROVED: ["ORDERED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
}

export const RECEIVABLE: PurchaseStatus[] = ["DRAFT", "PENDING", "ORDERED", "APPROVED"]

export type {
  Deduction,
  DeductionBase,
  DeductionBasis,
  Rounding,
} from "@/lib/commerce/totals"
