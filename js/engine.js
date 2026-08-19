// js/engine.js — PURE game logic. No DOM, no window, no localStorage.
// Receives a `save` object (already-parsed JSON shape) and mutates it in place.
// Optional `{ rng }` lets tests inject a deterministic random source.

import {
  ATTRIBUTES,
  ACTIVITIES,
  ACTIVITY_ALIAS,
  LOCATIONS,
  STYLES,
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
  HOME_MULT,
  STYLEXP_TRAIN,
  STYLEXP_LOSS,
  MASTERY_TIERS,
  DATA_VERSION,
  MAX_GHOSTS,
  MAX_RIVAL,
  MAX_TOTAL,
} from "./data.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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
  "InFight", "AutoBattle",
];

// ------------------------------------------------------------------ STATE --
export function freshState() {
  const st = {
    Str: 1, Tou: 1, Spd: 1, Int: 1, Cha: 1,
    StrAp: 1, TouAp: 1, SpdAp: 1, IntAp: 1, ChaAp: 1,
    Health: 100, Stamina: 100, Nutrition: 100,
    Money: START_MONEY, AgeDays: START_AGE_DAYS, Lives: 0, Wins: 0,
    RivalIdx: 1, Location: "home", Activity: "Rest",
    Looking: false, Styles: "Brawling", ActiveStyle: "Brawling",
    StyleXp: "", PotRank: 0, InFight: false, AutoBattle: false,
    // transient
    LastMsg: "", Lifespan: BASE_LIFESPAN, Encounter: 0,
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

  let battle = null;
  let ghostCache = null;

  function getGhosts() {
    if (ghostCache === null) ghostCache = loadGhosts() || [];
    return ghostCache;
  }

  function persistGhosts(list) {
    ghostCache = list;
    saveGhosts(list);
  }

  // ---- attribute helpers ----
  const attrValue = (id) => Math.max(0, num(state[id]));
  const attrApt = (id) => Math.max(1, num(state[id + "Ap"]));
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function logMsg(msg) {
    state.LastMsg = msg;
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
      logMsg(`POTENTIAL UP! Rank ${RANKS[idx - 1].name} — +${paid} Taels.`);
    }
    state.PotRank = idx;
    state.PotRankName = RANKS[idx - 1].name;
    const nextRank = RANKS[idx]; // 1-based next
    state.PotNext = nextRank ? `next ${nextRank.name} at ${nextRank.min} (+${nextRank.reward})` : "max rank";
  }

  // ---- styles ----
  function learnedStyles() {
    const out = {};
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

  function activeStyle() {
    const s = String(state.ActiveStyle ?? "");
    if (s === "" || s === "nil") return "Brawling";
    return s;
  }

  function publishStyleSkills() {
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
      logMsg(`${STYLES[styleId].name} mastery tier ${tier} — signature move unlocked.`);
    }
  }

  // ---- reincarnation ----
  function reincarnate(cause) {
    state.Lives = num(state.Lives) + 1;
    const gains = {};
    for (const a of ATTRIBUTES) {
      const v = attrValue(a.id);
      const ap = attrApt(a.id);
      const newAp = ap + v / 25;
      state[a.id + "Ap"] = newAp;
      gains[a.id] = newAp;
    }
    for (const a of ATTRIBUTES) state[a.id] = 1;
    state.Health = 100;
    state.Stamina = 100;
    state.Nutrition = 100;
    state.Money = START_MONEY;
    state.AgeDays = START_AGE_DAYS;
    state.Activity = "Rest";
    let best = "";
    let bestAp = 0;
    for (const a of ATTRIBUTES) {
      if (gains[a.id] > bestAp) { bestAp = gains[a.id]; best = a.name; }
    }
    logMsg(`Life ${state.Lives}: ${cause}. Aptitudes grew — ${best} now ×${bestAp.toFixed(2)}.`);
    updatePotential();
  }

  // ---- combat construction ----
  function makeCombatant(stats, styleId) {
    const style = STYLES[styleId] || STYLES.Brawling;
    const hp = HP_BASE + stats.Tou * HP_PER_TOU;
    const dmg = (stats.Str + stats.Int * 0.2) * style.dmg;
    const crit = 0.08 + stats.Int * 0.004 + style.crit;
    const dodge = Math.min(0.45, stats.Spd * 0.01 + style.dodge);
    const stam = COMBAT_STAM_BASE + stats.Tou;
    const drain = 6 * (1 + stats.Str / STR_DRAIN_DIV) * Math.pow(0.75, stats.Tou / TOU_EFF_DIV);
    const skills = (style.skills && style.skills.length > 0) ? style.skills
      : [{ name: "Haymaker", mult: 1.0, crit: 0.0, dodge: 0.0, weight: 1 }];
    return {
      hp, maxHp: hp, dmg, crit, dodge, spd: stats.Spd, stam, maxStam: stam, drain, int: stats.Int,
      skills, skillName: null, ultCharge: 0, modeRounds: 0,
      ultMult: style.ult && style.ult.mult ? style.ult.mult : 1.35,
      ultName: style.ult && style.ult.name ? style.ult.name : "Berserk",
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
    const me = makeCombatant(currentStats(), activeStyle());
    const foe = makeCombatant(foeStats, foeStyle);
    let round = 0;
    const MAX_ROUNDS = 15;
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
      let first = me, second = foe;
      if (foe.spd > me.spd) { first = foe; second = me; }
      const strike = (att, def) => {
        const skill = pickSkill(att);
        att.skillName = skill.name;
        let dmg = att.dmg * (skill.mult || 1.0);
        const crit = att.crit + (skill.crit || 0.0);
        const dodge = def.dodge - (skill.dodge || 0.0);
        if (att.modeRounds > 0) dmg *= att.ultMult;
        if (att.stam <= 0) dmg *= GAS_MULT;
        if (R() < crit) dmg *= 1.6;
        if (R() < dodge) dmg *= 0.3;
        def.hp -= dmg;
        return dmg;
      };
      strike(first, second);
      if (second.hp > 0) strike(second, first);
    }
    return { win: me.hp > 0 && foe.hp <= 0, rounds: round, playerHpLeft: me.hp, playerSkill: me.skillName, foeSkill: foe.skillName };
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
      state[id] = attrValue(id) + gains[id] * attrApt(id);
    }
    if (!win) {
      state.Tou = attrValue("Tou") + 0.05 * attrApt("Tou");
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
        logMsg(`The Inside demands a ${bet} Tael wager. You can't afford it.`);
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
        let learned = false;
        if (!learnedStyles()[extra.style]) { learnStyle(extra.style); learned = true; }
        if (idx < MAX_RIVAL) state.RivalIdx = idx + 1;
        addStyleXp(activeStyle(), 6 + idx * 2);
        applyFightGains(true);
        captureGhost();
        if (learned) {
          logMsg(`VICTORY over ${extra.name} in ${result.rounds} rounds! You learned ${STYLES[extra.style].name}!`);
        } else if (idx === MAX_RIVAL) {
          logMsg(`THE MASTER FALLS in ${result.rounds} rounds! The Inside opens its doors. +${moneyGain} Taels.`);
        } else {
          logMsg(`VICTORY over ${extra.name} in ${result.rounds} rounds — landed ${result.playerSkill || "a clean hit"}! +${moneyGain} Taels. Next: ${RIVALS[idx].name}.`);
        }
      } else if (mode === "inside") {
        state.Money = num(state.Money) + extra.pay;
        state.Wins = num(state.Wins) + 1;
        addStyleXp(activeStyle(), 20 + (idx - MAX_RIVAL) * 8);
        applyFightGains(true);
        if (idx < MAX_TOTAL) {
          state.RivalIdx = idx + 1;
          logMsg(`INSIDE VICTORY over ${extra.name}! +${extra.pay} Taels. Next monster: ${INSIDE[idx - MAX_RIVAL].name}.`);
        } else {
          logMsg(`KURE REIKO FALLS! You conquered The Inside. Champion of the district. +${extra.pay} Taels.`);
        }
      } else if (mode === "ghost") {
        const moneyGain = 10 + Math.floor((extra.potential || pot) / 50);
        state.Money = num(state.Money) + moneyGain;
        state.Wins = num(state.Wins) + 1;
        addStyleXp(activeStyle(), 4 + Math.floor((extra.potential || 0) / 100));
        applyFightGains(true);
        logMsg(`You defeated the ghost of ${extra.name || "a fighter"} in ${result.rounds} rounds. +${moneyGain} Taels. Their record is yours to claim.`);
      } else { // encounter
        const moneyGain = 5 + Math.floor(pot / 20);
        state.Money = num(state.Money) + moneyGain;
        addStyleXp(activeStyle(), 3 + Math.floor(pot / 50));
        applyFightGains(true);
        logMsg(`You beat the challenger in ${result.rounds} rounds. The crowd nods. +${moneyGain} Taels.`);
      }
      updatePotential();
    } else {
      const dmg = Math.max(5, Math.floor(meHpLost(result)));
      state.Health = num(state.Health) - dmg;
      if (mode === "inside") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false);
        logMsg(`The Inside eats you alive — ${extra.name} takes the ${bet} Tael pot. You took ${dmg} damage.`);
      } else if (mode === "encounter") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false);
        logMsg(`DEFEAT by a street fighter after ${result.rounds} rounds. You took ${dmg} damage. Tou trained from the beating.`);
      } else if (mode === "ghost") {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false);
        logMsg(`The ghost of ${extra.name || "a fighter"} was too much. ${result.rounds} rounds in, you took ${dmg} damage. Their echo still stands.`);
      } else {
        addStyleXp(activeStyle(), STYLEXP_LOSS);
        applyFightGains(false);
        logMsg(`DEFEAT by ${extra.name} after ${result.rounds} rounds. You took ${dmg} damage. Train and try again.`);
      }
      updatePotential();
    }
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
      const m = npc.mult || 0.9;
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
      const m = npc.mult || 0.9;
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

    const me = makeCombatant(currentStats(), activeStyle());
    const foe = makeCombatant(foeStats, foeStyle);
    battle = { me, foe, mode: "ghost", extra, idx: 0, bet: 0, pot: potential(), round: 0 };
    state.InFight = true;
    const view = combatantToView(me, foe);
    view.foeName = foeLabel + " (IMAGINED)";
    view.round = 0;
    view.auto = state.AutoBattle === true;
    return view;
  }

  // ---- manual combat ----
  function combatantToView(me, foe) {
    return {
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
    const me = makeCombatant(currentStats(), activeStyle());
    const foe = makeCombatant(setup.foeStats, setup.foeStyle);
    battle = { me, foe, mode: setup.mode, extra: setup.extra, idx: setup.idx, bet: setup.bet, pot: potential(), round: 0 };
    state.InFight = true;
    const view = combatantToView(me, foe);
    view.foeName = setup.foeName;
    view.foeStyleName = STYLES[setup.foeStyle].name;
    view.playerStyleName = STYLES[activeStyle()].name;
    view.mode = setup.mode;
    view.round = 0;
    view.auto = state.AutoBattle === true;
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
    if (foe.spd > me.spd) { first = foe; second = me; }

    const events = [];
    const doStrike = (att, def, skill, isPlayer) => {
      let dmg = att.dmg * (skill.mult || 1.0);
      const crit = att.crit + (skill.crit || 0.0);
      const dodge = def.dodge - (skill.dodge || 0.0);
      if (att.modeRounds > 0) dmg *= att.ultMult;
      if (att.stam <= 0) dmg *= GAS_MULT;
      const didCrit = R() < crit;
      const didDodge = R() < dodge;
      if (didCrit) dmg *= 1.6;
      if (didDodge) dmg *= 0.3;
      def.hp -= dmg;
      const who = isPlayer ? "You" : "Foe";
      events.push(`${who} used ${skill.name}${didCrit ? " (CRIT)" : ""} — ${Math.floor(dmg)} dmg`);
      return dmg;
    };

    const foeSkill = pickSkill(foe);
    if (first === me) {
      doStrike(me, foe, chosen, true);
      if (foe.hp > 0) doStrike(foe, me, foeSkill, false);
    } else {
      doStrike(foe, me, foeSkill, false);
      if (me.hp > 0) doStrike(me, foe, chosen, true);
    }

    const MAX_COMBAT_ROUNDS = 15;
    const roundNum = battle.round;
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
    logMsg("You forfeited the bout. The hub awaits — train and come back stronger.");
  }

  // ---- simple actions ----
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

  function locationMult(actKey) {
    const loc = LOCATIONS[String(state.Location ?? "home")] || LOCATIONS.home;
    if (loc.name === "Home") return HOME_MULT;
    const m = loc.mults[actKey];
    if (m) return m;
    return 1.0;
  }

  // ---- the day ----
  function doDay() {
    if (num(state.Health) <= 0) return;
    if (state.InFight) return;

    // 1) Nutrition
    let nutrition = num(state.Nutrition) - 1;
    if (nutrition <= 0) {
      const money = num(state.Money);
      if (money >= 5) {
        state.Money = money - 5;
        nutrition = 20;
        logMsg("Hungry — bought a bowl of rice for 5 Taels.");
      } else {
        nutrition = 0;
        state.Health = num(state.Health) - 5;
        logMsg("Starvation! You have no food and no money. -5 Health.");
      }
    }
    state.Nutrition = clamp(nutrition, 0, 100);

    // 2) Activity
    let actKey = String(state.Activity ?? "Rest");
    actKey = ACTIVITY_ALIAS[actKey] || actKey;
    let act = ACTIVITIES[actKey] || ACTIVITIES.Rest;
    const stamina = num(state.Stamina);
    if (actKey !== "Rest" && stamina < act.cost) {
      act = ACTIVITIES.Rest;
      actKey = "Rest";
      logMsg("Too tired to train — you rest instead.");
    }
    const loc = LOCATIONS[String(state.Location ?? "home")] || LOCATIONS.home;
    const locName = loc.name;

    if (actKey === "Rest") {
      state.Stamina = Math.min(100, stamina + 35);
      state.Health = Math.min(100, num(state.Health) + 2);
    } else if (actKey === "OddJobs") {
      const money = act.moneyBase + Math.floor(attrValue("Cha") * act.moneyCha);
      state.Money = num(state.Money) + money;
      state.Stamina = stamina - act.cost;
      logMsg(`Odd jobs: +${money} Taels.`);
    } else if (act.attr) {
      const mult = locationMult(actKey);
      const gain = act.gain * mult * attrApt(act.attr);
      state[act.attr] = attrValue(act.attr) + gain;
      let cost = act.cost;
      if (actKey === "Running") cost = Math.floor(cost * 1.5);
      state.Stamina = stamina - cost;
      if (act.staminaBonus) state.Stamina = Math.min(100, num(state.Stamina) + act.staminaBonus);
      const attrName = ATTRIBUTES.find((a) => a.id === act.attr).name;
      let sxp = "";
      if (loc.styleGym && loc.styleGym === activeStyle()) {
        addStyleXp(loc.styleGym, STYLEXP_TRAIN);
        sxp = ` — style mastery +${STYLEXP_TRAIN}`;
      }
      logMsg(`Training: +${gain.toFixed(2)} ${attrName} at ${locName} (x${mult.toFixed(1)}).${sxp}`);

      if (state.Looking === true && locName !== "Home" && locName !== "Clinic" && R() < ENC_CHANCE) {
        state.Encounter = 1;
        logMsg("A street fighter squares up! (Use FIGHT to accept.)");
      }
    }

    // 3) Age
    state.AgeDays = num(state.AgeDays) + 1;

    // 4) Lifespan
    state.Lifespan = Math.min(60, BASE_LIFESPAN + attrValue("Tou") / 2);

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
    logMsg, snapshot: () => snapshot(state),
    // actions
    setActivity, setLocation, setLooking, setStyle, reincarnate,
    setAutoBattle,
    // combat
    fight, beginFight, fightMove, activateUlt, forfeit,
    // ghosts
    listGhosts, fightGhost,
    // day
    doDay,
  };
}
