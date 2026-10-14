/** 情绪下锅 · 主入口：零思考交互 + 恶搞转移注意力 */

import {
  createObject,
  getObject,
  listActive,
  listArchive,
  counts,
  applyHeatDelta,
  addAction,
  markCookingVisit,
  startCooldown,
  finishCooking,
  setFeedback,
  manualForgive,
  reopenForCooking,
  monthlyArchiveCount,
  track,
  tickCooldowns,
} from "./store.js";
import {
  heatBand,
  clampHeat,
  formatRemain,
  formatClock,
  releaseLine,
  cookSessions,
  formatDate,
  remainingMs,
  coolingHeat,
} from "./heat.js";
import {
  INGREDIENT_ITEMS,
  HOME_CHIPS,
  PLACEHOLDERS,
  pick,
  formFun,
  dishTitle,
  dishReview,
  lineFor,
  maybeEvent,
  EVENTS,
  comboTitle,
  starsFor,
  STAR_LINES,
  STIR_ONE_LINES,
  CHAOS_LINES,
} from "./gags.js";
import * as sfx from "./sfx.js";
import {
  CHARS,
  ITEM_ART,
  ART_LOGO_POT,
  ART_POT,
  ART_FLAMES,
  ART_BUBBLES,
  ART_STEAM_CURLS,
  ART_EMPTY_POT,
  ART_EMPTY_STARS,
  ART_POKE,
  ART_CHAOS,
  ART_STEAM,
  ART_PLATE,
  ART_SOUND_ON,
  ART_SOUND_OFF,
  ART_BACK,
  ART_FIRE,
  ART_POT_SMALL,
  ACC_BY_HEAT,
  starsHtml,
} from "./art.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const app = $("#app");
const pages = {
  home: $("#page-home"),
  cook: $("#page-cook"),
  pot: $("#page-pot"),
  archive: $("#page-archive"),
};
const bottomNav = $("#bottom-nav");
const modalRoot = $("#modal-root");
const toastEl = $("#toast");

let toastTimer = 0;
function toast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), ms);
}

