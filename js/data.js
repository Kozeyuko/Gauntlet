// js/data.js — ALL game data tables, verbatim from BitCore.server.lua (v5).
// This file is data only: no logic, no DOM, no state.

// ------------------------------------------------------------------ CONSTANTS --
export const DAY_SECONDS = 2;
export const START_AGE_DAYS = 18 * 365;
export const BASE_LIFESPAN = 30;
export const START_MONEY = 30;

export const HP_BASE = 100;
export const HP_PER_TOU = 8.5;
export const STR_DRAIN_DIV = 300;
export const TOU_EFF_DIV = 150;
export const COMBAT_STAM_BASE = 80;
export const GAS_MULT = 0.5;
export const ULT_CHARGE_BASE = 8;
export const ULT_CHARGE_PER_INT = 0.04;
export const ULT_MAX = 60;
export const MODE_DUR_BASE = 3;
export const MODE_DUR_PER_INT = 50;
export const MODE_DUR_CAP = 8;
export const ENC_CHANCE = 0.3;
export const ENC_MIN = 0.8;
export const ENC_MAX = 1.1;
export const HOME_MULT = 0.5;
export const STYLEXP_TRAIN = 2;
export const STYLEXP_LOSS = 2;
export const MASTERY_TIERS = [25, 75, 150];

export const KNOWLEDGE_UNMASTERED = 25;   // % where unmastered becomes usable
export const KNOWLEDGE_LEARNED = 100;     // % where fully learned
export const UNMASTERED_DMG = 0.75;       // damage mult when using unmastered
export const UNMASTERED_SKILL = 0.85;     // per-skill mult scale when unmastered
export const CUSTOM_SKILL_PENALTY = 0.10; // dmg penalty per extra skill
export const CUSTOM_MAX_SKILLS = 3;
export const SELF_TRAIN_MULT = 1.5;       // rate boost for using an unmastered style

export const DATA_VERSION = 2;
export const GAME_VERSION = 1.01;
export const UPDATE_LOG = [
  { v: 1.01, text: "New: training progression ladders, inventory & tasklist, skill status effects (poison/buff/debuff/limb), style tiers, locked gyms & The Inside hidden until their rival is beaten, money in vitals, zero-stat start, build-editor fix." },
  { v: 1.0, text: "Launch: train, fight rivals, learn styles, reincarnate." },
];
export function versionCompare(a, b) {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}
export const MAX_GHOSTS = 50;
export const ROAMER_COOLDOWN_MS = 3 * 60 * 1000;

// ------------------------------------------------------------------ JOBS --
export const JOBS = [
  {
    key: "delivery",
    name: "Delivery Run",
    desc: "Drop off packages to the right doors. Tap the matching house before the timer expires.",
    staminaCost: 8,
    basePay: 6,
    xpPerShift: 10,
    xpToLevel: 50,
    maxLevel: 20,
    minigame: "matchtap",
    minigameConfig: { rounds: 5, timePerRound: 3000, choices: 3 },
  },
  {
    key: "dishwash",
    name: "Dish Dash",
    desc: "Tap dirty dishes as they appear. Quick taps = clean streaks = more pay.",
    staminaCost: 6,
    basePay: 5,
    xpPerShift: 8,
    xpToLevel: 40,
    maxLevel: 20,
    minigame: "whack",
    minigameConfig: { rounds: 8, timePerRound: 2000, spawnDelay: 600 },
  },
  {
    key: "stocking",
    name: "Stock Sort",
    desc: "Sort incoming boxes into the right bin. Tap the bin that matches the box label.",
    staminaCost: 7,
    basePay: 7,
    xpPerShift: 9,
    xpToLevel: 45,
    maxLevel: 20,
    minigame: "sort",
    minigameConfig: { rounds: 6, timePerRound: 3500, bins: 4 },
  },
];

export function jobPay(job, level) {
  return Math.round(job.basePay * (1 + 0.18 * (level - 1)));
}
export function jobStaminaCost(job, level) {
  return Math.max(Math.ceil(job.staminaCost * 0.5), Math.ceil(job.staminaCost * (1 - 0.03 * (level - 1))));
}
export function jobXpForLevel(job, level) {
  return Math.round(job.xpToLevel * Math.pow(1.5, level - 1));
}
export const JOB_AUTO_RATE = 0.5;
export const JOB_AUTO_COOLDOWN_MS = 60 * 1000;

// ------------------------------------------------------------------ ATTRIBUTES --
export const ATTRIBUTES = [
  { id: "Str", name: "Strength", desc: "Raw power. Boosts damage in every fight." },
  { id: "Tou", name: "Toughness", desc: "Soak hits and extend your lifespan." },
  { id: "Spd", name: "Speed", desc: "Strike first and dodge more often. Raises stamina." },
  { id: "Int", name: "Intelligence", desc: "Sharpens technique, crits, and ultimate charge." },
  { id: "Cha", name: "Charisma", desc: "Earns more Cash from odd jobs and fights." },
];

// ------------------------------------------------------------------ ACTIVITIES --
export const ACTIVITIES = {
  Rest: { name: "Resting", cost: 0 },
  OddJobs: { name: "Odd Jobs", cost: 10, moneyBase: 3, moneyCha: 0.5 },
  Pushups: { name: "Pushups", cost: 10, attr: "Str", gain: 0.10 },
  Situps: { name: "Situps", cost: 10, attr: "Tou", gain: 0.10 },
  Squats: { name: "Squats", cost: 10, attr: "Spd", gain: 0.10 },
  Roadworks: { name: "Roadworks", cost: 10, attr: "Spd", gain: 0.08, staminaBonus: 5 },
  ShadowBoxing: { name: "Shadow Boxing", cost: 10, attr: "Int", gain: 0.08 },
  Sparring: { name: "Sparring", cost: 12, attr: "Tou", gain: 0.06 },
  Running: { name: "Running", cost: 15, attr: "Spd", gain: 0.06 },
  HeavyBag: { name: "Heavy Bag", cost: 10, attr: "Str", gain: 0.10 },
};

export const ACTIVITY_ALIAS = {
  TrainStr: "Pushups",
  TrainTou: "Situps",
  TrainSpd: "Squats",
  TrainInt: "ShadowBoxing",
  TrainCha: "OddJobs",
};

// Display order for the activities grid (matches BitHub ACTIVITY_LIST).
export const ACTIVITY_LIST = [
  { key: "Rest", label: "Rest" },
  { key: "OddJobs", label: "Odd Jobs" },
  { key: "Pushups", label: "Pushups (Str)" },
  { key: "Situps", label: "Situps (Tou)" },
  { key: "Squats", label: "Squats (Spd)" },
  { key: "Roadworks", label: "Roadworks" },
  { key: "ShadowBoxing", label: "Shadow Box (Int)" },
  { key: "Sparring", label: "Sparring (Tou)" },
  { key: "Running", label: "Running (Spd)" },
  { key: "HeavyBag", label: "Heavy Bag (Str)" },
];

// ------------------------------------------------------------------ STORE --
// Convenience store: food, drinks, and gear (the old general store inventory).
export const CSTORE_ITEMS = [
  { key: "rice", name: "Rice bowl", desc: "Restores 20 Nutrition", price: 5, nutrition: 20 },
  { key: "protein", name: "Protein shake", desc: "+5 Strength for this life", price: 15, stat: "Str", amount: 5 },
  { key: "energy", name: "Energy drink", desc: "+5 Speed for this life", price: 15, stat: "Spd", amount: 5 },
  { key: "focus", name: "Focus tea", desc: "+5 Intelligence for this life", price: 15, stat: "Int", amount: 5 },
  { key: "heart", name: "Heart tonic", desc: "+5 Toughness for this life", price: 20, stat: "Tou", amount: 5 },
  { key: "charm", name: "Charm perfume", desc: "+5 Charisma for this life", price: 20, stat: "Cha", amount: 5 },
  { key: "rawmeat", name: "Raw Meat", desc: "Cook at home for Grilled Meat", price: 4, raw: true, cookTo: "grilledmeat" },
  { key: "rawchicken", name: "Raw Chicken", desc: "Cook at home for Fried Chicken", price: 5, raw: true, cookTo: "chicken" },
  { key: "hotdog", name: "Hot Dog", desc: "Restores 25 Nutrition", price: 6, nutrition: 25 },
  { key: "pizza", name: "Pizza Slice", desc: "Restores 40 Nutrition", price: 8, nutrition: 40 },
  { key: "chicken", name: "Fried Chicken", desc: "Restores 35 Nutrition", price: 7, nutrition: 35 },
  { key: "tacos", name: "Tacos", desc: "Restores 45 Nutrition", price: 9, nutrition: 45 },
  { key: "grilledmeat", name: "Grilled Meat", desc: "Restores 50 Nutrition", price: 0, nutrition: 50, notSold: true },
  { key: "mat", name: "Old Training Mat", desc: "Required for Shadow Boxing training", price: 15, permanent: true },
];

