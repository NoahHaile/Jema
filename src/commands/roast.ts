/**
 * /roast — roast a specific player on demand.
 *   /roast @username   — or — reply to their message with /roast
 *
 * Builds a general roast meme naming + @-mentioning the target, with a
 * 🔄 Regenerate button that re-roasts the SAME person. Deletes the /roast
 * command message if the bot has permission. Never crashes on failure.
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function kb(token: string): InlineKeyboard {
  return new InlineKeyboard().text("🔄 Regenerate", `roast:regen:${token}`);
}

async function buildRoast(t: RoastTarget): Promise<Buffer> {
  const built = await buildCalloutMeme({ name: t.name, kind: "roast" });
  return built.buffer;
}

/** Resolve who to roast + a compact token used to re-roast them on regenerate. */
function resolveTarget(ctx: Context): { t: RoastTarget; token: string } | null {
  const msg = ctx.message;
  if (!msg) return null;

  // 1. Reply to someone's message.
  const replied = msg.reply_to_message?.from;
  if (replied && !replied.is_bot) {
    recordMember(replied);
    const mention = replied.username
      ? `@${replied.username}`
      : `<a href="tg://user?id=${replied.id}">${escapeHtml(replied.first_name)}</a>`;
    return { t: { name: replied.first_name, mention }, token: `i:${replied.id}` };
  }

  // 2. A @mention or text-mention in the command text.
  const text = msg.text ?? "";
  for (const e of msg.entities ?? []) {
    if (e.type === "text_mention" && !e.user.is_bot) {
      const u = e.user;
      recordMember(u);
      const mention = u.username
        ? `@${u.username}`
        : `<a href="tg://user?id=${u.id}">${escapeHtml(u.first_name)}</a>`;
      return { t: { name: u.first_name, mention }, token: `i:${u.id}` };
    }
    if (e.type === "mention") {
      const username = text.slice(e.offset + 1, e.offset + e.length); // strip @
      const m = getMembers().find((x) => x.username === username);
      return {
        t: { name: m?.firstName ?? username, mention: `@${username}` },
        token: `u:${username}`,
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
      "Who am I roasting? Reply to their message with /roast, or /roast @username 🎯",
    );
    return;
  }

  // Tidy up the command message (needs delete permission; ignored otherwise).
  ctx.deleteMessage().catch(() => {});
  await ctx.replyWithChatAction("upload_photo").catch(() => {});

  let buffer: Buffer;
  try {
    buffer = await buildRoast(resolved.t);
  } catch (err) {
    console.error("[roast] failed:", err);
    await ctx.reply("Couldn't cook that roast right now (AI hiccup). Try again.");
    return;
  }

  await ctx
    .replyWithPhoto(new InputFile(buffer, "roast.png"), {
      caption: `${resolved.t.mention} 💀`,
      parse_mode: "HTML",
      reply_markup: kb(resolved.token),
    })
    .catch((err) => console.error("[roast] send failed:", err));
}

/** 🔄 Regenerate: re-roast the SAME person in place with a fresh meme. */
export async function roastRegenCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({ text: "Cooking a fresh one… 🔥" }).catch(() => {});
  const data = ctx.callbackQuery?.data ?? "";
  const token = data.replace(/^roast:regen:/, "");
  const t = targetFromToken(token);
  if (!t) return;

  let buffer: Buffer;
  try {
    buffer = await buildRoast(t);
  } catch (err) {
    console.error("[roast] regen failed:", err);
    return;
  }

  await ctx
    .editMessageMedia(
      {
        type: "photo",
        media: new InputFile(buffer, "roast.png"),
        caption: `${t.mention} 💀`,
        parse_mode: "HTML",
      },
      { reply_markup: kb(token) },
    )
    .catch((err) => console.error("[roast] regen edit failed:", err));
}
