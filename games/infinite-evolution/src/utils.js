// ============================================
//  无限进化 V1.1 — 工具函数库
//  无状态工具函数集合
// ============================================

// ==================== 音效系统 ====================
let audioInited = false;
const audioPool = {};

const SOUND_LIST = ['shoot', 'hit', 'kill', 'hurt', 'pickup', 'evolve', 'ultimate', 'boss', 'elite', 'death'];

// ==================== 设置持久化（静音） ====================
const SETTINGS_KEY = 'infinite-evolution:settings';
let muted = false;

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) muted = !!(JSON.parse(raw).muted);
  } catch (e) {}
  return muted;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted }));
  } catch (e) {}
}

function isMuted() { return muted; }

function toggleMute() {
  muted = !muted;
  saveSettings();
  return muted;
}

function initAudio() {
  if (audioInited) return;
  audioInited = true;
  for (const name of SOUND_LIST) {
    try {
      const audio = new Audio(`audio/${name}.wav`);
      audio.preload = 'auto';
      audio.load();
      audioPool[name] = audio;
    } catch (e) {
      // 静默处理音频加载错误
    }
  }
}

function playSound(type) {
  if (!audioInited || muted) return;
  const audio = audioPool[type];
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {}
}

function isAudioInited() { return audioInited; }

// ==================== 本地最高分持久化 ====================
let bestKills = 0, bestTime = 0, bestForm = '';

const STORAGE_KEY = 'infinite-evolution:best';

function loadBestRecord() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      bestKills = saved.kills || 0;
      bestTime = saved.time || 0;
      bestForm = saved.form || '';
    }
  } catch (e) {}
  return { bestKills, bestTime, bestForm };
}

function saveBestRecord(kills, survivalTime, form) {
  if (kills > bestKills || survivalTime > bestTime) {
    if (kills > bestKills) bestKills = kills;
    if (survivalTime > bestTime) bestTime = survivalTime;
    bestForm = form;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        kills: bestKills, time: bestTime, form: bestForm,
      }));
    } catch (e) {}
    return true;
  }
  return false;
}

function getBestRecord() { return { bestKills, bestTime, bestForm }; }

// ==================== 数学工具 ====================
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function rand(a, b) { return Math.random() * (b - a) + a; }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }

function pickWeighted(table) {
  const s = table.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * s;
  for (const item of table) {
    r -= item.weight;
    if (r <= 0) return item.id;
  }
  return table[0].id;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function formatTime(s) {
  const m = Math.floor(s / 0.01) / 100; // 避免浮点问题
  const minutes = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${minutes}:${sec.toString().padStart(2, '0')}`;
}

// ==================== 颜色工具 ====================
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function rgbaString(color, alpha) {
  if (color.startsWith('#')) {
    return `rgba(${hexToRgb(color)},${alpha})`;
  }
  return color;
}

// ==================== 震动工具 ====================
function getShakeConfig(comboCount, shakeLevels) {
  for (let i = shakeLevels.length - 1; i >= 0; i--) {
    if (comboCount >= shakeLevels[i].minCombo) {
      return shakeLevels[i];
    }
  }
  return null;
}

// ==================== 角度工具 ====================
function angleToVector(angle) {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function vectorToAngle(x, y) {
  return Math.atan2(y, x);
}

// ==================== 导出 ====================
export {
  // 音效
  initAudio, playSound, isAudioInited,
  // 设置（静音）
  loadSettings, isMuted, toggleMute,
  // 持久化
  loadBestRecord, saveBestRecord, getBestRecord,
  // 数学
  dist, rand, randInt, pickWeighted, lerp, clamp, formatTime,
  // 颜色
  hexToRgb, rgbaString,
  // 震动
  getShakeConfig,
  // 角度
  angleToVector, vectorToAngle,
};
