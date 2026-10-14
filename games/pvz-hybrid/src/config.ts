// 全局常量与数值配置（平衡数据集中在这里，便于调参）
export const W = 1040;
export const H = 640;

export const COLS = 9;
export const ROWS = 5;
export const LAWN_X = 150;
export const LAWN_Y = 118;
export const CELL_W = 90;
export const CELL_H = 98;

export const LAWN_RIGHT = LAWN_X + COLS * CELL_W; // 960
export const LAWN_BOTTOM = LAWN_Y + ROWS * CELL_H; // 608
export const MOWER_X = LAWN_X - 44;
export const HOUSE_LINE_X = LAWN_X - 58;

export type PlantKind =
  | "peashooter"
  | "snowpea"
  | "wallnut"
  | "cherrybomb"
  | "potatomine"
  | "jalapeno"
  | "repeater"
  | "tallnut"
  | "threepeater"
  | "chomper"
  | "wintermelon"
  | "cactus"
  | "spikeweed"
  | "flakcannon"
  | "cactusball"
  | "fireflower";

/** 弹丸样式 */
export type Projectile =
  | "pea"          // 普通豆
  | "icepea"       // 减速冰豆
  | "icebolt"      // 深冻冰弹
  | "melon"        // 西瓜
  | "wintermelon"  // 冰西瓜（抛物线弹道）
  | "fireball"     // 火球：溅射+灼烧
  | "axe"          // 冰斧：穿透+减速
  | "chain"        // 闪电链：连锁3目标
  | "beam"         // 激光：穿透全目标
  | "missile"      // 导弹：追踪+爆炸AOE
  | "drone"        // 无人机：自曝范围爆炸
  | "spike"        // 仙人掌尖刺：对空攻击
  | "cannonball"   // 高射炮弹丸：远程范围爆炸
  | "cactusball";  // 仙人球弹丸：范围对空攻击

export type ZombieKind = "basic" | "cone" | "bucket" | "flag" | "runner" | "giant" | "dancer" | "digger" | "balloon" | "catapult";

export interface ZombieAbility {
  type: 'summon' | 'ground' | 'ranged' | 'flying' | 'stomp';
  cooldownMs: number;
  damage?: number;
  radius?: number;
  summonKind?: ZombieKind;
  summonCount?: number;
}

export const ZOMBIE_ABILITIES: Partial<Record<ZombieKind, ZombieAbility>> = {
  giant: { type: 'stomp', cooldownMs: 5000, damage: 100, radius: 90 },
  dancer: { type: 'summon', cooldownMs: 10000, summonKind: 'basic', summonCount: 2 },
  digger: { type: 'ground', cooldownMs: 0 },
  balloon: { type: 'flying', cooldownMs: 0 },
  catapult: { type: 'ranged', cooldownMs: 3000, damage: 80, radius: 270 },
};

export interface PlantDef {
  kind: PlantKind;
  name: string;
  cost: number;
  hp: number;
  cooldownMs: number;
  texture: string;
}

export interface PlantBehavior {
  atk?: number;
  rateMs?: number;
  slow?: boolean;
  doubleShot?: boolean;
  fuseMs?: number;
  boomRadiusCells?: number;
  armMs?: number;
  /** 三线射手：同时向前/上/下三行开火 */
  triShot?: boolean;
  /** 大嘴花：近战吞噬（咬中即高额伤害，冷却后重张） */
  biteDamage?: number;
  biteCooldownMs?: number;
  biteRangeCells?: number;
  /** 冰西瓜：着地范围溅射 + 减速 */
  splashRadiusCells?: number;
  /** 仙人掌：对空攻击植物 */
  isAirAttack?: boolean;
  /** 地刺：地面植物 */
  isGround?: boolean;
  /** 远程植物：可攻击远距离目标 */
  isRemote?: boolean;
  /** 火焰花：穿透目标数量 */
  pierceCount?: number;
  /** 火焰花：灼烧伤害 */
  burnDmg?: number;
  /** 火焰花：灼烧持续时间 */
  burnMs?: number;
}

