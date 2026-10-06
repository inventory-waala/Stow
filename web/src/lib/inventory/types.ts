/** Shapes returned by inventory-service. Decimals arrive as strings. */

export type ProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED"
export type MovementType = "IN" | "OUT" | "ADJUST" | "TRANSFER"

export type Json = Record<string, unknown>

export interface StockTotals {
  quantity: string
  reserved: string
  available: string
}

/**
 * What a variant records. `axis_key` names the one field whose values each
 * get their own price and stock; the service spells it out as `axis_label`
 * (the field's title), `axis_values` (its choices, empty when the field is
 * free text — `axis_free`). Null axis: the variant is a single stock unit.
 */
export interface VariantType {
  id: string
  key: string
  name: string
  description: string | null
  attribute_schema: Json
  axis_key: string | null
  axis_label: string | null
  axis_values: string[]
  axis_free: boolean
  created_at: string
  updated_at: string
  _count?: { variants: number }
}

export type VariantTypeSummary = Pick<VariantType, "id" | "key" | "name" | "axis_key" | "axis_label" | "axis_values" | "axis_free" | "attribute_schema">

export interface Category {
  id: string
  slug: string
  name: string
  parent_id: string | null
}

export interface Location {
  id: string
  code: string
  name: string
  description: string | null
  parent_id: string | null
  is_default: boolean
  created_at: string
  _count?: { stock: number; children: number }
}

export interface Barcode {
  id: string
  value: string
  type: string
  is_primary: boolean
}

export interface StockLevel {
  id: string
  quantity: string
  reserved: string
  reorder_at: string | null
  location: Pick<Location, "id" | "code" | "name">
}

/** The stockable unit: one per size of a variant ("Default" when single-unit). */
export interface Size {
  id: string
  label: string
  sku: string | null
  cost_price: string | null
  sell_price: string | null
  currency: string
  unit: string
  sort: number
  attributes: Json
  barcodes: Barcode[]
  stock: StockLevel[]
  stock_totals: StockTotals
}

export interface Variant {
  id: string
  name: string
  status: ProductStatus
  supplier_id: string | null
  attributes: Json
  variant_type: VariantTypeSummary | null
  sizes: Size[]
  stock_totals: StockTotals
}

/** What `GET /sizes/lookup?barcode=` returns: the size with its variant and product. */
export interface ScannedSize extends Size {
  variant: {
    id: string
    name: string
    attributes: Json
    product: { id: string; name: string; code: string | null }
    variant_type: VariantTypeSummary | null
  }
}

/** What stock rows and movements carry to name their size. */
export interface SizeRef {
  id: string
  label: string
  sku: string | null
  unit: string
  variant: { id: string; name: string; product: { id: string; name: string; code: string | null } }
}

/** A stock line as the product list carries it — enough to pick it and move stock. */
export interface ListSize {
  id: string
  label: string
  sku: string | null
  unit: string
  sell_price: string | null
  currency: string
  barcodes: Array<Pick<Barcode, "value" | "is_primary">>
  stock_totals: StockTotals
}

export interface ProductListItem {
  id: string
  code: string | null
  name: string
  status: ProductStatus
  tags: string[]
  attributes: Json
  updated_at: string
  category: Pick<Category, "id" | "slug" | "name"> | null
  variants: Array<{ id: string; name: string; sizes: ListSize[]; stock_totals: StockTotals }>
  variant_count: number
  size_count: number
  stock: StockTotals
}

export interface Product extends Omit<ProductListItem, "variant_count" | "size_count" | "variants"> {
  description: string | null
  variants: Variant[]
}

export interface Movement {
  id: string
  type: MovementType
  quantity: string
  reason: string | null
  reference_type: string | null
  reference_id: string | null
  payload: Json
  occurred_at: string
  size: SizeRef
  from_location: Pick<Location, "id" | "code" | "name"> | null
  to_location: Pick<Location, "id" | "code" | "name"> | null
}

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
