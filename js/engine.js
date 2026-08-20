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
  STYLE_TIER_MULT,
  styleTier,
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
  "StoreBuffs", "TempBoosts",
  "Log", "Roamers", "Name",
  "Inventory", "TaskList", "TaskRepeat",
  "SeenVersion",
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
    AutoRun: false,
    Roamers: {},
    Name: "You",
    Inventory: [],
    TaskList: [],
    TaskRepeat: false,
    SeenVersion: 0,
    // transient
    LastMsg: "", Log: [], Lifespan: BASE_LIFESPAN, Encounter: 0,
    PotRankName: "F-", PotNext: "", StyleSkills: "", StyleUltName: "",
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
  const attrValue = (id) => Math.max(0, num(state[id]) + num(state.TempBoosts && state.TempBoosts[id]));
  const attrApt = (id) => Math.max(1, num(state[id + "Ap"]));
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function shouldShowUpdateLog() { return num(state.SeenVersion) < GAME_VERSION; }
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
    const gain = Math.min(30, 2 + dmg * 0.5);
    addKnowledge(styleId, gain);
    return gain;
  }

  // Fighting WITH an unmastered style trains it faster than passive learning.
  function selfTrainTick(styleId) {
    const k = styleKnowledge(styleId);
    if (k >= KNOWLEDGE_UNMASTERED && k < KNOWLEDGE_LEARNED) {
      addKnowledge(styleId, 4 * SELF_TRAIN_MULT); // 6% per round
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
    const pay = Math.max(1, Math.round(fullPay * score));
    const xp = Math.max(1, Math.round(job.xpPerShift * score));
    const chaBonus = Math.floor(attrValue("Cha") * 0.5);
    const totalPay = pay + chaBonus;
    state.Money = num(state.Money) + totalPay;
    const oldLevel = level;
    addJobXp(jobKey, xp);
    const newLevel = jobLevel(jobKey);
    logMsg(`${job.name} shift: +${totalPay} Cash${newLevel > oldLevel ? ", LEVEL UP!" : ""}.`, "job");
    updatePotential();
    return { success: true, pay: totalPay, xp, level: newLevel, levelUp: newLevel > oldLevel };
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

  // ---- hard reset ----
  function hardReset() {
    for (const k of PERSISTENT_KEYS) delete state[k];
    for (const k of TRANSIENT_KEYS) delete state[k];
    Object.assign(state, freshState());
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
    const MAX_ROUNDS = 15;
    const events = [];
    while (round < MAX_ROUNDS && me.hp > 0 && foe.hp > 0) {
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
    return { win: me.hp > 0 && foe.hp <= 0, rounds: round, playerHpLeft: me.hp, playerSkill: me.skillName, foeSkill: foe.skillName, events };
  }

  function meHpLost(result) {
    const maxHp = HP_BASE + attrValue("Tou") * HP_PER_TOU;
    const hpLeft = result.playerHpLeft;
    if (hpLeft <= 0) return Math.floor(maxHp * 0.5);
    return Math.floor((1 - hpLeft / maxHp) * 30) + 5;
  }

  function applyFightGains(win) {
    const gains = { Str: 0.20, Tou: 0.15, Spd: 0.15, Int: 0.10 };
    for (const id of Object.keys(gains)) {
      state[id] = num(state[id]) + gains[id] * attrApt(id);
    }
    if (!win) {
      state.Tou = num(state.Tou) + 0.05 * attrApt("Tou");
    }
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
        addStyleXp(activeStyle(), 6 + idx * 2);
        applyFightGains(true);
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
        addStyleXp(activeStyle(), 20 + (idx - MAX_RIVAL) * 8);
        applyFightGains(true);
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
        addStyleXp(activeStyle(), 4 + Math.floor((extra.potential || 0) / 100));
        applyFightGains(true);
        logMsg(`You defeated the ghost of ${extra.name || "a fighter"} in ${result.rounds} rounds. +${moneyGain} Cash. Their record is yours to claim.`, "fight");
      } else if (mode === "roamer") {
        const reward = num(extra.reward);
        state.Money = num(state.Money) + reward;
        addStyleXp(activeStyle(), num(extra.styleXp) || 4);
        applyFightGains(true);
        logMsg(`You won Bout ${extra.chainStep || 1} of ${extra.name}. +${reward} Cash.`, "fight");
      } else if (mode === "tourney") {
        const reward = num(extra.reward);
        state.Money = num(state.Money) + reward;
        addStyleXp(activeStyle(), 10);
        applyFightGains(true);
        logMsg(`TOURNAMENT ROUND ${extra.round} VICTORY! +${reward} Cash.`, "fight");
      } else if (mode === "gu") {
        const wave = extra.wave || 1;
        addStyleXp(activeStyle(), 15);
        applyFightGains(true);
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
        addStyleXp(activeStyle(), 3 + Math.floor(pot / 50));
        applyFightGains(true);
        logMsg(`You beat the challenger in ${result.rounds} rounds. The crowd nods. +${moneyGain} Cash.`, "fight");
      }
      updatePotential();
    } else {
      const dmg = Math.max(5, Math.floor(meHpLost(result)));
      state.Health = num(state.Health) - dmg;
      if (mode === "inside") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false);
        logMsg(`The Inside eats you alive — ${extra.name} takes the ${bet} Cash pot. You took ${dmg} damage.`, "fight");
      } else if (mode === "encounter") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false);
        logMsg(`DEFEAT by a street fighter after ${result.rounds} rounds. You took ${dmg} damage. Tou trained from the beating.`, "fight");
      } else if (mode === "ghost") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false);
        logMsg(`The ghost of ${extra.name || "a fighter"} was too much. ${result.rounds} rounds in, you took ${dmg} damage. Their echo still stands.`, "fight");
      } else if (mode === "roamer") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false);
        logMsg(`DEFEAT by ${extra.name}, a roaming fighter. You took ${dmg} damage.`, "fight");
      } else {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false);
        logMsg(`DEFEAT by ${extra.name} after ${result.rounds} rounds. You took ${dmg} damage. Train and try again.`, "fight");
      }
      if (num(state.Health) <= 0) {
        reincarnate("you succumbed to your wounds");
        state.InFight = false;
        state.AutoBattle = false;
      }
      updatePotential();
    }
    if (mode === "roamer" && extra && extra.key) markRoamerDefeated(extra.key);
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
    battle = { me, foe, mode: "ghost", extra, idx: 0, bet: 0, pot: potential(), round: 0 };
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
        Str: Math.max(1, Math.floor(cur.Str * m)),
        Tou: Math.max(1, Math.floor(cur.Tou * m)),
        Spd: Math.max(1, Math.floor(cur.Spd * m)),
        Int: Math.max(1, Math.floor(cur.Int * m)),
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
        Str: Math.max(1, Math.floor(cur.Str * m)),
        Tou: Math.max(1, Math.floor(cur.Tou * m)),
        Spd: Math.max(1, Math.floor(cur.Spd * m)),
        Int: Math.max(1, Math.floor(cur.Int * m)),
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

  function markRoamerDefeated(key) {
    if (!state.Roamers) state.Roamers = {};
    state.Roamers[key] = getNow();
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

  function beginRoamerFight(key, step = 1) {
    if (num(state.Health) <= 0) return null;
    if (battle) return null;
    if (typeof key !== "string") return null;
    const roamer = getRoamer(key);
    if (!roamer) return null;
    if (roamerStatus(key) !== "ready") return null;
    const built = buildChainedRoamer(roamer, step);
    const me = makeCombatant(currentStats(), activeStyle(), { isPlayer: true });
    const foe = makeCombatant(built.stats, built.style);
    battle = { me, foe, mode: "roamer", extra: built, idx: 0, bet: 0, pot: potential(), round: 0 };
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
    battle = { me, foe, mode: "tourney", extra, idx: 0, bet: 0, pot, round: 0 };
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
    battle = { me, foe, mode: "gu", extra, idx: 0, bet: 0, pot, round: 0 };
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
    battle = { me, foe, mode: setup.mode, extra, idx: setup.idx, bet: setup.bet, pot: potential(), round: 0 };
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
        // Foe's awakening auto-fires at full charge (matches Lua).
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

    const MAX_COMBAT_ROUNDS = 15;
    const roundNum = battle.round;
    stampEvents(events, 0, roundNum, me, foe);
    const finished = me.hp <= 0 || foe.hp <= 0 || roundNum >= MAX_COMBAT_ROUNDS;
    if (finished) {
      if (me.hp <= 0 && foe.hp <= 0) me.hp = 0;
      const won = me.hp > foe.hp;
      const result = { win: won, rounds: roundNum, playerHpLeft: Math.max(0, me.hp), playerSkill: chosen.name, foeSkill: foeSkill.name };
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
    const result = { win: false, rounds: battle.round, playerHpLeft: 0, playerSkill: "Forfeit", foeSkill: "—" };
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

    // Buff items (weights) apply instantly as before
    if (item.buff) {
      if (!state.StoreBuffs) state.StoreBuffs = [];
      state.StoreBuffs.push({ name: item.buff, daysLeft: item.days });
      logMsg(`Bought ${item.name} for ${item.price} Cash. Training gains doubled for ${item.days} days.`, "store");
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
    if (item.buff) return false; // buff items are not usable from inventory
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
    const rice = inv.find((e) => e.key === "rice");
    if (!rice || rice.qty <= 0) return;
    state.Nutrition = clamp(num(state.Nutrition) + 20, 0, maxNutrition());
    rice.qty -= 1;
    if (rice.qty <= 0) {
      state.Inventory = inv.filter((e) => e.qty > 0);
    }
    logMsg("Ate rice from inventory (+20 Nutrition).", "eat");
  }

  function inventory() {
    return Array.isArray(state.Inventory) ? state.Inventory : [];
  }

  // ---- tasklist ----
  function setTaskList(list, repeat) {
    const valid = [];
    for (const k of list) {
      if (ACTIVITIES[k]) valid.push(k);
    }
    state.TaskList = valid.slice(0, 20);
    state.TaskRepeat = repeat === true;
  }

  function addTask(activityKey) {
    if (!ACTIVITIES[activityKey]) return false;
    if (!Array.isArray(state.TaskList)) state.TaskList = [];
    if (state.TaskList.length >= 20) return false;
    state.TaskList.push(activityKey);
    return true;
  }

  function removeTask(index) {
    if (!Array.isArray(state.TaskList)) return false;
    if (index < 0 || index >= state.TaskList.length) return false;
    state.TaskList.splice(index, 1);
    return true;
  }

  function trainingAt(locKey) {
    return TRAINING[locKey] || {};
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
    const taskList = Array.isArray(state.TaskList) ? state.TaskList : [];
    let usedTask = false;
    let actKey;
    if (taskList.length > 0) {
      actKey = String(taskList[0] ?? "Rest");
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

    // Location training economy: only programs offered at this location may be
    // trained here. Rest / OddJobs stay globally available for free.
    if (actKey !== "Rest" && actKey !== "OddJobs" && act.attr) {
      const entry = trainingAt(locKey)[actKey];
      if (!entry) {
        logMsg(`You can't train ${actKey} here. Home has basics; gyms have programs.`);
        actKey = "Rest";
        act = ACTIVITIES.Rest;
      } else if (num(state.Money) < entry.cost) {
        logMsg(`Not enough Cash to train ${act.name} here (${entry.cost} Cash).`);
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
      const entry = trainingAt(locKey)[actKey];
      state.Money = num(state.Money) - entry.cost;
      const double = hasBuff("weights") ? 2 : 1;
      const gain = act.gain * entry.gain * attrApt(act.attr) * double;
      state[act.attr] = num(state[act.attr]) + gain;
      let cost = act.cost;
      if (actKey === "Running") cost = Math.floor(cost * 1.5);
      state.Stamina = stamina - cost;
      if (act.staminaBonus) state.Stamina = Math.min(maxStamina(), num(state.Stamina) + act.staminaBonus);
      const attrName = ATTRIBUTES.find((a) => a.id === act.attr).name;
      let sxp = "";
      if (loc.styleGym && loc.styleGym === activeStyle()) {
        addStyleXp(loc.styleGym, STYLEXP_TRAIN);
        sxp = ` — style mastery +${STYLEXP_TRAIN}`;
      }
      logMsg(`Training: +${gain.toFixed(2)} ${attrName} at ${locName} (x${entry.gain.toFixed(1)}, ${entry.cost} Cash).${sxp}`, "train");

      if (state.Looking === true && locName !== "Home" && locName !== "Clinic" && R() < ENC_CHANCE) {
        state.Encounter = 1;
        logMsg("A street fighter squares up! (Use FIGHT to accept.)");
      }
    }

    // 3) Age
    state.AgeDays = num(state.AgeDays) + 1;

    // Advance tasklist
    if (usedTask && taskList.length > 0) {
      if (state.TaskRepeat) {
        const used = taskList.shift();
        if (used) taskList.push(used);
      } else {
        taskList.shift();
      }
    }

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

  // Auto-resolve (legacy quick FIGHT).
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
    setName, hardReset,
    setAutoBattle, buyItem, useItem, autoEatFood, inventory,
    trainingAt, setTaskList, addTask, removeTask,
    // jobs
    jobLevel, jobXp, doJobShift, doAutoJob, jobCooldownRemaining, jobCanWork,
    // arena modes
    beginTourneyFight, beginGuFight,
    // combat
    fight, beginFight, fightMove, activateUlt, forfeit,
    // version
    shouldShowUpdateLog, GAME_VERSION,
    // ghosts
    listGhosts, fightGhost,
    // roamers
    spawnRoamers, roamerStatus, roamerRemaining, fightRoamer, beginRoamerFight,
    // day
    doDay,
  };
}
