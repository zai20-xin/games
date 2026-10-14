import { describe, expect, it } from "vitest";
import { LEVELS, getLevel } from "../src/levels";
import { BELT_POOL, ROWS } from "../src/config";

describe("LEVELS · 关卡定义", () => {
  it("关卡 id 唯一且非空", () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LEVELS.length).toBeGreaterThan(0);
  });

  it("选卡池非空、槽位数在 1 到池大小之间", () => {
    for (const l of LEVELS) {
      expect(l.selectable.length).toBeGreaterThan(0);
      expect(l.selectSlots).toBeGreaterThan(0);
      expect(l.selectSlots).toBeLessThanOrEqual(l.selectable.length);
    }
  });

  it("选卡池只含常规植物（无爆炸单卡）", () => {
    for (const l of LEVELS) {
      for (const k of l.selectable) {
        expect(BELT_POOL).toContain(k);
      }
    }
  });

  it("泳池关卡水行在行范围内", () => {
    const pool = getLevel("pool");
    expect(pool.waterRows?.length).toBeGreaterThan(0);
    for (const r of pool.waterRows!) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(ROWS);
    }
  });

  it("夜间关卡僵尸提速", () => {
    const night = getLevel("night");
    expect(night.zombieSpeedMul).toBeGreaterThan(1);
  });

  it("getLevel 未知 id 抛错", () => {
    expect(() => getLevel("nope")).toThrow();
  });
});
