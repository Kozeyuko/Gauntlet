# TASK — v2.1 Batch 3: Statistics menu + mobile UI fixes (ui+css)

Changes to the gauntlet-web static game. Files: `js/ui.js`, `js/engine.js`,
`index.html`, `css/style.css`, `test/harness.mjs`. After changes: `node --check` on
every edited file; `node test/harness.mjs` must pass (existing ~740 + new). Commit
with:
"v2.1: statistics menu, mobile layout fixes (title full-width, combat centered, no post-fight map zoom)".

---

## 1. Mobile UI fixes

### A. Title card at the top is not stretched over the map
**Reported:** "The title card at the top isn't stretched out over the map."

**Fix (css/style.css):** ensure the `#topbar` logo spans the full width on ALL
mobile widths (not just ≤760px). Move/extend the full-width logo rule so it applies
on any narrow screen:
- Change the `@media (max-width: 760px)` rule at line ~334 to also apply at
  `max-width: 900px` (or add the rule to the 900px block). `#topbar { flex-wrap:
  wrap; }` and `#topbar .logo { flex: 1 1 100%; width: 100%; text-align: center; }`.
- Verify the GAUNTLET title stretches edge-to-edge over the map on phone widths.

### B. Fight card only on the left side when a fight starts
**Reported:** "When starting a fight the fight card is only on the left side of the screen."

**Fix (css/style.css):** the combat modal may be centered with `align-items:
center` on `.overlay`, but if a child has a fixed/min width it can look off-center.
Ensure `.overlay.show { display: flex; align-items: center; justify-content:
center; }` (already) and the `.modal.combat` is centered and full-width on mobile:
- At `max-width: 640px`: `.modal.combat { width: 100%; max-width: 100vw; margin: 0;
  }` (already present) — verify it's actually centering. The issue may be that
  `.vs` (fighters) or `.combatbottom` overflows. Add `justify-content: center` and
  ensure `.modal.combat` uses `box-sizing: border-box` and centers within the
  overlay.

### C. After a fight, the map is blown full-screen and requires zoom-out
**Reported:** "After finishing a fight I still get the map blown into a full screen version and have to zoom out on phone."

**ROOT CAUSE (found):** `.map-wrap { min-width: 680px }` (css/style.css line ~141)
forces the map to be ≥680px wide. On a ~400px phone, this causes horizontal
overflow → the browser zooms out to fit, blowing the map up. This is the main
offender.

**Fix (css/style.css):**
- On mobile (in the `@media (max-width: 900px)` block, or a dedicated small-screen
  block), override `min-width`:
  ```css
  @media (max-width: 900px) {
    .map-wrap { min-width: 0; width: 100%; }
  }
  ```
- Add `body { overflow-x: hidden; max-width: 100vw; }` to prevent any horizontal
  scroll/zoom.
- Ensure `.map-wrap` uses `aspect-ratio: 1000/850` so it scales proportionally
  without a fixed min-width.

**Verify:** after a fight ends, the map is normal width (fits the phone), no
horizontal overflow, no zoom-out needed.

---

## 2. Statistics menu
**Reported:** "Add a statistics menu to see info about different things in game, such as different effects on moves."

Add a **Statistics / Codex** overlay showing game info: move effects (poison/buff/
debuff/limb), status effect descriptions, style tiers, and other data.

### UI (index.html + js/ui.js + css/style.css)
- Add a **STATS** (or "Codex") button (in the header or left panel).
- It opens a `#statsOverlay` with sections:
  - **Status Effects** — list each effect (poison, buff, debuff, limb-arm,
    limb-leg) with a description of what it does (damage over time, raise offense,
    lower defense, damage the arm/leg). Pull from the skill `status` definitions.
  - **Styles** — list each style with its tier (1/2/3), dmg/dodge/crit stats, and
    ultimate name. Group by tier.
  - **Attributes** — what each stat does (Str/Tou/Spd/Int/Cha).
  - **Locations / progression** — tier unlock info, maybe.
- Data can be derived from `STYLES`, `ATTRIBUTES`, and a new
  `STATUS_EFFECT_INFO` map in data.js describing each effect.
- Keep it read-only (info display), mobile-friendly.

### Data (js/data.js)
- Add `export const STATUS_EFFECT_INFO = { poison: {...}, buff: {...}, debuff:
  {...}, limbArm: {...}, limbLeg: {...} }` with name + description.

### Tests
- `STATUS_EFFECT_INFO` exists and covers all effects used by skills.
- The stats overlay renders (UI; verify no engine change breaks tests).

---

## Definition of done
1. `node --check` passes on all edited files.
2. `node test/harness.mjs` — ALL tests pass.
3. Mobile: title spans full width over the map; fight card is centered (not just
   left); after a fight the map fits the screen (no zoom-out).
4. A Statistics/Codex menu shows status effects, styles, and attributes.
5. Commit with the exact message above. Do not push.
