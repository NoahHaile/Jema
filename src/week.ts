/**
 * TIMEZONE-aware ISO week helpers (Monday-based).
 *
 * We compute the calendar date *in the configured timezone* (not the server's
 * local zone) so a "week" lines up with the group's actual Mon–Sun, then derive
 * an ISO week key. No external date library needed.
 */
import { TIMEZONE } from "./config.js";

/** Get Y/M/D as seen in TIMEZONE for a given instant. */
function ymdInTz(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * ISO 8601 week key like "2026-W27" for the given instant, computed in TIMEZONE.
 * ISO weeks start Monday; the week containing the year's first Thursday is W01.
 */
export function isoWeekKey(date: Date = new Date()): string {
  const { year, month, day } = ymdInTz(date);
  // Work in a UTC anchor for the local calendar date to avoid DST drift.
  const d = new Date(Date.UTC(year, month - 1, day));
  // ISO: Monday=0..Sunday=6
  const dayNum = (d.getUTCDay() + 6) % 7;
  // Shift to the Thursday of this week.
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** The ISO week key for "now". */
export function currentWeekKey(): string {
  return isoWeekKey(new Date());
}
