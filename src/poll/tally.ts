/**
 * Pure poll-tally logic. No Telegram, no I/O — so it can be unit-tested offline
 * (see `npm run test:winner`).
 *
 * Two views over the accumulated `poll_answer` data:
 *  - leader: the single option with the most voters (for the Thu "last call").
 *  - winner: the highest-voter option(s) at close, plus the names of everyone
 *    whose vote included a winning option (for the Fri announce).
 *
 * Multi-answer polls are supported: a voter can contribute to several options.
 */
import type { PollAnswer } from "../pollStore.js";

/** Count voters per option index. */
export function countVotes(
  options: string[],
  answers: Record<string, PollAnswer>,
): number[] {
  const counts = new Array(options.length).fill(0);
  for (const answer of Object.values(answers)) {
    for (const idx of answer.optionIndexes) {
      if (idx >= 0 && idx < counts.length) counts[idx] += 1;
    }
  }
  return counts;
}

export interface Leader {
  option: string;
  votes: number;
}

/** Single leading option (first one wins ties). Null if no votes at all. */
export function computeLeader(
  options: string[],
  answers: Record<string, PollAnswer>,
): Leader | null {
  const counts = countVotes(options, answers);
  let bestIdx = -1;
  let bestVotes = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > bestVotes) {
      bestVotes = counts[i];
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return null;
  return { option: options[bestIdx], votes: bestVotes };
}

export interface WinningVoter {
  userId: number;
  name: string;
}

export interface WinnerResult {
  /** All options tied for the top voter count. */
  winners: string[];
  votes: number;
  /** Names of everyone whose vote included ANY winning option (deduped). */
  voters: string[];
  /** userId+name of everyone whose vote included ANY winning option (deduped). */
  winningVoters: WinningVoter[];
  /** True when nobody voted. */
  empty: boolean;
}

/**
 * Compute the winning option(s) and who's in.
 *
 * `counts` may be supplied from Telegram's stopPoll aggregate (authoritative for
 * totals). If omitted, counts are derived from the stored answers. Either way,
 * the "who's in" names come ONLY from the stored answers (stopPoll has no
 * identities), matched against the winning option indexes.
 */
export function computeWinner(
  options: string[],
  answers: Record<string, PollAnswer>,
  counts?: number[],
): WinnerResult {
  const voteCounts = counts ?? countVotes(options, answers);
  const max = Math.max(0, ...voteCounts);

  if (max === 0) {
    return { winners: [], votes: 0, voters: [], winningVoters: [], empty: true };
  }

  const winnerIdxs: number[] = [];
  for (let i = 0; i < voteCounts.length; i++) {
    if (voteCounts[i] === max) winnerIdxs.push(i);
  }
  const winners = winnerIdxs.map((i) => options[i]);

  const winnerSet = new Set(winnerIdxs);
  const voters: string[] = [];
  const winningVoters: WinningVoter[] = [];
  const seen = new Set<string>();
  for (const [userIdStr, answer] of Object.entries(answers)) {
    if (answer.optionIndexes.some((idx) => winnerSet.has(idx))) {
      if (!seen.has(answer.name)) {
        seen.add(answer.name);
        voters.push(answer.name);
      }
      winningVoters.push({ userId: Number(userIdStr), name: answer.name });
    }
  }

  return { winners, votes: max, voters, winningVoters, empty: false };
}
