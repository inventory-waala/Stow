export const AUTH_SERVICE_URL = (
  process.env.AUTH_SERVICE_URL ?? "http://localhost:3001"
).replace(/\/+$/, "")

export const COOKIE = {
  access: "access_token",
  refresh: "refresh_token",
} as const

/** Matches JWT_REFRESH_TOKEN_EXPIRY on the auth-service (7d). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

/** Sign-in/sign-up screens: reachable signed out, bounced to the app when signed in. */
export const AUTH_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]

/**
 * Reachable by anyone regardless of session: the marketing pages, plus the
 * invitation screen. /invite has to work signed out (the invitee may have no
 * account yet), signed in (accepting as yourself), and signed in *without* a
 * workspace — which is why it sits here rather than in AUTH_PATHS, where a
 * signed-in visitor would be bounced to the dashboard before reading it.
 */
export const PUBLIC_PATHS = [
  "/",
  "/privacy",
  "/terms",
  "/security",
  "/invite",
]
