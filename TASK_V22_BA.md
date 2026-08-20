# TASK — v2.2 Batch A: News as a hovering box (top-left, opens from a button)

Changes to the gauntlet-web static game. Files: `js/ui.js`, `index.html`,
`css/style.css`, `test/harness.mjs`. After changes: `node --check` on every edited
file; `node test/harness.mjs` must pass (existing ~745 + new). Commit with:
"v2.2: news as a floating hover box in the top-left, opened from a button".

---

## Goal
**Reported:** "Make news a hovering box in front of everything in the top left, which opens from a button the user presses."

Currently the News panel is a static section in the right column (`col-right`,
`<h3>News</h3>` + `#logList`). Convert it into a **floating hover box** anchored to
the **top-left** of the screen that:
- Is hidden by default.
- Opens when the user presses a **NEWS** button.
- Renders ABOVE everything (high z-index) as a popover.

## UI (js/ui.js + index.html + css/style.css)

### index.html
- Remove the News `<section class="panel">` from the right column (the `#logList`
  stays, but relocated into the floating box).
- Add a **NEWS** button (in the header, near LOG) — `#btnNews`.
- Add a floating news box element near the top-left:
  ```html
  <div class="news-floater" id="newsFloater">
    <div class="news-floater-head"><h3>News</h3><button id="btnNewsClose" class="btn small-btn">×</button></div>
    <div class="loglist" id="logList"></div>
  </div>
  ```
  (Position it `position: fixed; top: 8px; left: 8px; z-index: 90;`.)

### css/style.css
- `.news-floater { position: fixed; top: 8px; left: 8px; width: 300px; max-width:
  90vw; max-height: 60vh; overflow-y: auto; background: var(--panel2); border:
  1px solid var(--gold-dim); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.5);
  z-index: 90; display: none; padding: 10px; }`
- `.news-floater.show { display: block; }`
- `.news-floater-head { display: flex; justify-content: space-between;
  align-items: center; margin-bottom: 6px; }`
- Ensure it's above overlays but below the absolute-top stuff. Use `z-index: 90`.

### js/ui.js
- Keep `renderLog()` filling `#logList` (the element is now inside the floater).
- Add `btnNews` + `newsFloater` + `btnNewsClose` to the element map.
- Wire: clicking `#btnNews` toggles `.show` on `#newsFloater`; `#btnNewsClose` hides
  it; clicking outside hides it.
- The floater should render above everything (front).

## Tests
- UI-only; ensure `renderLog` still works (it targets `#logList`). No engine change.
- Verify the logList element exists after the move.

## Definition of done
1. `node --check` passes on all edited files.
2. `node test/harness.mjs` — ALL tests pass.
3. News is a floating box in the top-left, hidden by default, opened by a NEWS
   button, rendered above everything.
4. Commit with the exact message above. Do not push.
