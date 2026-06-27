/**
 * schedule:check — print each scheduled job's cron expression and its next 3
 * fire times in the configured timezone. Requires NO secrets, so the schedule
 * can be validated without a bot token.
 */
import { Cron } from "croner";
import { TIMEZONE } from "./config.js";
import { JOBS } from "./scheduler.js";

function main(): void {
  console.log(`Timezone: ${TIMEZONE}\n`);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  for (const job of JOBS) {
    // Pattern-only Cron (no handler) just for introspection.
    const cron = new Cron(job.cron, { timezone: TIMEZONE });
    const next = cron.nextRuns(3);
    console.log(`Job: ${job.name}`);
    console.log(`  Cron: ${job.cron}`);
    for (const d of next) {
      console.log(`  -> ${fmt.format(d)} (${TIMEZONE})  [${d.toISOString()}]`);
    }
    console.log("");
  }
}

main();
