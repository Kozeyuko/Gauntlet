// js/ui.js — DOM rendering + event wiring. Talks to the engine game object.
import {
  ATTRIBUTES,
  ACTIVITY_LIST,
  LOCATION_LIST,
  LOCATIONS,
  STYLES,
  RIVALS,
  INSIDE,
  STORE_ITEMS,
  MAX_RIVAL,
  MAX_TOTAL,
} from "./data.js";
import { eventToString } from "./engine.js";
import { audio } from "./audio.js";

const $ = (id) => document.getElementById(id);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const reducedMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initUI(game, opts = {}) {
  const onReset = opts.onReset || (() => {});
  const state = game.state;
  let combatMeta = null; // foe name/style/mode captured at fight start
  let activeView = null; // current manual-combat view
  let autoTimer = null;   // auto-battle setTimeout handle
  let prevYouHp = null;   // last rendered HP (for ghost-tail bar)
  let prevFoeHp = null;
  let lastRound = 0;      // last rendered round (for banner pop)
  let lastRankMsg = "";   // last POTENTIAL UP message (for rankup ding)
  let autoRunTimer = null; // activity auto-run setTimeout handle

  // ------------------------------------------------------------ element refs --
  const el = {
    hMoney: $("hMoney"), hAge: $("hAge"), hLives: $("hLives"), hWins: $("hWins"),
    hRank: $("hRank"), hNext: $("hNext"),
    btnSound: $("btnSound"),
    barHealth: $("barHealth"), barHealthTxt: $("barHealthTxt"),
    barStamina: $("barStamina"), barStaminaTxt: $("barStaminaTxt"),
    barNutrition: $("barNutrition"), barNutritionTxt: $("barNutritionTxt"),
    attrsBody: $("attrsBody"),
    activitiesGrid: $("activitiesGrid"),
    stylesGrid: $("stylesGrid"),
    activeStyleInfo: $("activeStyleInfo"),
    locationsGrid: $("locationsGrid"),
    rivalName: $("rivalName"), rivalStyle: $("rivalStyle"), rivalLine: $("rivalLine"),
    rivalStats: $("rivalStats"),
    btnFight: $("btnFight"), btnAutoFight: $("btnAutoFight"),
    btnLooking: $("btnLooking"), btnGhosts: $("btnGhosts"),
    logLine: $("logLine"),
    btnReincarnate: $("btnReincarnate"),
    btnReset: $("btnReset"),
    btnAutoRun: $("btnAutoRun"),
    btnStore: $("btnStore"),
    storeOverlay: $("storeOverlay"), storeCash: $("storeCash"), storeList: $("storeList"),
    btnStoreClose: $("btnStoreClose"),
    btnOptions: $("btnOptions"), optionsOverlay: $("optionsOverlay"),
    btnOptSound: $("btnOptSound"), btnThemeDark: $("btnThemeDark"), btnThemeLight: $("btnThemeLight"),
    btnOptionsClose: $("btnOptionsClose"),
    // logger
    btnLog: $("btnLog"), logOverlay: $("logOverlay"), logFull: $("logFull"),
    logStats: $("logStats"), btnLogClear: $("btnLogClear"), btnLogClose: $("btnLogClose"),
    // combat
    combatOverlay: $("combatOverlay"),
    roundLbl: $("roundLbl"), modeLbl: $("modeLbl"),
    youStyle: $("youStyle"), youHpBar: $("youHpBar"), youHpTxt: $("youHpTxt"),
    youHpTail: $("youHpTail"),
    youStamBar: $("youStamBar"), youStamTxt: $("youStamTxt"),
    youUltTxt: $("youUltTxt"), youUltBar: $("youUltBar"),
    youFighter: $("youFighter"), youHitbox: $("youHitbox"),
    foeName: $("foeName"), foeStyle: $("foeStyle"),
    foeHpBar: $("foeHpBar"), foeHpTxt: $("foeHpTxt"),
    foeHpTail: $("foeHpTail"),
    foeStamBar: $("foeStamBar"), foeStamTxt: $("foeStamTxt"),
    foeFighter: $("foeFighter"), foeHitbox: $("foeHitbox"),
    moveList: $("moveList"), combatLog: $("combatLog"),
    btnUlt: $("btnUlt"), btnAuto: $("btnAuto"), btnForfeit: $("btnForfeit"),
    // ghosts
    ghostOverlay: $("ghostOverlay"), ghostList: $("ghostList"), ghostEmpty: $("ghostEmpty"),
    btnGhostClose: $("btnGhostClose"),
    // result
    resultOverlay: $("resultOverlay"), resultTitle: $("resultTitle"), resultBody: $("resultBody"),
    btnResultClose: $("btnResultClose"),
  };

  // ------------------------------------------------------------ build static grids --
  const activityButtons = {};
  ACTIVITY_LIST.forEach((act) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = act.label;
    b.addEventListener("click", () => clickActivity(act.key));
    activityButtons[act.key] = b;
    el.activitiesGrid.appendChild(b);
  });

  const locationButtons = {};
  LOCATION_LIST.forEach((loc) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = loc.label;
    if (loc.desc) b.setAttribute("data-tip", loc.desc);
    b.addEventListener("click", () => { game.setLocation(loc.key); render(); });
    locationButtons[loc.key] = b;
    el.locationsGrid.appendChild(b);
  });

  // ------------------------------------------------------------ render helpers --
  const fmtAge = (days) => {
    const y = Math.floor(days / 365);
    const d = Math.floor(days % 365);
    return `Age ${y} y ${d} d`;
  };

  const styleName = (id) => (STYLES[id] ? STYLES[id].name : id);

  const fmtStats = (stats) => {
    if (!stats) return "";
    return `Str ${stats.Str} · Tou ${stats.Tou} · Spd ${stats.Spd} · Int ${stats.Int} · Cha ${stats.Cha}`;
  };

  function renderHeader() {
    el.hMoney.textContent = String(Math.floor(Number(state.Money) || 0));
    el.hAge.textContent = fmtAge(Number(state.AgeDays) || 0);
    el.hLives.textContent = String(Math.floor(Number(state.Lives) || 0));
    el.hWins.textContent = String(Math.floor(Number(state.Wins) || 0));
    el.hRank.textContent = state.PotRankName || "-";
    el.hNext.textContent = state.PotNext || "";
  }

  function setBar(bar, txt, value, max = 100) {
    const m = Math.max(1, Number(max) || 0);
    const v = Math.max(0, Number(value) || 0);
    bar.style.width = Math.min(100, (v / m) * 100) + "%";
    txt.textContent = `${Math.round(value)} / ${Math.round(m)}`;
  }

  function renderVitals() {
    setBar(el.barHealth, el.barHealthTxt, Number(state.Health) || 0, game.maxHealth());
    setBar(el.barStamina, el.barStaminaTxt, Number(state.Stamina) || 0, game.maxStamina());
    setBar(el.barNutrition, el.barNutritionTxt, Number(state.Nutrition) || 0, game.maxNutrition());
  }

  function renderAttrs() {
    let html = "";
    for (const a of ATTRIBUTES) {
      const val = Number(state[a.id]) || 0;
      const apt = Number(state[a.id + "Ap"]) || 0;
      html += `<div class="attrrow">
        <span class="nm">${a.name}</span>
        <span class="val">${val.toFixed(2)}</span>
        <span class="apt">×${apt.toFixed(2)}</span>
      </div>`;
    }
    el.attrsBody.innerHTML = html;
  }

  function renderActivities() {
    for (const act of ACTIVITY_LIST) {
      const b = activityButtons[act.key];
      b.classList.toggle("active", act.key === state.Activity);
    }
  }

  let lastStylesKey = "";
  const styleButtons = {};
  function renderStyles() {
    const learned = String(state.Styles ?? "").split(",").filter(Boolean).sort();
    const key = learned.join(",");
    if (key !== lastStylesKey) {
      lastStylesKey = key;
      el.stylesGrid.innerHTML = "";
      for (const k of Object.keys(styleButtons)) delete styleButtons[k];
      for (const id of learned) {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = styleName(id);
        b.addEventListener("click", () => { game.setStyle(id); render(); });
        styleButtons[id] = b;
        el.stylesGrid.appendChild(b);
      }
    }
    for (const id of learned) {
      const b = styleButtons[id];
      if (b) b.classList.toggle("active-style", id === state.ActiveStyle);
    }
    const st = STYLES[state.ActiveStyle];
    if (st) {
      const b = [];
      if (st.dmg > 1) b.push(`dmg +${Math.round((st.dmg - 1) * 100)}%`);
      if (st.dodge > 0) b.push(`dodge +${Math.round(st.dodge * 100)}%`);
      if (st.crit > 0) b.push(`crit +${Math.round(st.crit * 100)}%`);
      el.activeStyleInfo.textContent = `Active: ${st.name}${b.length ? " (" + b.join(", ") + ")" : ""} · Ultimate: ${st.ult ? st.ult.name : "Berserk"}`;
    }
  }

  function renderLocations() {
    const rivalIdx = Math.min(Math.max(Number(state.RivalIdx) || 1, 1), MAX_TOTAL);
    for (const loc of LOCATION_LIST) {
      const b = locationButtons[loc.key];
      const l = LOCATIONS[loc.key];
      const locked = rivalIdx <= l.unlock;
      b.classList.toggle("locked", locked);
      b.classList.toggle("here", loc.key === state.Location);
    }
  }

  function rivalInfo() {
    const encounter = Number(state.Encounter) || 0;
    if (encounter >= 1) {
      return {
        name: "A street fighter steps up!",
        style: "A random passerby wants a fight.",
        line: "Someone wants to fight. Use FIGHT to accept.",
        stats: "",
        fightLabel: "ACCEPT FIGHT",
        mode: "encounter",
      };
    }
    const idx = Math.min(Math.max(Number(state.RivalIdx) || 1, 1), MAX_TOTAL);
    if (idx <= MAX_RIVAL) {
      const r = RIVALS[idx - 1];
      return {
        name: r.name,
        style: `Style: ${styleName(r.style)}`,
        line: r.line,
        stats: `${fmtStats(r.stats)} · Reward ${r.rewardMoney} Cash`,
        fightLabel: "FIGHT",
        mode: "ladder",
      };
    }
    const f = INSIDE[idx - MAX_RIVAL - 1];
    return {
      name: f.name,
      style: `Style: ${styleName(f.style)}`,
      line: f.line,
      stats: `${fmtStats(f.stats)} · Bet ${f.bet} · Pay ${f.pay}`,
      fightLabel: "ENTER THE INSIDE",
      mode: "inside",
    };
  }

  function renderRival() {
    const info = rivalInfo();
    el.rivalName.textContent = info.name;
    el.rivalStyle.textContent = info.style;
    el.rivalLine.textContent = info.line;
    el.rivalStats.textContent = info.stats;
    el.btnFight.textContent = info.fightLabel;
  }

  const LOG_KIND_LABEL = {
    sys: "", rank: "RANK", fight: "FIGHT", train: "TRAIN", money: "MONEY",
    life: "LIFE", eat: "NUTRI", store: "STORE", skill: "MASTERY", loc: "MOVE", act: "ACT",
  };

  function renderLog() {
    const entries = Array.isArray(state.Log) ? state.Log : (state.LastMsg ? [state.LastMsg] : []);
    el.logLine.innerHTML = "";
    for (const raw of entries) {
      const e = typeof raw === "string" ? { t: raw, k: "sys", d: 0 } : raw;
      const d = document.createElement("div");
      d.className = "logentry k-" + (e.k || "sys");
      const tag = LOG_KIND_LABEL[e.k] || "";
      if (tag) {
        const s = document.createElement("span");
        s.className = "logtag";
        s.textContent = tag;
        d.appendChild(s);
      }
      d.appendChild(document.createTextNode(e.t ?? ""));
      el.logLine.appendChild(d);
    }
    el.logLine.scrollTop = el.logLine.scrollHeight;
    const msg = String(state.LastMsg ?? "");
    if (msg.includes("POTENTIAL UP") && msg !== lastRankMsg) {
      lastRankMsg = msg;
      audio.rankup();
    }
  }

  // ------------------------------------------------------------ logger overlay --
  function logEntryAge(e) {
    const days = num(e.d);
    if (!days) return "";
    const y = Math.floor(days / 365);
    const d = Math.floor(days % 365);
    return `y${y}·d${d}`;
  }

  function renderLogger() {
    const entries = Array.isArray(state.Log) ? state.Log : [];
    const kinds = {};
    for (const raw of entries) {
      const e = typeof raw === "string" ? { t: raw, k: "sys", d: 0 } : raw;
      kinds[e.k || "sys"] = (kinds[e.k || "sys"] || 0) + 1;
    }
    const stats = `${entries.length} entries · ${Object.keys(kinds).length} kinds`;
    el.logStats.textContent = stats;
    el.logFull.innerHTML = "";
    for (const raw of entries) {
      const e = typeof raw === "string" ? { t: raw, k: "sys", d: 0 } : raw;
      const row = document.createElement("div");
      row.className = "logrow k-" + (e.k || "sys");
      const age = document.createElement("span");
      age.className = "logage";
      age.textContent = logEntryAge(e);
      row.appendChild(age);
      const tag = LOG_KIND_LABEL[e.k] || "";
      if (tag) {
        const s = document.createElement("span");
        s.className = "logtag";
        s.textContent = tag;
        row.appendChild(s);
      }
      const tx = document.createElement("span");
      tx.className = "logtxt";
      tx.textContent = e.t ?? "";
      row.appendChild(tx);
      el.logFull.appendChild(row);
    }
    el.logFull.scrollTop = el.logFull.scrollHeight;
  }

  function openLogger() {
    renderLogger();
    el.logOverlay.classList.add("show");
  }

  function renderLooking() {
    const on = state.Looking === true;
    el.btnLooking.textContent = on ? "Looking: ON" : "Looking: OFF";
    el.btnLooking.classList.toggle("gold", on);
  }

  function render() {
    renderHeader();
    renderVitals();
    renderAttrs();
    renderActivities();
    renderStyles();
    renderLocations();
    renderRival();
    renderLog();
    renderLooking();
    const cost = game.reincarnateCost ? game.reincarnateCost() : 0;
    el.btnReincarnate.textContent = `REINCARNATE (${cost} Cash)`;
    if (el.logOverlay.classList.contains("show")) renderLogger();
  }

  // ------------------------------------------------------------ activity auto-run --
  function syncAutoRunBtn() {
    const on = state.AutoRun === true;
    el.btnAutoRun.textContent = on ? "AUTO: ON" : "AUTO: OFF";
    el.btnAutoRun.classList.toggle("on", on);
  }

  function stopAutoRun() {
    if (autoRunTimer) { clearTimeout(autoRunTimer); autoRunTimer = null; }
  }

  function pauseAutoRun() {
    stopAutoRun();
    state.AutoRun = false;
    syncAutoRunBtn();
  }

  function autoRunStep() {
    autoRunTimer = null;
    if (state.AutoRun !== true) { syncAutoRunBtn(); return; }

    const livesBefore = num(state.Lives);
    const rankBefore = num(state.PotRank);

    game.doDay();
    render();

    if (state.AutoRun !== true) { syncAutoRunBtn(); return; }
    if (num(state.Lives) !== livesBefore) { pauseAutoRun(); return; }
    if (num(state.PotRank) !== rankBefore) { pauseAutoRun(); return; }
    if (num(state.Encounter) >= 1) { pauseAutoRun(); return; }

    autoRunTimer = setTimeout(autoRunStep, 400);
  }

  function clickActivity(key) {
    game.setActivity(key);
    if (state.AutoRun === true) {
      stopAutoRun();
      autoRunStep();
    } else {
      game.doDay();
      render();
    }
  }

  // ------------------------------------------------------------ store overlay --
  function renderStore() {
    el.storeCash.textContent = String(Math.floor(num(state.Money)));
    el.storeList.innerHTML = "";
    for (const item of STORE_ITEMS) {
      const row = document.createElement("div");
      row.className = "storerow";
      const main = document.createElement("div");
      main.className = "smain";
      const nm = document.createElement("div");
      nm.className = "snm";
      nm.textContent = item.name;
      const sub = document.createElement("div");
      sub.className = "ssub";
      sub.textContent = item.desc;
      main.appendChild(nm);
      main.appendChild(sub);
      const btn = document.createElement("button");
      btn.className = "btn small-btn";
      btn.textContent = `${item.price} Cash`;
      btn.addEventListener("click", () => {
        game.buyItem(item.key);
        renderStore();
        render();
      });
      row.appendChild(main);
      row.appendChild(btn);
      el.storeList.appendChild(row);
    }
  }

  function openStore() {
    renderStore();
    el.storeOverlay.classList.add("show");
  }

  // ------------------------------------------------------------ options overlay --
  const THEME_KEY = "gauntlet-theme";
  function currentTheme() {
    try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; }
    catch (e) { return "dark"; }
  }
  function syncThemeBtns() {
    const t = currentTheme();
    el.btnThemeDark.classList.toggle("active-opt", t === "dark");
    el.btnThemeLight.classList.toggle("active-opt", t === "light");
  }
  function applyTheme(theme) {
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
    syncThemeBtns();
  }
  function openOptions() {
    syncSoundBtn();
    syncThemeBtns();
    el.optionsOverlay.classList.add("show");
  }

  // ------------------------------------------------------------ result overlay --
  function showResult(win, body) {
    el.resultTitle.textContent = win ? "Victory" : "Defeat";
    el.resultBody.textContent = body || String(state.LastMsg ?? "");
    el.resultOverlay.classList.add("show");
    if (win) audio.victory();
    else audio.defeat();
  }

  // ------------------------------------------------------------ combat overlay --
  function stopAuto() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  function appendLog(events, round) {
    const box = el.combatLog;
    for (const ev of events) {
      const line = document.createElement("div");
      const text = typeof ev === "string" ? ev : eventToString(ev);
      line.textContent = `[${String(round).padStart(2, "0")}] ${text}`;
      const who = typeof ev === "string" ? (ev.startsWith("Foe") ? "foe" : "you") : ev.who;
      if (who === "you") line.className = "you";
      else if (who === "foe") line.className = "foe";
      else line.className = "sys";
      box.appendChild(line);
    }
    box.scrollTop = box.scrollHeight;
  }

  // ---- combat hit-feedback animation helpers ----
  function triggerClass(element, cls) {
    if (!element || reducedMotion) return;
    element.classList.remove(cls);
    void element.offsetWidth;
    element.classList.add(cls);
    element.addEventListener("animationend", () => element.classList.remove(cls), { once: true });
  }

  function spawnFloater(parent, cls, text, ms) {
    if (reducedMotion || !parent) return;
    const node = document.createElement("div");
    node.className = cls;
    node.textContent = text;
    parent.appendChild(node);
    setTimeout(() => node.remove(), ms);
  }

  function animateEvent(ev) {
    const attacker = ev.who === "you" ? el.youFighter : el.foeFighter;
    const defenderHitbox = ev.who === "you" ? el.foeHitbox : el.youHitbox;
    const defenderIsYou = ev.who !== "you";
    triggerClass(attacker, ev.who === "you" ? "you-lunge" : "foe-lunge");
    audio.swing();
    setTimeout(() => {
      if (ev.dodged) {
        triggerClass(defenderHitbox, defenderIsYou ? "dodge-left" : "dodge-right");
        spawnFloater(defenderHitbox, "dodgelabel", "DODGED", 800);
        audio.dodge();
      } else {
        const side = defenderIsYou ? "you" : "foe";
        triggerClass(defenderHitbox, ev.crit ? `crit-${side}` : `hit-${side}`);
        spawnFloater(defenderHitbox, ev.crit ? "dmgnum crit" : "dmgnum", String(ev.damage), 700);
        if (ev.crit) {
          spawnFloater(defenderHitbox, "critlabel", "CRIT!", 800);
          audio.crit();
        } else {
          audio.hit();
        }
      }
    }, reducedMotion ? 0 : 130);
  }

  function animateRound(events) {
    if (!events || events.length === 0) return;
    events.forEach((ev, i) => {
      setTimeout(() => animateEvent(ev), reducedMotion ? 0 : i * 130);
    });
  }

  function renderCombatHpBar(fill, tail, txt, value, max, prevValue) {
    const maxHp = max || 1;
    const pct = Math.max(0, value / maxHp * 100);
    fill.style.width = pct + "%";
    txt.textContent = `${Math.round(value)} / ${Math.round(maxHp)}`;
    if (prevValue === null || value >= prevValue || reducedMotion) {
      tail.style.width = pct + "%";
    } else {
      const oldPct = Math.max(0, prevValue / maxHp * 100);
      tail.style.transition = "none";
      tail.style.width = oldPct + "%";
      void tail.offsetWidth;
      tail.style.transition = "";
      tail.style.width = pct + "%";
    }
  }

  function renderCombat(view) {
    el.roundLbl.textContent = "ROUND " + Math.max(1, view.round);
    if (view.round !== lastRound) {
      lastRound = view.round;
      triggerClass(el.roundLbl, "pop");
    }
    el.modeLbl.textContent = (view.mode || (combatMeta && combatMeta.mode) || "fight").toUpperCase();
    el.youStyle.textContent = view.playerStyleName || (combatMeta && combatMeta.playerStyleName) || state.ActiveStyle;
    el.foeName.textContent = view.foeName || (combatMeta && combatMeta.foeName) || "Rival";
    el.foeStyle.textContent = view.foeStyleName || (combatMeta && combatMeta.foeStyleName) || "—";
    el.foeHitbox.querySelector(".fhb").textContent = String(el.foeName.textContent || "R").charAt(0).toUpperCase();

    renderCombatHpBar(el.youHpBar, el.youHpTail, el.youHpTxt, view.playerHp, view.playerMaxHp, prevYouHp);
    renderCombatHpBar(el.foeHpBar, el.foeHpTail, el.foeHpTxt, view.foeHp, view.foeMaxHp, prevFoeHp);
    prevYouHp = view.playerHp;
    prevFoeHp = view.foeHp;

    el.youStamBar.style.width = Math.max(0, view.playerStam / (view.playerMaxStam || 100) * 100) + "%";
    el.youStamTxt.textContent = `${view.playerStam} / ${view.playerMaxStam || 100}`;
    el.foeStamBar.style.width = Math.max(0, view.foeStam / (view.foeMaxStam || 100) * 100) + "%";
    el.foeStamTxt.textContent = `${view.foeStam} / ${view.foeMaxStam || 100}`;

    // ultimate charge
    el.youUltTxt.textContent = `${view.ultName || "ULT"} ${view.modeRounds > 0 ? "(active " + view.modeRounds + ")" : view.ultCharge + "/60"}`;
    el.youUltBar.style.width = Math.min(100, view.ultCharge / 60 * 100) + "%";
    const ultReady = view.ultReady && view.modeRounds <= 0;
    el.btnUlt.disabled = !ultReady || view.finished;
    el.btnUlt.textContent = view.modeRounds > 0 ? "ULTIMATE (ACTIVE)" : (ultReady ? "ULTIMATE!" : "ULTIMATE");

    // skill buttons
    el.moveList.innerHTML = "";
    for (const s of view.skills) {
      const b = document.createElement("button");
      b.className = "movebtn";
      b.disabled = view.finished;
      b.innerHTML = `<span class="nm">${s.name}</span><span class="ds">×${(s.mult || 1).toFixed(2)}</span>`;
      b.addEventListener("click", () => {
        if (view.finished) return;
        stopAuto();
        const v = game.fightMove(s.name);
        if (v) {
          if (v.events && v.events.length) {
            appendLog(v.events, v.round);
            animateRound(v.events);
          }
          if (v.finished) {
            finishCombat(v);
          } else {
            activeView = v;
            renderCombat(v);
            maybeAuto();
          }
        }
      });
      el.moveList.appendChild(b);
    }
  }

  function maybeAuto() {
    if (state.AutoBattle !== true) return;
    if (!activeView || activeView.finished) return;
    stopAuto();
    autoTimer = setTimeout(() => {
      const skills = activeView.skills;
      const skill = skills[Math.floor(Math.random() * skills.length)];
      const v = game.fightMove(skill.name);
      if (v) {
        if (v.events && v.events.length) {
          appendLog(v.events, v.round);
          animateRound(v.events);
        }
        if (v.finished) finishCombat(v);
        else { activeView = v; renderCombat(v); maybeAuto(); }
      }
    }, 450);
  }

  function finishCombat(view) {
    activeView = null;
    combatMeta = null;
    stopAuto();
    el.combatOverlay.classList.remove("show");
    render();
    showResult(view.win, String(state.LastMsg ?? ""));
  }

  function openCombat(view) {
    activeView = view;
    combatMeta = {
      mode: view.mode || "fight",
      foeName: view.foeName,
      playerStyleName: view.playerStyleName,
      foeStyleName: view.foeStyleName,
    };
    prevYouHp = null;
    prevFoeHp = null;
    lastRound = 0;
    el.combatLog.innerHTML = "";
    el.combatOverlay.classList.add("show");
    el.btnAuto.textContent = state.AutoBattle ? "AUTO: ON" : "AUTO: OFF";
    el.btnAuto.classList.toggle("gold", state.AutoBattle === true);
    renderCombat(view);
    maybeAuto();
  }

  // ------------------------------------------------------------ ghost overlay --
  function openGhosts() {
    const list = game.listGhosts();
    el.ghostList.innerHTML = "";
    if (!list || list.length === 0) {
      el.ghostEmpty.style.display = "block";
    } else {
      el.ghostEmpty.style.display = "none";
      for (const g of list) {
        const row = document.createElement("div");
        row.className = "ghostrow";
        const tag = g.kind === "npc" ? "SHADOW" : "ECHO";
        const tagCls = g.kind === "npc" ? "shadow" : "echo";
        row.innerHTML = `
          <div class="gmain">
            <div class="gnm">${g.name}</div>
            <div class="gsub">${styleName(g.style)} · Pot ${g.potential} · rank ${g.rank}</div>
            <div class="gsub" style="color:var(--muted)">${g.line}</div>
          </div>
          <span class="tag ${tagCls}">[${tag}]</span>`;
        row.addEventListener("click", () => {
          el.ghostOverlay.classList.remove("show");
          pauseAutoRun();
          const view = game.fightGhost(g.id);
          if (view) openCombat(view);
          else render();
        });
        el.ghostList.appendChild(row);
      }
    }
    el.ghostOverlay.classList.add("show");
  }

  // ------------------------------------------------------------ event wiring --
  el.btnFight.addEventListener("click", () => {
    pauseAutoRun();
    const view = game.beginFight();
    if (view) openCombat(view);
    else render();
  });

  el.btnAutoFight.addEventListener("click", () => {
    pauseAutoRun();
    const res = game.fight();
    render();
    if (res) showResult(res.result.win, String(state.LastMsg ?? ""));
  });

  el.btnLooking.addEventListener("click", () => {
    game.setLooking(state.Looking !== true);
    render();
  });

  el.btnGhosts.addEventListener("click", () => {
    if (el.ghostOverlay.classList.contains("show")) el.ghostOverlay.classList.remove("show");
    else openGhosts();
  });

  el.btnGhostClose.addEventListener("click", () => el.ghostOverlay.classList.remove("show"));

  el.btnReincarnate.addEventListener("click", () => {
    game.reincarnate("you chose to begin a new life", { manual: true });
    render();
  });

  el.btnReset.addEventListener("click", () => {
    if (!confirm("Hard reset? This wipes your save and ghosts.")) return;
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(GHOST_KEY);
    } catch (e) {
      // localStorage may be unavailable (private browsing); clear state anyway
    }
    game.hardReset();
    game.clampVitals();
    game.logMsg("You leave home at 18. Train, fight, and learn.");
    render();
  });

  el.btnUlt.addEventListener("click", () => {
    if (!activeView || activeView.finished) return;
    const wasActive = activeView.modeRounds > 0;
    const v = game.activateUlt();
    if (v) {
      activeView = v;
      renderCombat(v);
      if (!wasActive && v.modeRounds > 0) {
        triggerClass(el.youHitbox, "ult-burst");
        triggerClass(el.btnUlt, "pulse");
        audio.ult();
      }
    }
  });

  el.btnForfeit.addEventListener("click", () => {
    if (!activeView) return;
    stopAuto();
    game.forfeit();
    activeView = null;
    combatMeta = null;
    el.combatOverlay.classList.remove("show");
    render();
    showResult(false, String(state.LastMsg ?? "You forfeited the bout."));
  });

  el.btnAuto.addEventListener("click", () => {
    game.setAutoBattle(state.AutoBattle !== true);
    el.btnAuto.textContent = state.AutoBattle ? "AUTO: ON" : "AUTO: OFF";
    el.btnAuto.classList.toggle("gold", state.AutoBattle === true);
    maybeAuto();
  });

  el.btnResultClose.addEventListener("click", () => {
    el.resultOverlay.classList.remove("show");
    render();
  });

  // sound toggle (persistent via localStorage)
  function syncSoundBtn() {
    const on = audio.enabled;
    el.btnSound.textContent = on ? "SND ON" : "SND OFF";
    el.btnSound.classList.toggle("muted", !on);
    el.btnOptSound.textContent = on ? "SND ON" : "SND OFF";
    el.btnOptSound.classList.toggle("muted", !on);
  }
  function toggleSound() {
    audio.toggle();
    audio.click();
    syncSoundBtn();
  }
  el.btnSound.addEventListener("click", toggleSound);
  el.btnOptSound.addEventListener("click", toggleSound);

  // activity auto-run toggle
  el.btnAutoRun.addEventListener("click", () => {
    state.AutoRun = state.AutoRun !== true;
    if (state.AutoRun !== true) stopAutoRun();
    syncAutoRunBtn();
  });

  // store
  el.btnStore.addEventListener("click", () => {
    if (el.storeOverlay.classList.contains("show")) el.storeOverlay.classList.remove("show");
    else openStore();
  });
  el.btnStoreClose.addEventListener("click", () => el.storeOverlay.classList.remove("show"));
  el.storeOverlay.addEventListener("click", (e) => {
    if (e.target === el.storeOverlay) el.storeOverlay.classList.remove("show");
  });

  // logger
  el.btnLog.addEventListener("click", () => {
    if (el.logOverlay.classList.contains("show")) el.logOverlay.classList.remove("show");
    else openLogger();
  });
  el.btnLogClose.addEventListener("click", () => el.logOverlay.classList.remove("show"));
  el.logOverlay.addEventListener("click", (e) => {
    if (e.target === el.logOverlay) el.logOverlay.classList.remove("show");
  });
  el.btnLogClear.addEventListener("click", () => {
    state.Log = [];
    state.LastMsg = "Log cleared.";
    render();
    if (el.logOverlay.classList.contains("show")) renderLogger();
  });

  // options
  el.btnOptions.addEventListener("click", () => {
    if (el.optionsOverlay.classList.contains("show")) el.optionsOverlay.classList.remove("show");
    else openOptions();
  });
  el.btnOptionsClose.addEventListener("click", () => el.optionsOverlay.classList.remove("show"));
  el.optionsOverlay.addEventListener("click", (e) => {
    if (e.target === el.optionsOverlay) el.optionsOverlay.classList.remove("show");
  });
  el.btnThemeDark.addEventListener("click", () => applyTheme("dark"));
  el.btnThemeLight.addEventListener("click", () => applyTheme("light"));

  // tap-to-show tooltips on touch devices (hover doesn't exist there)
  let activeTip = null;
  document.addEventListener("pointerdown", (e) => {
    const tipEl = e.target.closest("[data-tip]");
    if (activeTip && (!tipEl || activeTip !== tipEl)) {
      activeTip.classList.remove("show");
      activeTip = null;
    }
    if (tipEl) {
      e.preventDefault();
      tipEl.classList.add("show");
      activeTip = tipEl;
    }
  });

  // short blip on any button-like click (hub + combat + ghosts)
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btnSound, #btnOptSound")) return;
    if (e.target.closest(".btn, .movebtn, .ghostrow")) {
      audio.init();
      audio.click();
    }
  });

  // ------------------------------------------------------------ initial paint --
  applyTheme(currentTheme());
  render();
  syncSoundBtn();
  syncAutoRunBtn();
  el.btnAuto.textContent = state.AutoBattle ? "AUTO: ON" : "AUTO: OFF";

  return { render };
}
