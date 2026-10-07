"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { ArrowLeftRightIcon, ChevronRightIcon, ScanBarcodeIcon, SearchIcon } from "lucide-react"

import type { Location, ProductListItem, StockTotals } from "@/lib/inventory/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { MovementForm } from "./movement-form"
import { fmtQty } from "./primitives"
import { ScanButton } from "./scanner/scan-button"

export interface Line {
  sizeId: string
  productId: string
  product: string
  code: string | null
  variant: string
  label: string
  sku: string | null
  unit: string
  barcodes: string[]
  totals: StockTotals
  /** Catalog price, used as the default rate on a sales order line. */
  sellPrice: string | null
  currency: string
  /** Lower-cased haystack for the search box. */
  text: string
}

export function flattenLines(products: ProductListItem[]): Line[] {
  const out: Line[] = []
  for (const p of products) {
    for (const v of p.variants) {
      for (const s of v.sizes) {
        const barcodes = s.barcodes.map((b) => b.value)
        out.push({
          sizeId: s.id,
          productId: p.id,
          product: p.name,
          code: p.code,
          variant: v.name,
          label: s.label,
          sku: s.sku,
          unit: s.unit,
          barcodes,
          totals: s.stock_totals,
          sellPrice: s.sell_price,
          currency: s.currency,
          text: [p.name, p.code, v.name, s.label, s.sku, ...barcodes].filter(Boolean).join(" ").toLowerCase(),
        })
      }
    }
  }
  return out
}

/** "Boyleg Brief · 1001 NAVY" — the heading; the value ("M") goes on the line below. */
export const lineTitle = (l: Line) => `${l.product} · ${l.variant}`
/** What identifies the line under the heading: its value, then SKU / barcode. */
export const lineDetail = (l: Line) =>
  [l.label === "Default" ? null : l.label, l.sku ? `SKU ${l.sku}` : null, l.barcodes[0] ? `barcode ${l.barcodes[0]}` : null]
    .filter(Boolean)
    .join(" · ") || "single unit"

/**
 * "Move stock" from the inventory list: pick any stock line — by product,
 * variant, SKU or a scanned barcode — then record the movement without
 * opening the product. `productId` narrows the picker to one product (the
 * per-row shortcut).
 */
export function QuickStockSheet({
  products,
  locations,
  productId,
  trigger,
  initialQuery,
  defaultOpen = false,
  onOpenChange,
}: {
  products: ProductListItem[]
  locations: Location[]
  productId?: string
  /** `null` renders no trigger — the sheet is opened by its owner (the scan box). */
  trigger?: React.ReactElement | null
  /** Pre-filled search; an exact SKU / barcode match opens the form directly. */
  initialQuery?: string
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [session, setSession] = useState(0)
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setSession((n) => n + 1)
        setOpen(o)
        onOpenChange?.(o)
      }}
    >
      {trigger === null ? null : (
        <SheetTrigger
          render={
            trigger ?? (
              <Button variant="outline" className="rounded-full px-4">
                <ArrowLeftRightIcon className="size-4" strokeWidth={2} />
                Move stock
              </Button>
            )
          }
        />
      )}
      <QuickStockBody key={session} products={products} locations={locations} productId={productId} initialQuery={initialQuery} />
    </Sheet>
  )
}

/**
 * The one barcode entry point in the inventory header: a "Scan" button that
 * opens the camera sheet (with a type-it-in field for smudged labels and
 * handheld scanners). The code opens the Move stock sheet on that line.
 */
export function ScanStockBox({ products, locations }: { products: ProductListItem[]; locations: Location[] }) {
  const [scan, setScan] = useState<{ q: string; n: number } | null>(null)
  return (
    <>
      <ScanButton
        onScan={(q) => setScan({ q, n: (scan?.n ?? 0) + 1 })}
        title="Scan to move stock"
        hint="Scan or type a barcode or SKU to move its stock"
        size="default"
        className="rounded-full px-4"
      >
        <ScanBarcodeIcon className="size-4" strokeWidth={2} />
        Scan
      </ScanButton>
      {scan ? (
        <QuickStockSheet
          key={scan.n}
          products={products}
          locations={locations}
          trigger={null}
          initialQuery={scan.q}
          defaultOpen
          onOpenChange={(o) => {
            if (!o) setScan(null)
          }}
        />
      ) : null}
    </>
  )
}

export const exactMatch = (lines: Line[], q: string) =>
  q ? lines.find((l) => l.barcodes.some((b) => b.toLowerCase() === q) || l.sku?.toLowerCase() === q) : undefined

