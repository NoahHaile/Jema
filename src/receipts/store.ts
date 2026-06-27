/**
 * Weekly payments store. Persists confirmed receipts to data/payments.json and
 * answers "who paid this week" (TIMEZONE-aware ISO week).
 *
 * If a user posts more than once in the same week, we keep ALL records but
 * dedupe per user in the /paidlist view, showing their most recent amount.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DEFAULT_CURRENCY } from "../config.js";
import { currentWeekKey } from "../week.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const STORE_PATH = join(DATA_DIR, "payments.json");

export interface Payment {
  userId: number;
  name: string;
  amount: number | null;
  currency: string;
  reference: string | null;
  receiptDate: string | null;
  recordedAt: string;
  weekKey: string;
}

function readAll(): Payment[] {
  try {
    if (!existsSync(STORE_PATH)) return [];
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return Array.isArray(parsed) ? (parsed as Payment[]) : [];
  } catch (err) {
    console.warn("[payments] failed to read:", err);
    return [];
  }
}

function writeAll(payments: Payment[]): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(payments, null, 2), "utf8");
  } catch (err) {
    console.warn("[payments] failed to persist:", err);
  }
}

/** Append a confirmed payment, crediting the poster. Returns the stored record. */
export function recordPayment(input: {
  userId: number;
  name: string;
  amount: number | null;
  currency: string | null;
  reference: string | null;
  receiptDate: string | null;
}): Payment {
  const payment: Payment = {
    userId: input.userId,
    name: input.name,
    amount: input.amount,
    currency: input.currency || DEFAULT_CURRENCY,
    reference: input.reference,
    receiptDate: input.receiptDate,
    recordedAt: new Date().toISOString(),
    weekKey: currentWeekKey(),
  };
  const all = readAll();
  all.push(payment);
  writeAll(all);
  console.log(
    `[payments] recorded ${payment.amount ?? "?"} ${payment.currency} from ${payment.name} (week ${payment.weekKey})`,
  );
  return payment;
}

/**
 * Payments recorded in the current ISO week, deduped per user (latest wins),
 * ordered by most recent first.
 */
export function getCurrentWeekPayments(): Payment[] {
  const week = currentWeekKey();
  const thisWeek = readAll().filter((p) => p.weekKey === week);

  // Dedupe by user, keeping the most recently recorded entry.
  const latestByUser = new Map<number, Payment>();
  for (const p of thisWeek) {
    const existing = latestByUser.get(p.userId);
    if (!existing || p.recordedAt > existing.recordedAt) {
      latestByUser.set(p.userId, p);
    }
  }
  return [...latestByUser.values()].sort((a, b) =>
    b.recordedAt.localeCompare(a.recordedAt),
  );
}

/** Sum amounts (ignoring null) and format with the dominant currency. */
export function formatWeekTotal(payments: Payment[]): string {
  const sum = payments.reduce((acc, p) => acc + (p.amount ?? 0), 0);
  // Use the most common currency among entries with an amount.
  const counts = new Map<string, number>();
  for (const p of payments) {
    if (p.amount != null) counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1);
  }
  let currency = DEFAULT_CURRENCY;
  let best = 0;
  for (const [cur, n] of counts) {
    if (n > best) {
      best = n;
      currency = cur;
    }
  }
  return `${sum} ${currency}`;
}
