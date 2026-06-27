/**
 * Curated meme-format catalog for the roast engine.
 *
 * Hand-picked imgflip templates that read well with classic TOP/BOTTOM text for
 * basketball trash talk. Each entry carries:
 *  - imgflipId: the real get_memes template id (used to resolve the image url).
 *  - structure: one line on how top vs bottom text works for this template.
 *  - sample: a worked example in the "Noah roasts the crew" voice — this is the
 *    few-shot the model sees, so it learns BOTH the format and the tone.
 *  - bestFor: when this format lands best.
 *
 * All ids are verified to exist in imgflip's public catalog with box_count <= 2,
 * so the existing two-caption renderer handles them. We resolve the live image
 * url at runtime via the catalog (id match), so urls never go stale here.
 */

export interface MemeFormat {
  name: string;
  imgflipId: string;
  /** Fallback image url if catalog lookup fails. */
  url: string;
  structure: string;
  sample: { top: string; bottom: string };
  bestFor: string;
}

export const FORMATS: MemeFormat[] = [
  {
    name: "One Does Not Simply",
    imgflipId: "61579",
    url: "https://i.imgflip.com/1bij.jpg",
    structure: "TOP sets up an impossible task; BOTTOM is the punchline of why it can't happen.",
    sample: {
      top: "ONE DOES NOT SIMPLY",
      bottom: "GUARD NOAH WITHOUT GETTING POSTERIZED",
    },
    bestFor: "Declaring the crew helpless against the protagonist.",
  },
  {
    name: "Waiting Skeleton",
    imgflipId: "4087833",
    url: "https://i.imgflip.com/2fm6x.jpg",
    structure: "TOP names the thing you're hopelessly waiting for; BOTTOM is the skeleton-still-waiting twist.",
    sample: {
      top: "ME WAITING FOR MIKE",
      bottom: "TO FINALLY HIT AN OPEN LAYUP",
    },
    bestFor: "Roasting someone for never delivering (bricks, no-shows, missed shots).",
  },
  {
    name: "Disaster Girl",
    imgflipId: "97984",
    url: "https://i.imgflip.com/23ls.jpg",
    structure: "TOP describes a scene of destruction; BOTTOM reveals who smugly caused it.",
    sample: {
      top: "THE WHOLE CREW'S ANKLES ON THE FLOOR",
      bottom: "NOAH WALKING OFF LIKE IT'S NOTHING",
    },
    bestFor: "Protagonist leaving carnage behind with zero remorse.",
  },
  {
    name: "Mocking Spongebob",
    imgflipId: "102156234",
    url: "https://i.imgflip.com/1otk96.jpg",
    structure: "TOP is a normal claim; BOTTOM mockingly repeats it in spOnGeBoB cAsE to ridicule it.",
    sample: {
      top: "KEV: I'M OPEN, PASS IT",
      bottom: "i'M oPeN pAsS iT",
    },
    bestFor: "Mocking a crew member's excuse or trash talk.",
  },
  {
    name: "Ancient Aliens",
    imgflipId: "101470",
    url: "https://i.imgflip.com/26am.jpg",
    structure: "BOTTOM gives an absurd one-word-ish explanation; TOP sets up the mystery. Classic 'I'm not saying it was X, but...'",
    sample: {
      top: "I'M NOT SAYING LEBRON CAN'T SHOOT",
      bottom: "BUT 2 FOR 19",
    },
    bestFor: "Pinning a ridiculous stat or excuse on someone.",
  },
  {
    name: "X, X Everywhere",
    imgflipId: "91538330",
    url: "https://i.imgflip.com/1ihzfe.jpg",
    structure: "TOP names a thing; BOTTOM is 'X and X everywhere' — overwhelming abundance of it.",
    sample: {
      top: "AIRBALLS",
      bottom: "AIRBALLS EVERYWHERE",
    },
    bestFor: "When a crew member's whole game is one repeated crime.",
  },
  {
    name: "Drake Hotline Bling",
    imgflipId: "181913649",
    url: "https://i.imgflip.com/30b1gx.jpg",
    structure: "TOP = the rejected option (Drake disapproves); BOTTOM = the preferred option (Drake approves).",
    sample: {
      top: "MIKE PASSING THE BALL",
      bottom: "MIKE CHUCKING A CONTESTED THREE",
    },
    bestFor: "Contrasting the smart play vs the ego play a crew member always picks.",
  },
  {
    name: "Roll Safe Think About It",
    imgflipId: "89370399",
    url: "https://i.imgflip.com/1h7in3.jpg",
    structure: "Galaxy-brain 'smart' advice: TOP sets up, BOTTOM delivers fake-genius logic.",
    sample: {
      top: "YOU CAN'T GET CROSSED BY NOAH",
      bottom: "IF YOU NEVER GET OFF THE BENCH",
    },
    bestFor: "Fake-wise logic that actually roasts the victim's cowardice/skill.",
  },
  {
    name: "Futurama Fry",
    imgflipId: "61520",
    url: "https://i.imgflip.com/1bgw.jpg",
    structure: "Suspicious squint: TOP = 'Not sure if X', BOTTOM = 'or just Y'.",
    sample: {
      top: "NOT SURE IF KEV PLAYS DEFENSE",
      bottom: "OR JUST JOGS NEXT TO HIS MAN",
    },
    bestFor: "Calling out lazy effort with mock uncertainty.",
  },
  {
    name: "Tuxedo Winnie The Pooh",
    imgflipId: "178591752",
    url: "https://i.imgflip.com/2ybua0.png",
    structure: "TOP = the plain version; BOTTOM = the same thing said fancy/savage. Escalation joke.",
    sample: {
      top: "MIKE MISSED THE SHOT",
      bottom: "MIKE GENEROUSLY DONATED POSSESSION TO THE RIM",
    },
    bestFor: "Dressing up a basic roast into a fancier burn.",
  },
  {
    name: "Marked Safe From",
    imgflipId: "161865971",
    url: "https://i.imgflip.com/2odckz.jpg",
    structure: "TOP = 'Marked safe from'; BOTTOM = the danger they avoided — usually by being irrelevant.",
    sample: {
      top: "KEV HAS BEEN MARKED SAFE FROM",
      bottom: "EVER GETTING DUNKED ON (HE NEVER TRIES)",
    },
    bestFor: "Backhanded 'compliments' about someone's non-impact.",
  },
  {
    name: "Always Has Been",
    imgflipId: "252600902",
    url: "https://i.imgflip.com/46e43q.png",
    structure: "Astronaut reveal: TOP = 'Wait, it's all X?', BOTTOM = 'Always has been.'",
    sample: {
      top: "WAIT, NOAH RUNS THIS COURT?",
      bottom: "ALWAYS HAS BEEN",
    },
    bestFor: "Stating the protagonist's dominance as an obvious eternal truth.",
  },
];