export const PLANT_DEFS: PlantDef[] = [
  { kind: "peashooter", name: "豌豆射手", cost: 100, hp: 300, cooldownMs: 7500, texture: "peashooter" },
  { kind: "snowpea", name: "寒冰射手", cost: 175, hp: 300, cooldownMs: 7500, texture: "snowpea" },
  { kind: "repeater", name: "双发射手", cost: 100, hp: 300, cooldownMs: 7500, texture: "repeater" },
  { kind: "wallnut", name: "坚果墙", cost: 50, hp: 4000, cooldownMs: 25000, texture: "wallnut" },
  { kind: "tallnut", name: "高坚果", cost: 125, hp: 8000, cooldownMs: 30000, texture: "tallnut" },
  { kind: "cherrybomb", name: "樱桃炸弹", cost: 150, hp: 300, cooldownMs: 35000, texture: "cherrybomb" },
  { kind: "potatomine", name: "土豆地雷", cost: 25, hp: 300, cooldownMs: 25000, texture: "potatomine" },
  { kind: "jalapeno", name: "火爆辣椒", cost: 175, hp: 300, cooldownMs: 35000, texture: "jalapeno" },
  { kind: "threepeater", name: "三线射手", cost: 200, hp: 320, cooldownMs: 9500, texture: "threepeater" },
  { kind: "chomper", name: "大嘴花", cost: 150, hp: 2000, cooldownMs: 9000, texture: "chomper" },
  { kind: "wintermelon", name: "冰西瓜", cost: 200, hp: 400, cooldownMs: 14000, texture: "wintermelon" },
  { kind: "cactus", name: "仙人掌", cost: 125, hp: 300, cooldownMs: 7500, texture: "cactus" },
  { kind: "spikeweed", name: "地刺", cost: 50, hp: 200, cooldownMs: 5000, texture: "spikeweed" },
  { kind: "flakcannon", name: "高射炮", cost: 200, hp: 350, cooldownMs: 10000, texture: "flakcannon" },
  { kind: "cactusball", name: "仙人球", cost: 150, hp: 250, cooldownMs: 8000, texture: "cactusball" },
  { kind: "fireflower", name: "火焰花", cost: 175, hp: 280, cooldownMs: 9000, texture: "fireflower" },
];

export const PLANT_BEHAVIORS: Record<PlantKind, PlantBehavior> = {
  peashooter: { atk: 20, rateMs: 1400 },
  snowpea: { atk: 20, rateMs: 1400, slow: true },
  repeater: { atk: 20, rateMs: 1100, doubleShot: true },
  wallnut: {},
  tallnut: {},
  cherrybomb: { fuseMs: 900, boomRadiusCells: 1.5, atk: 1800 },
  potatomine: { armMs: 14000, atk: 9999 },
  jalapeno: { fuseMs: 800, atk: 1800 },
  threepeater: { atk: 20, rateMs: 1600, triShot: true },
  chomper: { biteDamage: 10000, biteCooldownMs: 3200, biteRangeCells: 2 },
  wintermelon: { atk: 60, rateMs: 3300, splashRadiusCells: 1.5 },
  cactus: { atk: 25, rateMs: 1500, isAirAttack: true },
  spikeweed: { atk: 10, rateMs: 500, isGround: true },
  flakcannon: { atk: 40, rateMs: 2500, splashRadiusCells: 1.5 },
  cactusball: { atk: 20, rateMs: 1800, isAirAttack: true, splashRadiusCells: 1 },
  fireflower: { atk: 30, rateMs: 2000, pierceCount: 3, burnDmg: 5, burnMs: 2000 },
};

export function plantDef(kind: PlantKind): PlantDef {
  const def = PLANT_DEFS.find((d) => d.kind === kind);
  if (!def) throw new Error(`unknown plant kind: ${kind}`);
  return def;
}

/** 传送带出卡池：可出可融合的常规植物。
 * 刻意剔除爆炸类单卡（樱桃/土豆/辣椒），避免无脑核弹，把"爽"留在融合怪身上。
 */
export const BELT_POOL: PlantKind[] = [
  "peashooter",
  "snowpea",
  "repeater",
  "wallnut",
  "tallnut",
  "threepeater",
  "chomper",
  "wintermelon",
  "cactus",
  "spikeweed",
  "flakcannon",
  "cactusball",
  "fireflower",
];

