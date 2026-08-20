# TASK — v2.2 Batch B: Fast map travel + dashed path + ETA + remove auto-encounters (engine+ui)

Changes to the gauntlet-web static game. Files: `js/engine.js`, `js/ui.js`,
`js/main.js`, `js/data.js`, `test/harness.mjs`. After changes: `node --check` on
every edited file; `node test/harness.mjs` must pass (existing ~745 + new). Commit
with:
"v2.2: fast map travel (20-30s baseline → ~1s at high speed), dashed path line + ETA, remove auto-encounters".

---

## 1. Map movement is much faster
**Reported:** "Movement on the map is unbearably slow... at most 20-30 seconds to get to the furthest places as a baseline. The speed Stat should scale that down to even a second."

### Engine (js/engine.js)
The travel time is `segLen / (MOVE_BASE_SPEED * (1 + spd * 0.05))` per segment, and
the movement loop calls `moveStep(0.25)` every 250ms. Make travel dramatically
faster:
- Introduce a **time budget model**: total travel to the farthest location should be
  ~20-30s at Speed 0, scaling down toward ~1s as Speed grows.
- Change `MOVE_BASE_SPEED` (data.js) and the `travelTime` formula so that:
  - At Speed 0, the longest route (~800 map units) takes ~25s.
  - Speed scales it down aggressively. Use `travelTime = segLen / (MOVE_BASE_SPEED
    * (1 + spd * 0.15))` AND raise `MOVE_BASE_SPEED` so the baseline is ~25s max.
  - At high Speed (e.g. 100+), travel to the far corner takes ~1s.
- Concretely: `MOVE_BASE_SPEED = 32` (map units per second baseline) and
  `travelTime = segLen / (MOVE_BASE_SPEED * (1 + spd * 0.12))`. At spd 0, an 800-unit
  trip = 800/32 = 25s. At spd 100, `32*(1+12)=416` units/s → 800/416 ≈ 1.9s. At spd
  200 → ~0.96s. Good.
- The movement loop in `main.js` ticks every 250ms with `dt=0.25`. Keep that, but
  make sure `moveStep` correctly advances multiple segments per tick if needed
  (the route waypoints may be close; ensure it doesn't get stuck). Consider
  increasing the tick to `dt=0.5` (500ms) so fewer iterations.

### Tests
- Travel from home to the farthest location takes ~20-30s at Speed 0 (compute
  travelTime, not wall-clock).
- At high Speed (e.g. 200), the same trip takes < 2s of computed time.
- The formula is monotonic: higher Speed → lower travel time.

---

## 2. Dashed line showing the route + ETA box on the map
**Reported:** "Draw a dashed line on the map to show where you are going, with a little box in the map telling you how long it will take."

### UI (js/ui.js + css/style.css)
- When `state.MovingTo` is set, draw a **dashed path line** on the map from the
  player's current position along the `routePath` waypoints to the destination.
  Use an SVG `<path>`/`<polyline>` with `stroke-dasharray` (e.g. "6 4") overlaid on
  the map (in the `.map-svg` or a dedicated layer).
- Show an **ETA box** near the player marker (or top of map): "Arriving in ~Xs"
  computed from remaining progress / speed. Update each tick.
- The dashed line should follow the street route (the `routePath` waypoints), not a
  straight line.
- Style: `.route-line { stroke: var(--gold); stroke-dasharray: 6 4; fill: none;
  stroke-width: 2; }` and `.eta-box { position: absolute; background: rgba(0,0,0,.7);
  border: 1px solid var(--gold); color: var(--gold); padding: 2px 6px; border-radius:
  4px; font-size: 11px; }`.

### Tests
- UI-only; verify no engine break. Add a test that `routePath` is exposed and
  non-empty when moving.

---

## 3. Remove random map encounters entirely (replace with a "Searching for trouble" toggle)
**Reported:** "Remove random encounters from the map for now... Just have a toggle that says searching for trouble with a tool tip, and if you have that enabled you will encounter fights with random npcs."

### Engine (js/engine.js)
- Remove the automatic encounter roll from `moveStep` (the `R() < MOVE_ENC_CHANCE`
  check). Movement should NOT trigger fights by default.
- Keep `MOVE_ENC_CHANCE` in data but set to 0 (or remove the check entirely).
- Add an explicit **"searching for trouble"** flag: reuse `state.Looking` (already
  exists) or add `SearchingTrouble`. When the player has it ON, random encounters
  can occur (during movement or via a "look for trouble" action). When OFF (default),
  no random fights from walking.
- If `state.Looking` is on, keep a small encounter chance on movement steps; if off,
  zero.

### UI (js/ui.js)
- Add a **"SEARCHING FOR TROUBLE"** toggle button (with a tooltip: "When on, you
  encounter random fights with random NPCs while moving. Off by default."). Wire it
  to `state.Looking` / `game.setLooking`.
- Default OFF.

### Tests
- With Looking OFF, `moveStep` never triggers an encounter (MOVE_ENC_CHANCE=0).
- With Looking ON, encounters can occur.

---

## Definition of done
1. `node --check` passes on all edited files.
2. `node test/harness.mjs` — ALL tests pass.
3. Travel to the farthest location is ~20-30s at Speed 0, ~1s at high Speed.
4. A dashed route line + ETA box show on the map while traveling.
5. No random encounters while walking unless "Searching for trouble" is ON.
6. Commit with the exact message above. Do not push.
