/**
 * /paidlist — show who has paid this week (TIMEZONE-aware ISO week), one line
 * per unique payer with their most recent amount, plus collection progress
 * toward the court total (from the committed game).
 */
import type { Context } from "grammy";
import { DEFAULT_CURRENCY } from "../config.js";
import { getCurrentWeekPayments } from "../receipts/store.js";
import { getGame } from "../game/store.js";
import { collection } from "../cost/split.js";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export async function paidlistCommand(ctx: Context): Promise<void> {
  const payments = getCurrentWeekPayments();
  const game = getGame();

  if (payments.length === 0) {
    await ctx.reply("Nobody's paid yet this week 👀");
    return;
  }

  const lines = payments.map((p) => {
    const amount = p.amount != null ? `${p.amount} ${p.currency}` : "logged";
    return `• ${p.name} — ${amount}`;
  });

  // Collection progress against the committed game total, if there is one.
  let progress: string;
  if (game) {
    const c = collection(game.total, payments);
    const headcount = game.committed.length;
    const base = `Collected ${fmt(c.collected)} / ${fmt(c.needed)} ${DEFAULT_CURRENCY} · ${c.paidCount}/${headcount} paid`;
    if (c.over > 0) {
      progress = `${base} · ⚠️ over by ${fmt(c.over)} — refund due`;
    } else if (c.remaining === 0) {
      progress = `${base} · ✅ fully collected`;
    } else {
      progress = `${base} · ${fmt(c.remaining)} to go`;
    }
  } else {
    // No locked game yet — just show the raw total paid in.
    const sum = payments.reduce((acc, p) => acc + (p.amount ?? 0), 0);
    progress = `Total in: ${fmt(sum)} ${DEFAULT_CURRENCY} (split is set when the day locks Friday)`;
  }

  await ctx.reply(`💸 Paid this week:\n${lines.join("\n")}\n\n${progress}`);
}
