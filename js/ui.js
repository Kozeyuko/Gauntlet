// js/ui.js — DOM rendering + event wiring. Talks to the engine game object.
import {
  ATTRIBUTES,
  ACTIVITIES,
  LOCATION_LIST,
  LOCATIONS,
  STYLES,
  RIVALS,
  INSIDE,
  CSTORE_ITEMS,
  CLINIC_ITEMS,
  JOBS,
  jobPay,
  jobStaminaCost,
  jobXpForLevel,
  jobActionRate,
  ROAMERS,
  MASTERY_TIERS,
  KNOWLEDGE_UNMASTERED,
  KNOWLEDGE_LEARNED,
  CUSTOM_SKILL_PENALTY,
  CUSTOM_MAX_SKILLS,
  MAX_RIVAL,
  MAX_TOTAL,
  styleTier,
  GAME_VERSION,
  UPDATE_LOG,
  trainChain,
  GYM_TRAINING,
  MAIN_GYM,
  EQUIPMENT,
  MAP_POS,
  MOVE_BASE_SPEED,
  STATUS_EFFECT_INFO,
} from "./data.js";
import { eventToString } from "./engine.js";
import { audio } from "./audio.js";

const $ = (id) => document.getElementById(id);

const SAVE_KEY = "gauntlet-save-v1";
const GHOST_KEY = "gauntlet-ghosts-v1";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function fmtCash(n) {
  return "$" + (Number(n) || 0).toFixed(2);
}

const reducedMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- map layout --
const MAP_W = 1000;
const MAP_H = 850;

// Roamer dots sit on road segments.
const ROAMER_SPOTS = {
  "w-top": [225, 120], "w-top2": [300, 120],
  "w-mid": [225, 300], "w-bottom": [225, 480],
  "w-conn": [150, 210],
  "bridge": [500, 300],
  "e-top": [760, 120], "e-top2": [880, 120],
  "e-mid": [700, 300], "e-mid2": [820, 300],
  "e-bottom": [700, 480], "e-bottom2": [820, 480],
  "e-conn": [640, 390], "e-conn2": [880, 210],
};

const LOC_DESC = {};
LOCATION_LIST.forEach((l) => { LOC_DESC[l.key] = l.desc; });

const pct = (v, dim) => ((v / dim) * 100).toFixed(4) + "%";

