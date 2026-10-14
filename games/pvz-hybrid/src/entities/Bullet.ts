import Phaser from "phaser";
import { W, type Projectile } from "../config";
import {
  TrajectoryType,
  PROJECTILE_TRAJECTORY,
  TRAJECTORY_CONFIGS,
  TrajectoryCalculatorFactory,
  type TrajectoryConfig,
  type TrajectoryCalculator,
} from "./Trajectory";
import type { Sfx } from "../systems/Sfx";
import type { Zombie } from "./Zombie";

export interface BulletOpts {
  freezeMs?: number;
  splashCells?: number;
  burnDmg?: number;
  burnMs?: number;
  poisonDmg?: number;
  poisonMs?: number;
  pierceCount?: number;
  chainCount?: number;
  chainDecay?: number;
  explosionRadius?: number;
  /** 对空攻击标记：仅命中飞行单位，非对空弹丸无法命中飞行单位 */
  isAirAttack?: boolean;
  /** 眩晕：命中时有概率眩晕僵尸 */
  stunChance?: number;
  stunDurationMs?: number;
  /** 击退：命中时有概率击退僵尸 */
  knockbackChance?: number;
  knockbackDistance?: number;
  /** 弹射：命中后弹向附近僵尸 */
  bounceCount?: number;
  bounceRange?: number;
  bounceDamageDecay?: number;
}

export interface BulletCtx {
  zombiesInRow(row: number): Zombie[];
  onBulletHit(x: number, y: number, kind: Projectile, dmg: number, killed: boolean, opts?: BulletOpts): void;
  splashAt(x: number, y: number, row: number, dmg: number, radiusCells: number, exclude: Zombie): void;
  /** 击退僵尸 */
  knockbackZombie(zombie: Zombie, distance: number): void;
  /** 眩晕僵尸 */
  stunZombie(zombie: Zombie, durationMs: number): void;
  /** 弹射：生成新的追踪弹丸 */
  spawnBounceBullet(fromX: number, fromY: number, row: number, dmg: number, kind: Projectile, opts?: BulletOpts): void;
  sfx: Sfx;
}

const TEX: Record<Projectile, string> = {
  pea: "pea",
  icepea: "icepea",
  icebolt: "icepea",
  melon: "melon",
  wintermelon: "melon",
  fireball: "fireball",
  axe: "axe",
  chain: "chain",
  beam: "beam",
  missile: "missile",
  drone: "drone",
  spike: "spike",
  cannonball: "cannonball",
  cactusball: "cactusball",
};

const TRAIL_TINT: Record<Projectile, number> = {
  pea: 0xa8e87c,
  icepea: 0x9fe8ff,
  icebolt: 0xbfe8ff,
  melon: 0x7cd0e8,
  wintermelon: 0x88ddff,
  fireball: 0xff6b3d,
  axe: 0x88ccff,
  chain: 0xffee44,
  beam: 0xff4444,
  missile: 0xff8844,
  drone: 0x44ff88,
  spike: 0xa8e87c,
  cannonball: 0x808080,
  cactusball: 0x32cd32,
};

const PROJECTILE_SIZE: Record<Projectile, number> = {
  pea: 26, icepea: 26, icebolt: 28, melon: 34, wintermelon: 36,
  fireball: 30, axe: 28, chain: 24, beam: 20, missile: 32, drone: 28,
  spike: 22, cannonball: 28, cactusball: 24,
};

const IS_FORM: Record<Projectile, boolean> = {
  pea: false, icepea: false, icebolt: false, melon: false, wintermelon: false,
  fireball: true, axe: true, chain: true, beam: true, missile: true, drone: true,
  spike: false, cannonball: false, cactusball: false,
};

const AURA_TEX: Record<string, string> = {
  fireball: "aura_fire", axe: "aura_ice", chain: "aura_rift",
  beam: "aura_rift", missile: "aura_fire", drone: "aura_toxic",
  wintermelon: "aura_ice",
};

export class Bullet extends Phaser.GameObjects.Sprite {
  readonly row: number;
  private readonly kind: Projectile;
  private readonly dmg: number;
  private readonly slow: boolean;
  private readonly opts: BulletOpts;
  private _dead = false;

  // 手动管理的拖尾粒子
  private trailDots: Phaser.GameObjects.Image[] = [];
  private trailMeta = new Map<Phaser.GameObjects.Image, { life: number; maxLife: number }>();
  private trailTimer = 0;
  private readonly isForm: boolean;
  private readonly trailInterval: number;
  private readonly trailLifespan: number;
  /** 已击中的僵尸集合（用于穿透：同一颗子弹不会重复命中同一目标） */
  private hitZombies: Set<Zombie> = new Set();

  // 光环
  private auraImg: Phaser.GameObjects.Image | null = null;
  private auraAngle = 0;