// Clinic: cheap medical/healing items.
export const CLINIC_ITEMS = [
  { key: "bandages", name: "Bandages", desc: "Restore 25 Health", price: 8, health: 25 },
  { key: "medkit", name: "Medkit", desc: "Restore 60 Health", price: 20, health: 60 },
  { key: "fullrecovery", name: "Full recovery", desc: "Restore 100 Health + 50 Stamina", price: 40, health: 100, stamina: 50 },
  { key: "checkup", name: "Checkup", desc: "+2 Toughness for this life", price: 25, stat: "Tou", amount: 2 },
];

// ------------------------------------------------------------------ LOCATIONS --
export const LOCATIONS = {
  home: { name: "Home", unlock: 0, tier: 0, styleGym: null },
  spar: { name: "Iron Spar Gym", unlock: 0, tier: 1, styleGym: "Boxer" },
  wat: { name: "Wat Chai Gym", unlock: 0, tier: 1, styleGym: "MuayThai" },
  tatami: { name: "Tatami Hall", unlock: 0, tier: 1, styleGym: "Judo" },
  roda: { name: "Roda Circle", unlock: 0, tier: 1, styleGym: "Capoeira" },
  dohyo: { name: "Dohyo Ring", unlock: 0, tier: 1, styleGym: "Sumo" },
  foundry: { name: "The Foundry", unlock: 0, tier: 1, styleGym: "M2Cross" },
  mikazuki: { name: "Mikazuchi Dojo", unlock: 3, tier: 2, styleGym: "Mikazuchi" },
  stormpg: { name: "Storm Pagoda", unlock: 5, tier: 2, styleGym: "ThunderClap" },
  lightning: { name: "Lightning Alley", unlock: 6, tier: 2, styleGym: "LightningFlash" },
  sanctum: { name: "The Sanctum", unlock: 7, tier: 3, styleGym: "MastersSeal" },
  estate: { name: "Kure Estate", unlock: 11, tier: 4, styleGym: "KureStyle" },
  clinic: { name: "Clinic", unlock: 0, tier: 0, styleGym: null },
  cstore: { name: "Convenience Store", unlock: 0, tier: 0, styleGym: null },
  jobboard: { name: "Job Board", unlock: 0, tier: 0, styleGym: null },
  arena: { name: "Bloody Arena", unlock: 0, tier: 0, styleGym: null },
  inside: { name: "The Inside", unlock: 7, tier: 0, styleGym: null },
  oldhouse: { name: "The Old House", unlock: 0, tier: 1, styleGym: null },

  niko: { name: "Boundless Dojo", unlock: 6, tier: 2, styleGym: "NikoStyle" },
  raishin: { name: "Raishin Temple", unlock: 7, tier: 3, styleGym: "Raishin" },
  spirit: { name: "Blood Dojo", unlock: 8, tier: 3, styleGym: "Advance" },
  kaiwan: { name: "Iron Hall", unlock: 5, tier: 2, styleGym: "KaiwanStyle" },
  silat: { name: "Pencak Hall", unlock: 7, tier: 3, styleGym: "Silat" },
  hunt: { name: "Deepwood Lodge", unlock: 9, tier: 3, styleGym: "PredatorHunt" },
  sword: { name: "Daidoji Manor", unlock: 10, tier: 4, styleGym: "DaidojiSchool" },
  xiyi: { name: "Five-Element Gate", unlock: 8, tier: 3, styleGym: "XingYi" },

  kyoku: { name: "Kyokushin Dojo", unlock: 5, tier: 2, styleGym: "Kyokushin" },
  shotokan: { name: "Shotokan Hall", unlock: 6, tier: 2, styleGym: "Shotokan" },
  taekwon: { name: "TKD Dojang", unlock: 5, tier: 2, styleGym: "Taekwondo" },
  wrestling: { name: "The Wrestling Pit", unlock: 6, tier: 2, styleGym: "Wrestling" },
  kickbox: { name: "Kickbox Club", unlock: 5, tier: 2, styleGym: "Kickboxing" },
  kungfu: { name: "Shaolin Yard", unlock: 7, tier: 3, styleGym: "KungFu" },
  aikido: { name: "Aiki Circle", unlock: 8, tier: 3, styleGym: "Aikido" },
  kali: { name: "Arnis Ring", unlock: 8, tier: 3, styleGym: "KaliArnis" },
  ironbox: { name: "Iron Foundry Gym", unlock: 9, tier: 3, styleGym: "IronBoxing" },
  boran: { name: "Ancient Boran Camp", unlock: 10, tier: 4, styleGym: "MuayBoran" },
  guihun: { name: "Demon's Crucible", unlock: 11, tier: 4, styleGym: "Guihun" },
  ultra: { name: "The Still Point", unlock: 12, tier: 4, styleGym: "UltraInstinct" },
};

// Display order for the locations grid.
export const LOCATION_LIST = [
  { key: "home", label: "Home", desc: "Your starting point. Safe, quiet, and close to the fridge." },
  { key: "spar", label: "Iron Spar", desc: "A gritty gym with heavy bags and sparse lighting." },
  { key: "wat", label: "Wat Chai", desc: "Temple-styled ringside. Watches every clinch." },
  { key: "tatami", label: "Tatami", desc: "Clean mats, quiet atmosphere, crisp footwork." },
  { key: "roda", label: "Roda", desc: "Capoeira roda. Music, motion, surprise sweeps." },
  { key: "dohyo", label: "Dohyo", desc: "Sacred clay ring. Tradition meets raw force." },
  { key: "foundry", label: "Foundry", desc: "Industrial iron pits. Conditioning forged in heat." },
  { key: "mikazuki", label: "Mikazuchi Dojo", desc: "A dojo carved from living rock." },
  { key: "stormpg", label: "Storm Pagoda", desc: "Wind-torn drums echo across the ridges." },
  { key: "lightning", label: "Lightning Alley", desc: "Narrow and loud. Blitz or get blitzed." },
  { key: "sanctum", label: "Sanctum", desc: "Stone halls and silence. Pressure tests your mind." },
  { key: "estate", label: "Kure Estate", desc: "Polished grounds. High-standing opponents." },
  { key: "clinic", label: "Clinic", desc: "Surgical recovery. Heal fast, heal smart." },
  { key: "cstore", label: "Convenience Store", desc: "Food, drinks, and gear. Cash only.", glyph: "$" },
  { key: "jobboard", label: "Job Board", desc: "Pick up odd jobs and shifts. Earn Cash and level up.", glyph: "J" },
  { key: "arena", label: "Arena", desc: "Raised ring, crowd noise, tournaments, and the Gu Ritual." },
  { key: "inside", label: "The Inside", desc: "They say this place changes you. Permanently." },
  { key: "oldhouse", label: "Old House", desc: "Creaking wood and hidden corners." },
  { key: "niko", label: "Boundless Dojo", desc: "No walls. No limits. Fight free." },
  { key: "raishin", label: "Raishin Temple", desc: "Thunder monks who fight while chanting." },
  { key: "spirit", label: "Blood Dojo", desc: "Red ropes and older grudges." },
  { key: "kaiwan", label: "Iron Hall", desc: "A brutalist hall for brutal fights." },
  { key: "silat", label: "Pencak Hall", desc: "Silat flow. Angles no one sees coming." },
  { key: "hunt", label: "Deepwood Lodge", desc: "Treed trails and cold morning runs." },
  { key: "sword", label: "Daidoji Manor", desc: "Precision under the sword arts." },
  { key: "xiyi", label: "Five-Element Gate", desc: "Cycle through fire, water, wood, metal, earth." },
  { key: "kyoku", label: "Kyokushin Dojo", desc: "Full-contact sweat. Knockout-or-be-knocked-out." },
  { key: "shotokan", label: "Shotokan Hall", desc: "Linear power. Every strike has a root." },
  { key: "taekwon", label: "TKD Dojang", desc: "Spinning hooks and snapping speed." },
  { key: "wrestling", label: "Wrestling Pit", desc: "Mat work, clinches, and heavy top pressure." },
  { key: "kickbox", label: "Kickbox Club", desc: "Pads bang constantly. Legs and lungs burn." },
  { key: "kungfu", label: "Shaolin Yard", desc: "Wooden dummies, open palm, iron bone." },
  { key: "aikido", label: "Aiki Circle", desc: "Redirect force. The softer hand wins." },
  { key: "kali", label: "Arnis Ring", desc: "Sticks and flow. Close and dangerous." },
  { key: "ironbox", label: "Iron Foundry Gym", desc: "Old iron, new will. Basic work, brutal results." },
  { key: "boran", label: "Boran Camp", desc: "Ancient rope binds and elbow storms." },
  { key: "guihun", label: "Demon's Crucible", desc: "Only the broken come out whole." },
  { key: "ultra", label: "Still Point", desc: "The quietest place. The loudest fights." },
];

