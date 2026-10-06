import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 text-center">
      <Logo />
      <div className="space-y-3">
        <p className="font-mono text-sm text-muted-foreground tabular">404</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          That page is not in stock.
        </h1>
        <p className="mx-auto max-w-[45ch] text-muted-foreground">
          The link may be old, or the page moved. Head back to the dashboard or the
          home page.
        </p>
      </div>
      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/dashboard" />}>Go to dashboard</Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>
          Home
        </Button>
      </div>
    </main>
  )
}
