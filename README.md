# GAUNTLET · Rise of Styles

A web port of the Roblox incremental-fighter **Gauntlet** — train, fight, learn
styles, climb the ladder, die, and reincarnate stronger. Play it in your
browser; saves live in your browser's localStorage.

## Play

https://kozeyuko.github.io/Gauntlet/

## The loop

- **Train** — pick an activity (Pushups, Situps, Squats, Shadow Boxing,
  Sparring, Running, Heavy Bag, Roadworks, Odd Jobs, Rest). Gains are boosted
  by your location (specialty gyms pay more) and your aptitude.
- **Fight** — manual turn-based combat: pick your skill each round, build
  ultimate charge, unleash your style's awakening when the meter is full.
  Foes auto-fire theirs. Rivals are static; each first win teaches you their
  style. Beat The Master → The Inside opens (deathmatches with entry bets).
- **Grow** — 5 attributes + permanent aptitude, 32 styles with unique movesets
  and ultimates, 63-tier Potential rank ladder (pays Taels on rank-up).
- **Die** — health or old age ends the life. Reincarnation adds `value/25` to
  each aptitude and resets your body — styles, ladder position, and Potential
  rank persist. Death is the prestige loop.
- **The Old House** — the ghost board: imagined shadows scaled to your
  Potential, plus echoes of your own past ladder wins. Bragging-rights fights.

## Tech

Zero-dependency static site: plain HTML/CSS/JS ES modules, no build step, no
backend. State persists in `localStorage` (`gauntlet-save-v1`,
`gauntlet-ghosts-v1`).

```
index.html       single page: hub + combat overlay + ghost board
css/style.css    dark theme (mockup-derived)
js/data.js       all game data tables (verbatim from the Roblox BitCore v5)
js/engine.js     pure game logic (no DOM — unit-testable in Node)
js/ui.js         DOM rendering + event wiring
js/main.js       boot: load save, day loop, autosave
test/harness.mjs seeded-RNG Node harness (45 assertions)
```

## Develop

```bash
node test/harness.mjs        # run the engine test suite
python -m http.server 8000   # serve locally, then open http://localhost:8000
```

Engine logic is deterministic (injectable RNG) and mirrors the original
`BitCore.server.lua` (v5) constants and formulas exactly.

## Credits

Port of the Roblox game *Gauntlet* (BitCore v5). All game data and mechanics
are faithful to the original server implementation.
