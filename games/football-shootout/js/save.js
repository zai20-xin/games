// =====================================================================
//  热血足球 · 本地存档与设置
//  最高纪录存 <id>:save，偏好存 <id>:settings
// =====================================================================
const SAVE_KEY = 'football-shootout:save';
const SETTINGS_KEY = 'football-shootout:settings';

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function loadBest() {
  const s = loadJSON(SAVE_KEY, {});
  return { bestStreak: s.bestStreak || 0, bestLevel: s.bestLevel || 1 };
}

export function saveBest(streak, level) {
  const cur = loadBest();
  if (streak > cur.bestStreak) {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ bestStreak: streak, bestLevel: level }));
    return true;
  }
  return false;
}

export function loadSettings() {
  return loadJSON(SETTINGS_KEY, {});
}

export function saveSettings(obj) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
}
