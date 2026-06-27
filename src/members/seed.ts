/**
 * Seed the member roster from a group's admins on startup, so real names are
 * available immediately (not just after live messages). Best-effort: logs and
 * moves on if the call fails (e.g. bot lacks access).
 */
import type { Api } from "grammy";
import { recordMember } from "./store.js";

export async function seedRosterFromAdmins(
  api: Api,
  chatId: number,
): Promise<void> {
  try {
    const admins = await api.getChatAdministrators(chatId);
    let added = 0;
    for (const a of admins) {
      const u = a.user;
      if (u.is_bot) continue; // skip the bot itself and other bots
      if (recordMember(u)) added++;
    }
    console.log(`[members] seeded ${added} admin(s) into the roster from chatId=${chatId}.`);
  } catch (err) {
    console.warn("[members] admin seed skipped (couldn't fetch admins):", err);
  }
}
