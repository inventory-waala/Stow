import Link from "next/link"
import { notFound } from "next/navigation"

import { BRAND, Logo } from "@/components/brand/logo"

const PAGES = {
  privacy: {
    title: "Privacy",
    updated: "2026-09-01",
    body: [
      "We store the account details you give us (name, email) and the inventory data you enter. We use them to run the service and nothing else.",
      "Data lives in our production database and is not shared with third parties except the providers we need to operate (hosting, email delivery).",
      "You can export or delete your workspace at any time from Settings, or by writing to help@stow.app.",
    ],
  },
  terms: {
    title: "Terms of service",
    updated: "2026-09-01",
    body: [
      `${BRAND} is provided as a subscription. Trials last 14 days and convert to a paid plan only when you add a payment method.`,
      "You own your data. We may suspend accounts that abuse the service or fail to pay after notice.",
      "Either side can end the agreement at any time; we will keep your data available for export for 30 days after cancellation.",
    ],
  },
  security: {
    title: "Security",
    updated: "2026-09-01",
    body: [
      "Sign-in supports passwords and passkeys. Sessions use short-lived access tokens and rotating refresh tokens stored in httpOnly cookies.",
      "Every workspace is isolated by tenant and every action is checked against the caller's role and permissions.",
      "Report a vulnerability to security@stow.app. We acknowledge within two business days.",
    ],
  },
} as const

type Slug = keyof typeof PAGES

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps<"/[slug]">) {
  const { slug } = await params
  const page = PAGES[slug as Slug]
  return { title: page?.title ?? "Not found" }
}

export default async function LegalPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params
  const page = PAGES[slug as Slug]
  if (!page) notFound()

  return (
    <main id="main" className="container mx-auto max-w-2xl px-4 py-16">
      <Logo />
      <article className="mt-12">
        <p className="font-mono text-xs text-muted-foreground tabular">
          Last updated {page.updated}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{page.title}</h1>
        <div className="mt-8 space-y-5 leading-relaxed text-muted-foreground">
          {page.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </article>
      <Link href="/" className="mt-12 inline-block text-sm underline underline-offset-4">
        Back to home
      </Link>
    </main>
  )
}