function QuickStockBody({
  products,
  locations,
  productId,
  initialQuery = "",
}: {
  products: ProductListItem[]
  locations: Location[]
  productId?: string
  initialQuery?: string
}) {
  const lines = useMemo(() => flattenLines(productId ? products.filter((p) => p.id === productId) : products), [products, productId])
  const [query, setQuery] = useState(initialQuery)
  const [pickedId, setPickedId] = useState<string | null>(() => {
    if (lines.length === 1) return lines[0].sizeId
    return exactMatch(lines, initialQuery.trim().toLowerCase())?.sizeId ?? null
  })
  // Re-read the picked line on every render: after a movement the page's
  // products refresh, so the totals shown are the new ones.
  const picked = pickedId ? (lines.find((l) => l.sizeId === pickedId) ?? null) : null
  const setPicked = (l: Line | null) => setPickedId(l?.sizeId ?? null)

  const scoped = productId ? products.find((p) => p.id === productId) : undefined

  return (
    <SheetContent className="w-full overflow-y-auto sm:max-w-md!">
      <SheetHeader>
        <SheetTitle>{picked ? `Move stock — ${lineTitle(picked)}` : scoped ? `Move stock — ${scoped.name}` : "Move stock"}</SheetTitle>
        <SheetDescription>
          {picked ? (
            <>
              {lineDetail(picked)}
              {" · "}
              <button type="button" onClick={() => setPicked(null)} className="underline underline-offset-4">
                change line
              </button>
            </>
          ) : (
            "Pick the line to move: search by product, variant, SKU or scan a barcode."
          )}
        </SheetDescription>
      </SheetHeader>

      {picked ? (
        <MovementForm
          key={picked.sizeId}
          target={{ sizeId: picked.sizeId, productId: picked.productId, unit: picked.unit, totals: picked.totals }}
          locations={locations}
        />
      ) : (
        <LinePicker lines={lines} query={query} onQuery={setQuery} onPick={setPicked} className="px-4 pb-4" />
      )}
    </SheetContent>
  )
}

/**
 * Search box + result list over the flattened stock lines, with a camera
 * button. A scanned or typed code that matches a barcode / SKU exactly is
 * picked at once; anything else filters the list. Shared by the Move stock
 * sheet and the scan page's "assign this code" step.
 */
export function LinePicker({
  lines,
  query,
  onQuery,
  onPick,
  emptyHint = "Assign the barcode on the product page first.",
  autoFocus = true,
  className,
}: {
  lines: Line[]
  query: string
  onQuery: (q: string) => void
  onPick: (line: Line) => void
  emptyHint?: string
  autoFocus?: boolean
  className?: string
}) {
  const [active, setActive] = useState(0)
  const listId = useId()
  const q = query.trim().toLowerCase()
  // A scanned barcode matches exactly and jumps straight to the line.
  const exact = exactMatch(lines, q)
  const matches = q ? lines.filter((l) => q.split(/\s+/).every((w) => l.text.includes(w))) : lines
  const shown = (exact ? [exact, ...matches.filter((m) => m !== exact)] : matches).slice(0, 40)

  // A new query means the old highlight is meaningless; clamping also stops it
  // pointing past the end when one more letter shortens the list.
  const at = Math.min(active, Math.max(shown.length - 1, 0))

  useEffect(() => {
    setActive(0)
  }, [query])

  // Forty rows scroll, so the highlight has to bring itself into view.
  useEffect(() => {
    document
      .getElementById(`${listId}-${at}`)
      ?.scrollIntoView({ block: "nearest" })
  }, [listId, at])

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shown.length) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      event.stopPropagation()
      const by = event.key === "ArrowDown" ? 1 : -1
      setActive((prev) => {
        const from = Math.min(prev, shown.length - 1)
        return (from + by + shown.length) % shown.length
      })
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      onPick(shown[at])
    }
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Product, variant, SKU or barcode…"
            autoFocus={autoFocus}
            aria-label="Find a stock line"
            className="pl-8"
            role="combobox"
            aria-expanded={shown.length > 0}
            aria-controls={listId}
            aria-activedescendant={shown.length ? `${listId}-${at}` : undefined}
            autoComplete="off"
          />
        </div>
        <ScanButton
          title="Scan the line's barcode"
          onScan={(v) => {
            // A known code goes straight through; an unknown one is left in the box to show "nothing matches".
            const hit = exactMatch(lines, v.toLowerCase())
            if (hit) onPick(hit)
            else onQuery(v)
          }}
        />
      </div>
      {shown.length ? (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <div id={listId} role="listbox" aria-label="Stock lines" className="divide-y divide-border/70">
            {shown.map((l, i) => (
              <button
                key={l.sizeId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === at}
                type="button"
                tabIndex={-1}
                onClick={() => onPick(l)}
                // Hovering moves the highlight, so mouse and keyboard never
                // disagree about which row Enter would take.
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                  i === at ? "bg-secondary" : "hover:bg-secondary/60"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {l.product}
                    <span className="text-muted-foreground"> · </span>
                    {l.variant}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{lineDetail(l)}</span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  <span className="tabular text-foreground">{fmtQty(l.totals.available)}</span> avail.
                </span>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
          {matches.length > shown.length ? (
            <p className="border-t border-border/70 px-3 py-1.5 text-xs text-muted-foreground">
              {matches.length - shown.length} more — keep typing to narrow it down.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {lines.length ? `Nothing matches “${query.trim()}”. ${emptyHint}` : "No stock lines yet — create a product first."}
        </p>
      )}
    </div>
  )
}
