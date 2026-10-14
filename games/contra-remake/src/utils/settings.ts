/**
 * 用户设置持久化（工作区约定键名：<game-id>:settings）。
 * JSON 结构 { muted: boolean }，损坏/缺失时回退默认值，写入失败静默（隐私模式等）。
 */
export const SETTINGS_KEY = 'contra-remake:settings';

export interface GameSettings {
  muted: boolean;
}

const DEFAULTS: GameSettings = { muted: false };

export function readSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      return { ...DEFAULTS, muted: obj.muted === true };
    }
  } catch {
    // fallthrough → 默认值
  }
  return { ...DEFAULTS };
}

/** 合并写入一个设置片段，返回写后的完整设置。 */
export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  const next = { ...readSettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // 写入失败静默：隐私模式 / 存储被禁用
  }
  return next;
}