function openModal({ title, body, actions }) {
  $("#modal-title").textContent = title || "";
  const bodyEl = $("#modal-body");
  bodyEl.innerHTML = "";
  if (typeof body === "string") bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);
  const act = $("#modal-actions");
  act.innerHTML = "";
  (actions || []).forEach((a, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn ${a.kind === "primary" ? "btn-dump" : a.kind === "danger" ? "btn-danger" : "btn-ghost"}`;
    btn.textContent = a.label;
    btn.addEventListener("click", () => {
      closeModal();
      a.onClick?.();
    });
    act.appendChild(btn);
    if (i === 0) btn.dataset.primary = "1";
  });
  modalRoot.classList.remove("hidden");
  (act.querySelector("[data-primary]") || act.querySelector("button"))?.focus();
}

function closeModal() {
  modalRoot.classList.add("hidden");
}
$("#modal-backdrop")?.addEventListener("click", closeModal);

// ---------- 吐槽气泡 ----------
let speechTimer = 0;
function say(text, ms = 2400) {
  const el = $("#speech");
  const t = $("#speech-text");
  if (!el || !t) return;
  t.textContent = text;
  el.classList.remove("hidden", "pop");
  void el.offsetWidth;
  el.classList.add("pop");
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => el.classList.add("hidden"), ms);
}

// ---------- Placeholder / chips ----------
let phIdx = 0;
function rotatePlaceholder() {
  const input = $("#emotion-input");
  if (document.activeElement === input && input.value) return;
  phIdx = (phIdx + 1) % PLACEHOLDERS.length;
  input.placeholder = PLACEHOLDERS[phIdx];
}
setInterval(rotatePlaceholder, 3200);

function renderChips() {
  const row = $("#chip-row");
  if (!row) return;
  row.innerHTML = "";
  HOME_CHIPS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = c;
    b.addEventListener("click", () => {
      input.value = c;
      syncDumpBtn();
      // 点 chip 直接开锅——零思考
      dump();
    });
    row.appendChild(b);
  });
}

// ---------- Router ----------
function parseRoute() {
  const h = location.hash.replace(/^#/, "") || "/";
  const cook = h.match(/^\/cook\/([^/]+)/);
  if (cook) return { name: "cook", id: decodeURIComponent(cook[1]), reentered: true };
  if (h.startsWith("/pot")) return { name: "pot" };
  if (h.startsWith("/archive")) return { name: "archive" };
  return { name: "home" };
}

function showPage(name) {
  app.dataset.route = name;
  Object.entries(pages).forEach(([k, el]) => {
    el.classList.toggle("hidden", k !== name);
  });
  const showNav = name === "pot" || name === "archive";
  bottomNav.classList.toggle("hidden", !showNav);
  $$("a", bottomNav).forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
  if (name !== "cook") cookController.stop();
}

function refreshCounts() {
  const c = counts();
  $("#count-pot").textContent = String(c.pot);
  $("#count-archive").textContent = String(c.archive);
}

function route() {
  const r = parseRoute();
  showPage(r.name);
  refreshCounts();

  if (r.name === "home") {
    renderHome();
  } else if (r.name === "cook") {
    const obj = getObject(r.id);
    if (!obj || obj.status === "forgiven" || obj.status === "archived") {
      toast("这锅不在灶上了");
      location.hash = "#/pot";
      return;
    }
    markCookingVisit(r.id);
    // 刚扔进锅 = 首次；否则算又来
    const fresh = freshCookIds.has(r.id);
    freshCookIds.delete(r.id);
    cookController.start(obj.id, { reentered: !fresh && (obj.cookCount > 1 || !!obj.cooldownStartAt || !!obj.dishName) });
  } else if (r.name === "pot") {
    renderPotList();
  } else if (r.name === "archive") {
    renderArchive();
  }
}
window.addEventListener("hashchange", route);

function renderHome() {
  refreshCounts();
}

// ---------- Home dump ----------
const input = $("#emotion-input");
const dumpBtn = $("#btn-dump");

function syncDumpBtn() {
  dumpBtn.disabled = input.value.trim().length === 0;
}
input.addEventListener("input", syncDumpBtn);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !dumpBtn.disabled) dump();
});
dumpBtn.addEventListener("click", dump);

async function dump() {
  const name = input.value.trim();
  if (!name) return;
  dumpBtn.disabled = true;
  sfx.play("dump");
  const obj = createObject(name);
  freshCookIds.add(obj.id);
  await playDropAnimation(name);
  input.value = "";
  syncDumpBtn();
  location.hash = `#/cook/${obj.id}`;
}

const freshCookIds = new Set();

function playDropAnimation(name) {
  return new Promise((resolve) => {
    const overlay = $("#drop-overlay");
    const token = $("#drop-token");
    token.textContent = name.length > 14 ? name.slice(0, 14) + "…" : name;
    overlay.classList.remove("hidden");
    overlay.classList.add("drop-run");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("drop-run");
      resolve();
    }, 950);
  });
}

// ---------- Cook ----------
const cook = {
  id: null,
  heat: 0,
  form: "",
  chaosOn: false,
  chaosAccum: 0,
  steamEndsAt: 0,
  steaming: false,
  actionCount: 0,
  triggeredEvents: [],
  combo: 0,
  lastComboAt: 0,
  raf: 0,
  lastT: 0,
  finishing: false,
};

function countActions() {
  const o = getObject(cook.id);
  return o?.history?.length || 0;
}

function bumpCombo() {
  cook.combo += 1;
  cook.lastComboAt = Date.now();
  const bar = $("#combo-bar");
  if (!bar) return;
  const ct = comboTitle(cook.combo);
  bar.classList.remove("hidden", "pulse");
  void bar.offsetWidth;
  bar.classList.add("pulse");
  $("#combo-count").textContent = String(cook.combo);
  $("#combo-title").textContent = ct ? `${ct.title} · ${ct.line}` : "连招继续";
}

function tickComboDecay() {
  if (cook.combo > 0 && Date.now() - cook.lastComboAt > 2800) {
    cook.combo = 0;
    $("#combo-bar")?.classList.add("hidden");
  }
}
setInterval(tickComboDecay, 500);

function bumpAction(type, value = 1, quipKind = null, forceSay = false) {
  if (!cook.id) return;
  addAction(cook.id, { type, value });
  cook.actionCount = countActions();
  bumpCombo();
  const ev = maybeEvent(cook.actionCount, cook.triggeredEvents);
  if (ev) {
    cook.triggeredEvents.push(ev.id);
    showEvent(ev);
    sfx.play("done");
    return;
  }
  if (quipKind && (forceSay || Math.random() < 0.55)) {
    say(lineFor(quipKind), 2000);
  }
}

