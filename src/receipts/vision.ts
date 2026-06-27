/**
 * Receipt vision reader. Given image bytes, asks OpenAI (multimodal) whether the
 * image is a payment/transaction confirmation and extracts the key fields.
 *
 * SECURITY: we pass the image as a base64 data URL, NOT a Telegram file URL —
 * Telegram file URLs embed the bot token, which must never leak to OpenAI.
 */
import OpenAI from "openai";
import { OPENAI_MODEL, requireEnv } from "../config.js";

export interface ReceiptResult {
  isReceipt: boolean;
  amount: number | null;
  currency: string | null;
  sender: string | null;
  recipient: string | null;
  reference: string | null;
  date: string | null;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a strict payment-receipt parser for mobile-money and bank transfer screenshots. This crew is in Ethiopia, so expect Ethiopian payment apps — telebirr, CBE Birr, Amole, Dashen/Awash/Abyssinia bank transfers, and CBE — as well as generic mobile-money (M-Pesa, Airtel Money) and bank receipts.
Look at the image and decide whether it is an ACTUAL payment / transaction confirmation (money sent or received).

Set "isReceipt": true ONLY for a genuine payment/transaction confirmation (e.g. a telebirr "transaction successful" screen, a CBE Birr SMS/confirmation, a bank transfer success screen, an M-Pesa "Confirmed." message). For anything else — memes, random photos, screenshots that aren't a transaction confirmation, blank/illegible images — set "isReceipt": false and null the other fields.

When it IS a receipt, extract:
- amount: the numeric transaction amount (number only, no currency symbol or commas), or null.
- currency: currency code/symbol if visible (e.g. "birr", "ETB", "KSh", "USD"), else null.
- sender: who sent the money (payer), or null.
- recipient: who received the money (payee), or null.
- reference: the transaction/reference/confirmation code, or null.
- date: the transaction date as shown (string), or null.

Respond ONLY as JSON:
{"isReceipt": boolean, "amount": number|null, "currency": string|null, "sender": string|null, "recipient": string|null, "reference": string|null, "date": string|null}`;

/**
 * Read a receipt from raw image bytes. Throws on API/parse failure; callers
 * should catch and stay silent rather than spam the group.
 */
export async function readReceipt(imageBuffer: Buffer): Promise<ReceiptResult> {
  const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

  const completion = await getClient().chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Is this a payment receipt? Extract the fields." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response");

  const p = JSON.parse(raw) as Partial<ReceiptResult>;
  return {
    isReceipt: p.isReceipt === true,
    amount: typeof p.amount === "number" ? p.amount : null,
    currency: typeof p.currency === "string" && p.currency ? p.currency : null,
    sender: typeof p.sender === "string" && p.sender ? p.sender : null,
    recipient: typeof p.recipient === "string" && p.recipient ? p.recipient : null,
    reference: typeof p.reference === "string" && p.reference ? p.reference : null,
    date: typeof p.date === "string" && p.date ? p.date : null,
  };
}
