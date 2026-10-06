const CUSTOMERS = [
  "Northwind Supply",
  "Larkspur Home",
  "Ridgeline Outfitters",
  "Marrow & Co.",
  "Ferro Tools",
  "Bramble Foods",
]

/** Text-only wordmarks under the hero; static, server-rendered, no logo assets to maintain. */
export function TrustStrip() {
  return (
    <section aria-label="Customers" className="border-y border-border/60 py-8">
      <div className="container mx-auto flex max-w-6xl flex-col gap-5 px-4 sm:flex-row sm:items-center sm:gap-10">
        <p className="shrink-0 text-sm text-muted-foreground">Used by teams at</p>
        <ul className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm font-medium tracking-tight text-foreground/55">
          {CUSTOMERS.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
