/** 纯逻辑：形态 / 火候等级 / 冷却 / 展示映射（与业务存储解耦） */

export const STIR_CAP = 100;
export const HEAT_CAP = 120;
export const BRAISE_MAX_SEC = 30;

export const FORMS = [
  { min: 0, max: 19, emoji: "🧑", name: "平静" },
  { min: 20, max: 39, emoji: "🐰", name: "微热" },
  { min: 40, max: 59, emoji: "🐡", name: "炙热" },
  { min: 60, max: 79, emoji: "🦛", name: "高温" },
  { min: 80, max: 99, emoji: "👹", name: "暴躁" },
  { min: 100, max: Infinity, emoji: "👾", name: "沸腾失控" },
];

export const HEAT_MESSAGES = [
  { max: 20, text: "微热" },
  { max: 40, text: "有点热" },
  { max: 60, text: "火候上来了" },
  { max: 80, text: "火候很足" },
  { max: 100, text: "锅里已经很不平静" },
  { max: Infinity, text: "⚠️ 锅快压不住了" },
];

export const INGREDIENTS = {
  chili: { label: "辣椒", emoji: "🌶️", heat: 5, type: "chili" },
  pepper: { label: "胡椒", emoji: "⚫", heat: 3, type: "pepper" },
  mustard: { label: "芥末", emoji: "🟡", heat: 8, type: "mustard" },
  salt: { label: "盐", emoji: "🧂", heat: 2, type: "salt" },
};

export const FIRE_LEVELS = [
  { id: "low", label: "小火", rate: 0.5, emoji: "🔥" },
  { id: "mid", label: "中火", rate: 1, emoji: "🔥🔥" },
  { id: "high", label: "大火", rate: 2, emoji: "🔥🔥🔥" },
  { id: "max", label: "猛火", rate: 4, emoji: "🔥×4" },
];

export function formForHeat(heat) {
  const h = Number(heat) || 0;
  for (const f of FORMS) {
    if (h >= f.min && h <= f.max) return f;
  }
  return FORMS[0];
}

export function heatMessage(heat) {
  const h = Number(heat) || 0;
  for (const m of HEAT_MESSAGES) {
    if (h <= m.max) return m.text;
  }
  return HEAT_MESSAGES[HEAT_MESSAGES.length - 1].text;
}

export function heatBand(heat) {
  if (heat < 20) return 0;
  if (heat < 40) return 1;
  if (heat < 60) return 2;
  if (heat < 80) return 3;
  if (heat < 100) return 4;
  return 5;
}

export function clampHeat(n) {
  return Math.max(0, Math.min(HEAT_CAP, n));
}

/** 冷却衰减：CoolingRate = InitialHeat / cooldown_days */
export function coolingHeat(obj, now = Date.now()) {
  if (!obj || obj.status !== "cooling") return obj?.heat ?? 0;
  const initial = obj.initialHeat ?? obj.heat ?? 0;
  const days = obj.cooldownDays || 3;
  const end = obj.cooldownEndAt;
  const start = obj.cooldownStartAt;
  if (!end || !start) return initial;
  if (now >= end) return 0;
  const elapsedDays = Math.max(0, (now - start) / 86400000);
  const rate = initial / days;
  return Math.max(0, initial - rate * elapsedDays);
}

export function isCooldownDone(obj, now = Date.now()) {
  return obj?.status === "cooling" && obj.cooldownEndAt && now >= obj.cooldownEndAt;
}

export function remainingMs(obj, now = Date.now()) {
  if (!obj?.cooldownEndAt) return 0;
  return Math.max(0, obj.cooldownEndAt - now);
}

export function formatRemain(ms) {
  if (ms <= 0) return "出锅中";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}天${h}小时`;
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function releaseLine(obj) {
  const acts = obj?.history || [];
  const count = (t) => acts.filter((a) => a.type === t).length;
  const parts = [];
  const stirs = count("stir");
  if (stirs) parts.push(`搅拌 ${stirs} 次`);
  const pokes = count("poke");
  if (pokes) parts.push(`戳 ${pokes} 下`);
  const chaos = acts.filter((a) => a.type === "chaos");
  if (chaos.length) {
    const sec = chaos.reduce((s, a) => s + (a.value || 0), 0);
    parts.push(`乱炖 ${Math.round(sec)} 秒`);
  }
  for (const k of ["chili", "pepper", "mustard", "salt", "bossCake", "clientMouth", "mondayAlarm", "expiredDream", "uselessCs", "missedTakeout", "endlessMeeting", "coldJoke"]) {
    const c = count(k);
    if (!c) continue;
    const label =
      INGREDIENTS[k]?.label ||
      ({
        bossCake: "老板的饼",
        clientMouth: "甲方的嘴硬",
        mondayAlarm: "周一的闹钟",
        expiredDream: "过期的梦想",
        uselessCs: "打不通的客服",
        missedTakeout: "点不到的外卖",
        endlessMeeting: "拉通对齐会",
        coldJoke: "冷笑话冰块",
      }[k] || k);
    parts.push(`${label} ×${c}`);
  }
  return parts.join(" · ") || "刚刚下锅";
}

export function cookSessions(obj) {
  // 每次进入 cooking 前 status 变更算一次会话粗估：用 history 的 fire/steam 分段
  const acts = obj?.history || [];
  if (!acts.length) return 0;
  // 以 finish/cooldown 边界估算：简单用创建后 cooling 次数 + 当前
  return Math.max(1, (obj.cookCount || 1));
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
