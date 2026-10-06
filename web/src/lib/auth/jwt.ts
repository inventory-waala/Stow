/**
 * Claims embedded by auth-service (see auth.service.ts `login`).
 * Decoded only — signature verification is the auth-service's job; the
 * frontend just needs to know who the token says it is and when it expires.
 */
export interface AccessClaims {
  id: string
  email: string
  name: string | null
  status: string
  is_email_verified: boolean
  tenant_id?: string
  roles?: string[]
  permissions?: string[]
  iat: number
  exp: number
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/")
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  // atob is available in both the Node and Edge runtimes.
  return atob(padded + pad)
}

export function decodeAccessToken(
  token: string | undefined | null
): AccessClaims | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as AccessClaims
  } catch {
    return null
  }
}

/** True when the token is missing, malformed, or expires within `skewSeconds`. */
export function isExpired(
  claims: AccessClaims | null,
  skewSeconds = 30
): boolean {
  if (!claims?.exp) return true
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000
}
