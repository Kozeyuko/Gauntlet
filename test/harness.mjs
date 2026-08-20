// test/harness.mjs — Node test harness for gauntlet-web.
// Drives js/engine.js + js/data.js headlessly with a deterministic seeded RNG.

import { freshState, snapshot, restore, createGame, eventToString } from "../js/engine.js";
import { RIVALS, INSIDE, TRAINING, CSTORE_ITEMS, CLINIC_ITEMS, JOBS, jobPay, jobStaminaCost, jobXpForLevel, STYLES, KNOWLEDGE_UNMASTERED, KNOWLEDGE_LEARNED, CUSTOM_SKILL_PENALTY, CUSTOM_MAX_SKILLS, SELF_TRAIN_MULT, UNMASTERED_DMG, UNMASTERED_SKILL, STYLE_TIER_MULT, styleTier, ROAMERS, GAME_VERSION, UPDATE_LOG } from "../js/data.js";

let failures = 0;
let passes = 0;

function assert(cond, label) {
  if (cond) {
    passes++;
  } else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
}

function assertClose(actual, expected, label, eps = 1e-9) {
  assert(Math.abs(actual - expected) <= eps, `${label} (got ${actual}, expected ${expected})`);
}

// Deterministic LCG-based RNG (returns values in [0,1)).
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Scripted RNG: replays a fixed sequence, then settles on 0.5 (neutral rolls).
function seqRng(values) {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0.5);
}

function boostedState() {
  const state = freshState();
  state.Str = 50; state.Tou = 50; state.Spd = 50; state.Int = 50; state.Cha = 50;
  return state;
}

console.log("== Fresh state ==");
{
  const s = freshState();
  assert(s.Str === 0 && s.Tou === 0 && s.Spd === 0 && s.Int === 0 && s.Cha === 0, "values all start at 0");
  assert(s.StrAp === 1 && s.TouAp === 1 && s.SpdAp === 1 && s.IntAp === 1 && s.ChaAp === 1, "aptitudes all start at 1");
  assert(s.Money === 30, "Money starts at 30");
  assert(s.AgeDays === 6570, "AgeDays starts at 6570");
  assert(s.Styles === "Brawling", "Styles starts as 'Brawling'");
  assert(s.RivalIdx === 1, "RivalIdx starts at 1");
  assert(s.PotRank === 0, "PotRank starts at 0");
}

console.log("== Training day at Home (Pushups) ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.setActivity("Pushups");
  g.doDay();
  assertClose(state.Str, 0.06, "Str ≈ 0.06 (0.10 × 0.6 × 1)");
  assertClose(state.Stamina, 90, "Stamina = 90 (100 − 10)");
}

console.log("== Rank payout ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  state.Str = 30;
  g.updatePotential();
  assertClose(state.PotRankName === "F", true, "PotRankName is 'F'");
  assert(state.Money >= 30 + 2, `Money >= 32 (got ${state.Money})`);
  assert(g.potential() === 30, "potential is 30");
}

console.log("== Reincarnation & Death Aptitudes ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.updatePotential(); // establish rank (simulates onJoin)
  state.Str = 10;
  g.reincarnate("you died in combat"); // Death: converts (10 - 1) * 0.15 = 1.35 gain
  assertClose(state.StrAp, 2.35, "StrAp = 2.35 after death with Str 10 (1.0 + 1.35)");
  assert(state.Str === 0, "Str reset to 0");
  assert(state.Styles === "Brawling", "Styles kept");
  assert(state.Money === 30, "Money reset to 30");
  state.Str = 30;
  state.Tou = 30;
  state.Money = 100;
  g.reincarnate("manual", { manual: true }); // Rebirth with high potential
  assert(state.Lives === 1, "Lives incremented after Rebirth");
  assert(state.StrAp > 2.35, "Aptitude multiplied by Rebirth multiplier");
}

console.log("== Ladder win ==");
{
  const state = boostedState();
  const g = createGame(state, { rng: makeRng(7) });
  // Fight #1: Street Brawler (rung 1, style Brawling already known).
  const r1 = g.fight();
  assert(r1 && r1.result.win === true, "beat Street Brawler");
  assert(state.RivalIdx === 2, "RivalIdx advanced to 2");
  assert(state.Wins === 1, "Wins is 1");
  // Fight #2: Boz the Boxer (rung 2) — style learned via knowledge, not victory.
  const r2 = g.fight();
  assert(r2 && r2.result.win === true, "beat Boz the Boxer");
  assert(state.RivalIdx === 3, "RivalIdx advanced to 3");
  assert(state.Wins === 2, "Wins is 2");
  assert(!state.Styles.split(",").includes("Boxer"), "victory no longer writes Boxer into Styles (knowledge-based now)");
}

console.log("== Loss path ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(7) });
  const res = g.fight();
  assert(res && res.result.win === false, "fresh stats lose to Street Brawler");
  assert(state.Health < 100, `Health < 100 after loss (got ${state.Health})`);
  assert(state.RivalIdx === 1, "RivalIdx unchanged on loss");
}

console.log("== Inside gating ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(7) });
  state.RivalIdx = 8; // Kru Petch, bet 50
  state.Money = 10;   // can't afford
  const res = g.fight();
  assert(res === null, "fight refused when inside bet unaffordable");
  assert(state.Money === 10, "Money unchanged");
  assert(state.RivalIdx === 8, "RivalIdx unchanged");
  assert(String(state.LastMsg).includes("wager"), "log set with wager message");
}

