import { describe, expect, it } from "vitest";
import { rollFusion, canFuse, FUSION_FORBIDDEN, CHAOS_CHANCE, type MutantSkill } from "../src/systems/Fusion";

/**
 * 确定性 rand 注入：rollFusion 的调用顺序为：
 *  1. 专属配方查表（确定性，不消耗 rand）
 *  2. 同族进化/同类（rand1=tier → rand2=label → rand3-5=属性）
 *  3. 异类无配方：rand1=混沌判定 → rand2=基底选择 → rand3=tier → rand4=label → rand5-7=属性
 * （纯函数以 rand 顺序联动，seed 需按此校准）
 */
function seeded(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("rollFusion · 专属怪物配方（确定性）", () => {
  const recipes: [string, string, MutantSkill, string][] = [
            ["peashooter", "snowpea", "slow", "snowpea"],
            ["peashooter", "fireflower", "burn", "peashooter"],
            ["chomper", "wallnut", "stun", "chomper"],
            ["repeater", "wintermelon", "explode", "wintermelon"],
            ["snowpea", "threepeater", "rapidfire", "threepeater"],
            ["repeater", "threepeater", "rapidfire", "threepeater"],
            ["repeater", "snowpea", "slow", "repeater"],
          ];

  it.each(recipes)("%s+%s → 命名怪物(%s / skill=%s)", (a, b, skill, kind) => {
    const r = rollFusion(a as never, b as never, seeded(0.1, 0.1, 0.1, 0.1, 0.1));
    expect(r.kind).toBe(kind);
    expect(r.variant.isMonster).toBe(true);
    expect(r.variant.skill).toBe(skill);
    expect(r.variant.tier).toBe("super");
    expect(r.variant.fused).toBe(true);
  });

  it("配方双向命中（顺序无关）", () => {
    const both = [rollFusion("snowpea", "peashooter"), rollFusion("peashooter", "snowpea")];
    expect(both[0].kind).toBe(both[1].kind);
    expect(both[0].variant.skill).toBe(both[1].variant.skill);
  });
});

describe("rollFusion · 同族进化（同类）", () => {
  it("pea+pea → repeater，tier 弱化不变(deterministic kind)", () => {
    const r = rollFusion("peashooter", "peashooter", seeded(0.1, 0.1, 0.5, 0.5, 0.5));
    expect(r.kind).toBe("repeater");
    expect(r.variant.tier).toBe("weak");
    expect(r.variant.fused).toBe(true);
  });

  it("wallnut+wallnut → tallnut（同类进阶）", () => {
    const r = rollFusion("wallnut", "wallnut", seeded(0.9, 0.5, 0.5, 0.5, 0.5));
    expect(r.kind).toBe("tallnut");
    expect(r.variant.tier).toBe("super");
    expect(r.variant.atkMul).toBeGreaterThanOrEqual(2.4);
  });

  it("tallnut+wallnut 异类但亲属 → tallnut 进化", () => {
    const r = rollFusion("tallnut", "wallnut", seeded(0.5, 0.5, 0.5, 0.5, 0.5));
    expect(r.kind).toBe("tallnut");
    expect(r.variant.tier).toBe("normal");
  });
});

describe("rollFusion · 异类无配方：继承基底 + 属性 roll", () => {
  // peashooter+wallnut 不在配方表，作为通用异类样本
  it("tier 由 rand2 决定（0.1→weak）", () => {
    // rand1 混沌(0.3 不触发，因为0.3>0.25) → rand2 基底(0.1<0.5→peashooter) → rand3 tier(0.1→weak)
    const r = rollFusion("peashooter", "wallnut", seeded(0.3, 0.1, 0.1, 0.5, 0.5, 0.5, 0.5));
    expect(r.kind).toBe("peashooter");
    expect(r.variant.tier).toBe("weak");
    expect(r.variant.atkMul).toBeLessThan(1);
    expect(r.variant.hpMul).toBeLessThan(1);
    expect(r.variant.rateMul).toBeGreaterThan(1);
  });

  it("随机基底 50/50 继承", () => {
    const r1 = rollFusion("peashooter", "wallnut", seeded(0.3, 0.2, 0.7, 0.5, 0.5, 0.5, 0.5));
    expect(r1.kind).toBe("peashooter");
    const r2 = rollFusion("peashooter", "wallnut", seeded(0.3, 0.8, 0.7, 0.5, 0.5, 0.5, 0.5));
    expect(r2.kind).toBe("wallnut");
  });

  it("非同族异类融合不加同族纯度奖励（沿用原始区间）", () => {
    const r = rollFusion("wallnut", "repeater", seeded(0.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
    expect(r.variant.atkMul).toBeGreaterThanOrEqual(1.3);
    expect(r.variant.atkMul).toBeLessThanOrEqual(1.8);
  });
});

describe("rollFusion · 混沌随变", () => {
  it("10% 触发：rand1<0.1 产出随机物种怪物（含爆炸类）", () => {
    // 混沌：rand1=0.05(<0.1) → rand2 池索引0 → cherrybomb；rand3 tier(0.1→super)
    const r = rollFusion("peashooter", "wallnut", seeded(0.05, 0, 0.1, 0.5, 0.5, 0.5));
    expect(r.variant.isMonster).toBe(true);
    expect(r.kind).toBe("cherrybomb");
    expect(r.variant.tier).toBe("super");
  });

  it("混沌怪物带强随机属性且 fused", () => {
    const r = rollFusion("peashooter", "wallnut", seeded(0.05, 0.8, 0.5, 0.3, 0.5, 0.5));
    expect(r.variant.fused).toBe(true);
    expect(r.variant.isMonster).toBe(true);
    expect(r.variant.atkMul).toBeGreaterThanOrEqual(1.8);
  });

  it("CHAOS_CHANCE 恒为 0.25", () => {
    expect(CHAOS_CHANCE).toBe(0.25);
  });

  it("混沌可突破禁融合产出爆炸类（cherrybomb 不再被拒于结果之外）", () => {
    const r = rollFusion("peashooter", "wallnut", seeded(0.05, 0, 1, 0.5, 0.5, 0.5));
    expect(FUSION_FORBIDDEN.has(r.kind)).toBe(true);
  });
});

describe("canFuse / FUSION_FORBIDDEN", () => {
  it("同类与非禁异类均可融合", () => {
    expect(canFuse("peashooter", "peashooter")).toBe(true);
    expect(canFuse("threepeater", "chomper")).toBe(true);
    expect(canFuse("wintermelon", "snowpea")).toBe(true);
  });

  it("禁融合种类（cherrybomb/potatomine）不可融合", () => {
    expect(FUSION_FORBIDDEN.has("cherrybomb")).toBe(true);
    expect(FUSION_FORBIDDEN.has("potatomine")).toBe(true);
    expect(canFuse("cherrybomb", "peashooter")).toBe(false);
    expect(canFuse("potatomine", "wintermelon")).toBe(false);
  });

  it("弱化 atkMul 有下界", () => {
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = rollFusion("wallnut", "repeater", seeded(0.6, 0.3, 0.05, 0.1, i / 10, 0.5, 0.5));
      results.push(r.variant.atkMul);
    }
    expect(Math.min(...results)).toBeGreaterThanOrEqual(0.55);
  });
});