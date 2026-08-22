// js/data.js — ALL game data tables.
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
export const STYLEXP_TRAIN = 0.2;
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
export const GAME_VERSION = 2.18;
export const UPDATE_LOG = [
  { v: 2.18, text: "• Fixed PC PANEL closing so it slides the left panel away without reflowing the map.\n• Preserved the map grid column and prevented map-corner collapse after panel or map clicks." },
  { v: 2.17, text: "• Rebuilt map routing as a shortest-path road graph with no diagonal segments or immediate backtracks.\n• Mobile layout now stacks the right column below the map instead of beside it.\n• PANEL is available on PC and mobile; opening it locks page scrolling.\n• Outside clicks dismiss mobile popups and overlays.\n• News now stays below the header.\n• Live Job Board updates preserve DOM nodes to prevent hover flicker.\n• Locations regenerate 10% max Stamina per second.\n• Auto-job stops immediately when Stamina reaches zero and shows turns remaining." },
  { v: 2.16, text: "• Restored trainer purchase requirements for basic techniques.\n• Learned techniques can be queued and used from Home or any task-board location.\n• Advanced training names and multipliers are earned through training XP.\n• Added hover details showing current training tier XP and the next technique requirement." },
  { v: 2.15, text: "• Redirected all legacy gym-store calls into the actual gym overlay.\n• Training Gear now displays the dedicated gym item directly.\n• Purchased one-time gym gear disappears from the shop.\n• Prevented duplicate purchases of dedicated gym gear." },
  { v: 2.14, text: "• Fixed gym Training Gear tabs opening the stale store UI.\n• Added one unique, persistent gear purchase to each combat gym.\n• Removed old gym training/rest panels; gyms now focus on trainers, modes, and gear.\n• Task boards can now be used from any location without returning home.\n• Task-board AUTO now repeats continuously until stopped, depleted, or interrupted by combat/death." },
  { v: 2.13, text: "• Removed the Attributes Aptitude purchase buttons.\n• Removed the empty next-rank header placeholder.\n• Smoothed movement sampling from 150ms to 50ms.\n• Made combat start from and write back to the authoritative Vitals HP/Stamina.\n• Added a real-time UI pulse for money, auto-job timers, open panels, and stats." },
  { v: 2.12, text: "• Fixed the route line so it only draws forward from the active segment.\n• Home tasks now persist and rotate until removed with the red X.\n• Removed Home Activities and Home Style panels.\n• Added horizontal location tabs.\n• Gyms now show Trainers and Training Gear tabs.\n• Added trainer programs and special-mode requirement rows.\n• Added explicit Return Home control.\n• Prevented unrelated panels from appearing in random fighter rosters." },
  { v: 2.11, text: "• Fixed Home Pushups and Situps training availability.\n• Added a visible Return Home button to location panels.\n• Removed cooking and Home task panels from random fighter rosters.\n• Enforced one visible UI overlay at a time.\n• Replaced road tie-breaking with shortest street-pair routing to remove unnecessary detours." },
  { v: "2.10", text: "• Added a mobile PANEL drawer that slides in from the left.\n• The map now keeps the full mobile viewport instead of sharing space with the stats column.\n• Added a dimmed backdrop and close-state button for the drawer.\n• Desktop layout remains unchanged." },
  { v: 2.8, text: "• Removed task Repeat and Advance Day controls.\n• Home task queues now persist, rotate, and remain farmable until removed with the red X.\n• Added live stat previews while training at Home.\n• Stopped task-outside-Home news spam and paused task auto-run when leaving Home.\n• Added timer hover details for routes, roamers, and auto-jobs.\n• Auto-job now runs every 2 seconds, with a 2–5 minute level-scaled leave-area grace period.\n• Corrected route segment snapping and rebuilt box positions away from road corridors.\n• Added two local UI style sketches." },
  { v: 2.6, text: "• Boxed every location, including Home, starter locations, stores, gyms, and Arena.\n• Moved Arena to the far-right wall.\n• Added Inventory Equipment tab.\n• Combat is automatic; Speed controls hit cadence; Intelligence controls crit chance.\n• Failed escape resumes combat." },
  { v: 2.5, text: "• Moved task management to Home.\n• Added randomized reincarnation entrances.\n• Added Scrounge for Cash, food stacks, auto-eating, percentage recovery, and Charisma pricing." },
  { v: 2.4, text: "• Moved tasks into the Home base.\n• Added Scrounge for Cash and rare Hobo encounter.\n• Added food stacks, percentage recovery, Charisma pricing, auto Ultimates, and gym progression." },
  { v: 2.3, text: "• Fixed route timing, rerouting, map rosters, gym combat, Arena placement, TP, escape, News, Aptitudes, and ADMIN testing." },
  { v: 2.2, text: "• Added fast travel, route ETA, optional street encounters, tiered opponents, central locations, and floating News." },
  { v: 2.1, text: "• Reworked jobs, style mastery, combat rounds, map travel, persistent tasks, auto-run, statistics, and mobile layout." },
  { v: 2.0, text: "• Added decimal cash, auto-work, City Gym, tasklists, city travel, job progression, and training programs." },
  { v: 1.01, text: "• Added training ladders, inventory, status effects, style tiers, locked gyms, money, and zero-stat starts." },
  { v: 1.0, text: "• Launch: train, fight rivals, learn styles, and reincarnate." },
];
export function versionCompare(a, b) {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}
export const MAX_GHOSTS = 50;
export const ROAMER_COOLDOWN_MS = 3 * 60 * 1000;
export const COOLDOWN_LOSS_MULT = 0.1;

