# TASK — v2.2 Batch D: Randomized NPC stats by tier (equation)

Changes to the gauntlet-web static game. Files: `js/data.js`, `js/engine.js`,
`js/ui.js`, `test/harness.mjs`. After changes: `node --check` on every edited file;
`node test/harness.mjs` must pass (existing ~745 + new). Commit with:
"v2.2: randomize NPC stats by tier equation (tier1 low, tier2 mid, tier3 high)".

---

## 1. Randomized NPC stats by tier
**Reported:** "Majority npcs need to be randomized... There can be special npcs that are met with certain stats, but when moving around and the rivals, their stats should be random for their tier. Create a equation for this please, where tier one fighters are lower classes, tier two are middle, tier three are highest."

Currently `locationRivals` uses a DETERMINISTIC `baseRival.stats * cfg.mult * esc`
— every "Fighter k" at a tier has identical stats. And roamers scale from the
player. The user wants **randomized stats within a tier band**:
- **Tier 1** (basic): LOW stat band (lower classes).
- **Tier 2** (advanced): MIDDLE band.
- **Tier 3** (elite): HIGHEST band.

### Equation
Design a randomized stat equation. Each stat `s` for a fighter of tier `t`:
```
base(t)      = TIER_BASE[t]        // tier 1: low, tier 2: mid, tier 3: high
spread(t)    = TIER_SPREAD[t]      // how much randomness around the base
s = round( base(t) * (1 + (rand()*2 - 1) * spread(t)) )
```
Where:
- `TIER_BASE = { 1: {Str:6, Tou:5, Spd:5, Int:3, Cha:1}, 2: {Str:20, Tou:16, Spd:18, Int:12, Cha:6}, 3: {Str:50, Tou:42, Spd:46, Int:32, Cha:16} }`
- `TIER_SPREAD = { 1: 0.4, 2: 0.35, 3: 0.3 }` (lower tiers more random relative,
  higher tiers tighter but still variable).

Also scale by the fighter's slot (k 1-5, escalating) and by the location's existing
`LOC_RIVAL_TIERS[tier].mult`:
```
final = base(t) * cfg.mult * (0.7 + k*0.18) * (1 + (rand()*2 - 1) * spread(t))
```
Guarantee a **minimum** of 1 (and that higher-tier always averages higher than
lower-tier).

### Data (js/data.js)
- Add `export const TIER_BASE = {...}` and `export const TIER_SPREAD = {...}`.
- Add `export function randomTierStats(tier, slot, rng)` returning randomized
  `{Str, Tou, Spd, Int, Cha}` using the equation above. Accept an optional `rng`
  (defaults to `Math.random`) so tests can seed it.

### Engine (js/engine.js)
- `locationRivals` (or the build path): use `randomTierStats(loc.tier, k)` for each
  fighter instead of the deterministic `baseRival.stats * ...`. Keep the reward/XP
  deterministic (or lightly randomized).
- `buildRoamer`/encounters: randomize the roaming NPC stats within a band relative
  to the player's potential (tier of the roamer's style). Use the same equation,
  scaled to the player so fights are beatable but varied.
- Ensure special/story NPCs (RIVALS, INSIDE) keep their fixed stats (the "special
  npcs that are met with certain stats" the user mentioned).

### UI (js/ui.js)
- The fighters roster and roamers show the randomized stats. No structural change
  needed, just the values flowing through.

### Tests
- `randomTierStats(1, 1, seed)` and `randomTierStats(1, 1, seed)` (same seed) give
  the same result (deterministic with seed).
- `randomTierStats(1,...)` average < `randomTierStats(2,...)` average <
  `randomTierStats(3,...)` average (tier bands don't overlap in expectation).
- All stats are >= 1.
- `locationRivals` returns randomized (not identical) stats across two calls with
  different seeds.

---

## Definition of done
1. `node --check` passes on all edited files.
2. `node test/harness.mjs` — ALL tests pass.
3. Tier-1 NPCs are lower-stat, tier-2 mid, tier-3 high, with randomness within each
   band.
4. Special/story NPCs keep fixed stats; only random/roaming/rival NPCs are randomized.
5. Commit with the exact message above. Do not push.
