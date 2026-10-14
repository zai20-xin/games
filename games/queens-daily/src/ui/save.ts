const KEY = "queens.save.v1";

export interface QueensStats {
  played: number;
  streak: number;
  best: number;
  lastWinDate: string;
}

interface SaveData {
  stats: QueensStats;
  history: Record<string, { ms: number }>;
}

function defaults(): SaveData {
  return {
    stats: { played: 0, streak: 0, best: 0, lastWinDate: "" },
    history: {},
  };
}

export function todayStr(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export function yesterdayStr(): string {
  return new Date(Date.now() - 86400000 + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export const SaveManager = {
  data: defaults(),

  load(): void {
    this.data = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      Object.assign(this.data.stats, parsed.stats ?? {});
      Object.assign(this.data.history, parsed.history ?? {});
    } catch {
      /* 损坏存档按全新处理 */
    }
  },

  save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.data));
  },

  getStreak(): number {
    return this.data.stats.streak;
  },

  /** 胜利记录：当日重复通关与往期回放不改变统计（规格：归档不注水） */
  recordWin(
    dateStr: string,
    ms: number,
    isArchive: boolean,
  ): { replay: boolean; streak: number } {
    if (this.data.history[dateStr]) {
      return { replay: true, streak: this.data.stats.streak };
    }
    this.data.history[dateStr] = { ms };
    // history 滚动裁剪至 90 条
    const keys = Object.keys(this.data.history).sort();
    while (keys.length > 90) {
      delete this.data.history[keys.shift()!];
    }
    let streak = this.data.stats.streak;
    if (!isArchive) {
      this.data.stats.played += 1;
      streak = this.data.stats.lastWinDate === yesterdayStr() ? streak + 1 : 1;
      this.data.stats.streak = streak;
      this.data.stats.best = Math.max(this.data.stats.best, streak);
      this.data.stats.lastWinDate = dateStr;
    }
    this.save();
    return { replay: false, streak };
  },
};
