import "server-only"

/**
 * Shared plumbing for the backend services the app talks to.
 *
 * lib/inventory predates this and keeps its own copy; vendor-service and
 * transaction-service behave identically, so they share one implementation
 * rather than a third and fourth near-duplicate.
 */
export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Per-field problems from DTO validation, when present. */
    public readonly errors: string[] = []
  ) {
    super(message)
  }
}

/**
 * Only ever called from server components and actions, so the access token
 * stays in httpOnly cookies and never reaches browser JavaScript.
 */
export async function serviceRequest<T>(
  baseUrl: string,
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
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
      | {
          message?: string | string[] | { message?: string; errors?: string[] }
          errors?: string[]
        }
      | null
    let message: unknown = body?.message ?? res.statusText
    let errors: string[] = body?.errors ?? []
    // Nest wraps a forwarded upstream error as { statusCode, message, source }.
    if (message && typeof message === "object" && !Array.isArray(message)) {
      errors = (message as { errors?: string[] }).errors ?? errors
      message = (message as { message?: string }).message ?? res.statusText
    }
    throw new ServiceError(
      res.status,
      Array.isArray(message) ? message.join(", ") : String(message),
      errors
    )
  }
  return data as T
}

export function qs(
  params: Record<string, string | number | boolean | undefined>
): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

/** What a filtered document list is worth, aggregated server-side. */
export interface ListSummary {
  count: number
  total_amount: string
  by_status: Record<string, { count: number; total_amount: string }>
}

export interface SummarisedPage<T> extends Page<T> {
  summary: ListSummary
}

/** `{ ok }` so a page can render a notice instead of crashing when a service is down. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string }

export function describeServiceError(
  err: unknown,
  service: { name: string; port: number; permission: string }
): string {
  if (err instanceof ServiceError) {
    if (err.status === 403) {
      return `Your workspace role doesn't allow this. Ask an owner for ${service.permission} access.`
    }
    return err.errors.length ? `${err.message}: ${err.errors.join("; ")}` : err.message
  }
  if (err instanceof Error && /fetch failed|ECONNREFUSED/i.test(err.message)) {
    return `${service.name} is unreachable. Is it running on port ${service.port}?`
  }
  return err instanceof Error ? err.message : "Something went wrong"
}
