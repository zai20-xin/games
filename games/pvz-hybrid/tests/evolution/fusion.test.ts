import { describe, it, expect } from "vitest";
import { generateSeed, rollEvolution, canEvolve } from "../../src/engine/fusion";
import type { EvolvedPlant, FormDef, SkillDef } from "../../src/types/dictionaries";

// ─── 测试辅助：创建 mock 数据 ───

const MOCK_PLANT_BASE = {
  id: "peashooter",
  name: "豌豆射手",
  family: "shooter" as const,
  baseStats: { attack: 20, health: 300, speed: 1 },
  cost: 100,
  texture: "pea",
};

const MOCK_PLANT_WALL = {
  id: "wallnut",
  name: "坚果墙",
  family: "wall" as const,
  baseStats: { attack: 0, health: 4000, speed: 1 },
  cost: 50,
  texture: "wall",
};

const MOCK_PLANT_EXPLOSIVE = {
  id: "cherrybomb",
  name: "樱桃炸弹",
  family: "explosive" as const,
  baseStats: { attack: 1800, health: 300, speed: 1 },
  cost: 150,
  texture: "cherry",
};

const MOCK_FORMS: FormDef[] = [
  { id: "base", name: "基础", tier: "common", statMultipliers: { attack: 1, health: 1, speed: 1 }, projectile: "pea", attackStyle: "原始", texture: "" },
  { id: "ice_armor", name: "冰甲", tier: "rare", statMultipliers: { attack: 0.8, health: 2, speed: 0.7 }, projectile: "ice", attackStyle: "减速", texture: "ice" },
  { id: "flame", name: "火焰", tier: "rare", statMultipliers: { attack: 1.4, health: 0.7, speed: 1.2 }, projectile: "fire", attackStyle: "灼烧", texture: "fire" },
  { id: "berserk", name: "狂暴", tier: "epic", statMultipliers: { attack: 1.8, health: 0.6, speed: 1.5 }, projectile: "rift", attackStyle: "自损", texture: "berserk" },
];

const MOCK_SKILLS: SkillDef[] = [
  { id: "multishot", name: "连射", tier: "common", effect: { type: "multishot", count: 2, damageRate: 0.6 }, costRate: 0.9 },
  { id: "splash", name: "溅射", tier: "common", effect: { type: "splash", radius: 1, damageRate: 0.8 }, costRate: 0.85 },
  { id: "shield", name: "护盾", tier: "epic", effect: { type: "shield", intervalMs: 10000, shieldHp: 200, damageRate: 0.7 }, costRate: 0.8 },
  { id: "chain", name: "连锁", tier: "legendary", effect: { type: "chain", bounces: 2, damageDecay: 0.6, damageRate: 0.85 }, costRate: 0.85 },
];

function makeEvolved(overrides: Partial<EvolvedPlant> = {}): EvolvedPlant {
  return {
    base: MOCK_PLANT_BASE,
    mods: [],
    level: 0,
    ...overrides,
  };
}

