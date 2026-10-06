import {
  BellIcon,
  MapPinIcon,
  ScanBarcodeIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Reveal } from "@/components/landing/reveal"

const BARS = [38, 52, 46, 61, 58, 73, 69, 84, 80, 92, 88, 97]

/** Feature tile with the same outer-tray / inner-card structure as the hero mock. */
function Tile({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "group rounded-[1.5rem] border border-border/70 bg-secondary/50 p-1.5 transition-shadow duration-500 ease-spring hover:shadow-ambient",
        className
      )}
    >
      <div className="flex h-full flex-col rounded-[1.125rem] bg-card p-6">
        {children}
      </div>
    </div>
  )
}

function TileText({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon
  title: string
  body: string
}) {
  return (
    <>
      <span className="mb-5 flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon className="size-4.5" strokeWidth={1.5} />
      </span>
      <h3 className="text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </>
  )
}

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-24 sm:py-32">
      <div className="container mx-auto max-w-6xl px-4">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything between the loading dock and the invoice
          </h2>
          <p className="mt-4 max-w-[60ch] text-lg text-muted-foreground">
            Stock, purchasing and orders share one ledger, so a count is never out of
            date and a reorder never gets forgotten.
          </p>
        </Reveal>

        {/* 5 tiles, 5 cells: one wide with a chart, one tinted, three standard. */}
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Reveal className="md:col-span-2">
            <Tile className="h-full">
              <div className="flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-end">
                <div className="max-w-xs">
                  <TileText
                    icon={ScanBarcodeIcon}
                    title="Counts that stay accurate"
                    body="Every receipt, sale, transfer and adjustment posts to one ledger, with a full history per item."
                  />
                </div>
                <div className="flex h-28 w-full items-end gap-1.5 sm:w-56" aria-hidden="true">
                  {BARS.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-brand/70 transition-transform duration-700 ease-spring group-hover:scale-y-105 origin-bottom"
                      style={{ height: `${h}%`, opacity: 0.45 + (i / BARS.length) * 0.55 }}
                    />
                  ))}
                </div>
              </div>
            </Tile>
          </Reveal>

          <Reveal delay={0.08}>
            <Tile className="h-full bg-brand/15 border-brand/20">
              <div>
                <p className="font-mono text-4xl font-medium tracking-tighter tabular">
                  4h 10m
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  median time from low-stock alert to an approved purchase order
                </p>
                <div className="mt-6 h-px w-full bg-border/70" />
                <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                  Alerts draft the purchase order for you. Approve it from your phone.
                </p>
              </div>
            </Tile>
          </Reveal>

          <Reveal delay={0.05}>
            <Tile className="h-full">
              <TileText
                icon={BellIcon}
                title="Alerts before you run out"
                body="Set a reorder point per item and location. Get told once, with the order already drafted."
              />
            </Tile>
          </Reveal>

          <Reveal delay={0.1}>
            <Tile className="h-full">
              <TileText
                icon={MapPinIcon}
                title="Every location, one view"
                body="Warehouses, shops and vans show up as columns, not separate spreadsheets."
              />
            </Tile>
          </Reveal>

          <Reveal delay={0.15}>
            <Tile className="h-full">
              <TileText
                icon={UsersIcon}
                title="Roles that match the floor"
                body="Pickers count, managers approve, owners see margins. Nobody sees more than they need."
              />
            </Tile>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
