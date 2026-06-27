/**
 * Autonomous scheduler.
 *
 * Defines the cron jobs and wires them to croner. Job definitions are exported
 * separately so `schedule:check` can print next-run times without a bot token.
 * Each job runs in the configured TIMEZONE.
 *
 * Weekly poll cycle:
 *   Mon 09:00  post the poll        -> starts a fresh cycle (resets pollStore)
 *   Thu 18:00  "last call" reminder -> text nudge with the current leader
 *   Fri 09:00  close + announce     -> stopPoll, pick winner, list who's in, clear
 *
 * The "who's in" names depend on the bot being online during the voting window
 * to receive `poll_answer` updates (it's a long-running service, so that holds).
 * `stopPoll` returns aggregate counts only — never voter identities — which is
 * exactly why we accumulate poll_answer in pollStore.
 */
import { Cron } from "croner";
import type { Bot, Api } from "grammy";
import {
  TIMEZONE,
  POLL_CRON,
  POLL_REMINDER_CRON,
  POLL_CLOSE_CRON,
  POLL_QUESTION,
  POLL_OPTIONS,
  ACCOUNTABILITY_ENABLED,
  NUDGE_CRONS,
  PAYNAG_CRONS,
  COURT_COST,
  DEFAULT_CURRENCY,
} from "./config.js";
import { getRegisteredChatId } from "./chatStore.js";
import { getActivePoll, startPoll, clearPoll } from "./pollStore.js";
import { computeLeader, computeWinner } from "./poll/tally.js";
import { getMembers } from "./members/store.js";
import { getCurrentWeekPayments } from "./receipts/store.js";
import { nonVoters, unpaidGameMembers, type Target } from "./accountability/targets.js";
import { deliverVoteNudge, deliverPayRoast } from "./accountability/callout.js";
import { setGame, getGame } from "./game/store.js";
import { perPerson } from "./cost/split.js";
import { currentWeekKey } from "./week.js";

/** A schedulable job: name + cron expression + the action to run. */
export interface JobDef {
  name: string;
  cron: string;
  run: (api: Api) => Promise<void>;
}

/** Resolve the target chat, logging a no-op when none is registered yet. */
function resolveTarget(jobName: string): number | null {
  const chatId = getRegisteredChatId();
  if (chatId === null) {
    console.log(
      `[scheduler] ${jobName}: no group registered yet — skipping. ` +
        "Add the bot to your group (or set GROUP_CHAT_ID) and it'll start posting.",
    );
    return null;
  }
  return chatId;
}

// --- Mon: post the poll, start a fresh cycle ---
async function runPollPost(api: Api): Promise<void> {
  const chatId = resolveTarget("poll-post");
  if (chatId === null) return;

  const message = await api.sendPoll(
    chatId,
    POLL_QUESTION,
    POLL_OPTIONS.map((text) => ({ text })),
    { is_anonymous: false, allows_multiple_answers: true },
  );

  const pollId = message.poll?.id;
  if (!pollId) {
    console.warn("[scheduler] poll-post: sendPoll returned no poll id; not tracking.");
    return;
  }
  startPoll({
    chatId,
    messageId: message.message_id,
    pollId,
    question: POLL_QUESTION,
    options: POLL_OPTIONS,
  });
  console.log(`[scheduler] poll posted to chatId=${chatId} (new cycle)`);
}

// --- Thu: "last call" reminder with the current leader ---
async function runPollReminder(api: Api): Promise<void> {
  const chatId = resolveTarget("poll-reminder");
  if (chatId === null) return;

  const poll = getActivePoll();
  if (!poll) {
    console.log("[scheduler] poll-reminder: no active poll — skipping.");
    return;
  }

  const leader = computeLeader(poll.options, poll.answers);
  const tail = leader
    ? `Current leader: ${leader.option} (${leader.votes} vote${leader.votes === 1 ? "" : "s"})`
    : "No votes yet — get in there!";
  await api.sendMessage(
    chatId,
    `⏰ Last call — voting closes this evening! ${tail}`,
  );
  console.log(`[scheduler] reminder posted to chatId=${chatId}`);
}