// ------------------------------------------------------------------ TRAINING --
// Location training programs: keyed by location key. `cost` is the Cash charge
// per session (0 = free), `gain` multiplies the activity's base stat gain.
// Rest / OddJobs are NOT here — they stay globally available (free actions).
export const TRAINING = {
  // tier 0 — home: free basics + always-available actions
  home: { Pushups: { cost: 0, gain: 0.6 }, Situps: { cost: 0, gain: 0.6 } },
  // tier 1 — unlock 0, cheap (cost 2-3), gain ×1.0-1.1
  spar:   { Pushups: { cost: 2, gain: 1.0 }, HeavyBag: { cost: 3, gain: 1.1 }, Sparring: { cost: 3, gain: 1.0 } },
  wat:    { Situps: { cost: 2, gain: 1.0 }, Sparring: { cost: 3, gain: 1.0 }, HeavyBag: { cost: 3, gain: 1.0 } },
  tatami: { Squats: { cost: 2, gain: 1.0 }, ShadowBoxing: { cost: 3, gain: 1.0 } },
  roda:   { Squats: { cost: 2, gain: 1.0 }, Running: { cost: 3, gain: 1.1 } },
  dohyo:  { Situps: { cost: 2, gain: 1.0 }, Squats: { cost: 3, gain: 1.1 } },
  foundry:{ Pushups: { cost: 2, gain: 1.0 }, HeavyBag: { cost: 3, gain: 1.1 } },
  oldhouse: { ShadowBoxing: { cost: 2, gain: 1.0 } },
  // tier 2 — unlock 3-6, cost 5-8, gain ×1.5-1.6
  mikazuki: { Squats: { cost: 5, gain: 1.5 }, ShadowBoxing: { cost: 6, gain: 1.5 } },
  stormpg:  { ShadowBoxing: { cost: 6, gain: 1.5 }, Pushups: { cost: 5, gain: 1.5 } },
  lightning: { Squats: { cost: 5, gain: 1.6 }, Running: { cost: 6, gain: 1.6 } },
  niko:     { ShadowBoxing: { cost: 6, gain: 1.5 }, Squats: { cost: 5, gain: 1.5 }, Sparring: { cost: 8, gain: 1.6 } },
  kaiwan:   { Situps: { cost: 5, gain: 1.5 }, HeavyBag: { cost: 6, gain: 1.5 } },
  kyoku:    { HeavyBag: { cost: 6, gain: 1.5 }, Situps: { cost: 5, gain: 1.5 } },
  shotokan: { ShadowBoxing: { cost: 6, gain: 1.5 }, Squats: { cost: 5, gain: 1.5 } },
  taekwon:  { Squats: { cost: 5, gain: 1.5 }, Roadworks: { cost: 5, gain: 1.5 } },
  wrestling:{ Pushups: { cost: 5, gain: 1.5 }, Situps: { cost: 5, gain: 1.5 } },
  kickbox:  { HeavyBag: { cost: 6, gain: 1.5 }, Roadworks: { cost: 5, gain: 1.5 } },
  // tier 3 — unlock 7-9, cost 10-14, gain ×2.0-2.1
  sanctum: { Sparring: { cost: 12, gain: 2.0 }, ShadowBoxing: { cost: 10, gain: 2.0 } },
  raishin: { Squats: { cost: 10, gain: 2.0 }, Running: { cost: 12, gain: 2.0 } },
  spirit:  { Pushups: { cost: 10, gain: 2.0 }, HeavyBag: { cost: 12, gain: 2.1 } },
  silat:   { Squats: { cost: 10, gain: 2.0 }, ShadowBoxing: { cost: 10, gain: 2.0 } },
  hunt:    { Running: { cost: 12, gain: 2.1 }, Squats: { cost: 10, gain: 2.0 } },
  xiyi:    { HeavyBag: { cost: 12, gain: 2.1 }, Situps: { cost: 10, gain: 2.0 } },
  kungfu:  { ShadowBoxing: { cost: 10, gain: 2.0 }, HeavyBag: { cost: 12, gain: 2.0 } },
  aikido:  { ShadowBoxing: { cost: 10, gain: 2.0 }, Squats: { cost: 10, gain: 2.0 } },
  kali:    { Squats: { cost: 10, gain: 2.0 }, ShadowBoxing: { cost: 10, gain: 2.0 } },
  ironbox: { Pushups: { cost: 10, gain: 2.0 }, HeavyBag: { cost: 12, gain: 2.1 } },
  // tier 4 — unlock 10-12, elite: cost 16-24, gain ×2.6-2.8
  sword:  { ShadowBoxing: { cost: 16, gain: 2.6 }, Pushups: { cost: 16, gain: 2.6 }, Sparring: { cost: 20, gain: 2.7 } },
  boran:  { HeavyBag: { cost: 18, gain: 2.7 }, Situps: { cost: 16, gain: 2.6 }, Sparring: { cost: 20, gain: 2.7 } },
  guihun: { HeavyBag: { cost: 18, gain: 2.7 }, Pushups: { cost: 16, gain: 2.6 }, Sparring: { cost: 22, gain: 2.8 } },
  // elite all-stat gyms (only these cover every stat, premium price)
  estate: {
    Pushups: { cost: 16, gain: 2.6 }, Situps: { cost: 16, gain: 2.6 },
    Squats: { cost: 16, gain: 2.6 }, ShadowBoxing: { cost: 16, gain: 2.6 },
    Running: { cost: 18, gain: 2.7 }, HeavyBag: { cost: 18, gain: 2.7 },
    Sparring: { cost: 20, gain: 2.7 }, Roadworks: { cost: 18, gain: 2.7 },
  },
  ultra: {
    Pushups: { cost: 18, gain: 2.8 }, Situps: { cost: 18, gain: 2.8 },
    Squats: { cost: 18, gain: 2.8 }, ShadowBoxing: { cost: 18, gain: 2.8 },
    Running: { cost: 20, gain: 2.8 }, HeavyBag: { cost: 20, gain: 2.8 },
    Sparring: { cost: 24, gain: 2.9 }, Roadworks: { cost: 20, gain: 2.8 },
  },
};

export const TRAIN_CHAINS = {
  Pushups: {
    attr: "Str",
    tiers: [
      { name: "Pushups",           gainMult: 1.0, costMult: 1.0, req: 0 },
      { name: "Clapping Pushups",  gainMult: 1.35, costMult: 1.2, req: 20 },
      { name: "One-Arm Pushups",   gainMult: 1.75, costMult: 1.4, req: 50 },
      { name: "Handstand Pushups", gainMult: 2.3,  costMult: 1.7, req: 100 },
    ],
  },
  Situps: { attr: "Tou", tiers: [
      { name: "Situps",              gainMult: 1.0,  costMult: 1.0, req: 0 },
      { name: "Hanging Leg Raises",  gainMult: 1.35, costMult: 1.2, req: 20 },
      { name: "Dragon Flags",        gainMult: 1.75, costMult: 1.4, req: 50 },
    ] },
  Squats: { attr: "Spd", tiers: [
      { name: "Squats",              gainMult: 1.0,  costMult: 1.0, req: 0 },
      { name: "Pistol Squats",       gainMult: 1.35, costMult: 1.2, req: 20 },
      { name: "Jump Squats",         gainMult: 1.75, costMult: 1.4, req: 50 },
    ] },
  Roadworks: { attr: "Spd", tiers: [
      { name: "Roadworks",           gainMult: 1.0,  costMult: 1.0, req: 0 },
      { name: "Sprint Carries",      gainMult: 1.35, costMult: 1.2, req: 25 },
      { name: "Hill Sprints",        gainMult: 1.75, costMult: 1.4, req: 60 },
    ] },
  ShadowBoxing: { attr: "Int", tiers: [
      { name: "Shadow Boxing",       gainMult: 1.0,  costMult: 1.0, req: 0 },
      { name: "Footwork Drills",     gainMult: 1.35, costMult: 1.2, req: 20 },
      { name: "Speed Bag Rhythms",   gainMult: 1.75, costMult: 1.4, req: 50 },
    ] },
  HeavyBag: { attr: "Str", tiers: [
      { name: "Heavy Bag",           gainMult: 1.0,  costMult: 1.0, req: 0 },
      { name: "Power Bag",           gainMult: 1.35, costMult: 1.2, req: 25 },
      { name: "Sledge Hammer",       gainMult: 1.75, costMult: 1.4, req: 60 },
    ] },
};
export function trainChain(activityKey) { return TRAIN_CHAINS[activityKey] || null; }

