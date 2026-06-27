/**
 * Imgflip template catalog: fetch + in-memory cache.
 *
 * The public endpoint https://api.imgflip.com/get_memes needs no auth. We cache
 * the catalog in memory and refresh it if it's older than ~1 hour. We only ever
 * expose templates with `box_count === 2` (classic top/bottom two-caption memes),
 * which is what our renderer is built for.
 */

export interface ImgflipTemplate {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  box_count: number;
}

interface GetMemesResponse {
  success: boolean;
  data?: { memes: ImgflipTemplate[] };
  error_message?: string;
}

const CATALOG_URL = "https://api.imgflip.com/get_memes";
const TTL_MS = 60 * 60 * 1000; // ~1 hour

let cache: { templates: ImgflipTemplate[]; fetchedAt: number } | null = null;

/**
 * Returns all box_count===2 templates, using the in-memory cache when fresh.
 */
export async function getTwoBoxTemplates(): Promise<ImgflipTemplate[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return cache.templates;
  }

  const res = await fetch(CATALOG_URL);
  if (!res.ok) {
    if (cache) return cache.templates; // serve stale rather than fail
    throw new Error(`Imgflip catalog fetch failed: HTTP ${res.status}`);
  }

  const body = (await res.json()) as GetMemesResponse;
  if (!body.success || !body.data) {
    if (cache) return cache.templates;
    throw new Error(`Imgflip catalog error: ${body.error_message ?? "unknown"}`);
  }

  const templates = body.data.memes.filter((m) => m.box_count === 2);
  cache = { templates, fetchedAt: now };
  return templates;
}

/** Find a template by imgflip id. */
export function findById(
  templates: ImgflipTemplate[],
  id: string,
): ImgflipTemplate | undefined {
  return templates.find((t) => t.id === id);
}

/** Find a template by exact (case-insensitive) name. */
export function findByName(
  templates: ImgflipTemplate[],
  name: string,
): ImgflipTemplate | undefined {
  const target = name.trim().toLowerCase();
  return templates.find((t) => t.name.toLowerCase() === target);
}

/**
 * Cheap fuzzy fallback when the model's chosen name doesn't match exactly.
 * Scores by shared word tokens, then substring containment.
 */
export function closestByName(
  templates: ImgflipTemplate[],
  name: string,
): ImgflipTemplate | undefined {
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  const targetWords = new Set(target.split(/\s+/).filter(Boolean));

  let best: ImgflipTemplate | undefined;
  let bestScore = 0;
  for (const t of templates) {
    const lower = t.name.toLowerCase();
    let score = 0;
    if (lower.includes(target) || target.includes(lower)) score += 2;
    for (const w of lower.split(/\s+/)) {
      if (targetWords.has(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore > 0 ? best : undefined;
}

export function randomTemplate(
  templates: ImgflipTemplate[],
): ImgflipTemplate {
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Resolve a model-provided template name to a real catalog entry, with
 * graceful fallbacks: exact -> fuzzy -> random.
 */
export function resolveTemplate(
  templates: ImgflipTemplate[],
  name: string,
): ImgflipTemplate {
  return (
    findByName(templates, name) ??
    closestByName(templates, name) ??
    randomTemplate(templates)
  );
}
