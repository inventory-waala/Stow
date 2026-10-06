import Link from "next/link"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"

/** Left-aligned heading block used above every auth form. */
export function FormShell({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-2 text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-8">{children}</div>
    </div>
  )
}

export function FormNotice({
  error,
  success,
}: {
  error?: string | null
  success?: string | null
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  if (success) {
    return (
      <Alert className="border-brand/30 bg-brand-soft/60 text-foreground">
        <CircleCheckIcon className="size-4 text-brand" />
        <AlertDescription className="text-foreground">{success}</AlertDescription>
      </Alert>
    )
  }
  return null
}

export function AuthTerms() {
  return (
    <p className="mt-8 text-xs text-balance text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-foreground">
      By continuing you agree to the <Link href="/terms">Terms of Service</Link> and{" "}
      <Link href="/privacy">Privacy Policy</Link>.
    </p>
  )
}
