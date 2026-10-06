import "server-only"

import { qs, serviceRequest, type Page } from "@/lib/service-client"
import type { Customer, Order, OrderStatus } from "./types"

export const TRANSACTION_SERVICE_URL = (
  process.env.TRANSACTION_SERVICE_URL ?? "http://localhost:3004"
).replace(/\/+$/, "")

export const TRANSACTION_SERVICE = {
  name: "Transaction service",
  port: 3004,
  permission: "order",
}

const request = <T>(token: string, path: string, init?: RequestInit) =>
  serviceRequest<T>(TRANSACTION_SERVICE_URL, token, path, init)

export interface NewOrderLine {
  size_id: string
  quantity: string
  rate?: string
  discount_type?: string
  discount?: string
}

export interface NewOrder {
  customer_id: string
  invoice_no?: string
  order_date?: string
  status?: OrderStatus
  items: NewOrderLine[]
  discount_type?: string
  discount?: string
  special_discount_type?: string
  special_discount?: string
  cgst_rate?: string
  sgst_rate?: string
  igst_rate?: string
  notes?: string
  remarks?: string
  location_id?: string
}

export const transactionApi = {
  // ── Customers ────────────────────────────────────────────────────────
  customers: (
    token: string,
    params: { q?: string; status?: string; limit?: number } = {}
  ) => request<Page<Customer>>(token, `/customers${qs(params)}`),
  customer: (token: string, id: string) => request<Customer>(token, `/customers/${id}`),
  createCustomer: (token: string, body: Partial<Customer>) =>
    request<Customer>(token, "/customers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCustomer: (token: string, id: string, body: Partial<Customer>) =>
    request<Customer>(token, `/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteCustomer: (token: string, id: string) =>
    request<{ id: string }>(token, `/customers/${id}`, { method: "DELETE" }),

  // ── Orders ───────────────────────────────────────────────────────────
  orders: (
    token: string,
    params: {
      q?: string
      status?: string
      customer?: string
      from?: string
      to?: string
      limit?: number
    } = {}
  ) => request<Page<Order>>(token, `/orders${qs(params)}`),
  order: (token: string, id: string) => request<Order>(token, `/orders/${id}`),
  createOrder: (token: string, body: NewOrder) =>
    request<Order>(token, "/orders", { method: "POST", body: JSON.stringify(body) }),
  updateOrder: (token: string, id: string, body: Partial<NewOrder>) =>
    request<Order>(token, `/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  setOrderStatus: (token: string, id: string, status: OrderStatus) =>
    request<Order>(token, `/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  /** Reserves stock without shipping it. */
  confirmOrder: (token: string, id: string) =>
    request<Order>(token, `/orders/${id}/confirm`, { method: "POST" }),
  /** Releases the reservation and posts the stock out. */
  fulfilOrder: (token: string, id: string, body: { location_id?: string }) =>
    request<Order>(token, `/orders/${id}/fulfil`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelOrder: (token: string, id: string) =>
    request<Order>(token, `/orders/${id}/cancel`, { method: "POST" }),
  deleteOrder: (token: string, id: string) =>
    request<{ id: string }>(token, `/orders/${id}`, { method: "DELETE" }),
}
