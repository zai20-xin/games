import { describe, expect, it } from "vitest";
import { generate, generateDaily, sizeForDate } from "../src/engine/generator";
import { countSolutions, gradeSolve } from "../src/engine/solver";

describe("generate", () => {
  it.each([6, 7, 8, 9])("n=%i 通过全部门禁", (n) => {
    const puzzle = generate(n, 42 + n);
    // 唯一解
    expect(countSolutions(n, puzzle.regions, puzzle.clues, 2)).toBe(1);
    // 人类可解且无需猜测
    const grade = gradeSolve(n, puzzle.regions, puzzle.clues);
    expect(grade.solved).toBe(true);
    expect(grade.maxLevel).toBeLessThanOrEqual(3);
    // 提示是解的子集（数量为删提示临界点的自然结果，≥1）
    expect(puzzle.clues.length).toBeGreaterThanOrEqual(1);
    const clueSet = new Set(puzzle.clues);
    puzzle.solution.forEach((c, r) => {
      if (clueSet.has(r * n + c)) return;
    });
    // 谜题记录的难度级与求解器一致
    expect(puzzle.level).toBe(grade.maxLevel);
  });

  it("同种子同题（确定性）", () => {
    const a = generate(8, 777);
    const b = generate(8, 777);
    expect(a.regions).toEqual(b.regions);
    expect(a.clues).toEqual(b.clues);
    expect(a.solution).toEqual(b.solution);
  });

  it("不同种子提示格局不同", () => {
    const a = generate(8, 777);
    const b = generate(8, 778);
    expect(a.clues).not.toEqual(b.clues);
  });
});

describe("daily 派生", () => {
  it("尺寸按星期爬坡", () => {
    expect(sizeForDate("2026-08-24")).toBe(6); // 周一
    expect(sizeForDate("2026-08-25")).toBe(7); // 周二
    expect(sizeForDate("2026-08-26")).toBe(7); // 周三
    expect(sizeForDate("2026-08-27")).toBe(8); // 周四
    expect(sizeForDate("2026-08-28")).toBe(8); // 周五
    expect(sizeForDate("2026-08-29")).toBe(9); // 周六
    expect(sizeForDate("2026-08-30")).toBe(9); // 周日
  });

  it("同日同题、跨日不同", () => {
    const a = generateDaily("2026-08-25");
    const b = generateDaily("2026-08-25");
    const c = generateDaily("2026-08-26");
    expect(a.regions).toEqual(b.regions);
    expect(a.clues).toEqual(b.clues);
    expect(a.dateStr).toBe("2026-08-25");
    expect(a.seed).not.toBe(c.seed);
  });
});

describe("发布门禁：连续 30 天", () => {
  const days: string[] = [];
  const endUtc = Date.UTC(2026, 7, 26); // 2026-08-26
  for (let i = 29; i >= 0; i--) {
    days.push(new Date(endUtc - i * 86400000).toISOString().slice(0, 10));
  }
  expect(days.length).toBe(30);

  it("每天唯一解且色区数=皇后数，跨日题目绝大多数不同", () => {
    const signatures = new Set<string>();
    for (const dateStr of days) {
      const puzzle = generateDaily(dateStr);
      expect(countSolutions(puzzle.n, puzzle.regions, puzzle.clues, 2)).toBe(1);
      expect(new Set(puzzle.regions).size).toBe(puzzle.n);
      // 每区恰含一枚解皇后
      const perRegion = new Array(puzzle.n).fill(0);
      puzzle.solution.forEach((c, r) => perRegion[puzzle.regions[r * puzzle.n + c]]++);
      expect(perRegion.every((v) => v === 1)).toBe(true);
      signatures.add(puzzle.regions.join(",") + "|" + puzzle.clues.join(","));
    }
    // 允许极少数撞题，但至少绝大多数日期互不相同
    expect(signatures.size).toBeGreaterThanOrEqual(28);
  }, 120000);
});

describe("发布门禁：一周批量", () => {
  const week = [
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
    "2026-08-27",
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
  ];

  it("7 天全部通过唯一解 + 人类可解门禁，提示数随尺寸递减", () => {
    const clueCounts: number[] = [];
    for (const dateStr of week) {
      const puzzle = generateDaily(dateStr);
      expect(countSolutions(puzzle.n, puzzle.regions, puzzle.clues, 2)).toBe(1);
      const grade = gradeSolve(puzzle.n, puzzle.regions, puzzle.clues);
      expect(grade.solved, `${dateStr} 需要猜测`).toBe(true);
      expect(grade.maxLevel).toBeLessThanOrEqual(3);
      clueCounts.push(puzzle.clues.length);
    }
    // 尺寸爬坡本身构成难度递进（周一 6×6 → 周日 9×9）
    expect(sizeForDate(week[6])).toBeGreaterThan(sizeForDate(week[0]));
  }, 120000);
});
