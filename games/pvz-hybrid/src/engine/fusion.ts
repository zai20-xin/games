// 融合引擎：字典驱动 + 进化槽位 + 亲和度加权随机 + 动态配方
// 纯逻辑，无 Phaser 依赖

import type {
  FormDef,
  SkillDef,
  EvolvedPlant,
  FusionResult,
} from "../types/dictionaries";
import {
  getSuccessRate,
  getFormWeights,
  getSkillWeights,
} from "./affinity";
import { generateMod } from "./modGenerator";
import {
  compressToBudget,
  calculateDpsMultiplier,
  getDpsLimit,
} from "./balance";

// ─── 常量 ───

const MAX_MODS = 3;

// ─── 动态配方 ───

export interface DynamicRecipe {
  id: string;
  baseA: string;
  baseB: string;
  requiredWave: number;
  requiredKills: number;
  result: {
    kind: string;
    skill: string;
    form: string;
  };
  bonusEffect?: string;
}

const DYNAMIC_RECIPES: DynamicRecipe[] = [
  {
    id: "fire_ice_fusion",
    baseA: "peashooter",
    baseB: "snowpea",
    requiredWave: 3,
    requiredKills: 20,
    result: { kind: "peashooter", skill: "burn", form: "flame" },
    bonusEffect: "fire_ice_explosion",
  },
  {
    id: "triple_threat",
    baseA: "repeater",
    baseB: "threepeater",
    requiredWave: 7,
    requiredKills: 80,
    result: { kind: "threepeater", skill: "pierce", form: "laser" },
    bonusEffect: "triple_laser",
  },
  {
    id: "shadow_vine",
    baseA: "chomper",
    baseB: "potato",
    requiredWave: 4,
    requiredKills: 30,
    result: { kind: "chomper", skill: "stun", form: "drone" },
    bonusEffect: "shadow_bite",
  },
  {
    id: "frost_storm",
    baseA: "wintermelon",
    baseB: "snowpea",
    requiredWave: 6,
    requiredKills: 60,
    result: { kind: "wintermelon", skill: "slow", form: "ice" },
    bonusEffect: "blizzard",
  },
  {
    id: "iron_wall",
    baseA: "wallnut",
    baseB: "cactus",
    requiredWave: 4,
    requiredKills: 35,
    result: { kind: "wallnut", skill: "thorns", form: "ice" },
    bonusEffect: "iron_bark",
  },
  {
    id: "death_bloom",
    baseA: "chomper",
    baseB: "potato",
    requiredWave: 5,
    requiredKills: 45,
    result: { kind: "chomper", skill: "knockback", form: "lightning" },
    bonusEffect: "death_bloom",
  },
  {
    id: "air_defense",
    baseA: "cactus",
    baseB: "spikeweed",
    requiredWave: 4,
    requiredKills: 25,
    result: { kind: "cactus", skill: "pierce", form: "air" },
    bonusEffect: "air_burst",
  },
  {
    id: "fire_storm",
    baseA: "fireflower",
    baseB: "jalapeno",
    requiredWave: 6,
    requiredKills: 60,
    result: { kind: "fireflower", skill: "explode", form: "flame" },
    bonusEffect: "fire_storm",
  },
];

function findDynamicRecipe(
  baseA: string,
  baseB: string,
  wave: number,
  killed: number
): DynamicRecipe | null {
  for (const recipe of DYNAMIC_RECIPES) {
    const matchesA =
      (recipe.baseA === baseA && recipe.baseB === baseB) ||
      (recipe.baseA === baseB && recipe.baseB === baseA);
    if (matchesA && wave >= recipe.requiredWave && killed >= recipe.requiredKills) {
      return recipe;
    }
  }
  return null;
}

