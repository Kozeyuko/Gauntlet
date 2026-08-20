# TASK — v2.2 Batch C: Central locations near home + "searching for trouble" toggle placement

Changes to the gauntlet-web static game. Files: `js/data.js`, `js/ui.js`,
`css/style.css`, `test/harness.mjs`. After changes: `node --check` on every edited
file; `node test/harness.mjs` must pass (existing ~745 + new). Commit with:
"v2.2: move central locations near home (gym, store, clinic); searching-for-trouble toggle".

---

## 1. Move central locations closer to Home
**Reported:** "Move the more central locations closer to the house, such as the main gym, the Convenience store, clinic, places newer people need to be at first."

Home is at `[75, 60]` (top-left). The beginner-friendly locations are currently
spread out. Move these CLOSER to Home so new players reach them quickly:
- **City Gym** (gym): currently `[150, 135]` → move to ~`[120, 90]` (right next to
  home).
- **Convenience Store** (cstore): currently `[375, 540]` (bottom-right of west
  district) → move to ~`[150, 60]` (near home's row).
- **Clinic**: currently `[75, 390]` → move to ~`[120, 120]`.
- **Job Board** (jobboard): currently `[75, 540]` → move to ~`[150, 30]` (top area
  near home).

Keep the fighting gyms (Iron Spar, Wat Chai, etc.) where they are or reasonably
close. The goal: a brand-new player can reach gym/store/clinic/jobboard in a few
seconds from Home.

**Data (js/data.js):** update the `MAP_POS` entries for `gym`, `cstore`, `clinic`,
`jobboard` to coordinates near home. Ensure no two locations overlap on the map
(give each distinct x/y). Adjust `ROAMER_SPOTS` if any now collide.

**Verify (browser):** from Home, the City Gym, Convenience Store, Clinic, and Job
Board are visibly close (short dashed route), and clicking them travels quickly.

**Tests:** `MAP_POS` for gym/cstore/clinic/jobboard are within a threshold distance
(chebyshev < 200) of home `[75,60]`.

---

## 2. "Searching for trouble" toggle (placement/UI)
This ties into Batch B item 3 (removing auto-encounters). Ensure the toggle is
clearly visible:
- Add a **"SEARCHING FOR TROUBLE"** toggle button in the right column or header,
  with a tooltip explaining it. Default OFF.
- When ON, random NPC fights can occur while moving; when OFF, no random fights.
- Style it distinct (e.g. red/gold when active).

**UI (js/ui.js + index.html + css):** add the button + tooltip + wire to
`game.setLooking`. Show current state.

**Tests:** engine flag `state.Looking` toggles via `setLooking`; default false.

---

## Definition of done
1. `node --check` passes on all edited files.
2. `node test/harness.mjs` — ALL tests pass.
3. City Gym, Convenience Store, Clinic, and Job Board are near Home on the map.
4. A clearly-labeled "Searching for trouble" toggle exists (default OFF) with a
   tooltip.
5. Commit with the exact message above. Do not push.