function showEvent(ev) {
  const el = $("#event-toast");
  $("#event-title").textContent = `🎲 ${ev.title}`;
  $("#event-body").textContent = ev.body;
  el.classList.remove("hidden");
  say(pick(["等等，锅里在演什么？！", "……行吧，这很合理。", "我先笑一会儿。"]), 1600);
  const o = getObject(cook.id);
  if (o) {
    applyHeatDelta(cook.id, 12);
    cook.heat = getObject(cook.id)?.heat ?? cook.heat;
    paintHeatOnly();
  }
  spawnBurst(["✨", "🎉", "💥", "🤡"]);
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add("hidden"), 5000);
}

function paintHeatOnly() {
  const h = cook.heat;
  $("#heat-display").textContent = String(Math.floor(h));
  $("#heat-bar").style.width = `${Math.min(100, (h / 120) * 100)}%`;

  // 锅气文案更口语
  const status =
    h < 20 ? "锅气：淡定"
    : h < 40 ? "锅气：有点意思"
    : h < 60 ? "锅气：热闹了"
    : h < 80 ? "锅气：在跳迪"
    : h < 100 ? "锅气：快压不住"
    : "锅气：彻底放飞";
  $("#heat-status").textContent = status;

  const fun = formFun(h);
  $("#form-nick").textContent = fun.nick;
  const band = heatBand(h);
  const scene = $("#pot-scene");
  scene.className = `pot-scene heat-${band}${cook.steaming ? " steaming" : ""}${cook.chaosOn ? " braise-on" : ""}`;

  const formEl = $("#object-form");
  const nextArt = CHARS[fun.art] || CHARS.chef;
  const acc = ACC_BY_HEAT(h);
  const html = nextArt + (acc ? acc : "");
  if (formEl.dataset.form !== fun.art + (acc ? "+acc" : "")) {
    formEl.dataset.form = fun.art + (acc ? "+acc" : "");
    formEl.innerHTML = html;
    formEl.classList.remove("morph");
    void formEl.offsetWidth;
    formEl.classList.add("morph");
    say(fun.line, 2400);
    spawnBurst(["✨", "🎉", "💥", "😵‍💫"]);
  }
  $("#flame-wrap").style.opacity = String(0.3 + Math.min(0.7, h / 100));
}

function paintCook() {
  paintHeatOnly();
  const obj = getObject(cook.id);
  if (obj) $("#cook-name").textContent = obj.name;
}

function spawnParticle(emoji) {
  const layer = $("#fx-layer");
  const el = document.createElement("div");
  el.className = "fx-particle";
  el.textContent = emoji;
  el.style.left = `${28 + Math.random() * 44}%`;
  el.style.top = `${18 + Math.random() * 32}%`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 750);
}

