"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#testimonials", label: "Testimonials" },
]

const EASE = [0.32, 0.72, 0, 1] as const

/**
 * Floating island nav: detached from the top edge, blurred only because it is
 * fixed. Collapses to a full-screen overlay with staggered links on mobile.
 */
export function Header({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()

  // Lock page scroll while the overlay is up.
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : ""
    return () => {
      document.documentElement.style.overflow = ""
    }
  }, [open])

  const cta = signedIn ? (
    <Button size="sm" className="rounded-full px-4" nativeButton={false} render={<Link href="/dashboard" />}>
      Open dashboard
    </Button>
  ) : (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-full px-4"
        nativeButton={false} render={<Link href="/login" />}
      >
        Log in
      </Button>
      <Button size="sm" className="rounded-full px-4" nativeButton={false} render={<Link href="/signup" />}>
        Start free trial
      </Button>
    </>
  )

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-4 sm:pt-6">
      <nav
        aria-label="Primary"
        className="pointer-events-auto relative z-40 flex h-14 w-full max-w-5xl items-center justify-between rounded-full border border-border/70 bg-background/80 pr-2 pl-4 shadow-ambient backdrop-blur-xl"
      >
        <Logo />

        <ul className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors duration-300 ease-spring hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-1.5 md:flex">{cta}</div>

        <button
          type="button"
          className="relative flex size-10 items-center justify-center rounded-full md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {/* Two bars morph into an X. */}
          <span
            className={cn(
              "absolute h-0.5 w-5 rounded-full bg-foreground transition-transform duration-500 ease-spring",
              open ? "rotate-45" : "-translate-y-0.75"
            )}
          />
          <span
            className={cn(
              "absolute h-0.5 w-5 rounded-full bg-foreground transition-transform duration-500 ease-spring",
              open ? "-rotate-45" : "translate-y-0.75"
            )}
          />
        </button>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            className="pointer-events-auto fixed inset-0 z-20 flex flex-col justify-end bg-background/90 px-6 pb-10 backdrop-blur-2xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <ul className="mb-8 flex flex-col gap-2">
              {NAV.map((item, i) => (
                <motion.li
                  key={item.href}
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.08 + i * 0.06, ease: EASE }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block py-2 text-4xl font-semibold tracking-tight"
                  >
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <motion.div
              className="flex flex-col gap-2 *:w-full *:justify-center"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
            >
              {cta}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
