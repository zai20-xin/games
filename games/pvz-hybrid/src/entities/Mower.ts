import Phaser from "phaser";
import { W } from "../config";
import type { Zombie } from "./Zombie";

// 小推车：每行最后一道防线，触发后横扫整行，一次性
export class Mower extends Phaser.GameObjects.Sprite {
  readonly row: number;
  used = false;
  private running = false;

  constructor(scene: Phaser.Scene, row: number, x: number, y: number) {
    super(scene, x, y, "mower");
    this.row = row;
    this.setOrigin(0.5, 0.5);
    this.setDisplaySize(76, 54);
    this.setDepth(6 + row * 0.1);
    scene.add.existing(this);
  }

  trigger(): void {
    if (this.used) return;
    this.used = true;
    this.running = true;
    const scene = this.scene;
    scene.tweens.add({
      targets: this,
      x: W + 90,
      duration: 1700,
      ease: "Linear",
      onComplete: () => this.destroy(),
    });
    scene.tweens.add({
      targets: this,
      angle: { from: -2, to: 2 },
      duration: 70,
      yoyo: true,
      repeat: 20,
    });
  }

  updateGame(zombies: Zombie[]): void {
    if (!this.running) return;
    for (const z of zombies) {
      if (z.isDying) continue;
      if (z.row === this.row && Math.abs(z.x - this.x) < 46) {
        z.die();
      }
    }
  }
}
