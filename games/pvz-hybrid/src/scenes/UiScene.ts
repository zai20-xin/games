import Phaser from "phaser";
import { H, TOTAL_WAVES, W, plantDef, type PlantKind } from "../config";
import { bus } from "../bus";
import { BELT_CAPACITY, type BeltSlot } from "../systems/Conveyor";
import { iconFit } from "../ui/iconFit";
import type { FormTier } from "../types/dictionaries";
import type { Collection } from "../systems/Collection";
import { FORMS, SKILLS } from "../data/dictionaries";

// 顶部传送带几何：8 个卡槽等距排布，右侧接铲子
const BELT_START = 150;
const BELT_SLOT_W = 64;
const TILE_Y = 12;
const TILE_H = 88;

function tileX(i: number): number {
  return BELT_START + i * BELT_SLOT_W;
}
function tileCenterX(i: number): number {
  return tileX(i) + BELT_SLOT_W / 2;
}

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "Arial, '微软雅黑', sans-serif",
  color: "#ffffff",
  stroke: "#26150a",
  strokeThickness: 4,
};

const RARITY_COLORS: Record<FormTier, number> = {
  common: 0x808080,
  rare: 0x4488ff,
  epic: 0xaa44ff,
  legendary: 0xffd700,
};

export class UiScene extends Phaser.Scene {
  private shovelSlot: { x: number; y: number } | null = null;
  /** 当前选中态（普通卡想点来的植物 / 铲子 / 传送带卡） */
  private selected: PlantKind | "shovel" | null = null;
  /** 当前选中的传送带卡 id（底部高亮用） */
  private selectedBeltId: number | null = null;
  /** 传送带卡片实体与顺序 */
  private beltItems: BeltSlot[] = [];
  private beltIcons = new Map<number, Phaser.GameObjects.Image>();
  /** 各带卡 icon 的内容中心偏移（滑动归位时按卡各自计算目标 x） */
  private beltOffsets = new Map<number, { offX: number; offY: number }>();
  /** 进化卡边框与星标 */
  private beltBorders = new Map<number, Phaser.GameObjects.Graphics>();
  private beltStars = new Map<number, Phaser.GameObjects.Text>();
  private beltTiles: Phaser.GameObjects.Image[] = [];
  private dynamicGfx: Phaser.GameObjects.Graphics | null = null;
  private progressGfx: Phaser.GameObjects.Graphics | null = null;
  private waveText: Phaser.GameObjects.Text | null = null;
  private bannerText: Phaser.GameObjects.Text | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;
  private toastTween: Phaser.Tweens.Tween | null = null;
  private overlay: Phaser.GameObjects.Container | null = null;
  private progress = 0;
  private progressMeta = { x: 0, y: 0, w: 250, h: 14 };
  private comboText: Phaser.GameObjects.Text | null = null;
  private comboTween: Phaser.Tweens.Tween | null = null;
  private redPulse: Phaser.GameObjects.Rectangle | null = null;
  /** 当前关卡总波数（GameScene 广播，默认 10） */
  private totalWaves = TOTAL_WAVES;
  private collectionPanel: Phaser.GameObjects.Container | null = null;
  private collectionOpen = false;
  private collectionRef: Collection | null = null;

  constructor() {
    super("ui");
  }

  create(): void {
    this.beltItems = [];
    this.beltIcons.clear();
    this.beltOffsets.clear();
    this.beltTiles = [];
    this.selected = null;
    this.selectedBeltId = null;
    this.overlay = null;
    this.progress = 0;
    this.totalWaves = TOTAL_WAVES;

    this.drawTopBar();
    this.drawProgress();

    bus.on("belt", this.onBelt, this);
    bus.on("card-selected", this.onCardSelected, this);
    bus.on("toast", this.showToast, this);
    bus.on("banner", this.showBanner, this);
    bus.on("wave", this.onWave, this);
    bus.on("progress", this.onProgress, this);
    bus.on("game-over", this.onGameOver, this);
    bus.on("victory", this.onVictory, this);
    bus.on("combo", this.onCombo, this);
    bus.on("request-restart", this.onRequestRestart, this);
    bus.on("level", this.onLevel, this);
    bus.on("collection-ref", this.onCollectionRef, this);

    // 'C' key toggles collection panel
    this.input.keyboard?.on("keydown-C", () => this.toggleCollection());

    this.events.once("shutdown", () => {
      bus.off("belt", this.onBelt, this);
      bus.off("card-selected", this.onCardSelected, this);
      bus.off("toast", this.showToast, this);
      bus.off("banner", this.showBanner, this);
      bus.off("wave", this.onWave, this);
      bus.off("progress", this.onProgress, this);
      bus.off("game-over", this.onGameOver, this);
      bus.off("victory", this.onVictory, this);
      bus.off("combo", this.onCombo, this);
      bus.off("request-restart", this.onRequestRestart, this);
      bus.off("level", this.onLevel, this);
      bus.off("collection-ref", this.onCollectionRef, this);
    });
  }

