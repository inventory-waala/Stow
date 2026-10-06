import { cn } from "@/lib/utils"

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

/** A bordered group of rows; put `SettingsRow`s inside. */
export function SettingsGroup({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border/70 rounded-2xl border border-border/70 bg-card shadow-ambient",
        className
      )}
    >
      {children}
    </div>
  )
}

/** Label on the left, control or value on the right. */
export function SettingsRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(11rem,18rem)_minmax(0,1fr)] sm:items-center sm:gap-6">
      <div>
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
