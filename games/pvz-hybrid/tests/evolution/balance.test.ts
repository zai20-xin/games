import { describe, it, expect } from "vitest";
import {
  getBudgetLimit,
  calculateTotalBudget,
  isOverBudget,
  compressToBudget,
  calculateDpsMultiplier,
  getDpsLimit,
} from "../../src/engine/balance";
import type { Mod } from "../../src/types/dictionaries";

// ─── 测试辅助：创建 mock Mod ───

function makeMod(overrides: Partial<Mod> = {}): Mod {
  return {
    id: "test_mod",
    form: {
      id: "base",
      name: "基础",
      tier: "common",
      statMultipliers: { attack: 1, health: 1, speed: 1 },
      projectile: "pea",
      attackStyle: "原始",
      texture: "",
    },
    skill: {
      id: "multishot",
      name: "连射",
      tier: "common",
      effect: { type: "multishot", count: 2, damageRate: 0.6 },
      costRate: 0.9,
    },
    budgetCost: 25,
    tier: "common",
    ...overrides,
  };
}

describe("balance", () => {
  describe("getBudgetLimit", () => {
    it("层级0 = 80", () => expect(getBudgetLimit(0)).toBe(80));
    it("层级1 = 110", () => expect(getBudgetLimit(1)).toBe(110));
    it("层级2 = 140", () => expect(getBudgetLimit(2)).toBe(140));
    it("层级3 = 170", () => expect(getBudgetLimit(3)).toBe(170));
    it("层级4+ = 170 (上限)", () => expect(getBudgetLimit(5)).toBe(170));
  });

  describe("calculateTotalBudget", () => {
    it("空列表 = 0", () => expect(calculateTotalBudget([])).toBe(0));

    it("累加所有模组预算", () => {
      const mods = [makeMod({ budgetCost: 25 }), makeMod({ budgetCost: 30 })];
      expect(calculateTotalBudget(mods)).toBe(55);
    });
  });

  describe("isOverBudget", () => {
    it("未超限返回 false", () => {
      const mods = [makeMod({ budgetCost: 25 })];
      expect(isOverBudget(mods, 0)).toBe(false);
    });

    it("超限返回 true", () => {
      const mods = [makeMod({ budgetCost: 50 }), makeMod({ budgetCost: 40 })];
      expect(isOverBudget(mods, 0)).toBe(true);
    });
  });

  describe("compressToBudget", () => {
    it("未超限不压缩", () => {
      const mods = [makeMod({ budgetCost: 25 })];
      const result = compressToBudget(mods, 0);
      expect(result).toEqual(mods);
    });

    it("超限时等比压缩", () => {
      const mods = [
        makeMod({
          budgetCost: 90,
          form: {
            ...makeMod().form,
            statMultipliers: { attack: 2, health: 1, speed: 1 },
          },
        }),
      ];
      const result = compressToBudget(mods, 0);
      expect(result[0]!.budgetCost).toBeLessThan(90);
    });
  });

  describe("calculateDpsMultiplier", () => {
    it("空列表 = 1", () => expect(calculateDpsMultiplier([])).toBe(1));

    it("形态攻击 ×1.4 + 技能 costRate ×0.9", () => {
      const mods = [
        makeMod({
          form: {
            ...makeMod().form,
            statMultipliers: { attack: 1.4, health: 1, speed: 1 },
          },
          skill: {
            ...makeMod().skill,
            costRate: 0.9,
          },
        }),
      ];
      expect(calculateDpsMultiplier(mods)).toBeCloseTo(1.4, 1);
    });
  });

  describe("getDpsLimit", () => {
    it("层级0 = 1.0", () => expect(getDpsLimit(0)).toBe(1.0));
    it("层级1 = 1.37", () => expect(getDpsLimit(1)).toBe(1.37));
    it("层级2 = 1.75", () => expect(getDpsLimit(2)).toBe(1.75));
    it("层级3 = 2.12", () => expect(getDpsLimit(3)).toBe(2.12));
  });
});