  /**
   * 重开一局：GameScene 只重启自己，UiScene 不随之重建。
   * 必须手动清掉结算 overlay（否则 clickBeltSlot 被 overlay 拦死，带卡永远选不中）
   * 与旧带图标（新 Conveyor 的 id 从 1 重新计数，会与旧图标 id 撞车复用错贴图）。
   */
  private onRequestRestart(): void {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
    this.selected = null;
    this.selectedBeltId = null;
    this.beltItems = [];
    for (const [, img] of this.beltIcons) img.destroy();
    this.beltIcons.clear();
    this.beltOffsets.clear();
    for (const [, border] of this.beltBorders) border.destroy();
    this.beltBorders.clear();
    for (const [, star] of this.beltStars) star.destroy();
    this.beltStars.clear();
  }

  // ---------- 静态 UI ----------

  private drawTopBar(): void {
    const g = this.add.graphics().setDepth(5);
    // 木质渐变顶栏：顶缘受光（浅木）渐降到下部阴影（深木）+ 横向木纹 + 珠光顶沿
    g.fillGradientStyle(0x6f4d28, 0x6f4d28, 0x35260f, 0x35260f, 1);
    g.fillRect(0, 0, W, 108);
    g.fillStyle(0xffffff, 0.1); // 顶缘珠光玻璃感
    g.fillRect(0, 0, W, 10);
    g.fillStyle(0x000000, 0.25); // 顶部压暗塑形
    g.fillRect(0, 8, W, 5);
    g.fillStyle(0x241808, 0.2);
    for (let yy = 26; yy < 100; yy += 20) g.fillRect(0, yy, W, 2);
    g.fillStyle(0xd8ab72, 0.18); // 局部木色高光划痕
    for (let yy = 34; yy < 96; yy += 24) g.fillRect(0, yy, W, 1);
    // 底部玻璃压脚：深色渐变 + 上下描边
    g.fillGradientStyle(0x6b4a2a, 0x6b4a2a, 0x42301b, 0x42301b, 1);
    g.fillRect(0, 104, W, 5);
    g.fillStyle(0x000000, 0.3);
    g.fillRect(0, 103, W, 2);
    g.fillStyle(0xd8ab72, 0.55);
    g.fillRect(0, 107, W, 1);

    // 大波红光脉冲层
    this.redPulse = this.add
      .rectangle(0, 0, W, H, 0xd8302a, 0)
      .setOrigin(0)
      .setDepth(25);

    // 传送带卡槽（空槽底片，点击拿去对应位置最靠前的一张带卡）
    for (let i = 0; i < BELT_CAPACITY; i++) {
      const tile = this.add.image(tileX(i), TILE_Y, "belt_tile").setOrigin(0, 0).setDepth(6);
      tile.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.clickBeltSlot(i));
      this.beltTiles.push(tile);
    }

