import { Reveal } from "@/components/landing/reveal"

type Quote = {
  quote: string
  name: string
  role: string
  company: string
  initials: string
}

const FEATURED: Quote = {
  quote:
    "Our Friday count used to take two people all morning. It is eleven minutes now, and the number is right.",
  name: "Priya Raman",
  role: "Operations lead",
  company: "Larkspur Home",
  initials: "PR",
}

const OTHERS: Quote[] = [
  {
    quote:
      "Stockouts on our top 50 lines are down 38% since the reorder drafts went live.",
    name: "Tomás Herrera",
    role: "Warehouse manager",
    company: "Ridgeline Outfitters",
    initials: "TH",
  },
  {
    quote:
      "Three shops, one screen. I stopped asking staff to text me photos of the shelf.",
    name: "Anneli Koskinen",
    role: "Founder",
    company: "Marrow & Co.",
    initials: "AK",
  },
]

function Attribution({ q, size = "md" }: { q: Quote; size?: "md" | "lg" }) {
  return (
    <figcaption className="flex items-center gap-3">
      <span
        className={
          size === "lg"
            ? "flex size-11 items-center justify-center rounded-xl bg-brand-soft font-medium text-brand"
            : "flex size-9 items-center justify-center rounded-lg bg-secondary text-sm font-medium"
        }
        aria-hidden="true"
      >
        {q.initials}
      </span>
      <div className="text-sm">
        <div className="font-medium">{q.name}</div>
        <div className="text-muted-foreground">
          {q.role}, {q.company}
        </div>
      </div>
    </figcaption>
  )
}

/** One featured quote plus two supporting ones. No carousel, no dots, no stock photos. */
export function Testimonials() {
  return (
    <section id="testimonials" className="scroll-mt-24 border-t border-border/60 py-24 sm:py-32">
      <div className="container mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Reveal>
          <figure className="flex h-full flex-col justify-between gap-10 rounded-[1.5rem] border border-border/70 bg-card p-8 sm:p-10">
            <blockquote className="text-2xl leading-snug font-medium tracking-tight sm:text-3xl">
              &ldquo;{FEATURED.quote}&rdquo;
            </blockquote>
            <Attribution q={FEATURED} size="lg" />
          </figure>
        </Reveal>

        <div className="grid gap-6">
          {OTHERS.map((q, i) => (
            <Reveal key={q.name} delay={0.08 + i * 0.06}>
              <figure className="flex h-full flex-col justify-between gap-6 rounded-[1.5rem] bg-secondary/60 p-7">
                <blockquote className="leading-relaxed">&ldquo;{q.quote}&rdquo;</blockquote>
                <Attribution q={q} />
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
