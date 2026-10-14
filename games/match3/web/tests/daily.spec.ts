import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  todayISO,
  seedFromDate,
  generateDailyLevel,
  saveDailyHistory,
  recordDailyRun,
  getDailyBest,
  dailyStreak,
} from "../src/game/daily";

// node 环境无 localStorage，daily.ts 依赖它，做最小 mock
const store: Record<string, string> = {};
beforeAll(() => {
  // @ts-expect - 测试环境补齐 localStorage
  globalThis.localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("daily mode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("todayISO 返回 YYYY-MM-DD 格式", () => {
    expect(todayISO(new Date("2026-08-27T10:00:00"))).toBe("2026-08-27");
  });

  it("seedFromDate 同日期同种子", () => {
    expect(seedFromDate("2026-08-27")).toBe(seedFromDate("2026-08-27"));
    expect(seedFromDate("2026-08-27")).not.toBe(seedFromDate("2026-08-26"));
  });

  it("generateDailyLevel 同一日期生成相同关卡，不同日期不同关卡", () => {
    const a = generateDailyLevel("2026-08-27");
    const b = generateDailyLevel("2026-08-27");
    const c = generateDailyLevel("2026-08-28");
    expect(a.date).toBe("2026-08-27");
    expect(b.moves).toBe(a.moves);
    expect(b.goals[0].target).toBe(a.goals[0].target);
    expect(b.colors).toBe(a.colors);
    // 不同日期至少 moves/target/colors 之一不同（确定性但分布足够）
    expect(
      a.moves !== c.moves ||
        a.goals[0].target !== c.goals[0].target ||
        a.colors !== c.colors,
    ).toBe(true);
  });

  it("generateDailyLevel 参数在合理区间", () => {
    for (let d = 1; d <= 30; d++) {
      const lv = generateDailyLevel(`2026-08-${String(d).padStart(2, "0")}`);
      expect(lv.moves).toBeGreaterThanOrEqual(18);
      expect(lv.moves).toBeLessThanOrEqual(28);
      expect(lv.colors).toBeGreaterThanOrEqual(4);
      expect(lv.colors).toBeLessThanOrEqual(5);
      expect(lv.goals[0]?.target).toBeGreaterThan(0);
      expect(lv.stars.length).toBe(3);
    }
  });

  it("recordDailyRun 记录 + getDailyBest 取最佳", () => {
    const r1 = recordDailyRun("2026-08-27", 500, 20);
    expect(r1).not.toBeNull();
    expect(r1?.score).toBe(500);

    // 低于历史最佳不更新
    const r2 = recordDailyRun("2026-08-27", 300, 25);
    expect(r2).toBeNull();
    expect(getDailyBest("2026-08-27")?.score).toBe(500);

    // 高于历史最佳更新
    const r3 = recordDailyRun("2026-08-27", 800, 15);
    expect(r3?.score).toBe(800);
    expect(getDailyBest("2026-08-27")?.score).toBe(800);
  });

  it("dailyStreak 计算连续天数", () => {
    recordDailyRun("2026-08-25", 100, 10);
    recordDailyRun("2026-08-26", 200, 10);
    recordDailyRun("2026-08-27", 300, 10);
    expect(dailyStreak(7, "2026-08-27")).toBe(3);
    // 中间断了
    recordDailyRun("2026-08-25", 100, 10); // reset
    saveDailyHistory({ "2026-08-27": { date: "2026-08-27", score: 1, movesLeft: 0, achievedAt: "" } });
    expect(dailyStreak(7, "2026-08-27")).toBe(1);
  });
});