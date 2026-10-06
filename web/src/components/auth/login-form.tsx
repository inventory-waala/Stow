"use client"

import Link from "next/link"
import { useActionState, useState, useTransition } from "react"
import { startAuthentication } from "@simplewebauthn/browser"
import { ArrowUpRightIcon, FingerprintIcon } from "lucide-react"

import {
  loginAction,
  passkeyLoginAction,
  passkeyLoginOptionsAction,
} from "@/lib/auth/actions"
import { AuthTerms, FormNotice, FormShell } from "@/components/auth/form-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({
  next,
  notice,
}: {
  next?: string
  notice?: string
}) {
  const [state, formAction, pending] = useActionState(loginAction, undefined)
  const [email, setEmail] = useState("")
  const [passkeyError, setPasskeyError] = useState<string | null>(null)
  const [passkeyPending, startPasskey] = useTransition()

  const busy = pending || passkeyPending
  const error = state?.error ?? passkeyError

  function signInWithPasskey() {
    setPasskeyError(null)
    startPasskey(async () => {
      const { options, error } = await passkeyLoginOptionsAction(email)
      if (!options) {
        setPasskeyError(error ?? "Could not start passkey sign-in")
        return
      }
      let assertion
      try {
        assertion = await startAuthentication({ optionsJSON: options as never })
      } catch {
        // The user dismissed the browser prompt; nothing to report.
        return
      }
      const result = await passkeyLoginAction(assertion, next)
      if (result?.error) setPasskeyError(result.error)
    })
  }

  return (
    <FormShell title="Welcome back" description="Log in to your workspace.">
      <form action={formAction} className="grid gap-5" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <FormNotice error={error} success={!error ? notice : undefined} />

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email webauthn"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="h-11"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            className="h-11"
          />
        </div>

        <Button
          type="submit"
          disabled={busy}
          className="group mt-1 h-11 w-full rounded-full pr-1.5 pl-5 transition-transform duration-300 ease-spring active:scale-[0.98]"
        >
          <span className="flex-1 text-left">{pending ? "Logging in..." : "Log in"}</span>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/15 transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px">
            <ArrowUpRightIcon className="size-4" strokeWidth={2} />
          </span>
        </Button>

        <div className="relative my-1 text-center text-xs text-muted-foreground before:absolute before:inset-y-1/2 before:left-0 before:h-px before:w-full before:bg-border">
          <span className="relative bg-background px-3">or</span>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={signInWithPasskey}
          className="h-11 w-full rounded-full transition-transform duration-300 ease-spring active:scale-[0.98]"
        >
          <FingerprintIcon className="size-4" strokeWidth={1.75} />
          {passkeyPending ? "Waiting for your device..." : "Continue with a passkey"}
        </Button>
        <p className="-mt-2 text-center text-xs text-muted-foreground">
          Enter your email first, then use the passkey you registered in Settings.
        </p>
      </form>
      <AuthTerms />
    </FormShell>
  )
}
