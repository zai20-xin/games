import type { PlantKind } from "../config";

// 植物融合变异系统：随机 roll 出弱化/精锐/超强变体 + 专属怪物配方 + 混沌随变
// 纯逻辑无场景依赖，可单测

export type FusionTier = "weak" | "normal" | "super";

/** 随机属性加成类型 */
export interface RandomBonus {
  type: 'crit' | 'pierce' | 'splash' | 'slow' | 'speed' | 'damage';
  value: number;
  duration?: number; // 持续时间（毫秒），0表示永久
}

/** 随机加成生成函数：40%概率获得加成 */
export function rollRandomBonus(rand: () => number = Math.random): RandomBonus | null {
  // 40%概率获得加成（提高随机性）
  if (rand() > 0.4) return null;

  const types: RandomBonus['type'][] = ['crit', 'pierce', 'splash', 'slow', 'speed', 'damage'];
  const type = types[Math.floor(rand() * types.length)]!;

  // 根据类型生成不同的加成值
  let value: number;
  let duration: number | undefined;

  switch (type) {
    case 'crit':
      value = 0.15 + rand() * 0.25; // 15%-40%暴击率
      duration = 5000; // 5秒持续时间
      break;
    case 'pierce':
      value = 1 + Math.floor(rand() * 3); // 1-3次穿透
      break;
    case 'splash':
      value = 0.5 + rand() * 1.0; // 0.5-1.5溅射范围
      break;
    case 'slow':
      value = 0.3 + rand() * 0.4; // 30%-70%减速效果
      duration = 3000; // 3秒持续时间
      break;
    case 'speed':
      value = 0.8 + rand() * 0.4; // 80%-120%攻速（<1表示更快）
      break;
    case 'damage':
      value = 1.2 + rand() * 0.6; // 120%-180%伤害
      break;
    default:
      value = 1.0;
  }

  return { type, value, duration };
}

/** 专属融合怪物的战术技能（在 Plant.ts 按 id 分支实现 + GameScene 放大招特效） */
export type MutantSkill = "slow" | "stun" | "knockback" | "pierce" | "bounce" | "rapidfire" | "explode" | "burn" | "thorns" | "regen";

export interface PlantVariant {
  /** 攻击力乘区 */
  atkMul: number;
  /** 周期乘区：攻速/产阳间隔（<1 更快） */
  rateMul: number;
  /** 血量乘区 */
  hpMul: number;
  label: string;
  tier: FusionTier;
  /** 已融合标记：每株仅可融合一次 */
  fused: boolean;
  /** 专属怪物：携带独特战术技能 + 顶格大招特效 */
  isMonster?: boolean;
  skill?: MutantSkill;
  /** 进化形态 ID（用于形态弹丸和视觉效果） */
  formId?: string;
  /** 进化技能 ID（用于技能效果） */
  skillId?: string;
  /** 随机属性加成 */
  randomBonus?: RandomBonus;
}

export const FUSION_FORBIDDEN: ReadonlySet<PlantKind> = new Set(["cherrybomb", "potatomine"]);

const LABELS: Record<FusionTier, string[]> = {
  weak: ["凋零", "萎靡", "残缺"],
  normal: ["精锐", "迅捷", "强韧"],
  super: ["暴怒", "狂潮", "巨兽", "雷霆"],
};

/**
 * 专属融合怪物配方：特定跨物种组合产出具专属机制 + 顶格特效的命名怪物（确定性）
 * fusionKey 已按字母序归一，双向命中同一配方。
 */
interface Recipe {
  kind: PlantKind;
  skill: MutantSkill;
  name: string;
}

const RECIPES: Record<string, Recipe> = {
  "peashooter:snowpea": { kind: "snowpea", skill: "slow", name: "极寒冰痕" },
  "fireflower:peashooter": { kind: "peashooter", skill: "burn", name: "烈焰豌豆" },
  "chomper:wallnut": { kind: "chomper", skill: "stun", name: "钢铁巨颚" },
  "repeater:wintermelon": { kind: "wintermelon", skill: "explode", name: "暴雨冰瓜" },
  "snowpea:threepeater": { kind: "threepeater", skill: "rapidfire", name: "三重寒冰" },
  "repeater:threepeater": { kind: "threepeater", skill: "rapidfire", name: "极寒三线" },
  "repeater:snowpea": { kind: "repeater", skill: "slow", name: "寒冰连发" },
  "cactus:balloon": { kind: "cactus", skill: "pierce", name: "天空猎手" },
  "spikeweed:wallnut": { kind: "wallnut", skill: "thorns", name: "荆棘壁垒" },
  "fireflower:snowpea": { kind: "fireflower", skill: "burn", name: "冰火两重天" },
  "flakcannon:threepeater": { kind: "flakcannon", skill: "rapidfire", name: "三连炮" },
};

/** 同族进化：同类融合或特定亲属复合 → 确定进阶形态 */
const EVOLVE: Record<string, PlantKind> = {
  "peashooter:peashooter": "repeater",
  "repeater:peashooter": "repeater",
  "wallnut:wallnut": "tallnut",
  "tallnut:wallnut": "tallnut",
};

/** 混沌随变概率：异类无配方时小概率突变出完全不同的物种（含爆炸类） */
export const CHAOS_CHANCE = 0.25;

