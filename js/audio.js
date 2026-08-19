// js/audio.js — procedural Web Audio SFX. Zero audio files; everything is
// synthesized from oscillators + a shared white-noise buffer.
// Safe to import in Node: all window/AudioContext access is guarded and wrapped
// in try/catch. If anything fails, `enabled` flips false and we stay silent.

const LS_KEY = "gauntlet-audio";

let ctx = null;
let noiseBuf = null;

function readPref() {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return true;
    const v = localStorage.getItem(LS_KEY);
    return v === null ? true : v === "1";
  } catch (e) { return true; }
}

function writePref(on) {
  try {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.setItem(LS_KEY, on ? "1" : "0");
    }
  } catch (e) { /* ignore */ }
}

function makeNoise(ac) {
  const len = Math.floor(ac.sampleRate);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Create the AudioContext (only ever called from a user gesture via init()).
function createCtx() {
  if (typeof window === "undefined") return false;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { audio.enabled = false; return false; }
  ctx = new AC();
  noiseBuf = makeNoise(ctx);
  return true;
}

// Resume/use an already-created context. Never creates one on its own, so
// sounds stay silent (and warning-free) until a gesture has called init().
function ensure() {
  if (!audio.enabled || !ctx) return false;
  try {
    if (ctx.state === "suspended") ctx.resume();
    return true;
  } catch (e) {
    audio.enabled = false;
    ctx = null;
    return false;
  }
}

function safe(fn) {
  if (!ensure()) return;
  try { fn(ctx, noiseBuf); } catch (e) { /* stay silent */ }
}

// Simple enveloped tone.
function tone(ac, freq, dur, type, gain, when = 0) {
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

// Swept tone (rising/falling pitch) via exponential frequency ramp.
function sweep(ac, f0, f1, dur, type, gain, when = 0) {
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, f0), t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

// Filtered noise burst (lowpass thump).
function thump(ac, noise, dur, gain, cutoff, when = 0) {
  const t0 = ac.currentTime + when;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.03);
}

// Band-pass noise sweep (whoosh).
function whoosh(ac, noise, f0, f1, dur, gain, when = 0) {
  const t0 = ac.currentTime + when;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(Math.max(1, f0), t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.03);
}

export const audio = {
  enabled: readPref(),

  // Lazy AudioContext creation on first user gesture (browsers block autoplay).
  init() {
    if (!audio.enabled) return;
    try {
      if (!ctx && !createCtx()) return;
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {
      audio.enabled = false;
      ctx = null;
    }
  },

  click() {
    safe((ac) => tone(ac, 660, 0.05, "square", 0.12));
  },

  swing() {
    safe((ac, noise) => whoosh(ac, noise, 300, 900, 0.13, 0.16));
  },

  hit() {
    safe((ac, noise) => {
      tone(ac, 120, 0.12, "triangle", 0.22);
      thump(ac, noise, 0.09, 0.2, 420);
    });
  },

  crit() {
    safe((ac, noise) => {
      tone(ac, 90, 0.16, "square", 0.24);
      thump(ac, noise, 0.12, 0.25, 300);
      tone(ac, 1560, 0.14, "sine", 0.18, 0.02);
    });
  },

  dodge() {
    safe((ac, noise) => whoosh(ac, noise, 320, 1300, 0.16, 0.1));
  },

  ult() {
    safe((ac, noise) => {
      sweep(ac, 120, 520, 0.32, "sawtooth", 0.2);
      tone(ac, 62, 0.28, "sine", 0.28, 0.02);
      thump(ac, noise, 0.16, 0.16, 260);
    });
  },

  victory() {
    safe((ac) => {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => tone(ac, f, 0.18, "triangle", 0.2, i * 0.13));
    });
  },

  defeat() {
    safe((ac) => {
      const notes = [392.0, 311.13, 261.63, 196.0];
      notes.forEach((f, i) => tone(ac, f, 0.24, "triangle", 0.2, i * 0.16));
    });
  },

  rankup() {
    safe((ac) => {
      tone(ac, 880, 0.14, "sine", 0.2);
      tone(ac, 1318.5, 0.2, "sine", 0.2, 0.12);
    });
  },

  toggle() {
    audio.enabled = !audio.enabled;
    writePref(audio.enabled);
    if (audio.enabled) audio.init();
    return audio.enabled;
  },
};
