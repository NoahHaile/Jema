/**
 * sample:callout — proof of the reminder call-out engine via the REAL OpenAI
 * key. Generates 3 harsh, excuse-driven call-out memes (mixed vote/pay) ->
 * samples/callout-1..3.png, and prints template + target + excuse + captions so
 * the variety is reviewable.
 *
 * Requires OPENAI_API_KEY. Does NOT require BOT_TOKEN.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildCalloutMeme } from "./meme/pipeline.js";
import type { CalloutKind } from "./openai.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "samples");

// A mix of phases + targets so the reviewer sees variety.
const RUNS: { name: string; kind: CalloutKind }[] = [
  { name: "Kev", kind: "vote" },
  { name: "Mike", kind: "pay" },
  { name: "LeBron", kind: "pay" },
];

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Generating ${RUNS.length} harsh call-out memes...\n`);

  const formatsSeen = new Set<string>();

  for (let i = 0; i < RUNS.length; i++) {
    const { name, kind } = RUNS[i];
    const built = await buildCalloutMeme({ name, kind });
    formatsSeen.add(built.formatName);

    const file = join(OUT_DIR, `callout-${i + 1}.png`);
    await writeFile(file, built.buffer);

    console.log(`--- Call-out ${i + 1} (${kind}) ---`);
    console.log(`Template: ${built.formatName}`);
    console.log(`Target:   ${built.targetName}`);
    console.log(`Excuse:   ${built.excuse}`);
    console.log(`TOP:      ${built.top}`);
    console.log(`BOTTOM:   ${built.bottom}`);
    console.log(`Saved:    ${file} (${(built.buffer.length / 1024).toFixed(1)} KB)\n`);

    if (built.buffer.length < 5000) throw new Error("Output looks too small");
  }

  console.log(`Distinct templates used: ${formatsSeen.size} (${[...formatsSeen].join(", ")})`);
  console.log("Call-out engine OK ✅");
}

main().catch((err) => {
  console.error("sample:callout failed:", err);
  process.exit(1);
});
