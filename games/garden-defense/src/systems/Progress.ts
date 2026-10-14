export interface ProgressData {
  bestWave: Record<string, number>;
  runs: number;
  totalKills: number;
  bestCombo: number;
  soundMuted: boolean;
  tutorialDone: boolean;
}

const KEY = "garden-defense-v3";

const DEFAULT: ProgressData = {
  bestWave: { casual: 0, standard: 0, expert: 0 },
  runs: 0,
  totalKills: 0,
  bestCombo: 0,
  soundMuted: false,
  tutorialDone: false,
};

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    return {
      ...structuredClone(DEFAULT),
      ...parsed,
      bestWave: { ...DEFAULT.bestWave, ...(parsed.bestWave ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

let data: ProgressData = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore quota
  }
}

export function getProgress(): ProgressData {
  return data;
}

export function recordRun(stats: {
  wave: number;
  kills: number;
  combo: number;
  difficulty: string;
}): void {
  data.runs += 1;
  data.totalKills += stats.kills;
  if (stats.combo > data.bestCombo) data.bestCombo = stats.combo;
  const key = stats.difficulty;
  const prev = data.bestWave[key] ?? 0;
  if (stats.wave > prev) data.bestWave[key] = stats.wave;
  save();
}

export function setSoundMuted(muted: boolean): void {
  data.soundMuted = muted;
  save();
}

export function isSoundMuted(): boolean {
  return data.soundMuted;
}

export function isTutorialDone(): boolean {
  return data.tutorialDone;
}

export function markTutorialDone(): void {
  data.tutorialDone = true;
  save();
}
