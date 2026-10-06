import Link from "next/link"

import { BRAND, Logo } from "@/components/brand/logo"

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Log in", href: "/login" },
]

const LEGAL = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Security", href: "/security" },
]

/** Compact footer: brand, the main paths, and the legally required links. Server component. */
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border/60 bg-muted/50">
      <div className="container mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Inventory, purchasing and orders for shops and small warehouses.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-16 gap-y-8 sm:grid-cols-3">
            <div>
              <h3 className="mb-3 text-sm font-medium">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {LINKS.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="mailto:sales@stow.app" className="transition-colors hover:text-foreground">
                    Talk to sales
                  </a>
                </li>
                <li>
                  <a href="mailto:help@stow.app" className="transition-colors hover:text-foreground">
                    Support
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {LEGAL.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; {year} {BRAND}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
