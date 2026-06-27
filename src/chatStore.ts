/**
 * Target-group persistence.
 *
 * The bot must know which chat to post to without anyone running a command.
 * We persist the most-recently-registered group chat id to data/chat.json and
 * read it back for scheduled posts. An explicit GROUP_CHAT_ID env always wins.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GROUP_CHAT_ID } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// data/ sits at the project root (bot/data). From src or dist we go up one.
const DATA_DIR = join(__dirname, "..", "data");
const STORE_PATH = join(DATA_DIR, "chat.json");

interface StoreShape {
  chatId: number;
  title?: string;
  registeredAt: string;
}

let cached: number | null | undefined;

function readStore(): StoreShape | null {
  try {
    if (!existsSync(STORE_PATH)) return null;
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    return typeof parsed.chatId === "number" ? parsed : null;
  } catch (err) {
    console.warn("[chatStore] failed to read store:", err);
    return null;
  }
}

/**
 * Returns the chat id to post to, or null if none is known yet.
 * Env override takes precedence over the persisted value.
 */
export function getRegisteredChatId(): number | null {
  if (GROUP_CHAT_ID !== undefined && !Number.isNaN(GROUP_CHAT_ID)) {
    return GROUP_CHAT_ID;
  }
  if (cached !== undefined) return cached;
  const store = readStore();
  cached = store ? store.chatId : null;
  return cached;
}

/**
 * Persist a newly seen group chat as the active target. Idempotent: if the
 * same chat is already registered, this is a no-op (no log spam).
 */
export function registerChat(chatId: number, title?: string): void {
  const current = readStore();
  if (current && current.chatId === chatId) {
    cached = chatId;
    return;
  }
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const data: StoreShape = {
      chatId,
      title,
      registeredAt: new Date().toISOString(),
    };
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
    cached = chatId;
    console.log(
      `[chatStore] Registered group for scheduled posts: chatId=${chatId}` +
        (title ? ` ("${title}")` : "") +
        ". This is now the most-recently-registered target.",
    );
  } catch (err) {
    console.warn("[chatStore] failed to persist chat:", err);
  }
}