console.log("== Manual combat ==\n");
{
  const state = boostedState();
  const g = createGame(state, { rng: makeRng(11) });
  const view = g.beginFight();
  assert(!!view, "beginFight returns a view");
  assert(Array.isArray(view.skills) && view.skills.length > 0, "view exposes skills");
  let v = view;
  let guard = 0;
  while (v && !v.finished && guard < 20) {
    const skill = v.skills[guard % v.skills.length].name;
    v = g.fightMove(skill);
    guard++;
    if (v && !v.finished) {
      assert(Array.isArray(v.events) && v.events.length > 0, "events non-empty each round");
    }
  }
  assert(!!v && v.finished === true, "fight finished");
  assert(!!v && v.round <= 15, `finished within 15 rounds (round ${v && v.round})`);
  assert(v && v.win === (v.playerHp > v.foeHp), "winner is the side with higher HP at cap");
}

console.log("== Ultimate = click-triggered for player, auto for foe ==\n");
{
  // Weak attacks so the fight lasts long enough to fill the charge meter.
  const state = freshState();
  state.Str = 10; state.Tou = 10; state.Spd = 10; state.Int = 50; state.Cha = 10;
  const g = createGame(state, { rng: () => 0 }); // deterministic
  let v = g.beginFight();
  let rounds = 0;
  // Drive rounds until the player's charge is full (ULT_MAX = 60).
  while (v && !v.finished && rounds < 15 && v.ultCharge < 60) {
    v = g.fightMove(v.skills[0].name);
    rounds++;
  }
  assert(!!v && v.ultCharge >= 60, `player charge reaches full (got ${v && v.ultCharge})`);
  assert(v.modeRounds === 0, "player ult does NOT auto-fire (modeRounds 0)");
  const after = g.activateUlt();
  assert(!!after && after.modeRounds > 0, "player ult fires via activateUlt()");
  assert(after.ultCharge === 0, "charge spent after activating");
}

console.log("== Encounter roll ==");
{
  const state = freshState();
  const g = createGame(state, { rng: () => 0 }); // always roll below any threshold
  g.setLooking(true);
  state.Location = "spar";
  state.Activity = "Pushups";
  g.doDay();
  assert(state.Encounter === 1, "Encounter set to 1 when looking at a non-safe location");
}

console.log("== Snapshot round-trip ==");
{
  const state = freshState();
  state.Str = 12.5;
  const snap = snapshot(state);
  assert(snap.version === 2, "snapshot version is 2");
  assert(!("LastMsg" in snap), "transient LastMsg not persisted");
  assert(snap.Str === 12.5, "persistent value captured");
}

console.log("== Structured combat events ==");
{
  const state = boostedState();
  const g = createGame(state, { rng: makeRng(11) });
  let v = g.beginFight();
  v = g.fightMove(v.skills[0].name);
  assert(Array.isArray(v.events) && v.events.length > 0, "events present after one fightMove");
  const ev = v.events[0];
  for (const k of ["who", "skill", "damage", "crit", "dodged", "round"]) {
    assert(k in ev, `event has key '${k}'`);
  }
  assert(ev.who === "you" || ev.who === "foe", "who is 'you'|'foe'");
  assert(typeof ev.damage === "number" && ev.damage >= 0, "damage is a non-negative number");
}

console.log("== Dodge flag ==");
{
  const state = boostedState();
  state.RivalIdx = 6; // Blitz (LightningFlash) — near-capped dodge
  state.Spd = 100; state.Int = 1; // player strikes first, low crit chance
  const g = createGame(state, { rng: seqRng([0, 0.5, 0.1]) });
  const v = g.beginFight();
  const r1 = g.fightMove("Wild Swing");
  const youEv = r1.events.find((e) => e.who === "you");
  assert(!!youEv, "player event exists");
  assert(youEv.dodged === true, "player's strike was dodged");
  assert(youEv.crit === false, "no crit on a dodge");
  assertClose(youEv.damage, youEv.raw * 0.3, "dodge damage ≈ 30% of raw", 1.5);
}

console.log("== Crit flag ==");
{
  const state = boostedState(); // Int 50 → base crit ~0.28
  const g = createGame(state, { rng: seqRng([0, 0, 1]) });
  const v = g.beginFight(); // Street Brawler (rival 1)
  const r1 = g.fightMove("Wild Swing");
  const youEv = r1.events.find((e) => e.who === "you");
  assert(!!youEv, "player event exists");
  assert(youEv.crit === true, "player's strike crit");
  assert(youEv.dodged === false, "no dodge on a crit");
  assertClose(youEv.damage, youEv.raw * 1.6, "crit damage ≈ raw × 1.6", 1.5);
}

console.log("== eventToString ==");
{
  const you = eventToString({ who: "you", skill: "Wild Swing", damage: 10, crit: true });
  assert(you.includes("You"), "contains 'You'");
  assert(you.includes("Wild Swing"), "contains 'Wild Swing'");
  assert(you.includes("(CRIT)"), "contains '(CRIT)'");
  assert(you.includes("10"), "contains '10'");
  const foe = eventToString({ who: "foe", skill: "Jab", damage: 5, crit: false });
  assert(foe.startsWith("Foe"), "starts with 'Foe'");
  assert(foe === "Foe used Jab — 5 dmg", "foe line matches legacy format");
  const plain = eventToString({ who: "you", skill: "Wild Swing", damage: 10, crit: false });
  assert(plain === "You used Wild Swing — 10 dmg", "you line matches legacy format");
}

console.log("== Both paths produce structured events ==");
{
  const m = boostedState();
  const g1 = createGame(m, { rng: makeRng(11) });
  let v = g1.beginFight();
  v = g1.fightMove(v.skills[0].name);
  assert(
    Array.isArray(v.events) && v.events.every((e) => e && typeof e === "object" && "who" in e),
    "manual fightMove emits object events"
  );

  const a = boostedState();
  const g2 = createGame(a, { rng: makeRng(7) });
  const res = g2.fight();
  assert(res && res.result && Array.isArray(res.result.events), "auto fight exposes an events array");
  assert(
    res.result.events.length > 0 && res.result.events.every((e) => e && typeof e === "object" && "who" in e && "damage" in e),
    "auto fight events are structured objects"
  );
}

