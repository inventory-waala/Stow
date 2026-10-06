import { INVENTORY_SERVICE_URL } from "./config"
import type {
  Barcode,
  Json,
  Location,
  Movement,
  MovementType,
  Page,
  Product,
  ProductListItem,
  ScannedSize,
  Size,
  SizeRef,
  StockLevel,
  Variant,
  VariantType,
} from "./types"

export class InventoryServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Per-field problems from JSON Schema validation, when present. */
    public readonly errors: string[] = []
  ) {
    super(message)
  }
}

/**
 * Server-side client for inventory-service. Same rules as lib/auth: only ever
 * called from server components and actions, so the access token stays in
 * httpOnly cookies.
 */
async function request<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${INVENTORY_SERVICE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const body = data as
      | { message?: string | string[] | { message?: string; errors?: string[] }; errors?: string[] }
      | null
    let message: unknown = body?.message ?? res.statusText
    let errors: string[] = body?.errors ?? []
    if (message && typeof message === "object" && !Array.isArray(message)) {
      errors = (message as { errors?: string[] }).errors ?? errors
      message = (message as { message?: string }).message ?? res.statusText
    }
    throw new InventoryServiceError(
      res.status,
      Array.isArray(message) ? message.join(", ") : String(message),
      errors
    )
  }
  return data as T
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

/** A size as posted with a new variant or added later. Prices optional. */
export interface NewSize {
  label?: string
  sku?: string
  cost_price?: string
  sell_price?: string
  barcodes?: Array<{ value: string }>
}

export interface NewVariant {
  name: string
  variant_type_id?: string
  attributes?: Json
  sizes?: NewSize[]
}

export const inventoryApi = {
  // ── Variant types ────────────────────────────────────────────────────
  variantTypes: (token: string) => request<VariantType[]>(token, "/variant-types"),
  createVariantType: (
    token: string,
    body: { key: string; name: string; description?: string; attribute_schema?: Json; axis_key?: string | null }
  ) => request<VariantType>(token, "/variant-types", { method: "POST", body: JSON.stringify(body) }),
  updateVariantType: (token: string, id: string, body: Partial<{ name: string; description: string; attribute_schema: Json; axis_key: string | null }>) =>
    request<VariantType>(token, `/variant-types/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteVariantType: (token: string, id: string) =>
    request<{ id: string }>(token, `/variant-types/${id}`, { method: "DELETE" }),

  // ── Locations ────────────────────────────────────────────────────────
  locations: (token: string) => request<Location[]>(token, "/locations"),
  createLocation: (token: string, body: { code: string; name: string; description?: string; parent_id?: string; is_default?: boolean }) =>
    request<Location>(token, "/locations", { method: "POST", body: JSON.stringify(body) }),
  deleteLocation: (token: string, id: string) =>
    request<{ id: string }>(token, `/locations/${id}`, { method: "DELETE" }),

  // ── Products ─────────────────────────────────────────────────────────
  products: (token: string, params: { q?: string; status?: string; limit?: number; offset?: number } = {}) =>
    request<Page<ProductListItem>>(token, `/products${qs(params)}`),
  product: (token: string, id: string) => request<Product>(token, `/products/${id}`),
  createProduct: (
    token: string,
    body: {
      name: string
      code?: string
      description?: string
      tags?: string[]
      attributes?: Json
      variants: NewVariant[]
    }
  ) => request<Product>(token, "/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (token: string, id: string, body: Partial<{ name: string; code: string | null; description: string | null; status: string; tags: string[]; attributes: Json }>) =>
    request<Product>(token, `/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (token: string, id: string) =>
    request<{ id: string }>(token, `/products/${id}`, { method: "DELETE" }),

  // ── Variants and sizes ───────────────────────────────────────────────
  createVariant: (token: string, productId: string, body: NewVariant) =>
    request<Variant>(token, `/products/${productId}/variants`, { method: "POST", body: JSON.stringify(body) }),
  updateVariant: (token: string, id: string, body: Partial<{ name: string; variant_type_id: string | null; attributes: Json }>) =>
    request<Variant>(token, `/variants/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteVariant: (token: string, id: string) =>
    request<{ id: string }>(token, `/variants/${id}`, { method: "DELETE" }),
  addSize: (token: string, variantId: string, body: NewSize) =>
    request<Size>(token, `/variants/${variantId}/sizes`, { method: "POST", body: JSON.stringify(body) }),
  updateSize: (token: string, id: string, body: Partial<{ label: string; sku: string | null; cost_price: string | null; sell_price: string | null }>) =>
    request<Size>(token, `/sizes/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSize: (token: string, id: string) =>
    request<{ id: string }>(token, `/sizes/${id}`, { method: "DELETE" }),
  addBarcode: (token: string, sizeId: string, body: { value: string; is_primary?: boolean }) =>
    request<Barcode>(token, `/sizes/${sizeId}/barcodes`, { method: "POST", body: JSON.stringify(body) }),
  deleteBarcode: (token: string, id: string) =>
    request<{ id: string }>(token, `/barcodes/${id}`, { method: "DELETE" }),
  lookupBarcode: (token: string, barcode: string) =>
    request<ScannedSize>(token, `/sizes/lookup${qs({ barcode })}`),

  // ── Stock ────────────────────────────────────────────────────────────
  stock: (token: string, params: { size?: string; variant?: string; product?: string; location?: string; below_reorder?: boolean; limit?: number } = {}) =>
    request<Page<StockLevel & { size: SizeRef }>>(token, `/stock${qs(params)}`),
  movements: (token: string, params: { size?: string; variant?: string; product?: string; location?: string; limit?: number; offset?: number } = {}) =>
    request<Page<Movement>>(token, `/stock/movements${qs(params)}`),
  move: (
    token: string,
    body: {
      size_id: string
      type: MovementType
      quantity?: string
      counted?: string
      from_location_id?: string
      to_location_id?: string
      reason?: string
      reference_type?: string
      reference_id?: string
    }
  ) => request<{ movement: Movement; levels: StockLevel[] }>(token, "/stock/movements", { method: "POST", body: JSON.stringify(body) }),
  setReorder: (token: string, body: { size_id: string; location_id?: string; reorder_at: string | null }) =>
    request<StockLevel>(token, "/stock/reorder", { method: "PUT", body: JSON.stringify(body) }),
}
