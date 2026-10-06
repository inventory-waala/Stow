import { FingerprintIcon, MailCheckIcon, ReceiptIcon } from "lucide-react"

import { Logo } from "@/components/brand/logo"

const POINTS = [
  {
    icon: FingerprintIcon,
    title: "Passkeys, not passwords",
    body: "Sign in with Touch ID, Windows Hello or your phone once you have set one up.",
  },
  {
    icon: MailCheckIcon,
    title: "Verified email, one click",
    body: "We send a single link. No codes to copy, nothing to remember.",
  },
  {
    icon: ReceiptIcon,
    title: "14 days, no card",
    body: "Import your spreadsheet and count real stock before you decide.",
  },
]

/** Left column of the auth layout. Server component, no interactivity. */
export function AuthPanel() {
  return (
    <aside className="panel-wash relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
      <Logo light />

      <div className="max-w-sm">
        <p className="text-3xl leading-tight font-semibold tracking-tight text-balance">
          Your stock count, correct every morning.
        </p>
        <ul className="mt-10 space-y-6">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                <p.icon className="size-4" strokeWidth={1.5} />
              </span>
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-primary-foreground/65">
                  {p.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-primary-foreground/45">
        Used by teams at Northwind Supply, Larkspur Home and Ridgeline Outfitters.
      </p>
    </aside>
  )
}