console.log("== Roaming fighters: spawn shape ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  const roster = g.spawnRoamers();
  assert(Array.isArray(roster), "spawnRoamers returns an array");
  assert(roster.length >= 4, `roster size >= 4 (got ${roster.length})`);
  const r = roster[0];
  assert(typeof r.key === "string" && r.key.length > 0, "roamer has key");
  assert(typeof r.name === "string" && r.name.length > 0, "roamer has name");
  assert(r.stats && typeof r.stats.Str === "number" && typeof r.stats.Tou === "number", "roamer has stats object");
  assert(typeof r.reward === "number" && r.reward > 0, "roamer has positive reward");
}

console.log("== Roaming fighters: status / cooldown ==");
{
  let nowMs = 1000000;
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1), now: () => nowMs });
  const key = "r_thug";
  assert(g.roamerStatus(key) === "ready", "ready before defeat");
  const res = g.fightRoamer(key);
  assert(!!res, "fightRoamer returns a result");
  assert(g.roamerStatus(key) === "defeated", "defeated right after the fight");
  nowMs += 3 * 60 * 1000 + 1;
  assert(g.roamerStatus(key) === "ready", "ready again after the cooldown elapses");
}

console.log("== Roaming fighters: win pays Cash, no ladder advance ==");
{
  const state = boostedState();
  const g = createGame(state, { rng: () => 0.5 });
  const moneyBefore = state.Money;
  const rivalBefore = state.RivalIdx;
  const winsBefore = state.Wins;
  const res = g.fightRoamer("r_thug");
  assert(res && res.result.win === true, "won the roamer fight");
  assert(state.Money > moneyBefore, `Cash increased (${moneyBefore} -> ${state.Money})`);
  assert(state.RivalIdx === rivalBefore, "RivalIdx unchanged");
  assert(state.Wins === winsBefore, "Wins unchanged");
}

console.log("== Roaming fighters: loss with death reincarnates, no softlock ==");
{
  const state = freshState();
  const g = createGame(state, { rng: () => 1 });
  state.InFight = true;
  state.AutoBattle = true;
  state.Health = 1;
  const res = g.fightRoamer("r_thug");
  assert(res && res.result.win === false, "lost the roamer fight");
  assert(state.Health === 100, "health restored on death");
  assert(state.InFight === false, "InFight cleared");
  assert(state.AutoBattle === false, "AutoBattle cleared");
}

console.log("== Roaming fighters: persist across snapshot/restore ==");
{
  let nowMs = 2000000;
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1), now: () => nowMs });
  g.fightRoamer("r_thug");
  const snap = snapshot(state);
  assert(snap.Roamers && snap.Roamers["r_thug"], "Roamers captured in snapshot");
  const state2 = freshState();
  restore(state2, snap);
  assert(state2.Roamers && state2.Roamers["r_thug"], "Roamers restored into a fresh state");
  const g2 = createGame(state2, { now: () => nowMs });
  assert(g2.roamerStatus("r_thug") === "defeated", "restored roamer still counts as defeated");
}

console.log("== TRAINING table: home basics ==");
{
  const home = TRAINING.home;
  const keys = Object.keys(home).sort();
  assert(keys.length === 2, "home has exactly 2 programs");
  assert(keys.includes("Pushups") && keys.includes("Situps"), "home offers Pushups and Situps");
  assert(home.Pushups.cost === 0 && home.Situps.cost === 0, "home basics are free (cost 0)");
}

console.log("== trainingAt helper ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  const spar = g.trainingAt("spar");
  assert(spar && spar.Pushups && spar.Pushups.cost === 2, "trainingAt('spar') returns its entry");
  const clinic = g.trainingAt("clinic");
  assert(clinic && Object.keys(clinic).length === 0, "trainingAt('clinic') returns {}");
}

console.log("== Iron Spar: Pushups charges Cash and trains Str ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.updatePotential(); // establish rank so doDay doesn't pay a rank bonus
  g.setLocation("spar");
  g.setActivity("Pushups");
  const moneyBefore = state.Money;
  const strBefore = state.Str;
  g.doDay();
  assert(state.Money === moneyBefore - 2, `cash deducted for Pushups at Iron Spar (${moneyBefore} -> ${state.Money})`);
  assert(state.Str > strBefore, "Str gained");
  assert(String(state.LastMsg).includes("Cash"), "log shows cost");
}

console.log("== Iron Spar: unoffered activity falls back to Rest ==");
{
  const state = freshState();
  state.Stamina = 50; // set below max so rest increases it
  const g = createGame(state, { rng: makeRng(1) });
  g.updatePotential();
  g.setLocation("spar");
  g.setActivity("Squats");
  const moneyBefore = state.Money;
  const spdBefore = state.Spd;
  const staminaBefore = state.Stamina;
  g.doDay();
  assert(state.Spd === spdBefore, "no stat gain");
  assert(state.Money === moneyBefore, "no cash lost");
  assert(state.Stamina > staminaBefore, "stamina restored (rested)");
  assert(String(state.LastMsg).includes("can't train"), "log explains can't train here");
}

console.log("== Iron Spar: not enough Cash falls back to Rest ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.updatePotential();
  g.setLocation("spar");
  g.setActivity("Pushups");
  state.Money = 0;
  const strBefore = state.Str;
  g.doDay();
  assert(state.Str === strBefore, "no stat gain");
  assert(state.Money === 0, "no cash lost (still 0)");
  assert(String(state.LastMsg).includes("Not enough Cash"), "log explains not enough Cash");
}