export const STYLE_TIER_MULT = { 1: 1.0, 2: 1.15, 3: 1.3 };
export function styleTier(styleId) { return STYLES[styleId]?.tier || 1; }

// ------------------------------------------------------------------ STYLES --
export const STYLES = {
  Brawling: { name: "Brawling", desc: "Unrefined street brawling. Everybody starts here.", tier: 1, dmg: 1.05, dodge: 0.0, crit: 0.0, ult: { name: "Second Wind", mult: 1.2 },
    skills: [{ name: "Wild Swing", mult: 1.0, crit: 0.0, dodge: 0.0, weight: 3 }, { name: "Headbutt", mult: 1.15, crit: 0.0, dodge: -0.02, weight: 2 }, { name: "Cheap Shot", mult: 1.25, crit: 0.06, dodge: -0.02, weight: 1 }] },
  Boxer: { name: "Boxer Stance", desc: "Classic boxing: jab, footwork, discipline.", tier: 1, dmg: 1.12, dodge: 0.05, crit: 0.0, ult: { name: "Haymaker Fury", mult: 1.5 },
    skills: [{ name: "Jab", mult: 0.85, crit: 0.0, dodge: 0.02, weight: 3, status: { effect: "buff", value: 0.10, rounds: 3 } }, { name: "Cross", mult: 1.05, crit: 0.02, dodge: 0.0, weight: 2 }, { name: "Hook", mult: 1.2, crit: 0.04, dodge: 0.0, weight: 2 }, { name: "Uppercut", mult: 1.3, crit: 0.06, dodge: -0.02, weight: 1 }] },
  MuayThai: { name: "Muay Thai", desc: "Eight limbs of war. Knees and elbows end arguments.", tier: 1, dmg: 1.22, dodge: 0.06, crit: 0.02, ult: { name: "Eight Limbs", mult: 1.4 },
    skills: [{ name: "Teep", mult: 0.9, crit: 0.0, dodge: 0.02, weight: 3, status: { effect: "debuff", value: 0.15, rounds: 3 } }, { name: "Roundhouse", mult: 1.15, crit: 0.02, dodge: 0.0, weight: 2 }, { name: "Elbow", mult: 1.25, crit: 0.06, dodge: -0.02, weight: 2 }, { name: "Knee", mult: 1.4, crit: 0.04, dodge: -0.02, weight: 1 }] },
  Mikazuchi: { name: "Mikazuchi Style", desc: "High guard, fists at the chin. Patience is a weapon.", tier: 2, dmg: 1.20, dodge: 0.10, crit: 0.0, ult: { name: "Lightning God", mult: 1.3 },
    skills: [{ name: "High Jab", mult: 0.9, crit: 0.0, dodge: 0.02, weight: 3 }, { name: "Counter Cross", mult: 1.15, crit: 0.04, dodge: 0.02, weight: 2 }, { name: "Mikazuchi Flurry", mult: 1.0, crit: 0.0, dodge: 0.0, weight: 2 }, { name: "Chin Strike", mult: 1.35, crit: 0.06, dodge: 0.0, weight: 1 }] },
  Judo: { name: "Judo", desc: "Use their momentum. The mat is a teacher.", tier: 1, dmg: 1.16, dodge: 0.18, crit: 0.04, ult: { name: "Ippon", mult: 1.6 },
    skills: [{ name: "Grip", mult: 0.8, crit: 0.0, dodge: 0.04, weight: 3 }, { name: "Ashi Waza", mult: 0.95, crit: 0.0, dodge: 0.02, weight: 2, status: { effect: "limb", value: "leg" } }, { name: "Osoto Gari", mult: 1.2, crit: 0.02, dodge: 0.0, weight: 2 }, { name: "Ippon Seoi", mult: 1.4, crit: 0.06, dodge: 0.0, weight: 1 }] },
  M2Cross: { name: "M2 Heavy Cross", desc: "One devastating cross. Slow to load, brutal to eat.", tier: 1, dmg: 1.28, dodge: 0.0, crit: 0.12, ult: { name: "Guillotine", mult: 2.0 },
    skills: [{ name: "Feint", mult: 0.7, crit: 0.0, dodge: 0.02, weight: 2 }, { name: "Load the Cross", mult: 0.9, crit: 0.06, dodge: -0.02, weight: 2 }, { name: "Heavy Cross", mult: 1.6, crit: 0.12, dodge: -0.04, weight: 1 }] },
  Capoeira: { name: "Capoeira", desc: "Dance like a flame, strike like a whip.", tier: 1, dmg: 1.20, dodge: 0.20, crit: 0.06, ult: { name: "Ginga Roda", mult: 1.25 },
    skills: [{ name: "Ginga", mult: 0.8, crit: 0.0, dodge: 0.06, weight: 3 }, { name: "Martelo", mult: 1.15, crit: 0.02, dodge: 0.02, weight: 2 }, { name: "Meia Lua", mult: 1.2, crit: 0.04, dodge: 0.02, weight: 2 }, { name: "Armada Voadora", mult: 1.35, crit: 0.06, dodge: 0.0, weight: 1 }] },
  ThunderClap: { name: "Thunder Clap", desc: "Clap the air and shockwave your enemy.", tier: 2, dmg: 1.35, dodge: 0.05, crit: 0.06, ult: { name: "Sonic Clap", mult: 1.35 },
    skills: [{ name: "Palm Strike", mult: 0.9, crit: 0.02, dodge: 0.0, weight: 3 }, { name: "Thunder Palm", mult: 1.15, crit: 0.04, dodge: 0.0, weight: 2 }, { name: "Shockwave Clap", mult: 1.35, crit: 0.06, dodge: 0.0, weight: 1 }] },
  Sumo: { name: "Sumo", desc: "Two hundred kilos of immovable will.", tier: 1, dmg: 1.34, dodge: 0.0, crit: 0.02, ult: { name: "Yorikiri", mult: 1.3 },
    skills: [{ name: "Tachi-ai", mult: 1.0, crit: 0.0, dodge: 0.0, weight: 3 }, { name: "Harite", mult: 1.1, crit: 0.02, dodge: -0.02, weight: 2 }, { name: "Yorikiri Drive", mult: 1.3, crit: 0.02, dodge: 0.0, weight: 2 }, { name: "Tsukidashi", mult: 1.45, crit: 0.04, dodge: -0.02, weight: 1 }] },
  LightningFlash: { name: "Lightning Flash", desc: "Blink forward, strike through. Speed incarnate.", tier: 2, dmg: 1.15, dodge: 0.22, crit: 0.08, ult: { name: "Afterimage", mult: 1.4 },
    skills: [{ name: "Dash Jab", mult: 0.85, crit: 0.0, dodge: 0.03, weight: 3 }, { name: "Flash Step", mult: 0.9, crit: 0.0, dodge: 0.05, weight: 2 }, { name: "Lightning Cross", mult: 1.3, crit: 0.08, dodge: 0.0, weight: 1 }] },
  KureStyle: { name: "Kure Style", desc: "A clan's thousand-year secret. Killers' tradition.", tier: 3, dmg: 1.40, dodge: 0.10, crit: 0.10, ult: { name: "Removal", mult: 1.5 },
    skills: [{ name: "Leg Sweep", mult: 0.9, crit: 0.0, dodge: 0.02, weight: 3 }, { name: "Kure Elbow", mult: 1.25, crit: 0.08, dodge: 0.0, weight: 2 }, { name: "Lion's Bite", mult: 1.5, crit: 0.12, dodge: 0.0, weight: 1 }] },
  MastersSeal: { name: "Master's Seal", desc: "The pinnacle. Everything before was practice.", tier: 3, dmg: 1.45, dodge: 0.08, crit: 0.12, ult: { name: "Final Lesson", mult: 1.6 },
    skills: [{ name: "Deflecting Palm", mult: 0.9, crit: 0.0, dodge: 0.04, weight: 3 }, { name: "Seal Strike", mult: 1.25, crit: 0.06, dodge: 0.0, weight: 2 }, { name: "Final Lesson", mult: 1.55, crit: 0.14, dodge: 0.0, weight: 1 }] },

  NikoStyle: { name: "Niko Style", desc: "Redirect everything. Adamantine, Flame, Redirection Kata.", tier: 2, dmg: 1.30, dodge: 0.16, crit: 0.10, ult: { name: "Demonsbane", mult: 1.8 },
    skills: [{ name: "Adamantine Kata", mult: 1.0, crit: 0.0, dodge: 0.02, weight: 3 }, { name: "Flame Kata", mult: 1.2, crit: 0.04, dodge: 0.0, weight: 2, status: { effect: "poison", value: 3, rounds: 2 } }, { name: "Redirection Kata", mult: 0.9, crit: 0.0, dodge: 0.06, weight: 2 }, { name: "Demonsbane", mult: 1.5, crit: 0.10, dodge: 0.04, weight: 1 }] },
  Raishin: { name: "Raishin Style", desc: "Explosive first step, a fist already where you stand.", tier: 3, dmg: 1.34, dodge: 0.14, crit: 0.06, ult: { name: "Thunder God", mult: 1.5 },
    skills: [{ name: "First Step", mult: 0.9, crit: 0.0, dodge: 0.03, weight: 3 }, { name: "Raishin Jab", mult: 1.2, crit: 0.04, dodge: 0.02, weight: 2 }, { name: "Thunder Step", mult: 1.45, crit: 0.08, dodge: 0.0, weight: 1 }] },
  Advance: { name: "Possessing Spirit", desc: "Blood-boiling speed. The body screams but the hits land.", tier: 3, dmg: 1.38, dodge: 0.12, crit: 0.12, ult: { name: "Overwhelm", mult: 1.7 },
    skills: [{ name: "Blood Rush", mult: 1.05, crit: 0.02, dodge: 0.02, weight: 3 }, { name: "Red-eyed Flurry", mult: 1.15, crit: 0.06, dodge: 0.0, weight: 2 }, { name: "Overwhelm", mult: 1.5, crit: 0.12, dodge: -0.02, weight: 1 }] },
  KaiwanStyle: { name: "Kaiwan Style", desc: "Iron body hardening. Pain is a foreign language.", tier: 1, dmg: 1.18, dodge: 0.0, crit: 0.02, ult: { name: "Iron Wall", mult: 1.3 },
    skills: [{ name: "Iron Guard", mult: 0.8, crit: 0.0, dodge: 0.02, weight: 3 }, { name: "Kaiwan Palm", mult: 1.1, crit: 0.02, dodge: 0.0, weight: 2 }, { name: "Iron Wall Body", mult: 1.25, crit: 0.0, dodge: 0.03, weight: 1 }] },
  Silat: { name: "Silat", desc: "Knife-hand flow. Every joint is a target.", tier: 2, dmg: 1.24, dodge: 0.15, crit: 0.10, ult: { name: "Butcher's Dance", mult: 1.5 },
    skills: [{ name: "Knife Hand", mult: 0.95, crit: 0.04, dodge: 0.02, weight: 3 }, { name: "Joint Lock", mult: 1.0, crit: 0.0, dodge: 0.04, weight: 2, status: { effect: "limb", value: "arm" } }, { name: "Butcher's Cut", mult: 1.35, crit: 0.12, dodge: 0.0, weight: 1 }] },
  PredatorHunt: { name: "Predator's Hunt", desc: "A killer who fights to finish fast. No wasted motion.", tier: 2, dmg: 1.32, dodge: 0.10, crit: 0.14, ult: { name: "Apex Lunge", mult: 1.7 },
    skills: [{ name: "Feint Step", mult: 0.85, crit: 0.0, dodge: 0.03, weight: 2 }, { name: "Straight Lunge", mult: 1.25, crit: 0.08, dodge: 0.0, weight: 2 }, { name: "Apex Finisher", mult: 1.55, crit: 0.16, dodge: -0.02, weight: 1 }] },
  DaidojiSchool: { name: "Daidoji School", desc: "Ancestral discipline of the sword-turned-fist.", tier: 2, dmg: 1.28, dodge: 0.12, crit: 0.08, ult: { name: "Thousand Cuts", mult: 1.45 },
    skills: [{ name: "Empty-hand Cut", mult: 0.95, crit: 0.02, dodge: 0.02, weight: 3 }, { name: "Rising Blade", mult: 1.15, crit: 0.04, dodge: 0.0, weight: 2 }, { name: "Thousand Cuts", mult: 1.3, crit: 0.08, dodge: 0.0, weight: 1 }] },
  XingYi: { name: "Xing Yi Fist", desc: "Five elements, one straight line through the enemy.", tier: 2, dmg: 1.26, dodge: 0.08, crit: 0.06, ult: { name: "Five-Point Burst", mult: 1.4 },
    skills: [{ name: "Splitting Fist", mult: 0.9, crit: 0.02, dodge: 0.0, weight: 3 }, { name: "Crushing Fist", mult: 1.15, crit: 0.04, dodge: 0.0, weight: 2 }, { name: "Drilling Fist", mult: 1.3, crit: 0.06, dodge: 0.0, weight: 2 }, { name: "Five-Point Burst", mult: 1.45, crit: 0.08, dodge: 0.0, weight: 1 }] },

  Kyokushin: { name: "Kyokushin Karate", desc: "Full-contact karate. Bones against bones.", tier: 1, dmg: 1.24, dodge: 0.06, crit: 0.04, ult: { name: "Ryuko", mult: 1.4 },
    skills: [{ name: "Kizami-zuki", mult: 0.9, crit: 0.0, dodge: 0.02, weight: 3 }, { name: "Mae-geri", mult: 1.15, crit: 0.02, dodge: 0.0, weight: 2 }, { name: "Gedan-barai", mult: 1.05, crit: 0.0, dodge: 0.03, weight: 2 }, { name: "Ryuko", mult: 1.4, crit: 0.06, dodge: 0.0, weight: 1 }] },
  Shotokan: { name: "Shotokan Karate", desc: "Long, precise, linear. Distance is a weapon.", tier: 1, dmg: 1.18, dodge: 0.10, crit: 0.04, ult: { name: "Ippon Ken", mult: 1.35 },
    skills: [{ name: "Oi-zuki", mult: 0.9, crit: 0.0, dodge: 0.02, weight: 3 }, { name: "Gyaku-zuki", mult: 1.15, crit: 0.04, dodge: 0.0, weight: 2 }, { name: "Mawashi-geri", mult: 1.1, crit: 0.02, dodge: 0.02, weight: 2 }, { name: "Ippon Ken", mult: 1.35, crit: 0.06, dodge: 0.0, weight: 1 }] },
  Taekwondo: { name: "Taekwondo", desc: "Legs like whips. Kicks from every angle.", tier: 1, dmg: 1.20, dodge: 0.16, crit: 0.06, ult: { name: "Tornado Kick", mult: 1.4 },
    skills: [{ name: "Ap Chagi", mult: 0.9, crit: 0.0, dodge: 0.02, weight: 3 }, { name: "Dollyo Chagi", mult: 1.15, crit: 0.02, dodge: 0.02, weight: 2 }, { name: "Narae Chagi", mult: 1.2, crit: 0.04, dodge: 0.0, weight: 2, status: { effect: "limb", value: "leg" } }, { name: "Tornado Kick", mult: 1.4, crit: 0.06, dodge: 0.0, weight: 1 }] },
  Wrestling: { name: "Catch Wrestling", desc: "Chain them, wear them, break them down.", tier: 1, dmg: 1.14, dodge: 0.08, crit: 0.02, ult: { name: "Submission Chain", mult: 1.45 },
    skills: [{ name: "Takedown", mult: 0.85, crit: 0.0, dodge: 0.03, weight: 3, status: { effect: "debuff", value: 0.12, rounds: 2 } }, { name: "Suplex", mult: 1.1, crit: 0.02, dodge: 0.0, weight: 2 }, { name: "Armbar", mult: 1.25, crit: 0.04, dodge: 0.0, weight: 2 }, { name: "Submission Chain", mult: 1.4, crit: 0.06, dodge: 0.0, weight: 1 }] },
  Kickboxing: { name: "Kickboxing", desc: "Balance of fists and shins. Pressure without end.", tier: 1, dmg: 1.22, dodge: 0.06, crit: 0.06, ult: { name: "Combination Storm", mult: 1.4 },
    skills: [{ name: "Jab-Cross", mult: 0.9, crit: 0.0, dodge: 0.02, weight: 3 }, { name: "Low Kick", mult: 1.05, crit: 0.02, dodge: 0.0, weight: 2 }, { name: "High Kick", mult: 1.2, crit: 0.04, dodge: 0.0, weight: 2 }, { name: "Combination Storm", mult: 1.35, crit: 0.06, dodge: 0.0, weight: 1 }] },
  KungFu: { name: "Kung Fu", desc: "Animal forms. Crane stance, tiger claw.", tier: 2, dmg: 1.20, dodge: 0.12, crit: 0.06, ult: { name: "Five Animal Play", mult: 1.35 },
    skills: [{ name: "Crane Stance", mult: 0.85, crit: 0.0, dodge: 0.04, weight: 3 }, { name: "Tiger Claw", mult: 1.15, crit: 0.04, dodge: 0.0, weight: 2 }, { name: "Snake Strike", mult: 1.05, crit: 0.08, dodge: 0.02, weight: 2, status: { effect: "poison", value: 2, rounds: 3 } }, { name: "Five Animal Play", mult: 1.3, crit: 0.06, dodge: 0.0, weight: 1 }] },
  Aikido: { name: "Aikido", desc: "Turn their force against them. Never meet it head-on.", tier: 2, dmg: 1.10, dodge: 0.24, crit: 0.06, ult: { name: "Ko no Nagare", mult: 1.4 },
    skills: [{ name: "Irimi", mult: 0.8, crit: 0.0, dodge: 0.05, weight: 3 }, { name: "Kotegaeshi", mult: 0.95, crit: 0.02, dodge: 0.03, weight: 2, status: { effect: "limb", value: "arm" } }, { name: "Shiho-nage", mult: 1.15, crit: 0.04, dodge: 0.02, weight: 2 }, { name: "Ko no Nagare", mult: 1.3, crit: 0.06, dodge: 0.04, weight: 1 }] },
  KaliArnis: { name: "Kali Arnis", desc: "Stick-and-blade flow with empty hands. Fast, circling.", tier: 2, dmg: 1.22, dodge: 0.14, crit: 0.10, ult: { name: "Redondo", mult: 1.5 },
    skills: [{ name: "Sumbrada", mult: 0.85, crit: 0.02, dodge: 0.04, weight: 3 }, { name: "Abaniko", mult: 1.1, crit: 0.06, dodge: 0.0, weight: 2 }, { name: "Redondo", mult: 1.35, crit: 0.12, dodge: 0.0, weight: 1 }] },
  IronBoxing: { name: "Iron Boxing", desc: "Every strike tempered like steel. Old-school hardness.", tier: 2, dmg: 1.26, dodge: 0.04, crit: 0.06, ult: { name: "Iron Palm", mult: 1.5 },
    skills: [{ name: "Iron Guard", mult: 0.8, crit: 0.0, dodge: 0.03, weight: 3 }, { name: "Steel Cross", mult: 1.15, crit: 0.02, dodge: 0.0, weight: 2 }, { name: "Iron Palm", mult: 1.4, crit: 0.08, dodge: -0.02, weight: 1 }] },
  MuayBoran: { name: "Muay Boran", desc: "The ancient nine weapons. Combat before the ring.", tier: 2, dmg: 1.34, dodge: 0.10, crit: 0.10, ult: { name: "Ninth Limb", mult: 1.6 },
    skills: [{ name: "Kao Loi", mult: 0.9, crit: 0.0, dodge: 0.02, weight: 3 }, { name: "Sok", mult: 1.2, crit: 0.04, dodge: 0.0, weight: 2 }, { name: "Ninth Limb", mult: 1.5, crit: 0.12, dodge: 0.0, weight: 1 }] },
  Guihun: { name: "Guihun", desc: "Demon Back. The killer instinct made manifest.", tier: 3, dmg: 1.42, dodge: 0.06, crit: 0.16, ult: { name: "Demon Back", mult: 1.9 },
    skills: [{ name: "Demon Step", mult: 1.0, crit: 0.04, dodge: 0.02, weight: 2 }, { name: "Demon Back Fist", mult: 1.35, crit: 0.12, dodge: 0.0, weight: 2, status: { effect: "buff", value: 0.15, rounds: 3 } }, { name: "Culling Blow", mult: 1.6, crit: 0.18, dodge: -0.04, weight: 1 }] },
  UltraInstinct: { name: "Ultra Instinct", desc: "Move without thought. The body answers before the mind.", tier: 3, dmg: 1.36, dodge: 0.28, crit: 0.12, ult: { name: "Autonomous Brawl", mult: 1.7 },
    skills: [{ name: "Autonomous Dodge", mult: 0.75, crit: 0.0, dodge: 0.08, weight: 3 }, { name: "Instinct Counter", mult: 1.2, crit: 0.08, dodge: 0.04, weight: 2 }, { name: "Autonomous Brawl", mult: 1.45, crit: 0.12, dodge: 0.02, weight: 1 }] },
  Formless: { name: "Formless", desc: "No fixed stance, no predictable flow. Born from the bloody crucible of the Gu Ritual.", tier: 3, dmg: 1.45, dodge: 0.25, crit: 0.15, ult: { name: "Void Stance", mult: 2.0 },
    skills: [{ name: "Fluid Dodge", mult: 0.85, crit: 0.05, dodge: 0.10, weight: 3 }, { name: "Phantom Jab", mult: 1.20, crit: 0.08, dodge: 0.04, weight: 2 }, { name: "Whip Strike", mult: 1.40, crit: 0.12, dodge: 0.02, weight: 2 }, { name: "Gu Evolution", mult: 1.70, crit: 0.20, dodge: 0.05, weight: 1 }] },
};

