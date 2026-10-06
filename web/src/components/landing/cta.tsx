import Link from "next/link"
import { ArrowUpRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/landing/reveal"

/** Closing band in the same theme as the page: a tinted tray, one primary CTA. */
export function Cta() {
  return (
    <section className="py-24 sm:py-32">
      <div className="container mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="rounded-[2rem] border border-brand/20 bg-brand-soft/60 p-2 dark:bg-brand-soft/40">
            <div className="flex flex-col items-start gap-8 rounded-[1.5rem] bg-card px-8 py-14 sm:px-14 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Start with the spreadsheet you have
                </h2>
                <p className="mt-3 max-w-[48ch] text-lg text-muted-foreground">
                  Import it, count once, and let the alerts take over. Fourteen days, no
                  card.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="group h-12 rounded-full pr-1.5 pl-6 text-base"
                  nativeButton={false} render={<Link href="/signup" />}
                >
                  Start free trial
                  <span className="ml-3 flex size-8 items-center justify-center rounded-full bg-primary-foreground/15 transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px">
                    <ArrowUpRightIcon className="size-4" strokeWidth={2} />
                  </span>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12 rounded-full px-5 text-base"
                  nativeButton={false} render={<a href="mailto:sales@stow.app" />}
                >
                  Talk to sales
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
