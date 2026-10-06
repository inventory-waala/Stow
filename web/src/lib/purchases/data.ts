import "server-only"
import { cache } from "react"

import { describeServiceError, type Loaded } from "@/lib/service-client"
import { requireToken } from "@/lib/inventory/data"
import { vendorApi, VENDOR_SERVICE } from "./vendor-service"

export const describeError = (err: unknown) =>
  describeServiceError(err, VENDOR_SERVICE)

async function load<T>(fn: (token: string) => Promise<T>): Promise<Loaded<T>> {
  const token = await requireToken()
  try {
    return { ok: true, data: await fn(token) }
  } catch (err) {
    return { ok: false, error: describeError(err) }
  }
}

export const getSuppliers = cache((params: { q?: string; status?: string } = {}) =>
  load((t) => vendorApi.suppliers(t, { ...params, limit: 200 }))
)
export const getSupplier = cache((id: string) => load((t) => vendorApi.supplier(t, id)))
export const getPurchases = cache(
  (
    params: {
      q?: string
      status?: string
      supplier?: string
      min_amount?: string
      max_amount?: string
    } = {}
  ) => load((t) => vendorApi.purchases(t, { ...params, limit: 100 }))
)
export const getPurchase = cache((id: string) => load((t) => vendorApi.purchase(t, id)))
