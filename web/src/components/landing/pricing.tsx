"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Reveal } from "@/components/landing/reveal"

type Cycle = "monthly" | "yearly"

type Plan = {
  name: string
  price: Record<Cycle, number>
  summary: string
  features: string[]
  recommended?: boolean
  cta: { label: string; href: string }
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: { monthly: 29, yearly: 24 },
    summary: "One location, a small team.",
    features: [
      "Up to 1,000 items",
      "1 location",
      "2 users",
      "Reorder alerts",
      "Email support",
    ],
    cta: { label: "Start free trial", href: "/signup" },
  },
  {
    name: "Professional",
    price: { monthly: 79, yearly: 69 },
    summary: "Several locations, purchasing and roles.",
    recommended: true,
    features: [
      "Up to 10,000 items",
      "3 locations",
      "10 users with roles",
      "Purchase orders and approvals",
      "API access",
      "Priority chat support",
    ],
    cta: { label: "Start free trial", href: "/signup" },
  },
  {
    name: "Enterprise",
    price: { monthly: 199, yearly: 179 },
    summary: "Unlimited scale with a dedicated contact.",
    features: [
      "Unlimited items and locations",
      "Unlimited users",
      "SSO and audit log",
      "Higher API limits",
      "Forecasting",
      "Dedicated support",
    ],
    cta: { label: "Talk to sales", href: "mailto:sales@stow.app" },
  },
]

export function Pricing() {
  const [yearly, setYearly] = useState(false)
  const cycle: Cycle = yearly ? "yearly" : "monthly"

  return (
    <section id="pricing" className="scroll-mt-24 border-t border-border/60 py-24 sm:py-32">
      <div className="container mx-auto max-w-6xl px-4">
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Pay for the size you are
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every plan starts with a 14-day trial. No card needed.
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <span className={cn(!yearly && "font-medium")}>Monthly</span>
            <Switch checked={yearly} onCheckedChange={setYearly} aria-label="Bill yearly" />
            <span className={cn(yearly && "font-medium")}>
              Yearly
              <span className="ml-2 rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">
                2 months free
              </span>
            </span>
          </label>
        </Reveal>

        {/* One row, divided, all at the same height; the recommended tier is tinted, not taller. */}
        <Reveal
          delay={0.1}
          className="mt-14 grid overflow-hidden rounded-[1.5rem] border border-border/70 bg-card md:grid-cols-3 md:divide-x md:divide-border/70 max-md:divide-y max-md:divide-border/70"
        >
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "flex flex-col p-8",
                plan.recommended && "bg-brand-soft/60 dark:bg-brand-soft/40"
              )}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-medium tracking-tight">{plan.name}</h3>
                {plan.recommended ? (
                  <span className="text-xs font-medium text-brand">Most teams</span>
                ) : null}
              </div>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.summary}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-mono text-5xl font-medium tracking-tighter tabular">
                  ${plan.price[cycle]}
                </span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <p className="mt-1 h-5 text-xs text-muted-foreground">
                {yearly ? `Billed $${plan.price.yearly * 12} yearly` : "Billed monthly"}
              </p>

              <ul className="mt-8 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-10">
                <Button
                  variant={plan.recommended ? "default" : "outline"}
                  className="w-full rounded-full"
                  nativeButton={false} render={<Link href={plan.cta.href} />}
                >
                  {plan.cta.label}
                </Button>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
