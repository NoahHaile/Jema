import "dotenv/config";

/**
 * Central config. Everything here is env-overridable with sensible defaults so
 * the bot runs autonomously out of the box.
 *
 * Only `index.ts` (the live bot) requires BOT_TOKEN / OPENAI_API_KEY. The
 * `sample` and `schedule:check` scripts deliberately avoid touching these so
 * they can run with no secrets.
 */

/**
 * Receipt VISION model — must be multimodal. gpt-4o-mini is among OpenAI's
 * cheapest multimodal models.
 */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Meme CAPTION model — text-only, cheap. gpt-4o-mini is among OpenAI's cheapest;
 * this can safely be dropped to an even cheaper text model if desired.
 */
export const OPENAI_CAPTION_MODEL =
  process.env.OPENAI_CAPTION_MODEL || "gpt-4o-mini";

/** IANA timezone all scheduled jobs run in. Default: Ethiopia (UTC+3). */
export const TIMEZONE = process.env.TIMEZONE || "Africa/Addis_Ababa";


/** Currency label shown when a receipt has an amount but unclear currency. */
export const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "birr";

/**
 * Total cost of the standard 1-hour court booking, in DEFAULT_CURRENCY. Split
 * evenly across everyone who's in (per-person rounded UP / ceil).
 */
export const COURT_COST = process.env.COURT_COST
  ? Number(process.env.COURT_COST)
  : 1200;

/**
 * Optional hard override for the target group. If unset, the bot
 * auto-registers the group it's added to (see chatStore).
 */
export const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID
  ? Number(process.env.GROUP_CHAT_ID)
  : undefined;

// ----- Weekly poll cycle (post -> remind -> close+announce) -----

export const POLL_CRON = process.env.POLL_CRON || "0 9 * * 1"; // Mon 09:00 — post
export const POLL_REMINDER_CRON =
  process.env.POLL_REMINDER_CRON || "0 12 * * 4"; // Thu 12:00 — last call
export const POLL_CLOSE_CRON =
  process.env.POLL_CLOSE_CRON || "0 18 * * 4"; // Thu 18:00 — close + announce

export const POLL_QUESTION =
  process.env.POLL_QUESTION || "🏀 When's this week's run? Tap every slot you can make 👇";

/** Pipe-separated override; defaults to Sat/Sun × 4–7pm slots. */
export const POLL_OPTIONS: string[] = process.env.POLL_OPTIONS
  ? process.env.POLL_OPTIONS.split("|").map((s) => s.trim()).filter(Boolean)
  : ["Sat 4pm", "Sat 5pm", "Sat 6pm", "Sat 7pm", "Sun 4pm", "Sun 5pm", "Sun 6pm", "Sun 7pm"];

// ----- Accountability enforcer (call out non-voters / non-payers) -----

/** Master toggle for the whole accountability layer. */
export const ACCOUNTABILITY_ENABLED =
  (process.env.ACCOUNTABILITY_ENABLED || "true").toLowerCase() !== "false";

/**
 * Vote-nudge crons: "a few random pokes" through the voting window. Each run
 * calls out 1 random non-voter. Default Tue 15:00, Wed 12:00, Thu 10:00.
 */
export const NUDGE_CRONS: string[] = process.env.NUDGE_CRONS
  ? process.env.NUDGE_CRONS.split("|").map((s) => s.trim()).filter(Boolean)
  : ["0 15 * * 2", "0 12 * * 3", "0 10 * * 4"];

/**
 * Pay-nag crons: keep nagging non-payers until they pay (stops naturally when
 * everyone's paid or the cycle resets Monday). Each run roasts 1–2 random unpaid
 * voters. Default Fri 18:00, Sat 11:00, Sun 11:00.
 */
export const PAYNAG_CRONS: string[] = process.env.PAYNAG_CRONS
  ? process.env.PAYNAG_CRONS.split("|").map((s) => s.trim()).filter(Boolean)
  : ["0 18 * * 5", "0 11 * * 6", "0 11 * * 0"];

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}
