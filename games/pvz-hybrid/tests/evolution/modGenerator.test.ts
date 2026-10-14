import { describe, it, expect } from "vitest";
import { generateMod } from "../../src/engine/modGenerator";
import type { FormDef, SkillDef } from "../../src/types/dictionaries";

// ─── 测试辅助：创建 mock 数据 ───

const BASE_FORM: FormDef = {
  id: "base",
  name: "基础",
  tier: "common",
  statMultipliers: { attack: 1, health: 1, speed: 1 },
  projectile: "pea",
  attackStyle: "原始",
  texture: "",
};

const ICE_FORM: FormDef = {
  id: "ice_armor",
  name: "冰甲",
  tier: "rare",
  statMultipliers: { attack: 0.8, health: 2, speed: 0.7 },
  projectile: "icebolt",
  attackStyle: "减速",
  texture: "ice",
};

const BERSERK_FORM: FormDef = {
  id: "berserk",
  name: "狂暴",
  tier: "epic",
  statMultipliers: { attack: 1.8, health: 0.6, speed: 1.5 },
  projectile: "rift",
  attackStyle: "自损",
  texture: "berserk",
};

const MULTISHOT_SKILL: SkillDef = {
  id: "multishot",
  name: "连射",
  tier: "common",
  effect: { type: "multishot", count: 2, damageRate: 0.6 },
  costRate: 0.9,
};

const SHIELD_SKILL: SkillDef = {
  id: "shield",
  name: "护盾",
  tier: "epic",
  effect: { type: "shield", intervalMs: 10000, shieldHp: 200, damageRate: 0.7 },
  costRate: 0.8,
};

const CHAIN_SKILL: SkillDef = {
  id: "chain",
  name: "连锁",
  tier: "legendary",
  effect: { type: "chain", bounces: 2, damageDecay: 0.6, damageRate: 0.85 },
  costRate: 0.85,
};

describe("modGenerator", () => {
  describe("generateMod", () => {
    it("基础 + 基础 = common 模组", () => {
      const mod = generateMod(BASE_FORM, MULTISHOT_SKILL);
      expect(mod.id).toBe("base_multishot");
      expect(mod.tier).toBe("common");
      expect(mod.form).toBe(BASE_FORM);
      expect(mod.skill).toBe(MULTISHOT_SKILL);
    });

    it("稀有 + 稀有 = rare 模组", () => {
      const mod = generateMod(ICE_FORM, SHIELD_SKILL);
      expect(mod.tier).toBe("epic");
    });

    it("史诗 + 传说 = legendary 模组", () => {
      const mod = generateMod(BERSERK_FORM, CHAIN_SKILL);
      expect(mod.tier).toBe("legendary");
    });

    it("高偏离度增加预算消耗", () => {
      const baseMod = generateMod(BASE_FORM, MULTISHOT_SKILL);
      const highDevMod = generateMod(BERSERK_FORM, MULTISHOT_SKILL);
      expect(highDevMod.budgetCost).toBeGreaterThan(baseMod.budgetCost);
    });

    it("budgetCost 不为负", () => {
      const mod = generateMod(BASE_FORM, MULTISHOT_SKILL);
      expect(mod.budgetCost).toBeGreaterThanOrEqual(0);
    });
  });
});
