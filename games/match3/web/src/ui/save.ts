const KEY = "match3.save.v1";

export type BoosterKind = "hammer" | "swap" | "shuffle";
export const BOOSTER_KINDS: BoosterKind[] = ["hammer", "swap", "shuffle"];
export const BOOSTER_NAMES: Record<BoosterKind, string> = {
  hammer: "锤子",
  swap: "自由换位",
  shuffle: "手动洗牌",
};

interface SaveData {
  stars: Record<string, number>;
  settings: { sfx: boolean; music: boolean };
  tutorials: Record<string, boolean>;
  daily: { lastClaimDay: string; streak: number };
  boosters: Record<BoosterKind, number>;
}

function defaults(): SaveData {
  return {
    stars: {},
    settings: { sfx: true, music: true },
    tutorials: {},
    daily: { lastClaimDay: "", streak: 0 },
    boosters: { hammer: 0, swap: 0, shuffle: 0 },
  };
}

export const SaveManager = {
  data: defaults(),

  load(): void {
    this.data = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      Object.assign(this.data.stars, parsed.stars ?? {});
      Object.assign(this.data.settings, parsed.settings ?? {});
      Object.assign(this.data.tutorials, parsed.tutorials ?? {});
      Object.assign(this.data.daily, parsed.daily ?? {});
      Object.assign(this.data.boosters, parsed.boosters ?? {});
    } catch {
      /* 损坏存档按全新处理 */
    }
  },

  save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.data));
  },

  resetAll(): void {
    this.data = defaults();
    this.save();
  },

  getStars(levelId: number): number {
    return this.data.stars[String(levelId)] ?? 0;
  },

  recordWin(levelId: number, earned: number): boolean {
    const prev = this.getStars(levelId);
    if (earned > prev) {
      this.data.stars[String(levelId)] = earned;
      this.save();
      return true;
    }
    return false;
  },

  isUnlocked(levelId: number): boolean {
    return levelId <= 1 || this.getStars(levelId - 1) > 0;
  },

  latestUnlockedId(maxId: number): number {
    let latest = 1;
    for (let id = 1; id <= maxId; id++) {
      if (this.isUnlocked(id)) latest = id;
    }
    return latest;
  },

  getSetting(key: "sfx" | "music"): boolean {
    return this.data.settings[key] !== false;
  },

  setSetting(key: "sfx" | "music", value: boolean): void {
    this.data.settings[key] = value;
    this.save();
  },

  markTutorial(key: string): void {
    this.data.tutorials[key] = true;
    this.save();
  },

  hasTutorial(key: string): boolean {
    return this.data.tutorials[key] === true;
  },

  getBooster(kind: BoosterKind): number {
    return this.data.boosters[kind] ?? 0;
  },

  addBooster(kind: BoosterKind, amount = 1): void {
    this.data.boosters[kind] = this.getBooster(kind) + amount;
    this.save();
  },

  consumeBooster(kind: BoosterKind): boolean {
    if (this.getBooster(kind) <= 0) return false;
    this.data.boosters[kind] -= 1;
    this.save();
    return true;
  },

  randomBoosterKind(): BoosterKind {
    return BOOSTER_KINDS[Math.floor(Math.random() * BOOSTER_KINDS.length)];
  },

  claimDaily(today?: string): { claimed: boolean; streak: number; kind: BoosterKind | ""; firstEver: boolean } {
    const day = today ?? new Date().toISOString().slice(0, 10);
    const firstEver = !this.data.daily.lastClaimDay;
    if (this.data.daily.lastClaimDay === day) {
      return { claimed: false, streak: this.data.daily.streak, kind: "", firstEver };
    }
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak =
      this.data.daily.lastClaimDay && this.data.daily.lastClaimDay === yesterday
        ? this.data.daily.streak + 1
        : 1;
    this.data.daily = { lastClaimDay: day, streak };
    const kind = this.randomBoosterKind();
    this.addBooster(kind);
    return { claimed: true, streak, kind, firstEver };
  },
};
