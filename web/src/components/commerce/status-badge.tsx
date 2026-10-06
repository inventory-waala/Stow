import { cn } from "@/lib/utils"

/**
 * One vocabulary of colour for both document types: grey while it is being
 * written, amber while it is in flight, brand once it has moved stock, muted
 * when it is closed without moving any.
 */
const TONE: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  ORDERED: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  APPROVED: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  CONFIRMED: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  RECEIVED: "bg-brand-soft text-brand",
  FULFILLED: "bg-brand-soft text-brand",
  CANCELLED: "bg-secondary text-muted-foreground line-through",
  RETURNED: "bg-destructive/10 text-destructive",
  ACTIVE: "bg-brand-soft text-brand",
  INACTIVE: "bg-secondary text-muted-foreground",
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[status] ?? "bg-secondary text-muted-foreground",
        className
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}