// ------------------------------------------------------------------ RIVALS --
export const RIVALS = [
  { id: 1, name: "Street Brawler", style: "Brawling",
    stats: { Str: 3, Tou: 2, Spd: 2, Int: 1, Cha: 1 },
    rewardMoney: 4, rewardXp: 5,
    line: "A nobody who throws wild punches. Learn the basics." },
  { id: 2, name: "Boz the Boxer", style: "Boxer",
    stats: { Str: 6, Tou: 5, Spd: 6, Int: 2, Cha: 2 },
    rewardMoney: 8, rewardXp: 10,
    line: "An old boxer who never made it big. He has something to teach." },
  { id: 3, name: "Mikazuchi Disciple", style: "Mikazuchi",
    stats: { Str: 10, Tou: 9, Spd: 10, Int: 4, Cha: 3 },
    rewardMoney: 14, rewardXp: 18,
    line: "A student of the Mikazuchi school. His guard never drops." },
  { id: 4, name: "Sledge", style: "M2Cross",
    stats: { Str: 16, Tou: 13, Spd: 9, Int: 5, Cha: 4 },
    rewardMoney: 22, rewardXp: 30,
    line: "A brawler who put everything into one punch. Avoid it." },
  { id: 5, name: "Storm Monk", style: "ThunderClap",
    stats: { Str: 22, Tou: 19, Spd: 14, Int: 12, Cha: 8 },
    rewardMoney: 36, rewardXp: 50,
    line: "A monk who turns breath into thunder." },
  { id: 6, name: "Blitz", style: "LightningFlash",
    stats: { Str: 28, Tou: 24, Spd: 30, Int: 16, Cha: 12 },
    rewardMoney: 55, rewardXp: 80,
    line: "You'll see a flash, then nothing." },
  { id: 7, name: "The Master", style: "MastersSeal",
    stats: { Str: 45, Tou: 40, Spd: 36, Int: 30, Cha: 25 },
    rewardMoney: 90, rewardXp: 130,
    line: "The one who trained them all. Become worthy." },
];

