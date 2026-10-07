import { NextResponse, type NextRequest } from "next/server"

import {
  AUTH_PATHS,
  AUTH_SERVICE_URL,
  COOKIE,
  PUBLIC_PATHS,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/config"
import { decodeAccessToken, isExpired } from "@/lib/auth/jwt"

/** The only route a signed-in user without a workspace may reach. */
const NEW_WORKSPACE_PATH = "/workspace/new"

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
      const next = destinationFor(
        request,
        decodeAccessToken(refreshed.accessToken),
        isAuthPage
      )
      const response = next
        ? NextResponse.redirect(new URL(next, request.url))
        : NextResponse.next()
      setCookie(response, COOKIE.access, refreshed.accessToken)
      if (refreshed.refreshToken) {
        setCookie(response, COOKIE.refresh, refreshed.refreshToken)
      }
      return response
    }
  }

  if (authenticated) {
    const next = destinationFor(request, claims, isAuthPage)
    return next
      ? NextResponse.redirect(new URL(next, request.url))
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

/**
 * Where a signed-in request should actually go, or null to let it through.
 *
 * Registration no longer creates a workspace, so a fresh account has no
 * tenant_id on its token. Until it has one it cannot read or write anything —
 * every service scopes by tenant — so it is held at the create-workspace
 * screen rather than being shown an app full of empty states and 403s.
 */
function destinationFor(
  request: NextRequest,
  claims: ReturnType<typeof decodeAccessToken>,
  isAuthPage: boolean
): string | null {
  const { pathname } = request.nextUrl
  if (!claims?.tenant_id) {
    // The marketing and legal pages belong to everyone; it is the app that
    // needs a workspace.
    if (pathname === NEW_WORKSPACE_PATH || PUBLIC_PATHS.includes(pathname)) {
      return null
    }
    return NEW_WORKSPACE_PATH
  }
  // Someone with a workspace has no business on the create screen unless they
  // asked for it; only the signed-out pages bounce them to the dashboard.
  return isAuthPage ? "/dashboard" : null
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
