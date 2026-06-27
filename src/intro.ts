import { fileURLToPath } from "node:url";

/** The twerk-bot intro video, posted when Basket Bot joins a group (and /start). */
export const INTRO_VIDEO = fileURLToPath(
  new URL("../robot_twerk_up.gif", import.meta.url),
);

/** Caption that rides with the intro video. */
export const INTRO =
  "Let's fucking gooo muchachos 🏀🔥🤖💥\n\n" +
  "🗳️ VOTE on my polls\n" +
  "📸 Send me SCREENSHOTS once you pay 💸😤\n" +
  "and just do what you're told\n\n" +
  "I'm a Telegram Claude bot — and on god, you'll show your face every weekend to get your ASS HANDED to you 😤🔥🏀💀";
