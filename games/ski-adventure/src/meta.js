// meta.js —— 成瘾机制核心（可变奖励 / 段位 / 每日挑战 / 连胜）
// 设计原则：纯逻辑模块，只依赖 storage + config + skins，不依赖 state（避免循环依赖）。
import * as C from './config.js';
import * as storage from './storage.js';
import { SKINS } from './skins.js';

// ---------- 工具 ----------
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function weightedPick(arr, weightKey = 'w') {
  let total = 0;
  for (const a of arr) total += a[weightKey];
  let r = Math.random() * total;
  for (const a of arr) { r -= a[weightKey]; if (r <= 0) return a; }
  return arr[arr.length - 1];
}
function rngInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
// 本局结晶统计（用于结算展示「本局获得 X 结晶」）
let sessCrystal = 0;
export function beginRun() { sessCrystal = 0; }
export function sessionCrystal() { return sessCrystal; }
function addOwnedSkin(id) {
  const owned = new Set(storage.getOwned());
  if (!owned.has(id)) { owned.add(id); storage.setOwned([...owned]); return true; }
  return false;
}
export function skinName(id) {
  for (const cat of ['char', 'board']) {
    const s = SKINS[cat].find(x => x.id === id);
    if (s) return s.name;
  }
  return id;
}

// ============================================================
//  1. 可变结晶掉落（Skinner 箱：大部分不掉，偶尔掉，稀有更香）
// ============================================================
// 返回 { amt, rar, skin? } 或 null（未掉落）。调用方负责 popup。
export function dropCrystal() {
  if (Math.random() < C.CRYSTAL_DROP.noneChance) return null;
  const t = weightedPick(C.CRYSTAL_DROP.tiers);
  if (t.r === '传说' && Math.random() < C.CRYSTAL_DROP.legendSkinChance) {
    const id = C.CRYSTAL_DROP.legendSkins[rngInt(0, C.CRYSTAL_DROP.legendSkins.length - 1)];
    addOwnedSkin(id);
    storage.addCrystal(8);
    return { amt: 8, rar: '传说皮肤', skin: id };
  }
  const amt = rngInt(t.min, t.max);
  storage.addCrystal(amt);
  sessCrystal += amt;
  return { amt, rar: t.r };
}

// ============================================================
//  2. 宝箱（开箱内容随机 —— 核心惊喜源）
// ============================================================
export function grantBox(n = 1) { storage.addBoxes(n); }

export function openBox() {
  if (!storage.consumeBox()) return null;
  const pick = weightedPick(C.BOX_TABLE);
  if (pick.kind === 'crystal') {
    const amt = rngInt(pick.min, pick.max);
    storage.addCrystal(amt);
    return { kind: 'crystal', rar: pick.r, amt };
  }
  // 皮肤
  const id = pick.skins[rngInt(0, pick.skins.length - 1)];
  const isNew = addOwnedSkin(id);
  return { kind: 'skin', rar: '传说', id, isNew };
}

