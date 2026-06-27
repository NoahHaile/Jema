/**
 * test:winner — offline proof of the tally logic. No Telegram, no secrets.
 * Feeds sample answers to computeLeader / computeWinner and prints results,
 * including a tie case and an empty case.
 */
import type { PollAnswer } from "./pollStore.js";
import { computeLeader, computeWinner, countVotes } from "./poll/tally.js";

const options = ["Sat morning", "Sat evening", "Sun morning", "Sun evening", "A weeknight"];

function show(label: string, answers: Record<string, PollAnswer>): void {
  console.log(`\n=== ${label} ===`);
  console.log("counts:", countVotes(options, answers));
  const leader = computeLeader(options, answers);
  console.log("leader:", leader ? `${leader.option} (${leader.votes})` : "none");
  const w = computeWinner(options, answers);
  if (w.empty) {
    console.log("winner: none — no votes 🤷");
  } else {
    console.log(
      `winner: ${w.winners.join(", ")} with ${w.votes} votes; in: ${w.voters.join(", ")}`,
    );
  }
}

// Clear winner: Sat morning (3), incl. a multi-answer voter.
show("clear winner", {
  "1": { name: "Daniel", optionIndexes: [0] },
  "2": { name: "Sam @sammy", optionIndexes: [0, 2] },
  "3": { name: "Priya", optionIndexes: [0] },
  "4": { name: "Leo", optionIndexes: [3] },
});

// Tie: Sat morning (2) and Sun evening (2).
show("tie", {
  "1": { name: "Daniel", optionIndexes: [0] },
  "2": { name: "Sam", optionIndexes: [0] },
  "3": { name: "Priya", optionIndexes: [3] },
  "4": { name: "Leo", optionIndexes: [3] },
});

// No votes.
show("empty", {});

// Sanity assertions so a regression fails the script loudly.
const clear = computeWinner(options, {
  "1": { name: "A", optionIndexes: [0] },
  "2": { name: "B", optionIndexes: [0, 1] },
});
if (!(clear.winners.length === 1 && clear.winners[0] === "Sat morning" && clear.votes === 2)) {
  throw new Error("clear-winner assertion failed");
}
if (clear.voters.length !== 2) throw new Error("voter-count assertion failed");

const tie = computeWinner(options, {
  "1": { name: "A", optionIndexes: [0] },
  "2": { name: "B", optionIndexes: [3] },
});
if (tie.winners.length !== 2) throw new Error("tie assertion failed");

if (!computeWinner(options, {}).empty) throw new Error("empty assertion failed");

console.log("\nAll tally assertions passed ✅");
