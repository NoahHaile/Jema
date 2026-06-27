/**
 * test:receipt — end-to-end proof of the vision pipeline.
 *
 * (a) Renders a simple synthetic M-Pesa-style receipt PNG with canvas.
 * (b) Runs readReceipt() on those bytes and prints the parsed JSON.
 *
 * Requires a working OPENAI_API_KEY (the live vision call). Does NOT require
 * BOT_TOKEN.
 */
import { createCanvas } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readReceipt } from "./receipts/vision.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "test-receipt.png");

const RECEIPT_TEXT = [
  "M-PESA",
  "Confirmed.",
  "KSh 500.00 sent to",
  "JOHN DOE 0712345678",
  "on 27/6/26 at 4:15 PM.",
  "Ref: ABC123XYZ",
  "New M-PESA balance is KSh 1,200.00",
];

function renderReceipt(): Buffer {
  const width = 600;
  const height = 360;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0a7d33"; // M-Pesa green header
  ctx.fillRect(0, 0, width, 56);

  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  let y = 16;
  for (let i = 0; i < RECEIPT_TEXT.length; i++) {
    if (i === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(RECEIPT_TEXT[i], 20, 14);
      ctx.fillStyle = "#000000";
      y = 80;
    } else {
      ctx.font = i === 1 ? "bold 24px sans-serif" : "22px sans-serif";
      ctx.fillText(RECEIPT_TEXT[i], 24, y);
      y += 38;
    }
  }
  return canvas.toBuffer("image/png");
}

async function main(): Promise<void> {
  console.log("Rendering synthetic M-Pesa receipt...");
  const png = renderReceipt();
  await writeFile(OUT_PATH, png);
  console.log(`Wrote ${OUT_PATH} (${(png.length / 1024).toFixed(1)} KB).`);

  console.log("Calling readReceipt (OpenAI vision)...");
  const result = await readReceipt(png);
  console.log("\nParsed result:");
  console.log(JSON.stringify(result, null, 2));

  if (!result.isReceipt) {
    throw new Error("Expected isReceipt:true for the synthetic receipt");
  }
  if (result.amount !== 500) {
    console.warn(`Note: expected amount 500, got ${result.amount}`);
  }
  console.log("\nVision pipeline OK ✅");
}

main().catch((err) => {
  console.error("test:receipt failed:", err);
  process.exit(1);
});