/** 各植物按 tier 的具象形态贴图 key；未登记的本体贴图，由 Plant 用 tint 上色兜底 */
const FORM_TEXTURES: Partial<Record<PlantKind, { weak?: string; super?: string }>> = {
  peashooter: { weak: "peashooter_weak", super: "peashooter_super" },
  snowpea: { weak: "snowpea_weak", super: "snowpea_super" },
  repeater: { weak: "repeater_weak", super: "repeater_super" },
  threepeater: { weak: "threepeater_weak", super: "threepeater_super" },
};

/** 形态贴图解析：命中专属贴图返回之，否则回退本体贴图（配合 tint 表现形态） */
export function tierTexture(kind: PlantKind, tier: "weak" | "normal" | "super"): string {
  const forms = FORM_TEXTURES[kind];
  const tex = tier === "weak" ? forms?.weak : tier === "super" ? forms?.super : undefined;
  return tex ?? plantDef(kind).texture;
}

/** 该形态是否已具备象化贴图（有则不再叠加 tint，避免双重上色冲淡造型） */
export function hasFormTexture(kind: PlantKind, tier: "weak" | "normal" | "super"): boolean {
  const forms = FORM_TEXTURES[kind];
  return tier === "weak" ? !!forms?.weak : tier === "super" ? !!forms?.super : false;
}

export interface ZombieDef {
  kind: ZombieKind;
  name: string;
  hp: number;
  armor: number;
  speed: number; // px/s
  texture: string;
  baseTexture: string; // 护甲被打掉后切换的基础贴图
}

export const ZOMBIE_DEFS: Record<ZombieKind, ZombieDef> = {
  // 基础僵尸：+40%血量，提升中期生存力
  basic: { kind: "basic", name: "普通僵尸", hp: 310, armor: 0, speed: 19, texture: "zombie", baseTexture: "zombie" },
  // 路障：+20%护甲，更耐揍
  cone: { kind: "cone", name: "路障僵尸", hp: 280, armor: 600, speed: 19, texture: "zombie_cone", baseTexture: "zombie" },
  // 铁桶：+15%护甲 +7%速度，更难被风筝
  bucket: { kind: "bucket", name: "铁桶僵尸", hp: 280, armor: 1800, speed: 16, texture: "zombie_bucket", baseTexture: "zombie_bucket" },
  // 旗帜：-10%血量 +7%速度，纯粹的先头部队
  flag: { kind: "flag", name: "旗帜僵尸", hp: 250, armor: 0, speed: 30, texture: "zombie_flag", baseTexture: "zombie_flag" },
  // 猎犬：+20%血量 +4%速度，更难被一击秒杀
  runner: { kind: "runner", name: "僵尸猎犬", hp: 200, armor: 0, speed: 50, texture: "zombie", baseTexture: "zombie" },
  giant: { kind: "giant", name: "巨人僵尸", hp: 1200, armor: 800, speed: 12, texture: "zombie_giant", baseTexture: "zombie_giant" },
  dancer: { kind: "dancer", name: "舞王僵尸", hp: 380, armor: 0, speed: 18, texture: "zombie_dancer", baseTexture: "zombie_dancer" },
  digger: { kind: "digger", name: "矿工僵尸", hp: 260, armor: 0, speed: 22, texture: "zombie_digger", baseTexture: "zombie_digger" },
  balloon: { kind: "balloon", name: "气球僵尸", hp: 220, armor: 0, speed: 16, texture: "zombie_balloon", baseTexture: "zombie_balloon" },
  catapult: { kind: "catapult", name: "投石车僵尸", hp: 450, armor: 300, speed: 10, texture: "zombie_catapult", baseTexture: "zombie_catapult" },
};

export const EAT_TICK_MS = 500;
export const EAT_DMG = 50; // 每 0.5s 啃一口 → 100 DPS，对齐原版
export const SLOW_DURATION_MS = 5000;
export const SLOW_SPEED_MUL = 0.5;

// 爽感系统
export const COMBO_WINDOW_MS = 3000;   // 连杀判定窗口
export const COMBO_REWARD_EVERY = 5;   // 每连杀 5 次奖励
export const HITSTOP_KILL_MS = 45;     // 击杀顿帧
export const HITSTOP_BOOM_MS = 90;     // 爆炸顿帧
export const SLOWMO_MS = 320;          // 爆炸慢动作时长
export const SLOWMO_FACTOR = 0.25;

