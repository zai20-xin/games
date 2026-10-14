// storage.js —— localStorage 封装（存档 / 钱包 / 皮肤 / 设置）
// 单一持久化入口，避免多模块直接读写 localStorage 造成键名漂移。

const K = {
  coins: 'ski_coins',
  best: 'ski_best',
  bestScore: 'ski_bestScore',
  owned: 'ski_owned',
  equip: 'ski_equip',
  mode: 'ski_mode',
  bgm: 'ski_bgm',
  tut: 'ski_tut',
  ach: 'ski_ach',
  crystal: 'ski_crystal',
  boxes: 'ski_boxes',
  streak: 'ski_streak',
  lastPlay: 'ski_lastplay',
  totalDist: 'ski_totaldist',
  totalKills: 'ski_totalkills',
  daily: 'ski_daily',
};

function getNum(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;          // key 不存在 → 用默认值（修复 Number(null)=0 吞掉 fallback）
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

// ---- 金币初始化（强制发 100 万）----
// 用户明确要 100 万金币：模块加载时无条件把钱包置为 1000000，覆盖任何旧值。
// 之后本局收集/消费仍通过 addCoins/spendCoins 正常累加。
(function initCoins() {
  localStorage.setItem(K.coins, '1000000');
})();

// ---- 钱包（金币）----
export let coins = getNum(K.coins, 1000000);
export function addCoins(n) {
  coins += n;
  localStorage.setItem(K.coins, String(coins));
}
export function spendCoins(n) {
  if (coins < n) return false;
  coins -= n;
  localStorage.setItem(K.coins, String(coins));
  return true;
}

// ---- 记录 ----
export function getBest() { return getNum(K.best, 0); }
export function setBest(v) { localStorage.setItem(K.best, String(v)); }
export function getBestScore() { return getNum(K.bestScore, 0); }
export function setBestScore(v) { localStorage.setItem(K.bestScore, String(v)); }

// ---- 皮肤 ----
export function getOwned() {
  try {
    const a = JSON.parse(localStorage.getItem(K.owned) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}
export function setOwned(list) { localStorage.setItem(K.owned, JSON.stringify(list)); }

export function getEquip() {
  try {
    const e = JSON.parse(localStorage.getItem(K.equip) || '{"char":"c_default","board":"b_default"}');
    if (!e || !e.char || !e.board) return { char: 'c_default', board: 'b_default' };
    return e;
  } catch { return { char: 'c_default', board: 'b_default' }; }
}
export function setEquip(e) { localStorage.setItem(K.equip, JSON.stringify(e)); }

// ---- 模式 ----
export function getMode() {
  const m = localStorage.getItem(K.mode);
  return m === 'ski' ? 'ski' : 'board';
}
export function setMode(m) { localStorage.setItem(K.mode, m); }

// ---- 设置（统一持久化到 ski-adventure:settings，静音/音乐开关单一来源）----
const SETTINGS_KEY = 'ski-adventure:settings';
const DEFAULT_SETTINGS = { muted: false, bgm: true };
export function getSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    // 旧版迁移：ski_bgm=0 → bgm:false（只读一次，写回后以新键为准）
    if (raw.bgm === undefined && localStorage.getItem(K.bgm) === '0') raw.bgm = false;
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function getBgmOn() { return getSettings().bgm; }
export function setBgmOn(on) { saveSettings({ bgm: !!on }); }

// ---- 教学 ----
export function isFirstRun() { return localStorage.getItem(K.tut) === null; }
export function markTutorialDone() { localStorage.setItem(K.tut, '1'); }

// ---- 成就（已解锁集合）----
export function getAch() {
  try {
    const a = JSON.parse(localStorage.getItem(K.ach) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}
export function setAch(list) { localStorage.setItem(K.ach, JSON.stringify(list)); }

// ---- 结晶（稀缺元货币，与金币解耦）----
export let crystal = getNum(K.crystal, 0);
export function addCrystal(n) {
  crystal += n;
  localStorage.setItem(K.crystal, String(crystal));
}
export function spendCrystal(n) {
  if (crystal < n) return false;
  crystal -= n;
  localStorage.setItem(K.crystal, String(crystal));
  return true;
}

// ---- 宝箱 ----
export let boxes = getNum(K.boxes, 0);
export function addBoxes(n) {
  boxes += n;
  localStorage.setItem(K.boxes, String(boxes));
}
export function consumeBox() {
  if (boxes <= 0) return false;
  boxes -= 1;
  localStorage.setItem(K.boxes, String(boxes));
  return true;
}

// ---- 连胜（损失厌恶）----
export function getStreak() { return getNum(K.streak, 0); }
export function getLastPlay() { return localStorage.getItem(K.lastPlay) || ''; }
export function setStreakInfo(streak, date) {
  localStorage.setItem(K.streak, String(streak));
  localStorage.setItem(K.lastPlay, date);
}

// ---- 累计统计（段位推导源）----
export function getTotalDist() { return getNum(K.totalDist, 0); }
export function getTotalKills() { return getNum(K.totalKills, 0); }
export function addTotals(dist, kills) {
  const d = getTotalDist() + (dist || 0);
  const k = getTotalKills() + (kills || 0);
  localStorage.setItem(K.totalDist, String(d));
  localStorage.setItem(K.totalKills, String(k));
}

// ---- 每日挑战榜（按日期存 Top10）----
export function getDailyBoard() {
  try {
    const o = JSON.parse(localStorage.getItem(K.daily) || '{}');
    return (o && typeof o === 'object') ? o : {};
  } catch { return {}; }
}
export function setDailyBoard(obj) { localStorage.setItem(K.daily, JSON.stringify(obj)); }