function floatNum(text, tone = "warm") {
  const layer = $("#fx-layer");
  const el = document.createElement("div");
  el.className = `fx-num ${tone}`;
  el.textContent = text;
  el.style.left = `${42 + Math.random() * 16}%`;
  el.style.top = `${36 + Math.random() * 12}%`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function shakePot() {
  const scene = $("#pot-scene");
  scene.classList.remove("hit");
  void scene.offsetWidth;
  scene.classList.add("hit");
}

function spawnBurst(list) {
  list.forEach((e, i) => setTimeout(() => spawnParticle(e), i * 70));
}

function bumpSoup() {
  const pot = $("#pot-art") || $("#pot-scene");
  if (!pot) return;
  pot.classList.remove("bump");
  void pot.offsetWidth;
  pot.classList.add("bump");
}

function squishObject() {
  const o = $("#object-form");
  o.classList.remove("squish");
  void o.offsetWidth;
  o.classList.add("squish");
}

const cookController = {
  start(id, { reentered = false } = {}) {
    const obj = getObject(id);
    if (!obj) return;
    cook.id = id;
    cook.heat = obj.heat || 0;
    cook.form = formFun(cook.heat).art;
    cook.chaosOn = false;
    cook.chaosAccum = 0;
    cook.steaming = false;
    cook.finishing = false;
    cook.actionCount = obj.history?.length || 0;
    cook.triggeredEvents = [];
    cook.combo = 0;
    $("#combo-bar")?.classList.add("hidden");
    const acts = cook.actionCount;
    for (const e of EVENTS) {
      if (acts > e.need) cook.triggeredEvents.push(e.id);
    }
    $("#cook-name").textContent = obj.name;
    $("#cook-hint").textContent = reentered ? "又来了？行，锅就在这儿。" : "";
    $("#braise-banner").classList.add("hidden");
    $("#event-toast").classList.add("hidden");
    $("#pot-lid").classList.remove("lid-on");
    $("#pot-scene").classList.remove("steaming", "braise-on");
    paintCook();
    setTimeout(() => {
      if (reentered) say(pick(["又来了？行，锅就在这儿。", "这次打算怎么折腾我？", "欢迎回来，锅没跑。"]), 2400);
      else say(pick(["来了？先说好，不许真人出镜。", "有话好好说，锅已经准备好了。", "来吧，看谁先把谁逗笑。"]), 2600);
    }, 280);
    this.loop();
  },
  stop() {
    cancelAnimationFrame(cook.raf);
    cook.raf = 0;
    stopChaos();
    cook.steaming = false;
  },
  loop() {
    cancelAnimationFrame(cook.raf);
    cook.lastT = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.1, (t - cook.lastT) / 1000);
      cook.lastT = t;
      if (app.dataset.route !== "cook" || !cook.id) return;

      let delta = 0;
      if (cook.chaosOn && !cook.steaming && !cook.finishing) {
        delta += 2.2 * dt;
        cook.chaosAccum += dt;
        if (cook.chaosAccum >= 1) {
          const sec = Math.floor(cook.chaosAccum);
          cook.chaosAccum -= sec;
          bumpAction("chaos", sec, "chaos", Math.random() < 0.35);
          floatNum(`+${sec * 2}`, "hot");
          shakePot();
          track("action_braise", { id: cook.id });
        }
      }
      if (cook.steaming) {
        delta -= (2 / 60) * dt;
        const left = cook.steamEndsAt - Date.now();
        $("#braise-time").textContent = formatClock(left);
        if (left <= 0) endSteam(true);
      }

      if (Math.abs(delta) > 0.0001) {
        const before = cook.heat;
        cook.heat = clampHeat(cook.heat + delta);
        if (cook.heat !== before) {
          applyHeatDelta(cook.id, cook.heat - before, { release: cook.heat > before });
          paintHeatOnly();
        }
      }
      cook.raf = requestAnimationFrame(tick);
    };
    cook.raf = requestAnimationFrame(tick);
  },
};

// --- 戳一戳 ---
function doPoke() {
  if (!cook.id || cook.finishing) return;
  if (cook.steaming) {
    toast("锅盖盖着呢，先掀盖");
    return;
  }
  applyHeatDelta(cook.id, 1);
  cook.heat = getObject(cook.id)?.heat ?? cook.heat + 1;
  bumpAction("poke", 1, "poke", true);
  if (Math.random() < 0.35) say(pick(STIR_ONE_LINES), 1900);
  paintHeatOnly();
  squishObject();
  floatNum("+1");
  shakePot();
  spawnBurst([pick(["👉", "💥", "💢", "✨", "😤", "🫠"])]);
  sfx.play("stir");
}

$("#btn-poke").addEventListener("click", doPoke);

// --- 乱炖（按住） ---
let chaosTimer = 0;
function startChaos() {
  if (!cook.id || cook.steaming || cook.finishing || cook.chaosOn) return;
  cook.chaosOn = true;
  cook.chaosAccum = 0;
  $("#btn-chaos").classList.add("active", "pressed");
  $("#pot-scene").classList.add("braise-on");
  sfx.play("braise");
  say(pick(CHAOS_LINES), 1600);
}
function stopChaos() {
  cook.chaosOn = false;
  $("#btn-chaos")?.classList.remove("active", "pressed");
  $("#pot-scene")?.classList.remove("braise-on");
}
const chaosBtn = $("#btn-chaos");
chaosBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  startChaos();
});
["pointerup", "pointerleave", "pointercancel"].forEach((ev) => chaosBtn.addEventListener(ev, stopChaos));
// 键盘也能玩：按空格乱炖
chaosBtn.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    startChaos();
  }
});
chaosBtn.addEventListener("keyup", stopChaos);

