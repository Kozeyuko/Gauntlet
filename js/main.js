// js/main.js — boot: load save, build the engine, start the day loop + autosave.
import { freshState, restore, createGame } from "./engine.js";
import { DAY_SECONDS } from "./data.js";
import { initUI } from "./ui.js";

const SAVE_KEY = "gauntlet-save-v1";
const GHOST_KEY = "gauntlet-ghosts-v1";

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function loadGhosts() {
  try {
    const raw = localStorage.getItem(GHOST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveGhosts(arr) {
  try {
    localStorage.setItem(GHOST_KEY, JSON.stringify(arr));
  } catch (e) { /* ignore */ }
}

const state = freshState();
const saved = loadSave();
const cameBack = restore(state, saved);

const game = createGame(state, { loadGhosts, saveGhosts });

// Welcome message mirrors BitCore onJoin, then refresh rank display.
game.logMsg(cameBack ? "Welcome back. Your training continues." : "You leave home at 18. Train, fight, and learn.");
game.updatePotential();

const ui = initUI(game, {
  onReset() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(GHOST_KEY);
    location.reload();
  },
});

// The day loop: one in-game day every DAY_SECONDS real seconds.
setInterval(() => {
  game.doDay();
  ui.render();
}, DAY_SECONDS * 1000);

// Autosave every 10s and on hide/reload.
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.snapshot()));
  } catch (e) { /* ignore */ }
}
setInterval(persist, 10000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});
window.addEventListener("pagehide", persist);
