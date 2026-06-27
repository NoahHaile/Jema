# Basket Jema Bot 🏀

A small, self-contained Telegram group bot for a basketball friend group. **It runs autonomously** — once it's in your group it posts on a schedule with zero commands needed:

- **Weekly run poll** — posts Monday, nudges Thursday, closes Friday with the winner + who's in.
- **Roast memes** — a few times a week, OpenAI generates a personalized roast meme (mostly the star, **Noah**, dunking on the crew) and posts it.
- **Receipt tracking** — reads payment screenshots posted in the group (OpenAI vision), confirms them, and tracks who's paid this week.
- **Accountability enforcer** — calls out non-voters and (by @-mention) anyone who said they're coming but hasn't paid, as roast memes.

Manual commands (`/poll`, `/meme`, `/paidlist`, `/start`, `/help`, `/here`) remain as bonus triggers.

## Autonomous schedule

All jobs run in the configured timezone (`TIMEZONE`, default **`Africa/Nairobi`** / EAT) using [croner](https://github.com/hexagon/croner).

| Job | Default cron | When | What it does |
| --- | --- | --- | --- |
| Poll post | `POLL_CRON` = `0 9 * * 1` | Mon 09:00 | Posts the weekly run poll (multi-answer, non-anonymous), starts a fresh cycle |
| Poll reminder | `POLL_REMINDER_CRON` = `0 18 * * 4` | Thu 18:00 | "Last call" nudge showing the current leader |
| Poll close | `POLL_CLOSE_CRON` = `0 9 * * 5` | Fri 09:00 | Closes the poll, announces winner + who's in, clears the cycle |
| Meme | `MEME_CRON` = `0 12 * * 1,3,5` | Mon/Wed/Fri 12:00 | OpenAI invents + renders a basketball meme |

Every cron, the poll question/options, and the meme themes are env-overridable (see `.env.example`).

The scheduled meme job picks a random **theme hint** each run (e.g. "missing free throws", "the guy who never passes") and asks OpenAI to invent a fresh, original meme around it — no user prompt involved.

### The weekly poll loop (post → vote → close → announce)

The poll is a full autonomous loop:

1. **Mon 09:00** — posts the run poll and saves its identity to `data/poll.json` (one active poll at a time).
2. **During the week** — every vote arrives as a `poll_answer` update and is accumulated into the stored answers (a retracted vote removes the voter). This is the only way to learn *who* voted for what.
3. **Thu 18:00** — "last call" reminder posts the current leader computed from the stored votes (skipped with a log if no poll is active).
4. **Fri 09:00** — calls `stopPoll` for final counts, picks the winner (ties list all tied options), and posts e.g. `🏀 Sat morning wins with 4 votes!` then `In: Daniel, Sam @sammy, Priya`. If nobody voted, it posts "no votes this week 🤷". Then it clears the cycle.

**Why the bot accumulates votes itself:** Telegram's `stopPoll` returns aggregate vote *counts* only — never voter identities. To list who's in, the bot captures `poll_answer` updates throughout the voting window. This relies on the bot being online during the week (fine — it's a long-running service) and on `poll_answer` being in `allowed_updates` (it is; set in `bot.start` in `src/index.ts`).

### How the group is chosen (auto-registration)

You don't run any command to "connect" the bot. As soon as it's **added to a group** (or sees any group message), it persists that group's chat id to `data/chat.json` and uses it for all scheduled posts. The registration is logged clearly. If it's in multiple groups, the **most recently registered** one wins (also logged). Set `GROUP_CHAT_ID` in `.env` to hard-pin a group and skip auto-registration.

If no group is registered yet and `GROUP_CHAT_ID` is unset, the bot logs a friendly notice and scheduled jobs simply no-op (with a log) until a group exists. It never crashes.

## Receipt tracking (auto-detect)

Drop a payment screenshot (M-Pesa, Airtel Money, bank transfer, etc.) into the group and the bot handles the rest:

1. It vision-checks **every** image posted in the group with OpenAI (the multimodal `OPENAI_MODEL`, e.g. `gpt-4o-mini`).
2. If the image **isn't** a payment receipt, the bot stays completely silent — no reply.
3. If it **is** a receipt, the bot replies e.g. `✅ Got 500 KSh from Daniel @dan — you're paid up! 🏀` (or `✅ Receipt received from Daniel — logged!` when no amount is readable) and records the **poster** as paid for the current week.
4. `/paidlist` shows this week's payers and the total.

The current week is the TIMEZONE-aware ISO week (Monday-based). Re-posting in the same week keeps your latest amount in the list. Confirmed payments persist to `data/payments.json`.

**Privacy / security notes:**
- The image is sent to OpenAI as a **base64 data URL** — never as a Telegram file URL (those embed the bot token).
- For the bot to *see* group photos, **group privacy mode must be disabled** in BotFather: `/setprivacy` → pick your bot → **Disable**. If the bot was added before you disabled privacy, **remove and re-add it** so the change takes effect.
- A bad/illegible image or a vision API error never crashes the bot and never spams the group (errors are logged silently).

## Accountability enforcer (calls people out)

The bot cross-references the active poll, the payments log, and a **member roster** to nag the right people — by name, with @-mentions (so they get notified) and a roast meme.

- **Vote nudges** — a few random pokes through the voting window (default Tue 15:00, Wed 12:00, Thu 10:00). Each picks **1 random non-voter** and posts a roast meme naming them + an @-mention caption (`<mention> the poll's right there 👀`). Stops once everyone has voted.
- **Pay nags** — keeps nagging until people pay (default Fri 18:00, Sat 11:00, Sun 11:00). Each roasts **1–2 random unpaid voters** (voted = said they're coming, but no payment this week). Stops naturally when everyone's paid or the cycle resets Monday.
- If there are no targets, the job logs and skips silently — no message.
- If a roast-meme build fails, it falls back to a **text-only @-mention** so the call-out still lands.
- Master toggle `ACCOUNTABILITY_ENABLED` (default true); crons are env-overridable (`NUDGE_CRONS`, `PAYNAG_CRONS`).

**The member roster** (`data/members.json`) is how the bot knows real names to @-mention. It's populated from (a) every group message, (b) poll voters, (c) receipt posters, and (d) the group's **admins on startup** (`getChatAdministrators`), so real names are available immediately. The roast meme engine also uses these real names: once the roster has ≥2 people, the generic Noah-vs-crew memes name **real crew members** instead of the `CREW_NAMES` placeholders.

@-mentions use `@username` when available, else a `tg://user?id=…` link with the person's name; captions are sent with `parse_mode: "HTML"`.

## Commands (bonus manual triggers)

| Command | Usage |
| --- | --- |
| `/poll` | `/poll Question? \| Option A \| Option B \| Option C` (pipe-separated, 2–10 options) |
| `/poll multi` | `/poll multi Question? \| A \| B` — allows multiple answers |
| `/meme` | `/meme` alone for an auto-roast, or `/meme <idea>` to steer it |
| `/paidlist` | Lists who's paid this week + total |
| `/here` | Confirms "this group is registered for scheduled posts ✅" |
| `/help` | Shows the help text (notes the automatic schedule + receipts) |

`/poll` uses Telegram's native `sendPoll`, so Telegram handles all voting and tallies.

## The roast meme engine

`/meme` and the scheduled meme share one **personalized roast engine**. The star is **Noah** (the `PROTAGONIST`) and the memes are brutal hoops trash talk aimed at the **crew** (`CREW_NAMES`).

How it works each generation:
1. **Pick a format** at random from a curated catalog (`src/meme/formats.ts`) — ~12 hand-picked imgflip templates that read well as top/bottom roast memes (e.g. One Does Not Simply, Drake Hotline Bling, X X Everywhere, Mocking Spongebob). Each carries a structure note + a worked example in the roast voice, used as a few-shot.
2. **Decide the matchup** — ~75% Noah dunks on a random crew member; ~25% a "clapback" (a crew member roasts Noah, or crew-vs-crew). The ratio is `MEME_CLAPBACK_RATE`.
3. **Sample ad-lib seeds** (`src/meme/adlibs.ts`) — random verb / crime / adjectives injected to force variety.
4. **Write captions** — the model (`OPENAI_CAPTION_MODEL`, JSON mode, higher temperature) returns `{top, bottom}` in that format's style. A `/meme <idea>` augments/overrides the auto-theme.
5. **Render** the captions onto the template image (Anton font, uppercase, white fill + thick black outline, auto-wrapped) with `@napi-rs/canvas`, and post it.

**Tone & guardrails:** savage about basketball skill, ego, missed shots, ball-hogging, leg day, etc. — but the system prompt hard-forbids slurs, hate speech, protected-class attacks, sexual content, and genuinely cruel personal stuff. It's disrespectful hoops trash talk between friends, nothing more.

**Set the real crew:** the default `CREW_NAMES` (`Mike,LeBron,Kev`) are placeholders — set your crew's real names in `.env`.

## Setup

### 1. Get a Telegram bot token (required)

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow the prompts. Copy the token it gives you → `BOT_TOKEN`.
3. **Disable group privacy** so the bot can read group messages **and photos** (needed for auto-registration and receipt detection): `/setprivacy` → pick your bot → **Disable**. If the bot is already in a group, remove and re-add it after disabling so the change takes effect.

### 2. Get an OpenAI API key (required)

Create one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → `OPENAI_API_KEY`.

### 3. Configure env

```bash
cp .env.example .env
# edit .env: fill in BOT_TOKEN and OPENAI_API_KEY (both required).
# everything else is optional and has sensible defaults.
```

### 4. Add the bot to your group

In Telegram, add the bot to your group chat. It auto-registers on add — that's all you need. (Making it an admin + keeping privacy disabled is recommended.)

## Run

### Local (dev)

```bash
npm install
npm run dev      # tsx watch, hot reload
```

### Local (prod build)

```bash
npm install
npm run build
npm start
```

### Deploy to a VPS (recommended — always-on)

The bot only posts while it's running, so the schedule needs it up 24/7 on an always-on box (a cheap VPS, Fly, Railway, a Raspberry Pi…).

**On your machine** — push to GitHub. Secrets are safe: `.env` and `data/` are gitignored and never committed.

```bash
cd bot
git init && git add . && git commit -m "Basket Jema bot"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

**On the VPS** (needs git + Docker):

```bash
git clone <your-github-repo-url> basket-bot && cd basket-bot
cp .env.example .env
nano .env                  # set BOT_TOKEN + OPENAI_API_KEY (use FRESH, rotated keys!)
docker compose up -d --build
docker compose logs -f     # watch it boot
```

`restart: unless-stopped` keeps it alive across reboots/crashes; `./data` is mounted so the
registered group + weekly state persist. **Update later:** `git pull && docker compose up -d --build`.

> ⚠️ Run only **ONE** instance. Two bots on the same token fight over Telegram updates (409 conflict) — stop any local/other instance before the VPS one runs.

### Docker (local)

```bash
docker compose up -d --build
```

## Verify

No secrets needed:

```bash
npm run build           # tsc, must be clean
npm run sample          # renders sample-meme.png (full render pipeline)
npm run schedule:check  # prints ALL jobs' cron + next 3 fire times (incl. nudges/pay-nags)
npm run test:winner     # feeds sample votes to the tally logic (winner/leader/tie/empty)
npm run test:targets    # feeds fake members/poll/payments to nonVoters + unpaidVoters
```

Needs a working `OPENAI_API_KEY` (no `BOT_TOKEN`):

```bash
npm run sample:memes    # generates 4 roast memes -> samples/meme-1..4.png, prints format + matchup + captions
npm run sample:callout  # builds 1 call-out roast meme (target "Kev") -> samples/callout.png, prints captions
npm run test:receipt    # renders a synthetic M-Pesa receipt, runs vision, prints parsed JSON
```

## Docker base image

We use **`node:20-slim` (Debian)**, not `node:20-alpine`. `@napi-rs/canvas` ships prebuilt native binaries; the standard prebuilds are glibc-based, so Debian-slim loads them reliably with no system libraries to install. Alpine (musl) would require the musl-specific prebuild and extra care, so we avoid it.

## Project structure

```
bot/
  src/
    index.ts            bootstrap, registration, roster/poll/photo capture, scheduler
    config.ts           env-overridable config (models, personas, crons, accountability)
    week.ts             TIMEZONE-aware ISO week key helper
    chatStore.ts        persist/read the target group (data/chat.json)
    pollStore.ts        active-poll + accumulated votes (data/poll.json)
    scheduler.ts        croner jobs (poll cycle + meme + nudges/pay-nags)
    scheduleCheck.ts    prints next runs for all jobs (no secrets)
    testWinner.ts       offline tally proof (no secrets)
    testTargets.ts      offline nonVoters/unpaidVoters proof (no secrets)
    testReceipt.ts      vision pipeline proof (needs OPENAI_API_KEY)
    sampleMemes.ts      4-meme roast-engine proof (needs OPENAI_API_KEY)
    sampleCallout.ts    1 call-out roast-meme proof (needs OPENAI_API_KEY)
    openai.ts           roast caption writer (OpenAI JSON mode)
    sample.ts           no-secrets render self-test
    commands/
      poll.ts           /poll handler
      meme.ts           /meme handler
      paidlist.ts       /paidlist handler
    members/
      store.ts          member roster + mention helpers (data/members.json)
      seed.ts           seed roster from group admins on startup
    accountability/
      targets.ts        pure nonVoters / unpaidVoters cross-reference (tested)
      callout.ts        deliver roast meme + @-mention (text fallback)
    poll/
      tally.ts          pure winner/leader computation (unit-tested)
    receipts/
      vision.ts         readReceipt — OpenAI vision receipt parser
      store.ts          weekly payments store (data/payments.json)
      handler.ts        group photo -> vision -> confirm + track
    meme/
      formats.ts        curated roast-format catalog (template + few-shot sample)
      adlibs.ts         ad-lib banks (verbs/crimes/adjectives) + sample helper
      templates.ts      imgflip catalog fetch + cache (id/name lookup)
      pipeline.ts       roast pipeline: format, matchup/callout, captions, render
      render.ts         canvas rendering
  assets/
    Anton-Regular.ttf   bundled Impact-like meme font
  data/                 auto-created; chat + poll + payments + members
  Dockerfile
  docker-compose.yml
```

## Tech

grammY · openai · croner · @napi-rs/canvas · dotenv · TypeScript (tsx for dev, tsc for build).
