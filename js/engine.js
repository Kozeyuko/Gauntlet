// js/engine.js — PURE game logic. No DOM, no window, no localStorage.
// Receives a `save` object (already-parsed JSON shape) and mutates it in place.
// Optional `{ rng }` lets tests inject a deterministic random source.

import {
  ATTRIBUTES,
  ACTIVITIES,
  ACTIVITY_ALIAS,
  LOCATIONS,
  TRAINING,
  STYLES,
  CSTORE_ITEMS,
  CLINIC_ITEMS,
  JOBS,
  jobPay,
  jobStaminaCost,
  jobXpForLevel,
  JOB_AUTO_RATE,
  JOB_AUTO_COOLDOWN_MS,
  jobActionRate,
  RIVALS,
  INSIDE,
  RANKS,
  IMAGINED_NPCS,
  ENCOUNTER_NAMES,
  DAY_SECONDS,
  START_AGE_DAYS,
  BASE_LIFESPAN,
  START_MONEY,
  HP_BASE,
  HP_PER_TOU,
  STR_DRAIN_DIV,
  TOU_EFF_DIV,
  COMBAT_STAM_BASE,
  GAS_MULT,
  ULT_CHARGE_BASE,
  ULT_CHARGE_PER_INT,
  ULT_MAX,
  MODE_DUR_BASE,
  MODE_DUR_PER_INT,
  MODE_DUR_CAP,
  ENC_CHANCE,
  ENC_MIN,
  ENC_MAX,
  STYLEXP_TRAIN,
  STYLEXP_LOSS,
  MASTERY_TIERS,
  KNOWLEDGE_UNMASTERED,
  KNOWLEDGE_LEARNED,
  UNMASTERED_DMG,
  UNMASTERED_SKILL,
  CUSTOM_SKILL_PENALTY,
  CUSTOM_MAX_SKILLS,
  SELF_TRAIN_MULT,
  DATA_VERSION,
  GAME_VERSION,
  MAX_GHOSTS,
  MAX_RIVAL,
  MAX_TOTAL,
  ROAMERS,
  ROAMER_COOLDOWN_MS,
  COOLDOWN_LOSS_MULT,
  STYLE_TIER_MULT,
  styleTier,
  trainChain,
  versionCompare,
  GYM_TRAINING,
  MAIN_GYM,
  EQUIPMENT,
  LOC_RIVAL_TIERS,
  locationRivals,
  MAP_POS,
  MOVE_ENC_CHANCE,
  MOVE_BASE_SPEED,
  computeRoute,
} from "./data.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const BUFF_LABELS = { weights: "Training weights" };

// Render a structured combat event back to the human-readable log line.
// Reproduces the legacy format exactly: "You used Wild Swing (CRIT) — 10 dmg".
export function eventToString(ev) {
  const who = ev.who === "foe" ? "Foe" : "You";
  const crit = ev.crit ? " (CRIT)" : "";
  const suffix = ev.statusText ? ` (${ev.statusText})` : "";
  return `${who} used ${ev.skill}${crit} — ${ev.damage} dmg${suffix}`;
}

// Resolve a single strike, apply damage to the defender, and return a structured
// event object (snapshot fields left at 0 — callers fill them in after the round).
// Shared by BOTH the manual path (fightMove) and the auto path (resolveFight) so
// the event shape is identical. Keeps the exact RNG call order (crit, then dodge)
// so win/loss math stays byte-identical.
function strikeEvent(att, def, skill, isPlayer, rng) {
  let dmg = att.dmg * (skill.mult || 1.0);
  dmg *= (1 + (att.status.buff?.value || 0));
  dmg *= (1 + (def.status.debuff?.value || 0));
  if (def.status.limbArm) dmg *= 0.7;
  const critChance = att.crit + (skill.crit || 0.0);
  const dodgeChance = def.dodge - (skill.dodge || 0.0);
  const ultActive = att.modeRounds > 0;
  if (ultActive) dmg *= att.ultMult;
  if (att.stam <= 0) dmg *= GAS_MULT;
  const raw = dmg;
  const crit = rng() < critChance;
  const dodged = rng() < dodgeChance;
  if (crit) dmg *= 1.6;
  if (dodged) dmg *= 0.3;
  def.hp -= dmg;
  const ev = {
    who: isPlayer ? "you" : "foe",
    skill: skill.name,
    damage: Math.floor(dmg),
    raw,
    crit,
    dodged,
    ultActive,
    round: 0,
    youHp: 0, foeHp: 0, youStam: 0, foeStam: 0,
  };
  if (skill.status && !dodged) {
    const st = skill.status;
    if (st.effect === "poison") {
      def.status.poison = { value: st.value, rounds: st.rounds };
      ev.statusText = `poisoned for ${st.rounds} rounds`;
    } else if (st.effect === "debuff") {
      def.status.debuff = { value: st.value, rounds: st.rounds };
      ev.statusText = "defense lowered";
    } else if (st.effect === "buff") {
      att.status.buff = { value: st.value, rounds: st.rounds };
      ev.statusText = "own offense raised";
    } else if (st.effect === "limb" && st.value === "arm") {
      def.status.limbArm = true;
      ev.statusText = "damaged the arm";
    } else if (st.effect === "limb" && st.value === "leg") {
      def.status.limbLeg = true;
      ev.statusText = "damaged the leg";
    }
  }
  return ev;
}

function tickStatuses(c, events) {
  if (c.status.poison) {
    const p = c.status.poison;
    c.hp -= p.value;
    events.push({
      who: "sys", skill: "Poison", damage: p.value, raw: p.value,
      crit: false, dodged: false, ultActive: false, statusText: "poison damage",
      round: 0, youHp: 0, foeHp: 0, youStam: 0, foeStam: 0,
    });
    p.rounds -= 1;
    if (p.rounds <= 0) c.status.poison = null;
  }
  if (c.status.buff) {
    c.status.buff.rounds -= 1;
    if (c.status.buff.rounds <= 0) c.status.buff = null;
  }
  if (c.status.debuff) {
    c.status.debuff.rounds -= 1;
    if (c.status.debuff.rounds <= 0) c.status.debuff = null;
  }
}

// Fill the post-round state snapshot into a round's freshly-emitted events.
function stampEvents(events, fromIndex, round, me, foe) {
  for (let i = fromIndex; i < events.length; i++) {
    const ev = events[i];
    ev.round = round;
    ev.youHp = Math.max(0, Math.floor(me.hp));
    ev.foeHp = Math.max(0, Math.floor(foe.hp));
    ev.youStam = Math.max(0, Math.floor(me.stam));
    ev.foeStam = Math.max(0, Math.floor(foe.stam));
  }
}

// Transient fields: recomputed every render/step, never persisted.
export const TRANSIENT_KEYS = [
  "LastMsg", "Lifespan", "Encounter", "PotRankName", "PotNext", "StyleSkills", "StyleUltName",
];

// Persistent fields (the save shape). `version` is appended separately.
export const PERSISTENT_KEYS = [
  "Str", "Tou", "Spd", "Int", "Cha",
  "StrAp", "TouAp", "SpdAp", "IntAp", "ChaAp",
  "Health", "Stamina", "Nutrition", "Money", "AgeDays",
  "Lives", "Wins", "RivalIdx", "Location", "Activity",
  "Looking", "Styles", "ActiveStyle", "StyleXp", "PotRank",
  "StyleKnowledge", "KnownSkills", "Build",
  "JobXp", "JobLevel", "JobCooldowns",
  "InFight", "AutoBattle",
  "AutoJobKey",
  "StoreBuffs", "TempBoosts",
  "Log", "Roamers", "Name", "NewsSeen",
  "Inventory", "TaskList", "TaskRepeat", "TaskIndex",
  "SeenVersion",
  "TrainTiers", "TrainProgress",
  "PurchasedTraining",
  "OwnedTraining", "Consumables", "Equipment", "OwnedEquipment", "OwnedItems",
  "LocationFights", "LocationFighterCache", "RoamerChallengerCache", "RoamerSeenAt", "RoamerZones", "UnlockedTiers",
  "PlayerX", "PlayerY", "MovingTo", "MoveProgress", "RunCooldown",
];

// ------------------------------------------------------------------ STATE --
export function freshState() {
  const st = {
    Str: 0, Tou: 0, Spd: 0, Int: 0, Cha: 0,
    StrAp: 1, TouAp: 1, SpdAp: 1, IntAp: 1, ChaAp: 1,
    Health: 100, Stamina: 100, Nutrition: 100,
    Money: START_MONEY, AgeDays: START_AGE_DAYS, Lives: 0, Wins: 0,
    RivalIdx: 1, Location: "home", Activity: "Rest",
    Looking: false, Styles: "Brawling", ActiveStyle: "Brawling",
    StyleXp: "", PotRank: 0, InFight: false, AutoBattle: false,
    StyleKnowledge: "", KnownSkills: "", Build: "",
    JobXp: "", JobLevel: "", JobCooldowns: {},
    StoreBuffs: [], TempBoosts: { Str: 0, Tou: 0, Spd: 0, Int: 0, Cha: 0 },
    NewsSeen: 0,
    AutoRun: false,
    AutoJobKey: "",
    Roamers: {},
    Name: "You",
    Inventory: [],
    TaskList: [],
    TaskRepeat: false,
    TaskIndex: 0,
    SeenVersion: 0,
    TrainTiers: {},
    TrainProgress: {},
    PurchasedTraining: [],
    OwnedTraining: [],
    Consumables: {},
    Equipment: {},
    OwnedEquipment: [],
    OwnedItems: [],
    LocationFights: {},
    LocationFighterCache: {},
    RoamerChallengerCache: {},
    RoamerSeenAt: {},
    RoamerZones: {},
    UnlockedTiers: {},
    PlayerX: MAP_POS.home[0],
    PlayerY: MAP_POS.home[1],
    MovingTo: null,
    MoveProgress: 0,
    RunCooldown: 0,
    // transient
    LastMsg: "", Log: [], Lifespan: BASE_LIFESPAN, Encounter: 0,
    PotRankName: "F-", PotNext: "", StyleSkills: "", StyleUltName: "",
    routePath: null, routeIndex: 0, moveSegmentStartX: 0, moveSegmentStartY: 0,
    routeTotalDistance: 0, routeRemainingDistance: 0,
  };
  const starter = STYLES.Brawling;
  st.StyleSkills = starter.skills.map((s) => s.name).join(",");
  st.StyleUltName = starter.ult.name;
  return st;
}

// Return a plain serializable snapshot of only the persistent fields.
export function snapshot(state) {
  const out = { version: DATA_VERSION };
  for (const k of PERSISTENT_KEYS) out[k] = state[k];
  return out;
}

// Merge saved values over a fresh state. Returns true if anything was restored.
export function restore(state, saved) {
  if (!saved || typeof saved !== "object") return false;
  let restored = false;
  for (const k of PERSISTENT_KEYS) {
    if (saved[k] !== undefined && saved[k] !== null) {
      state[k] = saved[k];
      restored = true;
    }
  }
  // Migrate old TaskList format (array of strings) to [{act, n}]
  if (Array.isArray(state.TaskList) && state.TaskList.length > 0) {
    if (typeof state.TaskList[0] === "string") {
      state.TaskList = state.TaskList.map((s) => ({ act: s, n: 1, origN: 1 }));
    } else {
      for (const item of state.TaskList) {
        if (item && typeof item === "object" && item.origN === undefined) item.origN = item.n;
      }
    }
  }
  // Migrate old PurchasedTraining → OwnedTraining
  if (Array.isArray(state.PurchasedTraining) && state.PurchasedTraining.length > 0) {
    if (!Array.isArray(state.OwnedTraining)) state.OwnedTraining = [];
    for (const k of state.PurchasedTraining) {
      if (!state.OwnedTraining.includes(k)) state.OwnedTraining.push(k);
    }
  }
  if (!Array.isArray(state.OwnedTraining)) state.OwnedTraining = [];
  if (!state.Consumables || typeof state.Consumables !== "object") state.Consumables = {};
  if (!state.Equipment || typeof state.Equipment !== "object") state.Equipment = {};
  if (!Array.isArray(state.OwnedEquipment)) state.OwnedEquipment = [];
  if (!Array.isArray(state.OwnedItems)) state.OwnedItems = [];
  return restored;
}

