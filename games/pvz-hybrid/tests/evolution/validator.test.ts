import { describe, it, expect } from "vitest";
import { validateDictionaries } from "../../src/engine/validator";
import type { PlantDef, FormDef, SkillDef, ComboDef } from "../../src/types/dictionaries";

// ─── 测试辅助：创建 mock 数据 ───

const VALID_PLANTS: PlantDef[] = [
  { id: "peashooter", name: "豌豆", family: "shooter", baseStats: { attack: 20, health: 300, speed: 1 }, cost: 100, texture: "pea" },
  { id: "wallnut", name: "坚果", family: "wall", baseStats: { attack: 0, health: 4000, speed: 1 }, cost: 50, texture: "wall" },
];

const VALID_FORMS: FormDef[] = [
  { id: "base", name: "基础", tier: "common", statMultipliers: { attack: 1, health: 1, speed: 1 }, projectile: "pea", attackStyle: "原始", texture: "" },
  { id: "ice_armor", name: "冰甲", tier: "rare", statMultipliers: { attack: 0.8, health: 2, speed: 0.7 }, projectile: "ice", attackStyle: "减速", texture: "ice" },
];

const VALID_SKILLS: SkillDef[] = [
  { id: "multishot", name: "连射", tier: "common", effect: { type: "multishot", count: 2, damageRate: 0.6 }, costRate: 0.9 },
  { id: "shield", name: "护盾", tier: "epic", effect: { type: "shield", intervalMs: 10000, shieldHp: 200, damageRate: 0.7 }, costRate: 0.8 },
];

const VALID_COMBOS: ComboDef[] = [
  { id: "combo1", name: "测试组合", requires: { plants: ["peashooter"], form: "ice_armor", skill: "multishot" }, tier: "legendary", specialEffect: "测试" },
];

describe("validator", () => {
  describe("正常数据", () => {
    it("有效数据返回空数组", () => {
      const errors = validateDictionaries(VALID_PLANTS, VALID_FORMS, VALID_SKILLS, VALID_COMBOS);
      expect(errors).toHaveLength(0);
    });
  });

  describe("ID 重复", () => {
    it("检测植物重复 ID", () => {
      const dupes = [...VALID_PLANTS, { ...VALID_PLANTS[0]!, id: "peashooter" }];
      const errors = validateDictionaries(dupes, VALID_FORMS, VALID_SKILLS, []);
      expect(errors.some((e) => e.field === "ids")).toBe(true);
    });

    it("检测跨字典重复 ID", () => {
      const dupes = [...VALID_FORMS, { ...VALID_FORMS[0]!, id: "peashooter" }];
      const errors = validateDictionaries(VALID_PLANTS, dupes, VALID_SKILLS, []);
      expect(errors.some((e) => e.field === "ids")).toBe(true);
    });
  });

  describe("植物家族", () => {
    it("无效家族报错", () => {
      const bad = [{ ...VALID_PLANTS[0]!, family: "invalid" as const }];
      const errors = validateDictionaries(bad, VALID_FORMS, VALID_SKILLS, []);
      expect(errors.some((e) => e.field.includes("family"))).toBe(true);
    });
  });

  describe("形态数值", () => {
    it("攻击系数过低报错", () => {
      const bad = [{ ...VALID_FORMS[0]!, statMultipliers: { attack: 0.1, health: 1, speed: 1 } }];
      const errors = validateDictionaries(VALID_PLANTS, bad, VALID_SKILLS, []);
      expect(errors.some((e) => e.field.includes("attack"))).toBe(true);
    });

    it("攻击系数过高报错", () => {
      const bad = [{ ...VALID_FORMS[0]!, statMultipliers: { attack: 5, health: 1, speed: 1 } }];
      const errors = validateDictionaries(VALID_PLANTS, bad, VALID_SKILLS, []);
      expect(errors.some((e) => e.field.includes("attack"))).toBe(true);
    });

    it("总偏离度过高警告", () => {
      const bad = [{ ...VALID_FORMS[0]!, statMultipliers: { attack: 2.5, health: 2.5, speed: 2.5 } }];
      const errors = validateDictionaries(VALID_PLANTS, bad, VALID_SKILLS, []);
      expect(errors.some((e) => e.field.includes("base") && e.severity === "warning")).toBe(true);
    });
  });

  describe("技能代价", () => {
    it("代价系数异常报错", () => {
      const bad = [{ ...VALID_SKILLS[0]!, costRate: 0.1 }];
      const errors = validateDictionaries(VALID_PLANTS, VALID_FORMS, bad, []);
      expect(errors.some((e) => e.field.includes("costRate"))).toBe(true);
    });
  });

  describe("传说组合引用", () => {
    it("引用不存在的植物报错", () => {
      const bad = [{ ...VALID_COMBOS[0]!, requires: { plants: ["nonexistent"] } }];
      const errors = validateDictionaries(VALID_PLANTS, VALID_FORMS, VALID_SKILLS, bad);
      expect(errors.some((e) => e.message.includes("不存在的植物"))).toBe(true);
    });

    it("引用不存在的形态报错", () => {
      const bad = [{ ...VALID_COMBOS[0]!, requires: { plants: ["peashooter"], form: "nonexistent" } }];
      const errors = validateDictionaries(VALID_PLANTS, VALID_FORMS, VALID_SKILLS, bad);
      expect(errors.some((e) => e.message.includes("不存在的形态"))).toBe(true);
    });

    it("引用不存在的技能报错", () => {
      const bad = [{ ...VALID_COMBOS[0]!, requires: { plants: ["peashooter"], skill: "nonexistent" } }];
      const errors = validateDictionaries(VALID_PLANTS, VALID_FORMS, VALID_SKILLS, bad);
      expect(errors.some((e) => e.message.includes("不存在的技能"))).toBe(true);
    });
  });
});
