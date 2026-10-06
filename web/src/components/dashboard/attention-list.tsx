import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { ATTENTION } from "@/components/dashboard/data"
import { Button } from "@/components/ui/button"

/** Items under their reorder point, worst first. */
export function AttentionList() {
  const rows = [...ATTENTION].sort((a, b) => a.onHand / a.reorder - b.onHand / b.reorder)

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border/70 bg-card shadow-ambient">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div>
          <h3 className="font-medium">Needs attention</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {rows.length} items below their reorder point
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 rounded-full text-muted-foreground"
          nativeButton={false}
          render={<Link href="/inventory" />}
        >
          All stock
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>

      <ul className="flex-1 divide-y divide-border/70 border-t border-border/70">
        {rows.map((r) => {
          const out = r.onHand === 0
          const pct = Math.min(100, Math.round((r.onHand / r.reorder) * 100))
          return (
            <li key={r.sku} className="flex items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{r.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular">
                  {r.sku}
                </p>
              </div>
              <div className="w-24 shrink-0">
                <div className="flex justify-between text-xs tabular">
                  <span className={cn("font-medium", out && "text-destructive")}>
                    {r.onHand}
                  </span>
                  <span className="text-muted-foreground">/ {r.reorder}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border/80">
                  <div
                    className={cn("h-full rounded-full", out ? "bg-destructive" : "bg-amber-500")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 rounded-full px-2.5 text-xs"
              >
                Order {r.suggest}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
