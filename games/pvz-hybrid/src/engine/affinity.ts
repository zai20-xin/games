// 亲和度计算模块
// 纯逻辑，无 Phaser 依赖

import type { PlantFamily, AffinityLevel, AffinityRule } from "../types/dictionaries";

// ─── 亲和度规则表 ───

const AFFINITY_RULES: AffinityRule[] = [
  // 同族
  { families: ["shooter", "shooter"], level: "same", successRate: 0.95, formWeights: { flame: 1.4, lightning: 1.3 }, skillWeights: { rapidfire: 1.5, bounce: 1.4 } },
  { families: ["wall", "wall"], level: "same", successRate: 0.95, formWeights: { ice: 1.4, drone: 1.3 }, skillWeights: { thorns: 1.5, regen: 1.4 } },
  { families: ["melee", "melee"], level: "same", successRate: 0.95, formWeights: { lightning: 1.5, flame: 1.3 }, skillWeights: { stun: 1.4, knockback: 1.3 } },
  { families: ["aoe", "aoe"], level: "same", successRate: 0.95, formWeights: { ice: 1.3, drone: 1.4 }, skillWeights: { explode: 1.5, bounce: 1.3 } },

  // 互补
  { families: ["shooter", "wall"], level: "complement", successRate: 0.80, formWeights: { ice: 1.5 }, skillWeights: { slow: 1.6, thorns: 1.3 } },
  { families: ["melee", "wall"], level: "complement", successRate: 0.80, formWeights: { lightning: 1.4, ice: 1.3 }, skillWeights: { knockback: 1.4, stun: 1.3 } },
  { families: ["aoe", "shooter"], level: "complement", successRate: 0.80, formWeights: { ice: 1.3, drone: 1.2 }, skillWeights: { explode: 1.4, bounce: 1.3 } },
  { families: ["aoe", "wall"], level: "complement", successRate: 0.80, formWeights: { ice: 1.4 }, skillWeights: { thorns: 1.5, regen: 1.3 } },

  // 混搭（默认）
  { families: ["shooter", "melee"], level: "mixed", successRate: 0.70, formWeights: {}, skillWeights: {} },
  { families: ["shooter", "aoe"], level: "mixed", successRate: 0.70, formWeights: {}, skillWeights: {} },
  { families: ["wall", "melee"], level: "mixed", successRate: 0.70, formWeights: {}, skillWeights: {} },
  { families: ["wall", "aoe"], level: "mixed", successRate: 0.70, formWeights: {}, skillWeights: {} },
  { families: ["melee", "aoe"], level: "mixed", successRate: 0.70, formWeights: {}, skillWeights: {} },
];

// ─── 默认亲和度（无匹配规则时） ───

const DEFAULT_AFFINITY: AffinityRule = {
  families: ["shooter", "shooter"],
  level: "mixed",
  successRate: 0.70,
  formWeights: {},
  skillWeights: {},
};

// ─── 公共接口 ───

/**
 * 获取两个家族之间的亲和度规则
 */
export function getAffinity(a: PlantFamily, b: PlantFamily): AffinityRule {
  const found = AFFINITY_RULES.find(
    (r) =>
      (r.families[0] === a && r.families[1] === b) ||
      (r.families[0] === b && r.families[1] === a)
  );
  return found ?? DEFAULT_AFFINITY;
}

/**
 * 获取亲和度等级（用于 UI 显示）
 */
export function getAffinityLevel(a: PlantFamily, b: PlantFamily): AffinityLevel {
  return getAffinity(a, b).level;
}

/**
 * 获取成功率
 */
export function getSuccessRate(a: PlantFamily, b: PlantFamily): number {
  return getAffinity(a, b).successRate;
}

/**
 * 获取形态抽取权重修正
 */
export function getFormWeights(a: PlantFamily, b: PlantFamily): Record<string, number> {
  return getAffinity(a, b).formWeights;
}

/**
 * 获取技能抽取权重修正
 */
export function getSkillWeights(a: PlantFamily, b: PlantFamily): Record<string, number> {
  return getAffinity(a, b).skillWeights;
}
