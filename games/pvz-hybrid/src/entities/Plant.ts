import Phaser from "phaser";
import {
  PLANT_BEHAVIORS,
  ROWS,
  hasFormTexture,
  tierTexture,
  type PlantDef,
  type PlantKind,
  type Projectile,
} from "../config";
import type { Occupant } from "../systems/GridModel";
import type { PlantVariant, RandomBonus } from "../systems/Fusion";
import type { Sfx } from "../systems/Sfx";
import type { BulletOpts } from "./Bullet";
import type { EvolvedPlant } from "../types/dictionaries";

export interface PlantCtx {
  hasZombieInRow(row: number, fromX: number): boolean;
  hasZombieNear(row: number, x: number, radius: number): boolean;
  spawnBullet(row: number, x: number, y: number, kind: Projectile, dmg: number, slow: boolean, opts?: BulletOpts): void;
  onPlantShoot(kind: PlantKind, x: number, y: number): void;
  explodeAt(row: number, col: number, radiusCells: number, dmg: number): void;
  burnRow(row: number, dmg: number): void;
  detonateMine(plant: Plant): void;
  /** 大嘴花：咬住范围内最靠前的一只僵尸，造成伤害；是否命中 */
  chomperBite(row: number, x: number, rangeCells: number, dmg: number): boolean;
  onPlantDead(plant: Plant): void;
  /** 仙人掌：检测行内是否有空中目标 */
  hasAirTargetInRow(row: number, fromX: number): boolean;
  /** 地刺：对半径内僵尸造成伤害 */
  damageZombiesInRadius(row: number, x: number, radius: number, dmg: number): void;
  sfx: Sfx;
}

export const DEFAULT_VARIANT: PlantVariant = {
  atkMul: 1,
  rateMul: 1,
  hpMul: 1,
  label: "",
  tier: "normal",
  fused: false,
};

export class Plant extends Phaser.GameObjects.Sprite implements Occupant {
  readonly kind: PlantKind;
  readonly def: PlantDef;
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly variant: PlantVariant;
  /** 进化数据（新引擎） */
  evolved: EvolvedPlant | null = null;
  hp: number;
  private readonly maxHp: number;
  /** 变异形态基础缩放：乘在 setDisplaySize 之后的当前比例上（占本体比例） */
  private baseScaleX = 1;
  private baseScaleY = 1;
  /** 变异形态基础染体（金身/凋零），null=本体原色；瞬态闪调后 restoreForm 复位 */
  private formTint: number | null = null;
  private nextAttackAt = 0;
  private fuseAt = 0;
  private armedAt = 0;
  private biteReadyAt = 0;
  private dead = false;
  /** 死亡动画是否已启动（防止重复触发） */
  deathStarted = false;
  private fuseEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private mineBlinkStarted = false;
  /** 随机加成结束时间 */
  private bonusEndTime = 0;
  private thornsLastPulse = 0;
  private regenLastTick = 0;