// ------------------------------------------------------------------ INSIDE --
export const INSIDE = [
  { id: 8, name: "Kru Petch", style: "MuayThai",
    stats: { Str: 55, Tou: 50, Spd: 48, Int: 35, Cha: 28 },
    bet: 50, pay: 150,
    line: "The ring champion of Bangkok. He never retired." },
  { id: 9, name: "Kage the Thrower", style: "Judo",
    stats: { Str: 62, Tou: 58, Spd: 52, Int: 42, Cha: 30 },
    bet: 80, pay: 220,
    line: "An olympic medal nobody remembers. The throws, everyone remembers." },
  { id: 10, name: "Ginga", style: "Capoeira",
    stats: { Str: 70, Tou: 60, Spd: 75, Int: 50, Cha: 40 },
    bet: 120, pay: 320,
    line: "She stopped counting opponents. Gravity filed a complaint." },
  { id: 11, name: "Yokozuna Haru", style: "Sumo",
    stats: { Str: 82, Tou: 88, Spd: 55, Int: 48, Cha: 42 },
    bet: 170, pay: 450,
    line: "The dohyo cracks. The crowd holds its breath." },
  { id: 12, name: "Kure Reiko", style: "KureStyle",
    stats: { Str: 95, Tou: 90, Spd: 85, Int: 70, Cha: 60 },
    bet: 250, pay: 650,
    line: "Beyond the Master. The clan's answer to the Sanctum." },
  { id: 13, name: "Niko Tokita", style: "NikoStyle",
    stats: { Str: 100, Tou: 92, Spd: 98, Int: 88, Cha: 66 },
    bet: 320, pay: 820,
    line: "The Four Katas lived in his body so long they became one." },
  { id: 14, name: "Raishin Adept", style: "Raishin",
    stats: { Str: 108, Tou: 95, Spd: 110, Int: 80, Cha: 60 },
    bet: 390, pay: 1000,
    line: "By the time you register the step, the fist has already spoken." },
  { id: 15, name: "The Possessed", style: "Advance",
    stats: { Str: 115, Tou: 100, Spd: 118, Int: 72, Cha: 55 },
    bet: 460, pay: 1180,
    line: "His pupils are flooded red. The heartbeat drowns out the crowd." },
  { id: 16, name: "The Iron Monk", style: "KaiwanStyle",
    stats: { Str: 120, Tou: 140, Spd: 90, Int: 74, Cha: 50 },
    bet: 540, pay: 1400,
    line: "Strike him and your knuckles learn who is harder." },
  { id: 17, name: "Mangku the Blade", style: "Silat",
    stats: { Str: 125, Tou: 105, Spd: 132, Int: 90, Cha: 62 },
    bet: 640, pay: 1660,
    line: "A knife-hand artist who treats joints like fruit rinds." },
  { id: 18, name: "The Apex", style: "PredatorHunt",
    stats: { Str: 138, Tou: 118, Spd: 128, Int: 96, Cha: 58 },
    bet: 760, pay: 2000,
    line: "He doesn't fight. He finishes. The hunt ends when he says so." },
  { id: 19, name: "Daidoji Heir", style: "DaidojiSchool",
    stats: { Str: 145, Tou: 125, Spd: 120, Int: 105, Cha: 70 },
    bet: 900, pay: 2400,
    line: "A thousand generations of the school live in his single cut." },
  { id: 20, name: "The Five-Element Sage", style: "XingYi",
    stats: { Str: 155, Tou: 135, Spd: 130, Int: 115, Cha: 78 },
    bet: 1100, pay: 3000,
    line: "Five elements, one road. His fist is the end of the road." },
  { id: 21, name: "Kyokushin Ogre", style: "Kyokushin",
    stats: { Str: 165, Tou: 158, Spd: 132, Int: 118, Cha: 80 },
    bet: 1300, pay: 3500,
    line: "He walks toward you through your own punches. Never breaking stride." },
  { id: 22, name: "Shotokan Sensei", style: "Shotokan",
    stats: { Str: 158, Tou: 145, Spd: 142, Int: 126, Cha: 84 },
    bet: 1500, pay: 4000,
    line: "Distance is his dojo. You never enter it." },
  { id: 23, name: "Taekwondo Tempest", style: "Taekwondo",
    stats: { Str: 152, Tou: 140, Spd: 168, Int: 120, Cha: 86 },
    bet: 1700, pay: 4600,
    line: "A blur of shins. By the time you block, four kicks have landed." },
  { id: 24, name: "The Grappler King", style: "Wrestling",
    stats: { Str: 172, Tou: 165, Spd: 138, Int: 122, Cha: 82 },
    bet: 1950, pay: 5300,
    line: "Once he gets a hand on you, the only exit is submission." },
  { id: 25, name: "Kickbox Sovereign", style: "Kickboxing",
    stats: { Str: 168, Tou: 155, Spd: 150, Int: 125, Cha: 88 },
    bet: 2200, pay: 6000,
    line: "Relentless pressure. Each exchange chips at your confidence." },
  { id: 26, name: "The Animal Fist", style: "KungFu",
    stats: { Str: 162, Tou: 150, Spd: 158, Int: 135, Cha: 90 },
    bet: 2500, pay: 6800,
    line: "Five animals live in his stance. You'll meet them one by one." },
  { id: 27, name: "The Flowing Master", style: "Aikido",
    stats: { Str: 145, Tou: 148, Spd: 162, Int: 150, Cha: 92 },
    bet: 2800, pay: 7600,
    line: "The harder you swing, the quicker you learn the circle." },
  { id: 28, name: "Arnis Blademaster", style: "KaliArnis",
    stats: { Str: 160, Tou: 142, Spd: 172, Int: 138, Cha: 88 },
    bet: 3150, pay: 8600,
    line: "His hands are sheathed blades. Redondo, then red." },
  { id: 29, name: "The Iron Palm Priest", style: "IronBoxing",
    stats: { Str: 178, Tou: 175, Spd: 145, Int: 130, Cha: 85 },
    bet: 3500, pay: 9600,
    line: "Tempered in the old foundry. His palm is the anvil." },
  { id: 30, name: "The Nine-Weapon Ancestor", style: "MuayBoran",
    stats: { Str: 185, Tou: 170, Spd: 160, Int: 140, Cha: 90 },
    bet: 4000, pay: 11000,
    line: "Nine weapons, no ring, no rules. Only the ancient truth." },
  { id: 31, name: "The Demon-Backed", style: "Guihun",
    stats: { Str: 205, Tou: 185, Spd: 170, Int: 145, Cha: 88 },
    bet: 4800, pay: 13500,
    line: "The demon back flares. Nothing human looks at you from those eyes." },
  { id: 32, name: "The Still Point", style: "UltraInstinct",
    stats: { Str: 210, Tou: 190, Spd: 210, Int: 160, Cha: 95 },
    bet: 6000, pay: 18000,
    line: "He doesn't react. He is already where the blow isn't." },
];