export const TOTAL_WAVES = 10;
export const HUGE_WAVES = [5, 10];

export interface WaveDef {
  count: number;
  huge: boolean;
  intervalMs: number;
  pool: ZombieKind[];
}

/** 出怪池随波次演进：种类逐步解锁，后期增加特殊僵尸出现概率 */
function poolFor(n: number, total: number, zombiePool?: ZombieKind[]): ZombieKind[] {
  if (zombiePool && zombiePool.length > 0) return customPoolFor(n, total, zombiePool);
  // 逐波解锁僵尸种类，让玩家逐步适应新威胁
  if (n <= 1) return ["basic"];
  if (n <= 2) return ["basic", "cone"];
  if (n <= 3) return ["basic", "cone", "flag"];
  if (n <= 4) return ["basic", "cone", "bucket"];
  if (n <= 5) return ["basic", "cone", "bucket", "runner"];
  if (n <= 6) return ["basic", "cone", "bucket", "runner", "giant"];
  if (n <= 7) return ["basic", "cone", "bucket", "runner", "giant", "dancer"];
  if (n <= 8) return ["basic", "cone", "bucket", "runner", "giant", "dancer", "digger"];
  if (n <= 9) return ["basic", "cone", "bucket", "runner", "giant", "dancer", "digger", "balloon"];
  return ["basic", "cone", "bucket", "runner", "giant", "dancer", "digger", "balloon", "catapult"];
}

/** 自定义出怪池（关卡专属）：按波次解锁 + 终局护甲权重翻倍 */
function customPoolFor(n: number, total: number, pool: ZombieKind[]): ZombieKind[] {
  const has = (k: ZombieKind) => pool.includes(k);
  const unlocked: ZombieKind[] = [];
  if (has("basic")) unlocked.push("basic");
  if (n >= 2 && has("cone")) unlocked.push("cone");
  if (n >= 4 && has("bucket")) unlocked.push("bucket");
  if (n >= 6 && has("runner")) unlocked.push("runner");
  if (n >= 3 && has("flag")) unlocked.push("flag");
  if (n >= 5 && has("digger")) unlocked.push("digger");
  if (n >= 7 && has("balloon")) unlocked.push("balloon");
  if (n >= 8 && has("catapult")) unlocked.push("catapult");
  if (!unlocked.length) return ["basic"];
  if (n === total) {
    const weighted: ZombieKind[] = [];
    for (const k of unlocked) {
      weighted.push(k);
      if (k === "cone" || k === "bucket") weighted.push(k);
    }
    return weighted;
  }
  return unlocked;
}

export function buildWaves(total: number, zombiePool?: ZombieKind[]): WaveDef[] {
  const waves: WaveDef[] = [];
  for (let n = 1; n <= total; n++) {
    const huge = HUGE_WAVES.includes(n);
    const finale = n === total;
    const base = 5 + n * 1.2; // 每波基础数量+1.2（原4+n）
    const count = Math.round(base * (finale ? 2.0 : huge ? 1.7 : 1));
    const intervalMs = Math.max(700, 2200 - n * 140) * (finale ? 0.7 : huge ? 0.5 : 1);
    waves.push({ count, huge, intervalMs, pool: poolFor(n, total, zombiePool) });
  }
  return waves;
}

/** 波次难度缩放：血量/护甲/速度随波次爬坡（纯函数，可单测） */
export interface WaveScale {
  hpMul: number;
  armorMul: number;
  speedMul: number;
}

export function waveScale(n: number, total: number): WaveScale {
  const t = Math.min(n, total);
  return {
    hpMul: 1 + (t - 1) * 0.20,   // 每波+20%血量（原0.15）
    armorMul: 1 + (t - 1) * 0.15, // 每波+15%护甲（原0.12）
    speedMul: Math.min(1.4, 1 + (t - 1) * 0.05), // 每波+5%速度，上限1.4（原0.04/1.3）
  };
}

// 跨场景事件总线见 src/bus.ts（独立模块，保证本文件可在 node 测试环境导入）
