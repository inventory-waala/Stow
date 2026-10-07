"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRightIcon, TriangleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { EASE } from "@/components/landing/reveal"
import { trialCta } from "@/components/landing/trial-cta"

const ROWS = [
  { sku: "LK-4021", name: "Oak shelf bracket, 200 mm", onHand: 148, reorder: 40, status: "ok" },
  { sku: "LK-1187", name: "Linen cushion cover, sage", onHand: 23, reorder: 30, status: "low" },
  { sku: "LK-2260", name: "Stoneware mug, 350 ml", onHand: 412, reorder: 120, status: "ok" },
  { sku: "LK-3304", name: "Brass hook, single", onHand: 0, reorder: 50, status: "out" },
  { sku: "LK-0912", name: "Wool throw, charcoal", onHand: 61, reorder: 25, status: "ok" },
] as const

const STATUS = {
  ok: { label: "In stock", cls: "bg-brand-soft text-brand" },
  low: { label: "Low", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  out: { label: "Out", cls: "bg-secondary text-muted-foreground" },
} as const

/** Double-bezel product mock: an outer tray with an inner card, plus one overlapping alert card. */
function ProductMock() {
  const reduce = useReducedMotion()
  return (
    <div className="relative">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
        className="rounded-[1.75rem] border border-border/70 bg-secondary/60 p-1.5 shadow-ambient-lg"
      >
        <div className="rounded-[1.375rem] border border-border/60 bg-card shadow-[inset_0_1px_0_0_--alpha(var(--color-white)/70%)]">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium">Stock levels</p>
              <p className="text-xs text-muted-foreground">Main warehouse · updated just now</p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground tabular">
              1,284 SKUs
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="*:px-5 *:py-2 *:font-medium *:whitespace-nowrap">
                <th>Item</th>
                <th className="text-right">On hand</th>
                <th className="hidden text-right sm:table-cell">Reorder at</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {ROWS.map((row) => (
                <tr key={row.sku} className="*:px-5 *:py-2.5">
                  <td>
                    <div className="font-medium">{row.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{row.sku}</div>
                  </td>
                  <td className="text-right font-mono tabular">{row.onHand}</td>
                  <td className="hidden text-right font-mono text-muted-foreground tabular sm:table-cell">
                    {row.reorder}
                  </td>
                  <td className="text-right">
                    <span
                      className={cn(
                        "inline-block rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                        STATUS[row.status].cls
                      )}
                    >
                      {STATUS[row.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Overlapping alert card, rotated slightly to break the grid; flat on mobile. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24, rotate: 0 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
        className="absolute -right-3 -bottom-6 w-64 rounded-2xl border border-border/70 bg-card p-4 shadow-ambient-lg max-md:hidden"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <TriangleAlertIcon className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Reorder suggested</p>
            <p className="text-xs text-muted-foreground">
              Linen cushion cover is 7 below its reorder point. A purchase order for 60 is
              drafted.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export function Hero({ signedIn }: { signedIn: boolean }) {
  const primary = trialCta(signedIn)
  const reduce = useReducedMotion()
  const fade = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: EASE },
  })

  return (
    <section className="hero-wash relative overflow-hidden pt-32 pb-20 sm:pt-40 lg:pb-28">
      <div className="container mx-auto grid max-w-6xl items-center gap-14 px-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <div className="max-w-xl">
          <motion.h1
            {...fade(0)}
            className="text-4xl leading-[1.05] font-semibold tracking-tighter sm:text-5xl lg:text-6xl"
          >
            Know what&rsquo;s on the shelf.{" "}
            <em className="font-medium text-brand not-italic">Always.</em>
          </motion.h1>
          <motion.p
            {...fade(0.1)}
            className="mt-6 max-w-[42ch] text-lg leading-relaxed text-muted-foreground"
          >
            Inventory, purchases and orders in one place, with counts that stay accurate
            and alerts before you run out.
          </motion.p>
          <motion.div {...fade(0.2)} className="mt-9 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="group h-12 rounded-full pr-1.5 pl-6 text-base"
              nativeButton={false} render={<Link href={primary.href} />}
            >
              {primary.label}
              <span className="ml-3 flex size-8 items-center justify-center rounded-full bg-primary-foreground/15 transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px">
                <ArrowUpRightIcon className="size-4" strokeWidth={2} />
              </span>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-12 rounded-full px-5 text-base"
              nativeButton={false} render={<Link href="#features" />}
            >
              See how it works
            </Button>
          </motion.div>
        </div>

        <ProductMock />
      </div>
    </section>
  )
}
