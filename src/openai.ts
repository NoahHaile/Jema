/**
 * OpenAI caption generation for REMINDER call-out memes.
 *
 * Memes are reminder-only now: the bot roasts a specific person for a specific
 * excuse (not voting, or not paying). The model adapts the caption to the chosen
 * template's top/bottom style — we pass the format's structure + worked sample
 * as a few-shot so it fits the template and stays fresh.
 *
 * Uses OPENAI_CAPTION_MODEL (text-only, cheap — gpt-4o-mini by default; can be
 * dropped to an even cheaper text model). JSON mode; high temperature for variety.
 */
import OpenAI from "openai";
import { OPENAI_CAPTION_MODEL, requireEnv } from "./config.js";
import type { MemeFormat } from "./meme/formats.js";

export interface Caption {
  top: string;
  bottom: string;
}

export type CalloutKind = "vote" | "pay" | "roast";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return client;
}

const SYSTEM_PROMPT = `You are the trash-talk meme writer for a pickup basketball crew's group chat.
You write HARSH memes that publicly roast one crew member — either for slacking (not voting / not committing to the game, or not paying their court-fee share), or just to humble their game and ego on request.

ALLOWED (go hard): basketball skill, ego, missed shots, airballs, bricks, travels, ball-hogging, getting crossed, being washed, riding the bench, no-shows, terrible defense, delusional confidence, being broke/cheap, dodging the bill, empty wallet.

HARD GUARDRAILS — NEVER cross these:
- No slurs, hate speech, or attacks on race, religion, gender, sexuality, nationality, disability, or any protected class.
- No sexual content.
- No genuinely cruel personal attacks (family, looks/body-shaming beyond gym jokes, real misfortune, mental health, real financial hardship).
Keep it to disrespectful BASKETBALL + MONEY trash talk between friends.

LENGTH: each line must be PUNCHY and short — aim for 8 words or fewer per line. No rambling. A meme is read in a glance.
NAMING: name the SPECIFIC person given. Make them feel seen.
ADAPT: write the captions in the GIVEN TEMPLATE's top/bottom style (use its structure + worked example as your guide), but keep it fresh — do not copy the example.

Respond ONLY as JSON: {"top": "...", "bottom": "..."}`;

export interface CalloutCaptionInput {
  format: MemeFormat;
  targetName: string;
  excuse: string;
  kind: CalloutKind;
}

function buildUserMessage(input: CalloutCaptionInput): string {
  const { format, targetName, excuse, kind } = input;
  const offense =
    kind === "vote"
      ? `${targetName} hasn't voted in the day-poll / won't commit to showing up`
      : kind === "pay"
        ? `${targetName} hasn't paid their share of the court fee`
        : `${targetName} struts around like a star — time to humble their game and ego`;

  return [
    `TEMPLATE: ${format.name}`,
    `How this template works: ${format.structure}`,
    `Best for: ${format.bestFor}`,
    `Worked example (match this template's style, don't copy it):`,
    `  TOP: ${format.sample.top}`,
    `  BOTTOM: ${format.sample.bottom}`,
    ``,
    `CALL-OUT: ${offense}.`,
    `The savage reason to lean into: "${excuse}".`,
    `Roast ${targetName} for this, in the "${format.name}" template's style.`,
    `Keep each line short and punchy (<= ~8 words). Make it land.`,
  ].join("\n");
}

/**
 * Write a HARSH call-out caption: roast `targetName` for `excuse`, in the chosen
 * template's top/bottom style.
 */
export async function writeCalloutCaption(
  input: CalloutCaptionInput,
): Promise<Caption> {
  const completion = await getClient().chat.completions.create({
    model: OPENAI_CAPTION_MODEL,
    response_format: { type: "json_object" },
    temperature: 1.0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(input) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response");

  const parsed = JSON.parse(raw) as Partial<Caption>;
  return {
    top: typeof parsed.top === "string" ? parsed.top : "",
    bottom: typeof parsed.bottom === "string" ? parsed.bottom : "",
  };
}