  // 弹道系统
  private trajectoryType: TrajectoryType;
  private trajectoryConfig: TrajectoryConfig;
  private trajectoryCalculator: TrajectoryCalculator;
  private trajectoryProgress = 0;
  private startX: number;
  private startY: number;
  private targetX = W + 100; // 目标X坐标（屏幕右侧）
  private targetY: number;

  constructor(
    scene: Phaser.Scene,
    row: number,
    x: number,
    y: number,
    kind: Projectile,
    dmg: number,
    slow: boolean,
    opts: BulletOpts = {}
  ) {
    super(scene, x, y, TEX[kind]);
    this.kind = kind;
    this.dmg = dmg;
    this.slow = slow;
    this.opts = opts;
    this.row = row;
    this.isForm = IS_FORM[kind];
    this.trailInterval = this.isForm ? 10 : kind === "melon" ? 14 : 24;
    this.trailLifespan = this.isForm ? 260 : kind === "melon" ? 220 : 160;

    // 根据弹丸类型确定弹道
    this.trajectoryType = PROJECTILE_TRAJECTORY[kind] ?? TrajectoryType.LINEAR;
    this.trajectoryConfig = TRAJECTORY_CONFIGS[this.trajectoryType];
    this.trajectoryCalculator = TrajectoryCalculatorFactory.getCalculator(this.trajectoryType);
    this.startX = x;
    this.startY = y;
    this.targetY = y; // 默认目标Y与发射点相同

    this.setOrigin(0.5, 0.5);
    this.setDisplaySize(PROJECTILE_SIZE[kind], PROJECTILE_SIZE[kind]);
    this.setDepth(30);

    // 光环
    const auraKey = AURA_TEX[kind];
    if (auraKey && scene.textures.exists(auraKey)) {
      this.auraImg = scene.add.image(x, y, auraKey).setDepth(31).setAlpha(0.5);
    }

    scene.add.existing(this);
  }

  updateGame(delta: number, ctx: BulletCtx): void {
    if (this._dead) return;

    // 更新进度
    this.trajectoryProgress += delta / 1000;
    
    // 计算新位置
    const pos = this.trajectoryCalculator.calculate(
      this.trajectoryConfig,
      this.startX,
      this.startY,
      this.targetX,
      this.targetY,
      Math.min(1, this.trajectoryProgress)
    );
    
    this.x = pos.x;
    this.y = pos.y;

    // 更新光环位置
    if (this.auraImg) {
      this.auraAngle += delta * 0.006;
      this.auraImg.setPosition(this.x, this.y);
      this.auraImg.rotation = this.auraAngle;
      this.auraImg.setScale(0.9 + Math.sin(this.auraAngle * 3) * 0.15);
    }

    // 生成拖尾粒子（手动管理，不依赖 follow）
    this.trailTimer += delta;
    if (this.trailTimer >= this.trailInterval) {
      this.trailTimer = 0;
      this.spawnTrailDot();
    }
    // 更新已有拖尾粒子
    this.updateTrailDots(delta);

    if (this.x > W + 40) {
      this.die();
      return;
    }

    const targets = ctx.zombiesInRow(this.row);
    let pierced = 0;
    const isPiercing = this.opts.pierceCount !== undefined && this.opts.pierceCount !== 0;
    const isInfinitePierce = this.opts.pierceCount === -1; // -1 表示无限穿透
    const isBeam = this.kind === "beam";
    
    for (const z of targets) {
      if (z.isDying) continue;
      // 同一颗子弹已击中的目标不再重复命中
      if (this.hitZombies.has(z)) continue;
      // 对空攻击：只能命中空中单位；非对空攻击：不能命中空中单位
      if (this.opts.isAirAttack && !z.isFlying) continue;
      if (!this.opts.isAirAttack && z.isFlying) continue;
      if (this.x > z.x - 26 && this.x < z.x + 40) {
        // 记录已命中，后续不再重复
        this.hitZombies.add(z);
        
        const willKill = z.hp + z.armor <= this.dmg;
        const finalDmg = this.opts.isAirAttack && z.isFlying ? Math.round(this.dmg * 1.8) : this.dmg;
        z.takeDamage(finalDmg, this.slow);
        if (this.opts.freezeMs && this.opts.freezeMs > 0) z.freeze(this.opts.freezeMs);
        if (this.opts.burnDmg && this.opts.burnMs) z.freeze(this.opts.burnMs);
        if (this.opts.poisonDmg && this.opts.poisonMs) z.freeze(this.opts.poisonMs);

        // 眩晕：概率定身僵尸
        if (this.opts.stunChance && this.opts.stunDurationMs && Math.random() < this.opts.stunChance) {
          ctx.stunZombie(z, this.opts.stunDurationMs);
        }
        // 击退：概率击退僵尸
        if (this.opts.knockbackChance && this.opts.knockbackDistance && Math.random() < this.opts.knockbackChance) {
          ctx.knockbackZombie(z, this.opts.knockbackDistance);
        }

        if (this.kind === "melon" || this.kind === "wintermelon" || this.kind === "fireball" || this.kind === "cannonball") {
          ctx.splashAt(z.x, z.y - 55, this.row, this.dmg, this.opts.splashCells ?? 1, z);
        }
        ctx.onBulletHit(z.x, z.y - 55, this.kind, this.dmg, willKill, this.opts);
        ctx.sfx.splat();

        // 弹射：命中后弹向附近僵尸
        if (this.opts.bounceCount && this.opts.bounceCount > 0) {
          const bounceDecay = this.opts.bounceDamageDecay ?? 0.6;
          const bounceDmg = Math.round(this.dmg * bounceDecay);
          ctx.spawnBounceBullet(z.x, z.y - 55, this.row, bounceDmg, this.kind, {
            ...this.opts,
            bounceCount: this.opts.bounceCount - 1,
            bounceDamageDecay: bounceDecay,
          });
        }

        // 决定子弹是否继续存活
        if (isBeam) {
          // 激光：穿透所有目标，继续飞行
          continue;
        } else if (isInfinitePierce) {
          // 无限穿透：继续飞行，不消失
          continue;
        } else if (isPiercing) {
          // 有限穿透：累计穿透次数
          pierced++;
          if (pierced >= (this.opts.pierceCount ?? 1)) {
            this.die();
            return;
          }
          // 还能继续穿透，继续飞行
          continue;
        } else if (this.kind === "chain") {
          // 闪电链：弹射到附近目标后消失
          const chainCount = this.opts.chainCount ?? 2;
          const chainDecay = this.opts.chainDecay ?? 0.6;
          let chainDmg = this.dmg * chainDecay;
          let chained = 0;
          for (const other of targets) {
            if (other === z || other.isDying) continue;
            if (this.hitZombies.has(other)) continue;
            if (Math.abs(other.x - z.x) < 120 && Math.abs(other.row - this.row) <= 1) {
              this.hitZombies.add(other);
              other.takeDamage(chainDmg);
              ctx.onBulletHit(other.x, other.y - 55, "chain", chainDmg, other.hp + other.armor <= chainDmg, this.opts);
              chained++;
              chainDmg *= chainDecay;
              if (chained >= chainCount) break;
            }
          }
          this.die();
          return;
        } else if (this.kind === "missile" || this.kind === "drone") {
          ctx.splashAt(z.x, z.y - 55, this.row, this.dmg, 1.5, z);
          ctx.onBulletHit(z.x, z.y - 55, this.kind, this.dmg, willKill, this.opts);
          this.die();
          return;
        } else {
          // 普通子弹：命中后消失
          this.die();
          return;
        }
      }
    }
  }

