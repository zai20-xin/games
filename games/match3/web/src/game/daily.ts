// 每日挑战模式
// 每天同一关卡布局（基于日期种子），玩家每天回来挑战一次，全站同一题可比拼。

import { LevelData } from "./levels";
import { Rng } from "./rng";

export const DAILY_KEY = "match3.daily.v1";

export interface DailyLevel extends LevelData {
  date: string; // YYYY-MM-DD
}

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → 数字种子 */
export function seedFromDate(date: string): number {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) {
    h = Math.imul(h ^ date.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * 每日挑战关卡：基于日期种子微调 level_01 的参数，
 * 保留可玩性同时每天有"变种"感。moves/target 每日不同，全站同天同一关。
 */
export function generateDailyLevel(date: string = todayISO()): DailyLevel {
  const seed = seedFromDate(date);
  const rng = new Rng(seed);
  const rand = () => rng.randf();

  // 每日 moves 在 18~28 间波动，target 在 600~1200 间波动
  const moves = 18 + Math.floor(rand() * 11); // 18..28
  const baseTarget = 600 + Math.floor(rand() * 601); // 600..1200
  const target = Math.round(baseTarget * (moves / 26)); // 跟着步数微调
  const stars: [number, number, number] = [
    target,
    Math.round(target * 1.6),
    Math.round(target * 2.4),
  ];

  // 复用 level_01 的结构（width/height/colors/obstacles/goals.features）作为基线
  // 但 board 由关卡首次进入时按 colors 重新生成（Board 自己用 rng），这里只传 seed 给 GameScene
  const level = Object.assign(new LevelData(), {
    id: 9000 + seed % 1000, // 合成 id 避开常规 1..N
    levelName: `每日挑战 · ${date}`,
    name: `每日挑战 · ${date}`,
    width: 7,
    height: 8,
    colors: 4 + Math.floor(rand() * 2), // 4 或 5 色
    moves,
    obstacles: [],
    goals: [{ type: "score" as const, target }],
    stars,
    features: ["basic", "daily"],
    sourcePath: `daily://${date}`,
  });
  return Object.assign(level, { date }) as unknown as DailyLevel;
}

/** 每日挑战成绩：每日期最佳分数 */
export interface DailyRecord {
  date: string;
  score: number;
  movesLeft: number;
  achievedAt: string; // ISO 时间戳
}

export function loadDailyHistory(): Record<string, DailyRecord> {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DailyRecord>;
  } catch {
    return {};
  }
}

export function saveDailyHistory(map: Record<string, DailyRecord>): void {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function recordDailyRun(date: string, score: number, movesLeft: number): DailyRecord | null {
  const history = loadDailyHistory();
  const prev = history[date];
  if (prev && prev.score >= score) return null; // 没超过历史最佳
  const rec: DailyRecord = {
    date,
    score,
    movesLeft,
    achievedAt: new Date().toISOString(),
  };
  history[date] = rec;
  saveDailyHistory(history);
  return rec;
}

export function getDailyBest(date: string): DailyRecord | null {
  return loadDailyHistory()[date] ?? null;
}

/**
 * 计算 N 天内连续每日挑战的天数（streak，用于钩子展示）
 */
export function dailyStreak(days: number = 7, today: string = todayISO()): number {
  const history = loadDailyHistory();
  let streak = 0;
  const d = new Date(today + "T00:00:00");
  for (let i = 0; i < days; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    if (history[key]) streak++;
    else if (i > 0) break; // 今天是 streak 起点，断了就从这里断
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** 抑制未使用引用警告 */
void null;