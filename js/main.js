// js/main.js — boot: load save, build the engine, start autosave.
import { freshState, restore, createGame } from "./engine.js";
import { initUI } from "./ui.js";
import { audio } from "./audio.js";

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
game.clampVitals();

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.snapshot()));
  } catch (e) { /* ignore */ }
}

// Welcome message, then refresh rank display.
game.logMsg(cameBack ? "Welcome back. Your training continues." : "You enter Bobsled City at 18, looking to become the strongest.");
game.updatePotential();

const ui = initUI(game, {
  onReset() {},
  firstLaunch: !cameBack,
  onSave: persist,
});

// Movement loop: ticks every 250ms, advances position when traveling.
let lastMoveLoc = state.Location;
setInterval(() => {
  if (state.MovingTo && !state.InFight) {
    const result = game.moveStep(0.25);
    ui.render();
    if (result && result.arrived) {
      ui.signalArrival(state.Location);
      ui.render();
    }
  }
  // Detect arrival after fight ends (encounter interrupted movement)
  if (!state.MovingTo && lastMoveLoc !== state.Location) {
    lastMoveLoc = state.Location;
  }
}, 250);

// Debug handle (dev console access; harmless in production).
window.__game = game;

// AudioContext must be created/resumed inside a user gesture (autoplay policy).
document.addEventListener("pointerdown", () => audio.init(), { once: true });

// Autosave every 10s and on hide/reload.
setInterval(persist, 10000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});
window.addEventListener("pagehide", persist);

// Global auto-job: fires every 10s if an auto-job is set.
setInterval(() => {
  const active = game.autoJobActive();
  if (active) {
    const result = game.doAutoJob(active);
    if (result && result.success) {
      // UI update is handled by the next render cycle or autosave
    }
  }
}, 10000);
