// 花园保卫战 · 全局数值唯一源
export const W = 720;
export const H = 1280;

export const COLS = 5;
/** 加长纵深：10 行，种 4 排仍有上方接敌空间 */
export const ROWS = 10;
export const CELL_W = 112;
export const CELL_H = 72;
export const LAWN_X = 56;
export const LAWN_Y = 92;
export const LAWN_W = COLS * CELL_W;
export const LAWN_H = ROWS * CELL_H;
export const LAWN_BOTTOM = LAWN_Y + LAWN_H;
export const HOME_Y = LAWN_BOTTOM + 10;
export const HUD_H = 88;
export const TRAY_Y = 900;
export const CARD_W = 118;
export const CARD_H = 148;

export type FlowerKind = "rose" | "daffodil" | "crabapple" | "lotus" | "orchid";
export type PetKind = "cat" | "duck" | "dog" | "hamster" | "hedgehog";
/** 弹道形态 */
export type AttackKind = "straight" | "homing" | "parabola" | "whirl" | "laser";

export interface FlowerLevelStats {
  atk: number;
  rateMs: number;
  attack?: AttackKind;
  splashCells?: number;
  slowMul?: number;
  slowMs?: number;
  double?: boolean;
  triple?: boolean;
  produceSeeds?: number;
  producePollen?: number;
  produceMs?: number;
  buffAtk?: number;
  buffRadiusCells?: number;
}

export interface FlowerLevelLook {
  label: string;
  texture: string;
}

export interface FlowerDef {
  kind: FlowerKind;
  name: string;
  seedCost: number;
  hp: number;
  petal: string;
  role: string;
  looks: FlowerLevelLook[];
  levels: FlowerLevelStats[];
}

const PRODUCE = { produceSeeds: 4, produceMs: 7000 } as const;

