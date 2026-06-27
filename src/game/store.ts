/**
 * Committed-game store. The source of truth for WHO IS IN after the poll closes.
 *
 * Fixes a gap: pay-nags used to read the active poll, but the poll is cleared at
 * close — so after Friday there was no one to nag. At close we persist the
 * committed roster (the winning-day voters) here, and pay-nags read from it.
 *
 * Persists to data/game.json.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const STORE_PATH = join(DATA_DIR, "game.json");

export interface CommittedPerson {
  userId: number;
  name: string;
}

export interface Game {
  weekKey: string;
  /** The winning poll option (e.g. "Sun evening"). */
  slot: string;
  /** Total court cost for the booking, in DEFAULT_CURRENCY. */
  total: number;
  committed: CommittedPerson[];
}

let cached: Game | null | undefined;

function persist(game: Game | null): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify({ game }, null, 2), "utf8");
    cached = game;
  } catch (err) {
    console.warn("[game] failed to persist:", err);
  }
}

export function getGame(): Game | null {
  if (cached !== undefined) return cached;
  try {
    if (!existsSync(STORE_PATH)) {
      cached = null;
      return null;
    }
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as { game: Game | null };
    cached = parsed.game ?? null;
  } catch (err) {
    console.warn("[game] failed to read:", err);
    cached = null;
  }
  return cached;
}

/** Set (replace) the committed game for the cycle. */
export function setGame(input: {
  weekKey: string;
  slot: string;
  total: number;
  committed: CommittedPerson[];
}): Game {
  const game: Game = {
    weekKey: input.weekKey,
    slot: input.slot,
    total: input.total,
    committed: dedupe(input.committed),
  };
  persist(game);
  console.log(
    `[game] committed game set: slot="${game.slot}", ${game.committed.length} in, total ${game.total}`,
  );
  return game;
}

/**
 * Add someone to the committed roster (idempotent by userId). No-op if there's
 * no active game. Returns the updated game, or null if there was none.
 */
export function addCommitted(person: CommittedPerson): Game | null {
  const game = getGame();
  if (!game) return null;
  if (game.committed.some((c) => c.userId === person.userId)) return game;
  game.committed.push(person);
  persist(game);
  console.log(
    `[game] added ${person.name} to committed roster (now ${game.committed.length} in).`,
  );
  return game;
}

export function clearGame(): void {
  persist(null);
}

function dedupe(people: CommittedPerson[]): CommittedPerson[] {
  const byId = new Map<number, CommittedPerson>();
  for (const p of people) if (!byId.has(p.userId)) byId.set(p.userId, p);
  return [...byId.values()];
}
