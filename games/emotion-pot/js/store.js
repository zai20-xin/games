/** localStorage 数据层：对象 CRUD、埋点、冷却结算 */

import { coolingHeat, isCooldownDone, clampHeat, formForHeat } from "./heat.js";

const KEY = "emotion-pot:v1";
const EVENTS_KEY = "emotion-pot:events:v1";

function uid() {
  return `ep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadRaw() {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return { objects: [], version: 1 };
    const data = JSON.parse(s);
    if (!data || !Array.isArray(data.objects)) throw new Error("bad shape");
    return data;
  } catch (e) {
    console.error("[emotion-pot] load failed", e);
    return { objects: [], version: 1, corrupt: true };
  }
}

function saveRaw(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getState() {
  return loadRaw();
}

export function track(event, payload = {}) {
  try {
    const list = JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]");
    list.push({ event, t: Date.now(), ...payload });
    // 只保留最近 500 条
    const trimmed = list.slice(-500);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed));
  } catch {
    /* 埋点失败不阻塞 */
  }
}

export function getEvents() {
  try {
    return JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function listActive() {
  tickCooldowns();
  const objs = loadRaw().objects;
  return objs
    .filter((o) => o.status === "cooking" || o.status === "cooling" || o.status === "new")
    .sort((a, b) => {
      // 剩余最短优先；cooking 排最前
      if (a.status === "cooking" && b.status !== "cooking") return -1;
      if (b.status === "cooking" && a.status !== "cooking") return 1;
      const ra = a.cooldownEndAt || Infinity;
      const rb = b.cooldownEndAt || Infinity;
      return ra - rb;
    });
}

export function listArchive() {
  tickCooldowns();
  return loadRaw()
    .objects.filter((o) => o.status === "forgiven" || o.status === "archived")
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function counts() {
  tickCooldowns();
  const objs = loadRaw().objects;
  const pot = objs.filter((o) => o.status === "cooking" || o.status === "cooling" || o.status === "new").length;
  const archive = objs.filter((o) => o.status === "forgiven" || o.status === "archived").length;
  return { pot, archive };
}

export function getObject(id) {
  tickCooldowns();
  return loadRaw().objects.find((o) => o.id === id) || null;
}

export function createObject(name) {
  const data = loadRaw();
  const now = Date.now();
  const obj = {
    id: uid(),
    name: name.slice(0, 40),
    createdAt: now,
    updatedAt: now,
    status: "cooking",
    heat: 0,
    maxHeat: 0,
    releaseScore: 0,
    initialHeat: 0,
    cooldownDays: 3,
    cooldownStartAt: null,
    cooldownEndAt: null,
    form: formForHeat(0).emoji,
    history: [],
    cookCount: 1,
    stirCount: 0,
    feedback: null,
    releasedAt: null,
    forgivenVia: null, // "auto" | "manual"
    dishName: null,
    dishReview: null,
    stars: null,
  };
  data.objects.push(obj);
  saveRaw(data);
  track("object_created", { id: obj.id });
  track("app_open"); // 首次创建也记一次打开意图（app_open 另在启动时记）
  return obj;
}

function mutObject(id, fn) {
  const data = loadRaw();
  const obj = data.objects.find((o) => o.id === id);
  if (!obj) return null;
  fn(obj);
  obj.updatedAt = Date.now();
  saveRaw(data);
  return obj;
}

export function addAction(id, action) {
  return mutObject(id, (o) => {
    o.history.push({ ...action, timestamp: Date.now() });
    if (o.history.length > 400) o.history = o.history.slice(-400);
  });
}

export function applyHeatDelta(id, delta, { release = true, stir = false } = {}) {
  return mutObject(id, (o) => {
    if (delta > 0 && release) {
      o.releaseScore += delta;
    }
    o.heat = clampHeat((o.heat || 0) + delta);
    if (o.heat > (o.maxHeat || 0)) o.maxHeat = o.heat;
    o.form = formForHeat(o.heat).emoji;
    if (stir && delta > 0) o.stirCount = (o.stirCount || 0) + 1;
    if (o.status === "new") o.status = "cooking";
  });
}

export function reopenForCooking(id) {
  const before = getObject(id);
  if (!before) return null;
  const wasCooling = before.status === "cooling";
  const obj = mutObject(id, (o) => {
    o.status = "cooking";
    o.cookCount = (o.cookCount || 1) + (wasCooling ? 1 : 0);
    o.cooldownStartAt = null;
    o.cooldownEndAt = null;
    o.initialHeat = 0;
  });
  if (wasCooling) track("object_reopened", { id });
  return obj;
}

export function markCookingVisit(id) {
  const o = getObject(id);
  if (!o) return;
  if (o.status === "cooling") {
    reopenForCooking(id);
  } else if (o.status === "new") {
    mutObject(id, (x) => {
      x.status = "cooking";
    });
  }
  track("object_cooked", { id });
}

export function startCooldown(id, days, extra = {}) {
  const now = Date.now();
  const obj = mutObject(id, (o) => {
    o.status = "cooling";
    o.cooldownDays = days;
    o.cooldownStartAt = now;
    o.cooldownEndAt = now + days * 86400000;
    o.initialHeat = o.heat || 0;
    o.cookCount = o.cookCount || 1;
    o.releasedAt = null;
    o.forgivenVia = null;
    if (extra.dishName) o.dishName = extra.dishName;
    if (extra.dishReview) o.dishReview = extra.dishReview;
    if (extra.feedback) o.feedback = extra.feedback;
    if (extra.stars != null) o.stars = extra.stars;
  });
  if (obj) track("cooldown_started", { id, days });
  return obj;
}

export function finishCooking(id) {
  track("cooking_completed", { id });
}

export function setFeedback(id, key) {
  mutObject(id, (o) => {
    o.feedback = key;
  });
  track("cooking_feedback", { id, key });
}

export function manualForgive(id) {
  const obj = mutObject(id, (o) => {
    o.status = "forgiven";
    o.heat = 0;
    o.form = "✨";
    o.releasedAt = Date.now();
    o.forgivenVia = "manual";
    o.cooldownEndAt = o.cooldownEndAt || Date.now();
  });
  track("object_forgiven", { id, via: "manual" });
  track("object_archived", { id });
  return obj;
}

/** 把到期冷却对象结算为 forgiven；返回刚出锅的列表 */
export function tickCooldowns(now = Date.now()) {
  const data = loadRaw();
  const done = [];
  let dirty = false;
  for (const o of data.objects) {
    if (isCooldownDone(o, now)) {
      o.status = "forgiven";
      o.heat = 0;
      o.form = "✨";
      o.releasedAt = now;
      o.forgivenVia = "auto";
      o.updatedAt = now;
      dirty = true;
      done.push({ id: o.id, name: o.name });
    } else if (o.status === "cooling") {
      // 预览用 heat 不写回（衰减按公式实时算）；写回便于列表展示
      const h = coolingHeat(o, now);
      const rounded = Math.round(h * 10) / 10;
      if (Math.abs((o.heat || 0) - rounded) >= 0.05) {
        o.heat = rounded;
        o.form = formForHeat(rounded).emoji;
        dirty = true;
      }
    }
  }
  if (dirty) saveRaw(data);
  for (const d of done) {
    track("object_forgiven", { id: d.id, via: "auto" });
    track("object_archived", { id: d.id });
  }
  return done;
}

export function monthlyArchiveCount() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return listArchive().filter((o) => {
    const t = o.releasedAt || o.updatedAt;
    if (!t) return false;
    const d = new Date(t);
    return d.getFullYear() === y && d.getMonth() === m;
  }).length;
}

export function resetAll() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(EVENTS_KEY);
}
