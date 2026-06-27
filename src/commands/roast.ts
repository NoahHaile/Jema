/**
 * /roast — roast a specific player on demand.
 *   /roast @username                    — random roast angle
 *   /roast @username <something>        — roast them about YOUR angle
 *   (or reply to their message with /roast [<something>])
 *
 * A custom angle replaces the random roast-bank line entirely. The angle is
 * stashed in the photo caption (after a 💬 marker) so the 🔄 Regenerate button
 * can recover it and keep roasting the SAME person about the SAME thing — even
 * across bot restarts. Deletes the /roast command if the bot can. Never crashes.
 */
import { type Context, InputFile, InlineKeyboard } from "grammy";
import { buildCalloutMeme } from "../meme/pipeline.js";
import {
  getMember,
  getMembers,
  mentionHtml,
  recordMember,
} from "../members/store.js";

interface RoastTarget {
  name: string;
  mention: string; // HTML-safe mention
}

const PROMPT_MARKER = "💬 ";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function kb(token: string): InlineKeyboard {
  return new InlineKeyboard().text("🔄 Regenerate", `roast:regen:${token}`);
}

/** Caption = mention + 💀, plus the custom angle (so regen can recover it). */
function roastCaption(mention: string, prompt: string): string {
  return prompt
    ? `${mention} 💀\n${PROMPT_MARKER}${escapeHtml(prompt)}`
    : `${mention} 💀`;
}

/** Pull the custom angle back out of a roast caption (plain text). */
function promptFromCaption(caption: string | undefined): string {
  if (!caption) return "";
  const i = caption.indexOf(PROMPT_MARKER);
  return i >= 0 ? caption.slice(i + PROMPT_MARKER.length).trim() : "";
}

/** Build a roast meme — `prompt` (if given) overrides the random roast bank. */
async function buildRoast(t: RoastTarget, prompt?: string): Promise<Buffer> {
  const built = await buildCalloutMeme({
    name: t.name,
    kind: "roast",
    angle: prompt,
  });
  return built.buffer;
}

/** Resolve target + regen token + the custom angle (text after the mention). */
function resolveTarget(
  ctx: Context,
): { t: RoastTarget; token: string; prompt: string } | null {
  const msg = ctx.message;
  if (!msg) return null;
  const match = (typeof ctx.match === "string" ? ctx.match : "").trim();

  // 1. Reply to someone → the whole arg is the roast angle.
  const replied = msg.reply_to_message?.from;
  if (replied && !replied.is_bot) {
    recordMember(replied);
    const mention = replied.username
      ? `@${replied.username}`
      : `<a href="tg://user?id=${replied.id}">${escapeHtml(replied.first_name)}</a>`;
    return {
      t: { name: replied.first_name, mention },
      token: `i:${replied.id}`,
      prompt: match,
    };
  }

  // 2. A @mention / text-mention → the angle is the text AFTER it.
  const text = msg.text ?? "";
  for (const e of msg.entities ?? []) {
    if (e.type === "text_mention" && !e.user.is_bot) {
      const u = e.user;
      recordMember(u);
      const mention = u.username
        ? `@${u.username}`
        : `<a href="tg://user?id=${u.id}">${escapeHtml(u.first_name)}</a>`;
      return {
        t: { name: u.first_name, mention },
        token: `i:${u.id}`,
        prompt: text.slice(e.offset + e.length).trim(),
      };
    }
    if (e.type === "mention") {
      const username = text.slice(e.offset + 1, e.offset + e.length); // strip @
      const m = getMembers().find((x) => x.username === username);
      return {
        t: { name: m?.firstName ?? username, mention: `@${username}` },
        token: `u:${username}`,
        prompt: text.slice(e.offset + e.length).trim(),
      };
    }
  }
  return null;
}

/** Rebuild a target from a regenerate token. */
function targetFromToken(token: string): RoastTarget | null {
  if (token.startsWith("i:")) {
    const id = Number(token.slice(2));
    const m = getMember(id);
    if (m) return { name: m.firstName, mention: mentionHtml(m) };
    return { name: "that guy", mention: "that guy" };
  }
  if (token.startsWith("u:")) {
    const username = token.slice(2);
    const m = getMembers().find((x) => x.username === username);
    return { name: m?.firstName ?? username, mention: `@${username}` };
  }
  return null;
}

export async function roastCommand(ctx: Context): Promise<void> {
  const resolved = resolveTarget(ctx);
  if (!resolved) {
    await ctx.reply(
      "Who am I roasting? Reply with /roast, or /roast @username — add what to roast them about, e.g. /roast @kev his airballs 🎯",
    );
    return;
  }

  // Tidy up the command message (needs delete permission; ignored otherwise).
  ctx.deleteMessage().catch(() => {});
  await ctx.replyWithChatAction("upload_photo").catch(() => {});

  let buffer: Buffer;
  try {
    buffer = await buildRoast(resolved.t, resolved.prompt);
  } catch (err) {
    console.error("[roast] failed:", err);
    await ctx.reply("Couldn't cook that roast right now (AI hiccup). Try again.");
    return;
  }

  await ctx
    .replyWithPhoto(new InputFile(buffer, "roast.png"), {
      caption: roastCaption(resolved.t.mention, resolved.prompt),
      parse_mode: "HTML",
      reply_markup: kb(resolved.token),
    })
    .catch((err) => console.error("[roast] send failed:", err));
}

/** 🔄 Regenerate: re-roast the SAME person about the SAME angle, in place. */
export async function roastRegenCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({ text: "Cooking a fresh one… 🔥" }).catch(() => {});
  const data = ctx.callbackQuery?.data ?? "";
  const token = data.replace(/^roast:regen:/, "");
  const t = targetFromToken(token);
  if (!t) return;

  // Recover the original custom angle from the message caption (survives restarts).
  const msg = ctx.callbackQuery?.message;
  const caption = msg && "caption" in msg ? msg.caption : undefined;
  const prompt = promptFromCaption(caption);

  let buffer: Buffer;
  try {
    buffer = await buildRoast(t, prompt);
  } catch (err) {
    console.error("[roast] regen failed:", err);
    return;
  }

  await ctx
    .editMessageMedia(
      {
        type: "photo",
        media: new InputFile(buffer, "roast.png"),
        caption: roastCaption(t.mention, prompt),
        parse_mode: "HTML",
      },
      { reply_markup: kb(token) },
    )
    .catch((err) => console.error("[roast] regen edit failed:", err));
}
