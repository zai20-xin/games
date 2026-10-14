import Phaser from "phaser";
import { W } from "../config";

// 打击感特效集中器：粒子/飘字/冲击波/烧痕/泥土/白闪/混沌风暴
// 全部 create-per-burst + 定时自毁，量级小无需对象池
export class Fx {
  constructor(private readonly scene: Phaser.Scene) {}

  /** 炮口闪光（射手发射瞬间） */
  muzzleFlash(x: number, y: number, color: number): void {
    const flashDot = this.scene.add
      .image(x, y, "dot")
      .setTint(color)
      .setDepth(44)
      .setAlpha(0.9);
    this.scene.tweens.add({
      targets: flashDot,
      scale: { from: 0.6, to: 2.4 },
      alpha: 0,
      duration: 130,
      ease: "Quad.easeOut",
      onComplete: () => flashDot.destroy(),
    });
  }

  /** 引信火花（樱桃/辣椒待爆期间持续冒火星），返回发射器由调用方销毁 */
  fuseSparks(x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter {
    const em = this.scene.add
      .particles(x, y, "dot", {
        speed: { min: 30, max: 90 },
        angle: { min: 240, max: 300 },
        gravityY: 260,
        lifespan: { min: 180, max: 320 },
        scale: { start: 0.8, end: 0 },
        frequency: 55,
        quantity: 1,
        tint: [0xffd94d, 0xff8a3d],
      })
      .setDepth(46);
    return em;
  }

  /** 命中汁液飞溅 */
  hitBurst(x: number, y: number, color: number): void {
    const em = this.scene.add
      .particles(x, y, "dot", {
        speed: { min: 70, max: 180 },
        angle: { min: 190, max: 350 },
        gravityY: 420,
        lifespan: { min: 200, max: 380 },
        scale: { start: 1, end: 0.2 },
        tint: color,
        emitting: false,
      })
      .setDepth(45);
    em.explode(7);
    this.scene.time.delayedCall(600, () => em.destroy());
  }

  /** 伤害飘字 */
  damageText(x: number, y: number, dmg: number, crit = false): void {
    const txt = this.scene.add
      .text(x + Phaser.Math.Between(-10, 10), y - 10, `-${dmg}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: crit ? "22px" : "15px",
        color: crit ? "#ffd94d" : "#ffffff",
        stroke: "#26150a",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(55);
    this.scene.tweens.add({
      targets: txt,
      y: y - 38,
      alpha: 0,
      duration: crit ? 520 : 380,
      ease: "Quad.easeOut",
      onComplete: () => txt.destroy(),
    });
  }

  /** 僵尸死亡碎裂：绿色部件飞散 */
  shatter(x: number, y: number): void {
    const em = this.scene.add
      .particles(x, y - 40, "dot", {
        speed: { min: 90, max: 230 },
        angle: { min: 180, max: 360 },
        gravityY: 500,
        lifespan: { min: 300, max: 550 },
        scale: { start: 1.6, end: 0.2 },
        tint: [0x8aa06b, 0x5d564c, 0x33231a],
        emitting: false,
      })
      .setDepth(45);
    em.explode(14);
    this.scene.time.delayedCall(800, () => em.destroy());
  }

  /** 爆炸冲击波扩散环 */
  shockwave(x: number, y: number, size: number): void {
    const ring = this.scene.add
      .image(x, y, "ring")
      .setDisplaySize(30, 30)
      .setTint(0xffd9a0)
      .setDepth(52)
      .setAlpha(1);
    this.scene.tweens.add({
      targets: ring,
      displayWidth: size,
      displayHeight: size,
      alpha: 0,
      duration: 380,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /** 爆炸白闪 */
  flash(alpha = 0.35): void {
    const rect = this.scene.add
      .rectangle(0, 0, 1040, 640, 0xffffff, alpha)
      .setOrigin(0)
      .setDepth(58);
    this.scene.tweens.add({
      targets: rect,
      alpha: 0,
      duration: 180,
      onComplete: () => rect.destroy(),
    });
  }

  /** 烧痕残留（爆炸/火焰后） */
  scorch(x: number, y: number, w: number, h: number, tint = 0x2a1d10): void {
    const mark = this.scene.add
      .image(x, y, "scorch")
      .setDisplaySize(w, h)
      .setTint(tint)
      .setAlpha(0.45)
      .setDepth(2);
    this.scene.tweens.add({
      targets: mark,
      alpha: 0,
      delay: 2500,
      duration: 3500,
      onComplete: () => mark.destroy(),
    });
  }

  /** 种植泥土飞溅 */
  dirtBurst(x: number, y: number): void {
    const em = this.scene.add
      .particles(x, y, "dot", {
        speed: { min: 50, max: 140 },
        angle: { min: 220, max: 320 },
        gravityY: 460,
        lifespan: { min: 220, max: 400 },
        scale: { start: 1.2, end: 0.2 },
        tint: [0x6e4a28, 0x8a6132],
        emitting: false,
      })
      .setDepth(45);
    em.explode(9);
    this.scene.time.delayedCall(600, () => em.destroy());
  }

  /** 火焰横扫（火爆辣椒整行） */
  fireSweep(x: number, y: number, width: number, onDone: () => void): void {
    const em = this.scene.add
      .particles(x, y, "flame", {
        speedX: { min: -60, max: 60 },
        speedY: { min: -90, max: -20 },
        lifespan: { min: 250, max: 480 },
        scale: { start: 1.6, end: 0.1 },
        quantity: 4,
        frequency: 22,
        tint: [0xff8a3d, 0xffc93c, 0xff5a2b],
        emitting: true,
      })
      .setDepth(48);
    em.emitParticleAt(x, y, 12);
    this.scene.tweens.add({
      targets: em,
      x: x + width,
      duration: 420,
      ease: "Quad.easeIn",
      onComplete: () => {
        onDone();
        this.scene.time.delayedCall(500, () => em.destroy());
      },
    });
  }

  /** 融合变异粒子爆发：tier 决定颜色和强度 */
  fusionBurst(x: number, y: number, tier: "weak" | "normal" | "super"): void {
    const colors = {
      super: [0xffd94d, 0xffec80, 0xffffff],
      normal: [0xa8e87c, 0x8ad06a, 0xc8f8a8],
      weak: [0x999999, 0xaaaaaa, 0x777777],
    };
    const count = tier === "super" ? 18 : tier === "weak" ? 6 : 10;
    const em = this.scene.add
      .particles(x, y, "dot", {
        speed: { min: 60, max: tier === "super" ? 260 : 160 },
        angle: { min: 0, max: 360 },
        gravityY: tier === "super" ? -80 : 120,
        lifespan: { min: 280, max: tier === "super" ? 600 : 420 },
        scale: { start: tier === "super" ? 1.8 : 1.2, end: 0 },
        tint: colors[tier],
        emitting: false,
      })
      .setDepth(48);
    em.explode(count);
    this.scene.time.delayedCall(700, () => em.destroy());
    // 超强：扩散光环
    if (tier === "super") {
      const ring = this.scene.add
        .image(x, y, "ring")
        .setDisplaySize(30, 30)
        .setTint(0xffd94d)
        .setDepth(48)
        .setAlpha(0.9);
      this.scene.tweens.add({
        targets: ring,
        displayWidth: 120,
        displayHeight: 120,
        alpha: 0,
        duration: 360,
        ease: "Quad.easeOut",
        onComplete: () => ring.destroy(),
      });
    }
  }

  /** 冰西瓜炮口冰雾 */
  frostPuff(x: number, y: number): void {
    const em = this.scene.add
      .particles(x, y, "dot", {
        speed: { min: 30, max: 90 },
        angle: { min: -35, max: 35 },
        lifespan: 320,
        scale: { start: 1, end: 0 },
        quantity: 3,
        frequency: 18,
        tint: [0xd8f4ff, 0x9fe8ff],
        alpha: { start: 0.75, end: 0 },
        emitting: true,
      })
      .setDepth(44);
    this.scene.time.delayedCall(360, () => em.destroy());
  }

  /** 冰西瓜着地溅射：冰晶 + 扩散冰环 */
  frostBurst(x: number, y: number): void {
    const em = this.scene.add
      .particles(x, y, "dot", {
        speed: { min: 80, max: 230 },
        angle: { min: 0, max: 360 },
        gravityY: 160,
        lifespan: { min: 260, max: 520 },
        scale: { start: 1.1, end: 0.1 },
        tint: [0xd8f4ff, 0x9fe8ff, 0xffffff],
        emitting: false,
      })
      .setDepth(45);
    em.explode(16);
    this.scene.time.delayedCall(600, () => em.destroy());
    const ring = this.scene.add
      .image(x, y, "ring")
      .setDisplaySize(30, 30)
      .setTint(0xbff2ff)
      .setDepth(46)
      .setAlpha(0.9);
    this.scene.tweens.add({
      targets: ring,
      displayWidth: 150,
      displayHeight: 150,
      alpha: 0,
      duration: 380,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /** 深冻击碎：冰棘晶爆 */
  iceCrystal(x: number, y: number): void {
    const em = this.scene.add
      .particles(x, y, "dot", {
        speed: { min: 110, max: 300 },
        angle: { min: 150, max: 390 },
        gravityY: 520,
        lifespan: { min: 240, max: 460 },
        scale: { start: 1.3, end: 0.1 },
        tint: [0xffffff, 0xbfe8ff, 0x8ad6ff],
        emitting: false,
      })
      .setDepth(45);
    em.explode(12);
    this.scene.time.delayedCall(560, () => em.destroy());
    this.scene.add
      .image(x, y, "dot")
      .setTint(0xd8f4ff)
      .setDepth(46)
      .setAlpha(0.95)
      .setScale(2.2);
  }

  /**
   * 混沌风暴：融合出怪/混沌时的屏幕级爆发——多层扩散环 + 全色粒子。
   * named=true 时以品红环强调专属怪物，否则混沌青绿环。
   */
  chaosStorm(x: number, y: number, named: boolean): void {
    const accent = named ? 0xff4dc8 : 0x4dffc8;
    const burst = this.scene.add
      .particles(x, y, "dot", {
        speed: { min: 120, max: 460 },
        angle: { min: 0, max: 360 },
        gravityY: -60,
        lifespan: { min: 320, max: 800 },
        scale: { start: 1.8, end: 0 },
        tint: [accent, 0xffd94d, 0x7cf0ff, 0xff6ad5, 0xffffff],
        emitting: false,
      })
      .setDepth(49);
    burst.explode(named ? 42 : 34);
    this.scene.time.delayedCall(900, () => burst.destroy());
    // 双层冲击环
    for (let i = 0; i < 2; i++) {
      const ring = this.scene.add
        .image(x, y, "ring")
        .setDisplaySize(40, 40)
        .setTint(accent)
        .setDepth(50)
        .setAlpha(0.95);
      this.scene.tweens.add({
        targets: ring,
        displayWidth: 200 + i * 120,
        displayHeight: 200 + i * 120,
        alpha: 0,
        delay: i * 90,
        duration: 420 + i * 120,
        ease: "Quad.easeOut",
        onComplete: () => ring.destroy(),
      });
    }
  }

  /** 五彩纸屑雨：整屏飘落庆祝融合怪物诞生 */
  confettiRain(): void {
    const em = this.scene.add
      .particles(W / 2, -20, "dot", {
        speedY: { min: 130, max: 260 },
        speedX: { min: -90, max: 90 },
        lifespan: { min: 1200, max: 2000 },
        scale: { start: 0.8, end: 0.5, ease: "Linear" },
        tint: [0xff4dc8, 0x4dffc8, 0xffd94d, 0x7cf0ff, 0xff6ad5, 0xffffff],
        quantity: 3,
        frequency: 40,
        alpha: { start: 1, end: 0.9 },
        emitting: true,
      })
      .setDepth(51);
    this.scene.time.delayedCall(1600, () => em.destroy());
  }
}