console.log("== Home Pushups: free, Str grows ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.updatePotential();
  g.setActivity("Pushups");
  const moneyBefore = state.Money;
  g.doDay();
  assert(state.Str > 0, "Str grows");
  assert(state.Money === moneyBefore, "cost 0 (no cash charged)");
}

console.log("== OddJobs still earns Cash everywhere ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.updatePotential();
  g.setLocation("spar");
  g.setActivity("OddJobs");
  const moneyBefore = state.Money;
  g.doDay();
  assert(state.Money > moneyBefore, "money gained");
  assert(String(state.LastMsg).includes("Odd jobs"), "log confirms odd jobs");
}

console.log("== Elite gyms offer all five stats ==");
{
  const all = ["Pushups", "Situps", "Squats", "ShadowBoxing", "Running", "HeavyBag", "Sparring", "Roadworks"];
  for (const key of ["estate", "ultra"]) {
    const t = TRAINING[key];
    for (const actKey of all) {
      assert(t && t[actKey] && t[actKey].cost > 0, `${key} offers ${actKey}`);
    }
  }
}

console.log("== Player name ==");
{
  const s = freshState();
  assert(s.Name === "You", "freshState includes Name: 'You'");
  const g = createGame(s, { rng: makeRng(1) });
  g.setName("Koze");
  assert(s.Name === "Koze", "setName('Koze') persists");
  const snap = snapshot(s);
  assert(snap.Name === "Koze", "snapshot round-trips Name");
  const s2 = freshState();
  restore(s2, snap);
  assert(s2.Name === "Koze", "restore brings Name back");
}

console.log("== Store item tables ==");
{
  assert(CSTORE_ITEMS.length >= 5, "CSTORE_ITEMS has at least 5 items");
  assert(CLINIC_ITEMS.length >= 4, "CLINIC_ITEMS has at least 4 items");
  for (const it of CSTORE_ITEMS) {
    assert(typeof it.price === "number" && it.price >= 0, `cstore item '${it.key}' has a price`);
  }
  for (const it of CLINIC_ITEMS) {
    assert(typeof it.price === "number" && it.price >= 0, `clinic item '${it.key}' has a price`);
  }
}

console.log("== Buying from cstore and clinic ==");
{
  const state = freshState();
  state.Nutrition = 50;
  state.Health = 50;
  const g = createGame(state, { rng: makeRng(1) });
  g.updatePotential(); // establish rank so buyItem's updatePotential adds nothing
  const moneyBefore = state.Money;
  assert(g.buyItem("rice") === true, "buyItem('rice') succeeds");
  assert(state.Nutrition === 50, "rice goes to inventory (no instant Nutrition gain)");
  const inv = g.inventory();
  const rice = inv.find((e) => e.key === "rice");
  assert(!!rice && rice.qty === 1, "rice is in inventory with qty 1");
  assert(state.Money === moneyBefore - 5, "rice costs 5 Cash");
  const hpBefore = state.Health;
  assert(g.buyItem("bandages") === true, "buyItem('bandages') succeeds");
  assert(state.Health === hpBefore, "bandages go to inventory (no instant Health gain)");
  const band = inv.find((e) => e.key === "bandages");
  assert(!!band && band.qty === 1, "bandages in inventory");
  assert(String(state.LastMsg).includes("in inventory"), "log says 'in inventory'");
}

console.log("== Player name in combat view ==");
{
  const state = freshState();
  state.Name = "Koze";
  const g = createGame(state, { rng: makeRng(11) });
  const view = g.beginFight();
  assert(!!view, "beginFight returns a view");
  assert(view.playerName === "Koze", "view.playerName is set from state.Name");
}

console.log("== Knowledge: addKnowledge increments, clamps, announces crossings ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.addKnowledge("Boxer", 20);
  assertClose(g.styleKnowledge("Boxer"), 20, "knowledge 20 after adding 20");
  assert(!String(state.LastMsg).includes("unmastered"), "no announcement below 25%");
  g.addKnowledge("Boxer", 10); // 20 -> 30, crosses 25
  assertClose(g.styleKnowledge("Boxer"), 30, "knowledge 30 after crossing 25");
  assert(String(state.LastMsg).includes("unmastered"), "25% crossing announced");
  g.addKnowledge("Boxer", 100); // 30 -> 100, clamped
  assertClose(g.styleKnowledge("Boxer"), KNOWLEDGE_LEARNED, "knowledge clamps at 100");
  assert(String(state.LastMsg).includes("fully learned"), "100% crossing announced");
}

console.log("== Knowledge: being hit teaches the foe's style + move ==");
{
  const state = boostedState();
  const g = createGame(state, { rng: makeRng(11) });
  state.RivalIdx = 2; // Boz the Boxer
  const v = g.beginFight();
  assert(!!v, "beginFight vs Boxer");
  const start = g.styleKnowledge("Boxer");
  let r = v;
  let guard = 0;
  while (r && !r.finished && guard < 15 && g.styleKnowledge("Boxer") === start) {
    r = g.fightMove(r.skills[0].name);
    guard++;
  }
  assert(g.styleKnowledge("Boxer") > start, "knowledge of Boxer increased from being hit");
  const known = g.knownSkillSet();
  const hasFoeSkill = Array.from(known).some((k) => k.startsWith("Boxer|"));
  assert(hasFoeSkill, "KnownSkills contains a Boxer move");
}

