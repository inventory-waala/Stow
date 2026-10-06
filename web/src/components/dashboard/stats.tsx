import { ArrowUpRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { STATS } from "@/components/dashboard/data"

const TONE = {
  up: "bg-brand-soft text-brand",
  warn: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  flat: "bg-secondary text-muted-foreground",
} as const

/** Four numbers in one tray, divided rather than boxed. */
export function Stats() {
  return (
    <section
      aria-label="Key figures"
      className="grid divide-y divide-border/70 rounded-2xl border border-border/70 bg-card shadow-ambient sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x"
    >
      {STATS.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            "p-5",
            i === 1 && "sm:border-l sm:border-border/70 lg:border-l-0",
            i >= 2 && "sm:border-t sm:border-border/70 lg:border-t-0",
            i === 3 && "sm:border-l sm:border-border/70 lg:border-l-0"
          )}
        >
          <p className="text-sm text-muted-foreground">{s.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular">{s.value}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular",
                TONE[s.tone]
              )}
            >
              {s.tone === "up" ? <ArrowUpRightIcon className="size-3" strokeWidth={2.5} /> : null}
              {s.delta}
            </span>
            {s.hint}
          </p>
        </div>
      ))}
    </section>
  )
}