// ------------------------------------------------------------------ LOCATION RIVALS --
export const LOC_RIVAL_TIERS = {
  1: { mult: 1.0, base: 1 },
  2: { mult: 1.6, base: 5 },
  3: { mult: 2.6, base: 10 },
  4: { mult: 4.0, base: 18 },
};

export function locationRivals(locKey) {
  const loc = LOCATIONS[locKey];
  if (!loc || !loc.styleGym) return [];
  const tier = loc.tier || 1;
  const cfg = LOC_RIVAL_TIERS[tier] || LOC_RIVAL_TIERS[1];
  const baseRival = RIVALS[Math.min(cfg.base, RIVALS.length - 1)];
  const fighters = [];
  for (let k = 1; k <= 5; k++) {
    const esc = 0.7 + k * 0.18;
    const stats = {};
    for (const attr of ["Str", "Tou", "Spd", "Int", "Cha"]) {
      stats[attr] = Math.max(1, Math.floor(baseRival.stats[attr] * cfg.mult * esc));
    }
    const rewardMoney = Math.max(1, Math.round(baseRival.rewardMoney * cfg.mult * (0.8 + k * 0.1)));
    const rewardXp = Math.max(1, Math.round(baseRival.rewardXp * cfg.mult * (0.8 + k * 0.1)));
    fighters.push({
      n: k,
      name: `${loc.name} Fighter ${k}`,
      style: loc.styleGym,
      stats,
      rewardMoney,
      rewardXp,
      line: `A ${tier >= 3 ? "legendary" : tier >= 2 ? "skilled" : "tough"} fighter training at ${loc.name}.`,
    });
  }
  return fighters;
}

export const MAX_RIVAL = RIVALS.length;
export const MAX_INSIDE = INSIDE.length;
export const MAX_TOTAL = MAX_RIVAL + MAX_INSIDE;

