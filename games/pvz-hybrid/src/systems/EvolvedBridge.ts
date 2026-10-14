// EvolvedPlant → PlantVariant 桥接模块
// 将新引擎的 EvolvedPlant 数据转换为 Plant.ts 使用的 PlantVariant

import type { EvolvedPlant, Mod } from "../types/dictionaries";
import type { PlantVariant, MutantSkill } from "./Fusion";

// ─── 形态 ID → 弹丸类型映射 ───

const FORM_PROJECTILE: Record<string, string> = {
  base: "pea",
  flame: "fireball",
  ice: "axe",
  lightning: "chain",
  laser: "beam",
  missile: "missile",
  drone: "drone",
  air: "spike",
};

// ─── 技能 ID → MutantSkill 映射（兼容旧系统） ───

const SKILL_MAP: Record<string, MutantSkill> = {
  slow: "slow",
  stun: "stun",
  knockback: "knockback",
  pierce: "pierce",
  bounce: "bounce",
  rapidfire: "rapidfire",
  explode: "explode",
  burn: "burn",
  thorns: "thorns",
  regen: "regen",
};

// ─── 模组 tier → PlantVariant tier ───

const TIER_MAP: Record<string, "weak" | "normal" | "super"> = {
  common: "normal",
  rare: "normal",
  epic: "super",
  legendary: "super",
};

// ─── 公共接口 ───

/**
 * 从 EvolvedPlant 的 mods 计算攻击乘区
 * 注意：costRate 是阳光代价系数，不参与伤害计算（预算卡已控制总战力）
 */
export function calcAtkMul(mods: Mod[]): number {
  if (mods.length === 0) return 1;
  let mul = 1;
  for (const mod of mods) {
    mul *= mod.form.statMultipliers.attack;
  }
  return Math.round(mul * 100) / 100;
}

/**
 * 从 EvolvedPlant 的 mods 计算攻速乘区
 */
export function calcRateMul(mods: Mod[]): number {
  if (mods.length === 0) return 1;
  let mul = 1;
  for (const mod of mods) {
    mul *= mod.form.statMultipliers.speed;
  }
  return Math.round(mul * 100) / 100;
}

/**
 * 从 EvolvedPlant 的 mods 计算血量乘区
 */
export function calcHpMul(mods: Mod[]): number {
  if (mods.length === 0) return 1;
  let mul = 1;
  for (const mod of mods) {
    mul *= mod.form.statMultipliers.health;
  }
  return Math.round(mul * 100) / 100;
}

/**
 * 获取主要形态的弹丸类型
 */
export function getFormProjectile(mods: Mod[]): string {
  if (mods.length === 0) return "pea";
  // 取最高等级的形态
  const sorted = [...mods].sort((a, b) => {
    const tierOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
    return (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
  });
  return FORM_PROJECTILE[sorted[0]!.form.id] ?? "pea";
}

/**
 * 获取主要技能的 MutantSkill（兼容旧系统）
 */
export function getFormSkill(mods: Mod[]): MutantSkill | undefined {
  if (mods.length === 0) return undefined;
  const sorted = [...mods].sort((a, b) => {
    const tierOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
    return (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
  });
  return SKILL_MAP[sorted[0]!.skill.id];
}

/**
 * 获取主要形态的 ID
 */
export function getFormId(mods: Mod[]): string {
  if (mods.length === 0) return "base";
  const sorted = [...mods].sort((a, b) => {
    const tierOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
    return (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
  });
  return sorted[0]!.form.id;
}

/**
 * 获取主要技能的 ID
 */
export function getSkillId(mods: Mod[]): string | undefined {
  if (mods.length === 0) return undefined;
  const sorted = [...mods].sort((a, b) => {
    const tierOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
    return (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
  });
  return sorted[0]!.skill.id;
}

/**
 * 将 EvolvedPlant 转换为 PlantVariant（兼容旧 Plant.ts）
 */
export function toPlantVariant(evolved: EvolvedPlant): PlantVariant {
  const mods = evolved.mods;
  const topTier = mods.length > 0
    ? mods.reduce((best, m) => {
        const tierOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
        return (tierOrder[m.tier] ?? 0) > (tierOrder[best.tier] ?? 0) ? m : best;
      }).tier
    : "common";

  return {
    atkMul: calcAtkMul(mods),
    rateMul: calcRateMul(mods),
    hpMul: calcHpMul(mods),
    label: mods.length > 0 ? `${mods[0]!.form.name}·${mods[0]!.skill.name}` : "",
    tier: TIER_MAP[topTier] ?? "normal",
    fused: evolved.level > 0,
    isMonster: topTier === "legendary",
    skill: getFormSkill(mods),
    formId: getFormId(mods),
    skillId: getSkillId(mods),
  };
}

/**
 * 检查 EvolvedPlant 是否有指定技能
 */
export function hasSkill(evolved: EvolvedPlant, skillId: string): boolean {
  return evolved.mods.some((m) => m.skill.id === skillId);
}

/**
 * 检查 EvolvedPlant 是否有指定形态
 */
export function hasForm(evolved: EvolvedPlant, formId: string): boolean {
  return evolved.mods.some((m) => m.form.id === formId);
}
