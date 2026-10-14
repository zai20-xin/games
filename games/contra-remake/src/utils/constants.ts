// Arcade Physics 32-bit 位掩码：上半给玩家/敌人/子弹，下半给地形
const CATEGORY = {
  GROUND:        0b0000_0001,
  PLAYER:        0b0000_0010,
  ENEMY:         0b0000_0100,
  PLAYER_BULLET: 0b0000_1000,
  ENEMY_BULLET:  0b0001_0000,
  POWERUP:       0b0010_0000,
} as const;

export const COLLISION = {
  GROUND:        CATEGORY.GROUND,
  PLAYER:        CATEGORY.PLAYER        | CATEGORY.PLAYER_BULLET | CATEGORY.POWERUP,
  ENEMY:         CATEGORY.ENEMY         | CATEGORY.ENEMY_BULLET,
  PLAYER_BULLET: CATEGORY.PLAYER_BULLET | CATEGORY.GROUND        | CATEGORY.ENEMY,
  ENEMY_BULLET:  CATEGORY.ENEMY_BULLET  | CATEGORY.GROUND        | CATEGORY.PLAYER,
  POWERUP:       CATEGORY.POWERUP       | CATEGORY.PLAYER,
} as const;

export const PHYSICS = {
  playerSpeed: 180,
  crouchSpeed: 90,
  jumpVelocity: -650,
  gravity: 1200,
  maxFallSpeed: 600,
  enemySpeed: 60,
  gruntSight: 200,
  bulletSpeed: 480,
} as const;

export const WEAPON = {
  single:  { id: 1, bullets: 1, spread: 0,    fireIntervalMs: 220 },
  double:  { id: 2, bullets: 2, spread: 0,    fireIntervalMs: 220 },
  spread:  { id: 3, bullets: 3, spread: 0.2,  fireIntervalMs: 260 },
  fast:    { id: 4, bullets: 1, spread: 0,    fireIntervalMs: 90  },
  laser:   { id: 5, bullets: 1, spread: 0,    fireIntervalMs: 130 },
} as const;

export type WeaponId = keyof typeof WEAPON;

export const BOSS_PHASE_HP = { phase1: 60, phase2: 20 } as const;

export const LEVEL_1_SIZE = { width: 2560, height: 240 } as const;
