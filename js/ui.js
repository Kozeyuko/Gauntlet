// js/ui.js — DOM rendering + event wiring. Talks to the engine game object.
import {
  ATTRIBUTES,
  ACTIVITY_LIST,
  LOCATION_LIST,
  LOCATIONS,
  STYLES,
  RIVALS,
  INSIDE,
  MAX_RIVAL,
  MAX_TOTAL,
} from "./data.js";

const $ = (id) => document.getElementById(id);

const clamp01 = (v) => Math.min(100, Math.max(0, v));

export function initUI(game, opts = {}) {
  const onReset = opts.onReset || (() => {});
  const state = game.state;
  let combatMeta = null; // foe name/style/mode captured at fight start
  let activeView = null; // current manual-combat view
  let autoTimer = null;   // auto-battle setTimeout handle

  // ------------------------------------------------------------ element refs --
  const el = {
    hMoney: $("hMoney"), hAge: $("hAge"), hLives: $("hLives"), hWins: $("hWins"),
    hRank: $("hRank"), hNext: $("hNext"),
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
    // combat
    combatOverlay: $("combatOverlay"),
    roundLbl: $("roundLbl"), modeLbl: $("modeLbl"),
    youStyle: $("youStyle"), youHpBar: $("youHpBar"), youHpTxt: $("youHpTxt"),
    youStamBar: $("youStamBar"), youStamTxt: $("youStamTxt"),
    youUltTxt: $("youUltTxt"), youUltBar: $("youUltBar"),
    foeName: $("foeName"), foeStyle: $("foeStyle"),
    foeHpBar: $("foeHpBar"), foeHpTxt: $("foeHpTxt"),
    foeStamBar: $("foeStamBar"), foeStamTxt: $("foeStamTxt"),
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
    b.addEventListener("click", () => { game.setActivity(act.key); render(); });
    activityButtons[act.key] = b;
    el.activitiesGrid.appendChild(b);
  });

  const locationButtons = {};
  LOCATION_LIST.forEach((loc) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = loc.label;
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
    const v = clamp01(value);
    bar.style.width = (v / max) * 100 + "%";
    txt.textContent = `${Math.round(value)} / ${Math.round(max)}`;
  }

  function renderVitals() {
    setBar(el.barHealth, el.barHealthTxt, Number(state.Health) || 0);
    setBar(el.barStamina, el.barStaminaTxt, Number(state.Stamina) || 0);
    setBar(el.barNutrition, el.barNutritionTxt, Number(state.Nutrition) || 0);
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
        stats: `${fmtStats(r.stats)} · Reward ${r.rewardMoney} Taels`,
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

  function renderLog() {
    el.logLine.textContent = String(state.LastMsg ?? "");
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
  }

  // ------------------------------------------------------------ result overlay --
  function showResult(win, body) {
    el.resultTitle.textContent = win ? "Victory" : "Defeat";
    el.resultBody.textContent = body || String(state.LastMsg ?? "");
    el.resultOverlay.classList.add("show");
  }

  // ------------------------------------------------------------ combat overlay --
  function stopAuto() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  function appendLog(events, round) {
    const box = el.combatLog;
    for (const ev of events) {
      const line = document.createElement("div");
      line.textContent = `[${String(round).padStart(2, "0")}] ${ev}`;
      if (ev.startsWith("You")) line.className = "you";
      else if (ev.startsWith("Foe")) line.className = "foe";
      else line.className = "sys";
      box.appendChild(line);
    }
    box.scrollTop = box.scrollHeight;
  }

  function renderCombat(view) {
    el.roundLbl.textContent = "ROUND " + Math.max(1, view.round);
    el.modeLbl.textContent = (view.mode || (combatMeta && combatMeta.mode) || "fight").toUpperCase();
    el.youStyle.textContent = view.playerStyleName || (combatMeta && combatMeta.playerStyleName) || state.ActiveStyle;
    el.foeName.textContent = view.foeName || (combatMeta && combatMeta.foeName) || "Rival";
    el.foeStyle.textContent = view.foeStyleName || (combatMeta && combatMeta.foeStyleName) || "—";

    el.youHpBar.style.width = Math.max(0, view.playerHp / view.playerMaxHp * 100) + "%";
    el.youHpTxt.textContent = `${view.playerHp} / ${view.playerMaxHp}`;
    el.youStamBar.style.width = Math.max(0, view.playerStam / (view.playerMaxStam || 100) * 100) + "%";
    el.youStamTxt.textContent = `${view.playerStam} / ${view.playerMaxStam || 100}`;
    el.foeHpBar.style.width = Math.max(0, view.foeHp / view.foeMaxHp * 100) + "%";
    el.foeHpTxt.textContent = `${view.foeHp} / ${view.foeMaxHp}`;
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
          if (v.events && v.events.length) appendLog(v.events, v.round);
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
        if (v.events && v.events.length) appendLog(v.events, v.round);
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
    el.combatLog.innerHTML = "";
    el.combatOverlay.classList.add("show");
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
    const view = game.beginFight();
    if (view) openCombat(view);
    else render();
  });

  el.btnAutoFight.addEventListener("click", () => {
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
    game.reincarnate("you chose to begin a new life");
    render();
  });

  el.btnReset.addEventListener("click", () => {
    if (confirm("Hard reset? This wipes your save and ghosts.")) onReset();
  });

  el.btnUlt.addEventListener("click", () => {
    if (!activeView || activeView.finished) return;
    const v = game.activateUlt();
    if (v) { activeView = v; renderCombat(v); }
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

  // ------------------------------------------------------------ initial paint --
  render();
  el.btnAuto.textContent = state.AutoBattle ? "AUTO: ON" : "AUTO: OFF";

  return { render };
}
