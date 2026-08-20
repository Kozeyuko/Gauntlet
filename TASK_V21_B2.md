# TASK — v2.1 Batch 2: Map movement along streets, tasks persist, auto button state (engine+ui)

Changes to the gauntlet-web static game. Files: `js/engine.js`, `js/ui.js`,
`js/main.js`, `js/data.js`, `test/harness.mjs`. After changes: `node --check` on
every edited file; `node test/harness.mjs` must pass (existing ~740 + new). Commit
with:
"v2.1: map movement follows streets, tasks persist after play, auto button shows correct state".

---

## 1. Map movement follows streets (pathfinding) + no premature encounters
**Reported:** "Moving around the map does not seem to work, I click a location, move very little steps, and then go back to the house. You should run along the streets to the other places, only time you shouldn't is if the game cannot find a path."

### Problems identified
1. **Premature random encounters** — `moveStep` rolls `R() < MOVE_ENC_CHANCE`
   (0.15) on EVERY 250ms step, so a random encounter cancels movement almost
   immediately, snapping the player back to their start. This is why it "moves
   very little then goes back."
2. **Straight-line movement, not along streets** — the player travels in a direct
   line to the target, not along roads.

### Fix
**A. Reduce/correct the encounter roll:**
- Make encounters much rarer or only after meaningful distance, not every step.
  Change so the encounter chance is checked per UNIT of progress (e.g. only once
  per, say, 20% progress, or scale the chance by step size). Simplest robust fix:
  only roll an encounter when the player has moved a meaningful distance, and don't
  reset the move on encounter — instead pause and resume after the fight, OR make
  the chance very low (e.g. `MOVE_ENC_CHANCE = 0.02`) and check it per step.
  - The user wants movement to WORK reliably. Prioritize reliable movement: lower
    `MOVE_ENC_CHANCE` to ~0.02 and ensure an encounter doesn't "send you back" —
    on encounter, pause movement (keep `MovingTo`), fight, then resume. If the
    fight is escapable, escaping resumes movement.
- Remove the `state.MovingTo = null` reset on encounter (keep the move paused and
  resumable).

**B. Street-following pathfinding:**
- Implement pathfinding so the player travels along roads (the street network)
  rather than a straight line. The map has horizontal roads at y=120/300/480 and a
  vertical river at x=500 (with bridges). 
- Simplest approach that satisfies "run along streets": route the player through
  **waypoints** — move horizontally along the nearest road to the target's
  x/y, then vertically. Compute a route from the player's position to the target
  through road segments (a small pathfinding over the known road grid).
- Add a `routePath` (array of waypoints) to movement state; `moveStep` advances
  along the waypoints in sequence. `beginMove` computes the route.
- Only fall back to a straight line if no road path is found ("only time you
  shouldn't is if the game cannot find a path").

**Data:** lower `MOVE_ENC_CHANCE` to `0.02`. Add a helper `computeRoute(sx, sy, tx,
ty)` in engine (or data) returning an array of `[x,y]` waypoints along the road
grid (the roads: horizontal y≈120/300/480 spanning the west/east, and vertical
connections; the bridge at x=500 crossing the river). Keep it simple — route
through the nearest road lines.

**Tests:**
- `computeRoute` returns a path that stays on/near roads (waypoints on road y/x).
- `beginMove` sets a route; `moveStep` follows waypoints in order.
- Encounters are rare and do NOT reset the move (MovingTo persists, resumes after).
- Movement reliably arrives at the destination (many steps, no premature cancel).

---

## 2. Tasks stay on the tab after clicking PLAY
**Reported:** "The tasks should automatically stay on the tab even after clicking play, only way to remove them is if the player removes them by clicking the x."

Currently `btnTaskPlayQuick` calls `game.doDay()` which, via `consumeTaskItem`,
REMOVES completed tasks from the queue (shift) when not repeating. The user wants
tasks to **persist** on the tab after playing — only removed by clicking the X.

**Engine (js/engine.js):** `consumeTaskItem` / `doDay` should NOT remove items from
`TaskList` when advancing. Instead, decrement their count (`n`) and keep them in
the list. When `n` reaches 0, keep the item at `n: 0` (or reset to original) — the
queue stays populated. The player removes tasks manually via the X button.

- Change `consumeTaskItem`: always decrement `n` (min 0); do NOT `splice`/`shift`
  the item out. If Repeat is on, cycle the current index; if off, keep items in
  place (they just stop being executed when n hits 0, or re-set n to original for
  repeat).
- Add a `TaskIndex` cursor that advances through the queue; when Repeat is on and
  it reaches the end, loop back (no removal). When off, it stays at the last
  executed item (tasks persist, just idle).
- The X button (`removeTask`) is the ONLY way to remove.

**Tests:** after `doDay`/`advanceDay`, `TaskList` length is unchanged (no auto-
removal); items persist with decremented `n`; only `removeTask` deletes.

---

## 3. Auto button shows the correct ON/OFF state
**Reported:** "The auto button says off even if it is running."

The `btnTaskAutoQuick` label is set by `renderTasklistFull()`. It likely always
renders "AUTO: OFF" because the label logic isn't reading `taskAutoInterval`.
Fix `renderTasklistFull` (or a dedicated sync) to set the button text/class based on
whether `taskAutoInterval` is active:
- If `taskAutoInterval` is set → "AUTO: ON" (with `.on` class).
- Else → "AUTO: OFF".
Call this sync after starting/stopping the interval AND in `render`.

**Tests:** UI-only; verify via DOM that the button shows ON when the interval is
running.

---

## Definition of done
1. `node --check` passes on all edited files.
2. `node test/harness.mjs` — ALL tests pass.
3. Map movement follows streets (waypoint pathfinding), arrives reliably, encounters
   are rare and don't reset movement.
4. Tasks persist on the tab after PLAY (only the X removes them).
5. The AUTO button shows ON when running, OFF when not.
6. Commit with the exact message above. Do not push.
