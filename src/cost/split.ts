/**
 * Court cost-splitting math. Pure + testable: no I/O, no Telegram.
 *
 * The standard booking is a fixed total (COURT_COST) for a 1-hour slot, split
 * evenly across everyone who's in. Per-person is rounded UP (ceil) so the pot
 * always covers the booking.
 */
import type { Payment } from "../receipts/store.js";

/** Per-person share, rounded up. Null when nobody's in (avoid divide-by-zero). */
export function perPerson(total: number, headcount: number): number | null {
  if (headcount <= 0) return null;
  return Math.ceil(total / headcount);
}

export interface Collection {
  collected: number;
  needed: number;
  remaining: number;
  over: number;
  paidCount: number;
}

/**
 * Collection progress toward the booking total from this week's payments.
 * `collected` sums payment amounts (nulls count as 0). `paidCount` counts
 * distinct payers (payments are already deduped per user by the store).
 */
export function collection(total: number, payments: Payment[]): Collection {
  const collected = payments.reduce((acc, p) => acc + (p.amount ?? 0), 0);
  return {
    collected,
    needed: total,
    remaining: Math.max(0, total - collected),
    over: Math.max(0, collected - total),
    paidCount: payments.length,
  };
}
