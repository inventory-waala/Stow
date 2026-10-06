/**
 * Placeholder dashboard data. Deterministic so server and client render the
 * same numbers; swap for inventory-service queries when that exists.
 */

export const STATS = [
  { label: "Stock value", value: "$184,320", delta: "+2.1%", hint: "vs last week", tone: "up" },
  { label: "Low stock", value: "12", delta: "3 out", hint: "below reorder point", tone: "warn" },
  { label: "Open purchase orders", value: "7", delta: "$23,400", hint: "inbound this week", tone: "flat" },
  { label: "Orders today", value: "48", delta: "6", hint: "awaiting pick", tone: "flat" },
] as const

export const ATTENTION = [
  { sku: "LK-1187", name: "Linen cushion cover, sage", onHand: 23, reorder: 30, suggest: 60 },
  { sku: "LK-3304", name: "Brass hook, single", onHand: 0, reorder: 50, suggest: 120 },
  { sku: "LK-0912", name: "Wool throw, charcoal", onHand: 6, reorder: 15, suggest: 30 },
  { sku: "LK-2771", name: "Stoneware bowl, 18 cm", onHand: 11, reorder: 20, suggest: 40 },
  { sku: "LK-4410", name: "Oak coat rail, 600 mm", onHand: 4, reorder: 10, suggest: 24 },
]

export type OrderStatus = "Packed" | "Awaiting pick" | "Shipped" | "On hold"

export const ORDERS: {
  id: string
  customer: string
  items: number
  total: string
  status: OrderStatus
  placed: string
}[] = [
  { id: "SO-10482", customer: "Marrow & Co.", items: 14, total: "$1,240.00", status: "Awaiting pick", placed: "09:12" },
  { id: "SO-10481", customer: "Ferro Tools", items: 3, total: "$318.50", status: "Packed", placed: "08:57" },
  { id: "SO-10480", customer: "Bramble Foods", items: 22, total: "$2,075.00", status: "Shipped", placed: "08:41" },
  { id: "SO-10479", customer: "Ridgeline Outfitters", items: 6, total: "$482.00", status: "On hold", placed: "08:30" },
  { id: "SO-10478", customer: "Larkspur Home", items: 9, total: "$766.20", status: "Shipped", placed: "Yesterday" },
  { id: "SO-10477", customer: "Northwind Supply", items: 31, total: "$3,910.00", status: "Shipped", placed: "Yesterday" },
]

// 30 days of units received vs shipped, seeded so it never changes between renders.
export const MOVEMENT = Array.from({ length: 30 }, (_, i) => {
  const day = 30 - i
  const wave = Math.sin(i / 4.2) * 90 + Math.cos(i / 1.7) * 35
  const weekend = (i + 2) % 7 < 2
  return {
    day: `${day}d`,
    label: day === 1 ? "Yesterday" : `${day} days ago`,
    received: Math.round((weekend ? 120 : 340) + wave * 0.6 + ((i * 37) % 50)),
    shipped: Math.round((weekend ? 160 : 410) + wave + ((i * 53) % 70)),
  }
})