// ------------------------------------------------------------------ RANKS --
export const RANKS = [
  { name: "F-", min: 0, max: 25, reward: 2 },
  { name: "F", min: 26, max: 50, reward: 2 },
  { name: "F+", min: 51, max: 75, reward: 2 },
  { name: "E-", min: 76, max: 125, reward: 4 },
  { name: "E", min: 126, max: 175, reward: 2 },
  { name: "E+", min: 176, max: 225, reward: 2 },
  { name: "D-", min: 226, max: 325, reward: 4 },
  { name: "D", min: 326, max: 425, reward: 2 },
  { name: "D+", min: 426, max: 525, reward: 2 },
  { name: "C-", min: 526, max: 725, reward: 4 },
  { name: "C", min: 726, max: 925, reward: 2 },
  { name: "C+", min: 926, max: 1125, reward: 2 },
  { name: "B-", min: 1126, max: 1425, reward: 4 },
  { name: "B", min: 1426, max: 1725, reward: 2 },
  { name: "B+", min: 1726, max: 2025, reward: 2 },
  { name: "A-", min: 2026, max: 2750, reward: 4 },
  { name: "A", min: 2751, max: 3475, reward: 2 },
  { name: "A+", min: 3476, max: 4200, reward: 2 },
  { name: "S-", min: 4201, max: 5200, reward: 20 },
  { name: "S", min: 5201, max: 6200, reward: 10 },
  { name: "S+", min: 6201, max: 7200, reward: 10 },
  { name: "SS-", min: 7201, max: 8700, reward: 20 },
  { name: "SS", min: 8701, max: 10000, reward: 10 },
  { name: "SS+", min: 10001, max: 12500, reward: 10 },
  { name: "SSS-", min: 12501, max: 15000, reward: 20 },
  { name: "SSS", min: 15001, max: 17500, reward: 10 },
  { name: "SSS+", min: 17501, max: 20000, reward: 10 },
  { name: "X-", min: 20001, max: 24000, reward: 70 },
  { name: "X", min: 24001, max: 28000, reward: 35 },
  { name: "X+", min: 28001, max: 32000, reward: 35 },
  { name: "XX-", min: 32001, max: 38000, reward: 120 },
  { name: "XX", min: 38001, max: 44000, reward: 60 },
  { name: "XX+", min: 44001, max: 50000, reward: 60 },
  { name: "XXX-", min: 50001, max: 60000, reward: 160 },
  { name: "XXX", min: 60001, max: 70000, reward: 85 },
  { name: "XXX+", min: 70001, max: 80000, reward: 85 },
  { name: "Z-", min: 80001, max: 95000, reward: 350 },
  { name: "Z", min: 95001, max: 110000, reward: 175 },
  { name: "Z+", min: 110001, max: 125000, reward: 175 },
  { name: "ZZ-", min: 125001, max: 145000, reward: 525 },
  { name: "ZZ", min: 145001, max: 165000, reward: 265 },
  { name: "ZZ+", min: 165001, max: 185000, reward: 265 },
  { name: "ZZZ-", min: 185001, max: 210000, reward: 790 },
  { name: "ZZZ", min: 210001, max: 235000, reward: 395 },
  { name: "ZZZ+", min: 235001, max: 265000, reward: 395 },
  { name: "UR-", min: 265001, max: 295000, reward: 850 },
  { name: "UR", min: 295001, max: 325000, reward: 425 },
  { name: "UR+", min: 325001, max: 360000, reward: 425 },
  { name: "LR-", min: 360001, max: 395000, reward: 1000 },
  { name: "LR", min: 395001, max: 430000, reward: 500 },
  { name: "LR+", min: 430001, max: 470000, reward: 500 },
  { name: "MR-", min: 470001, max: 510000, reward: 1150 },
  { name: "MR", min: 510001, max: 550000, reward: 575 },
  { name: "MR+", min: 550001, max: 595000, reward: 575 },
  { name: "EX-", min: 595001, max: 650000, reward: 1300 },
  { name: "EX", min: 650001, max: 695000, reward: 650 },
  { name: "EX+", min: 695001, max: 745000, reward: 650 },
  { name: "DX-", min: 745001, max: 795000, reward: 1500 },
  { name: "DX", min: 795001, max: 845000, reward: 750 },
  { name: "DX+", min: 845001, max: 900000, reward: 750 },
  { name: "?", min: 900001, max: 1250000, reward: 1200 },
  { name: "??", min: 1250001, max: 1750000, reward: 2400 },
  { name: "???", min: 1750001, max: 999999999, reward: 4800 },
];

// ------------------------------------------------------------------ IMAGINED NPCS --
export const IMAGINED_NPCS = [
  { key: "ogre", name: "The Ogre's Shadow", style: "Brawling", mult: 0.90, line: "A colossus of pure violence, imagined in the dark." },
  { key: "demonback", name: "The Demon Back", style: "Guihun", mult: 1.05, line: "You can almost see the muscles crawling under its skin." },
  { key: "asura", name: "The Asura", style: "KureStyle", mult: 1.00, line: "Six arms of legend. Your mind gives it claws." },
  { key: "boxghost", name: "The Boxing Ghost", style: "Boxer", mult: 0.80, line: "An old champion, long dead, still shadowboxing." },
  { key: "boran", name: "The Muay Boran Elder", style: "MuayBoran", mult: 0.95, line: "Nine weapons, no ring, no mercy." },
  { key: "twin", name: "The Silent Twin", style: "NikoStyle", mult: 0.85, line: "A shape that mirrors your stance, then improves it." },
  { key: "demonsfist", name: "The Demon's Fist", style: "M2Cross", mult: 0.75, line: "One imagined punch that could end it all." },
  { key: "blade", name: "The Blade Saint", style: "DaidojiSchool", mult: 0.88, line: "A thousand cuts you never see drawn." },
  { key: "storm", name: "The Storm", style: "ThunderClap", mult: 0.82, line: "Breath, thunder, nothing in between." },
  { key: "stillgod", name: "The Still God", style: "UltraInstinct", mult: 1.10, line: "It is already where the blow is not." },
];

// ------------------------------------------------------------------ ENCOUNTER NAMES --
export const ENCOUNTER_NAMES = ["Street Fighter", "Drifter", "Bouncer", "Thug", "Rival in the Crowd"];

export const GYM_TRAINING = [
  { key: "Pushups",       name: "Pushups (Str)",        cost: 10, unlock: "permanent" },
  { key: "Situps",        name: "Situps (Tou)",         cost: 10, unlock: "permanent" },
  { key: "Squats",        name: "Squats (Spd)",         cost: 15, unlock: "permanent" },
  { key: "ShadowBoxing",  name: "Shadow Boxing (Int)",  cost: 20, unlock: "permanent",
    requires: "mat", requiresName: "Old Training Mat" },
  { key: "HeavyBag",      name: "Heavy Bag (Str)",      cost: 25, unlock: "permanent",
    home: true },
  { key: "Roadworks",     name: "Roadworks (Spd)",      cost: 8,  unlock: "consumable",
    uses: 10, desc: "One Roadworks session pack. Grants +8 Spd gain per use." },
];

export const EQUIPMENT = [
  { key: "training_weights", name: "Training Weights", slot: "body",
    desc: "+50% to all training gains.", cost: 30, buffMult: 1.5 },
  { key: "weighted_vest", name: "Weighted Vest", slot: "body",
    desc: "+30% training gains.", cost: 40, buffMult: 1.3 },
  { key: "ankle_weights", name: "Ankle Weights", slot: "legs",
    desc: "+40% Speed training gains.", cost: 25, buffMult: 1.4, attrs: ["Spd"] },
  { key: "breathing_mask", name: "Breathing Mask", slot: "head",
    desc: "+20% all training gains.", cost: 35, buffMult: 1.2 },
];
export const MAIN_GYM = "spar";

// ------------------------------------------------------------------ ROAMERS --
// Free-roaming encounter nodes on the city map.
// Each node triggers a chained street fight sequence.
export const ROAMERS = [
  { key: "r_thug", name: "Back Alley Slums", district: "west", zone: "w-bottom", style: "Brawling", mult: 0.75, reward: 8 },
  { key: "r_bridge", name: "Grand River Bridge", district: "west", zone: "bridge", style: "MuayThai", mult: 0.90, reward: 12 },
  { key: "r_monk", name: "Eastern Temple Grounds", district: "east", zone: "e-top", style: "KungFu", mult: 1.05, reward: 16 },
  { key: "r_brute", name: "Industrial Pits", district: "east", zone: "e-bottom2", style: "M2Cross", mult: 1.20, reward: 22 },
];