// --- 加怪料 ---
function renderIngredients() {
  const row = $("#ing-row");
  if (!row) return;
  row.innerHTML = "";
  INGREDIENT_ITEMS.forEach((ing) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ing-btn";
    b.innerHTML = `
      <span class="ing-art">${ITEM_ART[ing.art] || ""}</span>
      <span class="ing-name">${ing.name}</span>
      <span class="mono ing-heat">+${ing.heat}</span>
    `;
    b.setAttribute("aria-label", `加${ing.name}`);
    b.addEventListener("click", () => {
      if (!cook.id || cook.steaming || cook.finishing) return;
      applyHeatDelta(cook.id, ing.heat);
      cook.heat = getObject(cook.id)?.heat ?? cook.heat;
      bumpAction(ing.id, ing.heat, "ing", true);
      say(ing.quip, 2200);
      paintHeatOnly();
      floatNum(`+${ing.heat}`, "hot");
      shakePot();
      spawnParticle("✨");
      bumpSoup();
      squishObject();
      sfx.play("ing");
    });
    row.appendChild(b);
  });
}

// --- 焖一会儿（一键 1 分钟） ---
function beginSteam(ms = 60_000) {
  cook.steaming = true;
  cook.steamEndsAt = Date.now() + ms;
  stopChaos();
  $("#pot-lid").classList.add("lid-on");
  $("#pot-scene").classList.add("steaming");
  $("#braise-banner").classList.remove("hidden");
  $("#braise-time").textContent = formatClock(ms);
  bumpAction("steam", ms / 1000, "steam", true);
  sfx.play("lid");
}

function endSteam(natural) {
  if (!cook.steaming) return;
  cook.steaming = false;
  $("#pot-lid").classList.remove("lid-on");
  $("#pot-scene").classList.remove("steaming");
  $("#braise-banner").classList.add("hidden");
  if (natural) {
    toast("焖好了，它好像没那么欠了");
    say("呼……世界安静了。", 2000);
    sfx.play("lid");
  }
}

$("#btn-steam").addEventListener("click", () => {
  if (cook.steaming) {
    endSteam(false);
    return;
  }
  if (cook.finishing) return;
  beginSteam(60_000);
});
$("#btn-open-lid").addEventListener("click", () => endSteam(false));

// --- 够了，出锅 ---
$("#btn-finish").addEventListener("click", () => {
  if (!cook.id || cook.finishing) return;
  if (cook.steaming) {
    endSteam(false);
  }
  finishFlow();
});

function finishFlow() {
  cook.finishing = true;
  stopChaos();
  const obj = getObject(cook.id);
  if (!obj) return;
  finishCooking(cook.id);
  sfx.play("done");
  $("#pot-scene").classList.add("quiet");

  const h = Math.floor(cook.heat);
  const title = dishTitle(obj.history?.length || 0, h);
  const review = dishReview();
  const stars = starsFor(obj.history?.length || 0, h);
  const starStr = starsHtml(stars);

  openModal({
    title: "出锅鉴定",
    body: `
      <div class="finish-hero">
        <div class="dish-emoji">${ART_PLATE}</div>
        <div class="dish-name">${title}</div>
        <div class="stars" aria-label="${stars} 星">${starStr}</div>
        <div class="finish-heat mono">锅气 ${h}</div>
        <p class="finish-line">${STAR_LINES[stars] || review}</p>
        <p class="finish-line dim">笑完就够了，不用逼自己立刻原谅。</p>
      </div>
      <p class="modal-p center">现在感觉？（可跳过）</p>
      <div class="feedback-row">
        <button type="button" class="fb-btn" data-fb="angry">😡 还是很气</button>
        <button type="button" class="fb-btn" data-fb="ok">😐 好一点了</button>
        <button type="button" class="fb-btn" data-fb="good">🙂 忍不住笑了</button>
      </div>
    `,
    actions: [
      {
        label: "封存这锅（3 天）",
        kind: "primary",
        onClick: () => {
          const id = cook.id;
          startCooldown(id, 3, {
            dishName: title,
            dishReview: review,
            stars,
          });
          cookController.stop();
          cook.id = null;
          cook.combo = 0;
          $("#combo-bar")?.classList.add("hidden");
          $("#pot-scene").classList.remove("quiet");
          refreshCounts();
          location.hash = "#/pot";
          toast("已封存，锅替你端着");
        },
      },
      {
        label: "再胡闹一会儿",
        onClick: () => {
          cook.finishing = false;
          $("#pot-scene").classList.remove("quiet");
          say("好，那就继续。", 1600);
        },
      },
    ],
  });

  $$(".fb-btn").forEach((b) => {
    b.addEventListener("click", () => {
      $$(".fb-btn").forEach((x) => x.classList.remove("picked"));
      b.classList.add("picked");
      setFeedback(cook.id, b.dataset.fb);
    });
  });
}

