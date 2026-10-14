import { describe, it, expect } from "vitest";
import { bestScore, leaderboard } from "../src/ui/scores";

const h = (entries: [string, number][]): Record<string, { ms: number }> =>
  Object.fromEntries(entries.map(([date, ms]) => [date, { ms }]));

describe("bestScore", () => {
  it("空历史返回 null", () => {
    expect(bestScore({})).toBeNull();
  });
  it("取最小用时", () => {
    expect(bestScore(h([["2026-01-01", 90000], ["2026-01-02", 30000], ["2026-01-03", 60000]]))).toBe(30000);
  });
});

describe("leaderboard", () => {
  it("按用时升序", () => {
    const board = leaderboard(h([["a", 90000], ["b", 30000], ["c", 60000]]));
    expect(board.map((e) => e.ms)).toEqual([30000, 60000, 90000]);
  });
  it("截断到 limit 并保留日期", () => {
    const hist = h(Array.from({ length: 15 }, (_, i) => [`d${i}`, (i + 1) * 1000]));
    const board = leaderboard(hist, 10);
    expect(board).toHaveLength(10);
    expect(board[0].date).toBe("d0");
    expect(board[0].ms).toBe(1000);
  });
  it("并列用时按日期升序稳定排序", () => {
    const board = leaderboard(h([["z", 5000], ["a", 5000], ["m", 5000]]));
    expect(board.map((e) => e.date)).toEqual(["a", "m", "z"]);
  });
  it("空历史返回空数组", () => {
    expect(leaderboard({})).toEqual([]);
  });
});