function applyDynamicRecipe(
  recipe: DynamicRecipe,
  plantA: EvolvedPlant,
  plantB: EvolvedPlant,
  forms: FormDef[],
  skills: SkillDef[]
): FusionResult {
  const form = forms.find((f) => f.id === recipe.result.form) ?? forms[0]!;
  const skill = skills.find((s) => s.id === recipe.result.skill) ?? skills[0]!;

  const newMod = generateMod(form, skill);

  const allMods = [...plantA.mods, ...plantB.mods, newMod];
  const sortedMods = allMods
    .sort((a, b) => {
      const tierOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
      const tierDiff = (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
      if (tierDiff !== 0) return tierDiff;
      return b.budgetCost - a.budgetCost;
    })
    .slice(0, MAX_MODS);

  const newLevel = Math.min(3, Math.max(plantA.level, plantB.level) + 1) as 0 | 1 | 2 | 3;
  const compressedMods = compressToBudget(sortedMods, newLevel);

  const evolved: EvolvedPlant = {
    base: plantA.base,
    mods: compressedMods,
    level: newLevel,
  };

  return {
    success: true,
    evolved,
    message: `动态配方激活: ${recipe.id}`,
    bonusEffect: recipe.bonusEffect,
  };
}

// ─── 种子生成 ───

/**
 * 基于上下文生成确定性种子
 * 同样的输入 + 上下文 = 同样的种子 → 可复现
 */
export function generateSeed(
  aId: string,
  bId: string,
  wave: number,
  row: number,
  col: number,
  fuseCount: number
): number {
  let hash = 0;
  const str = `${aId}:${bId}:${wave}:${row}:${col}:${fuseCount}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * 从种子生成伪随机数生成器
 */
function createRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

// ─── 加权随机抽取 ───

function weightedPick<T>(
  items: T[],
  weights: number[],
  rand: () => number
): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = rand() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

// ─── 形态-技能亲和度 ───

/** 每种形态偏好的技能 ID → 权重加成 */
const FORM_SKILL_AFFINITY: Record<string, Record<string, number>> = {
  flame:     { explode: 1.8, burn: 1.7, rapidfire: 1.5, knockback: 1.3 },
  ice:       { slow: 1.8, pierce: 1.5, knockback: 1.4, thorns: 1.3 },
  lightning: { bounce: 1.7, rapidfire: 1.5, stun: 1.4, pierce: 1.3 },
  laser:     { pierce: 1.8, bounce: 1.5, rapidfire: 1.4, burn: 1.3 },
  missile:   { explode: 1.8, knockback: 1.5, burn: 1.4, rapidfire: 1.3 },
  drone:     { stun: 1.6, regen: 1.5, explode: 1.4, thorns: 1.3 },
  air:       { pierce: 2.0, rapidfire: 1.5, bounce: 1.3 },
  base:      {},
};

/** 获取形态对技能的亲和度加成 */
function getFormSkillAffinity(formId: string, skillId: string): number {
  return FORM_SKILL_AFFINITY[formId]?.[skillId] ?? 1;
}

// ─── 核心融合函数 ───

/**
 * 执行融合
 * @param plantA - 第一株植物（可为基础植物或进化植物）
 * @param plantB - 第二株植物（可为基础植物或进化植物）
 * @param forms - 形态字典
 * @param skills - 技能字典
 * @param wave - 当前波数
 * @param row - 格子行
 * @param col - 格子列
 * @param fuseCount - 已融合次数（用于种子）
 * @param failedBefore - 之前是否融合失败过（第二次必定成功）
 * @param killed - 当前击杀数（动态配方判定用）
 */
export function rollEvolution(
  plantA: EvolvedPlant,
  plantB: EvolvedPlant,
  forms: FormDef[],
  skills: SkillDef[],
  wave: number,
  row: number,
  col: number,
  fuseCount: number,
  failedBefore: boolean = false,
  killed: number = 0
): FusionResult {
  // 0. 槽位检查
  const totalSlots = plantA.mods.length + plantB.mods.length;
  if (totalSlots >= MAX_MODS && plantA.level >= 3 && plantB.level >= 3) {
    return { success: false, message: "进化已达上限，无法融合" };
  }

  if (totalSlots > MAX_MODS) {
    return { success: false, message: "进化等级过高，无法融合" };
  }

  // 1. 动态配方优先：满足波次 + 击杀条件时触发特殊融合
  const dynamicRecipe = findDynamicRecipe(plantA.base.id, plantB.base.id, wave, killed);
  if (dynamicRecipe) {
    return applyDynamicRecipe(dynamicRecipe, plantA, plantB, forms, skills);
  }

  // 2. 生成种子并判定成功/失败
  const seed = generateSeed(
    plantA.base.id,
    plantB.base.id,
    wave,
    row,
    col,
    fuseCount
  );
  const rand = createRng(seed);
  const successRate = getSuccessRate(plantA.base.family, plantB.base.family);

  // 首次失败后第二次必定成功
  if (!failedBefore && rand() > successRate) {
    return { success: false, message: "融合失败，植物保留" };
  }

  // 3. 抽取形态
  const formWeights = getFormWeights(plantA.base.family, plantB.base.family);
  const baseFormWeights = forms.map((f) => {
    const base = f.id === "base" ? 0.3 : 0.14;
    return base * (formWeights[f.id] ?? 1);
  });
  const form = weightedPick(forms, baseFormWeights, rand);

  // 4. 抽取技能（形态感知：形态亲和度加成 40% 权重）
  const skillWeights = getSkillWeights(plantA.base.family, plantB.base.family);
  const AFFINITY_BLEND = 0.4; // 形态亲和度影响占比
  const baseSkillWeights = skills.map((s) => {
    const baseW = 0.125 * (skillWeights[s.id] ?? 1);
    const affinityW = getFormSkillAffinity(form.id, s.id);
    return baseW * (1 - AFFINITY_BLEND) + baseW * affinityW * AFFINITY_BLEND;
  });
  const skill = weightedPick(skills, baseSkillWeights, rand);

  // 5. 生成新模组
  const newMod = generateMod(form, skill);

  // 6. 合并所有模组并排序
  const allMods = [...plantA.mods, ...plantB.mods, newMod];
  const sortedMods = allMods
    .sort((a, b) => {
      const tierOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
      const tierDiff = (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0);
      if (tierDiff !== 0) return tierDiff;
      return b.budgetCost - a.budgetCost;
    })
    .slice(0, MAX_MODS);

  // 7. 淘汰机制
  const keptIds = new Set(sortedMods.map((m) => m.id));
  const droppedMods = allMods.filter((m) => !keptIds.has(m.id));

  // 8. 预算压缩
  const newLevel = Math.min(3, Math.max(plantA.level, plantB.level) + 1) as 0 | 1 | 2 | 3;
  const compressedMods = compressToBudget(sortedMods, newLevel);

  // 9. 构建进化植物
  const evolved: EvolvedPlant = {
    base: plantA.base, // 继承第一株植物的基础
    mods: compressedMods,
    level: newLevel,
  };

  // 10. 验证 DPS 上限
  const dpsMul = calculateDpsMultiplier(compressedMods);
  const dpsLimit = getDpsLimit(newLevel);
  if (dpsMul > dpsLimit * 1.15) {
    // 允许 15% 容差
    return {
      success: false,
      message: `DPS 超限: ${dpsMul} > ${dpsLimit}`,
    };
  }

  return {
    success: true,
    evolved,
    droppedMods,
    message: `融合成功: ${form.name} + ${skill.name}`,
  };
}

/**
 * 检查两个植物是否可以融合
 */
export function canEvolve(a: EvolvedPlant, b: EvolvedPlant): boolean {
  // 爆炸类禁融合
  if (a.base.family === "explosive" || b.base.family === "explosive") {
    return false;
  }

  // 满阶检查
  if (a.level >= 3 && b.level >= 3) {
    return false;
  }

  // 槽位检查
  if (a.mods.length + b.mods.length > MAX_MODS) {
    return false;
  }

  return true;
}
