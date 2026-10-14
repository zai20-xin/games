import Phaser from "phaser";
import {
  EAT_DMG,
  EAT_TICK_MS,
  LAWN_X,
  SLOW_DURATION_MS,
  SLOW_SPEED_MUL,
  ZOMBIE_DEFS,
  ZOMBIE_ABILITIES,
  type ZombieDef,
  type ZombieKind,
  type ZombieAbility,
} from "../config";
import type { Sfx } from "../systems/Sfx";
import type { Plant } from "./Plant";

export interface ZombieCtx {
  plantInFront(row: number, mouthX: number): Plant | undefined;
  requestMower(row: number, zombie: Zombie): void;
  onZombieDeath(zombie: Zombie): void;
  hasAirTarget(row: number, x: number): boolean;
  summonZombie(row: number, x: number, kind: ZombieKind): void;
  sfx: Sfx;
}

export type ZombieState = "walk" | "eat" | "dying";

export class Zombie extends Phaser.GameObjects.Sprite {
  readonly kind: ZombieKind;
  readonly def: ZombieDef;
  readonly row: number;
  hp: number;
  armor: number;
  private baseSpeed: number;
  private speedMul = 1;
  private slowUntil = 0;
  private slowed = false;
  private nextBiteAt = 0;
  private aiState: ZombieState = "walk";
  /** 咬合朝向：两次 bite 间在低头/抬头切换，用 lerp 平滑过渡 */
  private biting = false;
  private readonly baseY: number;
  private readonly phase = Math.random() * Math.PI * 2;
  /** 死亡结算标记：onZombieDeath 恰好触发一次 */
  counted = false;
  /** 特殊能力冷却 */
  private abilityCooldown = 0;
  /** 是否为飞行单位（气球僵尸） */
  isFlying = false;
  /** 是否在地下移动（矿工僵尸） */
  isUnderground = false;
  /** 飞行高度偏移 */
  private flyingHeight = 0;

  constructor(
    scene: Phaser.Scene,
    row: number,
    x: number,
    y: number,
    kind: ZombieKind,
    private readonly ctx: ZombieCtx,
    scale: { hpMul: number; armorMul: number; speedMul: number } = { hpMul: 1, armorMul: 1, speedMul: 1 }
  ) {
    const def = ZOMBIE_DEFS[kind];
    super(scene, x, y, def.texture);
    this.kind = kind;
    this.def = def;
    this.row = row;
    this.hp = Math.round(def.hp * scale.hpMul);
    this.armor = Math.round(def.armor * scale.armorMul);
    this.baseSpeed = def.speed * scale.speedMul;
    this.baseY = y;
    this.setOrigin(0.5, 1);
    this.setDisplaySize(96, 108);
    this.setDepth(20 + row);
    // 僵尸猎犬：赤红着色 + 缩小前倾，一眼可辨的快速突袭者
    if (kind === "runner") {
      this.setTint(0xcf5a2a);
      this.setScale(0.84, 0.84);
    }
    // 矿工僵尸：棕色着色，暗示地下工作者
    if (kind === "digger") {
      this.setTint(0x8b4513);
    }
    // 气球僵尸：天蓝色着色 + 飞行高度偏移
    if (kind === "balloon") {
      this.setTint(0x87ceeb);
      this.isFlying = true;
      this.flyingHeight = 60;
      this.y -= this.flyingHeight;
      this.setDepth(30 + row); // 空中单位显示在更上层
    }
    // 投石车僵尸：灰色着色 + 重甲视觉
    if (kind === "catapult") {
      this.setTint(0x696969);
    }
    // 巨人僵尸：体型放大1.5倍 + 棕色着色
    if (kind === "giant") {
      this.setScale(1.5, 1.5);
      this.setTint(0x8b4513);
    }
    // 舞王僵尸：紫色着色
    if (kind === "dancer") {
      this.setTint(0x9932cc);
    }
    scene.add.existing(this);
  }

  get isDying(): boolean {
    return this.aiState === "dying";
  }

  get mouthX(): number {
    return this.x - 30;
  }

  /**
   * 平滑逼近目标倾角。头饰与头在同一贴图内刚性一体、绕底部(origin 0.5,1)旋转，
   * 无需（也不会）产生相对位移；这里用 lerp 消除 walk/eat/咬合之间的角度硬切，
   * 避免帽子与头部在状态切换瞬间出现"抽动被误读为穿模"的突兀观感。
   */
  private smoothAngle(target: number, k: number): void {
    this.angle = Phaser.Math.Linear(this.angle, target, k);
  }

  /** 深冻：更彻底的强减速 + 冰蓝结冰视觉（极寒/三重寒冰技能） */
  freeze(ms: number): void {
    if (this.aiState === "dying") return;
    this.slowed = true;
    this.slowUntil = this.scene.time.now + ms;
    this.speedMul = 0.14;
    this.setTint(0xbfe8ff);
  }

