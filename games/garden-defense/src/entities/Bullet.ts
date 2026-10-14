import Phaser from "phaser";
import { HOME_Y, LAWN_Y, type AttackKind } from "../config";

export interface BulletTarget {
  y: number;
  x?: number;
  takeDamage(d: number): void;
  setSlow(m: number, ms: number, now: number): void;
}

export interface BulletCtx {
  findTarget(x: number, y: number): BulletTarget | null;
  findHomingTarget(x: number, y: number): BulletTarget | null;
  splashAt(x: number, y: number, dmg: number, radiusPx: number): void;
  onBulletHit(x: number, y: number, dmg: number): void;
}

export interface BulletOpts {
  attack?: AttackKind;
  slowMul?: number;
  slowMs?: number;
  splashCells?: number;
  sizePx?: number;
  trail?: boolean;
  vx?: number;
}

/** 多形态弹道：直线 / 追踪 / 抛物线 / 旋风 / 激光 */
export class Bullet extends Phaser.GameObjects.Image {
  private dmg: number;
  private ctx: BulletCtx;
  private attack: AttackKind;
  private slowMul?: number;
  private slowMs?: number;
  private splashCells?: number;
  private dead = false;
  private trail = false;
  private trailAcc = 0;
  private vx = 0;
  private vy = -520;
  private age = 0;
  private lifeMs = 4000;
  private spin = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, dmg: number, ctx: BulletCtx, opts: BulletOpts = {}) {
    super(scene, x, y, texture);
    this.dmg = dmg;
    this.ctx = ctx;
    this.attack = opts.attack ?? "straight";
    this.slowMul = opts.slowMul;
    this.slowMs = opts.slowMs;
    this.splashCells = opts.splashCells;
    this.trail = opts.trail ?? false;
    this.vx = opts.vx ?? 0;
    scene.add.existing(this);
    this.setDepth(8);

    const size = opts.sizePx ?? 16;
    if (this.attack === "laser") {
      this.setDisplaySize(10, 44);
      this.setAngle(0);
      this.setTint(0x9fe8ff);
      this.trail = true;
      this.vy = -980;
      this.lifeMs = 1200;
    } else if (this.attack === "whirl") {
      this.setDisplaySize(size + 8, size + 8);
      this.setTint(0xc4e8ff);
      this.vy = -180;
      this.spin = 0.35;
      this.lifeMs = 2600;
      this.trail = true;
    } else if (this.attack === "parabola") {
      this.setDisplaySize(size + 4, size + 4);
      this.vy = -420;
      this.vx = opts.vx ?? (Math.random() > 0.5 ? 40 : -40);
      this.lifeMs = 2200;
      this.trail = true;
    } else if (this.attack === "homing") {
      this.setDisplaySize(size, size);
      this.setTint(0xffb6c8);
      this.trail = true;
      this.vy = -380;
    } else {
      this.setDisplaySize(size, size);
      this.setAngle(Phaser.Math.Between(-20, 20));
    }
  }

  updateGame(dt: number): boolean {
    if (this.dead) return false;
    this.age += dt;
    const step = dt / 1000;

    if (this.attack === "homing") {
      const target = this.ctx.findHomingTarget(this.x, this.y);
      if (target && target.x != null) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = 420;
        this.vx = Phaser.Math.Linear(this.vx, (dx / len) * speed, 0.12);
        this.vy = Phaser.Math.Linear(this.vy, (dy / len) * speed, 0.12);
      } else {
        this.vy = Phaser.Math.Linear(this.vy, -420, 0.08);
        this.vx = Phaser.Math.Linear(this.vx, 0, 0.08);
      }
      this.x += this.vx * step;
      this.y += this.vy * step;
      this.rotation = Math.atan2(this.vy, this.vx) + Math.PI / 2;
    } else if (this.attack === "parabola") {
      this.vy += 520 * step;
      this.x += this.vx * step;
      this.y += this.vy * step;
      this.rotation += 0.12;
    } else if (this.attack === "whirl") {
      this.y += this.vy * step;
      this.rotation += this.spin;
      // 旋风：沿途减速/刮伤
      if (this.age % 180 < dt) {
        this.ctx.splashAt(this.x, this.y, Math.round(this.dmg * 0.25), 55);
        if (this.slowMul && this.slowMs) {
          const t = this.ctx.findTarget(this.x, this.y);
          if (t) t.setSlow(this.slowMul, this.slowMs, this.scene.time.now);
        }
      }
    } else if (this.attack === "laser") {
      this.y += this.vy * step;
    } else {
      this.y += this.vy * step;
      this.x += this.vx * step;
      this.rotation += 0.08;
    }

    if (this.trail) {
      this.trailAcc += dt;
      if (this.trailAcc >= 45) {
        this.trailAcc = 0;
        const t = this.scene.add
          .circle(this.x, this.y + 6, Math.max(2, this.displayWidth * 0.14), this.tintTopLeft, this.attack === "laser" ? 0.4 : 0.28)
          .setDepth(7);
        this.scene.tweens.add({
          targets: t,
          alpha: 0,
          scale: 0.25,
          duration: 150,
          onComplete: () => t.destroy(),
        });
      }
    }

    const outTop = this.y < LAWN_Y - 30;
    const outSide = this.x < 40 || this.x > 680;
    const tooOld = this.age > this.lifeMs;
    if (outTop || outSide || tooOld) {
      if (this.attack === "parabola" && this.splashCells) {
        this.ctx.splashAt(this.x, Math.max(this.y, LAWN_Y + 20), Math.round(this.dmg * 0.8), this.splashCells * 100);
        this.ctx.onBulletHit(this.x, this.y, this.dmg);
      }
      this.dead = true;
      this.destroy();
      return false;
    }

    // 激光：穿过多目标不消失（限时）
    if (this.attack === "laser") {
      const targets = this.ctx.findTarget(this.x, this.y);
      if (targets) {
        targets.takeDamage(this.dmg);
        this.ctx.onBulletHit(this.x, this.y, this.dmg);
      }
      return true;
    }

    const target = this.ctx.findTarget(this.x, this.y);
    if (target) {
      target.takeDamage(this.dmg);
      if (this.slowMul && this.slowMs) target.setSlow(this.slowMul, this.slowMs, this.scene.time.now);
      if (this.splashCells && this.attack !== "whirl") {
        this.ctx.splashAt(this.x, this.y, Math.round(this.dmg * 0.55), this.splashCells * 100);
      }
      this.ctx.onBulletHit(this.x, this.y, this.dmg);
      this.dead = true;
      this.destroy();
      return false;
    }
    return true;
  }
}

export function petHomeY(): number {
  return HOME_Y;
}
