/**
 * test:targets — offline proof of the cross-reference logic. No secrets, no I/O.
 * Feeds fake members + an active poll + this week's payments, prints and asserts
 * nonVoters and unpaidVoters.
 */
import type { Member } from "./members/store.js";
import type { ActivePoll } from "./pollStore.js";
import type { Payment } from "./receipts/store.js";
import type { Game } from "./game/store.js";
import {
  nonVoters,
  unpaidVoters,
  unpaidGameMembers,
} from "./accountability/targets.js";

const members: Member[] = [
  { userId: 1, firstName: "Noah", username: "noah", lastSeenAt: "" },
  { userId: 2, firstName: "Mike", username: null, lastSeenAt: "" },
  { userId: 3, firstName: "Kev", username: "kevdunks", lastSeenAt: "" },
  { userId: 4, firstName: "LeBron", username: null, lastSeenAt: "" },
];

// Mike (2) and Kev (3) voted. Noah (1) and LeBron (4) did NOT. User 9 voted but
// isn't in the roster (tests the poll-answer name fallback).
const activePoll: ActivePoll = {
  chatId: -100,
  messageId: 5,
  pollId: "p1",
  question: "Which day?",
  options: ["Sat", "Sun"],
  postedAt: "",
  answers: {
    "2": { name: "Mike", optionIndexes: [0] },
    "3": { name: "Kev @kevdunks", optionIndexes: [0, 1] },
    "9": { name: "Ghost", optionIndexes: [1] },
  },
};

// Only Kev (3) paid this week. Mike (2) and Ghost (9) voted but haven't paid.
const payments: Payment[] = [
  {
    userId: 3,
    name: "Kev",
    amount: 500,
    currency: "KSh",
    reference: "R1",
    receiptDate: null,
    recordedAt: "2026-01-01T00:00:00Z",
    weekKey: "now",
  },
];

// Committed game (post-close source of truth for pay-nags): Mike(2), Kev(3),
// and Ghost(9) committed. Only Kev paid -> Mike + Ghost owe.
const game: Game = {
  weekKey: "now",
  slot: "Sun",
  total: 1200,
  committed: [
    { userId: 2, name: "Mike" },
    { userId: 3, name: "Kev" },
    { userId: 9, name: "Ghost" },
  ],
};

const nv = nonVoters(members, activePoll);
const uv = unpaidVoters(activePoll, payments, members);
const ug = unpaidGameMembers(game, payments, members);

console.log("=== nonVoters ===");
console.log(nv.map((t) => `${t.name} (id ${t.userId})`).join(", ") || "(none)");
console.log("\n=== unpaidVoters (live poll) ===");
console.log(uv.map((t) => `${t.name} (id ${t.userId})`).join(", ") || "(none)");
console.log("\n=== unpaidGameMembers (committed game) ===");
console.log(ug.map((t) => `${t.name} (id ${t.userId})`).join(", ") || "(none)");

console.log("\n=== empty guards ===");
console.log("nonVoters(null):", nonVoters(members, null).length);
console.log("unpaidVoters(null):", unpaidVoters(null, payments, members).length);
console.log("unpaidGameMembers(null):", unpaidGameMembers(null, payments, members).length);

// Assertions.
const nvIds = nv.map((t) => t.userId).sort((a, b) => a - b);
if (JSON.stringify(nvIds) !== JSON.stringify([1, 4])) {
  throw new Error(`nonVoters expected [1,4], got [${nvIds}]`);
}

const uvIds = uv.map((t) => t.userId).sort((a, b) => a - b);
if (JSON.stringify(uvIds) !== JSON.stringify([2, 9])) {
  throw new Error(`unpaidVoters expected [2,9], got [${uvIds}]`);
}
// Ghost (9) isn't in the roster -> name falls back to the poll-answer name.
const ghost = uv.find((t) => t.userId === 9);
if (!ghost || ghost.name !== "Ghost" || ghost.member !== null) {
  throw new Error("unpaidVoters fallback name for non-roster voter failed");
}
if (nonVoters(members, null).length !== 0 || unpaidVoters(null, payments, members).length !== 0) {
  throw new Error("no-active-poll guard failed");
}

console.log("\nAll target assertions passed ✅");