// ---------- Pot list ----------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPotList() {
  refreshCounts();
  const list = $("#pot-list");
  const empty = $("#pot-empty");
  const objs = listActive();
  list.innerHTML = "";
  if (!objs.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  objs.forEach((o) => {
    const heat = o.status === "cooling" ? coolingHeat(o) : o.heat;
    const fun = formFun(heat);
    const near = o.status === "cooling" && remainingMs(o) < 3600_000;
    const card = document.createElement("article");
    card.className = `pot-card band-${heatBand(heat)}${near ? " near" : ""}`;
    card.innerHTML = `
      <div class="pot-card-form">${CHARS[formFun(heat).art] || CHARS.chef}</div>
      <div class="pot-card-body">
        <h3 class="pot-card-name">${escapeHtml(o.name)}</h3>
        <div class="pot-card-meta">
          <span>锅气 ${Math.floor(heat)} · ${fun.nick}</span>
          <span>${o.status === "cooking" ? "● 还在锅里蹦迪" : `还剩 ${formatRemain(remainingMs(o))}`}</span>
        </div>
        ${near ? `<p class="pot-card-note">好像已经没那么烫了。</p>` : ""}
        <div class="pot-card-actions">
          <button type="button" class="btn btn-dump btn-sm" data-act="cook">接着闹</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="release">算了，放了吧</button>
        </div>
      </div>
    `;
    card.querySelector('[data-act="cook"]').addEventListener("click", () => {
      reopenForCooking(o.id);
      freshCookIds.delete(o.id);
      location.hash = `#/cook/${o.id}`;
    });
    card.querySelector('[data-act="release"]').addEventListener("click", () => confirmRelease(o));
    list.appendChild(card);
  });
}

function confirmRelease(o) {
  openModal({
    title: "真放它出锅？",
    body: `<p class="modal-p">有些事不用等到完全不气，先放了也行。</p><p class="modal-p dim center">「${escapeHtml(o.name)}」</p>`,
    actions: [
      { label: "再关一会儿", kind: "primary" },
      {
        label: "放了",
        kind: "danger",
        onClick: () => {
          manualForgive(o.id);
          sfx.play("serve");
          refreshCounts();
          if (parseRoute().name === "pot") renderPotList();
          toast("出锅了。它自由了，锅也是。");
        },
      },
    ],
  });
}

