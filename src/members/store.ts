/**
 * Member roster. We accumulate everyone the bot has seen in the group so the
 * accountability layer can @-mention non-voters / non-payers by name.
 *
 * Populated from (a) every group message (ctx.from), (b) poll_answer voters,
 * (c) receipt posters. The bot itself is excluded by the caller.
 *
 * Persists to data/members.json keyed by userId.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const STORE_PATH = join(DATA_DIR, "members.json");

export interface Member {
  userId: number;
  firstName: string;
  username: string | null;
  lastSeenAt: string;
}

/** Minimal shape of a Telegram user (grammY ctx.from / poll answer user). */
export interface TelegramUserLike {
  id: number;
  first_name?: string;
  username?: string;
  is_bot?: boolean;
}

let cache: Record<string, Member> | undefined;

function readStore(): Record<string, Member> {
  if (cache !== undefined) return cache;
  let loaded: Record<string, Member> = {};
  try {
    if (existsSync(STORE_PATH)) {
      const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8"));
      if (parsed && typeof parsed === "object") loaded = parsed;
    }
  } catch (err) {
    console.warn("[members] failed to read:", err);
  }
  cache = loaded;
  return cache;
}

function writeStore(members: Record<string, Member>): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(members, null, 2), "utf8");
    cache = members;
  } catch (err) {
    console.warn("[members] failed to persist:", err);
  }
}

/**
 * Upsert a member from a Telegram user. Ignores bots and userless updates.
 * Returns the stored member, or null if skipped.
 */
export function recordMember(from: TelegramUserLike | undefined): Member | null {
  if (!from || from.is_bot || !from.id) return null;

  const members = readStore();
  const key = String(from.id);
  const member: Member = {
    userId: from.id,
    firstName: from.first_name || members[key]?.firstName || "someone",
    username: from.username ?? members[key]?.username ?? null,
    lastSeenAt: new Date().toISOString(),
  };
  members[key] = member;
  writeStore(members);
  return member;
}

export function getMembers(): Member[] {
  return Object.values(readStore());
}

export function getMember(userId: number): Member | undefined {
  return readStore()[String(userId)];
}

/** Display name (first name). */
export function displayName(m: { firstName: string }): string {
  return m.firstName;
}

/**
 * HTML mention that notifies the user. Prefers @username (a real notification),
 * else a tg://user link with the display name. Caller must send with
 * parse_mode: "HTML".
 */
export function mentionHtml(m: Member): string {
  if (m.username) return `@${m.username}`;
  const safeName = escapeHtml(m.firstName);
  return `<a href="tg://user?id=${m.userId}">${safeName}</a>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
