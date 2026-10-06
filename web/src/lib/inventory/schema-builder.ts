import type { Json } from "./types"

/**
 * The user-facing model of a JSON Schema: a flat list of typed fields. The
 * builder writes schemas in this shape and reads them back; a schema written
 * by hand that uses constructs we don't model is still preserved via the
 * "advanced" JSON editor, and any properties we do understand render as fields.
 */
export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "integer"
  | "boolean"
  | "select"
  | "date"
  | "url"
  | "email"

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  required: boolean
  /** Only for `select`. */
  options: string[]
  /** Only for `number` / `integer`: inclusive bounds and step (JSON Schema minimum / maximum / multipleOf). */
  min?: number
  max?: number
  step?: number
  /**
   * The one field of a variant type whose values each get their own price
   * and stock (Size, Capacity, Pack…). Only text / choice fields qualify.
   * Stored as the schema's `x-axis` keyword and mirrored to `axis_key`.
   */
  axis?: boolean
}

/** Field types that may split stock: their values become the size labels. */
export const AXIS_TYPES: ReadonlySet<FieldType> = new Set<FieldType>(["text", "select"])

export const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "longtext", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Whole number" },
  { value: "boolean", label: "Yes / no" },
  { value: "select", label: "Choice" },
  { value: "date", label: "Date" },
  { value: "url", label: "Link (URL)" },
  { value: "email", label: "Email" },
]

export const KEY_RE = /^[a-z][a-z0-9_]*$/

export function fieldsToSchema(fields: FieldDef[]): Json {
  const properties: Record<string, Json> = {}
  const required: string[] = []
  for (const f of fields) {
    const prop: Json = { title: f.label || f.key }
    switch (f.type) {
      case "text":
        prop.type = "string"
        break
      case "longtext":
        prop.type = "string"
        // Custom keyword; the API's Ajv runs with strict off, so it's ignored there.
        prop["x-ui"] = "textarea"
        break
      case "number":
      case "integer":
        prop.type = f.type
        if (f.min !== undefined) prop.minimum = f.min
        if (f.max !== undefined) prop.maximum = f.max
        if (f.step !== undefined && f.step > 0) prop.multipleOf = f.step
        break
      case "boolean":
        prop.type = "boolean"
        break
      case "date":
        prop.type = "string"
        prop.format = "date"
        break
      case "url":
        prop.type = "string"
        prop.format = "uri"
        break
      case "email":
        prop.type = "string"
        prop.format = "email"
        break
      case "select":
        prop.type = "string"
        prop.enum = f.options
        break
    }
    properties[f.key] = prop
    if (f.required) required.push(f.key)
  }
  // jsonb does not keep key order, so the builder's order is stored explicitly.
  const schema: Json = { type: "object", properties, "x-order": fields.map((f) => f.key) }
  if (required.length) schema.required = required
  const axis = fields.find((f) => f.axis && AXIS_TYPES.has(f.type))
  if (axis) schema["x-axis"] = axis.key
  return schema
}

/** The key the schema marks as splitting stock, if any. */
export function axisKeyOf(schema: Json | undefined | null): string | null {
  const k = schema?.["x-axis"]
  return typeof k === "string" && k ? k : null
}

export function schemaToFields(schema: Json | undefined | null): FieldDef[] {
  const props = (schema?.properties ?? {}) as Record<string, Json>
  const required = new Set((schema?.required as string[] | undefined) ?? [])
  const order = Array.isArray(schema?.["x-order"]) ? (schema!["x-order"] as string[]) : []
  const rank = (k: string) => {
    const i = order.indexOf(k)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const axis = axisKeyOf(schema)
  const entries = Object.entries(props).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
  return entries.map(([key, p]) => {
    const t = Array.isArray(p.type) ? p.type[0] : p.type
    let type: FieldType = "text"
    if (Array.isArray(p.enum)) type = "select"
    else if (t === "number") type = "number"
    else if (t === "integer") type = "integer"
    else if (t === "boolean") type = "boolean"
    else if (t === "string" && p.format === "date") type = "date"
    else if (t === "string" && p.format === "uri") type = "url"
    else if (t === "string" && p.format === "email") type = "email"
    else if (t === "string" && p["x-ui"] === "textarea") type = "longtext"
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)
    return {
      key,
      label: typeof p.title === "string" ? p.title : key,
      type,
      required: required.has(key),
      options: Array.isArray(p.enum) ? p.enum.map(String) : [],
      min: num(p.minimum),
      max: num(p.maximum),
      step: num(p.multipleOf),
      axis: key === axis,
    }
  })
}

