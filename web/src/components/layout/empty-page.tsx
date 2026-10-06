import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { StowMark } from "@/components/brand/logo"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"

export function EmptyPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="grid gap-6">
      <PageHeader title={title} description={description} />
      <div className="rounded-[1.5rem] border border-border/70 bg-secondary/50 p-1.5">
        <div className="flex min-h-112 flex-col items-center justify-center rounded-[1.125rem] border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <StowMark className="size-6" strokeWidth={1.75} />
          </span>
          <p className="mt-5 font-medium">Nothing here yet</p>
          <p className="mt-1 max-w-[36ch] text-sm text-muted-foreground">
            {title} switches on once its service is connected. Everything else
            in your workspace keeps working in the meantime.
          </p>
          <Button
            variant="outline"
            className="mt-6 rounded-full"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            <ArrowLeftIcon className="size-4" strokeWidth={1.75} />
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