  updateGame(time: number, delta: number): void {
    if (this.aiState === "dying") return;

    // 减速到期恢复
    if (this.slowed && time > this.slowUntil) {
      this.slowed = false;
      this.speedMul = 1;
      this.clearTint();
    }

    // 特殊能力冷却
    if (this.abilityCooldown > 0) {
      this.abilityCooldown -= delta;
    }

    // 执行特殊能力
    this.executeAbility(time);

    // 矿工僵尸：地下移动
    if (this.isUnderground) {
      this.undergroundMove(delta);
      return;
    }

    // 气球僵尸：飞行移动
    if (this.isFlying) {
      this.flyingMove(time, delta);
      return;
    }

    if (this.aiState === "eat") {
      const target = this.ctx.plantInFront(this.row, this.mouthX);
      if (!target || !target.alive) {
        this.aiState = "walk";
        // 不 return：同帧继续走，避免原地停顿
      } else {
        if (time >= this.nextBiteAt) {
          this.nextBiteAt = time + EAT_TICK_MS;
          target.takeDamage(EAT_DMG);
          this.ctx.sfx.chomp();
          this.biting = !this.biting;
        }
        // 咬合低头/抬头（带呼吸感 + 平滑过渡），帽沿不抽蓄
        this.smoothAngle(this.biting ? -6 : 2, 0.18);
        return;
      }
    }

    // walk
    const dt = delta / 1000;
    this.x -= this.baseSpeed * this.speedMul * dt;
    this.y = this.baseY + Math.sin(time * 0.008 + this.phase) * 1.6;
    this.smoothAngle(Math.sin(time * 0.006 + this.phase) * 2.2, 0.12);

    const target = this.ctx.plantInFront(this.row, this.mouthX);
    if (target && target.alive) {
      this.aiState = "eat";
      this.biting = false;
      this.nextBiteAt = time;
      return;
    }

    if (this.x < 104) {
      this.ctx.requestMower(this.row, this);
    }
    // 防御：走出屏外仍强制结算，避免幽灵僵尸
    if (this.x < -80 && !this.counted) {
      this.die();
    }
  }