/** True when the schema only uses constructs the builder can round-trip. */
export function isBuilderCompatible(schema: Json | undefined | null): boolean {
  if (!schema || Object.keys(schema).length === 0) return true
  const allowedTop = new Set(["type", "properties", "required", "$schema", "title", "additionalProperties", "x-order", "x-axis"])
  if (Object.keys(schema).some((k) => !allowedTop.has(k))) return false
  const props = (schema.properties ?? {}) as Record<string, Json>
  const allowedProp = new Set(["type", "title", "enum", "format", "description", "x-ui", "minimum", "maximum", "multipleOf"])
  const allowedFormat = new Set(["date", "uri", "email"])
  return Object.values(props).every((p) => {
    if (Object.keys(p).some((k) => !allowedProp.has(k))) return false
    if (p.format !== undefined && !allowedFormat.has(String(p.format))) return false
    const t = p.type
    return t === "string" || t === "number" || t === "integer" || t === "boolean"
  })
}

/**
 * Turns flat form values (`field[key]=...`) into a JSON object typed per the
 * schema, so the API's JSON Schema validation sees numbers as numbers. Keys
 * absent from the schema are kept as strings (free-form extras).
 */
export function coerceBySchema(
  schema: Json | undefined | null,
  values: Record<string, string>
): Json {
  const fields = new Map(schemaToFields(schema).map((f) => [f.key, f]))
  const out: Json = {}
  for (const [key, raw] of Object.entries(values)) {
    const f = fields.get(key)
    const v = raw.trim()
    if (!f) {
      if (v !== "") out[key] = v
      continue
    }
    if (f.type === "boolean") {
      out[key] = raw === "on" || raw === "true"
      continue
    }
    if (v === "") continue
    if (f.type === "number" || f.type === "integer") {
      const n = Number(v)
      out[key] = Number.isFinite(n) ? n : v
    } else {
      out[key] = v
    }
  }
  // Unchecked checkboxes don't submit; they mean "no" for boolean fields.
  for (const f of fields.values()) {
    if (f.type === "boolean" && !(f.key in out)) out[f.key] = false
  }
  return out
}

// ── Common fields ──────────────────────────────────────────────────────────
//
// Distilled from schema.org/Product, Shopify (Product + InventoryItem),
// WooCommerce product/variation properties and GS1 attributes. Any of the
// "Stock split" ones can be ticked as the field that splits stock.

export interface FieldPreset extends FieldDef {
  group: string
}

const f = (
  group: string,
  key: string,
  label: string,
  type: FieldType = "text",
  options: string[] = [],
  bounds: { min?: number; max?: number; step?: number } = {}
): FieldPreset => ({ group, key, label, type, required: false, options, ...bounds })