function fmtCountdown(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function mapSvgMarkup() {
  const hTop = 120, hMid = 300, hBot = 480;
  return `
    <rect class="m-land" x="0" y="0" width="1000" height="850"/>
    <rect class="m-river" x="460" y="0" width="80" height="720"/>
    <!-- roads: 3 horizontal (only middle crosses the river) -->
    <rect class="m-road" x="0" y="${hTop - 7}" width="460" height="14"/>
    <rect class="m-road" x="540" y="${hTop - 7}" width="460" height="14"/>
    <rect class="m-road" x="0" y="${hMid - 7}" width="1000" height="14"/>
    <rect class="m-road" x="0" y="${hBot - 7}" width="460" height="14"/>
    <rect class="m-road" x="540" y="${hBot - 7}" width="460" height="14"/>
    <!-- vertical connector roads -->
    <rect class="m-road" x="143" y="0" width="14" height="720"/>
    <rect class="m-road" x="303" y="0" width="14" height="720"/>
    <rect class="m-road" x="633" y="0" width="14" height="720"/>
    <rect class="m-road" x="753" y="0" width="14" height="720"/>
    <rect class="m-road" x="873" y="0" width="14" height="720"/>
    <!-- the one bridge -->
    <rect class="m-bridge" x="440" y="${hMid - 9}" width="120" height="18"/>
    <!-- The Inside: gated approach at the map edge -->
    <rect class="m-road" x="493" y="${hBot - 7}" width="14" height="245"/>
    <rect class="m-inside" x="320" y="725" width="360" height="112"/>
    <rect class="m-gate" id="insideGate" x="468" y="720" width="64" height="8"/>
    <text class="m-insidetext" x="500" y="742" text-anchor="middle">THE INSIDE</text>
    <text class="m-district" x="160" y="695" text-anchor="middle">WEST</text>
    <text class="m-district" x="840" y="695" text-anchor="middle">EAST</text>
    <text class="m-rivername" x="500" y="100" text-anchor="middle" transform="rotate(90 500 100)">RIVER</text>
  `;
}

export function initUI(game, opts = {}) {
  const onReset = opts.onReset || (() => {});
  const onSave = opts.onSave || (() => {});
  const firstLaunch = opts.firstLaunch === true;
  const state = game.state;
  let combatMeta = null; // foe name/style/mode captured at fight start
  let activeView = null; // current manual-combat view
  let autoTimer = null;   // auto-battle setTimeout handle
  let prevYouHp = null;   // last rendered HP (for ghost-tail bar)
  let prevFoeHp = null;
  let lastRound = 0;      // last rendered round (for banner pop)
  let lastRankMsg = "";   // last POTENTIAL UP message (for rankup ding)
  let autoRunTimer = null; // activity auto-run setTimeout handle
  let encounterShown = false; // rival overlay auto-open dedupe
  let openLocKey = null; // location key of the currently-open location overlay

  // ------------------------------------------------------------ element refs --
  const el = {
    hName: $("hName"),
    hMoney: $("hMoney"), hAge: $("hAge"), hLives: $("hLives"), hWins: $("hWins"),
    hRank: $("hRank"), hNext: $("hNext"),
    btnSound: $("btnSound"),
    barHealth: $("barHealth"), barHealthTxt: $("barHealthTxt"),
    barStamina: $("barStamina"), barStaminaTxt: $("barStaminaTxt"),
    barNutrition: $("barNutrition"), barNutritionTxt: $("barNutritionTxt"),
    hMoneyLeft: $("hMoneyLeft"),
    attrsBody: $("attrsBody"),
    activitiesGrid: $("activitiesGrid"),
    stylesGrid: $("stylesGrid"),
    activeStyleInfo: $("activeStyleInfo"),
    knownSkillCount: $("knownSkillCount"),
    btnBuild: $("btnBuild"),
    buildOverlay: $("buildOverlay"),
    buildBaseList: $("buildBaseList"),
    buildSkillList: $("buildSkillList"),
    buildPreview: $("buildPreview"),
    btnBuildSave: $("btnBuildSave"),
    btnBuildClear: $("btnBuildClear"),
    btnBuildClose: $("btnBuildClose"),
    rivalName: $("rivalName"), rivalStyle: $("rivalStyle"), rivalLine: $("rivalLine"),
    rivalStats: $("rivalStats"), rivalLearn: $("rivalLearn"),
    rivalQuickName: $("rivalQuickName"), rivalQuickLearn: $("rivalQuickLearn"),
    btnQuickFight: $("btnQuickFight"),
    btnFight: $("btnFight"), btnAutoFight: $("btnAutoFight"),
    btnLooking: $("btnLooking"), btnGhosts: $("btnGhosts"),
    logList: $("logList"),
    btnReincarnate: $("btnReincarnate"),
    btnReset: $("btnReset"),
    btnAutoRun: $("btnAutoRun"),
    storeOverlay: $("storeOverlay"), storeName: $("storeName"), storeNotice: $("storeNotice"),
    storeCash: $("storeCash"), storeList: $("storeList"), storeTabs: $("storeTabs"),
    btnStoreClose: $("btnStoreClose"),
    btnOptions: $("btnOptions"), optionsOverlay: $("optionsOverlay"),
    btnOptSound: $("btnOptSound"), btnThemeDark: $("btnThemeDark"), btnThemeLight: $("btnThemeLight"),
    optNameInput: $("optNameInput"), btnOptNameSave: $("btnOptNameSave"),
    btnOptionsClose: $("btnOptionsClose"),
    // jobs
    btnJobs: $("btnJobs"), jobsOverlay: $("jobsOverlay"), jobList: $("jobList"),
    jobGameArea: $("jobGameArea"), btnJobsClose: $("btnJobsClose"),
    // arena hub
    arenaOverlay: $("arenaOverlay"), btnArenaLadder: $("btnArenaLadder"),
    btnArenaTourney: $("btnArenaTourney"), btnArenaGu: $("btnArenaGu"), btnArenaClose: $("btnArenaClose"),
    // chained roamers
    chainOverlay: $("chainOverlay"), chainPrompt: $("chainPrompt"),
    btnChainNext: $("btnChainNext"), btnChainCashout: $("btnChainCashout"),
    // city map
    citymap: $("citymap"),
    // rival overlay
    btnRival: $("btnRival"), rivalOverlay: $("rivalOverlay"), btnRivalClose: $("btnRivalClose"),
    // location overlay
    locOverlay: $("locOverlay"), locName: $("locName"), locTier: $("locTier"), locFlavor: $("locFlavor"),
    locFightersTitle: $("locFightersTitle"), locFightersList: $("locFightersList"), btnLocClose: $("btnLocClose"),
    // logger
    btnLog: $("btnLog"), logOverlay: $("logOverlay"), logFull: $("logFull"),
    logStats: $("logStats"), btnLogClear: $("btnLogClear"), btnLogClose: $("btnLogClose"),
    // combat
    combatOverlay: $("combatOverlay"),
    roundLbl: $("roundLbl"), modeLbl: $("modeLbl"),
    youName: $("youName"), youStyle: $("youStyle"), youHpBar: $("youHpBar"), youHpTxt: $("youHpTxt"),
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
    btnEscape: $("btnEscape"),
    // ghosts
    ghostOverlay: $("ghostOverlay"), ghostList: $("ghostList"), ghostEmpty: $("ghostEmpty"),
    btnGhostClose: $("btnGhostClose"),
    // result
    resultOverlay: $("resultOverlay"), resultTitle: $("resultTitle"), resultBody: $("resultBody"),
    resultLearn: $("resultLearn"),
    btnResultClose: $("btnResultClose"),
    // name prompt
    nameOverlay: $("nameOverlay"), nameInput: $("nameInput"), btnNameBegin: $("btnNameBegin"),
    // inventory
    btnInventory: $("btnInventory"), inventoryOverlay: $("inventoryOverlay"),
    inventoryList: $("inventoryList"), inventoryEmpty: $("inventoryEmpty"),
    btnInventoryClose: $("btnInventoryClose"),
    // tasklist quick (now the full editor)
    taskActivityListQuick: $("taskActivityListQuick"),
    // update log
    updateOverlay: $("updateOverlay"), btnUpdateLog: $("btnUpdateLog"),
    btnUpdateClose: $("btnUpdateClose"), updateList: $("updateList"),
    updateHeader: $("updateHeader"),
    // statistics
    btnStats: $("btnStats"), statsOverlay: $("statsOverlay"),
    statsBody: $("statsBody"), btnStatsClose: $("btnStatsClose"),
    // tasklist quick
    taskQueueQuick: $("taskQueueQuick"),
    btnTaskRepeatQuick: $("btnTaskRepeatQuick"), btnTaskAdvanceQuick: $("btnTaskAdvanceQuick"),
    btnTaskPlayQuick: $("btnTaskPlayQuick"), btnTaskAutoQuick: $("btnTaskAutoQuick"),
    taskSpeedQuick: $("taskSpeedQuick"),
    // save / load
    btnSave: $("btnSave"),
    saveOverlay: $("saveOverlay"),
    saveCodeTextarea: $("saveCodeTextarea"),
    btnSaveCopy: $("btnSaveCopy"), btnSaveDownload: $("btnSaveDownload"),
    loadCodeTextarea: $("loadCodeTextarea"),
    btnSaveImport: $("btnSaveImport"), saveImportStatus: $("saveImportStatus"),
    btnSaveClose: $("btnSaveClose"),
    btnOptSaveLoad: $("btnOptSaveLoad"),
  };

  // ------------------------------------------------------------ build static grids --
  const styleName = (id) => (STYLES[id] ? STYLES[id].name : id);

  const lookupSkill = (key) => {
    const pipe = key.indexOf("|");
    if (pipe < 0) return null;
    const stId = key.slice(0, pipe);
    const skName = key.slice(pipe + 1);
    const st = STYLES[stId];
    if (!st || !st.skills) return null;
    return st.skills.find((s) => s.name === skName) || null;
  };

  // ------------------------------------------------------------ build city map --
  const buildingEls = {};
  const roamerEls = {};

  function clickBuilding(key) {
    const loc = LOCATIONS[key];
    if (!loc) return;
    if (isLocked(key)) {
      game.logMsg("Locked — beat more rivals.");
      render();
      return;
    }
    if (state.MovingTo) {
      game.logMsg("Already traveling — wait to arrive.");
      render();
      return;
    }
    game.beginMove(key);
    render();
  }

  function openArrivalOverlay(key) {
    if (key === "cstore") { openStore("cstore"); return; }
    if (key === "clinic") { openStore("clinic"); return; }
    if (key === MAIN_GYM) { openStore("gym"); return; }
    if (key === "jobboard") { openJobs(); return; }
    if (key === "arena") { openArena(); return; }
    openLocationOverlay(key);
  }

  function signalArrival(locKey) {
    pendingArrival = locKey;
  }

  el.citymap.innerHTML = `
    <div class="map-wrap">
      <svg class="map-svg" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid meet">${mapSvgMarkup()}</svg>
      <div class="map-layer" id="mapLayer"></div>
    </div>`;
  const mapLayer = $("mapLayer");

  LOCATION_LIST.forEach((loc) => {
    const pos = MAP_POS[loc.key];
    if (!pos) return;
    const b = document.createElement("div");
    b.className = "bldg";
    b.style.left = pct(pos[0], MAP_W);
    b.style.top = pct(pos[1], MAP_H);
    const pin = loc.glyph ? `<span class="pin glyph">${loc.glyph}</span>` : `<span class="pin"></span>`;
    b.innerHTML = `${pin}<span class="lock"></span><span class="blbl">${loc.label}</span>`;
    b.setAttribute("data-tip", buildingBaseTip(loc.key));
    b.addEventListener("click", () => clickBuilding(loc.key));
    buildingEls[loc.key] = b;
    mapLayer.appendChild(b);
  });

  ROAMERS.forEach((r) => {
    const spot = ROAMER_SPOTS[r.zone];
    if (!spot) return;
    const d = document.createElement("div");
    d.className = "roamer";
    d.style.left = pct(spot[0], MAP_W);
    d.style.top = pct(spot[1], MAP_H);
    d.innerHTML = `<span class="rdot"></span><span class="rname">${r.name}</span><span class="rcount"></span>`;
    d.setAttribute("data-tip", `${r.name} — roaming ${styleName(r.style)}. Click to fight.`);
    d.addEventListener("click", () => {
      if (game.roamerStatus(r.key) !== "ready") return;
      pauseAutoRun();
      const view = game.beginRoamerFight(r.key);
      if (view) openCombat(view);
      else render();
    });
    roamerEls[r.key] = d;
    mapLayer.appendChild(d);
  });

  // Player marker
  const playerMarker = document.createElement("div");
  playerMarker.className = "player-marker";
  playerMarker.innerHTML = `<span class="pm-dot"></span>`;
  mapLayer.appendChild(playerMarker);

  // Dashed route line (SVG overlay) + ETA box
  const routeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  routeSvg.setAttribute("class", "route-svg");
  routeSvg.setAttribute("viewBox", `0 0 ${MAP_W} ${MAP_H}`);
  routeSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const routeLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  routeLine.setAttribute("class", "route-line");
  routeSvg.appendChild(routeLine);
  mapLayer.appendChild(routeSvg);
  const etaBox = document.createElement("div");
  etaBox.className = "eta-box";
  etaBox.style.display = "none";
  mapLayer.appendChild(etaBox);

  let pendingArrival = null;

  // ------------------------------------------------------------ render helpers --
  const fmtAge = (days) => {
    const y = Math.floor(days / 365);
    const d = Math.floor(days % 365);
    return `Age ${y} y ${d} d`;
  };

  const fmtStats = (stats) => {
    if (!stats) return "";
    return `Str ${stats.Str} · Tou ${stats.Tou} · Spd ${stats.Spd} · Int ${stats.Int} · Cha ${stats.Cha}`;
  };

  const clampRivalIdx = () => Math.min(Math.max(Number(state.RivalIdx) || 1, 1), MAX_TOTAL);

  function isLocked(key) {
    const loc = LOCATIONS[key];
    if (!loc) return true;
    return clampRivalIdx() <= loc.unlock;
  }

  function buildingBaseTip(key) {
    const loc = LOCATIONS[key];
    const d = LOC_DESC[key] || "";
    return d ? `${loc.name}. ${d}` : loc.name;
  }

  function renderHeader() {
    el.hName.textContent = String(state.Name || "You");
    el.hMoney.textContent = fmtCash(state.Money);
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
    el.hMoneyLeft.textContent = fmtCash(state.Money);
  }

  function renderAttrs() {
    let html = "";
    for (const a of ATTRIBUTES) {
      const val = Number(state[a.id]) || 0;
      const apt = Number(state[a.id + "Ap"]) || 0;
      const tip = `${a.name} — ${a.desc} Aptitude ×${apt.toFixed(2)} (multiplier applied to all gains).`;
      html += `<div class="attrrow" data-tip="${tip}" title="${tip}">
        <span class="nm">${a.name}</span>
        <span class="val">${val.toFixed(2)}</span>
        <span class="apt">×${apt.toFixed(2)}</span>
      </div>`;
    }
    el.attrsBody.innerHTML = html;
  }

  function renderStyles() {
    // Every style with knowledge > 0 OR already known (>= 25%) gets a row.
    const list = Object.keys(STYLES)
      .filter((id) => game.styleKnowledge(id) > 0 || game.learnedStyles()[id])
      .sort();
    el.stylesGrid.innerHTML = "";
    for (const id of list) {
      const k = game.styleKnowledge(id);
      const status = k >= KNOWLEDGE_LEARNED ? "Learned" : (k >= KNOWLEDGE_UNMASTERED ? "Unmastered" : "—");
      const b = document.createElement("button");
      b.className = "btn stybtn";
      b.setAttribute("data-tip", `${styleName(id)} — Tier ${styleTier(id)} — ${Math.round(k)}% known`);
      b.innerHTML = `<span class="sname">${styleName(id)}</span><span class="sbar"><i style="width:${Math.round(k)}%"></i></span><span class="sstat">${status}</span>`;
      b.disabled = k < KNOWLEDGE_UNMASTERED;
      if (k >= KNOWLEDGE_UNMASTERED) {
        b.addEventListener("click", () => { game.setStyle(id); render(); });
      }
      b.classList.toggle("active-style", id === game.activeStyle());
      el.stylesGrid.appendChild(b);
    }
    el.knownSkillCount.textContent = `${game.knownSkillList().length} moves learned`;
    const active = game.activeStyle();
    const st = STYLES[active];
    if (st) {
      const b = [];
      if (st.dmg > 1) b.push(`dmg +${Math.round((st.dmg - 1) * 100)}%`);
      if (st.dodge > 0) b.push(`dodge +${Math.round(st.dodge * 100)}%`);
      if (st.crit > 0) b.push(`crit +${Math.round(st.crit * 100)}%`);
      el.activeStyleInfo.textContent = `Active: ${st.name}${b.length ? " (" + b.join(", ") + ")" : ""} · Ultimate: ${st.ult ? st.ult.name : "Berserk"}`;
    }
  }

  function renderMap() {
    const rivalIdx = clampRivalIdx();
    for (const key of Object.keys(buildingEls)) {
      const b = buildingEls[key];
      const loc = LOCATIONS[key];
      let hidden = rivalIdx <= loc.unlock;
      if (key === "inside") hidden = rivalIdx <= MAX_RIVAL;
      b.classList.toggle("locked", hidden);
      b.classList.toggle("hidden", hidden);
      b.classList.toggle("here", key === state.Location && !state.MovingTo);
      if (!hidden) {
        b.setAttribute("data-tip", buildingBaseTip(key));
      }
    }
    const gate = $("insideGate");
    if (gate) {
      gate.classList.toggle("open", rivalIdx > MAX_RIVAL);
      gate.style.display = rivalIdx > MAX_RIVAL ? "" : "none";
    }
    const insideLabel = document.querySelector(".m-insidetext");
    if (insideLabel) insideLabel.style.display = rivalIdx > MAX_RIVAL ? "" : "none";
    const insideBox = document.querySelector(".m-inside");
    if (insideBox) insideBox.style.display = rivalIdx > MAX_RIVAL ? "" : "none";
    // Player marker position
    const px = num(state.PlayerX);
    const py = num(state.PlayerY);
    playerMarker.style.left = pct(px, MAP_W);
    playerMarker.style.top = pct(py, MAP_H);
    playerMarker.classList.toggle("moving", !!state.MovingTo);
    if (state.MovingTo) {
      const dest = LOCATIONS[state.MovingTo];
      const pctDone = Math.round((num(state.MoveProgress) || 0) * 100);
      playerMarker.setAttribute("data-tip", `Traveling to ${dest ? dest.name : state.MovingTo}… ${pctDone}%`);
      // Dashed route line + ETA
      const path = state.routePath;
      const pts = [];
      if (Array.isArray(path) && path.length) {
        pts.push([px, py]);
        for (const wp of path) pts.push(wp);
      } else if (dest && MAP_POS[state.MovingTo]) {
        pts.push([px, py], MAP_POS[state.MovingTo]);
      }
      if (pts.length >= 2) {
        routeLine.setAttribute("points", pts.map((p) => `${p[0]},${p[1]}`).join(" "));
        routeSvg.style.display = "";
      } else {
        routeSvg.style.display = "none";
      }
      // ETA: remaining distance / speed
      const spd = Math.max(1, num(state.Spd));
      const speed = MOVE_BASE_SPEED * (1 + spd * 0.12);
      let rem = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        rem += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      }
      rem *= (1 - Math.max(0, Math.min(1, num(state.MoveProgress))));
      const etaSec = Math.max(0, Math.round(rem / Math.max(0.01, speed)));
      etaBox.textContent = `~${etaSec}s`;
      etaBox.style.display = "block";
      etaBox.style.left = pct(px, MAP_W);
      etaBox.style.top = `calc(${pct(py, MAP_H)} + 14px)`;
    } else {
      const here = LOCATIONS[state.Location];
      playerMarker.setAttribute("data-tip", here ? `At ${here.name}` : "");
      routeSvg.style.display = "none";
      etaBox.style.display = "none";
    }
    renderRoamers();
  }

  function renderRoamers() {
    for (const key of Object.keys(roamerEls)) {
      const elR = roamerEls[key];
      const status = game.roamerStatus(key);
      elR.classList.toggle("ready", status === "ready");
      elR.classList.toggle("defeated", status === "defeated");
      const cnt = elR.querySelector(".rcount");
      if (status === "defeated") {
        cnt.textContent = fmtCountdown(game.roamerRemaining(key));
        cnt.style.display = "";
      } else {
        cnt.style.display = "none";
      }
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
        learnStyleId: null,
      };
    }
    const idx = clampRivalIdx();
    if (idx <= MAX_RIVAL) {
      const r = RIVALS[idx - 1];
      return {
        name: r.name,
        style: `Style: ${styleName(r.style)}`,
        line: r.line,
        stats: `${fmtStats(r.stats)} · Reward ${fmtCash(r.rewardMoney)}`,
        fightLabel: "FIGHT",
        mode: "ladder",
        learnStyleId: r.style,
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
      learnStyleId: f.style,
    };
  }

  function learnLine(info) {
    if (!info.learnStyleId) return "";
    const k = game.styleKnowledge(info.learnStyleId);
    return `Learn: ${styleName(info.learnStyleId)} — ${Math.round(k)}% known`;
  }

  function renderRival() {
    const info = rivalInfo();
    el.rivalName.textContent = info.name;
    el.rivalStyle.textContent = info.style;
    el.rivalLine.textContent = info.line;
    el.rivalStats.textContent = info.stats;
    el.rivalLearn.textContent = learnLine(info);
    el.btnFight.textContent = info.fightLabel;
  }

  function renderQuickRival() {
    if (!el.rivalQuickName) return;
    const info = rivalInfo();
    el.rivalQuickName.textContent = info.name;
    el.rivalQuickLearn.textContent = learnLine(info);
    el.btnQuickFight.textContent = info.fightLabel;
  }

  const LOG_KIND_LABEL = {
    sys: "", rank: "RANK", fight: "FIGHT", train: "TRAIN", money: "MONEY",
    life: "LIFE", eat: "NUTRI", store: "STORE", skill: "MASTERY", loc: "MOVE", act: "ACT", job: "JOB",
  };

  function renderLog() {
    const entries = Array.isArray(state.Log) ? state.Log : (state.LastMsg ? [state.LastMsg] : []);
    el.logList.innerHTML = "";
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
      el.logList.appendChild(d);
    }
    el.logList.scrollTop = el.logList.scrollHeight;
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
    renderStyles();
    renderMap();
    renderRival();
    renderQuickRival();
    renderEquipmentPanel();
    renderTasklistQuick();
    renderLog();
    renderLooking();
    maybeOpenRivalForEncounter();
    maybeOpenUpdateLog();
    const cost = game.rebirthCost ? game.rebirthCost() : 0;
    el.btnReincarnate.textContent = `REBIRTH (${fmtCash(cost)})`;
    if (el.logOverlay.classList.contains("show")) renderLogger();
    if (el.jobsOverlay.classList.contains("show") && el.jobList.style.display !== "none") renderJobs();
    if (el.locOverlay.classList.contains("show") && openLocKey) renderLocActivities(openLocKey);
    // Handle arrival after movement completes
    if (pendingArrival) {
      const key = pendingArrival;
      pendingArrival = null;
      openArrivalOverlay(key);
    }
  }

  function maybeOpenRivalForEncounter() {
    if (num(state.Encounter) >= 1) {
      if (!encounterShown) {
        encounterShown = true;
        el.locOverlay.classList.remove("show");
        el.rivalOverlay.classList.add("show");
      }
    } else {
      encounterShown = false;
    }
  }

  let updateLogAutoOpened = false;
  function maybeOpenUpdateLog() {
    if (updateLogAutoOpened) return;
    if (game.shouldShowUpdateLog && game.shouldShowUpdateLog()) {
      updateLogAutoOpened = true;
      state.SeenVersion = game.GAME_VERSION;
      onSave();
      openUpdateLog(game.GAME_VERSION);
    }
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
    if (state.LastMsg && state.LastMsg.includes("Not enough Cash")) {
      pauseAutoRun();
      return;
    }

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

  // ------------------------------------------------------------ location overlay --
  function renderLocTier(key) {
    const loc = LOCATIONS[key];
    const tier = loc && loc.tier ? loc.tier : 0;
    if (!tier) {
      el.locTier.style.display = "none";
      el.locTier.textContent = "";
      return;
    }
    el.locTier.style.display = "";
    el.locTier.textContent = "Tier " + tier;
    el.locTier.classList.toggle("elite", tier === 4);
  }

  function renderLocActivities(key) {
    el.activitiesGrid.innerHTML = "";
    const money = num(state.Money);

    function addRow(actKey) {
      const act = ACTIVITIES[actKey];
      if (!act) return;
      const isFree = true;
      const canAfford = true;

      const b = document.createElement("button");
      b.className = "btn locrow";
      if (!canAfford) b.classList.add("cantafford");
      if (actKey === state.Activity) b.classList.add("active");

      const statName = actKey === "Rest" ? "recover" : "earn Cash";

      let meta = "";
      if (actKey === "Rest") {
        meta += `<span class="lr-cost">Free</span>`;
        meta += `<span class="lr-stam">+35 STA</span>`;
      } else {
        meta += `<span class="lr-cost">Free</span>`;
        meta += `<span class="lr-stam">${act.cost} STA</span>`;
      }

      b.innerHTML = `
        <span class="lr-main">
          <span class="lr-name">${act.name}</span>
          <span class="lr-stat">${statName}</span>
        </span>
        <span class="lr-meta">${meta}</span>`;
      b.addEventListener("click", () => clickActivity(actKey));
      el.activitiesGrid.appendChild(b);
    }

    addRow("Rest");
    addRow("OddJobs");
  }

  function renderLocFighters(key) {
    const loc = LOCATIONS[key];
    if (!el.locFightersList || !el.locFightersTitle) return;
    el.locFightersList.innerHTML = "";
    if (!loc.styleGym) {
      el.locFightersTitle.textContent = "Style";
      const div = document.createElement("div");
      div.className = "small";
      div.textContent = "No style taught here.";
      el.locFightersList.appendChild(div);
      return;
    }
    const styleId = loc.styleGym;
    const st = STYLES[styleId];
    const learned = game.learnedStyles()[styleId];
    const xp = game.styleXpMap()[styleId] || 0;
    let tier = 0;
    for (let i = 0; i < MASTERY_TIERS.length; i++) if (xp >= MASTERY_TIERS[i]) tier = i + 1;
    const next = MASTERY_TIERS[tier] || null;
    el.locFightersTitle.textContent = `Fighters (${game.locationFightsBeaten(key)}/5 cleared)`;
    const rivals = game.locationFightList(key);
    for (const r of rivals) {
      const row = document.createElement("div");
      row.className = "ghostrow" + (r.beaten ? " defeated" : (!r.unlocked ? " locked" : ""));
      row.innerHTML = `
        <div class="gmain">
          <div class="gnm">${r.name} ${r.beaten ? "✓" : ""}</div>
          <div class="gsub">${st ? st.name : styleId} · reward ${fmtCash(r.rewardMoney)} · ${r.rewardXp} XP${!r.unlocked ? " (locked)" : ""}</div>
        </div>`;
      if (!r.beaten && r.unlocked) {
        const btn = document.createElement("button");
        btn.className = "btn small-btn";
        btn.textContent = "FIGHT";
        btn.addEventListener("click", () => {
          const view = game.beginLocationFight(key, r.n);
          if (view) renderCombat(view);
        });
        row.appendChild(btn);
      }
      el.locFightersList.appendChild(row);
    }
  }

  function openLocationOverlay(key) {
    const loc = LOCATIONS[key];
    if (!loc) return;
    openLocKey = key;
    el.locName.textContent = loc.name;
    el.locFlavor.textContent = LOC_DESC[key] || "";
    renderLocTier(key);
    renderLocActivities(key);
    renderLocFighters(key);
    // Cook panel at Home
    const isHome = key === "home";
    if (isHome && el.cookPanel) {
      renderCookPanel();
      el.cookPanel.style.display = "";
    } else if (el.cookPanel) {
      el.cookPanel.style.display = "none";
    }
    el.locOverlay.classList.add("show");
  }

  function renderCookPanel() {
    if (!el.cookList) return;
    el.cookList.innerHTML = "";
    const inv = Array.isArray(state.Inventory) ? state.Inventory : [];
    const recipes = CSTORE_ITEMS.filter((i) => i.cookTo);
    for (const raw of recipes) {
      const entry = inv.find((e) => e.key === raw.key);
      const qty = entry ? entry.qty : 0;
      const cooked = CSTORE_ITEMS.find((i) => i.key === raw.cookTo);
      const row = document.createElement("div");
      row.className = "storerow";
      const main = document.createElement("div");
      main.className = "smain";
      const nm = document.createElement("div");
      nm.className = "snm";
      nm.textContent = `${raw.name} → ${cooked ? cooked.name : raw.cookTo}`;
      const sub = document.createElement("div");
      sub.className = "ssub";
      sub.textContent = `In inventory: ${qty}`;
      main.appendChild(nm);
      main.appendChild(sub);
      const btn = document.createElement("button");
      btn.className = "btn small-btn" + (qty > 0 ? "" : " cantafford");
      btn.textContent = "COOK";
      btn.addEventListener("click", () => {
        game.cookItem(raw.key);
        renderCookPanel();
        render();
      });
      row.appendChild(main);
      row.appendChild(btn);
      el.cookList.appendChild(row);
    }
  }

  function renderEquipmentPanel() {
    if (!el.equipmentList) return;
    el.equipmentList.innerHTML = "";
    const owned = Array.isArray(state.OwnedEquipment) ? state.OwnedEquipment : [];
    const equipped = state.Equipment || {};
    if (owned.length === 0) {
      const empty = document.createElement("div");
      empty.className = "small";
      empty.textContent = "No equipment owned. Buy at the store.";
      el.equipmentList.appendChild(empty);
      return;
    }
    for (const key of owned) {
      const item = EQUIPMENT.find((e) => e.key === key);
      if (!item) continue;
      const isEquipped = equipped[item.slot] === key;
      const row = document.createElement("div");
      row.className = "storerow";
      const main = document.createElement("div");
      main.className = "smain";
      const nm = document.createElement("div");
      nm.className = "snm";
      nm.textContent = `${item.name} (${item.slot})`;
      const sub = document.createElement("div");
      sub.className = "ssub";
      sub.textContent = item.desc;
      main.appendChild(nm);
      main.appendChild(sub);
      const btn = document.createElement("button");
      btn.className = "btn small-btn" + (isEquipped ? " owned" : "");
      btn.textContent = isEquipped ? "UNEQUIP" : "EQUIP";
      btn.addEventListener("click", () => {
        if (isEquipped) game.unequipItem(key);
        else game.equipItem(key);
        renderEquipmentPanel();
        render();
      });
      row.appendChild(main);
      row.appendChild(btn);
      el.equipmentList.appendChild(row);
    }
  }

  // ------------------------------------------------------------ Jobs UI & Minigames --
  let minigameTimer = null;

  function renderJobs() {
    el.jobList.innerHTML = "";
    const activeAuto = game.autoJobActive();
    for (const j of JOBS) {
      const lvl = game.jobLevel(j.key);
      const xp = game.jobXp(j.key);
      const needed = jobXpForLevel(j, lvl);
      const pay = jobPay(j, lvl);
      const cost = jobStaminaCost(j, lvl);
      const canAfford = num(state.Stamina) >= cost;
      const isAutoActive = activeAuto === j.key;

      const card = document.createElement("div");
      card.className = "jobcard" + (isAutoActive ? " auto-active" : "");
      card.innerHTML = `
        <div class="jhead">
          <span>${j.name}</span>
          <span class="gold">Lv. ${lvl}</span>
        </div>
        <div class="jdesc">${j.desc}</div>
        <div class="jbar"><i style="width:${Math.min(100, (xp / needed) * 100)}%"></i></div>
        <div class="jmeta">
          <span>XP: ${xp} / ${needed}</span> · 
          <span>Cost: ${cost} STA</span> · 
          <span>Pay: ~${fmtCash(pay)}</span>
        </div>
        <div class="jbtns">
          <button class="btn small-btn work-btn" ${canAfford ? "" : "disabled"}>WORK SHIFT</button>
          <button class="btn small-btn auto-toggle-btn ${isAutoActive ? "on" : ""}">
            ${isAutoActive ? "AUTO: ON" : "AUTO: OFF"}
          </button>
        </div>
      `;

      card.querySelector(".work-btn").addEventListener("click", () => startJobMinigame(j));
      card.querySelector(".auto-toggle-btn").addEventListener("click", () => {
        if (isAutoActive) {
          game.clearAutoJob();
        } else {
          game.setAutoJob(j.key);
        }
        render();
      });

      el.jobList.appendChild(card);
    }
    if (activeAuto) {
      const activeJob = JOBS.find((j) => j.key === activeAuto);
      const status = document.createElement("div");
      status.className = "auto-job-status";
      status.textContent = `AUTO: ${activeJob ? activeJob.name : activeAuto}`;
      el.jobList.appendChild(status);
    }
  }

  function openJobs() {
    el.jobList.style.display = "";
    el.jobGameArea.style.display = "none";
    el.jobGameArea.innerHTML = "";
    renderJobs();
    el.jobsOverlay.classList.add("show");
  }

  function startJobMinigame(job) {
    if (!game.jobCanWork(job.key)) {
      game.logMsg("Too tired to work.");
      render();
      return;
    }

    el.jobList.style.display = "none";
    el.jobGameArea.style.display = "flex";
    el.jobGameArea.innerHTML = "";

    const lvl = game.jobLevel(job.key);
    let round = 0;
    let combo = 0;
    let fails = 0;
    let totalCash = 0;
    let totalXp = 0;
    const cfg = job.minigameConfig;

    game.doJobShift(job.key, 0);

    function cleanup() {
      if (minigameTimer) { clearTimeout(minigameTimer); minigameTimer = null; }
    }

    function updateHud(success) {
      const rate = jobActionRate(combo);
      const ratePct = Math.round(rate * 100);
      const stam = Math.max(0, Math.round(num(state.Stamina)));
      const stamCost = game.jobActionStaminaCost(job.key);
      let hudHtml = `<div class="mg-hud">Action ${round} · Combo ${combo} · Rate ${ratePct}% · Cash +${fmtCash(totalCash)} · XP +${totalXp.toFixed(1)} · Stam ${stam} (−${stamCost}/act) · Fails ${fails}/3</div><button class="btn small-btn mg-quit" id="mgQuit">QUIT</button>`;
      const existing = el.jobGameArea.querySelector('.mg-hud');
      if (existing) {
        existing.outerHTML = hudHtml;
      } else {
        el.jobGameArea.insertAdjacentHTML('afterbegin', hudHtml);
      }
      const quitBtn = el.jobGameArea.querySelector('#mgQuit');
      if (quitBtn) quitBtn.addEventListener('click', finish);
    }

    function finish() {
      cleanup();
      el.jobGameArea.style.display = "none";
      el.jobList.style.display = "";
      render();
    }

    function checkEnd() {
      if (fails >= 3) { finish(); return true; }
      if (!game.jobCanWork(job.key)) { finish(); return true; }
      return false;
    }

    function nextRound() {
      cleanup();
      if (checkEnd()) return;
      round += 1;

      function onResult(success) {
        if (success) { combo += 1; fails = 0; }
        else { combo = 0; fails += 1; }
        const res = game.doJobAction(job.key, combo, success);
        totalCash += res.pay;
        totalXp += res.xp;
        if (res.staminaDepleted || fails >= 3) { finish(); return; }
        updateHud(success);
        minigameTimer = setTimeout(nextRound, 400);
      }

      if (job.minigame === "matchtap") {
        const targetDoor = Math.floor(Math.random() * 3) + 1;
        el.jobGameArea.innerHTML = `
          <div class="mg-header">${job.name} · Action ${round}</div>
          <div class="mg-prompt">Deliver to Door <b class="gold">#${targetDoor}</b>!</div>
          <div class="mg-grid doors">
            <button class="mg-target" data-door="1">#1</button>
            <button class="mg-target" data-door="2">#2</button>
            <button class="mg-target" data-door="3">#3</button>
          </div>
        `;
        updateHud();
        let resolved = false;
        el.jobGameArea.querySelectorAll(".mg-target").forEach((b) => {
          b.addEventListener("click", () => {
            if (resolved) return;
            resolved = true;
            const chosen = Number(b.getAttribute("data-door"));
            if (chosen === targetDoor) {
              b.classList.add("hit");
            } else {
              b.classList.add("miss");
            }
            onResult(chosen === targetDoor);
          });
        });
        minigameTimer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            onResult(false);
          }
        }, cfg.timePerRound || 2500);
      } else if (job.minigame === "whack") {
        const targetPos = Math.floor(Math.random() * 6);
        el.jobGameArea.innerHTML = `
          <div class="mg-header">${job.name} · Action ${round}</div>
          <div class="mg-prompt">Quick! Tap the dirty dish!</div>
          <div class="mg-grid whack">
            ${[0, 1, 2, 3, 4, 5].map((i) => `<button class="mg-target ${i === targetPos ? "active-dish" : ""}" data-pos="${i}">${i === targetPos ? "🍽️" : ""}</button>`).join("")}
          </div>
        `;
        updateHud();
        let resolved = false;
        el.jobGameArea.querySelectorAll(".mg-target").forEach((b) => {
          b.addEventListener("click", () => {
            if (resolved) return;
            resolved = true;
            const pos = Number(b.getAttribute("data-pos"));
            if (pos === targetPos) {
              b.classList.add("hit");
            } else {
              b.classList.add("miss");
            }
            onResult(pos === targetPos);
          });
        });
        minigameTimer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            onResult(false);
          }
        }, cfg.timePerRound || 2000);
      } else {
        const items = ["A", "B", "C", "D"];
        const target = items[Math.floor(Math.random() * items.length)];
        el.jobGameArea.innerHTML = `
          <div class="mg-header">${job.name} · Action ${round}</div>
          <div class="mg-prompt">Sort Box <b class="gold">[${target}]</b> into Bin:</div>
          <div class="mg-grid bins">
            ${items.map((it) => `<button class="mg-target" data-it="${it}">Bin ${it}</button>`).join("")}
          </div>
        `;
        updateHud();
        let resolved = false;
        el.jobGameArea.querySelectorAll(".mg-target").forEach((b) => {
          b.addEventListener("click", () => {
            if (resolved) return;
            resolved = true;
            const chosen = b.getAttribute("data-it");
            if (chosen === target) {
              b.classList.add("hit");
            } else {
              b.classList.add("miss");
            }
            onResult(chosen === target);
          });
        });
        minigameTimer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            onResult(false);
          }
        }, cfg.timePerRound || 3000);
      }
    }

    nextRound();
  }

  // ------------------------------------------------------------ Arena Hub UI --
  function openArena() {
    el.arenaOverlay.classList.add("show");
  }

  // ------------------------------------------------------------ Chained Roamers UI --
  let currentChain = null; // { key, step }

  function promptChain(key, nextStep) {
    currentChain = { key, step: nextStep };
    el.chainPrompt.textContent = `Bout ${nextStep - 1} won! Face opponent #${nextStep} with +30% higher stakes, or cash out now?`;
    el.chainOverlay.classList.add("show");
  }

  el.btnChainNext.addEventListener("click", () => {
    el.chainOverlay.classList.remove("show");
    if (!currentChain) return;
    const view = game.beginRoamerFight(currentChain.key, currentChain.step);
    if (view) openCombat(view);
    else render();
  });

  el.btnChainCashout.addEventListener("click", () => {
    el.chainOverlay.classList.remove("show");
    currentChain = null;
    game.logMsg("You cashed out and left the street gauntlet with your winnings.", "fight");
    render();
  });

  el.btnJobs.addEventListener("click", openJobs);
  el.btnJobsClose.addEventListener("click", () => {
    if (minigameTimer) { clearTimeout(minigameTimer); minigameTimer = null; }
    el.jobsOverlay.classList.remove("show");
  });

  el.btnArenaClose.addEventListener("click", () => el.arenaOverlay.classList.remove("show"));
  el.btnArenaLadder.addEventListener("click", () => {
    el.arenaOverlay.classList.remove("show");
    el.rivalOverlay.classList.add("show");
  });
  el.btnArenaTourney.addEventListener("click", () => {
    el.arenaOverlay.classList.remove("show");
    const view = game.beginTourneyFight(1);
    if (view) openCombat(view);
    else render();
  });
  el.btnArenaGu.addEventListener("click", () => {
    el.arenaOverlay.classList.remove("show");
    const view = game.beginGuFight(1);
    if (view) openCombat(view);
    else render();
  });

  // ------------------------------------------------------------ store overlay --
  let storeType = "cstore";
  let storeTab = "food";
  const STORE_TABS = ["food", "rawfood", "drinks", "clinic", "gear"];
  const STORE_TYPE_TABS = { cstore: ["food", "rawfood", "drinks"], clinic: ["clinic"], gym: ["training", "gear"] };

  function renderStoreTabs() {
    if (!el.storeTabs) return;
    el.storeTabs.innerHTML = "";
    const tabs = STORE_TYPE_TABS[storeType] || STORE_TABS;
    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.className = "store-tab" + (storeTab === tab ? " active" : "");
      btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
      btn.addEventListener("click", () => {
        storeTab = tab;
        renderStore();
      });
      el.storeTabs.appendChild(btn);
    }
  }

  function getStoreItems() {
    if (storeType === "clinic") {
      return CLINIC_ITEMS.filter((i) => i.cat === storeTab || storeTab === "clinic");
    }
    if (storeType === "gym" && storeTab === "training") {
      const money = num(state.Money);
      return GYM_TRAINING.filter((t) => !t.home).map((t) => {
        const owned = game.hasTraining(t.key);
        const consumable = t.unlock === "consumable";
        const stock = consumable ? (state.Consumables[t.key] || 0) : 0;
        const locked = t.requires && !state.OwnedItems.includes(t.requires);
        return {
          key: t.key, name: t.name, desc: locked ? `Needs ${t.requiresName}` : (consumable ? `Stock: ${stock}` : (owned ? "Owned" : "")),
          price: t.cost, cat: "training",
          _isGymTraining: true, _owned: owned, _consumable: consumable, _stock: stock, _locked: locked,
        };
      });
    }
    if (storeTab === "gear") {
      const owned = Array.isArray(state.OwnedEquipment) ? state.OwnedEquipment : [];
      const equipped = state.Equipment || {};
      const gearItems = EQUIPMENT.map((e) => ({
        key: e.key, name: e.name, desc: e.desc, price: e.cost, cat: e.cat,
        _isEquip: true, _owned: owned.includes(e.key),
        _equipped: equipped[e.slot] === e.key, _slot: e.slot,
      }));
      const matItems = CSTORE_ITEMS.filter((i) => i.permanent && !i.notSold);
      return [...gearItems, ...matItems];
    }
    return CSTORE_ITEMS.filter((i) => {
      if (i.notSold) return false;
      if (i.permanent) return false;
      return i.cat === storeTab;
    });
  }

  function renderStore() {
    renderStoreTabs();
    const items = getStoreItems();
    el.storeName.textContent = storeType === "gym" ? "City Gym" : (storeTab === "clinic" ? "Clinic" : "Convenience Store");
    el.storeCash.textContent = fmtCash(state.Money);
    if (storeTab === "clinic") {
      el.storeNotice.style.display = "";
      el.storeNotice.textContent = "No training programs here. · No style taught here.";
    } else {
      el.storeNotice.style.display = "none";
      el.storeNotice.textContent = "";
    }
    el.storeList.innerHTML = "";
    for (const item of items) {
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
      if (item._isGymTraining) {
        if (item._owned && !item._consumable) {
          btn.textContent = "Owned";
          btn.classList.add("owned");
        } else if (item._locked) {
          btn.textContent = `Needs item`;
          btn.classList.add("cantafford");
        } else {
          btn.textContent = fmtCash(item.price);
          if (num(state.Money) < item.price) btn.classList.add("cantafford");
          btn.addEventListener("click", () => {
            game.buyTraining(item.key);
            renderStore();
            render();
          });
        }
      } else if (item._isEquip) {
        if (item._owned) {
          btn.textContent = item._equipped ? "UNEQUIP" : "EQUIP";
          btn.className += item._equipped ? " owned" : "";
          btn.addEventListener("click", () => {
            if (item._equipped) game.unequipItem(item.key);
            else game.equipItem(item.key);
            renderStore();
            renderEquipmentPanel();
            render();
          });
        } else {
          btn.textContent = `${fmtCash(item.price)}`;
          btn.addEventListener("click", () => {
            game.buyEquipment(item.key);
            renderStore();
            renderEquipmentPanel();
            render();
          });
        }
      } else {
        btn.textContent = `${fmtCash(item.price)}`;
        btn.addEventListener("click", () => {
          game.buyItem(item.key);
          renderStore();
          render();
        });
      }
      const money = num(state.Money);
      if (!item._isEquip && money < item.price) btn.classList.add("cantafford");
      if (item._isEquip && !item._owned && money < item.price) btn.classList.add("cantafford");
      row.appendChild(main);
      row.appendChild(btn);
      el.storeList.appendChild(row);
    }
  }

  function openStore(type) {
    storeType = type || "cstore";
    storeTab = type === "clinic" ? "clinic" : (type === "gym" ? "training" : "food");
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
    el.optNameInput.value = String(state.Name || "You");
    el.optionsOverlay.classList.add("show");
  }

  // ------------------------------------------------------------ custom build editor --
  function renderBuildPreview() {
    const allCbs = Array.from(el.buildSkillList.querySelectorAll("input[type=checkbox]"));
    const checkedCbs = allCbs.filter((cb) => cb.checked);
    if (checkedCbs.length >= CUSTOM_MAX_SKILLS) {
      allCbs.forEach((cb) => { if (!cb.checked) cb.disabled = true; });
    } else {
      allCbs.forEach((cb) => { cb.disabled = false; });
    }
    const counter = `Extra skills: ${Math.min(checkedCbs.length, CUSTOM_MAX_SKILLS)}/${CUSTOM_MAX_SKILLS}`;
    const radio = el.buildBaseList.querySelector("input:checked");
    if (!radio) {
      el.buildPreview.textContent = `${counter} — Pick a base style to preview your build.`;
      return;
    }
    const base = radio.value;
    const checked = checkedCbs.map((cb) => cb.value).slice(0, CUSTOM_MAX_SKILLS);
    const baseStyle = STYLES[base];
    const dmgMult = baseStyle.dmg * (1 - CUSTOM_SKILL_PENALTY * checked.length);
    const moves = checked.length
      ? checked.map((key) => {
          const sk = lookupSkill(key);
          return sk ? `${sk.name} ×${(sk.mult || 1).toFixed(2)}` : key;
        }).join(", ")
      : "base style moves";
    el.buildPreview.textContent = `${counter} — ${styleName(base)} — dmg ×${dmgMult.toFixed(2)} · moves: ${moves}`;
  }

  function openBuildEditor() {
    const build = game.activeBuild();
    const learned = game.learnedStyles();
    const bases = Object.keys(STYLES).filter((id) => learned[id]).sort();

    el.buildBaseList.innerHTML = "";
    for (const id of bases) {
      const label = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "buildbase";
      radio.value = id;
      if (build && build.base === id) radio.checked = true;
      if (!build && id === game.activeStyle()) radio.checked = true;
      const span = document.createElement("span");
      span.textContent = `${styleName(id)} (${Math.round(game.styleKnowledge(id))}%)`;
      label.appendChild(radio);
      label.appendChild(span);
      label.addEventListener("change", renderBuildPreview);
      el.buildBaseList.appendChild(label);
    }

    const knownKeys = game.knownSkillList();
    const byStyle = {};
    for (const key of knownKeys) {
      const pipe = key.indexOf("|");
      if (pipe < 0) continue;
      const stId = key.slice(0, pipe);
      if (!byStyle[stId]) byStyle[stId] = [];
      byStyle[stId].push(key);
    }
    el.buildSkillList.innerHTML = "";
    for (const stId of Object.keys(byStyle).sort()) {
      const group = document.createElement("div");
      group.className = "skillgroup";
      const ghead = document.createElement("div");
      ghead.className = "skillgroup-name";
      ghead.textContent = styleName(stId);
      group.appendChild(ghead);
      for (const key of byStyle[stId]) {
        const sk = lookupSkill(key);
        const label = document.createElement("label");
        label.className = "skillopt";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = key;
        if (build && build.skills.includes(key)) cb.checked = true;
        const span = document.createElement("span");
        span.textContent = sk ? sk.name : key;
        const mult = document.createElement("span");
        mult.className = "smult";
        mult.textContent = sk ? `×${(sk.mult || 1).toFixed(2)}` : "";
        label.appendChild(cb);
        label.appendChild(span);
        label.appendChild(mult);
        label.addEventListener("change", renderBuildPreview);
        group.appendChild(label);
      }
      el.buildSkillList.appendChild(group);
    }

    renderBuildPreview();
    el.buildOverlay.classList.add("show");
  }

  function saveBuildFromEditor() {
    const radio = el.buildBaseList.querySelector("input:checked");
    if (!radio) return;
    const base = radio.value;
    const checked = Array.from(el.buildSkillList.querySelectorAll("input:checked")).map((cb) => cb.value).slice(0, CUSTOM_MAX_SKILLS);
    if (game.saveBuild(base, checked)) {
      state.ActiveStyle = base; // reverting/clearing the build falls back to the base style
      el.buildOverlay.classList.remove("show");
      render();
    } else {
      el.buildPreview.textContent = "Couldn't save \u2014 base style not mastered, or a chosen move isn't learned.";
    }
  }

  el.btnBuild.addEventListener("click", () => openBuildEditor());
  el.btnBuildSave.addEventListener("click", saveBuildFromEditor);
  el.btnBuildClear.addEventListener("click", () => {
    game.clearBuild();
    el.buildOverlay.classList.remove("show");
    render();
  });
  el.btnBuildClose.addEventListener("click", () => el.buildOverlay.classList.remove("show"));
  el.buildOverlay.addEventListener("click", (e) => {
    if (e.target === el.buildOverlay) el.buildOverlay.classList.remove("show");
  });

  // ------------------------------------------------------------ inventory overlay --
  function renderInventory() {
    const inv = game.inventory();
    el.inventoryList.innerHTML = "";
    if (inv.length === 0) {
      el.inventoryEmpty.style.display = "";
      return;
    }
    el.inventoryEmpty.style.display = "none";
    for (const entry of inv) {
      const item = [...CSTORE_ITEMS, ...CLINIC_ITEMS].find((i) => i.key === entry.key);
      if (!item || item.buff) continue;
      const row = document.createElement("div");
      row.className = "invrow";
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
      const qty = document.createElement("span");
      qty.className = "invqty";
      qty.textContent = `×${entry.qty}`;
      row.appendChild(main);
      row.appendChild(qty);
      if (!item.buff) {
        const btn = document.createElement("button");
        btn.className = "btn small-btn";
        btn.textContent = "USE";
        btn.disabled = entry.qty <= 0;
        btn.addEventListener("click", () => {
          game.useItem(entry.key);
          renderInventory();
          render();
        });
        row.appendChild(btn);
      }
      el.inventoryList.appendChild(row);
    }
  }

  function openInventory() {
    renderInventory();
    el.inventoryOverlay.classList.add("show");
  }

  el.btnInventory.addEventListener("click", openInventory);
  el.btnInventoryClose.addEventListener("click", () => el.inventoryOverlay.classList.remove("show"));
  el.inventoryOverlay.addEventListener("click", (e) => {
    if (e.target === el.inventoryOverlay) el.inventoryOverlay.classList.remove("show");
  });

  // ------------------------------------------------------------ tasklist (full editor in right column) --
  let taskAutoInterval = null;

  function renderTasklistFull() {
    const tl = Array.isArray(state.TaskList) ? state.TaskList : [];
    if (!el.taskQueueQuick) return;
    el.taskQueueQuick.innerHTML = "";
    if (tl.length === 0) {
      const empty = document.createElement("div");
      empty.className = "small";
      empty.textContent = "No tasks in queue. Add activities below.";
      el.taskQueueQuick.appendChild(empty);
    } else {
      for (let i = 0; i < tl.length; i++) {
        const item = tl[i];
        const act = ACTIVITIES[item.act];
        const locked = !game.canAddToTask(item.act);
        const row = document.createElement("div");
        row.className = "taskrow" + (locked ? " locked" : "");
        const num = document.createElement("span");
        num.className = "tnum";
        num.textContent = `${i + 1}.`;
        const nm = document.createElement("span");
        nm.className = "tname";
        nm.textContent = act ? act.name : item.act;
        const cnt = document.createElement("span");
        cnt.className = "tcnt";
        cnt.textContent = `×${item.n}`;
        row.appendChild(num);
        row.appendChild(nm);
        row.appendChild(cnt);
        const btnDown = document.createElement("button");
        btnDown.className = "tcount-btn";
        btnDown.textContent = "−";
        btnDown.addEventListener("click", () => {
          if (item.n > 1) item.n--;
          else game.removeTask(i);
          renderTasklistFull();
          render();
        });
        const btnUp = document.createElement("button");
        btnUp.className = "tcount-btn";
        btnUp.textContent = "+";
        btnUp.addEventListener("click", () => {
          if (item.n < 99) item.n++;
          renderTasklistFull();
          render();
        });
        row.appendChild(btnDown);
        row.appendChild(btnUp);
        const rm = document.createElement("button");
        rm.className = "tremove";
        rm.textContent = "×";
        rm.addEventListener("click", () => {
          game.removeTask(i);
          renderTasklistFull();
          render();
        });
        row.appendChild(rm);
        el.taskQueueQuick.appendChild(row);
      }
    }
    const repeatOn = state.TaskRepeat === true;
    el.btnTaskRepeatQuick.textContent = `Repeat: ${repeatOn ? "ON" : "OFF"}`;
    el.btnTaskRepeatQuick.classList.toggle("on", repeatOn);
    // Auto button: reflect whether taskAutoInterval is active.
    if (el.btnTaskAutoQuick) {
      const autoOn = !!taskAutoInterval;
      el.btnTaskAutoQuick.textContent = `Auto: ${autoOn ? "ON" : "OFF"}`;
      el.btnTaskAutoQuick.classList.toggle("on", autoOn);
    }
    if (el.taskActivityListQuick) {
      el.taskActivityListQuick.innerHTML = "";
      for (const key of Object.keys(ACTIVITIES)) {
        const act = ACTIVITIES[key];
        const locked = !game.canAddToTask(key);
        const b = document.createElement("button");
        b.className = "btn small-btn" + (locked ? " locked" : "");
        b.textContent = act.name;
        if (locked) b.title = "Buy this training at the gym first";
        b.addEventListener("click", () => {
          if (game.addTask(key)) {
            renderTasklistFull();
            render();
          }
        });
        el.taskActivityListQuick.appendChild(b);
      }
    }
  }

  function renderTasklistQuick() {
    renderTasklistFull();
  }

  if (el.btnTaskRepeatQuick) {
    el.btnTaskRepeatQuick.addEventListener("click", () => {
      state.TaskRepeat = state.TaskRepeat !== true;
      renderTasklistQuick();
    });
  }
  if (el.btnTaskAdvanceQuick) {
    el.btnTaskAdvanceQuick.addEventListener("click", () => {
      game.advanceDay();
      renderTasklistQuick();
      render();
    });
  }
  if (el.btnTaskPlayQuick) {
    el.btnTaskPlayQuick.addEventListener("click", () => {
      game.doDay();
      renderTasklistQuick();
      render();
    });
  }
  if (el.btnTaskAutoQuick) {
    el.btnTaskAutoQuick.addEventListener("click", () => {
      if (taskAutoInterval) {
        clearInterval(taskAutoInterval);
        taskAutoInterval = null;
        renderTasklistQuick();
      } else {
        const ms = el.taskSpeedQuick ? Number(el.taskSpeedQuick.value) || 500 : 500;
        taskAutoInterval = setInterval(() => {
          const tl = Array.isArray(state.TaskList) ? state.TaskList : [];
          const allDone = tl.length > 0 && tl.every((t) => !t || typeof t !== "object" || t.n <= 0);
          if (state.Health <= 0 || state.InFight || tl.length === 0 || allDone) {
            clearInterval(taskAutoInterval);
            taskAutoInterval = null;
            renderTasklistQuick();
            render();
            return;
          }
          game.doDay();
          renderTasklistQuick();
          render();
        }, ms);
        renderTasklistQuick();
      }
    });
  }
  // D2: speed dropdown restarts interval immediately when AUTO is running
  function restartAutoIfRunning(speedEl) {
    if (!taskAutoInterval || !speedEl) return;
    clearInterval(taskAutoInterval);
    taskAutoInterval = null;
    const ms = Number(speedEl.value) || 500;
    taskAutoInterval = setInterval(() => {
      const tl = Array.isArray(state.TaskList) ? state.TaskList : [];
      const allDone = tl.length > 0 && tl.every((t) => !t || typeof t !== "object" || t.n <= 0);
      if (state.Health <= 0 || state.InFight || tl.length === 0 || allDone) {
        clearInterval(taskAutoInterval);
        taskAutoInterval = null;
        renderTasklistQuick();
        render();
        return;
      }
      game.doDay();
      renderTasklistQuick();
      render();
    }, ms);
  }
  if (el.taskSpeedQuick) {
    el.taskSpeedQuick.addEventListener("change", () => restartAutoIfRunning(el.taskSpeedQuick));
  }

  // ------------------------------------------------------------ update log overlay --
  function renderUpdateLog(highlightVersion) {
    el.updateList.innerHTML = "";
    for (const entry of UPDATE_LOG) {
      const row = document.createElement("div");
      row.className = "updaterow";
      if (entry.v === highlightVersion) row.classList.add("highlight");
      const v = document.createElement("span");
      v.className = "updatev";
      v.textContent = `v${entry.v}`;
      const t = document.createElement("span");
      t.className = "updatetxt";
      t.textContent = entry.text;
      row.appendChild(v);
      row.appendChild(t);
      el.updateList.appendChild(row);
    }
  }

  function openUpdateLog(highlightVersion) {
    if (highlightVersion) {
      el.updateHeader.textContent = `What's new in v${highlightVersion}`;
    } else {
      el.updateHeader.textContent = "What's New";
    }
    renderUpdateLog(highlightVersion);
    el.updateOverlay.classList.add("show");
  }

  el.btnUpdateLog.addEventListener("click", () => openUpdateLog());
  el.btnUpdateClose.addEventListener("click", () => el.updateOverlay.classList.remove("show"));
  el.updateOverlay.addEventListener("click", (e) => {
    if (e.target === el.updateOverlay) el.updateOverlay.classList.remove("show");
  });

  // ------------------------------------------------------------ statistics overlay --
  function renderStats(tab) {
    if (!el.statsBody) return;
    const t = tab || "effects";
    let html = "";
    if (t === "effects") {
      html = `<h3 class="stat-h">Status Effects</h3>`;
      for (const k of Object.keys(STATUS_EFFECT_INFO)) {
        const e = STATUS_EFFECT_INFO[k];
        html += `<div class="statrow"><b>${e.name}</b><span>${e.desc}</span></div>`;
      }
    } else if (t === "styles") {
      html = `<h3 class="stat-h">Styles by Tier</h3>`;
      const tiers = { 1: "Tier 1 (Basic)", 2: "Tier 2 (Advanced)", 3: "Tier 3 (Elite)" };
      for (const tier of [1, 2, 3]) {
        const list = Object.keys(STYLES).filter((id) => styleTier(id) === tier);
        if (!list.length) continue;
        html += `<div class="stat-t"><b>${tiers[tier]}</b></div>`;
        for (const id of list) {
          const st = STYLES[id];
          const mods = [];
          if (st.dmg > 1) mods.push(`dmg +${Math.round((st.dmg - 1) * 100)}%`);
          if (st.dodge > 0) mods.push(`dodge +${Math.round(st.dodge * 100)}%`);
          if (st.crit > 0) mods.push(`crit +${Math.round(st.crit * 100)}%`);
          html += `<div class="statrow"><b>${st.name}</b><span>${mods.join(", ") || "—"} · Ult: ${st.ult ? st.ult.name : "—"}</span></div>`;
        }
      }
    } else if (t === "attrs") {
      html = `<h3 class="stat-h">Attributes</h3>`;
      for (const a of ATTRIBUTES) {
        html += `<div class="statrow"><b>${a.name}</b><span>${a.desc}</span></div>`;
      }
      html += `<div class="statrow"><b>Speed (movement)</b><span>Higher Speed lets you travel the map faster and is gained while moving.</span></div>`;
    } else if (t === "prog") {
      html = `<h3 class="stat-h">Progression</h3>`;
      html += `<div class="statrow"><b>Fights</b><span>Win by KO'ing an opponent's HP or draining their stamina. No round cap.</span></div>`;
      html += `<div class="statrow"><b>Training</b><span>Buy stat trainings at the City Gym, then queue them in your Task List.</span></div>`;
      html += `<div class="statrow"><b>Rivals</b><span>Each gym has a roster of fighters — beat all 5 to unlock the next tier of locations.</span></div>`;
      html += `<div class="statrow"><b>Jobs</b><span>Manual play: build a 25 combo for 100% pay, or set an auto-job that works every 10s.</span></div>`;
    }
    el.statsBody.innerHTML = html;
  }

  function openStats() {
    const tabs = el.statsOverlay.querySelectorAll(".stats-tabs .store-tab");
    const active = el.statsOverlay.querySelector(".stats-tabs .store-tab.active");
    renderStats(active ? active.getAttribute("data-stab") : "effects");
    if (tabs.length) {
      tabs.forEach((tb) => {
        tb.onclick = () => {
          tabs.forEach((x) => x.classList.remove("active"));
          tb.classList.add("active");
          renderStats(tb.getAttribute("data-stab"));
        };
      });
    }
    el.statsOverlay.classList.add("show");
  }

  el.btnStats.addEventListener("click", openStats);
  el.btnStatsClose.addEventListener("click", () => el.statsOverlay.classList.remove("show"));
  el.statsOverlay.addEventListener("click", (e) => {
    if (e.target === el.statsOverlay) el.statsOverlay.classList.remove("show");
  });

  // ------------------------------------------------------------ result overlay --
  function learnStyleFromMsg(msg) {
    const m = /You learned ([^!]+)!/.exec(String(msg ?? ""));
    return m ? m[1] : "";
  }

  function showResult(win, body) {
    el.resultTitle.textContent = win ? "Victory" : "Defeat";
    el.resultBody.textContent = body || String(state.LastMsg ?? "");
    const learned = learnStyleFromMsg(String(state.LastMsg ?? ""));
    el.resultLearn.textContent = learned ? `NEW STYLE LEARNED: ${learned}` : "";
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
      if (defenderIsYou && ev.knowledgeGain && ev.knowledgeStyle) {
        spawnFloater(el.youHitbox, "knowfloat", `+${ev.knowledgeGain}% ${ev.knowledgeStyle}`, 1000);
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
    el.youName.textContent = view.playerName || state.Name || "You";
    el.youHitbox.querySelector(".fhb").textContent = String(el.youName.textContent || "Y").charAt(0).toUpperCase();
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
    const meta = combatMeta;
    activeView = null;
    combatMeta = null;
    stopAuto();
    el.combatOverlay.classList.remove("show");
    render();
    if (meta && meta.mode === "roamer" && view.win) {
      const curStep = view.chainStep || 1;
      const roamerKey = view.roamerKey || "r_thug";
      promptChain(roamerKey, curStep + 1);
    } else if (meta && meta.mode === "tourney" && view.win && (view.tourneyRound || 1) < 3) {
      const nextR = (view.tourneyRound || 1) + 1;
      game.logMsg(`Tournament round ${nextR - 1} won! Advancing to Round ${nextR}...`, "fight");
      setTimeout(() => {
        const nextV = game.beginTourneyFight(nextR);
        if (nextV) openCombat(nextV);
      }, 500);
    } else if (meta && meta.mode === "gu" && view.win && (view.guWave || 1) < 5) {
      const nextW = (view.guWave || 1) + 1;
      game.logMsg(`Gu Ritual Wave ${nextW - 1} eliminated! Next wave approaches...`, "fight");
      setTimeout(() => {
        const nextV = game.beginGuFight(nextW);
        if (nextV) openCombat(nextV);
      }, 500);
    } else {
      showResult(view.win, String(state.LastMsg ?? ""));
    }
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
    // Show escape button only for escapable fights
    const escapable = view.mode === "encounter" || view.mode === "roamer";
    el.btnEscape.style.display = escapable ? "" : "none";
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

  if (el.btnQuickFight) {
    el.btnQuickFight.addEventListener("click", () => {
      pauseAutoRun();
      const view = game.beginFight();
      if (view) openCombat(view);
      else render();
    });
  }

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

  // ---- save / load ----
  function openSaveOverlay() {
    el.saveCodeTextarea.value = game.exportSave();
    el.saveImportStatus.textContent = "";
    el.loadCodeTextarea.value = "";
    el.saveOverlay.classList.add("show");
  }

  el.btnSave.addEventListener("click", () => {
    // SAVE button: force a save now
    onSave();
    // brief flash feedback
    const orig = el.btnSave.textContent;
    el.btnSave.textContent = "SAVED!";
    setTimeout(() => { el.btnSave.textContent = orig; }, 900);
  });

  el.btnSaveClose.addEventListener("click", () => el.saveOverlay.classList.remove("show"));
  el.saveOverlay.addEventListener("click", (e) => {
    if (e.target === el.saveOverlay) el.saveOverlay.classList.remove("show");
  });

  el.btnSaveCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(el.saveCodeTextarea.value);
      el.saveImportStatus.textContent = "Copied to clipboard.";
    } catch (e) {
      el.saveImportStatus.textContent = "Copy failed — select and copy manually.";
    }
  });

  el.btnSaveDownload.addEventListener("click", () => {
    const blob = new Blob([el.saveCodeTextarea.value], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gauntlet-save.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  el.btnSaveImport.addEventListener("click", () => {
    const ok = game.importSave(el.loadCodeTextarea.value);
    el.saveImportStatus.textContent = ok ? "Save restored!" : "Invalid code — check it starts with GAUNTLET:";
    if (ok) {
      el.saveOverlay.classList.remove("show");
      render();
    }
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
    game.logMsg("You enter Bobsled City at 18, looking to become the strongest.");
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

  el.btnEscape.addEventListener("click", () => {
    if (!activeView) return;
    stopAuto();
    const res = game.tryEscape();
    if (res.escaped) {
      activeView = null;
      combatMeta = null;
      el.combatOverlay.classList.remove("show");
      render();
    } else {
      renderCombat(activeView);
    }
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

  // store (opened by clicking the Convenience Store / Clinic map buildings)
  el.btnStoreClose.addEventListener("click", () => el.storeOverlay.classList.remove("show"));
  el.storeOverlay.addEventListener("click", (e) => {
    if (e.target === el.storeOverlay) el.storeOverlay.classList.remove("show");
  });

  // rival overlay
  if (el.btnRival) el.btnRival.addEventListener("click", () => {
    if (el.rivalOverlay.classList.contains("show")) el.rivalOverlay.classList.remove("show");
    else { el.locOverlay.classList.remove("show"); renderRival(); el.rivalOverlay.classList.add("show"); }
  });
  el.btnRivalClose.addEventListener("click", () => el.rivalOverlay.classList.remove("show"));
  el.rivalOverlay.addEventListener("click", (e) => {
    if (e.target === el.rivalOverlay) el.rivalOverlay.classList.remove("show");
  });

  // location overlay
  el.btnLocClose.addEventListener("click", () => el.locOverlay.classList.remove("show"));
  el.locOverlay.addEventListener("click", (e) => {
    if (e.target === el.locOverlay) el.locOverlay.classList.remove("show");
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
  if (el.btnOptSaveLoad) {
    el.btnOptSaveLoad.addEventListener("click", () => {
      el.optionsOverlay.classList.remove("show");
      openSaveOverlay();
    });
  }
  el.btnOptionsClose.addEventListener("click", () => el.optionsOverlay.classList.remove("show"));
  el.optionsOverlay.addEventListener("click", (e) => {
    if (e.target === el.optionsOverlay) el.optionsOverlay.classList.remove("show");
  });
  el.btnThemeDark.addEventListener("click", () => applyTheme("dark"));
  el.btnThemeLight.addEventListener("click", () => applyTheme("light"));

  // options: name
  el.btnOptNameSave.addEventListener("click", () => {
    game.setName(el.optNameInput.value);
    el.optNameInput.value = String(state.Name || "You");
    render();
  });

  // name prompt (first launch)
  function submitName() {
    const raw = el.nameInput.value.trim();
    game.setName(raw || "Rookie");
    el.nameOverlay.classList.remove("show");
    render();
  }
  el.btnNameBegin.addEventListener("click", submitName);
  el.nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitName();
  });

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

  // short blip on any button-like click (hub + combat + ghosts + map)
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btnSound, #btnOptSound")) return;
    if (e.target.closest(".btn, .movebtn, .ghostrow, .bldg, .roamer")) {
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

  // First launch: prompt for a name before play can begin.
  if (firstLaunch) {
    el.nameInput.value = "";
    el.nameOverlay.classList.add("show");
    setTimeout(() => el.nameInput.focus(), 0);
  }

  // roamer countdown refresh while the map is up
  setInterval(renderRoamers, 1000);

  return { render, signalArrival };
}
