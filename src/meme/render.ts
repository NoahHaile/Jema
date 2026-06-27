/**
 * Classic meme rendering with @napi-rs/canvas (prebuilt binaries, no node-gyp).
 *
 * Draws UPPERCASE top/bottom captions in an Impact-like font (Anton), white
 * fill with a thick black outline, centered and word-wrapped to the image
 * width, with font size scaled down when the text is long.
 */
import {
  createCanvas,
  loadImage,
  GlobalFonts,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// assets/ sits at the project root (bot/assets). From src/meme or dist/meme we
// go up two levels.
const FONT_PATH = join(__dirname, "..", "..", "assets", "Anton-Regular.ttf");
const FONT_FAMILY = "Anton";

let fontReady = false;
function ensureFont(): void {
  if (fontReady) return;
  if (existsSync(FONT_PATH)) {
    GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
  } else {
    console.warn(
      `[render] Font not found at ${FONT_PATH}; falling back to a system font.`,
    );
  }
  fontReady = true;
}

function fontFamily(): string {
  return GlobalFonts.has(FONT_FAMILY) ? FONT_FAMILY : "sans-serif";
}

/** Greedy word-wrap: returns lines that each fit within maxWidth. */
function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Draw one caption block (top or bottom). Picks the largest font size (within
 * a sensible range) at which the wrapped text fits the available box.
 */
function drawCaption(
  ctx: SKRSContext2D,
  rawText: string,
  imgWidth: number,
  imgHeight: number,
  position: "top" | "bottom",
): void {
  const text = rawText.trim().toUpperCase();
  if (!text) return;

  const family = fontFamily();
  const maxTextWidth = imgWidth * 0.92;
  const maxBlockHeight = imgHeight * 0.42;

  // Scale font from a size relative to image height, shrinking until the
  // wrapped block fits both width and height.
  let fontSize = Math.floor(imgHeight / 8);
  const minFontSize = 14;
  let lines: string[] = [];
  let lineHeight = 0;

  while (fontSize >= minFontSize) {
    ctx.font = `${fontSize}px "${family}"`;
    lines = wrapText(ctx, text, maxTextWidth);
    lineHeight = fontSize * 1.1;
    const widestFits = lines.every(
      (l) => ctx.measureText(l).width <= maxTextWidth,
    );
    const blockHeight = lines.length * lineHeight;
    if (widestFits && blockHeight <= maxBlockHeight) break;
    fontSize -= 2;
  }

  ctx.font = `${fontSize}px "${family}"`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(2, fontSize / 12);
  ctx.lineJoin = "round";

  const padding = imgHeight * 0.03;
  const x = imgWidth / 2;
  const blockHeight = lines.length * lineHeight;

  for (let i = 0; i < lines.length; i++) {
    let y: number;
    if (position === "top") {
      ctx.textBaseline = "top";
      y = padding + i * lineHeight;
    } else {
      ctx.textBaseline = "bottom";
      y = imgHeight - padding - (blockHeight - (i + 1) * lineHeight);
    }
    ctx.strokeText(lines[i], x, y);
    ctx.fillText(lines[i], x, y);
  }
}

/**
 * Render a meme: download the template image and draw top/bottom captions.
 * Returns a PNG buffer.
 */
export async function renderMeme(
  imageUrl: string,
  top: string,
  bottom: string,
): Promise<Buffer> {
  ensureFont();

  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Template image fetch failed: HTTP ${res.status}`);
  }
  const imageBuffer = Buffer.from(await res.arrayBuffer());
  const image = await loadImage(imageBuffer);

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, image.width, image.height);

  drawCaption(ctx, top, image.width, image.height, "top");
  drawCaption(ctx, bottom, image.width, image.height, "bottom");

  return canvas.toBuffer("image/png");
}
