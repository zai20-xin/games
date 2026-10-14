/**
 * 应用级设置（localStorage 键：match3:settings）。
 * 与 SaveManager(match3.save.v1) 解耦：这里只放「整机静音」这类应用偏好。
 */
const KEY = "match3:settings";

export interface AppSettings {
  /** 主静音：同时压掉音效与 BGM（M 键切换） */
  muted: boolean;
}

const DEFAULTS: AppSettings = { muted: false };

export function loadAppSettings(): AppSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...loadAppSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
