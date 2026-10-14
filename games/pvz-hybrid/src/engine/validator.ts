// 数据校验模块：启动时检查字典数据完整性
// 纯逻辑，无 Phaser 依赖

import type { PlantDef, FormDef, SkillDef, ComboDef, ValidationError } from "../types/dictionaries";

// ─── 数值范围常量 ───

const STAT_MIN = 0.3;
const STAT_MAX = 3.0;
const COST_RATE_MIN = 0.5;
const COST_RATE_MAX = 1.5;

// ─── 公共接口 ───

/**
 * 校验所有字典数据
 * 返回错误列表，空数组表示通过
 */
export function validateDictionaries(
  plants: PlantDef[],
  forms: FormDef[],
  skills: SkillDef[],
  combos: ComboDef[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  errors.push(...checkUniqueIds(plants, forms, skills, combos));
  errors.push(...checkPlantFamilies(plants));
  errors.push(...checkFormStats(forms));
  errors.push(...checkSkillCostRates(skills));
  errors.push(...checkComboReferences(plants, forms, skills, combos));
  errors.push(...checkBudgetBalance(forms, skills));

  return errors;
}

// ─── 校验函数 ───

/**
 * 检查 ID 唯一性
 */
function checkUniqueIds(
  plants: PlantDef[],
  forms: FormDef[],
  skills: SkillDef[],
  combos: ComboDef[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const ids = new Set<string>();
  const dupes: string[] = [];

  for (const p of plants) {
    if (ids.has(p.id)) dupes.push(p.id);
    ids.add(p.id);
  }
  for (const f of forms) {
    if (ids.has(f.id)) dupes.push(f.id);
    ids.add(f.id);
  }
  for (const s of skills) {
    if (ids.has(s.id)) dupes.push(s.id);
    ids.add(s.id);
  }

  if (dupes.length > 0) {
    errors.push({
      field: "ids",
      message: `重复ID: ${dupes.join(", ")}`,
      severity: "error",
    });
  }

  return errors;
}

/**
 * 检查植物家族标签
 */
function checkPlantFamilies(plants: PlantDef[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const validFamilies = new Set(["shooter", "wall", "melee", "aoe", "explosive"]);

  for (const p of plants) {
    if (!validFamilies.has(p.family)) {
      errors.push({
        field: `plant:${p.id}.family`,
        message: `无效家族: ${p.family}`,
        severity: "error",
      });
    }
  }

  return errors;
}

/**
 * 检查形态数值范围
 */
function checkFormStats(forms: FormDef[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const f of forms) {
    const { attack, health, speed } = f.statMultipliers;
    const deviation = Math.abs(attack - 1) + Math.abs(health - 1) + Math.abs(speed - 1);

    if (attack < STAT_MIN || attack > STAT_MAX) {
      errors.push({
        field: `form:${f.id}.attack`,
        message: `攻击系数异常: ${attack}`,
        severity: "error",
      });
    }
    if (health < STAT_MIN || health > STAT_MAX) {
      errors.push({
        field: `form:${f.id}.health`,
        message: `生命系数异常: ${health}`,
        severity: "error",
      });
    }
    if (speed < STAT_MIN || speed > STAT_MAX) {
      errors.push({
        field: `form:${f.id}.speed`,
        message: `速度系数异常: ${speed}`,
        severity: "error",
      });
    }
    if (deviation > 2.0) {
      errors.push({
        field: `form:${f.id}`,
        message: `总偏离度过高: ${deviation.toFixed(2)}`,
        severity: "warning",
      });
    }
  }

  return errors;
}

/**
 * 检查技能代价系数
 */
function checkSkillCostRates(skills: SkillDef[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const s of skills) {
    if (s.costRate < COST_RATE_MIN || s.costRate > COST_RATE_MAX) {
      errors.push({
        field: `skill:${s.id}.costRate`,
        message: `代价系数异常: ${s.costRate}`,
        severity: "error",
      });
    }
  }

  return errors;
}

/**
 * 检查传说组合引用完整性
 */
function checkComboReferences(
  plants: PlantDef[],
  forms: FormDef[],
  skills: SkillDef[],
  combos: ComboDef[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const plantIds = new Set(plants.map((p) => p.id));
  const formIds = new Set(forms.map((f) => f.id));
  const skillIds = new Set(skills.map((s) => s.id));

  for (const c of combos) {
    for (const pid of c.requires.plants) {
      if (!plantIds.has(pid)) {
        errors.push({
          field: `combo:${c.id}.plants`,
          message: `引用不存在的植物: ${pid}`,
          severity: "error",
        });
      }
    }
    if (c.requires.form && !formIds.has(c.requires.form)) {
      errors.push({
        field: `combo:${c.id}.form`,
        message: `引用不存在的形态: ${c.requires.form}`,
        severity: "error",
      });
    }
    if (c.requires.skill && !skillIds.has(c.requires.skill)) {
      errors.push({
        field: `combo:${c.id}.skill`,
        message: `引用不存在的技能: ${c.requires.skill}`,
        severity: "error",
      });
    }
  }

  return errors;
}

/**
 * 检查预算平衡：所有 form+skill 组合的预算是否在合理范围
 */
function checkBudgetBalance(forms: FormDef[], skills: SkillDef[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const BUDGET_COST = { common: 25, rare: 30, epic: 35, legendary: 40 };

  for (const f of forms) {
    for (const s of skills) {
      const tierOrder = ["common", "rare", "epic", "legendary"];
      const avg =
        (tierOrder.indexOf(f.tier) + tierOrder.indexOf(s.tier)) / 2;
      const tier = tierOrder[Math.round(avg)] ?? "common";
      const budgetCost =
        (BUDGET_COST[tier as keyof typeof BUDGET_COST] ?? 25) +
        (Math.abs(f.statMultipliers.attack - 1) +
          Math.abs(f.statMultipliers.health - 1) +
          Math.abs(f.statMultipliers.speed - 1)) *
          5;

      if (budgetCost < 20 || budgetCost > 60) {
        errors.push({
          field: `budget:${f.id}+${s.id}`,
          message: `预算异常: ${budgetCost.toFixed(1)}`,
          severity: "warning",
        });
      }
    }
  }

  return errors;
}
