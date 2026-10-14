// 进化融合系统类型定义
// 所有字典接口 + 融合结果 + 进化植物

// ─── 家族标签 ───

export type PlantFamily =
  | "shooter"
  | "wall"
  | "melee"
  | "aoe"
  | "explosive";

// ─── 字典1：基础植物 ───

export interface PlantDef {
  id: string;
  name: string;
  family: PlantFamily;
  baseStats: {
    attack: number;
    health: number;
    speed: number;
  };
  cost: number;
  texture: string;
}

// ─── 字典2：进化形态 ───

export type FormTier = "common" | "rare" | "epic" | "legendary";

export interface FormDef {
  id: string;
  name: string;
  tier: FormTier;
  statMultipliers: {
    attack: number;
    health: number;
    speed: number;
  };
  projectile: string;
  attackStyle: string;
  texture: string;
}

// ─── 字典3：进化技能 ───

export type SkillTier = "common" | "rare" | "epic" | "legendary";

export type SkillEffect =
  | { type: "slow"; factor: number; durationMs: number }
  | { type: "stun"; chance: number; durationMs: number }
  | { type: "knockback"; distance: number; chance: number }
  | { type: "pierce"; maxTargets: number; damageDecay: number }
  | { type: "bounce"; bounces: number; range: number; damageDecay: number }
  | { type: "rapidfire"; count: number; delayMs: number }
  | { type: "explode"; radius: number; damageRate: number }
  | { type: "burn"; damagePerTick: number; ticks: number; tickMs: number }
  | { type: "thorns"; pulseMs: number; range: number; damageRate: number }
  | { type: "regen"; healPerTick: number; tickMs: number };

export interface SkillDef {
  id: string;
  name: string;
  tier: SkillTier;
  effect: SkillEffect;
  costRate: number;
}

// ─── 字典4：传说预设组合 ───

export interface ComboDef {
  id: string;
  name: string;
  requires: {
    plants: string[];
    form?: string;
    skill?: string;
  };
  tier: "legendary";
  specialEffect: string;
  unlockCondition?: string;
}

// ─── 进化模组 ───

export interface Mod {
  id: string;
  form: FormDef;
  skill: SkillDef;
  budgetCost: number;
  tier: FormTier;
}

// ─── 进化植物 ───

export interface EvolvedPlant {
  base: PlantDef;
  mods: Mod[];
  level: 0 | 1 | 2 | 3;
}

// ─── 亲和度 ───

export type AffinityLevel = "same" | "complement" | "mixed" | "clash";

export interface AffinityRule {
  families: [PlantFamily, PlantFamily];
  level: AffinityLevel;
  successRate: number;
  formWeights: Record<string, number>;
  skillWeights: Record<string, number>;
}

// ─── 融合结果 ───

export interface FusionResult {
  success: boolean;
  evolved?: EvolvedPlant;
  droppedMods?: Mod[];
  message: string;
  bonusEffect?: string;
}

// ─── 战力预算 ───

export interface BudgetConfig {
  baseBudget: number;
  budgetPerLevel: number;
  maxBudget: number;
}

// ─── 校验错误 ───

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}
