"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { authApi, AuthServiceError } from "./auth-service"
import { decodeAccessToken } from "./jwt"
import {
  clearSessionCookies,
  getSession,
  getTokens,
  setSessionCookies,
} from "./session"

export type FormState =
  | {
      error?: string
      /** Which input the error belongs to, when it is a field-level problem. */
      field?: string
      success?: string
      /** Non-production only: lets the flow complete without a mailbox. */
      verificationToken?: string
      resetToken?: string
    }
  | undefined

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(64, "Use at most 64 characters"),
})

/** auth-service replies with terse internal strings; translate the known ones. */
const BACKEND_MESSAGES: Record<string, string> = {
  "User Credentials": "Wrong email or password.",
  "Email not verified": "Verify your email first. The link is in your inbox.",
  "User suspended": "This account is suspended. Contact support.",
  "Email is already in use": "An account with this email already exists. Try logging in.",
}

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof AuthServiceError) {
    if (err.status === 401 && fallback === "Login failed") {
      return "Wrong email or password."
    }
    return BACKEND_MESSAGES[err.message] ?? err.message ?? fallback
  }
  if (err instanceof Error && /fetch failed|ECONNREFUSED/i.test(err.message)) {
    return "Auth service is unreachable. Is it running?"
  }
  return fallback
}

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : ""
  // Only allow same-origin paths so `?next=` can't become an open redirect.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
}

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const tokens = await authApi.login(parsed.data)
    await setSessionCookies(tokens)
  } catch (err) {
    return { error: toMessage(err, "Login failed") }
  }
  redirect(safeNext(formData.get("next")))
}

export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue.message, field: String(issue.path[0] ?? "") }
  }

  const { name, email, password } = parsed.data
  try {
    const created = await authApi.register({ name, email, password })
    // auth-service emails a verification link and refuses login until it is
    // used. Outside production it also returns the raw token so the flow can
    // be completed without a mailbox.
    return {
      success: "Account created. Check your email to verify it.",
      verificationToken:
        process.env.NODE_ENV !== "production"
          ? created.verificationToken
          : undefined,
    }
  } catch (err) {
    return { error: toMessage(err, "Registration failed") }
  }
}

export async function verifyEmailAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const token = String(formData.get("token") ?? "")
  if (!token) return { error: "Verification token is missing" }
  try {
    await authApi.verifyEmail(token)
  } catch (err) {
    return { error: toMessage(err, "Verification failed") }
  }
  redirect("/login?verified=1")
}

export async function logoutAction(): Promise<void> {
  const { accessToken, refreshToken } = await getTokens()
  const userId = decodeAccessToken(accessToken)?.id
  if (userId && refreshToken) {
    // Best effort — clear cookies even if the service can't be reached.
    await authApi
      .logout({ user_id: userId, token: refreshToken })
      .catch(() => {})
  }
  await clearSessionCookies()
  redirect("/login")
}

export async function switchTenantAction(tenantId: string): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect("/login")
  try {
    const { accessToken } = await authApi.switchTenant(
      session.accessToken,
      tenantId
    )
    await setSessionCookies({ accessToken })
  } catch (err) {
    return { error: toMessage(err, "Could not switch workspace") }
  }
  redirect("/dashboard")
}

export async function updateTenantAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect("/login")
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  if (!name) return { error: "Workspace name is required", field: "name" }
  if (name.length > 100) {
    return { error: "Workspace name is too long", field: "name" }
  }
  if (description.length > 500) {
    return { error: "Description is too long", field: "description" }
  }
  try {
    await authApi.updateTenant(session.accessToken, { name, description })
  } catch (err) {
    return { error: toMessage(err, "Could not save the workspace") }
  }
  // The name shows in the sidebar's workspace switcher, which the (app)
  // layout renders, so the whole layout has to be revalidated — not just
  // this page.
  revalidatePath("/", "layout")
  return { success: "Workspace saved" }
}

export async function createTenantAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect("/login")
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  if (!name) return { error: "Workspace name is required" }
  if (name.length > 100) return { error: "Workspace name is too long" }
  try {
    const tenant = await authApi.createTenant(session.accessToken, {
      name,
      description: description || undefined,
    })
    const { accessToken } = await authApi.switchTenant(
      session.accessToken,
      tenant.id
    )
    await setSessionCookies({ accessToken })
  } catch (err) {
    return { error: toMessage(err, "Could not create workspace") }
  }
  redirect("/dashboard")
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
  if (!z.email().safeParse(email).success) {
    return { error: "Enter a valid email" }
  }
  try {
    await authApi.forgotPassword(email)
  } catch (err) {
    return { error: toMessage(err, "Request failed") }
  }
  return { success: "If that email exists, a reset link has been sent." }
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const token = String(formData.get("token") ?? "")
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirmPassword") ?? "")
  if (!token) return { error: "Reset link is missing its token" }
  if (password.length < 8) return { error: "Password must be at least 8 characters" }
  if (password !== confirm) return { error: "Passwords do not match" }
  try {
    await authApi.resetPassword(token, password)
  } catch (err) {
    return { error: toMessage(err, "Could not reset password") }
  }
  redirect("/login?reset=1")
}

// ── Passkeys ────────────────────────────────────────────────────────────────
// The browser runs the WebAuthn ceremony; these actions broker options and
// responses with auth-service so tokens still only ever land in cookies.

export async function passkeyLoginOptionsAction(
  email: string
): Promise<{ options?: Record<string, unknown>; error?: string }> {
  if (!z.email().safeParse(email).success) {
    return { error: "Enter your email to sign in with a passkey" }
  }
  try {
    return { options: await authApi.passkeyLoginOptions(email) }
  } catch (err) {
    return { error: toMessage(err, "No passkey registered for this email") }
  }
}

export async function passkeyLoginAction(
  response: unknown,
  next?: string
): Promise<FormState> {
  try {
    const tokens = await authApi.passkeyLoginVerify(response)
    await setSessionCookies(tokens)
  } catch (err) {
    return { error: toMessage(err, "Passkey sign-in failed") }
  }
  redirect(safeNext(next ?? null))
}

export async function passkeyRegisterOptionsAction(): Promise<{
  options?: Record<string, unknown>
  error?: string
}> {
  const session = await getSession()
  if (!session) redirect("/login")
  try {
    return { options: await authApi.passkeyRegisterOptions(session.claims.email) }
  } catch (err) {
    return { error: toMessage(err, "Could not start passkey registration") }
  }
}

export async function passkeyRegisterAction(response: unknown): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect("/login")
  try {
    await authApi.passkeyRegisterVerify(session.claims.email, response)
    return { success: "Passkey registered. You can now sign in with it." }
  } catch (err) {
    return { error: toMessage(err, "Passkey registration failed") }
  }
}
