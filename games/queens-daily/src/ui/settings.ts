export type Theme = "light" | "dark";

export interface Settings {
  sound: boolean;
  theme: Theme;
}

const KEY = "queens.settings.v1";
const DEFAULTS: Settings = { sound: false, theme: "light" };
let current: Settings = { ...DEFAULTS };

export const Settings = {
  load(): Settings {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) current = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* 偏好损坏按默认处理 */
    }
    return current;
  },
  get(): Settings {
    return current;
  },
  set(patch: Partial<Settings>): void {
    current = { ...current, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      /* 隐私模式写入失败可忽略 */
    }
  },
};
