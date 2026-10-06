import "server-only"
import { cookies } from "next/headers"
import { cache } from "react"

import {
  authApi,
  AuthServiceError,
  type Profile,
  type Tenant,
} from "./auth-service"
import { COOKIE, SESSION_MAX_AGE_SECONDS } from "./config"
import { decodeAccessToken, isExpired, type AccessClaims } from "./jwt"

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
}

/** Only callable from Server Actions / Route Handlers (Next forbids cookie writes in RSC). */
export async function setSessionCookies(tokens: {
  accessToken: string
  refreshToken?: string
}) {
  const store = await cookies()
  store.set(COOKIE.access, tokens.accessToken, cookieOptions)
  if (tokens.refreshToken) {
    store.set(COOKIE.refresh, tokens.refreshToken, cookieOptions)
  }
}

export async function clearSessionCookies() {
  const store = await cookies()
  store.delete(COOKIE.access)
  store.delete(COOKIE.refresh)
}

export async function getTokens() {
  const store = await cookies()
  return {
    accessToken: store.get(COOKIE.access)?.value,
    refreshToken: store.get(COOKIE.refresh)?.value,
  }
}

/**
 * Claims from the access-token cookie, or null when absent/expired.
 * proxy.ts refreshes expired tokens before a request reaches a page, so a
 * null here means the user is genuinely signed out.
 */
export const getSession = cache(
  async (): Promise<{ claims: AccessClaims; accessToken: string } | null> => {
    const { accessToken } = await getTokens()
    const claims = decodeAccessToken(accessToken)
    if (!accessToken || !claims || isExpired(claims)) return null
    return { claims, accessToken }
  }
)

/** Fresh profile from auth-service (`GET /auth/me`) for the current session. */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const session = await getSession()
  if (!session) return null
  try {
    return await authApi.me(session.accessToken)
  } catch (err) {
    if (err instanceof AuthServiceError && err.status === 401) return null
    throw err
  }
})

export const getMyTenants = cache(async (): Promise<Tenant[]> => {
  const session = await getSession()
  if (!session) return []
  return authApi.myTenants(session.accessToken)
})
