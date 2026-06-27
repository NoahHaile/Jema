/**
 * Active-poll persistence for the weekly run-poll cycle.
 *
 * Only ONE poll is active at a time. When the Monday job posts the poll we save
 * its identity + options here; as `poll_answer` updates stream in we accumulate
 * each voter's choice. The Friday job reads this to announce who's in, then
 * clears it.
 *
 * Why we accumulate answers ourselves: Telegram's `stopPoll` returns only
 * aggregate vote *counts*, never voter identities. The only way to know WHO
 * voted for what is to capture `poll_answer` updates during the voting window —
 * which requires the bot to be online throughout (fine for a long-running
 * service) and `poll_answer` to be in the bot's allowed_updates.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const STORE_PATH = join(DATA_DIR, "poll.json");

export interface PollAnswer {
  name: string;
  optionIndexes: number[];
}

export interface ActivePoll {
  chatId: number;
  messageId: number;
  pollId: string;
  question: string;
  options: string[];
  postedAt: string;
  answers: Record<string, PollAnswer>;
}

let cached: ActivePoll | null | undefined;

function persist(poll: ActivePoll | null): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    if (poll === null) {
      writeFileSync(STORE_PATH, JSON.stringify({ active: null }, null, 2), "utf8");
    } else {
      writeFileSync(STORE_PATH, JSON.stringify({ active: poll }, null, 2), "utf8");
    }
    cached = poll;
  } catch (err) {
    console.warn("[pollStore] failed to persist:", err);
  }
}

export function getActivePoll(): ActivePoll | null {
  if (cached !== undefined) return cached;
  try {
    if (!existsSync(STORE_PATH)) {
      cached = null;
      return null;
    }
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as {
      active: ActivePoll | null;
    };
    cached = parsed.active ?? null;
    return cached;
  } catch (err) {
    console.warn("[pollStore] failed to read:", err);
    cached = null;
    return null;
  }
}

/** Start a fresh cycle: overwrite any previous poll with no answers. */
export function startPoll(input: {
  chatId: number;
  messageId: number;
  pollId: string;
  question: string;
  options: string[];
}): ActivePoll {
  const poll: ActivePoll = {
    ...input,
    postedAt: new Date().toISOString(),
    answers: {},
  };
  persist(poll);
  console.log(
    `[pollStore] started poll pollId=${input.pollId} messageId=${input.messageId} (${input.options.length} options)`,
  );
  return poll;
}

/**
 * Upsert a voter's answer into the active poll. Empty optionIndexes = retraction
 * → remove the voter. No-ops if the pollId doesn't match the active poll.
 */
export function recordAnswer(
  pollId: string,
  userId: number,
  name: string,
  optionIndexes: number[],
): void {
  const poll = getActivePoll();
  if (!poll || poll.pollId !== pollId) return;

  const key = String(userId);
  if (optionIndexes.length === 0) {
    delete poll.answers[key]; // vote retracted
  } else {
    poll.answers[key] = { name, optionIndexes };
  }
  persist(poll);
}

/** Clear the active poll (end of cycle). */
export function clearPoll(): void {
  persist(null);
}
