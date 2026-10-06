"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowUpRightIcon, MailCheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { registerAction } from "@/lib/auth/actions"
import { AuthTerms, FormNotice, FormShell } from "@/components/auth/form-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { EASE } from "@/components/landing/reveal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const EMAIL_RE = /^\S+@\S+\.\S+$/
const STEPS = ["Your email", "Name and password"]

function strengthOf(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { level: 0, label: "" }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { level: 1, label: "Weak" }
  if (score <= 3) return { level: 2, label: "Good" }
  return { level: 3, label: "Strong" }
}

function Progress({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {step} of {STEPS.length}
        </span>
        <span>{STEPS[step - 1]}</span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {STEPS.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                "h-full origin-left rounded-full bg-brand transition-transform duration-700 ease-spring",
                i < step ? "scale-x-100" : "scale-x-0"
              )}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  )
}

const SubmitArrow = () => (
  <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/15 transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px">
    <ArrowUpRightIcon className="size-4" strokeWidth={2} />
  </span>
)

const submitClass =
  "group h-11 w-full rounded-full pr-1.5 pl-5 transition-transform duration-300 ease-spring active:scale-[0.98]"

/**
 * Two-step registration: email, then name + password. The server action is
 * the source of truth for validation; the client only pre-checks the email so
 * step 1 feels instant.
 */
export function SignupForm({
  initialEmail = "",
  initialName = "",
}: {
  initialEmail?: string
  initialName?: string
}) {
  const [state, formAction, pending] = useActionState(registerAction, undefined)
  const reduce = useReducedMotion()

  const [email, setEmail] = useState(initialEmail)
  const [emailError, setEmailError] = useState<string>()
  const [password, setPassword] = useState("")
  const [detailsStep, setDetailsStep] = useState(EMAIL_RE.test(initialEmail))

  const strength = strengthOf(password)
  const fieldError = (name: string) => (state?.field === name ? state.error : undefined)
  const generalError = state?.error && !state.field ? state.error : null

  function continueFromEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setEmailError("Enter a valid email address")
      return
    }
    setEmailError(undefined)
    setDetailsStep(true)
  }

  const slide = {
    initial: reduce ? false : { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? undefined : { opacity: 0, x: -16 },
    transition: { duration: 0.35, ease: EASE },
  }

  if (state?.success) {
    return (
      <FormShell title="Check your inbox">
        <motion.div {...slide} className="grid gap-6">
          <div className="flex items-start gap-4 rounded-2xl border border-border/70 bg-secondary/50 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <MailCheckIcon className="size-5" strokeWidth={1.5} />
            </span>
            <div className="text-sm">
              <p>
                We sent a verification link to{" "}
                <strong className="font-medium">{email}</strong>.
              </p>
              <p className="mt-1 text-muted-foreground">
                Open it to activate your account. The link expires in 24 hours.
              </p>
            </div>
          </div>

          {state.verificationToken ? (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm">
              <p className="font-medium">Development mode</p>
              <p className="mt-1 text-muted-foreground">
                Email delivery is logged, not sent.{" "}
                <Link
                  className="text-foreground underline underline-offset-4"
                  href={`/verify-email?token=${encodeURIComponent(state.verificationToken)}`}
                >
                  Verify this account now
                </Link>
              </p>
            </div>
          ) : null}

          <p className="text-sm text-muted-foreground">
            Wrong address?{" "}
            <Link href="/signup" className="text-foreground underline underline-offset-4">
              Start again
            </Link>
          </p>
        </motion.div>
      </FormShell>
    )
  }

  return (
    <FormShell
      title="Create your account"
      description="A workspace is set up for you the moment you verify your email."
    >
      <Progress step={detailsStep ? 2 : 1} />

      <AnimatePresence mode="wait" initial={false}>
        {!detailsStep ? (
          <motion.form
            key="email"
            {...slide}
            onSubmit={continueFromEmail}
            className="grid gap-5"
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="signup-email">Work email</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError(undefined)
                }}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "signup-email-error" : undefined}
                className="h-11"
                autoFocus
              />
              <FieldError id="signup-email-error" message={emailError} />
            </div>

            <Button type="submit" className={submitClass}>
              <span className="flex-1 text-left">Continue</span>
              <SubmitArrow />
            </Button>
          </motion.form>
        ) : (
          <motion.form key="details" {...slide} action={formAction} className="grid gap-5">
            <input type="hidden" name="email" value={email} />

            <FormNotice error={generalError} />

            <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3.5 py-2.5 text-sm">
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={() => setDetailsStep(false)}
                className="ml-3 shrink-0 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                disabled={pending}
              >
                Change
              </button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-name">Your name</Label>
              <Input
                id="signup-name"
                name="name"
                autoComplete="name"
                defaultValue={initialName}
                placeholder="Priya Raman"
                required
                disabled={pending}
                aria-invalid={!!fieldError("name")}
                className="h-11"
                autoFocus
              />
              <FieldError id="signup-name-error" message={fieldError("name")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-password">Password</Label>
              <PasswordInput
                id="signup-password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={pending}
                aria-invalid={!!fieldError("password")}
                aria-describedby="signup-password-hint"
                className="h-11"
              />
              <div id="signup-password-hint" className="flex items-center gap-3 text-xs">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors duration-500",
                        strength.level >= n
                          ? strength.level === 1
                            ? "bg-destructive"
                            : "bg-brand"
                          : "bg-border"
                      )}
                    />
                  ))}
                </div>
                <span className="w-24 text-right text-muted-foreground">
                  {strength.label || "8+ characters"}
                </span>
              </div>
              <FieldError id="signup-password-error" message={fieldError("password")} />
            </div>

            <Button type="submit" disabled={pending} className={submitClass}>
              <span className="flex-1 text-left">
                {pending ? "Creating account..." : "Create account"}
              </span>
              <SubmitArrow />
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      <AuthTerms />
    </FormShell>
  )
}
