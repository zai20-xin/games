// ===================== Save / Settings =====================
// 最高分存 <id>:save，设置存 <id>:settings
const SAVE_KEY = 'coastal-skate:save';
const SETTINGS_KEY = 'coastal-skate:settings';

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
  return s.bestScore || 0;
}

export function saveBest(score) {
  if (score > loadBest()) {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ bestScore: score }));
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
