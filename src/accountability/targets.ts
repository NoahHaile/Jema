/**
 * Cross-reference logic for the accountability layer. Pure + testable: no I/O,
 * no Telegram. Given the roster, the active poll, and this week's payments,
 * compute who to call out.
 */
import type { Member } from "../members/store.js";
import type { ActivePoll } from "../pollStore.js";
import type { Payment } from "../receipts/store.js";
import type { Game } from "../game/store.js";

/** A person we can call out — resolved from roster or falling back to a name. */
export interface Target {
  userId: number;
  /** Roster member if known (enables a real @-mention / tg link). */
  member: Member | null;
  /** Best-effort display name (roster first name, or the poll-answer name). */
  name: string;
}

/**
 * Members who have NOT voted in the active poll.
 * No active poll => [].
 */
export function nonVoters(
  members: Member[],
  activePoll: ActivePoll | null,
): Target[] {
  if (!activePoll) return [];
  const voted = new Set(Object.keys(activePoll.answers)); // keys are userId strings
  return members
    .filter((m) => !voted.has(String(m.userId)))
    .map((m) => ({ userId: m.userId, member: m, name: m.firstName }));
}

/**
 * Voters (said they're coming) who have NOT paid this week, read from the LIVE
 * active poll. Falls back to the poll-answer name when not in the roster.
 * No active poll => [].
 *
 * Note: after the poll closes it's cleared, so pay-nags use the committed game
 * instead — see `unpaidGameMembers`.
 */
export function unpaidVoters(
  activePoll: ActivePoll | null,
  currentWeekPayments: Payment[],
  members: Member[],
): Target[] {
  if (!activePoll) return [];

  const paidUserIds = new Set(currentWeekPayments.map((p) => String(p.userId)));
  const memberById = new Map(members.map((m) => [String(m.userId), m]));

  const targets: Target[] = [];
  for (const [userIdStr, answer] of Object.entries(activePoll.answers)) {
    if (paidUserIds.has(userIdStr)) continue; // already paid
    const member = memberById.get(userIdStr) ?? null;
    targets.push({
      userId: Number(userIdStr),
      member,
      name: member?.firstName ?? answer.name,
    });
  }
  return targets;
}

/**
 * Committed players (post-close source of truth) who have NOT paid this week.
 * This is what the pay-nags read, since the poll is cleared at close. Falls back
 * to the name stored in the committed roster when not in the live roster.
 * No game => [].
 */
export function unpaidGameMembers(
  game: Game | null,
  currentWeekPayments: Payment[],
  members: Member[],
): Target[] {
  if (!game) return [];

  const paidUserIds = new Set(currentWeekPayments.map((p) => String(p.userId)));
  const memberById = new Map(members.map((m) => [String(m.userId), m]));

  const targets: Target[] = [];
  for (const person of game.committed) {
    if (paidUserIds.has(String(person.userId))) continue; // already paid
    const member = memberById.get(String(person.userId)) ?? null;
    targets.push({
      userId: person.userId,
      member,
      name: member?.firstName ?? person.name,
    });
  }
  return targets;
}
