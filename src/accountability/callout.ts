/**
 * Call-out delivery: build a roast meme naming the target and post it with an
 * @-mention in the photo caption (parse_mode HTML, so the mention notifies the
 * target). Falls back to a text-only @-mention poke if the meme build fails so
 * the call-out still lands.
 */
import type { Api } from "grammy";
import { InputFile } from "grammy";
import { buildCalloutMeme } from "../meme/pipeline.js";
import { mentionHtml, type Member } from "../members/store.js";
import { pickOne } from "../meme/adlibs.js";
import type { Target } from "./targets.js";

/** HTML-mention a target (roster member -> @username/tg link; else plain name). */
function mention(target: Target): string {
  if (target.member) return mentionHtml(target.member);
  return escapeHtml(target.name);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const NUDGE_CAPTIONS = [
  "the poll's right there 👀",
  "we're still waiting on your vote 👀",
  "vote or get clowned (you chose) 👀",
  "the day-poll isn't gonna vote itself 👀",
];

const PAYNAG_CAPTIONS = [
  "court fee's still unpaid — send a screenshot of your receipt 📸💸",
  "you said you're coming, so where's the receipt screenshot? 📸💸",
  "pay up and drop the receipt image before tip-off 📸💸",
  "still no receipt from you — send the screenshot, champ 📸💸",
];

/**
 * Vote nudge: roast 1 non-voter for ghosting the day-vote.
 */
export async function deliverVoteNudge(
  api: Api,
  chatId: number,
  target: Target,
): Promise<void> {
  const tag = mention(target);
  const caption = `${tag} ${pickOne(NUDGE_CAPTIONS)}`;
  try {
    const built = await buildCalloutMeme({ name: target.name, kind: "vote" });
    await api.sendPhoto(chatId, new InputFile(built.buffer, "nudge.png"), {
      caption,
      parse_mode: "HTML",
    });
    console.log(
      `[accountability] vote nudge -> ${target.name} (format "${built.formatName}", excuse "${built.excuse}")`,
    );
  } catch (err) {
    console.error("[accountability] nudge meme failed, falling back to text:", err);
    await api.sendMessage(chatId, caption, { parse_mode: "HTML" });
  }
}

/**
 * Pay roast: roast 1 unpaid committed player for not paying the court fee.
 * `owedLabel` (e.g. "200 birr") is appended to the caption when known.
 */
export async function deliverPayRoast(
  api: Api,
  chatId: number,
  target: Target,
  owedLabel?: string,
): Promise<void> {
  const tag = mention(target);
  const owedSuffix = owedLabel ? ` You owe ${owedLabel}.` : "";
  const caption = `${tag} ${pickOne(PAYNAG_CAPTIONS)}${owedSuffix}`;
  try {
    const built = await buildCalloutMeme({ name: target.name, kind: "pay" });
    await api.sendPhoto(chatId, new InputFile(built.buffer, "paynag.png"), {
      caption,
      parse_mode: "HTML",
    });
    console.log(
      `[accountability] pay roast -> ${target.name} (format "${built.formatName}", excuse "${built.excuse}")`,
    );
  } catch (err) {
    console.error("[accountability] pay roast meme failed, falling back to text:", err);
    await api.sendMessage(chatId, caption, { parse_mode: "HTML" });
  }
}
