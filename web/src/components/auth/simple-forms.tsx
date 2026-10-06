"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  forgotPasswordAction,
  resetPasswordAction,
  verifyEmailAction,
} from "@/lib/auth/actions"
import { FormNotice, FormShell } from "@/components/auth/form-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const submitClass =
  "h-11 w-full rounded-full transition-transform duration-300 ease-spring active:scale-[0.98]"

const backToLogin = (
  <p className="mt-6 text-sm text-muted-foreground">
    <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
      Back to log in
    </Link>
  </p>
)

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined)
  return (
    <FormShell
      title="Reset your password"
      description="Enter your email and we will send a link to choose a new one."
    >
      <form action={action} className="grid gap-5" noValidate>
        <FormNotice error={state?.error} success={state?.success} />
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            className="h-11"
            autoFocus
          />
        </div>
        <Button type="submit" className={submitClass} disabled={pending}>
          {pending ? "Sending..." : "Send reset link"}
        </Button>
      </form>
      {backToLogin}
    </FormShell>
  )
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined)
  return (
    <FormShell
      title="Choose a new password"
      description={
        token
          ? "Use at least 8 characters. You will be asked to log in again afterwards."
          : "This link is missing its reset token. Request a new one below."
      }
    >
      <form action={action} className="grid gap-5">
        <input type="hidden" name="token" value={token ?? ""} />
        <FormNotice error={state?.error} />
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="h-11"
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            className="h-11"
          />
        </div>
        <Button type="submit" className={submitClass} disabled={pending || !token}>
          {pending ? "Updating..." : "Update password"}
        </Button>
      </form>
      {token ? (
        backToLogin
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          <Link
            href="/forgot-password"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Request a new link
          </Link>
        </p>
      )}
    </FormShell>
  )
}

export function VerifyEmailForm({ token }: { token?: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, undefined)
  return (
    <FormShell
      title="Verify your email"
      description={
        token
          ? "One click and your account is active."
          : "This link is missing its verification token. Open the link from your email again."
      }
    >
      <form action={action} className="grid gap-5">
        <input type="hidden" name="token" value={token ?? ""} />
        <FormNotice error={state?.error} />
        <Button type="submit" className={submitClass} disabled={pending || !token}>
          {pending ? "Verifying..." : "Verify and continue"}
        </Button>
      </form>
      {backToLogin}
    </FormShell>
  )
}