// Status effect descriptions for the Statistics menu.
export const STATUS_EFFECT_INFO = {
  poison: { name: "Poison", desc: "Deals damage over time each round while active." },
  buff: { name: "Offense Up", desc: "Raises your own damage while active." },
  debuff: { name: "Defense Down", desc: "Lowers the target's defense, so they take more damage." },
  limbArm: { name: "Damaged Arm", desc: "Permanently cuts the target's damage for the fight." },
  limbLeg: { name: "Damaged Leg", desc: "Permanently slows the target, so they act later." },
};

// ------------------------------------------------------------------ JOBS --
export const JOBS = [
  {
    key: "delivery",
    name: "Delivery Run",
    desc: "Drop off packages to the right doors. Tap the matching house before the timer expires.",
    staminaCost: 5,
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
    staminaCost: 5,
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
    staminaCost: 5,
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
  return Math.max(1, 5 - Math.floor(level / 4));
}
export const JOB_BASE_RATE = 0.25;
export const JOB_MAX_RATE = 1.0;
export const JOB_COMBO_TARGET = 25;
export function jobActionRate(combo) {
  const t = Math.min(JOB_COMBO_TARGET, Math.max(0, combo));
  return JOB_BASE_RATE + (JOB_MAX_RATE - JOB_BASE_RATE) * (t / JOB_COMBO_TARGET);
}
export function jobXpForLevel(job, level) {
  return Math.round(job.xpToLevel * Math.pow(1.5, level - 1));
}
export const JOB_AUTO_RATE = 0.5;
export const JOB_AUTO_COOLDOWN_MS = 2 * 1000;

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
  OddJobs: { name: "Scrounge for Cash", cost: 10, moneyBase: 3, moneyCha: 0.5 },
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

// Display order for the activities grid.
export const ACTIVITY_LIST = [
  { key: "Rest", label: "Rest" },
  { key: "OddJobs", label: "Scrounge for Cash" },
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
  { key: "rice", name: "Rice bowl", desc: "Restores 20% Nutrition", price: 5, nutritionPct: 0.20, cat: "food" },
  { key: "protein", name: "Protein shake", desc: "+5 Strength for this life", price: 15, stat: "Str", amount: 5, cat: "drinks" },
  { key: "energy", name: "Energy drink", desc: "+5 Speed for this life", price: 15, stat: "Spd", amount: 5, cat: "drinks" },
  { key: "focus", name: "Focus tea", desc: "+5 Intelligence for this life", price: 15, stat: "Int", amount: 5, cat: "drinks" },
  { key: "heart", name: "Heart tonic", desc: "+5 Toughness for this life", price: 20, stat: "Tou", amount: 5, cat: "drinks" },
  { key: "charm", name: "Charm perfume", desc: "+5 Charisma for this life", price: 20, stat: "Cha", amount: 5, cat: "drinks" },
  { key: "rawmeat", name: "Raw Meat", desc: "Cook at home for Grilled Meat", price: 4, raw: true, cookTo: "grilledmeat", cat: "rawfood" },
  { key: "rawchicken", name: "Raw Chicken", desc: "Cook at home for Fried Chicken", price: 5, raw: true, cookTo: "chicken", cat: "rawfood" },
  { key: "rawcarrot", name: "Raw Carrot", desc: "Cook at home", price: 2, raw: true, cat: "rawfood" },
  { key: "rawpotato", name: "Raw Potato", desc: "Cook at home", price: 2, raw: true, cat: "rawfood" },
  { key: "rawrice", name: "Raw Rice", desc: "Cook at home", price: 2, raw: true, cat: "rawfood" },
  { key: "hotdog", name: "Hot Dog", desc: "Restores 25% Nutrition", price: 6, nutritionPct: 0.25, cat: "food" },
  { key: "pizza", name: "Pizza Slice", desc: "Restores 40% Nutrition", price: 8, nutritionPct: 0.40, cat: "food" },
  { key: "chicken", name: "Fried Chicken", desc: "Restores 35% Nutrition", price: 7, nutritionPct: 0.35, cat: "food" },
  { key: "tacos", name: "Tacos", desc: "Restores 45% Nutrition", price: 9, nutritionPct: 0.45, cat: "food" },
  { key: "grilledmeat", name: "Grilled Meat", desc: "Restores 50% Nutrition", price: 0, nutritionPct: 0.50, notSold: true, cat: "food" },
  { key: "mat", name: "Old Training Mat", desc: "Required for Shadow Boxing training", price: 15, permanent: true, cat: "gear" },
];

// Clinic: cheap medical/healing items.
export const CLINIC_ITEMS = [
  { key: "bandages", name: "Bandages", desc: "Restore 25% Health", price: 8, healthPct: 0.25, cat: "clinic" },
  { key: "medkit", name: "Medkit", desc: "Restore 50% Health", price: 20, healthPct: 0.50, cat: "clinic" },
  { key: "fullrecovery", name: "Full recovery", desc: "Restore 100% Health + 50% Stamina", price: 40, healthPct: 1, staminaPct: 0.50, cat: "clinic" },
  { key: "checkup", name: "Checkup", desc: "+2 Toughness for this life", price: 25, stat: "Tou", amount: 2, cat: "clinic" },
];

// ------------------------------------------------------------------ LOCATIONS --
export const LOCATIONS = {
  home: { name: "Home", unlock: 0, tier: 0, styleGym: null },
  gym: { name: "City Gym", unlock: 0, tier: 1, styleGym: null },
  spar: { name: "Iron Spar Gym", unlock: 0, tier: 1, styleGym: "Boxer" },
  wat: { name: "Wat Chai Gym", unlock: 0, tier: 1, styleGym: "MuayThai" },
  tatami: { name: "Tatami Hall", unlock: 0, tier: 1, styleGym: "Judo" },
  roda: { name: "Roda Circle", unlock: 0, tier: 1, styleGym: "Capoeira" },
  dohyo: { name: "Dohyo Ring", unlock: 0, tier: 1, styleGym: "Sumo" },
  foundry: { name: "The Foundry", unlock: 0, tier: 1, styleGym: "IronBoxing" },
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
  { key: "gym", label: "City Gym", desc: "A clean gym with weights and training gear." },
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
  // tier 1 — gym: basic trainings (cheaper than style gyms)
  gym:   { Pushups: { cost: 2, gain: 1.0 }, Situps: { cost: 2, gain: 1.0 }, Squats: { cost: 3, gain: 1.0 }, ShadowBoxing: { cost: 3, gain: 1.0 }, Roadworks: { cost: 2, gain: 1.0 } },
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
  { id: 4, name: "Sledge", style: "IronBoxing",
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

// Randomized stat bands per tier (tier 1 = lower class, 2 = middle, 3 = highest).
export const TIER_BASE = {
  1: { Str: 6, Tou: 5, Spd: 5, Int: 3, Cha: 1 },
  2: { Str: 22, Tou: 18, Spd: 20, Int: 13, Cha: 6 },
  3: { Str: 55, Tou: 46, Spd: 50, Int: 35, Cha: 16 },
};
export const TIER_SPREAD = { 1: 0.4, 2: 0.35, 3: 0.3 };

// Equation: stats randomize within a tier band, scaled by tier mult and slot.
export function randomTierStats(tier, slot, rng) {
  const t = tier >= 4 ? 3 : tier;
  const base = TIER_BASE[t] || TIER_BASE[1];
  const spread = TIER_SPREAD[t] || TIER_SPREAD[1];
  const r = rng || Math.random;
  const cfg = LOC_RIVAL_TIERS[t] || LOC_RIVAL_TIERS[1];
  const esc = 0.7 + (slot || 1) * 0.18;
  const stats = {};
  for (const attr of ["Str", "Tou", "Spd", "Int", "Cha"]) {
    const roll = 1 + (r() * 2 - 1) * spread;
    stats[attr] = Math.max(1, Math.floor(base[attr] * cfg.mult * esc * roll));
  }
  return stats;
}

export function locationRivals(locKey) {
  const loc = LOCATIONS[locKey];
  if (!loc || !loc.styleGym) return [];
  const tier = loc.tier || 1;
  const cfg = LOC_RIVAL_TIERS[tier] || LOC_RIVAL_TIERS[1];
  const baseRival = RIVALS[Math.min(cfg.base, RIVALS.length - 1)];
  const fighters = [];
  for (let k = 1; k <= 5; k++) {
    const esc = 0.7 + k * 0.18;
    const stats = randomTierStats(tier, k);
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
  { key: "demonsfist", name: "The Demon's Fist", style: "IronBoxing", mult: 0.75, line: "One imagined punch that could end it all." },
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

export const GYM_GEAR = {
  gym:      { key: "city_power_rack", name: "City Power Rack", desc: "+12% Strength and Toughness task gains.", cost: 75, attrs: ["Str", "Tou"], buffMult: 1.12 },
  spar:     { key: "iron_impact_bag", name: "Iron Impact Bag", desc: "+16% Strength task gains.", cost: 110, attrs: ["Str"], buffMult: 1.16 },
  wat:      { key: "muay_thai_lime", name: "Lime Conditioning Rig", desc: "+16% Toughness task gains.", cost: 110, attrs: ["Tou"], buffMult: 1.16 },
  tatami:   { key: "tatami_frame", name: "Reinforced Tatami Frame", desc: "+16% all task gains.", cost: 125, attrs: ["Str", "Tou", "Spd", "Int", "Cha"], buffMult: 1.16 },
  roda:     { key: "roda_spring_floor", name: "Spring Roda Floor", desc: "+18% Speed task gains.", cost: 140, attrs: ["Spd"], buffMult: 1.18 },
  dohyo:    { key: "dohyo_sand_bale", name: "Dohyo Sand Bale", desc: "+20% Toughness task gains.", cost: 160, attrs: ["Tou"], buffMult: 1.20 },
  foundry:  { key: "foundry_press", name: "Foundry Press", desc: "+22% Strength task gains.", cost: 185, attrs: ["Str"], buffMult: 1.22 },
  oldhouse: { key: "oldhouse_mat", name: "Old House Conditioning Mat", desc: "+18% all task gains.", cost: 150, attrs: ["Str", "Tou", "Spd", "Int", "Cha"], buffMult: 1.18 },
  mikazuki: { key: "mikazuki_pulse_frame", name: "Pulse Frame", desc: "+24% Speed task gains.", cost: 240, attrs: ["Spd"], buffMult: 1.24 },
  stormpg:  { key: "storm_conductors", name: "Storm Conductors", desc: "+24% Intelligence task gains.", cost: 260, attrs: ["Int"], buffMult: 1.24 },
  lightning:{ key: "lightning_reaction_wall", name: "Reaction Wall", desc: "+26% Speed task gains.", cost: 280, attrs: ["Spd"], buffMult: 1.26 },
  sanctum:  { key: "sanctum_seal_rig", name: "Sealed Master Rig", desc: "+28% all task gains.", cost: 360, attrs: ["Str", "Tou", "Spd", "Int", "Cha"], buffMult: 1.28 },
  estate:   { key: "kure_gravity_frame", name: "Kure Gravity Frame", desc: "+30% Strength task gains.", cost: 480, attrs: ["Str"], buffMult: 1.30 },
  niko:     { key: "niko_breathing_frame", name: "Niko Breathing Frame", desc: "+28% Intelligence task gains.", cost: 400, attrs: ["Int"], buffMult: 1.28 },
  raishin:  { key: "raishin_thunder_post", name: "Thunder Post", desc: "+30% Speed task gains.", cost: 520, attrs: ["Spd"], buffMult: 1.30 },
  spirit:   { key: "blood_dojo_chain", name: "Blood Dojo Chain", desc: "+30% Toughness task gains.", cost: 520, attrs: ["Tou"], buffMult: 1.30 },
  kaiwan:   { key: "kaiwan_iron_frame", name: "Kaiwan Iron Frame", desc: "+30% Strength task gains.", cost: 520, attrs: ["Str"], buffMult: 1.30 },
  silat:    { key: "silat_balance_beam", name: "Balance Beam", desc: "+30% Speed task gains.", cost: 520, attrs: ["Spd"], buffMult: 1.30 },
  hunt:     { key: "hunt_tracking_course", name: "Tracking Course", desc: "+30% Intelligence task gains.", cost: 520, attrs: ["Int"], buffMult: 1.30 },
};

export const EQUIPMENT = [
  { key: "training_weights", name: "Training Weights", slot: "body",
    desc: "+50% to all training gains.", cost: 30, buffMult: 1.5, cat: "gear" },
  { key: "weighted_vest", name: "Weighted Vest", slot: "body",
    desc: "+30% training gains.", cost: 40, buffMult: 1.3, cat: "gear" },
  { key: "ankle_weights", name: "Ankle Weights", slot: "legs",
    desc: "+40% Speed training gains.", cost: 25, buffMult: 1.4, attrs: ["Spd"], cat: "gear" },
  { key: "breathing_mask", name: "Breathing Mask", slot: "head",
    desc: "+20% all training gains.", cost: 35, buffMult: 1.2, cat: "gear" },
];
export const MAIN_GYM = "gym";

// ------------------------------------------------------------------ MOVEMENT --
export const MOVE_ENC_CHANCE = 0.02;
export const MOVE_BASE_SPEED = 32;   // map units per second at Speed 0 (farthest ~800u ≈ 25s)

// Road network constants for pathfinding.
const H_ROADS = [120, 300, 480];
const V_ROADS_WEST = [150, 310];
const V_ROADS_EAST = [640, 760, 880];
const RIVER_LEFT = 460;
const RIVER_RIGHT = 540;
const BRIDGE_X = 500;
const BRIDGE_Y = 300;

function nearestIn(arr, val) {
  let best = arr[0], bestD = Math.abs(val - arr[0]);
  for (let i = 1; i < arr.length; i++) {
    const d = Math.abs(val - arr[i]);
    if (d < bestD) { best = arr[i]; bestD = d; }
  }
  return best;
}

function nearestVRoad(x) {
  return x <= RIVER_LEFT
    ? nearestIn(V_ROADS_WEST, x)
    : nearestIn(V_ROADS_EAST, x);
}

function side(x) {
  return x <= RIVER_LEFT ? "west" : x >= RIVER_RIGHT ? "east" : "bridge";
}

// Compute a shortest orthogonal route over the actual road network.
export function computeRoute(sx, sy, tx, ty) {
  const clean = (points) => points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  const key = (x, y) => `${x},${y}`;
  const nodes = new Map();
  const edges = new Map();
  const addNode = (x, y) => { const k = key(x, y); if (!nodes.has(k)) { nodes.set(k, [x, y]); edges.set(k, []); } return k; };
  const addEdge = (a, b) => { const ka = addNode(a[0], a[1]), kb = addNode(b[0], b[1]); const d = Math.hypot(a[0] - b[0], a[1] - b[1]); edges.get(ka).push({ to: kb, d }); edges.get(kb).push({ to: ka, d }); };
  const horizontal = (y, xs) => { for (let i = 0; i < xs.length - 1; i++) addEdge([xs[i], y], [xs[i + 1], y]); };
  const vertical = (x, ys) => { for (let i = 0; i < ys.length - 1; i++) addEdge([x, ys[i]], [x, ys[i + 1]]); };
  const ys = [0, 120, 300, 480, 720];
  for (const x of [150, 310, 640, 760, 880]) vertical(x, ys);
  for (const y of [120, 300, 480]) { horizontal(y, [0, 150, 310, 460]); horizontal(y, [540, 640, 760, 880, 1000]); }
  horizontal(300, [460, 500, 540]);
  vertical(500, [300, 480, 720, 790]);

  const dijkstra = (start) => {
    const dist = new Map(), prev = new Map(), open = new Set(edges.keys());
    for (const k of open) dist.set(k, Infinity);
    dist.set(start, 0);
    while (open.size) {
      let current = null, best = Infinity;
      for (const k of open) if ((dist.get(k) || Infinity) < best) { best = dist.get(k); current = k; }
      if (current === null) break;
      open.delete(current);
      for (const e of edges.get(current) || []) {
        if (!open.has(e.to)) continue;
        const nd = best + e.d;
        if (nd < (dist.get(e.to) || Infinity)) { dist.set(e.to, nd); prev.set(e.to, current); }
      }
    }
    return { dist, prev };
  };
  if (sx === tx || sy === ty) return clean([[sx, sy], [tx, ty]]);
  const access = (p, node) => {
    const [x, y] = node;
    const out = [];
    if ([120, 300, 480].includes(y)) out.push({ d: Math.abs(p[0] - x) + Math.abs(p[1] - y), path: [[p[0], p[1]], [p[0], y], [x, y]] });
    out.push({ d: Math.abs(p[0] - x) + Math.abs(p[1] - y), path: [[p[0], p[1]], [x, p[1]], [x, y]] });
    return out;
  };
  const turns = (path) => path.reduce((n, p, i) => i > 1 && (p[0] - path[i - 1][0]) * (path[i - 1][0] - path[i - 2][0]) + (p[1] - path[i - 1][1]) * (path[i - 1][1] - path[i - 2][1]) === 0 ? n + 1 : n, 0);
  const backtracks = (path) => path.reduce((n, p, i) => i > 1 && p[0] === path[i - 2][0] && p[1] === path[i - 2][1] ? n + 1 : n, 0);
  const all = [...nodes.entries()];
  let best = null;
  for (const [sk, sn] of all) {
    const search = dijkstra(sk);
    for (const [tk, tn] of all) {
      const graphDistance = search.dist.get(tk);
      if (!Number.isFinite(graphDistance)) continue;
      const graph = [];
      let cur = tk;
      while (cur) { graph.unshift(nodes.get(cur)); cur = search.prev.get(cur); }
      for (const startAccess of access([sx, sy], sn)) for (const targetAccess of access([tx, ty], tn)) {
        const path = clean([...startAccess.path, ...graph.slice(1), ...targetAccess.path.slice(0, -1).reverse(), [tx, ty]]);
        const score = startAccess.d + graphDistance + targetAccess.d + backtracks(path) * 100000 + turns(path) * 0.001;
        if (!best || score < best.score) best = { score, path };
      }
    }
  }
  if (!best) return clean([[sx, sy], [tx, sy], [tx, ty]]);
  return clean(best.path);
}

// Building centers (in the 1000×850 map space).
export const MAP_POS = {
  home: [75, 60], gym: [230, 60], spar: [380, 60], wat: [590, 60], tatami: [700, 60], roda: [820, 60], dohyo: [940, 60],
  foundry: [75, 210], mikazuki: [230, 210], stormpg: [380, 210], lightning: [590, 210], sanctum: [700, 210], estate: [820, 210], clinic: [940, 210],
  cstore: [75, 390], jobboard: [230, 390], oldhouse: [380, 390], niko: [590, 390], raishin: [700, 390], spirit: [820, 390], kaiwan: [940, 390],
  silat: [75, 600], hunt: [230, 600], sword: [380, 600], xiyi: [590, 600], kyoku: [700, 600], shotokan: [820, 600], taekwon: [940, 600],
  wrestling: [75, 680], kickbox: [230, 680], kungfu: [380, 680], aikido: [590, 680], kali: [700, 680], ironbox: [820, 680], boran: [940, 680],
  guihun: [75, 540], ultra: [230, 540], arena: [965, 540],
  inside: [500, 790],
};

// ------------------------------------------------------------------ ROAMERS --
// Free-roaming encounter nodes on the city map.
// Each node triggers a chained street fight sequence.
export const ROAMERS = [
  { key: "r_thug", name: "Back Alley Slums", district: "west", zone: "w-bottom", style: "Brawling", mult: 0.75, reward: 8 },
  { key: "r_bridge", name: "Grand River Bridge", district: "west", zone: "bridge", style: "MuayThai", mult: 0.90, reward: 12 },
  { key: "r_monk", name: "Eastern Temple Grounds", district: "east", zone: "e-top", style: "KungFu", mult: 1.05, reward: 16 },
  { key: "r_brute", name: "Industrial Pits", district: "east", zone: "e-bottom2", style: "IronBoxing", mult: 1.20, reward: 22 },
];
