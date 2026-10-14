import Phaser from "phaser";
import { DIFFICULTIES, DIFFICULTY_PARAMS, W, type Difficulty } from "../config";
import { bodyStyle, drawPanel, drawSceneBackdrop, hudStyle, makeButton, titleStyle, C } from "../ui/theme";
import { getProgress, isSoundMuted, setSoundMuted } from "../systems/Progress";

/**
 * 主菜单 · 选难度开战
 */
export class MenuScene extends Phaser.Scene {
  private content: Phaser.GameObjects.Container | null = null;
  private difficulty: Difficulty = "standard";

  constructor() {
    super("menu");
  }

  create(): void {
    drawSceneBackdrop(this);
    this.content = this.add.container(0, 0);
    this.render();
    this.drawSound();
  }

  private clear(): void {
    this.content?.destroy();
    this.content = this.add.container(0, 0);
  }

  private render(): void {
    this.clear();
    const c = this.content!;

    c.add(this.add.text(W / 2, 96, "花园保卫战", titleStyle(40)).setOrigin(0.5));
    c.add(this.add.text(W / 2, 140, "种下花朵 · 挡住宠物 · 守住晨光花房", bodyStyle(15, C.ink2)).setOrigin(0.5));

    ["#e86b7a", "#f0c96a", "#e8a0b8", "#9b7fc4", "#8fbf8a"].forEach((col, i) => {
      c.add(
        this.add
          .circle(W / 2 - 48 + i * 24, 172, 7, Phaser.Display.Color.HexStringToColor(col).color)
          .setStrokeStyle(2, 0xfffcf7, 0.9)
      );
    });

    const cardW = W - 56;
    const cardH = 112;
    const startY = 210;
    DIFFICULTIES.forEach((diff, i) => {
      this.drawDiffCard(c, diff, W / 2, startY + i * (cardH + 14), cardW, cardH);
    });

    const p = getProgress();
    const best = DIFFICULTIES.map((d) => `${DIFFICULTY_PARAMS[d].label}${p.bestWave[d] ?? 0}`).join(" · ");
    c.add(this.add.text(W / 2, 620, `最佳波次  ${best}`, bodyStyle(14, C.ink2)).setOrigin(0.5));

    const startBtn = makeButton(
      this,
      W / 2,
      720,
      "开始游戏",
      () => this.startGame(),
      { w: 280, h: 64, variant: "honey", fontSize: 22 }
    );
    c.add(startBtn);

    c.add(
      this.add
        .text(W / 2, 790, "点选难度卡切换 · 种子种花 · 花粉进化 · 资源自动入账", bodyStyle(13, C.ink3))
        .setOrigin(0.5)
    );

    // 简要图例
    const legendY = 860;
    c.add(drawPanel(this, 40, legendY, W - 80, 200, { radius: 18 }));
    c.add(this.add.text(64, legendY + 18, "花语手册", hudStyle(16, C.ink)));
    const tips = [
      "月季 — 便宜可靠，优先种在上方迎敌",
      "水仙 — 减速宠物，给后排争取时间",
      "海棠 — 双发压制，中线主力",
      "荷花 — 自动产出种子与花粉，放安全后排",
      "兰花 — 光环增伤，铺开后再放",
    ];
    tips.forEach((t, i) => {
      c.add(this.add.text(64, legendY + 48 + i * 26, t, bodyStyle(14, C.ink2)));
    });
  }

  private drawDiffCard(
    c: Phaser.GameObjects.Container,
    diff: Difficulty,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const p = DIFFICULTY_PARAMS[diff];
    const selected = this.difficulty === diff;
    const panel = drawPanel(this, x - w / 2, y - h / 2, w, h, {
      fill: selected ? 0xfff4d8 : 0xfffcf7,
      stroke: selected ? 0xf0c96a : 0xe0d4c4,
      radius: 18,
    });
    c.add(panel);
    c.add(this.add.text(x - w / 2 + 24, y - 28, p.label, hudStyle(22, C.ink)));
    c.add(this.add.text(x - w / 2 + 24, y + 6, p.desc, bodyStyle(14, C.ink2)));
    c.add(
      this.add
        .text(x + w / 2 - 24, y, selected ? "已选" : "选择", hudStyle(15, selected ? "#d4a83a" : C.ink3))
        .setOrigin(1, 0.5)
    );

    const hit = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      this.difficulty = diff;
      this.render();
    });
    c.add(hit);
  }

  private drawSound(): void {
    const label = this.add
      .text(48, 42, isSoundMuted() ? "🔇" : "🔊", { fontFamily: "Arial", fontSize: "22px" })
      .setOrigin(0.5)
      .setDepth(20);
    const btn = this.add.zone(48, 42, 56, 44).setInteractive({ useHandCursor: true }).setDepth(19);
    btn.on("pointerdown", () => {
      const muted = !isSoundMuted();
      setSoundMuted(muted);
      label.setText(muted ? "🔇" : "🔊");
    });
  }

  private startGame(): void {
    this.scene.start("game", { difficulty: this.difficulty });
  }
}
