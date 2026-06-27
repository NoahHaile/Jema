/**
 * /split — show the current court cost split from the committed game.
 * If the day isn't locked yet (no game), explain that the split is set Friday.
 */
import type { Context } from "grammy";
import { DEFAULT_CURRENCY } from "../config.js";
import { getGame } from "../game/store.js";
import { perPerson } from "../cost/split.js";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export async function splitCommand(ctx: Context): Promise<void> {
  const game = getGame();
  if (!game || game.committed.length === 0) {
    await ctx.reply(
      "No split yet — it's set when the day's locked in Friday morning. Vote in the poll to get counted 🏀",
    );
    return;
  }

  const headcount = game.committed.length;
  const each = perPerson(game.total, headcount);
  await ctx.reply(
    `Court's ${fmt(game.total)} ${DEFAULT_CURRENCY} ÷ ${headcount} in = ${each !== null ? fmt(each) : "?"} ${DEFAULT_CURRENCY} each`,
  );
}
