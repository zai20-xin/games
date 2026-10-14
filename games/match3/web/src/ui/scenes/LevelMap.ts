import Phaser from "phaser";
import { LevelData } from "../../game/levels";
import { loadAllFromWeb } from "../../game/level_loader";
import { SaveManager } from "../save";
import { UIKit } from "../uikit";
import { Sfx } from "../sfx";

const SPACING = 175;
const AMPLITUDE = 195;

export class LevelMapScene extends Phaser.Scene {
  private nodeCenters: Phaser.Math.Vector2[] = [];
  private levels: LevelData[] = [];
  private dragStartY: number | null = null;
  private startScrollY = 0;

  constructor() {
    super("LevelMap");
  }

  init(data: { levels?: LevelData[] }): void {
    if (data.levels) this.levels = data.levels;
  }

  async create(data: { levels?: LevelData[] }): Promise<void> {
    UIKit.attach(this);
    UIKit.backdrop(this);
    UIKit.fade();

    if (this.levels.length === 0) {
      this.levels = await this.loadLevels();
    }

    const total = this.levels.length;
    // 防御：关卡数据缺失（glob 空 / 数据损坏）时不崩溃，回主菜单
    if (total === 0) {
      console.warn("[LevelMap] 关卡数据为空，返回主菜单");
      this.scene.start("MainMenu");
      return;
    }
    const worldHeight = SPACING * (total + 1) + 200;

    this.add.text(360, 60, "糖果之旅", {
      fontSize: "44px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(50);

    UIKit.button(110, 62, 190, 54, "← 主菜单", () => this.scene.start("MainMenu"), 22)
      .container.setScrollFactor(0).setDepth(50);

    // 路径连线
    const pathG = this.add.graphics().setDepth(1);
    for (let i = 0; i < total; i++) {
      const center = new Phaser.Math.Vector2(
        360 + AMPLITUDE * Math.sin(i * 0.85),
        SPACING * (total - i) + 100,
      );
      this.nodeCenters.push(center);
      if (i > 0) {
        const prev = this.nodeCenters[i - 1];
        pathG.lineStyle(8, 0xffffff, 0.15);
        pathG.beginPath();
        pathG.moveTo(prev.x, prev.y);
        pathTo(pathG, prev, center);
        pathG.strokePath();
      }
    }

    this.registry.set("levels", this.levels);

    const latest = SaveManager.latestUnlockedId(total);
    let currentNode: Phaser.GameObjects.Container | null = null;

    for (let i = 0; i < total; i++) {
      const level = this.levels[i];
      const unlocked = SaveManager.isUnlocked(level.id);
      const earned = SaveManager.getStars(level.id);
      const center = this.nodeCenters[i];
      const isCurrent = level.id === latest && earned === 0;

      const container = this.add.container(center.x, center.y).setDepth(2);
      const g = this.add.graphics();
      const w = 196;
      const h = 128;

      if (unlocked) {
        g.fillStyle(earned > 0 ? 0x3e4880 : 0x4c5a9e, 0.98);
      } else {
        g.fillStyle(0x22263f, 0.9);
      }
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 20);
      g.lineStyle(2, 0xffffff, unlocked ? 0.18 : 0.08);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
      container.add(g);

      let text: string;
      if (unlocked) {
        const starsText = "★".repeat(earned) + "☆".repeat(3 - earned);
        text = `第 ${level.id} 关\n${starsText}\n${level.levelName}`;
      } else {
        text = `第 ${level.id} 关\n未解锁`;
      }
      const label = this.add
        .text(0, 0, text, {
          fontSize: "24px",
          color: unlocked ? "#ffffff" : "#8888a8",
          align: "center",
        })
        .setOrigin(0.5);
      container.add(label);

      if (unlocked) {
        UIKit.hitzone(center.x, center.y, w, h, () => {
          Sfx.play("swap");
          this.scene.start("Game", { level });
        });
      }

      if (isCurrent && unlocked) {
        container.setScale(1.06);
        this.tweens.add({
          targets: container,
          scale: 1.16,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        currentNode = container;
      }
    }

    // 相机定位到当前进度节点（clamp 防止 latest 越界）
    const currentIndex = Phaser.Math.Clamp(latest - 1, 0, Math.max(0, this.nodeCenters.length - 1));
    const focusY = this.nodeCenters[currentIndex].y;
    this.cameras.main.setBounds(0, 0, 720, Math.max(worldHeight, 1280));
    this.time.delayedCall(50, () => {
      const targetY = focusY - 1280 * 0.55;
      this.cameras.main.scrollY = Phaser.Math.Clamp(targetY, 0, worldHeight - 1280);
    });

    this.setupDragScroll(worldHeight);
    void currentNode;
  }

  private setupDragScroll(worldHeight: number): void {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragStartY = p.y;
      this.startScrollY = this.cameras.main.scrollY;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.dragStartY === null || !p.isDown) return;
      const delta = this.dragStartY - p.y;
      this.cameras.main.scrollY = Phaser.Math.Clamp(
        this.startScrollY + delta,
        0,
        Math.max(0, worldHeight - 1280),
      );
    });
    this.input.on("pointerup", () => (this.dragStartY = null));
  }

  private async loadLevels(): Promise<LevelData[]> {
    // 统一走 level_loader 的内联 glob 加载（单一实现 + 已被单测覆盖，避免路径漂移）
    return loadAllFromWeb();
  }
}

function pathTo(
  g: Phaser.GameObjects.Graphics,
  a: Phaser.Math.Vector2,
  b: Phaser.Math.Vector2,
): void {
  const midY = (a.y + b.y) / 2;
  g.lineTo(a.x, midY);
  g.lineTo(b.x, midY);
  g.lineTo(b.x, b.y);
}