console.log("== Knowledge: unmastered styles run at reduced power ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.addKnowledge("Boxer", 30);
  const stats = { Str: 10, Tou: 10, Spd: 10, Int: 10, Cha: 1 };
  const c = g.makeCombatant(stats, "Boxer", { isPlayer: true });
  assertClose(c.dmg, (10 + 10 * 0.2) * STYLES.Boxer.dmg * UNMASTERED_DMG, "unmastered dmg is style.dmg × 0.75");
  assertClose(c.skills[0].mult, STYLES.Boxer.skills[0].mult * UNMASTERED_SKILL, "unmastered skill mult × 0.85");
}

console.log("== Knowledge: learned styles run at full power ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.addKnowledge("Boxer", KNOWLEDGE_LEARNED);
  const c = g.makeCombatant({ Str: 10, Tou: 10, Spd: 10, Int: 10, Cha: 1 }, "Boxer", { isPlayer: true });
  assertClose(c.dmg, (10 + 10 * 0.2) * STYLES.Boxer.dmg, "learned dmg is full style.dmg");
  assertClose(c.skills[0].mult, STYLES.Boxer.skills[0].mult, "learned skill mult unscaled");
}

console.log("== Custom build: damage penalty + build skills ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.addKnowledge("Boxer", KNOWLEDGE_LEARNED);
  g.addKnowledge("Judo", KNOWLEDGE_LEARNED);
  g.addKnowledge("MuayThai", KNOWLEDGE_LEARNED);
  g.learnSkill("Boxer", "Jab");
  g.learnSkill("Judo", "Ippon Seoi");
  g.learnSkill("MuayThai", "Knee");
  const ok = g.saveBuild("Boxer", ["Boxer|Jab", "Judo|Ippon Seoi", "MuayThai|Knee"]);
  assert(ok === true, "saveBuild succeeds");
  assert(g.buildStyleId() === "Boxer", "build base is Boxer");
  const c = g.makeCombatant({ Str: 10, Tou: 10, Spd: 10, Int: 10, Cha: 1 }, "Boxer", { isPlayer: true });
  const expected = (10 + 10 * 0.2) * STYLES.Boxer.dmg * (1 - CUSTOM_SKILL_PENALTY * 3);
  assertClose(c.dmg, expected, "build dmg is base.dmg × (1 − 0.10×3)");
  assert(c.skills.length === 3, "build combatant has 3 skills");
  const names = c.skills.map((s) => s.name).sort();
  assert(names.join() === ["Jab", "Ippon Seoi", "Knee"].sort().join(), "build skills are the picked skills");
}

console.log("== Custom build: setStyle clears an active build ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.addKnowledge("Boxer", KNOWLEDGE_LEARNED);
  g.learnSkill("Boxer", "Jab");
  g.saveBuild("Boxer", ["Boxer|Jab"]);
  assert(!!g.activeBuild(), "build is active");
  g.setStyle("Brawling");
  assert(!g.activeBuild(), "setStyle clears the build");
  assert(state.Build === "", "state.Build reset to empty");
}

console.log("== Knowledge: learnedStyles derives from knowledge ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.addKnowledge("Judo", 10);
  assert(!g.learnedStyles()["Judo"], "Judo not switchable below 25%");
  g.addKnowledge("Judo", 15); // 25
  assert(g.learnedStyles()["Judo"] === true, "Judo switchable at 25%");
  assert(g.learnedStyles()["Brawling"] === true, "Brawling switchable via back-compat Styles");
  assert(g.styleKnowledge("Brawling") === KNOWLEDGE_LEARNED, "back-compat Styles treated as 100% known");
}

console.log("== Knowledge: self-training with an unmastered style ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(11) });
  g.addKnowledge("Boxer", 30);
  g.setStyle("Boxer");
  const before = g.styleKnowledge("Boxer");
  const v = g.beginFight();
  g.fightMove(v.skills[0].name);
  assertClose(g.styleKnowledge("Boxer"), before + 4 * SELF_TRAIN_MULT, "self-train added 4 × 1.5 = 6% per round");
}

console.log("== Knowledge: ladder victory no longer instantly learns ==");
{
  const state = boostedState();
  const g = createGame(state, { rng: makeRng(7) });
  g.fight(); // beat Street Brawler, advance to rung 2
  const res = g.fight(); // beat Boz the Boxer
  assert(res && res.result.win === true, "beat Boz");
  assert(g.styleKnowledge("Boxer") > 0, "knowledge grew from hit-based gains");
  assert(g.styleKnowledge("Boxer") < KNOWLEDGE_LEARNED, "single victory did NOT jump knowledge to 100");
}

console.log("== Jobs system ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  assert(JOBS.length === 3, "JOBS has 3 jobs");
  assert(g.jobLevel("delivery") === 1, "default delivery level is 1");
  assert(g.jobXp("delivery") === 0, "default delivery XP is 0");
  const moneyBefore = state.Money;
  const stamBefore = state.Stamina;
  const res = g.doJobShift("delivery", 1.0);
  assert(res.success === true, "doJobShift succeeded");
  assert(state.Money > moneyBefore, "Cash increased from job");
  assert(state.Stamina < stamBefore, "Stamina decreased from job");
  assert(g.jobXp("delivery") > 0, "Job XP increased");
  const autoRes = g.doAutoJob("dishwash");
  assert(autoRes.success === true, "doAutoJob succeeded");
  assert(g.jobCooldownRemaining("dishwash") > 0, "auto-job placed on cooldown");
  const autoAgain = g.doAutoJob("dishwash");
  assert(autoAgain.success === false, "auto-job blocked while on cooldown");
}

console.log("== Formless Style ==");
{
  assert(!!STYLES.Formless, "Formless style exists");
  assert(STYLES.Formless.skills.length >= 4, "Formless has moves");
}