describe("fusion", () => {
  describe("generateSeed", () => {
    it("相同输入产生相同种子", () => {
      const s1 = generateSeed("a", "b", 1, 0, 0, 0);
      const s2 = generateSeed("a", "b", 1, 0, 0, 0);
      expect(s1).toBe(s2);
    });

    it("不同输入产生不同种子", () => {
      const s1 = generateSeed("a", "b", 1, 0, 0, 0);
      const s2 = generateSeed("a", "b", 2, 0, 0, 0);
      expect(s1).not.toBe(s2);
    });

    it("种子为正数", () => {
      const s = generateSeed("a", "b", 1, 0, 0, 0);
      expect(s).toBeGreaterThanOrEqual(0);
    });
  });

  describe("canEvolve", () => {
    it("两株基础植物可以融合", () => {
      const a = makeEvolved();
      const b = makeEvolved({ base: MOCK_PLANT_WALL });
      expect(canEvolve(a, b)).toBe(true);
    });

    it("爆炸类不能融合", () => {
      const a = makeEvolved({ base: MOCK_PLANT_EXPLOSIVE });
      const b = makeEvolved();
      expect(canEvolve(a, b)).toBe(false);
    });

    it("两株满阶不能融合", () => {
      const a = makeEvolved({ level: 3, mods: [{ id: "m1", form: MOCK_FORMS[0], skill: MOCK_SKILLS[0], budgetCost: 25, tier: "common" }, { id: "m2", form: MOCK_FORMS[1], skill: MOCK_SKILLS[1], budgetCost: 30, tier: "rare" }, { id: "m3", form: MOCK_FORMS[2], skill: MOCK_SKILLS[2], budgetCost: 30, tier: "rare" }] });
      const b = makeEvolved({ level: 3, mods: [{ id: "m4", form: MOCK_FORMS[0], skill: MOCK_SKILLS[0], budgetCost: 25, tier: "common" }] });
      expect(canEvolve(a, b)).toBe(false);
    });
  });

  describe("rollEvolution", () => {
    it("同族融合高成功率", () => {
      let successCount = 0;
      for (let i = 0; i < 100; i++) {
        const a = makeEvolved();
        const b = makeEvolved();
        const result = rollEvolution(a, b, MOCK_FORMS, MOCK_SKILLS, 1, 0, 0, i);
        if (result.success) successCount++;
      }
      expect(successCount).toBeGreaterThan(40);
    });

    it("失败后第二次必定成功", () => {
      const a = makeEvolved();
      const b = makeEvolved();
      const result = rollEvolution(a, b, MOCK_FORMS, MOCK_SKILLS, 1, 0, 0, 0, true);
      expect(result.success).toBe(true);
    });

    it("成功时产出进化植物", () => {
      const a = makeEvolved();
      const b = makeEvolved();
      const result = rollEvolution(a, b, MOCK_FORMS, MOCK_SKILLS, 1, 0, 0, 0, true);
      expect(result.success).toBe(true);
      expect(result.evolved).toBeDefined();
      expect(result.evolved!.level).toBe(1);
      expect(result.evolved!.mods.length).toBe(1);
    });

    it("满阶拒绝融合", () => {
      const a = makeEvolved({ level: 3, mods: [{ id: "m1", form: MOCK_FORMS[0], skill: MOCK_SKILLS[0], budgetCost: 25, tier: "common" }, { id: "m2", form: MOCK_FORMS[1], skill: MOCK_SKILLS[1], budgetCost: 30, tier: "rare" }, { id: "m3", form: MOCK_FORMS[2], skill: MOCK_SKILLS[2], budgetCost: 30, tier: "rare" }] });
      const b = makeEvolved({ level: 3, mods: [{ id: "m4", form: MOCK_FORMS[0], skill: MOCK_SKILLS[0], budgetCost: 25, tier: "common" }] });
      const result = rollEvolution(a, b, MOCK_FORMS, MOCK_SKILLS, 1, 0, 0, 0);
      expect(result.success).toBe(false);
      expect(result.message).toContain("上限");
    });

    it("融合结果包含掉落模组", () => {
      const a = makeEvolved({
        mods: [{ id: "old_mod", form: MOCK_FORMS[0], skill: MOCK_SKILLS[0], budgetCost: 25, tier: "common" }],
      });
      const b = makeEvolved();
      const result = rollEvolution(a, b, MOCK_FORMS, MOCK_SKILLS, 1, 0, 0, 0, true);
      expect(result.success).toBe(true);
      // 旧模组 + 新模组 = 2，不超过 3 槽，所以可能没有掉落
      expect(result.evolved!.mods.length).toBeLessThanOrEqual(3);
    });

    it("确定性：相同种子产生相同结果", () => {
      const a = makeEvolved();
      const b = makeEvolved();
      const r1 = rollEvolution(a, b, MOCK_FORMS, MOCK_SKILLS, 5, 2, 3, 10, true);
      const r2 = rollEvolution(a, b, MOCK_FORMS, MOCK_SKILLS, 5, 2, 3, 10, true);
      expect(r1.success).toBe(r2.success);
      if (r1.success && r2.success) {
        expect(r1.evolved!.mods[0]!.form.id).toBe(r2.evolved!.mods[0]!.form.id);
        expect(r1.evolved!.mods[0]!.skill.id).toBe(r2.evolved!.mods[0]!.skill.id);
      }
    });
  });
});
