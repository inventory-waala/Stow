import type { Json } from "./types"
import { coerceBySchema } from "./schema-builder"

/**
 * Expands bracketed form names (`variants[0][opt][size]=M`) into nested
 * objects — the same convention qs uses — so dynamic forms can post rows.
 * Numeric segments still become object keys; call `rows()` to get an array.
 */
export function nest(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string") continue
    const parts = name.split(/\[|\]\[|\]/).filter((p) => p !== "")
    let cur: Record<string, unknown> = out
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (i === parts.length - 1) {
        cur[p] = value
      } else {
        const next = cur[p]
        if (typeof next !== "object" || next === null) cur[p] = {}
        cur = cur[p] as Record<string, unknown>
      }
    }
  }
  return out
}

/** `{0: {...}, 1: {...}}` → `[{...}, {...}]` in key order. */
export function rows<T = Record<string, string>>(v: unknown): T[] {
  if (!v || typeof v !== "object") return []
  return Object.keys(v as object)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => (v as Record<string, T>)[k])
}

function flat(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as object)) if (typeof val === "string") out[k] = val
  return out
}

/**
 * Reads one JSON-object field as the UI posts it: either the advanced JSON
 * textarea (`<name>_json`), or typed inputs (`<name>[key]`) plus free-form
 * key/value rows (`<name>_kv[i][key|value]`). Throws with a user message.
 */
export function readObject(
  data: Record<string, unknown>,
  name: string,
  schema: Json | undefined | null,
  label: string
): Json {
  const json = typeof data[`${name}_json`] === "string" ? (data[`${name}_json`] as string).trim() : ""
  if (json) {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error(`${label} must be a JSON object like {"key": "value"}`)
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object like {"key": "value"}`)
    }
    return parsed as Json
  }
  const values = flat(data[name])
  for (const kv of rows<{ key?: string; value?: string }>(data[`${name}_kv`])) {
    const key = kv.key?.trim()
    if (!key) continue
    if (!/^[A-Za-z_][A-Za-z0-9_ -]*$/.test(key)) {
      throw new Error(`${label}: "${key}" is not a valid field name`)
    }
    values[key] = kv.value ?? ""
  }
  return coerceBySchema(schema, values)
}
