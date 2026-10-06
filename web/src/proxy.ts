import { NextResponse, type NextRequest } from "next/server"

import {
  AUTH_PATHS,
  AUTH_SERVICE_URL,
  COOKIE,
  PUBLIC_PATHS,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/config"
import { decodeAccessToken, isExpired } from "@/lib/auth/jwt"

/**
 * Runs before every page request:
 *  - silently refreshes an expired access token using the refresh cookie
 *  - sends signed-out users to /login and signed-in users away from it
 *
 * Cookie writes here are what let server components stay read-only.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthPage = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
  const isPublic = isAuthPage || PUBLIC_PATHS.includes(pathname)

  const accessToken = request.cookies.get(COOKIE.access)?.value
  const refreshToken = request.cookies.get(COOKIE.refresh)?.value
  const claims = decodeAccessToken(accessToken)

  let authenticated = !!accessToken && !isExpired(claims)

  if (!authenticated && claims?.id && refreshToken) {
    // Pass the workspace the expiring token was in so the refreshed token
    // stays there; without it auth-service falls back to the first tenant.
    const refreshed = await tryRefresh(claims.id, refreshToken, claims.tenant_id)
    if (refreshed) {
      authenticated = true
      const response = isAuthPage
        ? NextResponse.redirect(new URL("/dashboard", request.url))
        : NextResponse.next()
      setCookie(response, COOKIE.access, refreshed.accessToken)
      if (refreshed.refreshToken) {
        setCookie(response, COOKIE.refresh, refreshed.refreshToken)
      }
      return response
    }
  }

  if (authenticated) {
    return isAuthPage
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next()
  }

  let response: NextResponse
  if (isPublic) {
    response = NextResponse.next()
  } else {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", pathname)
    response = NextResponse.redirect(login)
  }
  // Drop stale cookies so we don't retry a dead refresh token on every hit.
  if (accessToken || refreshToken) {
    response.cookies.delete(COOKIE.access)
    response.cookies.delete(COOKIE.refresh)
  }
  return response
}

async function tryRefresh(userId: string, token: string, tenantId?: string) {
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, token, tenant_id: tenantId }),
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as { accessToken: string; refreshToken?: string }
  } catch {
    return null
  }
}

function setCookie(res: NextResponse, name: string, value: string) {
  res.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export const config = {
  // Everything except Next internals, static assets and generated metadata routes.
  matcher: [
    "/((?!_next/static|_next/image|opengraph-image|twitter-image|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
