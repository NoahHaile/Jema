/**
 * Reminder call-out meme pipeline.
 *
 * Memes are reminder-only: the bot roasts a specific person for a specific
 * excuse (didn't vote, or didn't pay). Steps:
 *  1. Pick a random template from the curated catalog.
 *  2. Pick a random HARSH excuse from the matching bank (vote / pay).
 *  3. Ask the model to write a punchy top/bottom caption in that template's
 *     style, roasting the named person for the excuse.
 *  4. Resolve the template image (by imgflip id) and render top/bottom.
 */
import { getTwoBoxTemplates, findById } from "./templates.js";
import { FORMATS, type MemeFormat } from "./formats.js";
import { pickOne } from "./adlibs.js";
import { writeCalloutCaption, type CalloutKind } from "../openai.js";
import { renderMeme } from "./render.js";
import { VOTE_EXCUSES, PAY_EXCUSES, ROAST_ANGLES } from "../reminders/excuses.js";

export interface BuiltMeme {
  buffer: Buffer;
  formatName: string;
  kind: CalloutKind;
  targetName: string;
  excuse: string;
  top: string;
  bottom: string;
}

/** Resolve a format's image url from the live catalog (by id), else fallback. */
async function resolveFormatUrl(format: MemeFormat): Promise<string> {
  try {
    const templates = await getTwoBoxTemplates();
    const match = findById(templates, format.imgflipId);
    if (match) return match.url;
  } catch {
    // fall through to the format's hardcoded url
  }
  return format.url;
}

/**
 * Build a reminder call-out meme for `name`, roasting them for a random excuse
 * from the bank matching `kind`. Throws on any step failure; callers handle it.
 */
export async function buildCalloutMeme(input: {
  name: string;
  kind: CalloutKind;
}): Promise<BuiltMeme> {
  const format = pickOne(FORMATS);
  const bank =
    input.kind === "vote"
      ? VOTE_EXCUSES
      : input.kind === "pay"
        ? PAY_EXCUSES
        : ROAST_ANGLES;
  const excuse = pickOne(bank);

  const caption = await writeCalloutCaption({
    format,
    targetName: input.name,
    excuse,
    kind: input.kind,
  });

  const url = await resolveFormatUrl(format);
  const buffer = await renderMeme(url, caption.top, caption.bottom);

  return {
    buffer,
    formatName: format.name,
    kind: input.kind,
    targetName: input.name,
    excuse,
    top: caption.top,
    bottom: caption.bottom,
  };
}