  constructor(
    scene: Phaser.Scene,
    row: number,
    col: number,
    cx: number,
    cy: number,
    def: PlantDef,
    variant: PlantVariant = DEFAULT_VARIANT,
  ) {
    super(scene, cx, cy, tierTexture(def.kind, variant.tier));
    this.kind = def.kind;
    this.def = def;
    this.row = row;
    this.col = col;
    this.x = cx;
    this.variant = variant;
    this.hp = Math.round(def.hp * variant.hpMul);
    this.maxHp = this.hp;
    this.setOrigin(0.5, 1);
    this.setDisplaySize(84, 84);

    // 仙人掌：绿色着色
    if (def.kind === "cactus") {
      this.setTint(0x228b22);
    }

    // 地刺：棕色着色 + 更矮的显示
    if (def.kind === "spikeweed") {
      this.setTint(0x8b4513);
      this.setDisplaySize(84, 42);
    }

    // 仙人球：绿色着色 + 圆形
    if (def.kind === "cactusball") {
      this.setTint(0x32cd32);
    }

    // 火焰花：红色着色
    if (def.kind === "fireflower") {
      this.setTint(0xff4500);
    }

    // 记录未变异时的基础比例，供形态缩放乘算
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;

    // 常驻"呼吸感"：轻微上下浮动 + 根部微晃（不碰缩放，避免与种植/融合弹性动画冲突）
    const baseY = cy;
    scene.tweens.add({
      targets: this,
      y: baseY - 4,
      duration: 900 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // 变异"形态"（每个 tier 一种清晰形态，而非把特效叠在原始贴图上）：
    // - weak 凋零形：灰暗枯槁 + 收缩
    // - super/怪物 传说形：金身 + 能量光环 + 星屑（稳定形态，非闪烁噪声）
    // - normal 晋级形：维持本体，靠进化动画呈现升级
    if (variant.fused) {
      if (variant.tier === "super") {
        this.baseScaleX *= 1.25;
        this.baseScaleY *= 1.25;
        // 有具象 super 贴图（自带金身外观）则不再叠加 tint，避免双重上色
        if (!hasFormTexture(def.kind, "super")) this.formTint = 0xffc94d;
        const aura = scene.add.image(this.x, this.y - 42, "aura_gold").setDepth(9).setAlpha(0);
        scene.tweens.add({
          targets: aura,
          scale: { from: 0.7, to: 1.5 },
          alpha: { from: 0.6, to: 0.15 },
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
        const sparkle = scene.add
          .particles(this.x, this.y - 42, "dot", {
            follow: this,
            frequency: 100,
            quantity: 2,
            lifespan: 800,
            speed: { min: 10, max: 40 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.7, end: 0 },
            tint: [0xffd94d, 0xfff0a0, 0xffffff],
            alpha: { start: 0.9, end: 0 },
          })
          .setDepth(9);
        this.on("destroy", () => {
          aura.destroy();
          sparkle.destroy();
        });
      } else if (variant.tier === "weak") {
        this.baseScaleX *= 0.85;
        this.baseScaleY *= 0.85;
        // 有具象 weak 贴图（灰败垂头造型）则不再叠加灰 tint
        if (!hasFormTexture(def.kind, "weak")) this.formTint = 0x9a9a9a;
      }
      this.applyForm();
      // 形态专属常驻光环（在 tier 效果之上叠加）
      this.addFormAura(scene);
    }

    // 初始化随机加成结束时间
    if (variant.randomBonus?.duration) {
      this.bonusEndTime = scene.time.now + variant.randomBonus.duration;
    }

    const behavior = PLANT_BEHAVIORS[def.kind];
    if (behavior.fuseMs) {
      this.fuseAt = scene.time.now + behavior.fuseMs;
      scene.tweens.add({
        targets: this,
        scale: this.scale * 1.12,
        duration: behavior.fuseMs / 2,
        yoyo: true,
      });
      // 引信火花
      this.fuseEmitter = scene.add
        .particles(this.x, this.y - 74, "dot", {
          speed: { min: 30, max: 90 },
          angle: { min: 240, max: 300 },
          gravityY: 260,
          lifespan: { min: 180, max: 320 },
          scale: { start: 0.8, end: 0 },
          frequency: 45,
          quantity: 1,
          tint: [0xffd94d, 0xff8a3d],
        })
        .setDepth(46);
    }
    if (behavior.armMs) {
      this.armedAt = scene.time.now + behavior.armMs;
      this.setAlpha(0.55);
      this.setScale(this.scaleX * 0.72, this.scaleY * 0.72);
      this.setTint(0xb0a48c);
    }
    scene.add.existing(this);

    // 高射炮：灰色着色，突出金属质感
    if (def.kind === "flakcannon") {
      this.setTint(0x696969);
    }
  }

  /** 落到当前形态：应用形态缩放 + 形态染色（瞬时动画不与它冲突） */
  private applyForm(): void {
    this.setScale(this.baseScaleX, this.baseScaleY);
    // 形态特定染色
    const formId = this.variant.formId;
    if (formId === "ice") {
      this.formTint = 0x88ccff;
    } else if (formId === "flame") {
      this.formTint = 0xff6633;
    } else if (formId === "lightning") {
      this.formTint = 0xffee44;
    } else if (formId === "laser") {
      this.formTint = 0xff4444;
    } else if (formId === "missile") {
      this.formTint = 0xff8844;
    } else if (formId === "drone") {
      this.formTint = 0x44ff88;
    }
    if (this.formTint !== null) this.setTint(this.formTint);
  }

  /** 形态专属常驻光环：在 tier 效果之上叠加，让每种形态有独立视觉 identity */
  private addFormAura(scene: Phaser.Scene): void {
    const formId = this.variant.formId;
    if (!formId || formId === "base") return;
    const auras: Phaser.GameObjects.GameObject[] = [];

    if (formId === "flame") {
      // 火焰形态：脚下火焰粒子持续上升
      const fire = scene.add
        .particles(this.x, this.y - 10, "flame", {
          follow: this,
          frequency: 80,
          quantity: 1,
          lifespan: 500,
          speedY: { min: -60, max: -20 },
          speedX: { min: -15, max: 15 },
          scale: { start: 0.8, end: 0 },
          alpha: { start: 0.8, end: 0 },
          tint: [0xff6b3d, 0xffd94d],
        })
        .setDepth(8);
      auras.push(fire);
    } else if (formId === "ice") {
      // 寒冰形态：冰晶光环脉冲
      const iceAura = scene.add.image(this.x, this.y - 40, "aura_ice").setDepth(8).setAlpha(0);
      scene.tweens.add({
        targets: iceAura,
        scale: { from: 0.6, to: 1.1 },
        alpha: { from: 0.4, to: 0.1 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
      });
      auras.push(iceAura);
    } else if (formId === "lightning") {
      // 雷电形态：电弧闪烁
      const spark = scene.add
        .particles(this.x, this.y - 40, "dot", {
          follow: this,
          frequency: 100,
          quantity: 2,
          lifespan: 300,
          speedY: { min: -40, max: -10 },
          speedX: { min: -20, max: 20 },
          scale: { start: 0.5, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xffee44, 0xffffff],
        })
        .setDepth(8);
      auras.push(spark);
    } else if (formId === "laser") {
      // 激光形态：红色准星光环
      const laserAura = scene.add.image(this.x, this.y - 40, "aura_rift").setDepth(8).setAlpha(0).setTint(0xff4444);
      scene.tweens.add({
        targets: laserAura,
        scale: { from: 0.4, to: 0.9 },
        alpha: { from: 0.5, to: 0.15 },
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
      auras.push(laserAura);
    } else if (formId === "missile") {
      // 导弹形态：烟雾尾迹
      const smoke = scene.add
        .particles(this.x, this.y - 20, "dot", {
          follow: this,
          frequency: 60,
          quantity: 1,
          lifespan: 600,
          speedY: { min: -10, max: 10 },
          speedX: { min: -10, max: 10 },
          scale: { start: 0.8, end: 0.2 },
          alpha: { start: 0.5, end: 0 },
          tint: [0x888888, 0xaaaaaa],
        })
        .setDepth(8);
      auras.push(smoke);
    } else if (formId === "drone") {
      // 无人机形态：绿色扫描光环
      const droneAura = scene.add.image(this.x, this.y - 40, "aura_toxic").setDepth(8).setAlpha(0).setTint(0x44ff88);
      scene.tweens.add({
        targets: droneAura,
        angle: 360,
        duration: 2000,
        repeat: -1,
      });
      scene.tweens.add({
        targets: droneAura,
        scale: { from: 0.5, to: 1.0 },
        alpha: { from: 0.4, to: 0.1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
      auras.push(droneAura);
    }
    if (auras.length > 0) {
      this.on("destroy", () => auras.forEach((a) => a.destroy()));
    }
  }

  /** 恢复形态样貌（针对产阳光/受击等瞬时高亮后复位，而非清成白色） */
  private restoreForm(): void {
    if (this.formTint !== null) {
      this.setTint(this.formTint);
    } else {
      this.clearTint();
    }
  }

  /** 落成形态色（供融合进化动画亮核→形态色过渡），null=本体原色 */
  get formColor(): number | null {
    return this.formTint;
  }

  get alive(): boolean {
    return !this.dead;
  }

  updateGame(time: number, ctx: PlantCtx): void {
    if (this.dead) return;
    const behavior = PLANT_BEHAVIORS[this.kind];

    // 仙人掌：对空攻击
    if (this.kind === "cactus" && behavior.atk && behavior.rateMs) {
      const hasAirTarget = ctx.hasAirTargetInRow(this.row, this.x);
      if (time >= this.nextAttackAt && hasAirTarget) {
        this.nextAttackAt = time + Math.round(behavior.rateMs * this.variant.rateMul);
        const dmg = Math.round(behavior.atk * this.variant.atkMul);
        ctx.spawnBullet(this.row, this.x + 26, this.y - 58, "spike", dmg, false, { isAirAttack: true });
        ctx.onPlantShoot(this.kind, this.x + 46, this.y - 58);
        ctx.sfx.shoot();
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 0.94,
          duration: 60,
          yoyo: true,
        });
      }
    }

    // 地刺：对经过的僵尸造成伤害
    if (this.kind === "spikeweed" && behavior.atk && behavior.rateMs) {
      if (time >= this.nextAttackAt) {
        const hasTarget = ctx.hasZombieNear(this.row, this.x, 60);
        if (hasTarget) {
          this.nextAttackAt = time + Math.round(behavior.rateMs * this.variant.rateMul);
          const dmg = Math.round(behavior.atk * this.variant.atkMul);
          ctx.damageZombiesInRadius(this.row, this.x, 60, dmg);
          this.scene.tweens.add({
            targets: this,
            scaleY: this.scaleY * 0.8,
            duration: 50,
            yoyo: true,
          });
        }
      }
    }

    // 樱桃炸弹 / 火爆辣椒引信
    if (behavior.fuseMs && this.fuseAt > 0 && time >= this.fuseAt) {
      this.fuseAt = 0;
      if (behavior.boomRadiusCells) {
        ctx.explodeAt(this.row, this.col, behavior.boomRadiusCells, behavior.atk ?? 1800);
      } else {
        ctx.burnRow(this.row, behavior.atk ?? 1800);
      }
      this.kill();
      return;
    }

    // 土豆地雷：武装 + 触发（全格碰撞判定，不依赖精确距离）
    if (behavior.armMs) {
      if (this.armedAt > 0 && time >= this.armedAt) {
        this.armedAt = 0;
        this.setAlpha(1);
        this.setScale(this.scaleX / 0.72, this.scaleY / 0.72);
        this.clearTint();
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 1.08,
          scaleY: this.scaleY * 1.08,
          duration: 90,
          yoyo: true,
        });
      }
      if (this.armedAt === 0) {
        // 检测半径 55：僵尸嘴在 mine.x+55 处触发吃，此时僵尸中心≈mine.x+46，
        // 原 46 配 <46 刚好卡边界漏检；55 留足余量且不跨格误触
        if (ctx.hasZombieNear(this.row, this.x, 55)) {
          ctx.detonateMine(this);
          this.kill();
          return;
        }
        // 武装后天线呼吸闪烁（只挂一次）
        if (!this.mineBlinkStarted) {
          this.mineBlinkStarted = true;
          this.scene.tweens.add({
            targets: this,
            alpha: { from: 1, to: 0.72 },
            duration: 380,
            yoyo: true,
            repeat: -1,
          });
        }
      }
    }

    // 大嘴花：近战吞噬前格僵尸（贪食序列：咬合→咀嚼→重张）
    if (behavior.biteDamage && behavior.biteCooldownMs) {
      if (time >= this.biteReadyAt && ctx.hasZombieNear(this.row, this.x, (behavior.biteRangeCells ?? 1) * 90)) {
        this.biteReadyAt = time + Math.round(behavior.biteCooldownMs * this.variant.rateMul);
        const dmg = Math.round(behavior.biteDamage * this.variant.atkMul);
        const bit = ctx.chomperBite(this.row, this.x, behavior.biteRangeCells ?? 1, dmg);
        if (bit) {
          const squash = this.variant.isMonster ? 1.32 : 1.18;
          this.setScale(this.scaleX * squash, this.scaleY * 0.76);
          this.scene.tweens.add({
            targets: this,
            scaleX: this.scaleX / squash,
            scaleY: this.scaleY / 0.76,
            duration: 170,
            ease: "Back.easeOut",
            yoyo: true,
            repeat: this.variant.skill === "stun" ? 2 : 1,
          });
          ctx.sfx.chomp();
          if (this.variant.skill === "stun") ctx.sfx.explode();
        }
      }
    }

    // 高射炮：远程范围攻击，发射炮弹造成溅射伤害
    if (this.kind === "flakcannon" && behavior.atk && behavior.rateMs) {
      const hasTarget = ctx.hasZombieInRow(this.row, this.x);
      if (time >= this.nextAttackAt && hasTarget) {
        let rateMul = this.variant.rateMul;
        let atkMul = this.variant.atkMul;
        if (this.variant.randomBonus) {
          const bonus = this.variant.randomBonus;
          const isActive = bonus.duration ? time < this.bonusEndTime : true;
          if (isActive) {
            if (bonus.type === 'speed') rateMul *= bonus.value;
            if (bonus.type === 'damage') atkMul *= bonus.value;
          }
        }
        this.nextAttackAt = time + Math.round(behavior.rateMs * rateMul);
        const dmg = Math.round(behavior.atk * atkMul);
        ctx.spawnBullet(this.row, this.x + 26, this.y - 58, "cannonball", dmg, false, {
          splashCells: behavior.splashRadiusCells ?? 1.5,
        });
        ctx.onPlantShoot(this.kind, this.x + 46, this.y - 58);
        ctx.sfx.shoot();
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 0.94,
          duration: 60,
          yoyo: true,
        });
        if (this.variant.randomBonus) {
          this.showBonusEffect(this.variant.randomBonus.type);
        }
      }
    }

    // 仙人球：范围对空攻击，发射球形尖刺可命中多个空中单位
    if (this.kind === "cactusball" && behavior.atk && behavior.rateMs) {
      const hasAirTarget = ctx.hasAirTargetInRow(this.row, this.x);
      if (time >= this.nextAttackAt && hasAirTarget) {
        this.nextAttackAt = time + Math.round(behavior.rateMs * this.variant.rateMul);
        const dmg = Math.round(behavior.atk * this.variant.atkMul);
        ctx.spawnBullet(this.row, this.x + 26, this.y - 58, "cactusball", dmg, false, {
          isAirAttack: true,
          splashCells: behavior.splashRadiusCells,
        });
        ctx.onPlantShoot(this.kind, this.x + 46, this.y - 58);
        ctx.sfx.shoot();
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 0.94,
          duration: 60,
          yoyo: true,
        });
      }
    }

    // 火焰花：穿透攻击，发射火焰弹可穿透多个目标
    if (this.kind === "fireflower" && behavior.atk && behavior.rateMs) {
      const hasTarget = ctx.hasZombieInRow(this.row, this.x);
      if (time >= this.nextAttackAt && hasTarget) {
        this.nextAttackAt = time + Math.round(behavior.rateMs * this.variant.rateMul);
        const dmg = Math.round(behavior.atk * this.variant.atkMul);
        ctx.spawnBullet(this.row, this.x + 26, this.y - 58, "fireball", dmg, false, {
          pierceCount: behavior.pierceCount,
          burnDmg: behavior.burnDmg,
          burnMs: behavior.burnMs,
        });
        ctx.onPlantShoot(this.kind, this.x + 46, this.y - 58);
        ctx.sfx.shoot();
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 0.94,
          duration: 60,
          yoyo: true,
        });
      }
    }

    // 射手类（应用变异攻击/攻速乘区 + 三线/双发）
    if (behavior.atk && behavior.rateMs) {
      const rows = behavior.triShot ? this.triLines() : [this.row];
      const hasTarget = rows.some((r) => ctx.hasZombieInRow(r, this.x));
      if (time >= this.nextAttackAt && hasTarget) {
        // 应用随机加成
        let rateMul = this.variant.rateMul;
        let atkMul = this.variant.atkMul;
        if (this.variant.randomBonus) {
          const bonus = this.variant.randomBonus;
          const isActive = bonus.duration ? time < this.bonusEndTime : true;
          if (isActive) {
            if (bonus.type === 'speed') rateMul *= bonus.value;
            if (bonus.type === 'damage') atkMul *= bonus.value;
          }
        }
        this.nextAttackAt = time + Math.round(behavior.rateMs * rateMul);
        const dmg = Math.round(behavior.atk * atkMul);
        const { kind, slow, opts } = this.shotFlavor();
        for (const r of rows) ctx.spawnBullet(r, this.x + 26, this.y - 58, kind, dmg, slow, opts);
        if (behavior.doubleShot) {
          this.scene.time.delayedCall(180, () => {
            if (this.active && !this.dead) {
              for (const r of rows) ctx.spawnBullet(r, this.x + 26, this.y - 58, kind, dmg, slow, opts);
              ctx.onPlantShoot(this.kind, this.x + 46, this.y - 58);
            }
          });
        }
        // 三连炮技能：额外发射2发（延迟间隔）
        if (this.variant.skill === "rapidfire") {
          for (let i = 1; i <= 2; i++) {
            this.scene.time.delayedCall(100 * i, () => {
              if (this.active && !this.dead) {
                for (const r of rows) ctx.spawnBullet(r, this.x + 26, this.y - 58, kind, dmg, slow, opts);
                ctx.onPlantShoot(this.kind, this.x + 46, this.y - 58);
              }
            });
          }
        }
        ctx.onPlantShoot(this.kind, this.x + 46, this.y - 58);
        ctx.sfx.shoot();
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 0.94,
          duration: 60,
          yoyo: true,
        });
        // 随机加成视觉特效
        if (this.variant.randomBonus) {
          this.showBonusEffect(this.variant.randomBonus.type);
        }
      }
    }

    // 荆棘反伤：周期性对周围僵尸造成伤害
    if (this.variant.skill === "thorns") {
      const pulseMs = 2000;
      if (time >= this.thornsLastPulse + pulseMs) {
        this.thornsLastPulse = time;
        const thornsDmg = Math.round((behavior.atk ?? 20) * this.variant.atkMul * 0.6);
        ctx.damageZombiesInRadius(this.row, this.x, 80, thornsDmg);
      }
    }

    // 自我修复：周期性恢复血量
    if (this.variant.skill === "regen") {
      const tickMs = 3000;
      if (time >= this.regenLastTick + tickMs) {
        this.regenLastTick = time;
        const healAmt = 15;
        this.hp = Math.min(this.maxHp, this.hp + healAmt);
      }
    }
  }

  /** 三线射手：本行 + 上下相邻行（越界过滤） */
  private triLines(): number[] {
    return [this.row - 1, this.row, this.row + 1].filter((r) => r >= 0 && r < ROWS);
  }

  /** 由行为 + 变异技能 + 形态决定弹丸类型与特殊参数 */
  private shotFlavor(): { kind: Projectile; slow: boolean; opts: BulletOpts } {
    const b = PLANT_BEHAVIORS[this.kind];
    const s = this.variant.skill;
    const opts: BulletOpts = {};
    let kind: Projectile = "pea";

    // 形态弹丸优先级高于基础行为
    const formProjectile = this.getFormProjectile();
    if (formProjectile && formProjectile !== "pea") {
      kind = formProjectile as Projectile;
      // 形态专属弹丸行为
      if (kind === "fireball") {
        opts.splashCells = 1;
        opts.burnDmg = 8;
        opts.burnMs = 3000;
      } else if (kind === "axe") {
        opts.pierceCount = 2;
        opts.freezeMs = 600;
      } else if (kind === "chain") {
        opts.chainCount = 2;
        opts.chainDecay = 0.6;
      } else if (kind === "beam") {
        // 激光穿透所有目标
      } else if (kind === "missile") {
        opts.explosionRadius = 90;
      } else if (kind === "drone") {
        opts.explosionRadius = 120;
      } else if (kind === "spike") {
        opts.pierceCount = 1;
        opts.isAirAttack = true;
      }
    } else if (b.splashRadiusCells) {
      kind = this.kind === "wintermelon" ? "wintermelon" : "melon";
      opts.splashCells = b.splashRadiusCells ?? 1;
    } else if (b.slow) {
      kind = "icepea";
    }

    // 技能附加效果
    if (s === "slow") {
      opts.freezeMs = 3000;
    } else if (s === "stun") {
      opts.stunChance = 0.25;
      opts.stunDurationMs = 1500;
    } else if (s === "knockback") {
      opts.knockbackChance = 0.4;
      opts.knockbackDistance = 60;
    } else if (s === "pierce") {
      opts.pierceCount = -1; // 无限穿透：穿透整行所有僵尸 else if (s === "bounce") {
      opts.bounceCount = 2;
      opts.bounceRange = 120;
      opts.bounceDamageDecay = 0.6;
    } else if (s === "explode") {
      opts.explosionRadius = 90;
    } else if (s === "burn") {
      opts.burnDmg = 8;
      opts.burnMs = 3000;
    }

    return { kind, slow: kind !== "pea", opts };
  }

  /** 获取形态弹丸类型（从 variant 的 formId 推断） */
  private getFormProjectile(): string | null {
    const formId = this.variant.formId;
    if (!formId || formId === "base") return null;
    const FORM_PROJECTILE: Record<string, string> = {
      flame: "fireball",
      ice: "axe",
      lightning: "chain",
      laser: "beam",
      missile: "missile",
      drone: "drone",
      air: "spike",
    };
    return FORM_PROJECTILE[formId] ?? null;
  }

  /** 显示随机加成视觉特效 */
  private showBonusEffect(bonusType: RandomBonus['type']): void {
    if (!this.active || this.dead) return;

    const effectConfig: Record<string, { color: number; scale: number }> = {
      crit: { color: 0xff4444, scale: 1.15 },
      pierce: { color: 0x44ff44, scale: 1.1 },
      splash: { color: 0x4444ff, scale: 1.12 },
      slow: { color: 0x88ccff, scale: 1.08 },
      speed: { color: 0xffee44, scale: 1.1 },
      damage: { color: 0xff8844, scale: 1.12 },
    };

    const config = effectConfig[bonusType];
    if (!config) return;

    // 闪白效果
    this.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (this.active && !this.dead) this.restoreForm();
    });

    // 粒子特效
    const particles = this.scene.add
      .particles(this.x, this.y - 42, "dot", {
        speed: { min: 20, max: 50 },
        angle: { min: 0, max: 360 },
        lifespan: 400,
        scale: { start: 0.6, end: 0 },
        tint: config.color,
        quantity: 3,
      })
      .setDepth(10);

    this.scene.time.delayedCall(400, () => {
      particles.destroy();
    });
  }

  takeDamage(dmg: number): void {
    if (this.dead) return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.kill();
      return;
    }
    // 被啃食摇摆反馈
    this.scene.tweens.add({
      targets: this,
      angle: { from: -3.5, to: 3.5 },
      duration: 55,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.setAngle(0),
    });
    // 坚果/高坚果 被啃破损状态
    if (this.kind === "wallnut" || this.kind === "tallnut") {
      const ratio = this.hp / this.maxHp;
      if (this.kind === "wallnut") {
        if (ratio <= 0.33) {
          this.setTexture("wallnut_cracked");
          this.setTint(0xb08a6a);
        } else if (ratio <= 0.66) {
          this.setTexture("wallnut_cracked");
        }
      } else {
        // tallnut：破损时变暗 + 变形
        if (ratio <= 0.33) {
          this.setTint(0x8a6a4a);
          this.setScale(this.scaleX * 1.02, this.scaleY * 0.96);
        } else if (ratio <= 0.66) {
          this.setTint(0x9a7a5a);
        }
      }
    }
  }

  kill(): void {
    if (this.dead) return;
    this.dead = true;
    this.fuseEmitter?.destroy();
    this.fuseEmitter = null;
  }

  playDeath(ctx: PlantCtx, onDone: () => void): void {
    ctx.onPlantDead(this);
    this.scene.tweens.killTweensOf(this);
    this.fuseEmitter?.destroy();
    this.fuseEmitter = null;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: -30,
      scaleY: this.scaleY * 0.6,
      duration: 260,
      onComplete: () => {
        onDone();
        this.destroy();
      },
    });
  }
}