// ============================================================
//  3. 段位（元成长：累计距离 + 击杀 + 成就点）
// ============================================================
export function tierScore() {
  return storage.getTotalDist() * C.TIER_W_DIST
       + storage.getTotalKills() * C.TIER_W_KILL
       + storage.getAch().length * C.TIER_W_ACH;
}
export function tierInfo() {
  const score = tierScore();
  let idx = 0;
  for (let i = 0; i < C.TIER_TABLE.length; i++) if (score >= C.TIER_TABLE[i].need) idx = i;
  const cur = C.TIER_TABLE[idx];
  const next = C.TIER_TABLE[idx + 1] || null;
  return {
    level: idx + 1,
    maxLevel: C.TIER_TABLE.length,
    name: cur.name,
    score,
    curNeed: cur.need,
    nextNeed: next ? next.need : null,
    progress: next ? Math.max(0, Math.min(1, (score - cur.need) / (next.need - cur.need))) : 1,
    nextReward: next ? next.reward : null,
    nextName: next ? next.name : null,
  };
}
// 一局结束后调用：累加统计，并解锁「新跨过的段位」奖励，返回新解锁列表
export function recordRun(dist, score, kills = 0) {
  const before = tierScore();
  storage.addTotals(dist, kills);
  const after = tierScore();
  const gained = [];
  for (let i = 0; i < C.TIER_TABLE.length; i++) {
    const t = C.TIER_TABLE[i];
    if (before < t.need && after >= t.need && t.reward) {
      if (t.reward.type === 'crystal') { storage.addCrystal(t.reward.amt); gained.push({ type: 'crystal', amt: t.reward.amt, text: '段位奖励 · ' + t.name + ' +' + t.reward.amt + ' 结晶' }); }
      else if (t.reward.type === 'skin') { const isNew = addOwnedSkin(t.reward.id); gained.push({ type: 'skin', id: t.reward.id, text: '段位奖励 · 解锁皮肤 ' + skinName(t.reward.id) + (isNew ? '' : '（已有）') }); }
    }
  }
  return gained;
}

// ============================================================
//  4. 连胜（损失厌恶：断签清零）
// ============================================================
// 每局开始调用一次（同一天多次游玩只计一次）
export function registerStreak() {
  const today = todayStr();
  const last = storage.getLastPlay();
  let streak = storage.getStreak();
  let isNewDay = false;
  if (last === today) {
    // 今天已计过，不动
  } else {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    streak = (last === yStr) ? streak + 1 : 1;
    storage.setStreakInfo(streak, today);
    isNewDay = true;
  }
  const bonus = C.STREAK_BONUS[Math.min(streak, C.STREAK_MAX)] || 0;
  if (isNewDay && bonus > 0) storage.addCrystal(bonus);
  return { streak, bonus: isNewDay ? bonus : 0, isNewDay };
}

// ============================================================
//  5. 每日挑战（社会比较：旋转目标 + 本地 Top10 榜）
// ============================================================
export function dailyObjective() {
  const objs = C.DAILY_OBJECTIVES;
  // 用日期做稳定哈希，保证当天所有人目标一致
  let h = 0; const s = todayStr();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return objs[h % objs.length];
}
// 一局结束用本局 quest 统计检测是否完成今日目标（每天仅领一次）
export function checkDailyObjective(stats) {
  const obj = dailyObjective();
  const claimed = getDailyClaim();
  if (claimed.date === todayStr() && claimed.id === obj.id) return { done: false, alreadyClaimed: true };
  const got = stats[obj.stat] || 0;
  if (got >= obj.target) {
    setDailyClaim(obj.id);
    storage.addCrystal(obj.reward);
    return { done: true, reward: obj.reward, obj };
  }
  return { done: false, progress: got, target: obj.target };
}
function getDailyClaim() {
  try { return JSON.parse(localStorage.getItem('ski_daily_claim') || '{}'); } catch { return {}; }
}
function setDailyClaim(id) { localStorage.setItem('ski_daily_claim', JSON.stringify({ date: todayStr(), id })); }

// 记录本局成绩到今日榜，返回排名与榜单
export function recordDaily(score, dist) {
  const date = todayStr();
  const all = storage.getDailyBoard();
  const arr = Array.isArray(all[date]) ? all[date] : [];
  arr.push({ score: Math.floor(score), dist: Math.floor(dist), t: Date.now() });
  arr.sort((a, b) => b.score - a.score);
  const top = arr.slice(0, C.DAILY_BOARD_SIZE);
  all[date] = top;
  storage.setDailyBoard(all);
  const rank = top.findIndex(e => e.t === arr[arr.length - 1].t) + 1;
  return { rank: rank || top.length, board: top };
}
export function todayBoard() {
  const all = storage.getDailyBoard();
  return Array.isArray(all[todayStr()]) ? all[todayStr()] : [];
}