export const FLOWERS: FlowerDef[] = [
  {
    kind: "rose",
    name: "月季",
    seedCost: 50,
    hp: 420,
    petal: "petal_rose",
    role: "单体→追踪",
    looks: [
      { label: "素心", texture: "flower_rose" },
      { label: "绯扇", texture: "flower_rose_super" },
      { label: "和平", texture: "flower_rose_epic" },
      { label: "金玛丽", texture: "flower_rose_epic" },
      { label: "龙沙宝石", texture: "flower_rose_legendary" },
    ],
    levels: [
      { atk: 28, rateMs: 1000, attack: "straight", ...PRODUCE },
      { atk: 40, rateMs: 920, attack: "straight", produceSeeds: 5, produceMs: 6500 },
      { atk: 48, rateMs: 880, attack: "homing", produceSeeds: 6, produceMs: 6000 },
      { atk: 58, rateMs: 800, attack: "homing", produceSeeds: 6, produceMs: 5800 },
      { atk: 72, rateMs: 720, attack: "homing", splashCells: 0.8, produceSeeds: 7, produceMs: 5500 },
    ],
  },
  {
    kind: "daffodil",
    name: "水仙",
    seedCost: 75,
    hp: 380,
    petal: "petal_daffodil",
    role: "减速→旋风",
    looks: [
      { label: "玉盏", texture: "flower_daffodil" },
      { label: "金盏", texture: "flower_daffodil_super" },
      { label: "琼花", texture: "flower_daffodil_epic" },
      { label: "冰心", texture: "flower_daffodil_epic" },
      { label: "凌波仙子", texture: "flower_daffodil_legendary" },
    ],
    levels: [
      { atk: 14, rateMs: 1300, attack: "straight", slowMul: 0.5, slowMs: 2200, ...PRODUCE },
      { atk: 20, rateMs: 1200, attack: "straight", slowMul: 0.45, slowMs: 2600, produceSeeds: 5, produceMs: 6500 },
      { atk: 24, rateMs: 1400, attack: "whirl", slowMul: 0.4, slowMs: 2800, produceSeeds: 5, produceMs: 6200 },
      { atk: 30, rateMs: 1300, attack: "whirl", slowMul: 0.35, slowMs: 3200, produceSeeds: 6, produceMs: 5800 },
      { atk: 38, rateMs: 1200, attack: "whirl", slowMul: 0.3, slowMs: 3600, splashCells: 1.1, produceSeeds: 6, produceMs: 5500 },
    ],
  },
  {
    kind: "crabapple",
    name: "海棠",
    seedCost: 100,
    hp: 400,
    petal: "petal_crabapple",
    role: "双发→激光",
    looks: [
      { label: "垂丝", texture: "flower_crabapple" },
      { label: "西府", texture: "flower_crabapple_super" },
      { label: "贴梗", texture: "flower_crabapple_epic" },
      { label: "雪球", texture: "flower_crabapple_epic" },
      { label: "国艳", texture: "flower_crabapple_legendary" },
    ],
    levels: [
      { atk: 14, rateMs: 1200, attack: "straight", double: true, ...PRODUCE },
      { atk: 18, rateMs: 1100, attack: "straight", double: true, produceSeeds: 5, produceMs: 6500 },
      { atk: 22, rateMs: 1000, attack: "straight", triple: true, produceSeeds: 5, produceMs: 6200 },
      { atk: 20, rateMs: 900, attack: "laser", produceSeeds: 6, produceMs: 5800 },
      { atk: 28, rateMs: 820, attack: "laser", produceSeeds: 6, produceMs: 5500 },
    ],
  },
  {
    kind: "lotus",
    name: "荷花",
    seedCost: 125,
    hp: 460,
    petal: "petal_lotus",
    role: "产种→落英",
    looks: [
      { label: "白莲", texture: "flower_lotus" },
      { label: "粉莲", texture: "flower_lotus_super" },
      { label: "重台", texture: "flower_lotus_epic" },
      { label: "千瓣", texture: "flower_lotus_epic" },
      { label: "并蒂", texture: "flower_lotus_legendary" },
    ],
    levels: [
      { atk: 0, rateMs: 0, produceSeeds: 22, producePollen: 14, produceMs: 4200 },
      { atk: 0, rateMs: 0, produceSeeds: 30, producePollen: 20, produceMs: 3800 },
      { atk: 16, rateMs: 2800, attack: "parabola", splashCells: 1.2, produceSeeds: 32, producePollen: 20, produceMs: 3600 },
      { atk: 24, rateMs: 2600, attack: "parabola", splashCells: 1.5, produceSeeds: 40, producePollen: 26, produceMs: 3400 },
      { atk: 34, rateMs: 2400, attack: "parabola", splashCells: 1.8, produceSeeds: 50, producePollen: 32, produceMs: 3200 },
    ],
  },
  {
    kind: "orchid",
    name: "兰花",
    seedCost: 150,
    hp: 360,
    petal: "petal_orchid",
    role: "光环→穿刺",
    looks: [
      { label: "春兰", texture: "flower_orchid" },
      { label: "建兰", texture: "flower_orchid_super" },
      { label: "寒兰", texture: "flower_orchid_epic" },
      { label: "墨兰", texture: "flower_orchid_epic" },
      { label: "素冠荷鼎", texture: "flower_orchid_legendary" },
    ],
    levels: [
      { atk: 12, rateMs: 1500, attack: "straight", buffAtk: 0.15, buffRadiusCells: 1.5, ...PRODUCE },
      { atk: 16, rateMs: 1400, attack: "straight", buffAtk: 0.22, buffRadiusCells: 1.7, produceSeeds: 5, produceMs: 6500 },
      { atk: 20, rateMs: 1300, attack: "laser", buffAtk: 0.28, buffRadiusCells: 1.9, produceSeeds: 5, produceMs: 6200 },
      { atk: 26, rateMs: 1200, attack: "laser", buffAtk: 0.34, buffRadiusCells: 2.1, produceSeeds: 6, produceMs: 5800 },
      { atk: 34, rateMs: 1100, attack: "laser", buffAtk: 0.4, buffRadiusCells: 2.3, produceSeeds: 6, produceMs: 5500 },
    ],
  },
];

export function flowerDef(kind: FlowerKind): FlowerDef {
  const d = FLOWERS.find((f) => f.kind === kind);
  if (!d) throw new Error(`unknown flower ${kind}`);
  return d;
}

export const MAX_FLOWER_LEVEL = 5;

/** 进化（升级）消耗花粉 */
export function upgradeCost(kind: FlowerKind, toLevel: number): number {
  const base = flowerDef(kind).seedCost;
  const mult = [0, 0.55, 1.1, 1.8, 2.6][toLevel - 1] ?? 2.6;
  return Math.round(base * mult);
}

export interface PetDef {
  kind: PetKind;
  name: string;
  hp: number;
  armor: number;
  speed: number;
  texture: string;
  unlockWave: number;
  biteDps: number;
  dropSeeds: number;
  dropPollen: number;
  splitCount?: number;
  splitHpMul?: number;
}