/** 混沌可选物种池：包含通常禁融合的爆炸类，制造"出其不意" */
const CHAOS_POOL: PlantKind[] = [
  "cherrybomb",
  "potatomine",
  "jalapeno",
  "peashooter",
  "snowpea",
  "repeater",
  "threepeater",
  "chomper",
  "wintermelon",
  "wallnut",
  "tallnut",
  "cactus",
  "spikeweed",
  "flakcannon",
  "cactusball",
  "fireflower",
];

export interface FusionResult {
  kind: PlantKind;
  variant: PlantVariant;
}

function fusionKey(a: PlantKind, b: PlantKind): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function monsterResult(kind: PlantKind, skill: MutantSkill, name: string, rand?: () => number): FusionResult {
  return {
    kind,
    variant: {
      atkMul: 1.6,
      rateMul: 0.8,
      hpMul: 1.8,
      label: name,
      tier: "super",
      fused: true,
      isMonster: true,
      skill,
      randomBonus: rollRandomBonus(rand) ?? undefined,
    },
  };
}

function chaosResult(rand: () => number): FusionResult {
  const kind = CHAOS_POOL[Math.floor(rand() * CHAOS_POOL.length)]!;
  const tier: FusionTier = rand() < 0.3 ? "super" : "normal";
  return {
    kind,
    variant: {
      atkMul: round2(1.8 + rand() * 0.8),
      rateMul: round2(0.6 + rand() * 0.3),
      hpMul: round2(1.6 + rand() * 0.6),
      label: tier === "super" ? "混沌暴走" : "混沌突变",
      tier,
      fused: true,
      isMonster: true,
      randomBonus: rollRandomBonus(rand) ?? undefined,
    },
  };
}

/**
 * 融合变异 roll：
 * - 专属配方 → 确定性命名怪物（带 skill + 顶格特效）
 * - 同族进化 → 确定进阶形态
 * - 异类无配方 → 10% 混沌随变（随机物种+强加成）；否则继承基底 + 属性 roll
 * - 属性 roll：20% 凋零、60% 精锐、20% 超强；同类 +0.2 同族纯度
 * - rand 可注入以便单测
 */
export function rollFusion(a: PlantKind, b: PlantKind, rand: () => number = Math.random): FusionResult {
  const key = fusionKey(a, b);

  // 专属怪物配方（确定性）
  const recipe = RECIPES[key];
  if (recipe) return monsterResult(recipe.kind, recipe.skill, recipe.name, rand);

  // 同族进化（确定性种类）
  const evolve = EVOLVE[key];
  const sameKind = a === b;
  if (evolve || sameKind) {
    const kind: PlantKind = evolve ?? a;
    const roll = rand();
    const bonus = 0.2;
    let tier: FusionTier;
    if (roll < 0.2) tier = "weak";
    else if (roll < 0.8) tier = "normal";
    else tier = "super";
    const labels = LABELS[tier];
    const label = labels[Math.floor(rand() * labels.length)]!;

    let atkMul: number;
    let rateMul: number;
    let hpMul: number;
    if (tier === "weak") {
      atkMul = 0.55 + rand() * 0.1 + bonus * 0.5;
      rateMul = 1.2 + rand() * 0.15;
      hpMul = 0.75 + rand() * 0.1;
    } else if (tier === "normal") {
      atkMul = 1.3 + rand() * 0.5 + bonus;
      rateMul = 0.75 + rand() * 0.2;
      hpMul = 1.2 + rand() * 0.3 + bonus * 0.5;
    } else {
      atkMul = 2.2 + rand() * 0.8 + bonus;
      rateMul = 0.55 + rand() * 0.15;
      hpMul = 2.0 + rand() * 0.5 + bonus * 0.5;
    }

    return {
      kind,
      variant: {
        atkMul: round2(atkMul),
        rateMul: round2(rateMul),
        hpMul: round2(hpMul),
        label,
        tier,
        fused: true,
        randomBonus: rollRandomBonus(rand) ?? undefined,
      },
    };
  }

  // 异类、无配方：混沌随变 or 继承基底
  if (rand() < CHAOS_CHANCE) return chaosResult(rand);
  const kind: PlantKind = rand() < 0.5 ? a : b;
  const roll = rand();
  let tier: FusionTier;
  if (roll < 0.2) tier = "weak";
  else if (roll < 0.8) tier = "normal";
  else tier = "super";
  const labels = LABELS[tier];
  const label = labels[Math.floor(rand() * labels.length)]!;

  let atkMul: number;
  let rateMul: number;
  let hpMul: number;
  if (tier === "weak") {
    atkMul = 0.55 + rand() * 0.1;
    rateMul = 1.2 + rand() * 0.15;
    hpMul = 0.75 + rand() * 0.1;
  } else if (tier === "normal") {
    atkMul = 1.3 + rand() * 0.5;
    rateMul = 0.75 + rand() * 0.2;
    hpMul = 1.2 + rand() * 0.3;
  } else {
    atkMul = 2.2 + rand() * 0.8;
    rateMul = 0.55 + rand() * 0.15;
    hpMul = 2.0 + rand() * 0.5;
  }

  return {
    kind,
    variant: {
      atkMul: round2(atkMul),
      rateMul: round2(rateMul),
      hpMul: round2(hpMul),
      label,
      tier,
      fused: true,
      randomBonus: rollRandomBonus(rand) ?? undefined,
    },
  };
}

/** 判断两个植物能否融合：只要不是禁融合种类即可融合 */
export function canFuse(a: PlantKind, b: PlantKind): boolean {
  return !FUSION_FORBIDDEN.has(a) && !FUSION_FORBIDDEN.has(b);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}