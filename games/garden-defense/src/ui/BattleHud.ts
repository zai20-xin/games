import Phaser from "phaser";
import { COMBAT, HUD_H, W } from "../config";
import { C, drawPanel, hudStyle } from "./theme";

/** 战斗顶栏：心心 / 波次 / 进度 / 种子 / 花粉 / 连击 / 暂停 */
export class BattleHud {
  private scene: Phaser.Scene;
  private hearts: Phaser.GameObjects.Text[] = [];
  private waveText!: Phaser.GameObjects.Text;
  private seedText!: Phaser.GameObjects.Text;
  private pollenText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private progressGfx!: Phaser.GameObjects.Graphics;
  private onPause: () => void;

  constructor(scene: Phaser.Scene, onPause: () => void) {
    this.scene = scene;
    this.onPause = onPause;
    this.build();
  }

  private build(): void {
    const s = this.scene;
    drawPanel(s, 8, 8, W - 16, HUD_H - 12, { radius: 14, alpha: 0.94 }).setDepth(15);

    for (let i = 0; i < COMBAT.LIVES; i++) {
      this.hearts.push(
        s.add
          .text(36 + i * 34, 36, "♥", { fontFamily: "Arial", fontSize: "28px", color: "#E86B5C" })
          .setOrigin(0.5)
          .setDepth(16)
      );
    }

    this.waveText = s.add.text(W / 2, 32, "第 0 波", hudStyle(17, C.ink)).setOrigin(0.5).setDepth(16);
    this.progressGfx = s.add.graphics().setDepth(16);
    this.drawProgress(0, 0);

    this.seedText = s.add
      .text(W - 190, 32, `种子 ${COMBAT.START_SEEDS}`, hudStyle(15, "#5A7268"))
      .setOrigin(1, 0.5)
      .setDepth(16);
    this.pollenText = s.add
      .text(W - 36, 32, `花粉 ${COMBAT.START_POLLEN}`, hudStyle(15, "#D4A83A"))
      .setOrigin(1, 0.5)
      .setDepth(16);
    this.comboText = s.add
      .text(W / 2, 58, "", hudStyle(14, "#9B7FC4"))
      .setOrigin(0.5)
      .setDepth(16)
      .setAlpha(0);

    s.add
      .text(W - 240, 32, "⏸", { fontFamily: "Arial", fontSize: "22px", color: C.ink })
      .setOrigin(0.5)
      .setDepth(16);
    const pauseZone = s.add
      .zone(W - 240, 32, 56, 56)
      .setInteractive({ useHandCursor: true })
      .setDepth(17);
    pauseZone.on("pointerdown", () => this.onPause());
  }

  setEconomy(seeds: number, pollen: number): void {
    this.seedText.setText(`种子 ${seeds}`);
    this.pollenText.setText(`花粉 ${pollen}`);
  }

  setHearts(lives: number): void {
    this.hearts.forEach((h, i) => h.setAlpha(i < lives ? 1 : 0.22));
  }

  setWaveLabel(text: string): void {
    this.waveText.setText(text);
  }

  setWaveProgress(killed: number, total: number): void {
    this.drawProgress(killed, total);
  }

  setCombo(combo: number): void {
    if (combo >= 2) this.comboText.setText(`连击 x${combo}`).setAlpha(1);
    else this.comboText.setAlpha(0);
  }

  private drawProgress(killed: number, total: number): void {
    const g = this.progressGfx;
    g.clear();
    const x = W / 2 - 90;
    const y = 52;
    const w = 180;
    const h = 8;
    g.fillStyle(0x2f4a3e, 0.12);
    g.fillRoundedRect(x, y, w, h, 4);
    if (total > 0) {
      const ratio = Phaser.Math.Clamp(killed / total, 0, 1);
      if (ratio > 0) {
        g.fillStyle(0x8fbf8a, 0.95);
        g.fillRoundedRect(x, y, Math.max(6, w * ratio), h, 4);
      }
    } else {
      g.fillStyle(0xc4a8e8, 0.35);
      g.fillRoundedRect(x, y, w, h, 4);
    }
  }

  destroy(): void {
    this.hearts = [];
  }
}
