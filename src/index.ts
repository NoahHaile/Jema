/**
 * Bot bootstrap.
 *
 * Core: the bot runs AUTONOMOUSLY on a schedule (poll + reminder roasts) with no
 * admin commands. It auto-registers the group it's added to and posts on a timer.
 * Users can't make their own polls/memes — the only manual command is /roast
 * (roast a specific player), plus /split, /paidlist, /here, /help.
 */
import { Bot, InputFile } from "grammy";
import { requireEnv, GROUP_CHAT_ID, TIMEZONE } from "./config.js";
import { roastCommand, roastRegenCallback } from "./commands/roast.js";
import { paidlistCommand } from "./commands/paidlist.js";
import { splitCommand } from "./commands/split.js";
import { registerChat, getRegisteredChatId } from "./chatStore.js";
import { startScheduler } from "./scheduler.js";
import { recordAnswer } from "./pollStore.js";
import { handleReceiptPhoto } from "./receipts/handler.js";
import { recordMember } from "./members/store.js";
import { seedRosterFromAdmins } from "./members/seed.js";
import { INTRO, INTRO_VIDEO } from "./intro.js";

const HELP =
  "Basket Jema bot 🏀\n\n" +
  "I run the weekly game on autopilot — the run poll and reminders post here on their own (timezone: " +
  TIMEZONE +
  "). No setup needed.\n\n" +
  "😤 Accountability: I call out people who haven't voted, and roast (by @-mention) " +
  "anyone who's coming but hasn't paid their share. Vote and pay to dodge the smoke.\n\n" +
  "💸 Court cost: every 1-hour booking is split evenly. 📸 Send a SCREENSHOT (image) of your " +
  "telebirr / CBE Birr / bank receipt right here and I'll read it, confirm it, and log you as paid.\n\n" +
  "Commands:\n" +
  "/roast @username <angle> — roast a player; add your own angle (e.g. /roast @kev his airballs) or leave it blank for a random one 💀\n" +
  "/split — the per-person cost this week.\n" +
  "/paidlist — who's paid + collection progress.\n" +
  "/here — register this group for posts.\n" +
  "/help — show this message.";

async function main(): Promise<void> {
  const bot = new Bot(requireEnv("BOT_TOKEN"));

  // --- Auto-registration: bot added to a group (my_chat_member update). ---
  // On a FRESH add, also post the intro so the group learns what I do.
  bot.on("my_chat_member", async (ctx) => {
    const chat = ctx.chat;
    if (chat.type !== "group" && chat.type !== "supergroup") return;
    const newStatus = ctx.myChatMember.new_chat_member.status;
    const oldStatus = ctx.myChatMember.old_chat_member.status;
    const nowIn = newStatus !== "left" && newStatus !== "kicked";
    if (!nowIn) return;
    registerChat(chat.id, "title" in chat ? chat.title : undefined);
    const wasIn = oldStatus !== "left" && oldStatus !== "kicked";
    if (!wasIn) {
      // Just added → introduce myself to the whole group (twerk gif + caption).
      try {
        await ctx.api.sendAnimation(chat.id, new InputFile(INTRO_VIDEO), {
          caption: INTRO,
        });
      } catch (e) {
        console.warn("[bot] intro send failed:", e);
      }
    }
  });

  // --- Auto-registration + roster: any group message. ---
  bot.on("message", (ctx, next) => {
    const chat = ctx.chat;
    if (chat.type === "group" || chat.type === "supergroup") {
      registerChat(chat.id, "title" in chat ? chat.title : undefined);
      recordMember(ctx.from); // roster from live messages (bots excluded inside)
    }
    return next();
  });

  // --- Capture poll votes (poll_answer update). ---
  // stopPoll only returns aggregate counts, so this is the ONLY way to learn
  // who voted for what. Requires poll_answer in allowed_updates (see bot.start).
  bot.on("poll_answer", (ctx) => {
    const pa = ctx.pollAnswer;
    const user = pa.user;
    if (!user) return; // anonymous-poll answers carry no user; ignore.
    recordMember(user); // roster from voters
    const name =
      user.first_name + (user.username ? ` @${user.username}` : "");
    // Empty option_ids == retraction -> recordAnswer removes the voter.
    recordAnswer(pa.poll_id, user.id, name, pa.option_ids);
  });

  // --- Auto-detect payment receipts in group photos / image documents. ---
  // Vision-checks every image; replies only if it's actually a receipt,
  // otherwise stays completely silent. Each photo is processed once.
  bot.on("message:photo", (ctx) => handleReceiptPhoto(ctx));
  bot.on("message:document", (ctx) => handleReceiptPhoto(ctx));

  // --- Commands (bonus manual triggers). ---
  bot.command("start", (ctx) =>
    ctx.replyWithAnimation(new InputFile(INTRO_VIDEO), { caption: INTRO }),
  );
  bot.command("help", (ctx) => ctx.reply(HELP));
  bot.command("roast", roastCommand);
  bot.callbackQuery(/^roast:regen:/, roastRegenCallback);
  bot.command("paidlist", paidlistCommand);
  bot.command("split", splitCommand);
  bot.command("here", (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
      registerChat(ctx.chat.id, "title" in ctx.chat ? ctx.chat.title : undefined);
      return ctx.reply("This group is registered for scheduled posts ✅");
    }
    return ctx.reply(
      "Add me to your basketball group and I'll post there on a schedule 🏀",
    );
  });

  // Keep the bot alive on unexpected handler errors.
  bot.catch((err) => {
    console.error("[bot] unhandled error:", err.error);
  });

  await bot.api
    .setMyCommands([
      { command: "roast", description: "Roast a player (/roast @user)" },
      { command: "paidlist", description: "See who's paid this week + collection" },
      { command: "split", description: "Court cost split per person" },
      { command: "here", description: "Register this group for scheduled posts" },
      { command: "help", description: "Show help" },
    ])
    .catch((e) => console.warn("[bot] setMyCommands failed:", e));

  // --- Startup: report target status (never crash if none yet). ---
  const target = getRegisteredChatId();
  if (target === null) {
    console.log(
      "[bot] No group registered yet and no GROUP_CHAT_ID set. " +
        "Add me to your group and I'll register it; scheduled jobs will no-op until then.",
    );
  } else {
    const source =
      GROUP_CHAT_ID !== undefined ? "GROUP_CHAT_ID env" : "saved registration";
    console.log(`[bot] Scheduled posts target chatId=${target} (from ${source}).`);
    // Seed the roster from group admins so real names exist immediately.
    await seedRosterFromAdmins(bot.api, target);
  }

  // --- Start the autonomous scheduler. ---
  startScheduler(bot);

  console.log("Basket Jema bot is running. Press Ctrl+C to stop.");
  // allowed_updates MUST include poll_answer or vote updates never arrive (and
  // we'd lose the "who's in" list). By default Telegram omits poll_answer.
  await bot.start({
    allowed_updates: ["message", "my_chat_member", "poll_answer", "callback_query"],
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
