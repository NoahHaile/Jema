/**
 * Self-test for the meme rendering pipeline. Requires NO secrets.
 *
 * It fetches the imgflip catalog, picks a known box_count==2 template
 * ("One Does Not Simply", with fallbacks), renders hardcoded captions, and
 * writes the result to bot/sample-meme.png. This validates catalog fetch +
 * image download + font registration + canvas text in one shot.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  getTwoBoxTemplates,
  findByName,
  randomTemplate,
} from "./meme/templates.js";
import { renderMeme } from "./meme/render.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "sample-meme.png");

async function main(): Promise<void> {
  console.log("Fetching imgflip catalog...");
  const templates = await getTwoBoxTemplates();
  console.log(`Got ${templates.length} two-caption templates.`);
  if (templates.length === 0) throw new Error("No templates returned");

  const template =
    findByName(templates, "One Does Not Simply") ??
    findByName(templates, "Waiting Skeleton") ??
    randomTemplate(templates);
  console.log(`Using template: "${template.name}" (${template.url})`);

  const top = "ONE DOES NOT SIMPLY";
  const bottom = "SHOW UP WITHOUT PAYING FOR THE COURT";

  console.log("Rendering...");
  const buffer = await renderMeme(template.url, top, bottom);

  await writeFile(OUT_PATH, buffer);
  console.log(
    `Wrote ${OUT_PATH} (${(buffer.length / 1024).toFixed(1)} KB).`,
  );

  if (buffer.length < 5000) {
    throw new Error(
      `Output looks too small (${buffer.length} bytes); something is wrong.`,
    );
  }
  console.log("Sample render OK ✅");
}

main().catch((err) => {
  console.error("Sample failed:", err);
  process.exit(1);
});