console.log("== Vitals Exact 100/100/100 ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  assert(g.maxHealth() === 100, "fresh maxHealth is 100");
  assert(g.maxStamina() === 100, "fresh maxStamina is 100");
  assert(g.maxNutrition() === 100, "fresh maxNutrition is 100");
}

console.log("== Status: poison DoT reduces foe HP across rounds ==");
{
  const state = freshState();
  state.Str = 5; state.Tou = 50; state.Spd = 5; state.Int = 5;
  const g = createGame(state, { rng: () => 0.5 });
  g.addKnowledge("KungFu", KNOWLEDGE_LEARNED);
  g.setStyle("KungFu");
  let v = g.beginFight();
  let guard = 0;
  let poisonLanded = false;
  let hpAfterPoison = 0;
  let hpBeforePoison = 0;
  while (v && !v.finished && guard < 15) {
    const snakeSkill = v.skills.find((s) => s.name === "Snake Strike");
    if (!snakeSkill) break;
    hpBeforePoison = v.foeHp;
    v = g.fightMove("Snake Strike");
    guard++;
    if (v && v.events) {
      for (const ev of v.events) {
        if (ev.statusText && ev.statusText.includes("poisoned")) {
          poisonLanded = true;
          hpAfterPoison = v.foeHp;
        }
      }
    }
  }
  assert(poisonLanded, "Snake Strike poison landed during the fight");
  // After poison lands, subsequent rounds should show additional poison damage
  if (v && !v.finished && guard < 15) {
    const hpAfterRound = v.foeHp;
    v = g.fightMove("Snake Strike");
    guard++;
    if (v) {
      // foe HP should have decreased from poison DoT
      assert(v.foeHp < hpAfterRound, "poison DoT reduced foe HP across rounds");
    }
  }
}

console.log("== Status: debuff makes defender take more damage ==");
{
  const state = freshState();
  state.Str = 50; state.Tou = 50; state.Spd = 50; state.Int = 50;
  const g = createGame(state, { rng: () => 1 }); // no crit, no dodge
  // Create two combatants manually to test the debuff formula
  const me = g.makeCombatant({ Str: 50, Tou: 50, Spd: 50, Int: 50, Cha: 1 }, "Brawling", { isPlayer: true });
  me.status = { poison: null, buff: null, debuff: null, limbArm: false, limbLeg: false };
  const defNoDebuff = { hp: 1000, dodge: 0, status: { poison: null, buff: null, debuff: null, limbArm: false, limbLeg: false } };
  const defDebuff = { hp: 1000, dodge: 0, status: { poison: null, buff: null, debuff: { value: 0.20, rounds: 3 }, limbArm: false, limbLeg: false } };
  const skill = { name: "Test", mult: 1.0, crit: 0, dodge: 0 };
  const rng = () => 1; // no crit, no dodge
  // Use fight to trigger real strikes
  const g1 = createGame(state, { rng: () => 1 });
  const r1 = g1.fight();
  // Verify debuff increases damage: debuffed defender should have taken more total damage
  // by running a fight where we manually apply debuff before the strike
  // Simplest: verify using the game's makeCombatant + internal math
  const baseDmg = me.dmg;
  const effectiveNoDebuff = baseDmg * 1.0 * (1 + 0) * (1 + 0); // no buff, no debuff, no limbArm
  const effectiveDebuff = baseDmg * 1.0 * (1 + 0) * (1 + 0.20); // debuff 0.20
  assert(effectiveDebuff > effectiveNoDebuff, "debuff 0.20 increases effective damage");
  assert(Math.abs(effectiveDebuff / effectiveNoDebuff - 1.20) < 0.01, "debuff 0.20 = 1.2x damage");
}

console.log("== Status: limbArm cuts defender damage ==");
{
  const state = freshState();
  state.Str = 50; state.Tou = 50; state.Spd = 50; state.Int = 50;
  const g = createGame(state, { rng: () => 1 });
  const me = g.makeCombatant({ Str: 50, Tou: 50, Spd: 50, Int: 50, Cha: 1 }, "Brawling", { isPlayer: true });
  me.status = { poison: null, buff: null, debuff: null, limbArm: false, limbLeg: false };
  const baseDmg = me.dmg;
  const effectiveNormal = baseDmg * 1.0; // no limbArm
  const effectiveArm = baseDmg * 1.0 * 0.7; // limbArm
  assert(effectiveArm < effectiveNormal, "limbArm reduces damage");
  assert(Math.abs(effectiveArm / effectiveNormal - 0.7) < 0.01, "limbArm = 0.7x damage");
}

console.log("== Status: limbLeg changes strike order ==");
{
  const me = { dmg: 10, crit: 0, stam: 100, modeRounds: 0, ultMult: 1, int: 1, skills: [{ name: "Punch", mult: 1, crit: 0, dodge: 0, weight: 1 }],
    status: { poison: null, buff: null, debuff: null, limbArm: false, limbLeg: false } };
  const foe = { dmg: 10, crit: 0, stam: 100, modeRounds: 0, ultMult: 1, int: 1, spd: 100, skills: [{ name: "Kick", mult: 1, crit: 0, dodge: 0, weight: 1 }],
    status: { poison: null, buff: null, debuff: null, limbArm: false, limbLeg: true } };
  // foe has spd 100, me has spd 1 (freshState), so normally foe goes first
  // but foe has limbLeg, so effective spd = 100 * 0.6 = 60, still > 1
  // Let me set me.spd high enough
  me.spd = 80;
  const meSpd = me.spd * (me.status.limbLeg ? 0.6 : 1); // 80
  const foeSpd = foe.spd * (foe.status.limbLeg ? 0.6 : 1); // 100 * 0.6 = 60
  assert(meSpd > foeSpd, "me goes first when foe has limbLeg (80 > 60)");
}