  // ─── 手动拖尾粒子管理 ───

  private spawnTrailDot(): void {
    const scene = this.scene;
    if (!scene || !scene.sys.isActive()) return;
    
    // 根据弹道类型调整拖尾效果
    let trailScale = this.isForm ? 1.2 : 0.7;
    let trailAlpha = 0.9;
    
    if (this.trajectoryType === TrajectoryType.SPIRAL) {
      trailScale = 1.0;
      trailAlpha = 0.8;
    } else if (this.trajectoryType === TrajectoryType.FALLING) {
      trailScale = 1.4;
      trailAlpha = 0.95;
    }
    
    const dot = scene.add.image(this.x, this.y, "dot")
      .setDepth(29)
      .setScale(trailScale)
      .setTint(TRAIL_TINT[this.kind])
      .setAlpha(trailAlpha);
    
    this.trailMeta.set(dot, { life: this.trailLifespan, maxLife: this.trailLifespan });
    this.trailDots.push(dot);
  }

  private updateTrailDots(delta: number): void {
    for (let i = this.trailDots.length - 1; i >= 0; i--) {
      const dot = this.trailDots[i];
      if (!dot || !dot.active) {
        if (dot) this.trailMeta.delete(dot);
        this.trailDots.splice(i, 1);
        continue;
      }
      const meta = this.trailMeta.get(dot);
      if (!meta) { dot.destroy(); this.trailDots.splice(i, 1); continue; }
      meta.life -= delta;
      if (meta.life <= 0) {
        this.trailMeta.delete(dot);
        dot.destroy();
        this.trailDots.splice(i, 1);
      } else {
        dot.setAlpha(0.9 * (meta.life / meta.maxLife));
        dot.setScale(dot.scale * 0.98);
      }
    }
  }

  private die(): void {
    if (this._dead) return;
    this._dead = true;
    // 销毁所有拖尾粒子
    for (const dot of this.trailDots) {
      if (dot && dot.active) dot.destroy();
    }
    this.trailDots.length = 0;
    this.trailMeta.clear();
    // 销毁光环
    if (this.auraImg) {
      this.auraImg.destroy();
      this.auraImg = null;
    }
    this.destroy();
  }
}
