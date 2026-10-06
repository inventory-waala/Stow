import type { ListSummary } from "@/lib/service-client"
import { fmtMoney } from "@/components/inventory/primitives"
import { StatusBadge } from "./status-badge"

/**
 * What the filtered list is worth. The figures come from a database
 * aggregate over the whole matching set, not the visible page, so they do not
 * change as you page through.
 */
export function SummaryStrip({
  summary,
  currency = "INR",
  label,
}: {
  summary: ListSummary
  currency?: string
  label: string
}) {
  const statuses = Object.entries(summary.by_status).filter(([, v]) => v.count > 0)
  if (!summary.count) return null

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-ambient">
      <div>
        <p className="font-mono text-2xl font-medium tracking-tight tabular">
          {fmtMoney(summary.total_amount, currency)}
        </p>
        <p className="text-xs text-muted-foreground">
          {label} across {summary.count} document{summary.count === 1 ? "" : "s"}
        </p>
      </div>

      {statuses.length > 1 ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {statuses.map(([status, v]) => (
            <li key={status} className="flex items-center gap-2">
              <StatusBadge status={status} />
              <span className="font-mono text-sm tabular">
                {fmtMoney(v.total_amount, currency)}
              </span>
              <span className="text-xs text-muted-foreground">({v.count})</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
