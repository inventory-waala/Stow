import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ActionState } from "@/lib/inventory/actions"

/** Inline result of a server action: one line, error or success. */
export function FormAlert({ state }: { state: ActionState }) {
  if (!state?.error && !state?.success) return null
  const error = !!state.error
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        error
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-brand/30 bg-brand-soft text-brand"
      )}
    >
      {error ? (
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{state.error ?? state.success}</span>
    </div>
  )
}

/** Shown in place of a section when inventory-service can't be reached. */
export function ServiceNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground"
    >
      <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
      {message}
    </div>
  )
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-border/70 bg-card shadow-ambient",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div>
          <h3 className="font-medium">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>
  )
}

/** Compact `{"size":"M","color":"navy"}` → `size: M · color: navy`. */
/** "Navy · M · 1001-NAVY-M" — how a size is named outside its product page. */
export function SizeText({ size }: { size: { label: string; sku: string | null; variant: { name: string } } }) {
  return (
    <>
      {size.variant.name}
      {size.label !== "Default" ? ` · ${size.label}` : ""}
      {size.sku ? <span className="font-mono"> · {size.sku}</span> : null}
    </>
  )
}

export function OptionsText({ options }: { options: Record<string, unknown> }) {
  const entries = Object.entries(options ?? {})
  if (!entries.length) return <span className="text-muted-foreground">default</span>
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5">
      {entries.map(([k, v]) => (
        <span key={k}>
          <span className="text-muted-foreground">{k}:</span> {String(v)}
        </span>
      ))}
    </span>
  )
}

export function fmtQty(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v)
}

export function fmtMoney(v: string | null | undefined, currency = "INR") {
  if (!v) return "—"
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  try {
    return n.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 })
  } catch {
    return `${currency} ${n}`
  }
}