  takeDamage(dmg: number, slow = false): void {
    if (this.aiState === "dying") return;
    // 气球僵尸免疫地面攻击（除非是对空攻击伤害>=1000）
    if (this.isFlying && dmg < 1000) {
      return;
    }
    if (slow) {
      this.slowed = true;
      this.slowUntil = this.scene.time.now + SLOW_DURATION_MS;
      this.speedMul = SLOW_SPEED_MUL;
      this.setTint(0x7fc4ff);
    }
    if (this.armor > 0) {
      this.armor -= dmg;
      if (this.armor < 0) {
        this.hp += this.armor; // 溢出伤害落到本体
        this.armor = 0;
        this.setTexture(this.def.baseTexture);
      }
    } else {
      this.hp -= dmg;
    }
    // 受击闪白（死亡动画期间也及时清除，避免整段倒下都是白影）
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (!this.active) return;
      this.clearTint();
      if (this.slowed && this.aiState !== "dying") this.setTint(0x7fc4ff);
    });
    if (this.hp <= 0) this.die();
  }

  die(): void {
    if (this.aiState === "dying") return;
    this.aiState = "dying";
    this.angle = 0;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      angle: -85,
      alpha: 0,
      y: this.y + 14,
      duration: 480,
      ease: "Quad.easeIn",
      onComplete: () => this.destroy(),
    });
    // 同步结算，不依赖 update 循环时序
    if (!this.counted) {
      this.counted = true;
      this.ctx.onZombieDeath(this);
    }
  }

  /** 执行特殊能力 */
  private executeAbility(time: number): void {
    if (this.abilityCooldown > 0) return;

    const ability = ZOMBIE_ABILITIES[this.kind];
    if (!ability) return;

    switch (ability.type) {
      case 'stomp':
        this.stompAttack(ability);
        break;
      case 'summon':
        this.summonMinions(ability);
        break;
      case 'ground':
        this.startUnderground();
        break;
      case 'flying':
        // 气球僵尸始终飞行，无需额外触发
        break;
      case 'ranged':
        this.rangedAttack(ability);
        break;
    }

    this.abilityCooldown = ability.cooldownMs;
  }

  /** 巨人僵尸：锤击地面，对前方植物造成范围伤害 */
  private stompAttack(ability: ZombieAbility): void {
    const damage = ability.damage ?? 100;
    const radius = ability.radius ?? 90;

    // 对前方植物造成伤害
    const target = this.ctx.plantInFront(this.row, this.mouthX);
    if (target && Math.abs(target.x - this.x) < radius) {
      target.takeDamage(damage);
    }

    // 视觉效果：地面震动
    this.scene.cameras.main.shake(200, 0.01);

    // 粒子效果：泥土飞溅
    const em = this.scene.add.particles(this.x, this.y, "dot", {
      speed: { min: 50, max: 150 },
      angle: { min: 180, max: 360 },
      gravityY: 300,
      lifespan: { min: 200, max: 400 },
      scale: { start: 1.5, end: 0 },
      tint: [0x8b4513, 0xa0522d],
      emitting: false,
    }).setDepth(45);
    em.explode(12);
    this.scene.time.delayedCall(500, () => em.destroy());
  }

  /** 舞王僵尸：召唤伴舞僵尸 */
  private summonMinions(ability: ZombieAbility): void {
    const summonKind = ability.summonKind ?? 'basic';
    const summonCount = ability.summonCount ?? 2;

    // 召唤动画：膨胀弹跳
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.2,
      scaleY: this.scaleY * 1.2,
      duration: 200,
      yoyo: true,
      ease: "Quad.easeOut",
    });

    // 召唤伴舞僵尸
    for (let i = 0; i < summonCount; i++) {
      const offsetX = (i - (summonCount - 1) / 2) * 40;
      this.scene.time.delayedCall(300 + i * 150, () => {
        this.ctx.summonZombie(this.row, this.x + offsetX, summonKind);
      });
    }

    // 视觉效果：音乐粒子特效
    const em = this.scene.add.particles(this.x, this.y - 50, "dot", {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      lifespan: 600,
      scale: { start: 0.8, end: 0 },
      tint: [0x9932cc, 0xba55d3, 0xffffff],
      emitting: false,
    }).setDepth(46);
    em.explode(8);
    this.scene.time.delayedCall(700, () => em.destroy());
  }

  /** 矿工僵尸：开始地下移动 */
  private startUnderground(): void {
    if (this.isUnderground) return;
    this.isUnderground = true;
    // 地下视觉：下沉 + 半透明
    this.y = this.baseY + 10;
    this.setAlpha(0.6);
    // 地面裂缝粒子
    const em = this.scene.add.particles(this.x, this.baseY, "dot", {
      speed: { min: 20, max: 60 },
      angle: { min: 0, max: 180 },
      gravityY: 200,
      lifespan: 400,
      scale: { start: 1.2, end: 0 },
      tint: [0x8b4513, 0xa0522d],
      emitting: false,
    }).setDepth(22);
    em.explode(6);
    this.scene.time.delayedCall(500, () => em.destroy());
  }

  /** 矿工僵尸：地下移动逻辑 */
  private undergroundMove(delta: number): void {
    const dt = delta / 1000;
    this.x -= this.baseSpeed * this.speedMul * dt;
    // 地下视觉：半透明 + 轻微下沉
    this.y = this.baseY + 10;
    // 地面裂缝拖尾粒子
    if (Math.random() < 0.3) {
      const em = this.scene.add.particles(this.x + 20, this.baseY, "dot", {
        speed: { min: 10, max: 30 },
        angle: { min: 0, max: 180 },
        gravityY: 100,
        lifespan: 300,
        scale: { start: 0.8, end: 0 },
        tint: 0x8b4513,
        emitting: false,
      }).setDepth(21);
      em.explode(2);
      this.scene.time.delayedCall(400, () => em.destroy());
    }
    // 到达植物后方时出现
    if (this.x < LAWN_X + 50) {
      this.isUnderground = false;
      this.setAlpha(1);
      this.y = this.baseY;
      // 出现动画：从地面弹出
      this.scene.tweens.add({
        targets: this,
        y: this.baseY - 20,
        duration: 300,
        ease: "Back.easeOut",
        yoyo: true,
      });
    }
  }

  /** 气球僵尸：飞行移动逻辑 */
  private flyingMove(time: number, delta: number): void {
    const dt = delta / 1000;
    this.x -= this.baseSpeed * this.speedMul * dt;
    // 飞行上下浮动
    this.y = this.baseY - this.flyingHeight + Math.sin(time * 0.005) * 8;
    // 检查是否到达房前
    if (this.x < 104) {
      this.ctx.requestMower(this.row, this);
    }
    // 防御：走出屏外仍强制结算
    if (this.x < -80 && !this.counted) {
      this.die();
    }
  }

  /** 投石车僵尸：远程投掷攻击 */
  private rangedAttack(ability: ZombieAbility): void {
    const damage = ability.damage ?? 80;
    const radius = ability.radius ?? 270;
    // 对前方植物造成伤害
    const target = this.ctx.plantInFront(this.row, this.mouthX);
    if (target && Math.abs(target.x - this.x) < radius) {
      target.takeDamage(damage);
      // 投掷视觉效果：石块飞溅
      const em = this.scene.add.particles(target.x, target.y - 30, "dot", {
        speed: { min: 60, max: 140 },
        angle: { min: 200, max: 340 },
        gravityY: 400,
        lifespan: { min: 200, max: 400 },
        scale: { start: 2, end: 0 },
        tint: [0x808080, 0x696969],
        emitting: false,
      }).setDepth(45);
      em.explode(8);
      this.scene.time.delayedCall(500, () => em.destroy());
    }
  }
}
