import { Reveal } from "@/components/landing/reveal"

const STEPS = [
  {
    title: "Import what you already have",
    body: "Upload the spreadsheet you use today. Items, variants, suppliers and opening counts come across in one pass.",
  },
  {
    title: "Count with the scanner in your pocket",
    body: "Receive deliveries and do cycle counts from a phone. Every scan posts to the ledger the moment it happens.",
  },
  {
    title: "Let the reorder points do the chasing",
    body: "When an item dips below its threshold, a purchase order is drafted for the usual supplier. You approve, we send it.",
  },
]

/** Numbered list with a sticky headline: a different layout family from the bento above. */
export function HowItWorks() {
  return (
    <section className="border-t border-border/60 py-24 sm:py-32">
      <div className="container mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-20">
        <Reveal className="lg:sticky lg:top-32 lg:self-start">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Live in an afternoon
          </h2>
          <p className="mt-4 max-w-[45ch] text-lg text-muted-foreground">
            No implementation project. Most teams are counting stock the day they sign up.
          </p>
        </Reveal>

        <ol className="divide-y divide-border/60">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.06}>
              <li className="grid grid-cols-[3rem_1fr] gap-4 py-8 first:pt-0 last:pb-0 sm:gap-8">
                <span className="font-mono text-sm text-brand tabular">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-medium tracking-tight">{step.title}</h3>
                  <p className="mt-2 max-w-[55ch] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