// ---------- Archive ----------
function renderArchive() {
  refreshCounts();
  const objs = listArchive();
  $("#stat-month").textContent = String(monthlyArchiveCount());
  $("#stat-total").textContent = String(objs.length);
  const list = $("#archive-list");
  const empty = $("#archive-empty");
  list.innerHTML = "";
  if (!objs.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  objs.forEach((o) => {
    const card = document.createElement("article");
    card.className = "archive-card";
    const cookN = cookSessions(o);
    const cd = o.cooldownDays || 3;
    const dish = o.dishName || "未命名奇珍";
    const st = o.stars || 0;
    const starStr = starsHtml(st);
    card.innerHTML = `
      <div class="archive-form">${ART_PLATE}</div>
      <div>
        <h3 class="pot-card-name">${escapeHtml(o.name)}</h3>
        <p class="archive-dish">${escapeHtml(dish)}</p>
        <div class="archive-stars" aria-label="${st} 星">${starStr}</div>
        <p class="archive-meta">料理 ${cookN} 次 · 冷却 ${cd} 天 · 出锅 ${formatDate(o.releasedAt || o.updatedAt)}</p>
        <p class="archive-rel">${escapeHtml(releaseLine(o))}</p>
        <button type="button" class="btn btn-ghost btn-sm" data-act="again">再来一锅</button>
      </div>
    `;
    card.querySelector('[data-act="again"]').addEventListener("click", () => {
      input.value = o.name;
      syncDumpBtn();
      location.hash = "#/";
      toast("已填入，再丢一次");
    });
    list.appendChild(card);
  });
}

// ---------- sound ----------
function syncSoundButtons() {
  const on = sfx.isSoundOn();
  for (const id of ["#btn-sound-home", "#btn-sound-cook"]) {
    const el = $(id);
    if (!el) continue;
    el.innerHTML = on ? ART_SOUND_ON : ART_SOUND_OFF;
    el.setAttribute("aria-pressed", on ? "true" : "false");
  }
}
for (const id of ["#btn-sound-home", "#btn-sound-cook"]) {
  $(id)?.addEventListener("click", () => {
    sfx.setSoundOn(!sfx.isSoundOn());
    syncSoundButtons();
    if (sfx.isSoundOn()) sfx.play("stir");
    toast(sfx.isSoundOn() ? "音效已打开（很轻）" : "已静音");
  });
}

// ---------- 冷却轮询 ----------
setInterval(() => {
  const newly = tickCooldowns().length;
  if (newly > 0) {
    refreshCounts();
    const r = parseRoute().name;
    if (r === "pot") renderPotList();
    if (r === "archive") renderArchive();
    toast("有东西出锅了 ✨");
    sfx.play("serve");
  } else if (parseRoute().name === "pot") {
    const active = listActive();
    const cards = $$(".pot-card", $("#pot-list"));
    if (cards.length === active.length) {
      active.forEach((o, i) => {
        const meta = cards[i]?.querySelector(".pot-card-meta span:last-child");
        if (meta && o.status === "cooling") {
          meta.textContent = `⏳ 还剩 ${formatRemain(remainingMs(o))}`;
        }
        const formEl = cards[i]?.querySelector(".pot-card-form");
        if (formEl) {
          const heat = o.status === "cooling" ? coolingHeat(o) : o.heat;
          const art = CHARS[formFun(heat).art] || CHARS.chef;
          if (formEl.dataset.art !== formFun(heat).art) {
            formEl.dataset.art = formFun(heat).art;
            formEl.innerHTML = art;
          }
        }
      });
    }
  }
}, 1000);

function boot() {
  sfx.initSound();
  syncSoundButtons();
  // 注入 SVG 图标
  const brand = $("#brand-pot");
  if (brand) brand.innerHTML = ART_LOGO_POT;
  const potArt = $("#pot-art");
  if (potArt) potArt.innerHTML = ART_POT;
  const flameWrap = $("#flame-wrap");
  if (flameWrap) flameWrap.innerHTML = ART_FLAMES;
  const bub = $("#bubbles-layer");
  if (bub) bub.innerHTML = ART_BUBBLES;
  const steamLayer = $("#steams-layer");
  if (steamLayer) steamLayer.innerHTML = ART_STEAM_CURLS;
  const emptyPot = $("#empty-pot-art");
  if (emptyPot) emptyPot.innerHTML = ART_EMPTY_POT;
  const emptyArch = $("#empty-arch-art");
  if (emptyArch) emptyArch.innerHTML = ART_EMPTY_STARS;
  const back = $("#cook-back");
  if (back) back.innerHTML = ART_BACK;
  const heatIco = $("#heat-ico");
  if (heatIco) heatIco.innerHTML = ART_FIRE;
  const icoPoke = $("#ico-poke");
  if (icoPoke) icoPoke.innerHTML = ART_POKE;
  const icoChaos = $("#ico-chaos");
  if (icoChaos) icoChaos.innerHTML = ART_CHAOS;
  const icoSteam = $("#ico-steam");
  if (icoSteam) icoSteam.innerHTML = ART_STEAM;
  const comboFire = $("#combo-fire");
  if (comboFire) comboFire.innerHTML = ART_FIRE;
  const navPot = $("#nav-pot-ico");
  if (navPot) navPot.innerHTML = ART_POT_SMALL;
  const navArch = $("#nav-arch-ico");
  if (navArch) navArch.innerHTML = ART_SOUND_ON.replace(ART_SOUND_ON, ART_FIRE); // placeholder fix below
  if (navArch) navArch.innerHTML = `<svg class="art ico" viewBox="0 0 24 24"><path d="M12 2l2.4 6.8H22l-5.6 4.2 2.2 7L12 16.2 5.4 20l2.2-7L2 8.8h7.6z" fill="#FFC857"/></svg>`;
  const icoDump = $("#ico-dump");
  if (icoDump) icoDump.innerHTML = ART_FIRE;
  renderChips();
  renderIngredients();
  track("app_open");
  syncDumpBtn();
  const done = tickCooldowns();
  if (done.length) {
    setTimeout(() => {
      toast(`✨ ${done.length} 件事出锅了`);
      sfx.play("serve");
    }, 600);
  }
  if (!location.hash) location.hash = "#/";
  route();
}

boot();