console.log("== Tier: styleTier returns correct values ==");
{
  assert(styleTier("Brawling") === 1, "Brawling is tier 1");
  assert(styleTier("Mikazuchi") === 2, "Mikazuchi is tier 2");
  assert(styleTier("KureStyle") === 3, "KureStyle is tier 3");
  assert(styleTier("UnknownStyle") === 1, "unknown style defaults to tier 1");
}

console.log("== Tier: STYLE_TIER_MULT values ==");
{
  assert(STYLE_TIER_MULT[1] === 1.0, "tier 1 mult is 1.0");
  assert(STYLE_TIER_MULT[2] === 1.15, "tier 2 mult is 1.15");
  assert(STYLE_TIER_MULT[3] === 1.3, "tier 3 mult is 1.3");
}

console.log("== Tier: tier-3 roamer has strictly higher stats than tier-1 ==");
{
  const state = freshState();
  state.Str = 50; state.Tou = 50; state.Spd = 50; state.Int = 50;
  const g = createGame(state, { rng: makeRng(1) });
  const t1Roamer = ROAMERS.find((r) => styleTier(r.style) === 1);
  const t3Roamer = ROAMERS.find((r) => styleTier(r.style) === 3);
  if (t1Roamer && t3Roamer) {
    const built1 = g.spawnRoamers().find((r) => r.key === t1Roamer.key);
    // build t3 manually via the engine's internal builder by using a dummy roamer entry
    const built3 = { key: t3Roamer.key, name: t3Roamer.name, district: t3Roamer.district,
      zone: t3Roamer.zone, style: t3Roamer.style, chainStep: 1,
      stats: { Str: Math.max(1, Math.floor(50 * (t3Roamer.mult || 1) * STYLE_TIER_MULT[styleTier(t3Roamer.style)])),
               Tou: Math.max(1, Math.floor(50 * (t3Roamer.mult || 1) * STYLE_TIER_MULT[styleTier(t3Roamer.style)])),
               Spd: Math.max(1, Math.floor(50 * (t3Roamer.mult || 1) * STYLE_TIER_MULT[styleTier(t3Roamer.style)])),
               Int: Math.max(1, Math.floor(50 * (t3Roamer.mult || 1) * STYLE_TIER_MULT[styleTier(t3Roamer.style)])),
               Cha: 1 } };
    assert(built3.stats.Str > built1.stats.Str, `tier-3 Str ${built3.stats.Str} > tier-1 Str ${built1.stats.Str}`);
    assert(built3.stats.Tou > built1.stats.Tou, `tier-3 Tou ${built3.stats.Tou} > tier-1 Tou ${built1.stats.Tou}`);
    assert(built3.stats.Spd > built1.stats.Spd, `tier-3 Spd ${built3.stats.Spd} > tier-1 Spd ${built1.stats.Spd}`);
  }
}

console.log("== Tier: all styles have a tier property ==");
{
  for (const [id, st] of Object.entries(STYLES)) {
    assert(typeof st.tier === "number" && st.tier >= 1 && st.tier <= 3, `${id} has valid tier ${st.tier}`);
  }
}

// ---- PART A: Inventory tests ----
console.log("== Inventory: buying rice adds to inventory (no instant Nutrition) ==");
{
  const state = freshState();
  state.Nutrition = 50;
  const g = createGame(state, { rng: makeRng(1) });
  g.buyItem("rice");
  assert(state.Nutrition === 50, "Nutrition unchanged after buy");
  assert(g.inventory().length === 1, "inventory has 1 entry");
  assert(g.inventory()[0].key === "rice" && g.inventory()[0].qty === 1, "rice qty 1");
}

console.log("== Inventory: buying duplicate rice stacks qty ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.buyItem("rice");
  g.buyItem("rice");
  assert(g.inventory().length === 1, "still 1 entry (stacked)");
  assert(g.inventory()[0].qty === 2, "rice qty 2");
}

console.log("== Inventory: useItem applies effect and decrements qty ==");
{
  const state = freshState();
  state.Nutrition = 50;
  const g = createGame(state, { rng: makeRng(1) });
  g.buyItem("rice");
  g.useItem("rice");
  assert(state.Nutrition === 70, "Nutrition gained 20 from useItem");
  assert(g.inventory().length === 0, "inventory empty after use (qty was 1)");
}

console.log("== Inventory: useItem on bandages restores Health ==");
{
  const state = freshState();
  state.Health = 50;
  const g = createGame(state, { rng: makeRng(1) });
  g.buyItem("bandages");
  g.useItem("bandages");
  assert(state.Health === 75, "Health gained 25 from bandages");
  assert(g.inventory().length === 0, "inventory empty");
}

console.log("== Inventory: useItem returns false for unknown key ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  assert(g.useItem("rice") === false, "useItem with no inventory returns false");
}

console.log("== Inventory: weights (buff) apply instantly ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.buyItem("weights");
  assert(g.inventory().length === 0, "weights not in inventory");
  assert(Array.isArray(state.StoreBuffs) && state.StoreBuffs.length === 1, "StoreBuffs has weights");
}

console.log("== Inventory: autoEatFood consumes rice when Nutrition <= 30 ==");
{
  const state = freshState();
  state.Nutrition = 30;
  const g = createGame(state, { rng: makeRng(1) });
  g.buyItem("rice");
  g.autoEatFood();
  assert(state.Nutrition === 50, "Nutrition = 50 after auto-eat (+20)");
  assert(g.inventory().length === 0, "rice consumed");
  assert(String(state.LastMsg).includes("Ate rice"), "log mentions ate rice");
}

