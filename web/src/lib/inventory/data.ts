import "server-only"
import { redirect } from "next/navigation"
import { cache } from "react"

import { getSession } from "@/lib/auth/session"
import { inventoryApi, InventoryServiceError } from "./inventory-service"

/**
 * Read helpers for server components. Each returns `{ data }` or `{ error }`
 * so a page can render a "service unreachable" notice instead of crashing
 * when inventory-service is down — the rest of the app must keep working.
 */
export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string }

export async function requireToken(): Promise<string> {
  const session = await getSession()
  if (!session) redirect("/login")
  return session.accessToken
}

export function describeError(err: unknown): string {
  if (err instanceof InventoryServiceError) {
    if (err.status === 403) {
      return "Your workspace role doesn't allow this. Ask an owner for inventory access."
    }
    return err.errors.length ? `${err.message}: ${err.errors.join("; ")}` : err.message
  }
  if (err instanceof Error && /fetch failed|ECONNREFUSED/i.test(err.message)) {
    return "Inventory service is unreachable. Is it running on port 3002?"
  }
  return err instanceof Error ? err.message : "Something went wrong"
}

async function load<T>(fn: (token: string) => Promise<T>): Promise<Loaded<T>> {
  const token = await requireToken()
  try {
    return { ok: true, data: await fn(token) }
  } catch (err) {
    return { ok: false, error: describeError(err) }
  }
}

export const getProducts = cache((params: { q?: string; status?: string } = {}) =>
  load((t) => inventoryApi.products(t, { ...params, limit: 100 }))
)
export const getProduct = cache((id: string) => load((t) => inventoryApi.product(t, id)))
export const getVariantTypes = cache(() => load((t) => inventoryApi.variantTypes(t)))
export const getLocations = cache(() => load((t) => inventoryApi.locations(t)))
export const getMovements = cache((params: { variant?: string; product?: string; limit?: number } = {}) =>
  load((t) => inventoryApi.movements(t, { limit: 50, ...params }))
)
export const getLowStock = cache(() =>
  load((t) => inventoryApi.stock(t, { below_reorder: true, limit: 50 }))
)
