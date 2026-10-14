/**
 * 手感/平衡调参集中地：散落在各处的魔法数字统一收敛到这里。
 * 改数值只动本文件；命名空间按用途分组。
 * 注意：PHYSICS / WEAPON 等基础常量仍在 utils/constants.ts（单元测试锚定）。
 */
import type { WeaponId } from '../utils/constants';

/** 资源池容量 */
export const POOL = {
  bulletCapacity: 64,
} as const;

/** 战斗判定与伤害 */
export const COMBAT = {
  bulletDamage: 1,
  /** 处决伤害（保证必杀） */
  executeDamage: 999,
  /** AABB 判定半宽：子弹 vs 敌人 / 子弹 vs 玩家 */
  hitHalfWidth: 10,
  /** 玩家 AABB 半高（略宽于敌人，给玩家宽容度） */
  playerHitHalfHeight: 12,
  killScore: 100,
} as const;

/** 敌人 AI 节奏 */
export const AI = {
  gruntFireIntervalMs: 1200,
  turretFireIntervalMs: 1000,
} as const;

/** 视觉缩放：角色 tilesheet 原始 90×110 帧 */
export const SCALE = {
  /** 小兵/玩家 → 18×22 */
  character: 18 / 90,
  /** Boss（2x 大小）→ 36×44 */
  boss: 36 / 90,
} as const;

/** Boss（当前关卡未接入，数值先行收敛） */
export const BOSS = {
  defaultHp: 100,
  hurtAnimMs: 150,
  fireIntervalMs: { phase1: 800, phase2: 700, phase3: 600 } as const,
  fireSpread: { phase2: [-0.2, 0, 0.2], phase3: [-0.4, -0.2, 0, 0.2, 0.4] } as const,
} as const;

/** 流程与反馈计时 */
export const TIMING = {
  playerInvincibleMs: 2000,
  deathToMenuMs: 1500,
  stageClearToMenuMs: 2500,
  /** 受击闪白时长（敌人） */
  hitFlashWhiteMs: 70,
  /** 玩家受伤红闪 + 震屏 */
  hurtFlashMs: 120,
  hurtShakeIntensity: 0.01,
  /** 击杀震屏（更轻微） */
  killShakeMs: 80,
  killShakeIntensity: 0.004,
} as const;

/** 出生点与关卡摆放（脚底锚点：y 为"脚底所在像素"） */
export const SPAWN = {
  groundTilesWidth: 320,
  cameraLerp: 0.1,
  muzzleHeight: 8,
  /** 霰弹扇形每档 spread 对应的横向像素间隔 */
  spreadPixelStep: 8,
  grunts: [
    { x: 300, y: 80 },
    { x: 400, y: 104 },
  ],
  turrets: [{ x: 500, y: 72 }],
  powerUp: { x: 1200, y: 64, weapon: 'spread' as WeaponId },
} as const;
