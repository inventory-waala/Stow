import "server-only"
import { cache } from "react"

import { describeServiceError, type Loaded } from "@/lib/service-client"
import { requireToken } from "@/lib/inventory/data"
import { transactionApi, TRANSACTION_SERVICE } from "./transaction-service"

export const describeError = (err: unknown) =>
  describeServiceError(err, TRANSACTION_SERVICE)

async function load<T>(fn: (token: string) => Promise<T>): Promise<Loaded<T>> {
  const token = await requireToken()
  try {
    return { ok: true, data: await fn(token) }
  } catch (err) {
    return { ok: false, error: describeError(err) }
  }
}

export const getCustomers = cache((params: { q?: string; status?: string } = {}) =>
  load((t) => transactionApi.customers(t, { ...params, limit: 200 }))
)
export const getCustomer = cache((id: string) =>
  load((t) => transactionApi.customer(t, id))
)
export const getOrders = cache(
  (params: { q?: string; status?: string; customer?: string } = {}) =>
    load((t) => transactionApi.orders(t, { ...params, limit: 100 }))
)
export const getOrder = cache((id: string) => load((t) => transactionApi.order(t, id)))