// ------------------------------------------------------------------ GAME --
export function createGame(state, opts = {}) {
  const R = opts.rng || Math.random;
  const loadGhosts = opts.loadGhosts || (() => []);
  const saveGhosts = opts.saveGhosts || (() => {});
  const getNow = opts.now || Date.now;
  const roamerCooldownMs = opts.roamerCooldownMs || ROAMER_COOLDOWN_MS;

  let battle = null;
  let ghostCache = null;

  const ALL_STORE_ITEMS = CSTORE_ITEMS.concat(CLINIC_ITEMS);

  function getGhosts() {
    if (ghostCache === null) ghostCache = loadGhosts() || [];
    return ghostCache;
  }

  function persistGhosts(list) {
    ghostCache = list;
    saveGhosts(list);
  }

  // ---- attribute helpers ----
  const attrValue = (id) => Math.max(1, num(state[id]) + num(state.TempBoosts && state.TempBoosts[id]));
  const attrApt = (id) => Math.max(1, num(state[id + "Ap"]));
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function shouldShowUpdateLog() { return versionCompare(GAME_VERSION, num(state.SeenVersion)) > 0; }
  function maxHealth() { return 100 + Math.max(0, attrValue("Tou") - 1) * 10; }
  function maxStamina() { return 100 + Math.max(0, attrValue("Spd") - 1) * 8; }
  function maxNutrition() { return 100 + Math.max(0, attrValue("Int") - 1) * 5; }
  function clampVitals() {
    state.Health = clamp(num(state.Health), 0, maxHealth());
    state.Stamina = clamp(num(state.Stamina), 0, maxStamina());
    state.Nutrition = clamp(num(state.Nutrition), 0, maxNutrition());
  }
  function logMsg(msg, kind = "sys") {
    const entry = { t: msg, k: kind, d: num(state.AgeDays) };
    state.LastMsg = msg;
    state.Log = (state.Log || []).concat([entry]).slice(-200);
  }
  function potential() {
    return attrValue("Str") + attrValue("Tou") + attrValue("Spd") + attrValue("Int");
  }
  function currentStats() {
    return {
      Str: attrValue("Str"), Tou: attrValue("Tou"), Spd: attrValue("Spd"),
      Int: attrValue("Int"), Cha: attrValue("Cha"),
    };
  }

  // ---- ranks ----
  function rankIndexFor(pot) {
    let idx = 1;
    for (let i = 1; i <= RANKS.length; i++) {
      if (pot <= RANKS[i - 1].max) { idx = i; break; }
      idx = i;
    }
    return idx;
  }

  function updatePotential() {
    const pot = potential();
    const idx = rankIndexFor(pot);
    let paid = 0;
    const from = Math.max(1, state.PotRank + 1);
    for (let i = from; i <= idx; i++) paid += RANKS[i - 1].reward;
    if (paid > 0) {
      state.Money = num(state.Money) + paid;
      logMsg(`POTENTIAL UP! Rank ${RANKS[idx - 1].name} — +${paid} Cash.`, "rank");
    }
    state.PotRank = idx;
    state.PotRankName = RANKS[idx - 1].name;
    const nextRank = RANKS[idx]; // 1-based next
    state.PotNext = nextRank ? `next ${nextRank.name} at ${nextRank.min} (+${nextRank.reward})` : "max rank";
  }

  // ---- styles ----
  function learnedStyles() {
    const out = {};
    // Knowledge-derived: a style is "learned/switchable" at >= 25%.
    const km = knowledgeMap();
    for (const id of Object.keys(km)) {
      if (km[id] >= KNOWLEDGE_UNMASTERED) out[id] = true;
    }
    // Backward-compat: old saves' state.Styles contents count as fully known.
    const raw = String(state.Styles ?? "");
    for (const part of raw.split(",")) {
      if (part !== "") out[part] = true;
    }
    return out;
  }

  function learnStyle(styleId) {
    let raw = String(state.Styles ?? "");
    if (raw === "" || raw === "nil") raw = "";
    if (learnedStyles()[styleId]) return;
    state.Styles = raw === "" ? styleId : raw + "," + styleId;
  }

  // ---- style knowledge ----
  function knowledgeMap() {
    const out = {};
    const raw = String(state.StyleKnowledge ?? "");
    for (const pair of raw.split(";")) {
      if (pair === "") continue;
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      out[pair.slice(0, eq)] = Number(pair.slice(eq + 1)) || 0;
    }
    return out;
  }

  function styleKnowledge(styleId) {
    const raw = String(state.Styles ?? "");
    for (const part of raw.split(",")) {
      if (part !== "" && part === styleId) return KNOWLEDGE_LEARNED;
    }
    return knowledgeMap()[styleId] || 0;
  }

  function addKnowledge(styleId, amt) {
    const map = knowledgeMap();
    const before = styleKnowledge(styleId);
    const after = Math.min(KNOWLEDGE_LEARNED, before + amt);
    map[styleId] = after;
    state.StyleKnowledge = Object.entries(map).map(([k, v]) => `${k}=${v}`).join(";");
    const label = STYLES[styleId] ? STYLES[styleId].name : styleId;
    if (before < KNOWLEDGE_UNMASTERED && after >= KNOWLEDGE_UNMASTERED)
      logMsg(`${label} — you can now use this style (unmastered).`, "skill");
    if (before < KNOWLEDGE_LEARNED && after >= KNOWLEDGE_LEARNED)
      logMsg(`${label} fully learned!`, "skill");
  }

  function knownSkillList() {
    const raw = String(state.KnownSkills ?? "");
    return raw === "" ? [] : raw.split(",").filter(Boolean);
  }

  function knownSkillSet() {
    return new Set(knownSkillList());
  }

  function learnSkill(styleId, skillName) {
    const key = styleId + "|" + skillName;
    if (knownSkillSet().has(key)) return false;
    state.KnownSkills = (state.KnownSkills ? state.KnownSkills + "," : "") + key;
    return true;
  }

  // Called when a foe lands a skill on the player: learn the move and the style.
  function onPlayerHit(styleId, skill, dmg) {
    if (!styleId) return 0;
    if (skill && skill.name) learnSkill(styleId, skill.name);
    const gain = 0.01 + R() * 0.19;
    addKnowledge(styleId, gain);
    return gain;
  }

  // Fighting WITH an unmastered style trains it faster than passive learning.
  function selfTrainTick(styleId) {
    const k = styleKnowledge(styleId);
    if (k >= KNOWLEDGE_UNMASTERED && k < KNOWLEDGE_LEARNED) {
      addKnowledge(styleId, 0.1 + R() * 0.2);
    }
  }

  // ---- jobs ----
  function jobXpMap() {
    const out = {};
    const raw = String(state.JobXp ?? "");
    for (const pair of raw.split(";")) {
      if (pair === "") continue;
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      out[pair.slice(0, eq)] = Number(pair.slice(eq + 1)) || 0;
    }
    return out;
  }

  function jobLevelMap() {
    const out = {};
    const raw = String(state.JobLevel ?? "");
    for (const pair of raw.split(";")) {
      if (pair === "") continue;
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      out[pair.slice(0, eq)] = Number(pair.slice(eq + 1)) || 1;
    }
    return out;
  }

  function jobLevel(jobKey) { return jobLevelMap()[jobKey] || 1; }
  function jobXp(jobKey) { return jobXpMap()[jobKey] || 0; }

  function addJobXp(jobKey, amt) {
    const job = JOBS.find((j) => j.key === jobKey);
    if (!job) return;
    const xmap = jobXpMap();
    const lmap = jobLevelMap();
    let xp = (xmap[jobKey] || 0) + amt;
    let level = lmap[jobKey] || 1;
    while (level < job.maxLevel && xp >= jobXpForLevel(job, level)) {
      xp -= jobXpForLevel(job, level);
      level += 1;
      logMsg(`${job.name} level up! Now level ${level}.`, "job");
    }
    xmap[jobKey] = xp;
    lmap[jobKey] = level;
    state.JobXp = Object.entries(xmap).map(([k, v]) => `${k}=${v}`).join(";");
    state.JobLevel = Object.entries(lmap).map(([k, v]) => `${k}=${v}`).join(";");
  }

  function doJobShift(jobKey, performanceScore = 1.0) {
    const job = JOBS.find((j) => j.key === jobKey);
    if (!job) return { success: false };
    const level = jobLevel(jobKey);
    const cost = jobStaminaCost(job, level);
    if (num(state.Stamina) < cost) {
      logMsg("Too tired to work. Rest first.", "job");
      return { success: false };
    }
    state.Stamina = num(state.Stamina) - cost;
    const fullPay = jobPay(job, level);
    const score = Math.max(0, Math.min(1, performanceScore));
    const pay = Math.max(1, fullPay * score);
    const xp = Math.max(1, Math.round(job.xpPerShift * score));
    const chaBonus = attrValue("Cha") * 0.5;
    const totalPay = pay + chaBonus;
    state.Money = num(state.Money) + totalPay;
    state.Cha = num(state.Cha) + 0.02 * attrApt("Cha");
    const oldLevel = level;
    addJobXp(jobKey, xp);
    const newLevel = jobLevel(jobKey);
    logMsg(`${job.name} shift: +${totalPay.toFixed(2)} Cash${newLevel > oldLevel ? ", LEVEL UP!" : ""}.`, "job");
    updatePotential();
    return { success: true, pay: totalPay, xp, level: newLevel, levelUp: newLevel > oldLevel };
  }

  function doJobAction(jobKey, combo, success) {
    const job = JOBS.find((j) => j.key === jobKey);
    if (!job) return { success: false };
    const level = jobLevel(jobKey);
    const rate = jobActionRate(combo);
    const staminaCost = jobStaminaCost(job, level);
    if (num(state.Stamina) < staminaCost) {
      logMsg("Too tired to keep working.", "job");
      return { success: false, staminaDepleted: true };
    }
    state.Stamina = num(state.Stamina) - staminaCost;
    let pay = 0;
    let xp = 0;
    if (success) {
      pay = Math.max(0.1, jobPay(job, level) * rate);
      xp = job.xpPerShift * rate;
      const chaBonus = attrValue("Cha") * 0.5;
      pay += chaBonus;
      state.Money = num(state.Money) + pay;
      state.Cha = num(state.Cha) + 0.02 * attrApt("Cha");
      addJobXp(jobKey, xp);
    }
    updatePotential();
    const newLevel = jobLevel(jobKey);
    return { success, pay, xp, combo, rate, level: newLevel, staminaCost };
  }

  function jobActionStaminaCost(jobKey) {
    const job = JOBS.find((j) => j.key === jobKey);
    if (!job) return 5;
    return jobStaminaCost(job, jobLevel(jobKey));
  }

  function doAutoJob(jobKey) {
    const job = JOBS.find((j) => j.key === jobKey);
    if (!job) return { success: false };
    const level = jobLevel(jobKey);
    const cost = jobStaminaCost(job, level);
    if (num(state.Stamina) < cost) {
      logMsg("Too tired to work. Rest first.", "job");
      return { success: false };
    }
    const now = getNow();
    const cooldowns = state.JobCooldowns || {};
    const last = Number(cooldowns[jobKey]) || 0;
    if (now < last + JOB_AUTO_COOLDOWN_MS) {
      const remain = Math.ceil((last + JOB_AUTO_COOLDOWN_MS - now) / 1000);
      logMsg(`${job.name} auto-work on cooldown (${remain}s).`, "job");
      return { success: false, cooldown: remain };
    }
    state.Stamina = num(state.Stamina) - cost;
    const fullPay = jobPay(job, level);
    const pay = Math.max(1, Math.round(fullPay * JOB_AUTO_RATE));
    const xp = Math.max(1, Math.round(job.xpPerShift * JOB_AUTO_RATE));
    const chaBonus = Math.floor(attrValue("Cha") * 0.5);
    const totalPay = pay + chaBonus;
    state.Money = num(state.Money) + totalPay;
    state.Cha = num(state.Cha) + 0.02 * attrApt("Cha");
    const oldLevel = level;
    addJobXp(jobKey, xp);
    const newLevel = jobLevel(jobKey);
    cooldowns[jobKey] = now;
    state.JobCooldowns = cooldowns;
    logMsg(`${job.name} auto-shift: +${totalPay} Cash.`, "job");
    updatePotential();
    return { success: true, pay: totalPay, xp, level: newLevel, levelUp: newLevel > oldLevel, cooldownMs: JOB_AUTO_COOLDOWN_MS };
  }

  function jobCooldownRemaining(jobKey) {
    const cooldowns = state.JobCooldowns || {};
    const last = Number(cooldowns[jobKey]) || 0;
    const now = getNow();
    return Math.max(0, last + JOB_AUTO_COOLDOWN_MS - now);
  }

  function setAutoJob(jobKey) {
    if (jobKey && !JOBS.find((j) => j.key === jobKey)) return false;
    state.AutoJobKey = jobKey || "";
    return true;
  }

  function clearAutoJob() {
    state.AutoJobKey = "";
    return true;
  }

  function autoJobActive() {
    return state.AutoJobKey || null;
  }

  function jobCanWork(jobKey) {
    const job = JOBS.find((j) => j.key === jobKey);
    if (!job) return false;
    const level = jobLevel(jobKey);
    return num(state.Stamina) >= jobStaminaCost(job, level);
  }
  function lookupSkill(key) {
    const pipe = key.indexOf("|");
    if (pipe < 0) return null;
    const stId = key.slice(0, pipe);
    const skName = key.slice(pipe + 1);
    const st = STYLES[stId];
    if (!st || !st.skills) return null;
    return st.skills.find((s) => s.name === skName) || null;
  }

  function activeBuild() {
    const raw = String(state.Build ?? "");
    if (raw === "" || raw === "nil") return null;
    const baseMatch = /^base=([^;]+)/.exec(raw);
    if (!baseMatch) return null;
    const base = baseMatch[1];
    if (!STYLES[base]) return null;
    let skills = [];
    const skillsMatch = /skills=(.*)$/.exec(raw);
    if (skillsMatch && skillsMatch[1]) {
      skills = skillsMatch[1].split(",").filter(Boolean);
    }
    return { base, skills };
  }

  function buildStyleId() {
    const b = activeBuild();
    return b ? b.base : null;
  }

  function saveBuild(baseStyleId, skillKeys) {
    if (!STYLES[baseStyleId]) return false;
    if (styleKnowledge(baseStyleId) < KNOWLEDGE_UNMASTERED) return false;
    const keys = (skillKeys || []).slice(0, CUSTOM_MAX_SKILLS);
    const known = knownSkillSet();
    for (const k of keys) {
      if (!known.has(k)) return false;
    }
    state.Build = `base=${baseStyleId};skills=${keys.join(",")}`;
    publishStyleSkills();
    return true;
  }

  function clearBuild() {
    state.Build = "";
    publishStyleSkills();
  }

  function activeStyle() {
    const b = buildStyleId();
    if (b) return b;
    const s = String(state.ActiveStyle ?? "");
    if (s === "" || s === "nil") return "Brawling";
    return s;
  }

  function publishStyleSkills() {
    const build = activeBuild();
    if (build) {
      const names = build.skills.map((key) => {
        const sk = lookupSkill(key);
        return sk ? sk.name : key;
      });
      state.StyleSkills = names.join(",");
      const st = STYLES[build.base];
      state.StyleUltName = st && st.ult && st.ult.name ? st.ult.name : "Berserk";
      return;
    }
    const st = STYLES[activeStyle()];
    if (!st) return;
    const names = st.skills ? st.skills.map((s) => s.name) : [];
    state.StyleSkills = names.join(",");
    state.StyleUltName = st.ult && st.ult.name ? st.ult.name : "Berserk";
  }

  function styleXpMap() {
    const out = {};
    const raw = String(state.StyleXp ?? "");
    for (const pair of raw.split(";")) {
      if (pair === "") continue;
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      out[pair.slice(0, eq)] = Number(pair.slice(eq + 1)) || 0;
    }
    return out;
  }

  function addStyleXp(styleId, amt) {
    const map = styleXpMap();
    map[styleId] = (map[styleId] || 0) + amt;
    state.StyleXp = Object.entries(map).map(([k, v]) => `${k}=${v}`).join(";");
    let tier = 0;
    for (let i = 0; i < MASTERY_TIERS.length; i++) {
      if (map[styleId] >= MASTERY_TIERS[i]) tier = i + 1;
    }
    if (tier > 0 && STYLES[styleId]) {
      logMsg(`${STYLES[styleId].name} mastery tier ${tier} — signature move unlocked.`, "skill");
    }
  }

  function buyAptitude(id) {
    const attr = ATTRIBUTES.find((a) => a.id === id);
    if (!attr) return false;
    const cost = 25;
    if (num(state.Money) < cost) {
      logMsg(`Not enough Cash. Aptitude purchase costs ${cost}.`);
      return false;
    }
    state.Money = num(state.Money) - cost;
    state[id + "Ap"] = attrApt(id) * 1.5;
    logMsg(`${attr.name} Aptitude increased to ×${state[id + "Ap"].toFixed(2)}.`);
    return true;
  }

  // ---- base64 helpers ----
  function b64encode(str) {
    if (typeof btoa !== "undefined") return btoa(unescape(encodeURIComponent(str)));
    return Buffer.from(str, "utf8").toString("base64");
  }
  function b64decode(str) {
    if (typeof atob !== "undefined") return decodeURIComponent(escape(atob(str)));
    return Buffer.from(str, "base64").toString("utf8");
  }

  // ---- export / import save codes ----
  function exportSave() {
    return "GAUNTLET:" + b64encode(JSON.stringify(snapshot(state)));
  }

  function importSave(code) {
    if (typeof code !== "string") return false;
    const prefix = "GAUNTLET:";
    if (!code.startsWith(prefix)) return false;
    try {
      const json = b64decode(code.slice(prefix.length));
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object") return false;
      restore(state, parsed);
      clampVitals();
      updatePotential();
      logMsg("Save restored.");
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---- hard reset ----
  function hardReset() {
    for (const k of PERSISTENT_KEYS) delete state[k];
    for (const k of TRANSIENT_KEYS) delete state[k];
    Object.assign(state, freshState());
    state.SeenVersion = GAME_VERSION;
    ghostCache = [];
  }

  // ---- death & rebirth ----
  function onDeath(cause) {
    const prevLives = num(state.Lives);
    const gains = {};
    for (const a of ATTRIBUTES) {
      const currentVal = num(state[a.id]);
      const addedAp = Math.max(0, (currentVal - 1) * 0.15);
      const newAp = attrApt(a.id) + addedAp;
      state[a.id + "Ap"] = newAp;
      gains[a.id] = newAp;
    }
    for (const a of ATTRIBUTES) state[a.id] = 0;
    state.TempBoosts = { Str: 0, Tou: 0, Spd: 0, Int: 0, Cha: 0 };
    state.Health = maxHealth();
    state.Stamina = maxStamina();
    state.Nutrition = maxNutrition();
    state.Money = START_MONEY;
    state.AgeDays = START_AGE_DAYS;
    state.Activity = "Rest";
    logMsg(`Death: ${cause}. The body remembers: aptitudes increased from your training!`, "life");
    updatePotential();
  }

  function rebirthCost() {
    return 50 + num(state.Lives) * 50;
  }

  function rebirth() {
    const pot = potential();
    if (pot < 25) {
      logMsg("You need at least 25 Potential to Rebirth.", "sys");
      return false;
    }
    const cost = rebirthCost();
    if (num(state.Money) < cost) {
      logMsg(`Not enough Cash to Rebirth. Cost: ${cost} Cash.`, "sys");
      return false;
    }
    state.Money = num(state.Money) - cost;
    state.Lives = num(state.Lives) + 1;
    const mult = 1 + (pot / 100);
    for (const a of ATTRIBUTES) {
      state[a.id + "Ap"] = attrApt(a.id) * mult;
      state[a.id] = 0;
    }
    state.TempBoosts = { Str: 0, Tou: 0, Spd: 0, Int: 0, Cha: 0 };
    state.Health = maxHealth();
    state.Stamina = maxStamina();
    state.Nutrition = maxNutrition();
    state.Money = START_MONEY;
    state.AgeDays = START_AGE_DAYS;
    state.Activity = "Rest";
    logMsg(`REBIRTH #${state.Lives}! Potential ${pot} granted aptitude multiplier x${mult.toFixed(2)}!`, "life");
    updatePotential();
    return true;
  }

  function reincarnate(cause, opts = {}) {
    if (opts.manual) {
      return rebirth();
    }
    onDeath(cause);
    return true;
  }

  // ---- combat construction ----
  function makeCombatant(stats, styleId, opts = {}) {
    const isPlayer = opts.isPlayer === true;
    const build = isPlayer ? activeBuild() : null;
    const style = STYLES[styleId] || STYLES.Brawling;
    const hp = HP_BASE + stats.Tou * HP_PER_TOU;

    let skills;
    if (build) {
      skills = build.skills.map((key) => lookupSkill(key)).filter(Boolean);
      if (skills.length === 0) {
        skills = [{ name: "Haymaker", mult: 1.0, crit: 0.0, dodge: 0.0, weight: 1 }];
      }
    } else {
      skills = (style.skills && style.skills.length > 0) ? style.skills
        : [{ name: "Haymaker", mult: 1.0, crit: 0.0, dodge: 0.0, weight: 1 }];
    }

    const k = styleKnowledge(styleId);
    const isCustom = !!build;
    let styleDmg = style.dmg;
    if (isPlayer && !isCustom && k < KNOWLEDGE_LEARNED) styleDmg *= UNMASTERED_DMG;
    if (isCustom) styleDmg *= 1 - CUSTOM_SKILL_PENALTY * build.skills.length;
    if (isPlayer && !isCustom && k < KNOWLEDGE_LEARNED) {
      skills = skills.map((s) => ({ ...s, mult: (s.mult || 1) * UNMASTERED_SKILL }));
    }

    const dmg = (stats.Str + stats.Int * 0.2) * styleDmg;
    const crit = 0.08 + stats.Int * 0.004 + style.crit;
    const dodge = Math.min(0.45, stats.Spd * 0.01 + style.dodge);
    const stam = COMBAT_STAM_BASE + stats.Tou;
    const drain = 6 * (1 + stats.Str / STR_DRAIN_DIV) * Math.pow(0.75, stats.Tou / TOU_EFF_DIV);
    return {
      rawStats: { ...stats },
      totalPower: (num(stats.Str) + num(stats.Tou) + num(stats.Spd) + num(stats.Int) + num(stats.Cha)) / 30,
      hp, maxHp: hp, dmg, crit, dodge, spd: stats.Spd, stam, maxStam: stam, drain, int: stats.Int,
      skills, skillName: null, ultCharge: 0, modeRounds: 0,
      ultMult: style.ult && style.ult.mult ? style.ult.mult : 1.35,
      ultName: style.ult && style.ult.name ? style.ult.name : "Berserk",
      status: { poison: null, buff: null, debuff: null, limbArm: false, limbLeg: false },
    };
  }

  function pickSkill(c) {
    const skills = c.skills;
    if (!skills || skills.length === 0) return { name: "Haymaker", mult: 1.0, crit: 0.0, dodge: 0.0 };
    let total = 0;
    for (const s of skills) total += s.weight || 1;
    let roll = R() * total;
    let acc = 0;
    for (const s of skills) {
      acc += s.weight || 1;
      if (roll <= acc) return s;
    }
    return skills[skills.length - 1];
  }

  function resolveFight(foeStats, foeStyle) {
    const me = makeCombatant(currentStats(), activeStyle(), { isPlayer: true });
    const foe = makeCombatant(foeStats, foeStyle);
    let round = 0;
    const MAX_ROUNDS = 10000;
    const events = [];
    let attacksLanded = 0;
    let dodges = 0;
    let dmgDealt = 0;
    let dmgTaken = 0;
    while (me.hp > 0 && foe.hp > 0 && me.stam > 0 && foe.stam > 0 && round < MAX_ROUNDS) {
      round += 1;
      me.stam -= me.drain;
      foe.stam -= foe.drain;
      for (const c of [me, foe]) {
        if (c.modeRounds > 0) {
          c.modeRounds -= 1;
        } else if (c.ultCharge >= ULT_MAX) {
          c.modeRounds = Math.min(MODE_DUR_BASE + Math.floor(c.int / MODE_DUR_PER_INT), MODE_DUR_CAP);
          c.ultCharge = 0;
        } else {
          c.ultCharge += ULT_CHARGE_BASE + c.int * ULT_CHARGE_PER_INT;
        }
      }
      const meSpd = me.spd * (me.status.limbLeg ? 0.6 : 1);
      const foeSpd = foe.spd * (foe.status.limbLeg ? 0.6 : 1);
      let first = me, second = foe;
      if (foeSpd > meSpd) { first = foe; second = me; }
      tickStatuses(me, events);
      tickStatuses(foe, events);
      const roundStart = events.length;
      const strike = (att, def) => {
        const skill = pickSkill(att);
        att.skillName = skill.name;
        const ev = strikeEvent(att, def, skill, att === me, R);
        if (att === me) {
          if (!ev.dodged) { attacksLanded++; dmgDealt += ev.damage; }
        } else {
          if (ev.dodged) { dodges++; } else { dmgTaken += ev.damage; }
        }
        if (att !== me) {
          const gain = onPlayerHit(foeStyle, skill, ev.damage);
          if (gain > 0) {
            ev.knowledgeGain = Math.round(gain);
            ev.knowledgeStyle = STYLES[foeStyle] ? STYLES[foeStyle].name : foeStyle;
          }
        }
        events.push(ev);
      };
      strike(first, second);
      if (second.hp > 0) strike(second, first);
      selfTrainTick(activeStyle());
      stampEvents(events, roundStart, round, me, foe);
    }
    const win = (me.hp > 0 && foe.hp <= 0) || (me.hp > 0 && foe.stam <= 0 && me.stam > 0);
    return { win, rounds: round, playerHpLeft: Math.max(0, me.hp), playerSkill: me.skillName, foeSkill: foe.skillName, events, attacksLanded, dodges, dmgDealt, dmgTaken, foeStats };
  }

  function meHpLost(result) {
    const maxHp = HP_BASE + attrValue("Tou") * HP_PER_TOU;
    const hpLeft = result.playerHpLeft;
    if (hpLeft <= 0) return Math.floor(maxHp * 0.5);
    return Math.floor((1 - hpLeft / maxHp) * 30) + 5;
  }

  function applyFightGains(win, foeStats, result) {
    foeStats = foeStats || {};
    result = result || {};
    const myMaxHp = HP_BASE + attrValue("Tou") * HP_PER_TOU;
    const foeMaxHp = HP_BASE + (foeStats.Tou || 0) * HP_PER_TOU;
    const dmgTaken = result.dmgTaken || 0;
    const dmgDealt = result.dmgDealt || 0;
    const attacksLanded = result.attacksLanded || 0;
    const dodges = result.dodges || 0;
    const rounds = result.rounds || 1;
    const dmgTakenFrac = Math.min(1, dmgTaken / Math.max(1, myMaxHp));
    const dmgDealtFrac = Math.min(1, dmgDealt / Math.max(1, foeMaxHp));
    const foePowerMult = 1 + ((foeStats.Str || 0) + (foeStats.Tou || 0)) / 200;
    const touGain = 0.15 * dmgTakenFrac * foePowerMult;
    const strGain = 0.20 * dmgDealtFrac * (1 + (foeStats.Tou || 0) / 100);
    const spdGain = 0.02 * (attacksLanded + dodges * 1.5);
    const intGain = 0.02 * rounds;
    state.Str = num(state.Str) + strGain * attrApt("Str");
    state.Tou = num(state.Tou) + touGain * attrApt("Tou");
    state.Spd = num(state.Spd) + spdGain * attrApt("Spd");
    state.Int = num(state.Int) + intGain * attrApt("Int");
  }

  // ---- foe setup ----
  function setupFoe() {
    const idx = clamp(num(state.RivalIdx), 1, MAX_TOTAL);
    const pot = potential();
    let mode = "ladder";
    let foeStats;
    let foeStyle = "Brawling";
    let foeName = "";
    let bet = 0;
    let extra = {};

    if (num(state.Encounter) >= 1) {
      mode = "encounter";
      state.Encounter = 0;
      const s = ENC_MIN + R() * (ENC_MAX - ENC_MIN);
      foeStats = {
        Str: Math.max(2, Math.floor(pot * 0.30 * s)),
        Tou: Math.max(2, Math.floor(pot * 0.25 * s)),
        Spd: Math.max(2, Math.floor(pot * 0.25 * s)),
        Int: Math.max(1, Math.floor(pot * 0.20 * s)),
        Cha: 1,
      };
      const styles = Object.keys(STYLES);
      foeStyle = styles[Math.floor(R() * styles.length)];
      foeName = ENCOUNTER_NAMES[Math.floor(R() * ENCOUNTER_NAMES.length)] + " (" + STYLES[foeStyle].name + ")";
    } else if (idx > MAX_RIVAL) {
      mode = "inside";
      const foe = INSIDE[idx - MAX_RIVAL - 1];
      foeStats = foe.stats;
      foeStyle = foe.style;
      foeName = foe.name;
      bet = foe.bet;
      if (num(state.Money) < bet) {
        logMsg(`The Inside demands a ${bet} Cash wager. You can't afford it.`, "fight");
        return null;
      }
      state.Money = num(state.Money) - bet;
      extra = foe;
    } else {
      const foe = RIVALS[idx - 1];
      foeStats = foe.stats;
      foeStyle = foe.style;
      foeName = foe.name;
      extra = foe;
    }

    return { mode, foeStats, foeStyle, foeName, bet, extra, idx };
  }

  function concludeFight(mode, extra, idx, pot, bet, result) {
    if (result.win) {
      if (mode === "ladder") {
        const moneyGain = extra.rewardMoney + Math.floor(attrValue("Cha") * 0.5);
        state.Money = num(state.Money) + moneyGain;
        state.Wins = num(state.Wins) + 1;
        const learned = styleKnowledge(extra.style) >= KNOWLEDGE_LEARNED;
        if (idx < MAX_RIVAL) state.RivalIdx = idx + 1;
        addStyleXp(activeStyle(), 0.5 + idx * 0.2);
        applyFightGains(true, result.foeStats, result);
        captureGhost();
        if (learned) {
          logMsg(`VICTORY over ${extra.name} in ${result.rounds} rounds! You learned ${STYLES[extra.style].name}!`, "fight");
        } else if (idx === MAX_RIVAL) {
          logMsg(`THE MASTER FALLS in ${result.rounds} rounds! The Inside opens its doors. +${moneyGain} Cash.`, "fight");
        } else {
          logMsg(`VICTORY over ${extra.name} in ${result.rounds} rounds — landed ${result.playerSkill || "a clean hit"}! +${moneyGain} Cash. Next: ${RIVALS[idx].name}.`, "fight");
        }
      } else if (mode === "inside") {
        state.Money = num(state.Money) + extra.pay;
        state.Wins = num(state.Wins) + 1;
        addStyleXp(activeStyle(), 1.5 + (idx - MAX_RIVAL) * 0.5);
        applyFightGains(true, result.foeStats, result);
        if (idx < MAX_TOTAL) {
          state.RivalIdx = idx + 1;
          logMsg(`INSIDE VICTORY over ${extra.name}! +${extra.pay} Cash. Next monster: ${INSIDE[idx - MAX_RIVAL].name}.`, "fight");
        } else {
          logMsg(`KURE REIKO FALLS! You conquered The Inside. Champion of the district. +${extra.pay} Cash.`, "fight");
        }
      } else if (mode === "ghost") {
        const moneyGain = 10 + Math.floor((extra.potential || pot) / 50);
        state.Money = num(state.Money) + moneyGain;
        state.Wins = num(state.Wins) + 1;
        addStyleXp(activeStyle(), 0.5 + Math.floor((extra.potential || 0) / 500));
        applyFightGains(true, result.foeStats, result);
        logMsg(`You defeated the ghost of ${extra.name || "a fighter"} in ${result.rounds} rounds. +${moneyGain} Cash. Their record is yours to claim.`, "fight");
      } else if (mode === "roamer") {
        const reward = num(extra.reward);
        state.Money = num(state.Money) + reward;
        addStyleXp(activeStyle(), num(extra.styleXp) || 0.5);
        applyFightGains(true, result.foeStats, result);
        logMsg(`You won Bout ${extra.chainStep || 1} of ${extra.name}. +${reward} Cash.`, "fight");
      } else if (mode === "location") {
        const reward = num(extra.rewardMoney);
        state.Money = num(state.Money) + reward;
        state.Wins = num(state.Wins) + 1;
        addStyleXp(activeStyle(), 0.5 + (extra.n || 1) * 0.2);
        applyFightGains(true, result.foeStats, result);
        const locKey = extra.locKey;
        if (locKey && !state.LocationFights) state.LocationFights = {};
        if (locKey && !state.LocationFights[locKey]) state.LocationFights[locKey] = [];
        if (locKey && Array.isArray(state.LocationFights[locKey])) {
          if (!state.LocationFights[locKey].includes(extra.n)) state.LocationFights[locKey].push(extra.n);
        }
        logMsg(`VICTORY over ${extra.name} in ${result.rounds} rounds! +${reward} Cash.`, "fight");
        if (locKey && Array.isArray(state.LocationFights[locKey]) && state.LocationFights[locKey].length >= 5) {
          const loc = LOCATIONS[locKey];
          if (loc && loc.tier) {
            const nextTier = loc.tier + 1;
            if (!state.UnlockedTiers) state.UnlockedTiers = {};
            const nextLocKey = Object.keys(LOCATIONS).find(k => LOCATIONS[k].tier === nextTier && LOCATIONS[k].styleGym);
            if (nextLocKey && !state.UnlockedTiers[nextLocKey]) {
              state.UnlockedTiers[nextLocKey] = true;
              logMsg(`All fighters at ${loc.name} cleared! The gates of ${LOCATIONS[nextLocKey].name} open.`, "fight");
            }
          }
        }
      } else if (mode === "tourney") {
        const reward = num(extra.reward);
        state.Money = num(state.Money) + reward;
        addStyleXp(activeStyle(), 1.0);
        applyFightGains(true, result.foeStats, result);
        logMsg(`TOURNAMENT ROUND ${extra.round} VICTORY! +${reward} Cash.`, "fight");
      } else if (mode === "gu") {
        const wave = extra.wave || 1;
        addStyleXp(activeStyle(), 1.5);
        applyFightGains(true, result.foeStats, result);
        if (wave >= 5) {
          state.Money = num(state.Money) + 500;
          learnStyle("Formless");
          addKnowledge("Formless", KNOWLEDGE_LEARNED);
          logMsg("THE GU RITUAL IS WON! You survived the pit and mastered the FORMLESS style! +500 Cash.", "fight");
        } else {
          logMsg(`Gu Ritual Wave ${wave} cleared! Prepare for the next survivor.`, "fight");
        }
      } else { // encounter
        const moneyGain = 5 + Math.floor(pot / 20);
        state.Money = num(state.Money) + moneyGain;
        addStyleXp(activeStyle(), 0.3 + Math.floor(pot / 500));
        applyFightGains(true, result.foeStats, result);
        logMsg(`You beat the challenger in ${result.rounds} rounds. The crowd nods. +${moneyGain} Cash.`, "fight");
      }
      updatePotential();
    } else {
      const dmg = Math.max(5, Math.floor(meHpLost(result)));
      state.Health = num(state.Health) - dmg;
      if (mode === "inside") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false, result.foeStats, result);
        logMsg(`The Inside eats you alive — ${extra.name} takes the ${bet} Cash pot. You took ${dmg} damage.`, "fight");
      } else if (mode === "encounter") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false, result.foeStats, result);
        logMsg(`DEFEAT by a street fighter after ${result.rounds} rounds. You took ${dmg} damage. Tou trained from the beating.`, "fight");
      } else if (mode === "ghost") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false, result.foeStats, result);
        logMsg(`The ghost of ${extra.name || "a fighter"} was too much. ${result.rounds} rounds in, you took ${dmg} damage. Their echo still stands.`, "fight");
      } else if (mode === "roamer") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false, result.foeStats, result);
        logMsg(`DEFEAT by ${extra.name}, a roaming fighter. You took ${dmg} damage.`, "fight");
      } else if (mode === "location") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false, result.foeStats, result);
        logMsg(`DEFEAT by ${extra.name} at ${extra.locName || "the gym"}. You took ${dmg} damage.`, "fight");
      } else {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false, result.foeStats, result);
        logMsg(`DEFEAT by ${extra.name} after ${result.rounds} rounds. You took ${dmg} damage. Train and try again.`, "fight");
      }
      if (num(state.Health) <= 0) {
        reincarnate("you succumbed to your wounds");
        state.InFight = false;
        state.AutoBattle = false;
      }
      updatePotential();
    }
    if (mode === "roamer" && extra && extra.key) markRoamerDefeated(extra.key, result.win !== true);
  }

  // ---- ghosts (single-player: local self-echoes) ----
  function captureGhost() {
    const list = getGhosts();
    let maxId = 0;
    for (const g of list) if (num(g.id) > maxId) maxId = num(g.id);
    const ghost = {
      id: maxId + 1,
      name: "You",
      style: activeStyle(),
      stats: {
        Str: attrValue("Str"), Tou: attrValue("Tou"), Spd: attrValue("Spd"),
        Int: attrValue("Int"), Cha: attrValue("Cha"),
      },
      potential: potential(),
      rank: state.PotRankName || "F-",
      wins: num(state.Wins),
      lives: num(state.Lives),
      capturedAt: Date.now(),
    };
    list.push(ghost);
    list.sort((a, b) => (b.potential || 0) - (a.potential || 0));
    if (list.length > MAX_GHOSTS) list.length = MAX_GHOSTS;
    persistGhosts(list);
  }

  function buildImaginationBoard() {
    const pot = potential();
    const board = [];
    const pool = IMAGINED_NPCS.slice();
    for (let k = 0; k < 3; k++) {
      if (pool.length === 0) break;
      const i = Math.floor(R() * pool.length);
      const npc = pool.splice(i, 1)[0];
      const m = (npc.mult || 0.9) * STYLE_TIER_MULT[styleTier(npc.style)];
      board.push({
        id: "npc_" + npc.key,
        name: npc.name,
        style: npc.style,
        rank: "?",
        potential: Math.floor(pot * m),
        kind: "npc",
        line: npc.line,
        stats: {
          Str: Math.max(1, Math.floor(attrValue("Str") * m)),
          Tou: Math.max(1, Math.floor(attrValue("Tou") * m)),
          Spd: Math.max(1, Math.floor(attrValue("Spd") * m)),
          Int: Math.max(1, Math.floor(attrValue("Int") * m)),
          Cha: 1,
        },
      });
    }
    const ghosts = getGhosts();
    const ghostPool = ghosts.slice();
    for (let pick = 0; pick < 3; pick++) {
      if (ghostPool.length === 0) break;
      const i = Math.floor(R() * ghostPool.length);
      const g = ghostPool.splice(i, 1)[0];
      board.push({
        id: "ghost_" + g.id,
        name: g.name,
        style: g.style,
        rank: g.rank,
        potential: g.potential,
        kind: "player",
        line: `The echo of ${g.name}, left on the mat by another fighter.`,
        stats: g.stats,
        ghostId: g.id,
      });
    }
    for (let i = board.length - 1; i >= 1; i--) {
      const j = Math.floor(R() * (i + 1));
      [board[i], board[j]] = [board[j], board[i]];
    }
    return board;
  }

  function listGhosts() {
    return buildImaginationBoard().map((e) => ({
      id: e.id, name: e.name, style: e.style, rank: e.rank,
      potential: e.potential, kind: e.kind, line: e.line,
    }));
  }

  function fightGhost(entryId) {
    if (num(state.Health) <= 0) return null;
    if (battle) return null;
    if (typeof entryId !== "string") return null;

    let foeStats;
    let foeStyle = "Brawling";
    let foeLabel = "The Imagined";
    let extra = {};

    if (entryId.startsWith("npc_")) {
      const key = entryId.slice(4);
      const npc = IMAGINED_NPCS.find((n) => n.key === key);
      if (!npc) { logMsg("The shadow slips from your mind. Focus and try again."); return null; }
      const m = (npc.mult || 0.9) * STYLE_TIER_MULT[styleTier(npc.style)];
      foeStats = {
        Str: Math.max(1, Math.floor(attrValue("Str") * m)),
        Tou: Math.max(1, Math.floor(attrValue("Tou") * m)),
        Spd: Math.max(1, Math.floor(attrValue("Spd") * m)),
        Int: Math.max(1, Math.floor(attrValue("Int") * m)),
        Cha: 1,
      };
      foeStyle = npc.style;
      foeLabel = npc.name;
      extra = { name: npc.name, potential: Math.floor(potential() * m), kind: "npc" };
    } else if (entryId.startsWith("ghost_")) {
      const ghostId = Number(entryId.slice(6));
      const ghost = getGhosts().find((g) => num(g.id) === ghostId);
      if (!ghost || !ghost.stats) { logMsg("That echo has faded from the mat. Pick another."); return null; }
      foeStats = ghost.stats;
      foeStyle = ghost.style || "Brawling";
      foeLabel = ghost.name;
      extra = { name: ghost.name, potential: ghost.potential, kind: "player" };
    } else {
      logMsg("You can't conjure that. Pick from the board.");
      return null;
    }

    const me = makeCombatant(currentStats(), activeStyle(), { isPlayer: true });
    const foe = makeCombatant(foeStats, foeStyle);
    if (!extra.style) extra.style = foeStyle;
    battle = { me, foe, mode: "ghost", extra, idx: 0, bet: 0, pot: potential(), round: 0, foeStats };
    state.InFight = true;
    const view = combatantToView(me, foe);
    view.foeName = foeLabel + " (IMAGINED)";
    view.round = 0;
    view.auto = state.AutoBattle === true;
    return view;
  }

  // ---- roaming fighters (free-roaming city NPCs) ----
  function buildRoamer(r) {
    const pot = potential();
    const cur = currentStats();
    const m = (r.mult || 1.0) * STYLE_TIER_MULT[styleTier(r.style)];
    return {
      key: r.key,
      name: r.name,
      district: r.district,
      zone: r.zone,
      style: r.style,
      chainStep: 1,
      stats: {
        Str: Math.max(1, Math.floor(cur.Str * m * (0.85 + R() * 0.3))),
        Tou: Math.max(1, Math.floor(cur.Tou * m * (0.85 + R() * 0.3))),
        Spd: Math.max(1, Math.floor(cur.Spd * m * (0.85 + R() * 0.3))),
        Int: Math.max(1, Math.floor(cur.Int * m * (0.85 + R() * 0.3))),
        Cha: 1,
      },
      reward: Math.max(1, Math.round((r.reward || 0) + Math.floor(pot / 20))),
      styleXp: 4 + Math.floor(pot / 100),
    };
  }

  function buildChainedRoamer(r, step = 1) {
    const pot = potential();
    const cur = currentStats();
    const stepMult = 1 + (step - 1) * 0.25;
    const allStyles = Object.keys(STYLES);
    const chosenStyle = step === 1 ? r.style : allStyles[Math.floor(R() * allStyles.length)];
    const m = (r.mult || 1.0) * stepMult * STYLE_TIER_MULT[styleTier(chosenStyle)];
    return {
      key: r.key,
      name: `${r.name} - Bout ${step}`,
      district: r.district,
      zone: r.zone,
      style: chosenStyle,
      chainStep: step,
      stats: {
        Str: Math.max(1, Math.floor(cur.Str * m * (0.85 + R() * 0.3))),
        Tou: Math.max(1, Math.floor(cur.Tou * m * (0.85 + R() * 0.3))),
        Spd: Math.max(1, Math.floor(cur.Spd * m * (0.85 + R() * 0.3))),
        Int: Math.max(1, Math.floor(cur.Int * m * (0.85 + R() * 0.3))),
        Cha: 1,
      },
      reward: Math.max(1, Math.round(((r.reward || 0) + Math.floor(pot / 20)) * Math.pow(1.3, step - 1))),
      styleXp: (4 + Math.floor(pot / 100)) * step,
    };
  }

  function getRoamer(key) {
    return ROAMERS.find((r) => r.key === key) || null;
  }

  function getRoamerDefeat(key) {
    const map = state.Roamers || {};
    const v = map[key];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function markRoamerDefeated(key, loss) {
    if (!state.Roamers) state.Roamers = {};
    if (loss) {
      const shortMs = Math.max(5, Math.round(roamerCooldownMs * COOLDOWN_LOSS_MULT));
      state.Roamers[key] = getNow() - roamerCooldownMs + shortMs;
    } else {
      state.Roamers[key] = getNow();
    }
  }

  function roamerStatus(key) {
    const def = getRoamerDefeat(key);
    if (def == null) return "ready";
    return getNow() >= def + roamerCooldownMs ? "ready" : "defeated";
  }

  function roamerRemaining(key) {
    const def = getRoamerDefeat(key);
    if (def == null) return 0;
    return Math.max(0, Math.ceil((def + roamerCooldownMs - getNow()) / 1000));
  }

  function spawnRoamers() {
    return ROAMERS.map(buildRoamer);
  }

  function fightRoamer(key) {
    if (num(state.Health) <= 0) return null;
    if (battle) return null;
    if (typeof key !== "string") return null;
    const roamer = getRoamer(key);
    if (!roamer) return null;
    if (roamerStatus(key) !== "ready") return null;
    const built = buildRoamer(roamer);
    const result = resolveFight(built.stats, built.style);
    concludeFight("roamer", built, 0, potential(), 0, result);
    return { result, mode: "roamer" };
  }

  function noteRoamerSeen(key) {
    if (!state.RoamerSeenAt) state.RoamerSeenAt = {};
    state.RoamerSeenAt[key] = Date.now();
  }
  function refreshRoamerRespawns() {
    if (!state.RoamerSeenAt) state.RoamerSeenAt = {};
    if (!state.RoamerZones) state.RoamerZones = {};
    const zones = ROAMERS.map((r) => r.zone);
    for (const r of ROAMERS) {
      const seen = Number(state.RoamerSeenAt[r.key] || 0);
      if (!seen || Date.now() - seen < 5 * 60 * 1000) continue;
      const choices = zones.filter((z) => z !== (state.RoamerZones[r.key] || r.zone));
      state.RoamerZones[r.key] = choices[Math.floor(R() * choices.length)] || r.zone;
      delete state.RoamerSeenAt[r.key];
      delete state.RoamerChallengerCache?.[r.key];
      logMsg(`${r.name} moved to a new part of the city.`);
    }
  }

  function roamerChallengers(key) {
    const roamer = getRoamer(key);
    if (!roamer) return [];
    if (!state.RoamerChallengerCache) state.RoamerChallengerCache = {};
    if (!Array.isArray(state.RoamerChallengerCache[key])) {
      const count = 3 + Math.floor(R() * 3);
      state.RoamerChallengerCache[key] = [];
      for (let i = 1; i <= count; i++) {
        const built = buildChainedRoamer(roamer, i);
        state.RoamerChallengerCache[key].push({ ...built, challengerIndex: i - 1, name: `${roamer.name} Challenger ${i}` });
      }
    }
    return state.RoamerChallengerCache[key];
  }

  function beginRoamerFight(key, step = 1, challengerIndex = 0) {
    if (num(state.Health) <= 0) return null;
    if (battle) return null;
    if (typeof key !== "string") return null;
    const roamer = getRoamer(key);
    if (!roamer) return null;
    if (roamerStatus(key) !== "ready") return null;
    const challengers = roamerChallengers(key);
    const built = challengers[Math.max(0, Math.min(challengers.length - 1, Number(challengerIndex) || 0))] || buildChainedRoamer(roamer, step);
    const me = makeCombatant(currentStats(), activeStyle(), { isPlayer: true });
    const foe = makeCombatant(built.stats, built.style);
    battle = { me, foe, mode: "roamer", extra: built, idx: 0, bet: 0, pot: potential(), round: 0, foeStats: built.stats };
    state.InFight = true;
    const view = combatantToView(me, foe);
    view.foeName = built.name;
    view.foeStyleName = STYLES[built.style] ? STYLES[built.style].name : built.style;
    view.playerStyleName = STYLES[activeStyle()].name;
    view.mode = "roamer";
    view.round = 0;
    view.auto = state.AutoBattle === true;
    view.events = [];
    view.chainStep = step;
    view.roamerKey = key;
    return view;
  }

  // ---- Arena Modes: Tournament & Gu Ritual ----
  function beginTourneyFight(round = 1) {
    if (num(state.Health) <= 0) return null;
    if (battle) return null;
    const pot = potential();
    const cur = currentStats();
    const m = 0.85 + (round - 1) * 0.35;
    const styles = Object.keys(STYLES);
    const foeStyle = styles[Math.floor(R() * styles.length)];
    const foeStats = {
      Str: Math.max(2, Math.floor(cur.Str * m)),
      Tou: Math.max(2, Math.floor(cur.Tou * m)),
      Spd: Math.max(2, Math.floor(cur.Spd * m)),
      Int: Math.max(1, Math.floor(cur.Int * m)),
      Cha: 1,
    };
    const names = ["Contender", "Pit Veteran", "Arena Champion"];
    const foeName = `${names[round - 1] || "Gladiator"} (${STYLES[foeStyle].name})`;
    const extra = {
      round,
      name: foeName,
      style: foeStyle,
      reward: 30 * round + Math.floor(pot / 10),
    };
    const me = makeCombatant(currentStats(), activeStyle(), { isPlayer: true });
    const foe = makeCombatant(foeStats, foeStyle);
    battle = { me, foe, mode: "tourney", extra, idx: 0, bet: 0, pot, round: 0, foeStats };
    state.InFight = true;
    const view = combatantToView(me, foe);
    view.foeName = foeName;
    view.foeStyleName = STYLES[foeStyle].name;
    view.playerStyleName = STYLES[activeStyle()].name;
    view.mode = "tourney";
    view.round = 0;
    view.auto = state.AutoBattle === true;
    view.events = [];
    view.tourneyRound = round;
    return view;
  }

  function beginGuFight(wave = 1) {
    if (num(state.Health) <= 0) return null;
    if (battle) return null;
    const pot = potential();
    const cur = currentStats();
    const m = 0.90 + (wave - 1) * 0.22;
    const styles = Object.keys(STYLES);
    const foeStyle = styles[Math.floor(R() * styles.length)];
    const foeStats = {
      Str: Math.max(3, Math.floor(cur.Str * m)),
      Tou: Math.max(3, Math.floor(cur.Tou * m)),
      Spd: Math.max(3, Math.floor(cur.Spd * m)),
      Int: Math.max(2, Math.floor(cur.Int * m)),
      Cha: 1,
    };
    const foeName = `Gu Survivor #${wave} (${STYLES[foeStyle].name})`;
    const extra = {
      wave,
      name: foeName,
      style: foeStyle,
      reward: 20 * wave,
    };
    const me = makeCombatant(currentStats(), activeStyle(), { isPlayer: true });
    const foe = makeCombatant(foeStats, foeStyle);
    battle = { me, foe, mode: "gu", extra, idx: 0, bet: 0, pot, round: 0, foeStats };
    state.InFight = true;
    const view = combatantToView(me, foe);
    view.foeName = foeName;
    view.foeStyleName = STYLES[foeStyle].name;
    view.playerStyleName = STYLES[activeStyle()].name;
    view.mode = "gu";
    view.round = 0;
    view.auto = state.AutoBattle === true;
    view.events = [];
    view.guWave = wave;
    return view;
  }

  // ---- manual combat ----
  function combatantToView(me, foe) {
    return {
      playerName: String(state.Name || "You"),
      playerTotalPower: Number(me.totalPower || 0),
      foeTotalPower: Number(foe.totalPower || 0),
      playerSpeed: Number(me.spd || 0),
      foeSpeed: Number(foe.spd || 0),
      escapeUsed: !!(battle && battle.escapeUsed),
      playerHp: Math.max(0, Math.floor(me.hp)),
      playerMaxHp: Math.floor(me.maxHp),
      playerStam: Math.max(0, Math.floor(me.stam)),
      playerMaxStam: Math.floor(me.maxStam),
      foeHp: Math.max(0, Math.floor(foe.hp)),
      foeMaxHp: Math.floor(foe.maxHp),
      foeStam: Math.max(0, Math.floor(foe.stam)),
      foeMaxStam: Math.floor(foe.maxStam),
      ultCharge: Math.floor(me.ultCharge),
      ultReady: me.ultCharge >= ULT_MAX,
      modeRounds: me.modeRounds,
      skills: me.skills,
      ultName: me.ultName,
    };
  }

  function beginFight() {
    if (num(state.Health) <= 0) return null;
    if (battle) return null;
    const setup = setupFoe();
    if (!setup) return null;
    const me = makeCombatant(currentStats(), activeStyle(), { isPlayer: true });
    const foe = makeCombatant(setup.foeStats, setup.foeStyle);
    const extra = setup.extra;
    if (!extra.style) extra.style = setup.foeStyle;
    battle = { me, foe, mode: setup.mode, extra, idx: setup.idx, bet: setup.bet, pot: potential(), round: 0, foeStats: setup.foeStats };
    state.InFight = true;
    const view = combatantToView(me, foe);
    view.foeName = setup.foeName;
    view.foeStyleName = STYLES[setup.foeStyle].name;
    view.playerStyleName = STYLES[activeStyle()].name;
    view.mode = setup.mode;
    view.round = 0;
    view.auto = state.AutoBattle === true;
    view.events = [];
    return view;
  }

  function activateUlt() {
    if (!battle) return null;
    const me = battle.me;
    if (me.ultCharge < ULT_MAX || me.modeRounds > 0) return currentCombatView();
    me.modeRounds = Math.min(MODE_DUR_BASE + Math.floor(me.int / MODE_DUR_PER_INT), MODE_DUR_CAP);
    me.ultCharge = 0;
    return currentCombatView();
  }

  function currentCombatView() {
    if (!battle) return null;
    const view = combatantToView(battle.me, battle.foe);
    view.foeName = battle.foeName || battle.extra.name;
    view.round = battle.round;
    view.finished = false;
    view.events = [];
    return view;
  }

  function fightMove(skillName) {
    if (!battle) return null;
    const me = battle.me;
    const foe = battle.foe;
    if (me.hp <= 0 || foe.hp <= 0) {
      battle = null;
      state.InFight = false;
      return null;
    }

    if (battle.attacksLanded === undefined) {
      battle.attacksLanded = 0;
      battle.dodges = 0;
      battle.dmgDealt = 0;
      battle.dmgTaken = 0;
    }

    let chosen = null;
    for (const s of me.skills) { if (s.name === skillName) { chosen = s; break; } }
    if (!chosen) chosen = pickSkill(me);

    battle.round += 1;
    me.stam -= me.drain;
    foe.stam -= foe.drain;

    for (const c of [me, foe]) {
      if (c.modeRounds > 0) {
        c.modeRounds -= 1;
      } else if (c === foe && c.ultCharge >= ULT_MAX) {
        // Foe's awakening auto-fires at full charge.
        c.modeRounds = Math.min(MODE_DUR_BASE + Math.floor(c.int / MODE_DUR_PER_INT), MODE_DUR_CAP);
        c.ultCharge = 0;
      } else {
        // Player accumulates charge; the ULTIMATE button triggers it (web UX).
        c.ultCharge = Math.min(ULT_MAX, c.ultCharge + ULT_CHARGE_BASE + c.int * ULT_CHARGE_PER_INT);
      }
    }

    let first = me, second = foe;
    const meSpd = me.spd * (me.status.limbLeg ? 0.6 : 1);
    const foeSpd = foe.spd * (foe.status.limbLeg ? 0.6 : 1);
    if (foeSpd > meSpd) { first = foe; second = me; }

    const events = [];
    tickStatuses(me, events);
    tickStatuses(foe, events);
    const doStrike = (att, def, skill, isPlayer) => {
      const ev = strikeEvent(att, def, skill, isPlayer, R);
      if (isPlayer) {
        if (!ev.dodged) { battle.attacksLanded++; battle.dmgDealt += ev.damage; }
      } else {
        if (ev.dodged) { battle.dodges++; } else { battle.dmgTaken += ev.damage; }
      }
      if (!isPlayer) {
        const foeStyleId = battle.extra.style || "Brawling";
        const gain = onPlayerHit(foeStyleId, skill, ev.damage);
        if (gain > 0) {
          ev.knowledgeGain = Math.round(gain);
          ev.knowledgeStyle = STYLES[foeStyleId] ? STYLES[foeStyleId].name : foeStyleId;
        }
      }
      events.push(ev);
    };

    const foeSkill = pickSkill(foe);
    if (first === me) {
      doStrike(me, foe, chosen, true);
      if (foe.hp > 0) doStrike(foe, me, foeSkill, false);
    } else {
      doStrike(foe, me, foeSkill, false);
      if (me.hp > 0) doStrike(me, foe, chosen, true);
    }

    selfTrainTick(activeStyle());

    const MAX_COMBAT_ROUNDS = 10000;
    const roundNum = battle.round;
    stampEvents(events, 0, roundNum, me, foe);
    const finished = me.hp <= 0 || foe.hp <= 0 || me.stam <= 0 || foe.stam <= 0 || roundNum >= MAX_COMBAT_ROUNDS;
    if (finished) {
      if (me.hp <= 0 && foe.hp <= 0) me.hp = 0;
      const won = (me.hp > 0 && foe.hp <= 0) || (me.hp > 0 && foe.stam <= 0 && me.stam > 0);
      const result = {
        win: won, rounds: roundNum, playerHpLeft: Math.max(0, me.hp),
        playerSkill: chosen.name, foeSkill: foeSkill.name,
        attacksLanded: battle.attacksLanded, dodges: battle.dodges,
        dmgDealt: battle.dmgDealt, dmgTaken: battle.dmgTaken,
        foeStats: battle.foeStats,
      };
      concludeFight(battle.mode, battle.extra, battle.idx, battle.pot, battle.bet, result);
      battle = null;
      state.InFight = false;
      const view = combatantToView(me, foe);
      view.finished = true;
      view.win = won;
      view.round = roundNum;
      view.events = events;
      return view;
    }

    const view = combatantToView(me, foe);
    view.round = roundNum;
    view.finished = false;
    view.events = events;
    return view;
  }

  function forfeit() {
    if (!battle) return;
    const result = { win: false, rounds: battle.round, playerHpLeft: 0, playerSkill: "Forfeit", foeSkill: "—", attacksLanded: 0, dodges: 0, dmgDealt: 0, dmgTaken: 0, foeStats: battle.foeStats };
    concludeFight(battle.mode, battle.extra, battle.idx, battle.pot, battle.bet, result);
    battle = null;
    state.InFight = false;
    logMsg("You forfeited the bout. The hub awaits — train and come back stronger.", "fight");
  }

  // ---- simple actions ----
  function setName(name) {
    const n = String(name ?? "").trim();
    state.Name = n === "" ? "You" : n;
  }

  function setActivity(key) {
    if (ACTIVITIES[key]) {
      state.Activity = key;
      logMsg(`Now doing: ${ACTIVITIES[key].name}.`);
    }
  }

  function setLocation(key) {
    const loc = LOCATIONS[key];
    if (!loc) return;
    if (num(state.RivalIdx) <= loc.unlock) {
      logMsg(`${loc.name} isn't open to you yet.`);
      return;
    }
    state.Location = key;
    logMsg(`You arrive at ${loc.name}.`);
  }

  // ---- movement ----
  let moveStartX = MAP_POS.home[0];
  let moveStartY = MAP_POS.home[1];

  function beginMove(locKey) {
    const loc = LOCATIONS[locKey];
    if (!loc) return false;
    if (num(state.RivalIdx) <= loc.unlock) {
      logMsg(`${loc.name} isn't open to you yet.`);
      return false;
    }
    const target = MAP_POS[locKey];
    if (!target) return false;
    if (!state.MovingTo && state.Location === locKey) {
      state.PlayerX = target[0];
      state.PlayerY = target[1];
      state.routePath = null;
      state.routeRemainingDistance = 0;
      logMsg(`You are already at ${loc.name}.`);
      return false;
    }
    state.MovingTo = locKey;
    state.MoveProgress = 0;
    const sx = num(state.PlayerX), sy = num(state.PlayerY);
    moveStartX = sx;
    moveStartY = sy;
    state.routePath = computeRoute(sx, sy, target[0], target[1]);
    state.routeIndex = 0;
    state.moveSegmentStartX = sx;
    state.moveSegmentStartY = sy;
    state.routeTotalDistance = 0;
    for (let i = 0; i < state.routePath.length - 1; i++) {
      state.routeTotalDistance += Math.hypot(state.routePath[i + 1][0] - state.routePath[i][0], state.routePath[i + 1][1] - state.routePath[i][1]);
    }
    state.routeRemainingDistance = state.routeTotalDistance;
    return true;
  }

  function moveStep(dt) {
    if (!state.MovingTo || state.InFight) return null;
    const target = MAP_POS[state.MovingTo];
    if (!target) {
      arriveAt(state.MovingTo);
      return { arrived: true };
    }
    const path = state.routePath;
    if (!path || path.length < 2) {
      arriveAt(state.MovingTo);
      return { arrived: true };
    }
    // Advance along the current segment.
    let idx = state.routeIndex || 0;
    const sx = state.moveSegmentStartX, sy = state.moveSegmentStartY;
    const wp = path[Math.min(idx + 1, path.length - 1)];
    const tx = wp[0], ty = wp[1];
    const dx = tx - sx, dy = ty - sy;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen < 1) {
      // Segment done — advance to next.
      state.routeIndex = idx + 1;
      state.moveSegmentStartX = tx;
      state.moveSegmentStartY = ty;
      if (idx + 1 >= path.length - 1) {
        arriveAt(state.MovingTo);
        return { arrived: true };
      }
      return moveStep(dt);
    }
    const spd = attrValue("Spd");
    const travelTime = segLen / (MOVE_BASE_SPEED * (1 + spd * 0.12));
    const step = dt / Math.max(0.01, travelTime);
    const movedDistance = Math.min(segLen, Math.max(0, segLen * step));
    state.MoveProgress = num(state.MoveProgress) + step;
    state.routeRemainingDistance = Math.max(0, num(state.routeRemainingDistance) - movedDistance);
    // Movement is an actual progression source: Speed grows visibly while traveling.
    state.Spd = num(state.Spd) + 0.02 * attrApt("Spd");
    // Encounter ONLY if "searching for trouble" is ON; otherwise walking is safe.
    if (state.Looking === true && R() < MOVE_ENC_CHANCE && !state.InFight) {
      state.Encounter = 1;
      state.MoveProgress = 0;
      return { encounter: true };
    }
    if (state.MoveProgress >= 1) {
      // Segment complete — advance to next waypoint.
      state.routeIndex = idx + 1;
      state.moveSegmentStartX = tx;
      state.moveSegmentStartY = ty;
      state.MoveProgress = 0;
      if (idx + 1 >= path.length - 1) {
        arriveAt(state.MovingTo);
        return { arrived: true };
      }
      return { moving: true, progress: 0 };
    }
    const t = Math.min(1, state.MoveProgress);
    state.PlayerX = sx + dx * t;
    state.PlayerY = sy + dy * t;
    return { moving: true, progress: state.MoveProgress };
  }

  function arriveAt(locKey) {
    const loc = LOCATIONS[locKey];
    state.Location = locKey;
    state.MovingTo = null;
    state.MoveProgress = 0;
    state.routePath = null;
    state.routeIndex = 0;
    state.routeRemainingDistance = 0;
    const target = MAP_POS[locKey];
    if (target) {
      state.PlayerX = target[0];
      state.PlayerY = target[1];
    }
    if (loc) logMsg(`You arrive at ${loc.name}.`);
  }

  // ---- escape ----
  function tryEscape() {
    if (!battle) return { escaped: false };
    const mode = battle.mode;
    if (mode !== "encounter" && mode !== "roamer") {
      logMsg("Can't escape from this fight!");
      return { escaped: false, chance: 0, used: false };
    }
    if (battle.escapeUsed) {
      logMsg("You've already tried to escape this battle.");
      return { escaped: false, chance: 0, used: true };
    }
    battle.escapeUsed = true;
    const playerSpd = Math.max(1, Number(battle.me.spd) || 1);
    const foeSpd = Math.max(1, Number(battle.foe.spd) || 1);
    const escapeChance = Math.max(0.05, Math.min(0.95, playerSpd / (playerSpd + foeSpd)));
    if (R() < escapeChance) {
      state.Cha = num(state.Cha) + 0.03 * attrApt("Cha");
      battle = null;
      state.InFight = false;
      logMsg("You escaped!", "fight");
      return { escaped: true, chance: escapeChance, used: true };
    }
    logMsg(`Couldn't escape! (${Math.round(escapeChance * 100)}% chance)`, "fight");
    return { escaped: false, chance: escapeChance, used: true };
  }

  function setLooking(on) {
    state.Looking = on === true;
    logMsg(on === true ? "You're looking for fights. Careful out there." : "You stop looking for fights. Back to training.");
  }

  function setStyle(styleId) {
    if (activeBuild()) {
      state.Build = "";
      publishStyleSkills();
    }
    if (STYLES[styleId] && learnedStyles()[styleId]) {
      const st = STYLES[styleId];
      state.ActiveStyle = styleId;
      const bonuses = [];
      if (st.dmg > 1) bonuses.push(`dmg +${Math.round((st.dmg - 1) * 100)}%`);
      if (st.dodge > 0) bonuses.push(`dodge +${Math.round(st.dodge * 100)}%`);
      if (st.crit > 0) bonuses.push(`crit +${Math.round(st.crit * 100)}%`);
      const bonusText = bonuses.length > 0 ? ` (${bonuses.join(", ")})` : "";
      publishStyleSkills();
      logMsg(`You adopt ${st.name}${bonusText}. Ultimate: ${st.ult && st.ult.name ? st.ult.name : "Berserk"}.`);
    }
  }

  function adminSetStat(id, value) {
    if (!(ATTRIBUTES || []).some((a) => a.id === id)) return false;
    state[id] = Math.max(0, Number(value) || 0);
    clampVitals();
    updatePotential();
    return true;
  }
  function adminAddItem(key, qty = 1) {
    if (!key) return false;
    if (!Array.isArray(state.Inventory)) state.Inventory = [];
    const n = Math.max(1, Math.floor(Number(qty) || 1));
    const item = state.Inventory.find((x) => x.key === key);
    if (item) item.qty = Number(item.qty || 0) + n;
    else state.Inventory.push({ key: String(key), qty: n });
    return true;
  }
  function adminSetMoney(value) { state.Money = Math.max(0, Number(value) || 0); return true; }
  function adminHeal() { state.Health = maxHealth(); state.Stamina = maxStamina(); state.Nutrition = maxNutrition(); return true; }
  function adminUnlockAll() { state.RivalIdx = MAX_TOTAL; for (const k of Object.keys(LOCATIONS)) state.LocationFights[k] = [1,2,3,4,5]; return true; }

  // ---- store ----
  function hasBuff(name) {
    return (Array.isArray(state.StoreBuffs) ? state.StoreBuffs : []).some((b) => b && b.name === name && num(b.daysLeft) > 0);
  }

  function buyItem(key) {
    const item = ALL_STORE_ITEMS.find((i) => i.key === key);
    if (!item) return false;
    if (num(state.Money) < item.price) {
      logMsg("Not enough Cash.");
      return false;
    }
    state.Money = num(state.Money) - item.price;
    state.Cha = num(state.Cha) + 0.02 * attrApt("Cha");

    // Permanent items (e.g. mat) go to OwnedItems
    if (item.permanent) {
      if (!Array.isArray(state.OwnedItems)) state.OwnedItems = [];
      if (!state.OwnedItems.includes(key)) state.OwnedItems.push(key);
      logMsg(`Bought ${item.name} for ${item.price} Cash.`, "store");
      clampVitals();
      updatePotential();
      return true;
    }

    // Consumable items: add to inventory
    if (!Array.isArray(state.Inventory)) state.Inventory = [];
    const inv = state.Inventory;
    const existing = inv.find((e) => e.key === item.key);
    if (existing) {
      existing.qty += 1;
    } else {
      inv.push({ key: item.key, qty: 1 });
    }
    logMsg(`Bought ${item.name} — in inventory (qty ${existing ? existing.qty : 1}).`, "store");
    return true;
  }

  function useItem(key) {
    const inv = Array.isArray(state.Inventory) ? state.Inventory : [];
    const entry = inv.find((e) => e.key === key);
    if (!entry || entry.qty <= 0) return false;
    const item = ALL_STORE_ITEMS.find((i) => i.key === key);
    if (!item) return false;
    if (item.permanent) return false;
    if (item.raw) return false;
    if (item.nutrition) {
      state.Nutrition = clamp(num(state.Nutrition) + item.nutrition, 0, maxNutrition());
    }
    if (item.health) {
      state.Health = clamp(num(state.Health) + item.health, 0, maxHealth());
    }
    if (item.stamina) {
      state.Stamina = clamp(num(state.Stamina) + item.stamina, 0, maxStamina());
    }
    if (item.stat) {
      if (!state.TempBoosts) state.TempBoosts = {};
      state.TempBoosts[item.stat] = num(state.TempBoosts[item.stat]) + item.amount;
    }
    entry.qty -= 1;
    if (entry.qty <= 0) {
      state.Inventory = inv.filter((e) => e.qty > 0);
    }
    logMsg(`Used ${item.name}.`, "store");
    clampVitals();
    updatePotential();
    return true;
  }

  function autoEatFood() {
    if (num(state.Nutrition) > 30) return;
    const inv = Array.isArray(state.Inventory) ? state.Inventory : [];
    // Try rice first
    const rice = inv.find((e) => e.key === "rice");
    if (rice && rice.qty > 0) {
      state.Nutrition = clamp(num(state.Nutrition) + 20, 0, maxNutrition());
      rice.qty -= 1;
      if (rice.qty <= 0) {
        state.Inventory = inv.filter((e) => e.qty > 0);
      }
      logMsg("Ate rice from inventory (+20 Nutrition).", "eat");
      return;
    }
    // Try any non-raw prepared food
    for (const e of inv) {
      if (e.qty <= 0) continue;
      const item = ALL_STORE_ITEMS.find((i) => i.key === e.key);
      if (!item || item.raw || !item.nutrition) continue;
      state.Nutrition = clamp(num(state.Nutrition) + item.nutrition, 0, maxNutrition());
      e.qty -= 1;
      if (e.qty <= 0) {
        state.Inventory = inv.filter((x) => x.qty > 0);
      }
      logMsg(`Ate ${item.name} from inventory (+${item.nutrition} Nutrition).`, "eat");
      return;
    }
  }

  function cookItem(rawKey) {
    const inv = Array.isArray(state.Inventory) ? state.Inventory : [];
    const entry = inv.find((e) => e.key === rawKey);
    if (!entry || entry.qty <= 0) return false;
    const rawItem = ALL_STORE_ITEMS.find((i) => i.key === rawKey);
    if (!rawItem || !rawItem.cookTo) return false;
    entry.qty -= 1;
    if (entry.qty <= 0) {
      state.Inventory = inv.filter((e) => e.qty > 0);
    }
    const cookedKey = rawItem.cookTo;
    if (!Array.isArray(state.Inventory)) state.Inventory = [];
    const existing = state.Inventory.find((e) => e.key === cookedKey);
    if (existing) {
      existing.qty += 1;
    } else {
      state.Inventory.push({ key: cookedKey, qty: 1 });
    }
    const cookedItem = ALL_STORE_ITEMS.find((i) => i.key === cookedKey);
    logMsg(`Cooked ${rawItem.name} into ${cookedItem ? cookedItem.name : cookedKey}.`, "eat");
    return true;
  }

  function inventory() {
    return Array.isArray(state.Inventory) ? state.Inventory : [];
  }

  // ---- tasklist ----
  function setTaskList(list, repeat) {
    const valid = [];
    for (const k of list) {
      if (typeof k === "string" && ACTIVITIES[k]) {
        valid.push({ act: k, n: 1, origN: 1 });
      } else if (k && typeof k === "object" && ACTIVITIES[k.act]) {
        const n = Math.max(1, Math.floor(num(k.n) || 1));
        valid.push({ act: k.act, n, origN: n });
      }
    }
    state.TaskList = valid.slice(0, 20);
    state.TaskRepeat = repeat === true;
    state.TaskIndex = 0;
  }

  function addTask(activityKey, count) {
    if (!ACTIVITIES[activityKey]) return false;
    if (!canAddToTask(activityKey)) return false;
    if (!Array.isArray(state.TaskList)) state.TaskList = [];
    if (state.TaskList.length >= 20) return false;
    const n = Math.max(1, Math.min(99, Math.floor(num(count) || 1)));
    state.TaskList.push({ act: activityKey, n, origN: n });
    return true;
  }

  function removeTask(index) {
    if (!Array.isArray(state.TaskList)) return false;
    if (index < 0 || index >= state.TaskList.length) return false;
    state.TaskList.splice(index, 1);
    return true;
  }

  // ---- gym training purchase ----
  function buyTraining(activityKey) {
    const item = GYM_TRAINING.find((t) => t.key === activityKey);
    if (!item) return false;
    if (num(state.Money) < item.cost) {
      logMsg(`Not enough Cash to buy ${item.name} training (${item.cost} Cash).`);
      return false;
    }
    if (item.unlock === "permanent") {
      if (!Array.isArray(state.OwnedTraining)) state.OwnedTraining = [];
      if (state.OwnedTraining.includes(activityKey)) return false;
      state.Money = num(state.Money) - item.cost;
      state.OwnedTraining.push(activityKey);
      logMsg(`Bought ${item.name} training for ${item.cost} Cash.`, "store");
    } else if (item.unlock === "consumable") {
      state.Money = num(state.Money) - item.cost;
      if (!state.Consumables) state.Consumables = {};
      state.Consumables[activityKey] = (state.Consumables[activityKey] || 0) + (item.uses || 1);
      logMsg(`Bought ${item.name} x${item.uses || 1} for ${item.cost} Cash.`, "store");
    } else {
      return false;
    }
    state.Cha = num(state.Cha) + 0.02 * attrApt("Cha");
    return true;
  }

  function hasTraining(activityKey) {
    const gymEntry = GYM_TRAINING.find((t) => t.key === activityKey);
    if (!gymEntry) return true;
    if (gymEntry.unlock === "permanent") {
      return Array.isArray(state.OwnedTraining) && state.OwnedTraining.includes(activityKey);
    } else if (gymEntry.unlock === "consumable") {
      return state.Consumables && (state.Consumables[activityKey] || 0) > 0;
    }
    return false;
  }

  function canAddToTask(activityKey) {
    if (!ACTIVITIES[activityKey]) return false;
    const gymEntry = GYM_TRAINING.find((t) => t.key === activityKey);
    if (!gymEntry) return true;
    if (gymEntry.unlock === "permanent") {
      return Array.isArray(state.OwnedTraining) && state.OwnedTraining.includes(activityKey);
    } else if (gymEntry.unlock === "consumable") {
      return state.Consumables && (state.Consumables[activityKey] || 0) > 0;
    }
    return false;
  }

  // ---- equipment ----
  function buyEquipment(key) {
    const item = EQUIPMENT.find((e) => e.key === key);
    if (!item) return false;
    if (!Array.isArray(state.OwnedEquipment)) state.OwnedEquipment = [];
    if (state.OwnedEquipment.includes(key)) return false;
    if (num(state.Money) < item.cost) {
      logMsg(`Not enough Cash to buy ${item.name} (${item.cost} Cash).`);
      return false;
    }
    state.Money = num(state.Money) - item.cost;
    state.OwnedEquipment.push(key);
    state.Cha = num(state.Cha) + 0.02 * attrApt("Cha");
    if (!state.Equipment) state.Equipment = {};
    state.Equipment[item.slot] = key;
    logMsg(`Bought and equipped ${item.name}.`, "store");
    return true;
  }

  function equipItem(key) {
    if (!Array.isArray(state.OwnedEquipment) || !state.OwnedEquipment.includes(key)) return false;
    const item = EQUIPMENT.find((e) => e.key === key);
    if (!item) return false;
    if (!state.Equipment) state.Equipment = {};
    if (state.Equipment[item.slot] === key) return false;
    state.Equipment[item.slot] = key;
    logMsg(`Equipped ${item.name}.`);
    return true;
  }

  function unequipItem(key) {
    const item = EQUIPMENT.find((e) => e.key === key);
    if (!item) return false;
    if (!state.Equipment) state.Equipment = {};
    if (state.Equipment[item.slot] !== key) return false;
    delete state.Equipment[item.slot];
    logMsg(`Unequipped ${item.name}.`);
    return true;
  }

  function trainingEquipMult(attr) {
    if (!state.Equipment) return 1;
    let mult = 1;
    for (const item of EQUIPMENT) {
      if (state.Equipment[item.slot] === item.key) {
        if (!item.attrs || item.attrs.includes(attr)) {
          mult *= item.buffMult;
        }
      }
    }
    return mult;
  }

  function trainingAt(locKey) {
    return TRAINING[locKey] || {};
  }

  function trainTier(activityKey) {
    return state.TrainTiers[activityKey] || 0;
  }

  function trainTierName(activityKey) {
    const chain = trainChain(activityKey);
    if (!chain) return null;
    return chain.tiers[trainTier(activityKey)].name;
  }

  function trainTierProgress(activityKey) {
    const chain = trainChain(activityKey);
    if (!chain) return null;
    const tier = trainTier(activityKey);
    const t = chain.tiers[tier];
    return { tier, progress: state.TrainProgress[activityKey] || 0, req: t.req };
  }

  // ---- tasklist consumption helper ----
  function consumeTaskItem() {
    const tl = Array.isArray(state.TaskList) ? state.TaskList : [];
    if (tl.length === 0) return;
    const idx = Math.min(state.TaskIndex || 0, tl.length - 1);
    const item = tl[idx];
    if (!item || typeof item !== "object") {
      if (state.TaskRepeat) { state.TaskIndex = 0; }
      else { state.TaskIndex = 0; }
      return;
    }
    // Decrement consumable training stock if applicable
    const gymEntry = GYM_TRAINING.find((t) => t.key === item.act);
    if (gymEntry && gymEntry.unlock === "consumable" && state.Consumables) {
      if ((state.Consumables[item.act] || 0) > 0) {
        state.Consumables[item.act] -= 1;
      }
    }
    if (item.n > 1) {
      item.n -= 1;
    } else {
      if (state.TaskRepeat) {
        state.TaskIndex = idx + 1;
        if (state.TaskIndex >= tl.length) {
          state.TaskIndex = 0;
          for (const t of tl) { if (t && typeof t === "object") t.n = t.origN !== undefined ? t.origN : 1; }
        }
      } else {
        // Mark done but keep in list — don't splice.
        item.n = 0;
        // Advance to next unfinished task, or stop.
        let next = idx + 1;
        while (next < tl.length && tl[next].n <= 0) next++;
        if (next < tl.length) {
          state.TaskIndex = next;
        } else {
          state.TaskIndex = 0;
          // All done — reset counts for potential re-use.
          for (const t of tl) { if (t && typeof t === "object" && t.n <= 0) t.n = t.origN !== undefined ? t.origN : 1; }
        }
      }
    }
  }

  function taskList() {
    return Array.isArray(state.TaskList) ? state.TaskList : [];
  }

  // ---- the day ----
  function doDay() {
    if (num(state.Health) <= 0) return;
    if (state.InFight) return;

    // 1) Nutrition
    autoEatFood();
    let nutrition = num(state.Nutrition) - 1;
    if (nutrition <= 0) {
      const money = num(state.Money);
      if (money >= 5) {
        state.Money = money - 5;
        nutrition = 20;
        logMsg("Hungry — bought a bowl of rice for 5 Cash.", "eat");
      } else {
        nutrition = 0;
        state.Health = num(state.Health) - 5;
        logMsg("Starvation! You have no food and no money. -5 Health.", "eat");
      }
    }
    state.Nutrition = clamp(nutrition, 0, maxNutrition());

    // 2) Activity
    const tl = Array.isArray(state.TaskList) ? state.TaskList : [];
    let usedTask = false;
    let actKey;
    const tIdx = state.TaskIndex || 0;
    if (tl.length > 0 && tIdx < tl.length) {
      actKey = String(tl[tIdx].act ?? "Rest");
      usedTask = true;
    } else {
      actKey = String(state.Activity ?? "Rest");
    }
    actKey = ACTIVITY_ALIAS[actKey] || actKey;
    let act = ACTIVITIES[actKey] || ACTIVITIES.Rest;
    const stamina = num(state.Stamina);
    if (actKey !== "Rest" && stamina < act.cost) {
      act = ACTIVITIES.Rest;
      actKey = "Rest";
      logMsg("Too tired to train — you rest instead.");
    }
    const locKey = String(state.Location ?? "home");
    const loc = LOCATIONS[locKey] || LOCATIONS.home;
    const locName = loc.name;

    // Training via tasklist works anywhere the player has purchased the training
    // (from the City Gym), regardless of current location.
    if (actKey !== "Rest" && actKey !== "OddJobs" && act.attr) {
      if (!hasTraining(actKey)) {
        logMsg(`You haven't purchased training for ${actKey} yet.`);
        actKey = "Rest";
        act = ACTIVITIES.Rest;
      }
    }

    if (actKey === "Rest") {
      state.Stamina = Math.min(maxStamina(), stamina + 35);
      state.Health = Math.min(maxHealth(), num(state.Health) + 2);
    } else if (actKey === "OddJobs") {
      const money = act.moneyBase + Math.floor(attrValue("Cha") * act.moneyCha);
      state.Money = num(state.Money) + money;
      state.Stamina = stamina - act.cost;
      logMsg(`Odd jobs: +${money} Cash.`, "money");
    } else if (act.attr) {
      const chain = trainChain(actKey);
      const tierIdx = chain ? trainTier(actKey) : 0;
      const tier = chain ? chain.tiers[tierIdx] : null;
      const gainMult = tier ? tier.gainMult : 1.0;
      const costMult = tier ? tier.costMult : 1.0;
      const equipMult = trainingEquipMult(act.attr);
      const gain = act.gain * gainMult * attrApt(act.attr) * equipMult;
      state[act.attr] = num(state[act.attr]) + gain;
      let cost = act.cost;
      if (actKey === "Running") cost = Math.floor(cost * 1.5);
      cost = Math.ceil(cost * costMult);
      state.Stamina = stamina - cost;
      if (act.staminaBonus) state.Stamina = Math.min(maxStamina(), num(state.Stamina) + act.staminaBonus);
      const attrName = ATTRIBUTES.find((a) => a.id === act.attr).name;
      let sxp = "";
      if (loc.styleGym && loc.styleGym === activeStyle()) {
        addStyleXp(loc.styleGym, STYLEXP_TRAIN);
        sxp = ` — style mastery +${STYLEXP_TRAIN}`;
      }
      const tierLabel = tier ? ` [${tier.name}]` : "";
      logMsg(`Training: +${gain.toFixed(2)} ${attrName}${tierLabel}.${sxp}`, "train");

      if (chain) {
        if (tierIdx + 1 < chain.tiers.length) {
          state.TrainProgress[actKey] = (state.TrainProgress[actKey] || 0) + 1;
          const nextTier = chain.tiers[tierIdx + 1];
          if (state.TrainProgress[actKey] >= nextTier.req) {
            state.TrainTiers[actKey] = tierIdx + 1;
            state.TrainProgress[actKey] = 0;
            logMsg(`Tier up! ${tier.name} → ${nextTier.name}. Training improved!`, "train");
          }
        }
      }

      if (state.Looking === true && locName !== "Home" && locName !== "Clinic" && R() < ENC_CHANCE) {
        state.Encounter = 1;
        logMsg("A street fighter squares up! (Use FIGHT to accept.)");
      }
    }

    // 3) Age
    state.AgeDays = num(state.AgeDays) + 1;

    // Advance tasklist
    if (usedTask) consumeTaskItem();

    // 4) Lifespan
    state.Lifespan = Math.min(60, BASE_LIFESPAN + attrValue("Tou") / 2);

    // 4b) Store buffs tick down
    if (Array.isArray(state.StoreBuffs) && state.StoreBuffs.length > 0) {
      const kept = [];
      for (const b of state.StoreBuffs) {
        const d = num(b.daysLeft) - 1;
        if (d <= 0) {
          logMsg(`${BUFF_LABELS[b.name] || b.name} wore off.`);
        } else {
          kept.push({ name: b.name, daysLeft: d });
        }
      }
      state.StoreBuffs = kept;
    }

    // 5) Death
    const health = num(state.Health);
    const ageYears = num(state.AgeDays) / 365;
    if (health <= 0) {
      reincarnate("you succumbed to your wounds");
    } else if (ageYears >= state.Lifespan) {
      reincarnate("you died of old age");
    }

    updatePotential();
  }

  // ---- manual / speed advance (tasklist only) ----
  function advanceDay() {
    if (num(state.Health) <= 0) return false;
    if (state.InFight) return false;
    const tl = Array.isArray(state.TaskList) ? state.TaskList : [];
    if (tl.length === 0) return false;

    const tIdx = Math.min(state.TaskIndex || 0, tl.length - 1);
    const actKey = tl[tIdx].act;
    let act = ACTIVITIES[actKey] || ACTIVITIES.Rest;
    const stamina = num(state.Stamina);
    if (actKey !== "Rest" && actKey !== "OddJobs" && stamina < act.cost) {
      act = ACTIVITIES.Rest;
      logMsg("Too tired — you rest instead.");
    }

    const locKey = String(state.Location ?? "home");
    const loc = LOCATIONS[locKey] || LOCATIONS.home;

    if (actKey === "Rest") {
      state.Stamina = Math.min(maxStamina(), stamina + 35);
      state.Health = Math.min(maxHealth(), num(state.Health) + 2);
    } else if (actKey === "OddJobs") {
      const money = act.moneyBase + Math.floor(attrValue("Cha") * act.moneyCha);
      state.Money = num(state.Money) + money;
      state.Stamina = stamina - act.cost;
      logMsg(`Odd jobs: +${money} Cash.`, "money");
    } else if (act.attr) {
      if (!hasTraining(actKey)) {
        state.Stamina = Math.min(maxStamina(), stamina + 35);
        logMsg("Haven't purchased that training — resting.");
      } else {
        const chain = trainChain(actKey);
        const tierIdx = chain ? trainTier(actKey) : 0;
        const tier = chain ? chain.tiers[tierIdx] : null;
        const gainMult = tier ? tier.gainMult : 1.0;
        const costMult = tier ? tier.costMult : 1.0;
        const equipMult = trainingEquipMult(act.attr);
        const gain = act.gain * gainMult * attrApt(act.attr) * equipMult;
        state[act.attr] = num(state[act.attr]) + gain;
        let cost = act.cost;
        if (actKey === "Running") cost = Math.floor(cost * 1.5);
        cost = Math.ceil(cost * costMult);
        state.Stamina = stamina - cost;
        if (act.staminaBonus) state.Stamina = Math.min(maxStamina(), num(state.Stamina) + act.staminaBonus);
        const attrName = ATTRIBUTES.find((a) => a.id === act.attr).name;
        logMsg(`Training: +${gain.toFixed(2)} ${attrName} (advance day).`, "train");

        if (chain && tierIdx + 1 < chain.tiers.length) {
          state.TrainProgress[actKey] = (state.TrainProgress[actKey] || 0) + 1;
          const nextTier = chain.tiers[tierIdx + 1];
          if (state.TrainProgress[actKey] >= nextTier.req) {
            state.TrainTiers[actKey] = tierIdx + 1;
            state.TrainProgress[actKey] = 0;
            logMsg(`Tier up! ${tier.name} → ${nextTier.name}.`, "train");
          }
        }
      }
    }

    state.AgeDays = num(state.AgeDays) + 1;
    consumeTaskItem();

    state.Lifespan = Math.min(60, BASE_LIFESPAN + attrValue("Tou") / 2);

    if (Array.isArray(state.StoreBuffs) && state.StoreBuffs.length > 0) {
      const kept = [];
      for (const b of state.StoreBuffs) {
        const d = num(b.daysLeft) - 1;
        if (d <= 0) { logMsg(`${BUFF_LABELS[b.name] || b.name} wore off.`); }
        else { kept.push({ name: b.name, daysLeft: d }); }
      }
      state.StoreBuffs = kept;
    }

    const health = num(state.Health);
    const ageYears = num(state.AgeDays) / 365;
    if (health <= 0) { reincarnate("you succumbed to your wounds"); }
    else if (ageYears >= state.Lifespan) { reincarnate("you died of old age"); }

    updatePotential();
    return true;
  }

  function advanceNDays(n) {
    const days = Math.max(1, Math.min(999, Math.floor(num(n) || 1)));
    let count = 0;
    for (let i = 0; i < days; i++) {
      if (num(state.Health) <= 0) break;
      if (state.InFight) break;
      const tl = Array.isArray(state.TaskList) ? state.TaskList : [];
      if (tl.length === 0) break;
      if (!advanceDay()) break;
      count++;
    }
    return count;
  }
  function fight() {
    if (num(state.Health) <= 0) return null;
    const setup = setupFoe();
    if (!setup) return null;
    const result = resolveFight(setup.foeStats, setup.foeStyle);
    concludeFight(setup.mode, setup.extra, setup.idx, potential(), setup.bet, result);
    return { result, mode: setup.mode };
  }

  function setAutoBattle(on) {
    state.AutoBattle = on === true;
  }

  function locationFightsBeaten(locKey) {
    return Array.isArray(state.LocationFights?.[locKey]) ? state.LocationFights[locKey].length : 0;
  }

  function canFightLocation(locKey, n) {
    if (n <= 1) return true;
    const beaten = state.LocationFights?.[locKey] || [];
    return beaten.includes(n - 1);
  }

  function locationFightList(locKey) {
    const loc = LOCATIONS[locKey];
    if (!loc) return [];
    if (!state.LocationFighterCache) state.LocationFighterCache = {};
    if (!Array.isArray(state.LocationFighterCache[locKey])) {
      state.LocationFighterCache[locKey] = locationRivals(locKey);
    }
    const rivals = state.LocationFighterCache[locKey];
    const beaten = state.LocationFights?.[locKey] || [];
    return rivals.map((r) => ({
      ...r,
      beaten: beaten.includes(r.n),
      unlocked: canFightLocation(locKey, r.n),
    }));
  }

  function beginLocationFight(locKey, n) {
    if (num(state.Health) <= 0) return null;
    if (battle) return null;
    if (!canFightLocation(locKey, n)) return null;
    const rivals = locationFightList(locKey);
    const foe = rivals[n - 1];
    if (!foe) return null;
    const me = makeCombatant(currentStats(), activeStyle(), { isPlayer: true });
    const foeCombatant = makeCombatant(foe.stats, foe.style);
    const extra = { ...foe, locKey, locName: LOCATIONS[locKey]?.name || locKey };
    if (!extra.style) extra.style = foe.style;
    battle = { me, foe: foeCombatant, mode: "location", extra, idx: 0, bet: 0, pot: potential(), round: 0, foeStats: foe.stats };
    state.InFight = true;
    const view = combatantToView(me, foeCombatant);
    view.foeName = foe.name;
    view.foeStyleName = STYLES[foe.style].name;
    view.playerStyleName = STYLES[activeStyle()].name;
    view.mode = "location";
    view.round = 0;
    view.auto = state.AutoBattle === true;
    view.events = [];
    return view;
  }

  return {
    state,
    rng: R,
    // helpers exposed for tests/UI
    attrValue, attrApt, potential, rankIndexFor, updatePotential,
    learnedStyles, activeStyle, styleXpMap,
    knowledgeMap, styleKnowledge, addKnowledge,
    knownSkillList, knownSkillSet, learnSkill,
    onPlayerHit, selfTrainTick,
    makeCombatant,
    saveBuild, clearBuild, activeBuild, buildStyleId,
    logMsg, snapshot: () => snapshot(state),
    maxHealth, maxStamina, maxNutrition, clampVitals,
    // actions
    setActivity, setLocation, setLooking, setStyle, reincarnate, rebirthCost,
    setName, hardReset, buyAptitude, adminSetStat, adminAddItem, adminSetMoney, adminHeal, adminUnlockAll,
    setAutoBattle, buyItem, useItem, autoEatFood, inventory, cookItem,
    trainingAt, setTaskList, addTask, removeTask,
    trainTier, trainTierName, trainTierProgress,
    // movement
    beginMove, moveStep, arriveAt, tryEscape,
    // jobs
    jobLevel, jobXp, doJobShift, doJobAction, doAutoJob, jobCooldownRemaining, jobCanWork,
    setAutoJob, clearAutoJob, autoJobActive, jobActionStaminaCost,
    // arena modes
    beginTourneyFight, beginGuFight,
    // combat
    fight, beginFight, fightMove, activateUlt, forfeit,
    // version
    shouldShowUpdateLog, GAME_VERSION,
    // ghosts
    listGhosts, fightGhost,
    // roamers
    spawnRoamers, roamerStatus, roamerRemaining, noteRoamerSeen, refreshRoamerRespawns, roamerChallengers, fightRoamer, beginRoamerFight,
    // day
    doDay, advanceDay, advanceNDays,
    // gym training
    buyTraining, hasTraining, canAddToTask,
    // location rivals
    locationFightsBeaten, canFightLocation, locationFightList, beginLocationFight,
    // equipment
    buyEquipment, equipItem, unequipItem, trainingEquipMult,
    // tasklist
    taskList,
    // save codes
    exportSave, importSave,
  };
}
