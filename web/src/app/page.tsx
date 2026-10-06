import { getSession } from "@/lib/auth/session"
import { Cta } from "@/components/landing/cta"
import { Features } from "@/components/landing/features"
import { Footer } from "@/components/landing/footer"
import { Header } from "@/components/landing/header"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Pricing } from "@/components/landing/pricing"
import { Testimonials } from "@/components/landing/testimonials"
import { TrustStrip } from "@/components/landing/trust-strip"

export default async function Home() {
  const session = await getSession()

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <Header signedIn={session !== null} />
      <main id="main" className="overflow-x-clip">
        <Hero />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <Cta />
      </main>
      <Footer />
    </>
  )
}