// --- Fri: close + announce winner + who's in ---
async function runPollClose(api: Api): Promise<void> {
  const chatId = resolveTarget("poll-close");
  if (chatId === null) return;

  const poll = getActivePoll();
  if (!poll) {
    console.log("[scheduler] poll-close: no active poll — skipping.");
    return;
  }

  // stopPoll returns the final aggregate counts (authoritative totals), but no
  // voter identities — we get those from the accumulated poll_answer data.
  let counts: number[] | undefined;
  try {
    const stopped = await api.stopPoll(poll.chatId, poll.messageId);
    counts = poll.options.map((_, i) => stopped.options[i]?.voter_count ?? 0);
  } catch (err) {
    console.warn("[scheduler] poll-close: stopPoll failed, using stored answers:", err);
  }

  const result = computeWinner(poll.options, poll.answers, counts);

  if (result.empty) {
    await api.sendMessage(chatId, "Poll's closed — no votes this week 🤷");
  } else {
    // Persist the committed game (who's in) BEFORE clearing the poll, so the
    // pay-nags have a roster to read after the poll is gone.
    const slot = result.winners[0];
    const game = setGame({
      weekKey: currentWeekKey(),
      slot,
      total: COURT_COST,
      committed: result.winningVoters.map((v) => ({ userId: v.userId, name: v.name })),
    });

    const headcount = game.committed.length;
    const each = perPerson(game.total, headcount);
    const winLine =
      result.winners.length === 1
        ? `🏀 ${slot} wins! ${headcount} in.`
        : `🏀 It's a tie: ${result.winners.join(", ")}! Going with ${slot}. ${headcount} in.`;
    const payHow =
      "\n📸 Pay your share, then send a SCREENSHOT (image) of your receipt here and I'll mark you paid.";
    const splitLine =
      each !== null
        ? `Court's ${fmt(game.total)} ${DEFAULT_CURRENCY} → ${fmt(each)} ${DEFAULT_CURRENCY} each.${payHow}`
        : `Court's ${fmt(game.total)} ${DEFAULT_CURRENCY}.${payHow}`;
    await api.sendMessage(chatId, `${winLine}\n${splitLine}`);
  }

  clearPoll();
  console.log(`[scheduler] poll closed + announced to chatId=${chatId}`);
}

/** Thousands-separated integer formatting, e.g. 1200 -> "1,200". */
function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// --- Accountability: pick N random targets without replacement. ---
function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

// --- Vote nudge: call out 1 random non-voter while the poll is open. ---
async function runVoteNudge(api: Api): Promise<void> {
  if (!ACCOUNTABILITY_ENABLED) return;
  const chatId = resolveTarget("vote-nudge");
  if (chatId === null) return;

  const poll = getActivePoll();
  const targets = nonVoters(getMembers(), poll);
  if (targets.length === 0) {
    console.log("[scheduler] vote-nudge: no non-voters (or no active poll) — skipping.");
    return;
  }
  const [target] = pickRandom(targets, 1);
  await deliverVoteNudge(api, chatId, target);
}

// --- Pay nag: roast 1–2 random unpaid committed players; nag until paid. ---
// Reads the COMMITTED GAME (persisted at poll-close), not the active poll —
// the poll is cleared at close, so this is the post-Friday source of truth.
async function runPayNag(api: Api): Promise<void> {
  if (!ACCOUNTABILITY_ENABLED) return;
  const chatId = resolveTarget("pay-nag");
  if (chatId === null) return;

  const game = getGame();
  const targets = unpaidGameMembers(game, getCurrentWeekPayments(), getMembers());
  if (!game || targets.length === 0) {
    console.log("[scheduler] pay-nag: nobody owes (or no committed game) — skipping.");
    return;
  }
  const owed = perPerson(game.total, game.committed.length);
  const owedLabel = owed !== null ? `${fmt(owed)} ${DEFAULT_CURRENCY}` : undefined;

  const chosen: Target[] = pickRandom(targets, 1 + Math.floor(Math.random() * 2)); // 1–2
  for (const target of chosen) {
    await deliverPayRoast(api, chatId, target, owedLabel);
  }
}

/**
 * Build the accountability JobDefs from the (possibly multiple) nudge/pay-nag
 * crons. Each cron becomes its own job so schedule:check lists them all.
 */
function accountabilityJobs(): JobDef[] {
  if (!ACCOUNTABILITY_ENABLED) return [];
  const jobs: JobDef[] = [];
  NUDGE_CRONS.forEach((cron, i) =>
    jobs.push({ name: `vote-nudge #${i + 1}`, cron, run: runVoteNudge }),
  );
  PAYNAG_CRONS.forEach((cron, i) =>
    jobs.push({ name: `pay-nag #${i + 1}`, cron, run: runPayNag }),
  );
  return jobs;
}

/**
 * The full set of scheduled jobs. Exported so schedule:check can introspect
 * crons without starting the bot.
 */
export const JOBS: JobDef[] = [
  { name: "poll-post (Mon)", cron: POLL_CRON, run: runPollPost },
  { name: "poll-reminder (Thu)", cron: POLL_REMINDER_CRON, run: runPollReminder },
  { name: "poll-close (Thu)", cron: POLL_CLOSE_CRON, run: runPollClose },
  ...accountabilityJobs(),
];

/**
 * Start all cron jobs against the bot's API. Each run is wrapped so a failing
 * job never crashes the process.
 */
export function startScheduler(bot: Bot): Cron[] {
  const crons = JOBS.map((job) =>
    new Cron(job.cron, { timezone: TIMEZONE, name: job.name }, async () => {
      try {
        console.log(`[scheduler] running job "${job.name}"`);
        await job.run(bot.api);
      } catch (err) {
        console.error(`[scheduler] job "${job.name}" failed:`, err);
      }
    }),
  );

  console.log(`[scheduler] started ${crons.length} jobs (timezone: ${TIMEZONE}).`);
  for (const c of crons) {
    console.log(
      `[scheduler]   ${c.name}: ${c.getPattern()} -> next ${c.nextRun()?.toISOString() ?? "n/a"}`,
    );
  }
  return crons;
}
