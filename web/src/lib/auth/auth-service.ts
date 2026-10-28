import { AUTH_SERVICE_URL } from "./config"

export interface TokenPair {
  accessToken: string
  refreshToken?: string
}

export interface Tenant {
  id: string
  name: string
  description?: string | null
  /** Row version: used to remount forms whose defaults came from this row. */
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  name: string | null
  status: string
  is_email_verified: boolean
  tenant_id: string | null
  roles: string[]
  permissions: string[]
}

export class AuthServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

/**
 * Minimal server-side client for auth-service. Every function runs on the
 * Next.js server (server components, actions, proxy) — never in the browser,
 * so tokens never leave httpOnly cookies.
 */
export async function authRequest<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<T> {
  const { accessToken, headers, ...rest } = init
  const res = await fetch(`${AUTH_SERVICE_URL}${path}`, {
    ...rest,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
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
    const message =
      (data as { message?: string | string[] } | null)?.message ??
      res.statusText
    throw new AuthServiceError(
      res.status,
      Array.isArray(message) ? message.join(", ") : String(message)
    )
  }
  return data as T
}

export const authApi = {
  login: (body: { email: string; password: string; tenant_id?: string }) =>
    authRequest<TokenPair>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  register: (body: { email: string; password: string; name?: string }) =>
    authRequest<{ id: string; email: string; verificationToken: string }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) }
    ),

  verifyEmail: (token: string) =>
    authRequest<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  refresh: (body: { user_id: string; token: string; tenant_id?: string }) =>
    authRequest<TokenPair>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: (body: { user_id: string; token: string }) =>
    authRequest<{ message: string }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (accessToken: string) => authRequest<Profile>("/auth/me", { accessToken }),

  myTenants: (accessToken: string) =>
    authRequest<Tenant[]>("/tenants/me", { accessToken }),

  createTenant: (
    accessToken: string,
    body: { name: string; description?: string }
  ) =>
    authRequest<Tenant>("/tenants", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken,
    }),

  /** Edits the workspace on the token; the server ignores any other id. */
  updateTenant: (
    accessToken: string,
    body: { name?: string; description?: string }
  ) =>
    authRequest<Tenant>("/tenants/me", {
      method: "PATCH",
      body: JSON.stringify(body),
      accessToken,
    }),

  switchTenant: (accessToken: string, tenant_id: string) =>
    authRequest<{ accessToken: string }>("/auth/switch-tenant", {
      method: "POST",
      body: JSON.stringify({ tenant_id }),
      accessToken,
    }),

  resetPassword: (token: string, newPassword: string) =>
    authRequest<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  // ── Passkeys (WebAuthn). Options/response bodies are opaque to us; the
  //    browser side is handled by @simplewebauthn/browser.
  passkeyRegisterOptions: (email: string) =>
    authRequest<Record<string, unknown>>(
      `/passkeys/register/generate-options?email=${encodeURIComponent(email)}`
    ),

  passkeyRegisterVerify: (email: string, response: unknown) =>
    authRequest<{ success: boolean }>("/passkeys/register/verify", {
      method: "POST",
      body: JSON.stringify({ email, response }),
    }),

  passkeyLoginOptions: (email: string) =>
    authRequest<Record<string, unknown>>(
      `/passkeys/authenticate/generate-options?email=${encodeURIComponent(email)}`
    ),

  passkeyLoginVerify: (response: unknown) =>
    authRequest<TokenPair & { success: boolean }>(
      "/passkeys/authenticate/verify",
      { method: "POST", body: JSON.stringify({ response }) }
    ),

  forgotPassword: (email: string) =>
    authRequest<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
}
