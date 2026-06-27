/**
 * Generic random helpers used by the meme pipeline and call-out delivery.
 * (The roast ad-lib banks were retired when memes became reminder-only; the
 * harsh excuse banks now live in src/reminders/excuses.ts.)
 */

/** Uniform random pick of one element. */
export function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Fisher–Yates sample of up to n distinct elements. */
export function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
