// 模组生成器：从 form + skill 自动生成 Mod 实例
// 纯逻辑，无 Phaser 依赖

import type { FormDef, SkillDef, Mod, FormTier } from "../types/dictionaries";

// ─── 预算消耗映射 ───

const BUDGET_COST: Record<FormTier, number> = {
  common: 25,
  rare: 30,
  epic: 35,
  legendary: 40,
};

// ─── 公共接口 ───

/**
 * 从形态和技能生成模组实例
 */
export function generateMod(form: FormDef, skill: SkillDef): Mod {
  const tier = getModTier(form.tier, skill.tier);
  const budgetCost = BUDGET_COST[tier] + getStatDeviationCost(form);

  return {
    id: `${form.id}_${skill.id}`,
    form,
    skill,
    budgetCost: Math.round(budgetCost),
    tier,
  };
}

/**
 * 计算形态的属性偏离成本
 * 偏离度越高，预算消耗越大
 */
function getStatDeviationCost(form: FormDef): number {
  const { attack, health, speed } = form.statMultipliers;
  const deviation = Math.abs(attack - 1) + Math.abs(health - 1) + Math.abs(speed - 1);
  return deviation * 5;
}

/**
 * 根据形态和技能的 tier 确定模组 tier
 */
function getModTier(formTier: FormTier, skillTier: FormTier): FormTier {
  const tierOrder: FormTier[] = ["common", "rare", "epic", "legendary"];
  const formIdx = tierOrder.indexOf(formTier);
  const skillIdx = tierOrder.indexOf(skillTier);
  const avg = (formIdx + skillIdx) / 2;
  const rounded = Math.round(avg);
  return tierOrder[Math.min(rounded, tierOrder.length - 1)]!;
}