export const PRESETS: FieldPreset[] = [
  f("Stock split", "size", "Size", "select", ["XS", "S", "M", "L", "XL", "XXL"]),
  f("Stock split", "capacity", "Capacity"),
  f("Stock split", "pack_size", "Pack size", "select", ["1", "6", "12", "24"]),
  f("Stock split", "length", "Length"),
  f("Stock split", "voltage", "Voltage", "select", ["110 V", "220 V", "240 V"]),
  f("Stock split", "grade", "Grade", "select", ["A", "B", "C"]),

  f("Appearance", "colour", "Colour"),
  f("Appearance", "shade", "Shade"),
  f("Appearance", "pattern", "Pattern"),
  f("Appearance", "finish", "Finish"),
  f("Appearance", "style", "Style"),
  f("Appearance", "material", "Material"),
  f("Appearance", "flavour", "Flavour"),
  f("Appearance", "scent", "Scent"),

  f("Sourcing", "supplier_sku", "Supplier SKU"),
  f("Sourcing", "mpn", "Manufacturer part number (MPN)"),
  f("Sourcing", "brand", "Brand"),
  f("Sourcing", "country_of_origin", "Country of origin"),
  f("Sourcing", "hs_code", "HS / tariff code"),
  f("Sourcing", "lead_time_days", "Lead time (days)", "integer", [], { min: 0 }),
  f("Sourcing", "min_order_qty", "Minimum order quantity", "integer", [], { min: 1 }),

  f("Physical", "weight_g", "Weight (g)", "number", [], { min: 0 }),
  f("Physical", "length_cm", "Length (cm)", "number"),
  f("Physical", "width_cm", "Width (cm)", "number"),
  f("Physical", "height_cm", "Height (cm)", "number"),

  f("Commerce", "list_price", "List price / MRP", "number", [], { min: 0 }),
  f("Commerce", "tax_rate_pct", "Tax rate (%)", "number", [], { min: 0, max: 100 }),
  f("Commerce", "warranty_months", "Warranty (months)", "integer", [], { min: 0 }),
  f("Commerce", "shelf_life_days", "Shelf life (days)", "integer", [], { min: 0 }),
  f("Commerce", "perishable", "Perishable", "boolean"),
  f("Commerce", "hazardous", "Hazardous material", "boolean"),
  f("Commerce", "shelf_location", "Shelf location"),
  f("Commerce", "expiry_tracked", "Track expiry dates", "boolean"),
  f("Commerce", "notes", "Notes", "longtext"),
]

// ── Templates ──────────────────────────────────────────────────────────────

/** A starting point for a variant type: its fields, one of which may split stock. */
export interface VariantTypeTemplate {
  id: string
  name: string
  description: string
  fields: FieldDef[]
}

const pick = (...keys: string[]): FieldDef[] =>
  keys.map((k) => {
    const p = PRESETS.find((x) => x.key === k)
    if (!p) throw new Error(`unknown preset ${k}`)
    const { group: _group, ...def } = p
    void _group
    return { ...def }
  })

const mark = (fields: FieldDef[], opts: { required?: string[]; axis?: string }) =>
  fields.map((x) => ({
    ...x,
    required: opts.required?.includes(x.key) ?? x.required,
    axis: x.key === opts.axis,
  }))

export const VARIANT_TYPE_TEMPLATES: VariantTypeTemplate[] = [
  {
    id: "sized-apparel",
    name: "Sized apparel",
    description: "A colour or style that comes in clothing sizes — stock split by Size.",
    fields: mark(pick("colour", "size", "supplier_sku"), { required: ["colour", "size"], axis: "size" }),
  },
  {
    id: "footwear",
    name: "Footwear",
    description: "A colour that comes in shoe sizes.",
    fields: mark(
      [...pick("colour"), f("", "size", "Size", "select", ["5", "6", "7", "8", "9", "10", "11", "12"])],
      { required: ["colour", "size"], axis: "size" }
    ),
  },
  {
    id: "bottled",
    name: "Bottled / packaged",
    description: "A flavour or scent sold in several capacities — any capacity, typed per variant.",
    fields: mark(pick("flavour", "capacity"), { required: ["capacity"], axis: "capacity" }),
  },
  {
    id: "packs",
    name: "Multipack",
    description: "The same item sold in packs of different counts.",
    fields: mark(pick("pack_size"), { required: ["pack_size"], axis: "pack_size" }),
  },
  {
    id: "single",
    name: "Single item",
    description: "One stock line per variant — nothing splits it.",
    fields: pick("colour", "mpn"),
  },
]