    // 铲子槽（带后一格）
    const sx = tileX(BELT_CAPACITY) + 8;
    this.add.image(sx, 11, "shovel_slot").setOrigin(0, 0).setDepth(6);
    this.add
      .image(sx + 28, 11 + 40, "shovel")
      .setDisplaySize(44, 44)
      .setDepth(7);
    this.shovelSlot = { x: sx, y: 11 };
    this.add
      .rectangle(sx + 28, 11 + 43, 56, 86)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.clickShovel())
      .setDepth(8);

    this.dynamicGfx = this.add.graphics().setDepth(9);
  }

  private drawProgress(): void {
    const barW = 250;
    const barH = 14;
    const x = W - barW - 16;
    const y = H - 26;
    this.progressGfx = this.add.graphics().setDepth(6);
    this.progressMeta = { x, y, w: barW, h: barH };
    this.waveText = this.add
      .text(x + barW, y - 12, `第 0/${this.totalWaves} 波`, {
        ...TEXT_STYLE,
        fontSize: "14px",
      })
      .setOrigin(1, 1)
      .setDepth(6);
    this.add
      .text(x - 8, y + 7, "进展", { ...TEXT_STYLE, fontSize: "12px" })
      .setOrigin(1, 0.5)
      .setDepth(6);
  }

  /** 关卡信息广播：更新总波数显示 */
  private onLevel(info: { name: string; totalWaves: number; terrain: string }): void {
    this.totalWaves = info.totalWaves;
    this.waveText?.setText(`第 0/${this.totalWaves} 波`);
  }

  private onCollectionRef(collection: Collection): void {
    this.collectionRef = collection;
  }

  private toggleCollection(): void {
    if (this.collectionOpen) {
      this.collectionPanel?.destroy();
      this.collectionPanel = null;
      this.collectionOpen = false;
      return;
    }
    if (!this.collectionRef) return;
    this.drawCollectionPanel();
    this.collectionOpen = true;
  }

  private drawCollectionPanel(): void {
    const panel = this.add.container(W / 2, H / 2).setDepth(50);

    // background
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setInteractive();
    panel.add(bg);

    const panelW = 520;
    const panelH = 420;
    const g = this.add.graphics();
    g.fillGradientStyle(0x2a1d10, 0x2a1d10, 0x1a1208, 0x1a1208, 1);
    g.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 14);
    g.lineStyle(3, 0xd8ab72, 1);
    g.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 14);
    panel.add(g);

    // title
    const title = this.add
      .text(0, -panelH / 2 + 26, "进化图鉴", { ...TEXT_STYLE, fontSize: "26px", color: "#ffd94d" })
      .setOrigin(0.5);
    panel.add(title);

    // stats
    const discovered = this.collectionRef!.getDiscoveredCount();
    const total = this.collectionRef!.getTotalCombinations();
    const fragments = this.collectionRef!.getFragments();
    const stats = this.add
      .text(0, -panelH / 2 + 58, `已发现 ${discovered}/${total}   碎片: ${fragments}`, {
        ...TEXT_STYLE,
        fontSize: "16px",
        color: "#efe1c8",
      })
      .setOrigin(0.5);
    panel.add(stats);

    // grid
    const gridX = -panelW / 2 + 24;
    const gridY = -panelH / 2 + 90;
    const cellW = 56;
    const cellH = 34;
    const entries = this.collectionRef!.getEntries();
    const entryMap = new Map(entries.map((e) => [`${e.formId}:${e.skillId}`, e]));

    // skill headers
    for (let s = 0; s < SKILLS.length; s++) {
      const label = this.add
        .text(gridX + 80 + s * cellW, gridY - 4, SKILLS[s]!.name.slice(0, 3), {
          ...TEXT_STYLE,
          fontSize: "10px",
          color: "#b8a888",
        })
        .setOrigin(0.5, 1);
      panel.add(label);
    }

    // form rows
    for (let f = 0; f < FORMS.length; f++) {
      const form = FORMS[f]!;
      const rowY = gridY + f * cellH;

      // form label
      const fLabel = this.add
        .text(gridX + 2, rowY + cellH / 2, form.name.slice(0, 4), {
          ...TEXT_STYLE,
          fontSize: "11px",
          color: "#d8ab72",
        })
        .setOrigin(0, 0.5);
      panel.add(fLabel);

      for (let s = 0; s < SKILLS.length; s++) {
        const skill = SKILLS[s]!;
        const key = `${form.id}:${skill.id}`;
        const entry = entryMap.get(key);
        const discovered = !!entry;

        const cellG = this.add.graphics();
        const cx = gridX + 80 + s * cellW;
        const cy = rowY + 4;

        if (discovered) {
          // form color based on tier
          const tierColors: Record<string, number> = {
            common: 0x5a8a3c,
            rare: 0x3a7ab8,
            epic: 0x8a4ab8,
            legendary: 0xd4a830,
          };
          const color = tierColors[form.tier] ?? 0x5a8a3c;
          cellG.fillStyle(color, 0.85);
          cellG.fillRoundedRect(cx, cy, cellW - 4, cellH - 6, 4);
          cellG.lineStyle(1, 0xffffff, 0.3);
          cellG.strokeRoundedRect(cx, cy, cellW - 4, cellH - 6, 4);
        } else {
          cellG.fillStyle(0x2a2a2a, 0.7);
          cellG.fillRoundedRect(cx, cy, cellW - 4, cellH - 6, 4);
          cellG.lineStyle(1, 0x444444, 0.5);
          cellG.strokeRoundedRect(cx, cy, cellW - 4, cellH - 6, 4);
        }
        panel.add(cellG);
      }
    }

    // close button
    const closeBtn = this.add
      .text(panelW / 2 - 20, -panelH / 2 + 14, "X", {
        ...TEXT_STYLE,
        fontSize: "22px",
        color: "#ff8866",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.toggleCollection());
    panel.add(closeBtn);

    // hint
    const hint = this.add
      .text(0, panelH / 2 - 20, "按 C 关闭", {
        ...TEXT_STYLE,
        fontSize: "13px",
        color: "#888888",
      })
      .setOrigin(0.5);
    panel.add(hint);

    this.collectionPanel = panel;
  }

  // ---------- 交互 ----------

  /** 点击第 i 个卡槽：拿出该位置带卡（免费选择）；再点取消 */
  private clickBeltSlot(i: number): void {
    if (this.overlay) return;
    const slot = this.beltItems[i];
    if (!slot) {
      bus.emit("toast", "这里还没有植物，等传送带送过来~");
      return;
    }
    const next = this.selectedBeltId === slot.id ? null : slot.id;
    this.selectedBeltId = next;
    this.selected = next === null ? null : slot.kind;
    bus.emit("belt-select", next, slot.evolved ?? null);
  }

  private clickShovel(): void {
    if (this.overlay) return;
    this.selectedBeltId = null;
    const next = this.selected === "shovel" ? null : "shovel";
    this.selected = next;
    bus.emit("card-selected", next);
  }

  // ---------- 事件响应 ----------

  /** 传送带列表变化：对账增删移动图标，带滑动/新卡弹入动效 */
  private onBelt(list: readonly BeltSlot[]): void {
    this.beltItems = [...list];
    const ids = this.beltItems.map((s) => s.id);
    const keep = new Set(ids);
    // 移除被取走的卡
    for (const [id, img] of this.beltIcons) {
      if (!keep.has(id)) {
        this.tweens.add({
          targets: img,
          alpha: 0,
          scale: img.scaleX * 0.5,
          angle: img.angle + (id % 2 === 0 ? -18 : 18),
          duration: 200,
          ease: "Quad.easeIn",
          onComplete: () => img.destroy(),
        });
        this.beltIcons.delete(id);
        this.beltOffsets.delete(id);
        const border = this.beltBorders.get(id);
        if (border) { border.destroy(); this.beltBorders.delete(id); }
        const star = this.beltStars.get(id);
        if (star) { star.destroy(); this.beltStars.delete(id); }
      }
    }
    // 补齐 / 归位图标
    this.beltItems.forEach((slot, i) => {
      const x = tileCenterX(i);
      const existing = this.beltIcons.get(slot.id);
      if (!existing) {
        const key = plantDef(slot.kind).texture;
        const fit = iconFit(this, key);
        const img = this.add
          .image(x - BELT_SLOT_W - fit.offX, 56 - fit.offY, key)
          .setDepth(7)
          .setScale(fit.scale * 0.5)
          .setAlpha(0);
        // 出场从半大弹到目标尺寸：目标 scale 由内容包围盒决定，
        // 不能写死 scale:1（否则 icon 全部变成贴图原始尺寸）
        this.tweens.add({
          targets: img,
          x: x - fit.offX,
          scale: fit.scale,
          alpha: 1,
          duration: 230,
          ease: "Back.easeOut",
        });
        this.beltIcons.set(slot.id, img);
        this.beltOffsets.set(slot.id, { offX: fit.offX, offY: fit.offY });
        // 进化卡：稀有度边框 + 星标
        if (slot.evolved) {
          const topMod = slot.evolved.mods[0];
          const tier = topMod?.tier ?? "common";
          const borderColor = RARITY_COLORS[tier];
          const border = this.add.graphics().setDepth(7.5);
          border.lineStyle(2.5, borderColor, 0.9);
          border.strokeRoundedRect(tileX(i) + 1, TILE_Y + 1, BELT_SLOT_W - 2, TILE_H - 2, 8);
          this.beltBorders.set(slot.id, border);
          const star = this.add
            .text(tileX(i) + BELT_SLOT_W - 10, TILE_Y + 4, "\u2605", {
              fontSize: "14px",
              color: "#" + borderColor.toString(16).padStart(6, "0"),
              stroke: "#000000",
              strokeThickness: 2,
            })
            .setOrigin(1, 0)
            .setDepth(8);
          this.beltStars.set(slot.id, star);
        }
      } else {
        const off = this.beltOffsets.get(slot.id) ?? { offX: 0, offY: 0 };
        if (Math.abs(existing.x - (x - off.offX)) > 1) {
          this.tweens.add({ targets: existing, x: x - off.offX, duration: 210, ease: "Quad.easeOut" });
          const border = this.beltBorders.get(slot.id);
          if (border) {
            this.tweens.add({ targets: border, x: x - off.offX - tileX(i), duration: 210, ease: "Quad.easeOut" });
          }
        }
      }
    });
    if (this.selectedBeltId !== null && !keep.has(this.selectedBeltId)) this.selectedBeltId = null;
  }

  /** 连杀弹字 */
  private onCombo(payload: { count: number; x: number; y: number }): void {
    if (!this.comboText) {
      this.comboText = this.add
        .text(0, 0, "", {
          ...TEXT_STYLE,
          fontSize: "34px",
          color: "#ffd94d",
          strokeThickness: 7,
        })
        .setOrigin(0.5)
        .setDepth(22);
    }
    const x = Phaser.Math.Clamp(payload.x, 220, W - 160);
    const y = Phaser.Math.Clamp(payload.y, 150, H - 60);
    this.comboText.setText(`连击 x${payload.count}`).setPosition(x, y).setAlpha(1).setScale(1.35);
    this.comboTween?.remove();
    this.comboTween = this.tweens.add({
      targets: this.comboText,
      scale: 1,
      y: y - 26,
      alpha: 0,
      delay: 420,
      duration: 380,
      ease: "Quad.easeOut",
    });
  }

  private onCardSelected(kind: PlantKind | "shovel" | null): void {
    this.selected = kind;
  }

  private onWave(current: number, total: number): void {
    this.waveText?.setText(`第 ${current}/${total} 波`);
  }

  private onProgress(p: number): void {
    this.progress = p;
  }

  private showToast(msg: string): void {
    if (!this.toastText) {
      this.toastText = this.add
        .text(W / 2, 132, "", { ...TEXT_STYLE, fontSize: "20px" })
        .setOrigin(0.5)
        .setDepth(20);
    }
    this.toastText.setText(msg).setAlpha(1).setScale(1);
    this.toastTween?.remove();
    this.toastTween = this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      delay: 1200,
      duration: 400,
    });
  }

  private showBanner(msg: string): void {
    if (this.redPulse) {
      this.tweens.killTweensOf(this.redPulse);
      this.redPulse.setAlpha(0);
      this.tweens.add({
        targets: this.redPulse,
        alpha: { from: 0, to: 0.24 },
        duration: 320,
        yoyo: true,
        repeat: 2,
        ease: "Sine.easeInOut",
      });
    }
    if (!this.bannerText) {
      this.bannerText = this.add
        .text(W / 2, 210, "", {
          ...TEXT_STYLE,
          fontSize: "42px",
          color: "#ff5a4e",
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(21);
    }
    this.bannerText.setText(msg).setAlpha(0).setScale(0.6);
    this.tweens.add({
      targets: this.bannerText,
      alpha: 1,
      scale: 1,
      duration: 260,
      ease: "Back.easeOut",
      yoyo: true,
      hold: 1400,
      onComplete: () => this.bannerText?.setAlpha(0),
    });
  }

  // ---------- 结算覆盖层 ----------

  private buildOverlay(title: string, titleColor: string, sub: string): void {
    const container = this.add.container(W / 2, H / 2).setDepth(30);
    const panelW = 440;
    const panelH = 300;
    // 全屏暗角
    const mask = this.add.rectangle(0, 0, W, H, 0x000000, 0.6);
    // 中央招牌：木框雕花
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.4);
    panel.fillRoundedRect(-panelW / 2 + 6, -panelH / 2 + 8, panelW, panelH, 18); // 底影
    panel.fillGradientStyle(0x46321d, 0x46321d, 0x2a1d10, 0x2a1d10, 1); // 木面
    panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
    panel.fillStyle(0x000000, 0.12); // 木纹横线
    for (let yy = -panelH / 2 + 20; yy < panelH / 2 - 12; yy += 15) panel.fillRect(-panelW / 2 + 18, yy, panelW - 36, 2);
    panel.fillStyle(0xffffff, 0.05); // 顶部内发光
    panel.fillRoundedRect(-panelW / 2 + 8, -panelH / 2 + 8, panelW - 16, 40, 12);
    panel.lineStyle(5, 0xd8ab72, 1); // 金色描边
    panel.strokeRoundedRect(-panelW / 2 + 4, -panelH / 2 + 4, panelW - 8, panelH - 8, 15);
    panel.lineStyle(2, 0xffe9b8, 0.85);
    panel.strokeRoundedRect(-panelW / 2 + 11, -panelH / 2 + 11, panelW - 22, panelH - 22, 11);
    // 四角金色五金铆钉（圆头 + 暗环 + 高光点）与 L 形角铁（雕花/加固质感）
    for (const [mx, my] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const cx = mx * (panelW / 2 - 16);
      const cy = my * (panelH / 2 - 16);
      // L 形角铁
      panel.fillStyle(0x8a5a1e, 0.55);
      panel.fillRoundedRect(cx - (mx < 0 ? 30 : 0), cy - (my < 0 ? 30 : 0), 30, 9, 4);
      panel.fillRoundedRect(cx - (mx < 0 ? 30 : 0), cy - (my < 0 ? 30 : 0), 9, 30, 4);
      // 铆钉
      panel.fillStyle(0x5c3a10, 1);
      panel.fillCircle(cx, cy, 6);
      panel.fillStyle(0xffd94d, 1);
      panel.fillCircle(cx, cy, 4);
      panel.fillStyle(0xfff3cf, 1);
      panel.fillCircle(cx - 1, cy - 1, 1.6);
    }
    // 标题（立体投影）
    const titleText = this.add
      .text(0, -78, title, { ...TEXT_STYLE, fontSize: "50px", color: titleColor, strokeThickness: 12 })
      .setOrigin(0.5)
      .setShadow(0, 4, "#120a04", 0, false, true);
    const subText = this.add
      .text(0, -6, sub, { ...TEXT_STYLE, fontSize: "20px", color: "#efe1c8" })
      .setOrigin(0.5);
    // 按钮：悬浮影 + 光晕 + hover 反馈
    const btnShadow = this.add.graphics();
    btnShadow.fillStyle(0x000000, 0.35);
    btnShadow.fillRoundedRect(-108, 48, 216, 56, 12);
    const btn = this.add.image(0, 70, "btn").setInteractive({ useHandCursor: true });
    const btnText = this.add
      .text(0, 70, "再来一局", { ...TEXT_STYLE, fontSize: "24px", color: "#f3ffd9", strokeThickness: 5 })
      .setOrigin(0.5)
      .setShadow(0, 2, "#0f2a08", 0, false, true);
    btn.on("pointerdown", () => bus.emit("request-restart"));
    btn.on("pointerover", () => {
      this.tweens.add({ targets: [btn, btnText], scale: 1.06, duration: 130, ease: "Sine.easeOut" });
    });
    btn.on("pointerout", () => {
      this.tweens.add({ targets: [btn, btnText], scale: 1, duration: 130, ease: "Sine.easeOut" });
    });
    // 选关按钮：次级样式（暗金描边），回选关场景
    const selBtnShadow = this.add.graphics();
    selBtnShadow.fillStyle(0x000000, 0.3);
    selBtnShadow.fillRoundedRect(-108, 118, 216, 52, 12);
    const selBtn = this.add.image(0, 138, "btn").setDisplaySize(200, 50).setInteractive({ useHandCursor: true });
    selBtn.setTint(0x9db8d8);
    const selBtnText = this.add
      .text(0, 138, "选关", { ...TEXT_STYLE, fontSize: "22px", color: "#e8f0ff", strokeThickness: 5 })
      .setOrigin(0.5)
      .setShadow(0, 2, "#0f2a08", 0, false, true);
    selBtn.on("pointerdown", () => bus.emit("request-level-select"));
    selBtn.on("pointerover", () => {
      this.tweens.add({ targets: [selBtn, selBtnText], scale: 1.06, duration: 130, ease: "Sine.easeOut" });
    });
    selBtn.on("pointerout", () => {
      this.tweens.add({ targets: [selBtn, selBtnText], scale: 1, duration: 130, ease: "Sine.easeOut" });
    });
    container.add([mask, panel, titleText, subText, btnShadow, btn, btnText, selBtnShadow, selBtn, selBtnText]);
    this.overlay = container;
  }

  private onGameOver(waveReached: number): void {
    if (this.overlay) return;
    this.buildOverlay("僵尸吃掉了你的脑子！", "#ff5a4e", `坚持到了第 ${waveReached} 波`);
  }

  private onVictory(): void {
    if (this.overlay) return;
    this.buildOverlay("胜利！", "#ffd94d", `守住了全部 ${this.totalWaves} 波进攻`);
  }

  // ---------- 每帧刷新（卡槽高亮 + 空槽状态） ----------

  update(): void {
    const g = this.dynamicGfx;
    if (!g) return;
    g.clear();
    // 空槽提示点：有卡的槽常亮，无卡的槽暗淡示意反转
    for (let i = 0; i < BELT_CAPACITY; i++) {
      const tile = this.beltTiles[i];
      if (!tile) continue;
      const slot = this.beltItems[i];
      const has = !!slot;
      tile.setTint(has ? 0xffffff : 0xb8a888);
      // 传送带卡选中：金色外发光描边 + 内晕填充（选则性反馈强化）
      if (slot && this.selectedBeltId === slot.id) {
        g.fillStyle(0xffd700, 0.18);
        g.fillRoundedRect(tileX(i) - 2, TILE_Y - 2, BELT_SLOT_W + 4, TILE_H + 4, 10);
        g.lineStyle(3.5, 0xffd700, 1);
        g.strokeRoundedRect(tileX(i) - 2, TILE_Y - 2, BELT_SLOT_W + 4, TILE_H + 4, 10);
        g.lineStyle(1.5, 0xffffff, 0.55);
        g.strokeRoundedRect(tileX(i) + 2, TILE_Y + 2, BELT_SLOT_W - 4, TILE_H - 4, 8);
      }
    }
    // 铲子金色高亮
    if (this.selected === "shovel" && this.shovelSlot) {
      g.lineStyle(3.5, 0xffd700, 1);
      g.strokeRoundedRect(this.shovelSlot.x - 2, this.shovelSlot.y - 2, 60, 90, 9);
    }

    const pg = this.progressGfx;
    if (pg) {
      const { x, y, w, h } = this.progressMeta;
      pg.clear();
      // 外框凹槽 + 内槽
      pg.fillStyle(0x140e05, 0.92);
      pg.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 7);
      pg.fillStyle(0x0c0a04, 0.95);
      pg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 5);
      // 进度填充：上亮下暗 + 顶部高光 + 斜刻度
      if (this.progress > 0) {
        const pw = Math.max(6, w * this.progress);
        pg.fillGradientStyle(0x9fe46b, 0x9fe46b, 0x53a93c, 0x53a93c, 1);
        pg.fillRoundedRect(x, y, pw, h, 5);
        pg.fillStyle(0xffffff, 0.28);
        pg.fillRoundedRect(x, y, pw, 4, 3);
        pg.fillStyle(0xffffff, 0.12);
        for (let s = 18; s < pw; s += 18) pg.fillRect(x + s - 1, y + 1, 2, h - 2);
      }
      pg.lineStyle(2, 0x3a2a18, 1);
      pg.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 7);
      pg.lineStyle(1, 0xd8c9a3, 0.6);
      pg.strokeRoundedRect(x - 1.5, y - 1.5, w + 3, h + 3, 6);
    }
  }
}