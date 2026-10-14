// 预算卡系统：控制融合体数值上限
// 纯逻辑，无 Phaser 依赖

import type { Mod, BudgetConfig } from "../types/dictionaries";

// ─── 预算配置 ───

const BUDGET_CONFIG: BudgetConfig = {
  baseBudget: 80,
  budgetPerLevel: 30,
  maxBudget: 170,
};

// ─── 公共接口 ───

/**
 * 获取当前层级的预算上限
 */
export function getBudgetLimit(level: number): number {
  return Math.min(
    BUDGET_CONFIG.baseBudget + level * BUDGET_CONFIG.budgetPerLevel,
    BUDGET_CONFIG.maxBudget
  );
}

/**
 * 计算模组列表的总预算消耗
 */
export function calculateTotalBudget(mods: Mod[]): number {
  return mods.reduce((sum, mod) => sum + mod.budgetCost, 0);
}

/**
 * 检查模组列表是否超出预算
 */
export function isOverBudget(mods: Mod[], level: number): boolean {
  return calculateTotalBudget(mods) > getBudgetLimit(level);
}

/**
 * 压缩模组的 statMultipliers 至预算线内
 * 返回压缩后的模组列表（新对象，不修改原数据）
 */
export function compressToBudget(mods: Mod[], level: number): Mod[] {
  const totalBudget = calculateTotalBudget(mods);
  const limit = getBudgetLimit(level);

  if (totalBudget <= limit) return mods;

  const ratio = limit / totalBudget;

  return mods.map((mod) => ({
    ...mod,
    form: {
      ...mod.form,
      statMultipliers: {
        attack: round2(1 + (mod.form.statMultipliers.attack - 1) * ratio),
        health: round2(1 + (mod.form.statMultipliers.health - 1) * ratio),
        speed: round2(1 + (mod.form.statMultipliers.speed - 1) * ratio),
      },
    },
    budgetCost: Math.round(mod.budgetCost * ratio),
  }));
}

/**
 * 计算最终 DPS 倍率（相对于基础植物）
 * 注意：costRate 是阳光代价系数，不参与 DPS 计算
 */
export function calculateDpsMultiplier(mods: Mod[]): number {
  if (mods.length === 0) return 1;

  let attackMul = 1;
  let speedMul = 1;

  for (const mod of mods) {
    attackMul *= mod.form.statMultipliers.attack;
    speedMul *= mod.form.statMultipliers.speed;
  }

  return round2(attackMul * speedMul);
}

/**
 * 获取理论 DPS 上限（相对于基础植物）
 */
export function getDpsLimit(level: number): number {
  const limits: Record<number, number> = {
    0: 1.0,
    1: 1.37,
    2: 1.75,
    3: 2.12,
  };
  return limits[level] ?? 1.0;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