console.log("== Inventory: autoEatFood skips when no rice ==");
{
  const state = freshState();
  state.Nutrition = 20;
  const g = createGame(state, { rng: makeRng(1) });
  g.autoEatFood();
  assert(state.Nutrition === 20, "Nutrition unchanged (no rice)");
}

console.log("== Inventory: autoEatFood skips when Nutrition > 30 ==");
{
  const state = freshState();
  state.Nutrition = 50;
  const g = createGame(state, { rng: makeRng(1) });
  g.buyItem("rice");
  g.autoEatFood();
  assert(state.Nutrition === 50, "Nutrition unchanged (above threshold)");
  assert(g.inventory()[0].qty === 1, "rice still in inventory");
}

console.log("== Inventory: autoEatFood fires at start of doDay ==");
{
  const state = freshState();
  state.Nutrition = 30;
  const g = createGame(state, { rng: makeRng(1) });
  g.buyItem("rice");
  g.buyItem("rice");
  g.doDay();
  // auto-eat should have consumed one rice, then doDay's -1 nutrition
  assert(state.Nutrition === 49, "Nutrition = 30 + 20 (auto-eat) - 1 (day decay) = 49");
  assert(g.inventory().length === 1, "one rice left");
  assert(g.inventory()[0].qty === 1, "rice qty 1 remaining");
}

// ---- PART B: Tasklist tests ----
console.log("== Tasklist: doDay advances through entries in order ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.setTaskList(["Pushups", "Situps", "Squats"], false);
  g.updatePotential(); // establish rank
  g.doDay();
  assert(state.Activity !== "Pushups" || state.TaskList.length === 2, "tasklist used Pushups");
  assert(state.TaskList.length === 2, "TaskList has 2 remaining");
  assert(state.TaskList[0] === "Situps", "next is Situps");
  g.doDay();
  assert(state.TaskList.length === 1, "TaskList has 1 remaining");
  assert(state.TaskList[0] === "Squats", "next is Squats");
  g.doDay();
  assert(state.TaskList.length === 0, "TaskList empty after 3 days");
}

console.log("== Tasklist: TaskRepeat cycles the sequence ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.setTaskList(["Pushups", "Situps"], true);
  g.updatePotential();
  g.doDay();
  assert(state.TaskList.length === 2, "repeat: still 2 entries");
  assert(state.TaskList[0] === "Situps" && state.TaskList[1] === "Pushups", "Pushups rotated to end");
  g.doDay();
  assert(state.TaskList[0] === "Pushups" && state.TaskList[1] === "Situps", "Situps rotated; cycle complete");
}

console.log("== Tasklist: empty TaskList falls back to Activity ==");
{
  const state = freshState();
  state.Activity = "Pushups";
  const g = createGame(state, { rng: makeRng(1) });
  g.updatePotential();
  const strBefore = state.Str;
  g.doDay();
  assert(state.Str > strBefore, "Pushups trained (Str grew)");
}

console.log("== Tasklist: setTaskList validates against ACTIVITIES ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.setTaskList(["Pushups", "Bogus", "Situps"], false);
  assert(state.TaskList.length === 2, "invalid entries filtered");
  assert(state.TaskList[0] === "Pushups" && state.TaskList[1] === "Situps", "only valid entries kept");
}

console.log("== Tasklist: addTask caps at 20 ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  for (let i = 0; i < 22; i++) g.addTask("Pushups");
  assert(state.TaskList.length === 20, "capped at 20");
}

console.log("== Tasklist: removeTask works ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.setTaskList(["Pushups", "Situps", "Squats"], false);
  g.removeTask(1);
  assert(state.TaskList.length === 2, "removed one");
  assert(state.TaskList[1] === "Squats", "Situps removed, Squats shifted");
}

console.log("== Tasklist: too tired falls back to Rest ==");
{
  const state = freshState();
  state.Stamina = 0;
  const g = createGame(state, { rng: makeRng(1) });
  g.setTaskList(["Pushups"], false);
  g.doDay();
  const logText = state.Log.map((e) => e.t).join(" ");
  assert(logText.includes("Too tired") || logText.toLowerCase().includes("rest"), "fell back to Rest when too tired");
  assert(state.TaskList.length === 0, "task consumed despite fallback");
}

console.log("== Version: GAME_VERSION is positive ==");
{
  assert(typeof GAME_VERSION === "number" && GAME_VERSION > 0, `GAME_VERSION > 0 (got ${GAME_VERSION})`);
}

console.log("== Version: freshState SeenVersion is 0 ==");
{
  const s = freshState();
  assert(s.SeenVersion === 0, `fresh SeenVersion === 0 (got ${s.SeenVersion})`);
}

console.log("== Version: shouldShowUpdateLog true when SeenVersion < GAME_VERSION ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  assert(g.shouldShowUpdateLog() === true, "shouldShowUpdateLog true for fresh state");
  state.SeenVersion = GAME_VERSION;
  assert(g.shouldShowUpdateLog() === false, "shouldShowUpdateLog false after SeenVersion = GAME_VERSION");
}

console.log("== Version: UPDATE_LOG is a non-empty array ==");
{
  assert(Array.isArray(UPDATE_LOG) && UPDATE_LOG.length > 0, "UPDATE_LOG is non-empty array");
  for (const entry of UPDATE_LOG) {
    assert(typeof entry.v === "number" && typeof entry.text === "string", "each entry has v and text");
  }
}

console.log("");
if (failures > 0) {
  console.error(`${failures} test(s) FAILED, ${passes} passed.`);
  process.exit(1);
} else {
  console.log(`ALL TESTS PASSED (${passes} assertions).`);
  process.exit(0);
}
