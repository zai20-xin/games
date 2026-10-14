import Phaser from "phaser";

const MAX_EMITTERS = 16;

export class Fx {
  private scene: Phaser.Scene;
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private texts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private getParticleKey(): string {
    return this.scene.textures.exists("dot") ? "dot" : "__DEFAULT";
  }

  burst(x: number, y: number, tint: number, count = 10, scale = 1.2): void {
    if (this.emitters.length >= MAX_EMITTERS) return;
    const key = this.getParticleKey();
    if (key === "__DEFAULT" && !this.scene.textures.exists("__DEFAULT")) return;
    const em = this.scene.add.particles(x, y, key, {
      tint,
      scale: { start: scale, end: 0 },
      speed: { min: 40, max: 140 },
      lifespan: 380,
      quantity: count,
      emitting: false,
    });
    em.explode(count, x, y);
    this.emitters.push(em);
    this.scene.time.delayedCall(500, () => {
      em.destroy();
      this.emitters = this.emitters.filter((e) => e !== em);
    });
  }

  ring(x: number, y: number, tint: number, maxScale = 1.4): void {
    if (!this.scene.textures.exists("ring")) return;
    const img = this.scene.add.image(x, y, "ring").setTint(tint).setScale(0.2).setDepth(30);
    this.scene.tweens.add({
      targets: img,
      scale: maxScale,
      alpha: 0,
      duration: 420,
      ease: "Cubic.easeOut",
      onComplete: () => img.destroy(),
    });
  }

  damageText(x: number, y: number, text: string, color = "#2F4A3E"): void {
    if (this.texts.length >= 24) return;
    const isRes = text.startsWith("种+") || text.startsWith("粉+");
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        fontSize: isRes ? "14px" : "15px",
        fontStyle: "bold",
        color,
        stroke: "#fffcf7",
        strokeThickness: isRes ? 3 : 2,
        backgroundColor: isRes ? "rgba(255,252,247,0.75)" : undefined,
        padding: isRes ? { x: 4, y: 2 } : undefined,
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.texts.push(t);
    this.scene.tweens.add({
      targets: t,
      y: y - (isRes ? 28 : 32),
      alpha: 0,
      duration: isRes ? 650 : 550,
      ease: "Cubic.easeOut",
      onComplete: () => {
        t.destroy();
        this.texts = this.texts.filter((x) => x !== t);
      },
    });
  }

  confetti(x: number, y: number): void {
    const colors = [0xf5c84c, 0xf5a0b8, 0xc4a8e8, 0x8fbf8a, 0x6ec8e0];
    for (let i = 0; i < 12; i++) {
      const c = this.scene.add
        .rectangle(x, y, 8, 8, colors[i % colors.length]!)
        .setDepth(35)
        .setAngle(Phaser.Math.Between(0, 90));
      this.scene.tweens.add({
        targets: c,
        x: x + Phaser.Math.Between(-90, 90),
        y: y + Phaser.Math.Between(20, 120),
        alpha: 0,
        angle: c.angle + 180,
        duration: 650,
        onComplete: () => c.destroy(),
      });
    }
  }

  ambientPetals(): Phaser.Time.TimerEvent {
    return this.scene.time.addEvent({
      delay: 2200,
      loop: true,
      callback: () => {
        // 用柔和圆点代替花瓣贴图（贴图缩放后像脏点）
        const x = Phaser.Math.Between(90, 630);
        const col = Phaser.Math.RND.pick([0xf5a0b8, 0xffc4d4, 0xe8d4f5]);
        const c = this.scene.add
          .circle(x, -12, Phaser.Math.Between(3, 5), col, 0.35)
          .setDepth(2);
        this.scene.tweens.add({
          targets: c,
          y: 860,
          x: x + Phaser.Math.Between(-24, 24),
          alpha: 0,
          duration: Phaser.Math.Between(5500, 8500),
          onComplete: () => c.destroy(),
        });
      },
    });
  }

  destroy(): void {
    for (const e of this.emitters) e.destroy();
    this.emitters = [];
    for (const t of this.texts) t.destroy();
    this.texts = [];
  }
}
