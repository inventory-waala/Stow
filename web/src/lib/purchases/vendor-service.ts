import "server-only"

import { qs, serviceRequest, type Page } from "@/lib/service-client"
import type { PurchaseOrder, PurchaseStatus, Supplier } from "./types"

export const VENDOR_SERVICE_URL = (
  process.env.VENDOR_SERVICE_URL ?? "http://localhost:3003"
).replace(/\/+$/, "")

export const VENDOR_SERVICE = {
  name: "Vendor service",
  port: 3003,
  permission: "purchasing",
}

const request = <T>(token: string, path: string, init?: RequestInit) =>
  serviceRequest<T>(VENDOR_SERVICE_URL, token, path, init)

export interface NewPurchaseLine {
  size_id: string
  quantity: string
  unit_price: string
  discount_type?: string
  discount?: string
}

export interface NewPurchase {
  supplier_id: string
  invoice_no?: string
  order_date?: string
  status?: PurchaseStatus
  items: NewPurchaseLine[]
  discount_type?: string
  discount?: string
  cgst_rate?: string
  sgst_rate?: string
  igst_rate?: string
  notes?: string
  remarks?: string
  location_id?: string
}

export const vendorApi = {
  // ── Suppliers ────────────────────────────────────────────────────────
  suppliers: (
    token: string,
    params: { q?: string; status?: string; limit?: number } = {}
  ) => request<Page<Supplier>>(token, `/suppliers${qs(params)}`),
  supplier: (token: string, id: string) => request<Supplier>(token, `/suppliers/${id}`),
  createSupplier: (token: string, body: Partial<Supplier>) =>
    request<Supplier>(token, "/suppliers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSupplier: (token: string, id: string, body: Partial<Supplier>) =>
    request<Supplier>(token, `/suppliers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteSupplier: (token: string, id: string) =>
    request<{ id: string }>(token, `/suppliers/${id}`, { method: "DELETE" }),

  // ── Purchase orders ──────────────────────────────────────────────────
  purchases: (
    token: string,
    params: {
      q?: string
      status?: string
      supplier?: string
      from?: string
      to?: string
      limit?: number
    } = {}
  ) => request<Page<PurchaseOrder>>(token, `/purchases${qs(params)}`),
  purchase: (token: string, id: string) =>
    request<PurchaseOrder>(token, `/purchases/${id}`),
  createPurchase: (token: string, body: NewPurchase) =>
    request<PurchaseOrder>(token, "/purchases", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePurchase: (token: string, id: string, body: Partial<NewPurchase>) =>
    request<PurchaseOrder>(token, `/purchases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  setPurchaseStatus: (token: string, id: string, status: PurchaseStatus) =>
    request<PurchaseOrder>(token, `/purchases/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  /** Posts the stock in inventory-service and marks the order received. */
  receivePurchase: (token: string, id: string, body: { location_id?: string }) =>
    request<PurchaseOrder>(token, `/purchases/${id}/receive`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deletePurchase: (token: string, id: string) =>
    request<{ id: string }>(token, `/purchases/${id}`, { method: "DELETE" }),
}
