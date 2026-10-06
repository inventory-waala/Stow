import { PrismaService } from '../prisma/prisma.service';

export interface StockTotals {
  quantity: string;
  reserved: string;
  available: string;
}

const ZERO: StockTotals = { quantity: '0', reserved: '0', available: '0' };

/**
 * Sums stock_levels per size. Decimals are returned as strings so the JSON
 * response carries exact values; the caller never does arithmetic on them.
 */
export async function summarizeStock(
  prisma: PrismaService,
  sizeIds: string[],
): Promise<Map<string, StockTotals>> {
  const out = new Map<string, StockTotals>();
  if (sizeIds.length === 0) return out;

  const rows = await prisma.stockLevel.groupBy({
    by: ['size_id'],
    where: { size_id: { in: sizeIds } },
    _sum: { quantity: true, reserved: true },
  });
  for (const r of rows) {
    const quantity = r._sum.quantity ?? 0;
    const reserved = r._sum.reserved ?? 0;
    out.set(r.size_id, {
      quantity: quantity.toString(),
      reserved: reserved.toString(),
      available: Number(quantity) - Number(reserved) + '',
    });
  }
  return out;
}

export function totalsFor(
  map: Map<string, StockTotals>,
  sizeId: string,
): StockTotals {
  return map.get(sizeId) ?? ZERO;
}

/** Adds up per-size totals into a variant- or product-level total. */
export function sumTotals(list: StockTotals[]): StockTotals {
  let q = 0;
  let r = 0;
  for (const t of list) {
    q += Number(t.quantity);
    r += Number(t.reserved);
  }
  return { quantity: String(q), reserved: String(r), available: String(q - r) };
}