export const PETS: Record<PetKind, PetDef> = {
  cat: { kind: "cat", name: "小猫", hp: 200, armor: 0, speed: 48, texture: "pet_cat", unlockWave: 1, biteDps: 40, dropSeeds: 10, dropPollen: 6 },
  duck: { kind: "duck", name: "鸭鸭", hp: 420, armor: 60, speed: 34, texture: "pet_duck", unlockWave: 3, biteDps: 35, dropSeeds: 14, dropPollen: 10 },
  dog: { kind: "dog", name: "小狗", hp: 320, armor: 20, speed: 70, texture: "pet_dog", unlockWave: 5, biteDps: 48, dropSeeds: 12, dropPollen: 8 },
  hamster: {
    kind: "hamster",
    name: "仓鼠",
    hp: 260,
    armor: 10,
    speed: 56,
    texture: "pet_hamster",
    unlockWave: 7,
    biteDps: 36,
    dropSeeds: 10,
    dropPollen: 6,
    splitCount: 2,
    splitHpMul: 0.45,
  },
  hedgehog: {
    kind: "hedgehog",
    name: "刺猬",
    hp: 380,
    armor: 140,
    speed: 30,
    texture: "pet_hedgehog",
    unlockWave: 9,
    biteDps: 55,
    dropSeeds: 20,
    dropPollen: 14,
  },
};

export type Difficulty = "casual" | "standard" | "expert";
export const DIFFICULTIES: Difficulty[] = ["casual", "standard", "expert"];

export interface DifficultyParams {
  label: string;
  desc: string;
  countMul: number;
  intervalMul: number;
  hpGrow: number;
  speedGrow: number;
  speedBase: number;
}

export const DIFFICULTY_PARAMS: Record<Difficulty, DifficultyParams> = {
  casual: { label: "休闲", desc: "更少更慢，轻松上手", countMul: 0.75, intervalMul: 1.2, hpGrow: 0.06, speedGrow: 0.025, speedBase: 0.88 },
  standard: { label: "标准", desc: "平衡持久的花园攻防", countMul: 1, intervalMul: 1, hpGrow: 0.09, speedGrow: 0.04, speedBase: 1 },
  expert: { label: "专家", desc: "更密更快更厚", countMul: 1.25, intervalMul: 0.85, hpGrow: 0.12, speedGrow: 0.055, speedBase: 1.1 },
};

export const COMBAT = {
  START_SEEDS: 220,
  START_POLLEN: 30,
  GARDEN_SEED_MS: 5000,
  GARDEN_SEED_VALUE: 12,
  LIVES: 3,
  FIRST_WAVE_DELAY_MS: 4500,
  WAVE_GAP_MS: 8000,
  HUGE_WAVE_EVERY: 5,
  HUGE_COUNT_MUL: 1.6,
  KILL_COMBO_WINDOW_MS: 2800,
  COMBO_CASH_AT: 5,
  COMBO_SEEDS: 12,
  COMBO_POLLEN: 8,
  PET_DISPLAY: { w: 62, h: 70 },
  FLOWER_DISPLAY: 58,
  HP_GROW_CLAMP: 2.8,
  SPEED_CLAMP: 1.7,
} as const;

export const HP_GROW_CLAMP = COMBAT.HP_GROW_CLAMP;

export interface WaveScale {
  hpMul: number;
  armorMul: number;
  speedMul: number;
}

export function poolFor(n: number): PetKind[] {
  const pool: PetKind[] = ["cat"];
  if (n >= 3) pool.push("duck");
  if (n >= 5) pool.push("dog");
  if (n >= 7) pool.push("hamster");
  if (n >= 9) pool.push("hedgehog");
  return pool;
}

export interface WaveDef {
  n: number;
  count: number;
  huge: boolean;
  intervalMs: number;
  pool: PetKind[];
}

export function waveDefFor(n: number, diff: Difficulty): WaveDef {
  const p = DIFFICULTY_PARAMS[diff];
  const huge = n >= COMBAT.HUGE_WAVE_EVERY && n % COMBAT.HUGE_WAVE_EVERY === 0;
  const base = 4 + n * 0.85;
  const count = Math.max(2, Math.round(base * (huge ? COMBAT.HUGE_COUNT_MUL : 1) * p.countMul));
  const intervalMs = Math.max(480, 2100 - n * 70) * p.intervalMul;
  return { n, count, huge, intervalMs: Math.round(intervalMs), pool: poolFor(n) };
}

export function waveScale(n: number, diff: Difficulty): WaveScale {
  const p = DIFFICULTY_PARAMS[diff];
  return {
    hpMul: Math.min(HP_GROW_CLAMP, 1 + (n - 1) * p.hpGrow),
    armorMul: Math.min(HP_GROW_CLAMP, 1 + (n - 1) * p.hpGrow * 0.7),
    speedMul: Math.min(COMBAT.SPEED_CLAMP, p.speedBase + (n - 1) * p.speedGrow),
  };
}

export function cellCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: LAWN_X + col * CELL_W + CELL_W / 2,
    y: LAWN_Y + row * CELL_H + CELL_H / 2,
  };
}

export function colX(col: number): number {
  return LAWN_X + col * CELL_W + CELL_W / 2;
}
