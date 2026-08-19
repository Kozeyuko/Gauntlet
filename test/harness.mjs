// test/harness.mjs — Node test harness for gauntlet-web.
// Drives js/engine.js + js/data.js headlessly with a deterministic seeded RNG.

import { freshState, snapshot, createGame, eventToString } from "../js/engine.js";
import { RIVALS, INSIDE } from "../js/data.js";

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
  assert(s.Str === 1 && s.Tou === 1 && s.Spd === 1 && s.Int === 1 && s.Cha === 1, "values all start at 1");
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
  assertClose(state.Str, 1.05, "Str ≈ 1.05 (0.10 × 0.5 × 1)");
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
  assert(g.potential() === 33, "potential is 33");
}

console.log("== Reincarnation ==");
{
  const state = freshState();
  const g = createGame(state, { rng: makeRng(1) });
  g.updatePotential(); // establish rank (simulates onJoin)
  state.Str = 10;
  g.reincarnate("you chose to begin a new life");
  assertClose(state.StrAp, 1.4, "StrAp = 1.4 (1 + 10/25)");
  assert(state.Str === 1, "Str reset to 1");
  assert(state.Styles === "Brawling", "Styles kept");
  assert(state.Money === 30, "Money reset to 30");
  assert(state.Lives === 1, "Lives incremented to 1");
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
  // Fight #2: Boz the Boxer (rung 2) — learn Boxer on win.
  const r2 = g.fight();
  assert(r2 && r2.result.win === true, "beat Boz the Boxer");
  assert(state.RivalIdx === 3, "RivalIdx advanced to 3");
  assert(state.Wins === 2, "Wins is 2");
  assert(state.Styles.split(",").includes("Boxer"), "Styles contains 'Boxer'");
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

console.log("");
if (failures > 0) {
  console.error(`${failures} test(s) FAILED, ${passes} passed.`);
  process.exit(1);
} else {
  console.log(`ALL TESTS PASSED (${passes} assertions).`);
  process.exit(0);
}
