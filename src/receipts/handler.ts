/**
 * Group photo handler: auto-detect payment receipts.
 *
 * On every group photo (or image document), download the bytes, vision-check
 * with readReceipt, and — only if it's actually a receipt — confirm + track the
 * poster as paid. Non-receipts and errors stay completely silent so the bot
 * never spams the group.
 */
import type { Context } from "grammy";
import { DEFAULT_CURRENCY } from "../config.js";
import { readReceipt } from "./vision.js";
import { recordPayment } from "./store.js";
import { recordMember } from "../members/store.js";
import { getGame, addCommitted } from "../game/store.js";
import { perPerson } from "../cost/split.js";

/** Build a display name from the message sender. */
function posterName(ctx: Context): string {
  const from = ctx.from;
  if (!from) return "someone";
  return from.first_name + (from.username ? ` @${from.username}` : "");
}

/**
 * Download an image (by file_id) as raw bytes via getFile.
 * Note: the file URL contains the bot token, so we fetch here and only ever
 * pass the resulting BYTES to OpenAI — never the URL.
 */
async function downloadFile(ctx: Context, fileId: string): Promise<Buffer> {
  const file = await ctx.api.getFile(fileId);
  const token = ctx.api.token;
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`file download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Resolve the best image file_id from a photo message or an image document.
 * Returns null if the message has no usable image.
 */
function pickImageFileId(ctx: Context): string | null {
  const photos = ctx.message?.photo;
  if (photos && photos.length > 0) {
    // Largest size is last.
    return photos[photos.length - 1].file_id;
  }
  const doc = ctx.message?.document;
  if (doc && doc.mime_type && doc.mime_type.startsWith("image/")) {
    return doc.file_id;
  }
  return null;
}

/**
 * Handle a group image. Silent on non-receipts and on any error.
 */
export async function handleReceiptPhoto(ctx: Context): Promise<void> {
  const chatType = ctx.chat?.type;
  if (chatType !== "group" && chatType !== "supergroup") return;

  const fileId = pickImageFileId(ctx);
  if (!fileId) return;

  try {
    const bytes = await downloadFile(ctx, fileId);
    const receipt = await readReceipt(bytes);

    if (!receipt.isReceipt) return; // not a receipt -> stay silent.

    const name = posterName(ctx);
    const currency = receipt.currency || DEFAULT_CURRENCY;

    recordMember(ctx.from); // roster from receipt posters

    recordPayment({
      userId: ctx.from?.id ?? 0,
      name,
      amount: receipt.amount,
      currency: receipt.currency,
      reference: receipt.reference,
      receiptDate: receipt.date,
    });

    if (receipt.amount != null) {
      await ctx.reply(
        `✅ Got ${receipt.amount} ${currency} from ${name} — you're paid up! 🏀`,
      );
    } else {
      await ctx.reply(`✅ Receipt received from ${name} — logged!`);
    }

    // If a committed game exists and this payer wasn't in it, they're a new
    // addition — grow the headcount and announce the recomputed split.
    const userId = ctx.from?.id ?? 0;
    const game = getGame();
    if (game && userId && !game.committed.some((c) => c.userId === userId)) {
      const updated = addCommitted({ userId, name });
      if (updated) {
        const headcount = updated.committed.length;
        const each = perPerson(updated.total, headcount);
        if (each !== null) {
          await ctx.reply(
            `Headcount's now ${headcount} → new split is ${each} ${DEFAULT_CURRENCY} each (refunds may be due 💸)`,
          );
        }
      }
    }
  } catch (err) {
    // Never spam the group on vision/download errors — just log.
    console.error("[receipts] photo handling failed:", err);
  }
}
