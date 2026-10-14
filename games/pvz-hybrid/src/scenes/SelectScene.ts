import Phaser from "phaser";
import { H, W, plantDef, type PlantKind, type ZombieKind } from "../config";
import { LEVELS, type LevelDef, type Terrain } from "../levels";
import { iconFit } from "../ui/iconFit";

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "Arial, '微软雅黑', sans-serif",
  color: "#ffffff",
  stroke: "#26150a",
  strokeThickness: 4,
};

const TERRAIN_META: Record<Terrain, { icon: string; desc: string; color: number }> = {
  day: { icon: "☀️", desc: "阳光充足", color: 0x8bc34a },
  night: { icon: "🌙", desc: "阳光稀缺 · 僵尸提速", color: 0x7986cb },
  pool: { icon: "🌊", desc: "中行泳池 · 水行减速", color: 0x4fc3f7 },
};

/** 推荐默认卡组：均衡输出 + 防御 */
const DEFAULT_DECK: PlantKind[] = ["peashooter", "snowpea", "repeater", "wallnut", "threepeater", "fireflower"];

export class SelectScene extends Phaser.Scene {
  private content: Phaser.GameObjects.Container | null = null;
  private level: LevelDef | null = null;
  private selected = new Set<PlantKind>();

  constructor() {
    super("select");
  }

  create(): void {
    this.drawBackground();
    this.showLevelSelect();
  }

  private clearContent(): void {
    this.content?.destroy();
    this.content = this.add.container(0, 0);
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1c3a26, 0x1c3a26, 0x0e2215, 0x0e2215, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x2e7d32, 0.7);
    g.fillRect(0, 0, W, 6);
    g.fillStyle(0x4caf50, 0.08);
    g.fillRect(0, H - 40, W, 40);
    g.destroy();
  }

  private showLevelSelect(): void {
    this.level = null;
    this.clearContent();
    const c = this.content!;

    c.add(this.add.text(W / 2, 64, "选择关卡", { ...TEXT_STYLE, fontSize: "34px", fontStyle: "bold" }).setOrigin(0.5));
    c.add(
      this.add
        .text(W / 2, 108, "查看僵尸预览，策略性选择出战植物", { ...TEXT_STYLE, fontSize: "15px", color: "#b7d9b7" })
        .setOrigin(0.5)
    );

    const cardW = 280;
    const cardH = 240;
    const gap = 26;
    const totalW = LEVELS.length * cardW + (LEVELS.length - 1) * gap;
    const startX = (W - totalW) / 2 + cardW / 2;
    const y = 250;

    LEVELS.forEach((level, i) => {
      const x = startX + i * (cardW + gap);
      this.drawLevelCard(c, level, x, y, cardW, cardH);
    });
  }

  private drawLevelCard(
    c: Phaser.GameObjects.Container,
    level: LevelDef,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const meta = TERRAIN_META[level.terrain];
    const g = this.add.graphics();
    g.fillStyle(0x0f2418, 0.94);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
    g.lineStyle(3, meta.color, 0.95);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
    g.fillStyle(meta.color, 0.18);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, 34, 12);
    c.add(g);

    // 关卡名称
    c.add(
      this.add
        .text(x, y - h / 2 + 22, `${meta.icon} ${level.name}`, { ...TEXT_STYLE, fontSize: "24px", fontStyle: "bold" })
        .setOrigin(0.5)
    );
    
    // 关卡描述
    c.add(this.add.text(x, y - h / 2 + 62, meta.desc, { ...TEXT_STYLE, fontSize: "15px", color: "#cfe8cf" }).setOrigin(0.5));
    
    // 波次信息
    c.add(
      this.add
        .text(x, y - h / 2 + 96, `共 ${level.totalWaves} 波 · 选 ${level.selectSlots} 株出战`, {
          ...TEXT_STYLE,
          fontSize: "14px",
          color: "#9ad3a0",
        })
        .setOrigin(0.5)
    );
    
    // 僵尸预览区域
    this.drawZombiePreview(c, level, x, y - h / 2 + 130, w);
    
    // 点击提示
    c.add(this.add.text(x, y + h / 2 - 20, "点击选择", { ...TEXT_STYLE, fontSize: "14px", color: "#cfe8cf" }).setOrigin(0.5));

    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.showZombiePreview(level));
    c.add(zone);
  }

  // 绘制僵尸预览
  private drawZombiePreview(
    c: Phaser.GameObjects.Container,
    level: LevelDef,
    x: number,
    y: number,
    w: number
  ): void {
    const zombies = this.getZombiesInLevel(level);
    const previewW = w - 20;
    const iconSize = 32;
    const gap = 8;
    const startX = x - previewW / 2 + iconSize / 2;
    
    // 标题
    c.add(
      this.add
        .text(x, y, "本关出现的僵尸：", { ...TEXT_STYLE, fontSize: "12px", color: "#ffcc00" })
        .setOrigin(0.5)
    );
    
    // 僵尸图标
    zombies.forEach((kind, i) => {
      const iconX = startX + i * (iconSize + gap);
      const iconY = y + 20;
      
      // 僵尸图标背景
      const bg = this.add.graphics();
      bg.fillStyle(0x3a2a1a, 0.8);
      bg.fillCircle(iconX, iconY, iconSize / 2);
      bg.lineStyle(1, 0x666666, 0.6);
      bg.strokeCircle(iconX, iconY, iconSize / 2);
      c.add(bg);
      
      // 僵尸图标
      const zombieIcon = this.add.text(iconX, iconY, this.getZombieEmoji(kind), {
        fontSize: "20px",
      }).setOrigin(0.5);
      c.add(zombieIcon);
      
      // 僵尸名称
      c.add(
        this.add
          .text(iconX, iconY + iconSize / 2 + 4, this.getZombieName(kind), {
            ...TEXT_STYLE,
            fontSize: "10px",
            color: "#cccccc",
          })
          .setOrigin(0.5)
      );
    });
  }

  // 获取关卡中的僵尸类型
  private getZombiesInLevel(level: LevelDef): ZombieKind[] {
    const zombies = new Set<ZombieKind>();
    
    // 根据关卡配置和波次推断僵尸类型
    if (level.terrain === "day") {
      zombies.add("basic");
      if (level.totalWaves >= 2) zombies.add("cone");
      if (level.totalWaves >= 4) zombies.add("bucket");
      if (level.totalWaves >= 6) zombies.add("runner");
      if (level.totalWaves >= 7) zombies.add("giant");
      if (level.totalWaves >= 8) zombies.add("dancer");
      if (level.totalWaves >= 9) zombies.add("digger");
      if (level.totalWaves >= 10) zombies.add("balloon");
    } else if (level.terrain === "night") {
      zombies.add("basic");
      zombies.add("cone");
      if (level.totalWaves >= 3) zombies.add("bucket");
      if (level.totalWaves >= 5) zombies.add("runner");
      if (level.totalWaves >= 6) zombies.add("giant");
      if (level.totalWaves >= 7) zombies.add("dancer");
      if (level.totalWaves >= 8) zombies.add("digger");
      if (level.totalWaves >= 9) zombies.add("balloon");
      if (level.totalWaves >= 10) zombies.add("catapult");
    } else if (level.terrain === "pool") {
      zombies.add("basic");
      zombies.add("cone");
      zombies.add("bucket");
      if (level.totalWaves >= 5) zombies.add("runner");
      if (level.totalWaves >= 6) zombies.add("giant");
      if (level.totalWaves >= 7) zombies.add("dancer");
      if (level.totalWaves >= 8) zombies.add("digger");
      if (level.totalWaves >= 9) zombies.add("balloon");
      if (level.totalWaves >= 10) zombies.add("catapult");
    }
    return Array.from(zombies);
  }

  // 获取僵尸表情符号
  private getZombieEmoji(kind: ZombieKind): string {
    const emojis: Record<ZombieKind, string> = {
      basic: "🧟",
      cone: "🧟‍♂️",
      bucket: "🪣",
      flag: "🚩",
      runner: "🏃",
      giant: "👹",
      dancer: "💃",
      digger: "⛏️",
      balloon: "🎈",
      catapult: "🏹",
    };
    return emojis[kind] || "🧟";
  }

  // 获取僵尸名称
  private getZombieName(kind: ZombieKind): string {
    const names: Record<ZombieKind, string> = {
      basic: "普通",
      cone: "路障",
      bucket: "铁桶",
      flag: "旗帜",
      runner: "猎犬",
      giant: "巨人",
      dancer: "舞王",
      digger: "矿工",
      balloon: "气球",
      catapult: "投石车",
    };
    return names[kind] || "僵尸";
  }

  // 新增：显示僵尸预览界面
  private showZombiePreview(level: LevelDef): void {
    this.level = level;
    this.clearContent();
    const c = this.content!;

    c.add(
      this.add
        .text(W / 2, 50, `${level.name} - 僵尸预览`, { ...TEXT_STYLE, fontSize: "26px", fontStyle: "bold" })
        .setOrigin(0.5)
    );

    // 僵尸列表 - 网格布局
    const zombies = this.getZombiesInLevel(level);
    const cardW = 100;
    const cardH = 120;
    const gap = 15;
    const cols = 5; // 每行5个
    const rows = Math.ceil(zombies.length / cols);
    const startY = 120;

    zombies.forEach((kind, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rowCount = Math.min(cols, zombies.length - row * cols);
      const rowW = rowCount * cardW + (rowCount - 1) * gap;
      const startX = (W - rowW) / 2 + cardW / 2;
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      this.drawZombieCard(c, kind, x, y, cardW, cardH);
    });

    // 提示信息
    c.add(
      this.add
        .text(W / 2, startY + rows * (cardH + gap) + 20, "根据僵尸类型，策略性选择出战植物！", {
          ...TEXT_STYLE,
          fontSize: "16px",
          color: "#ffd54f",
        })
        .setOrigin(0.5)
    );

    // 继续按钮
    const continueBtn = this.add.image(W / 2 + 95, 428, "btn").setDisplaySize(180, 56);
    continueBtn.setInteractive({ useHandCursor: true });
    continueBtn.on("pointerdown", () => this.showCardSelect(level));
    c.add(continueBtn);
    c.add(this.add.text(W / 2 + 95, 428, "选择植物", { ...TEXT_STYLE, fontSize: "22px", fontStyle: "bold" }).setOrigin(0.5));

    // 返回按钮
    const backBtn = this.add.image(W / 2 - 95, 428, "btn").setDisplaySize(180, 56);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on("pointerdown", () => this.showLevelSelect());
    c.add(backBtn);
    c.add(this.add.text(W / 2 - 95, 428, "返回", { ...TEXT_STYLE, fontSize: "22px", fontStyle: "bold" }).setOrigin(0.5));
  }

  // 绘制僵尸卡片
  private drawZombieCard(
    c: Phaser.GameObjects.Container,
    kind: ZombieKind,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const g = this.add.graphics();
    g.fillStyle(0x1a0f0a, 0.9);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    g.lineStyle(2, 0x666666, 0.8);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    c.add(g);

    // 僵尸图标
    const emoji = this.add.text(x, y - 10, this.getZombieEmoji(kind), {
      fontSize: "32px",
    }).setOrigin(0.5);
    c.add(emoji);

    // 僵尸名称
    c.add(
      this.add
        .text(x, y + 30, this.getZombieName(kind), { ...TEXT_STYLE, fontSize: "14px" })
        .setOrigin(0.5)
    );

    // 僵尸特性
    const trait = this.getZombieTrait(kind);
    c.add(
      this.add
        .text(x, y + 50, trait, { ...TEXT_STYLE, fontSize: "11px", color: "#ffaa00" })
        .setOrigin(0.5)
    );
  }

  // 获取僵尸特性
  private getZombieTrait(kind: ZombieKind): string {
    const traits: Record<ZombieKind, string> = {
      basic: "普通",
      cone: "护甲",
      bucket: "重甲",
      flag: "快速",
      runner: "高速",
      giant: "高血量",
      dancer: "召唤",
      digger: "绕后",
      balloon: "飞行",
      catapult: "远程",
    };
    return traits[kind] || "普通";
  }

  private showCardSelect(level: LevelDef): void {
    this.level = level;
    this.selected = new Set(DEFAULT_DECK.filter((k) => level.selectable.includes(k)));
    for (const k of level.selectable) {
      if (this.selected.size >= level.selectSlots) break;
      this.selected.add(k);
    }
    this.renderCardSelect();
  }

  private renderCardSelect(): void {
    const level = this.level;
    if (!level) return;
    this.clearContent();
    const c = this.content!;

    c.add(
      this.add
        .text(W / 2, 50, `选择出战植物 · ${level.name}`, { ...TEXT_STYLE, fontSize: "26px", fontStyle: "bold" })
        .setOrigin(0.5)
    );

    const cardW = 92;
    const cardH = 112;
    const gap = 12;
    const cols = 9; // 每行9个
    const rows = Math.ceil(level.selectable.length / cols);
    const startY = 100;

    level.selectable.forEach((kind, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rowCount = Math.min(cols, level.selectable.length - row * cols);
      const rowW = rowCount * cardW + (rowCount - 1) * gap;
      const startX = (W - rowW) / 2 + cardW / 2;
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      this.drawPlantCard(c, kind, x, y, cardW, cardH);
    });

    const full = this.selected.size === level.selectSlots;
    c.add(
      this.add
        .text(W / 2, startY + rows * (cardH + gap) + 20, `已选 ${this.selected.size}/${level.selectSlots} 株${full ? " · 可以开战了！" : ""}`, {
          ...TEXT_STYLE,
          fontSize: "17px",
          color: full ? "#ffd54f" : "#cfe8cf",
        })
        .setOrigin(0.5)
    );

    const startBtn = this.add.image(W / 2 + 95, 428, "btn").setDisplaySize(180, 56);
    startBtn.setInteractive({ useHandCursor: true });
    startBtn.on("pointerdown", () => this.startBattle());
    c.add(startBtn);
    c.add(this.add.text(W / 2 + 95, 428, "开始战斗", { ...TEXT_STYLE, fontSize: "22px", fontStyle: "bold" }).setOrigin(0.5));

    const backBtn = this.add.image(W / 2 - 95, 428, "btn").setDisplaySize(180, 56);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on("pointerdown", () => this.showLevelSelect());
    c.add(backBtn);
    c.add(this.add.text(W / 2 - 95, 428, "返回", { ...TEXT_STYLE, fontSize: "22px", fontStyle: "bold" }).setOrigin(0.5));
  }

  private drawPlantCard(
    c: Phaser.GameObjects.Container,
    kind: PlantKind,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const def = plantDef(kind);
    const sel = this.selected.has(kind);
    const g = this.add.graphics();
    g.fillStyle(sel ? 0x2e7d32 : 0x0f2418, sel ? 0.96 : 0.9);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    g.lineStyle(sel ? 3 : 1, sel ? 0xffd54f : 0x4a7a4a, 1);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    c.add(g);

    const fit = iconFit(this, def.texture);
    const icon = this.add.image(x, y - 16, def.texture).setScale(fit.scale).setOrigin(0.5);
    icon.x += fit.offX;
    icon.y += fit.offY;
    c.add(icon);

    c.add(this.add.text(x, y + 26, def.name, { ...TEXT_STYLE, fontSize: "13px" }).setOrigin(0.5));

    if (sel) {
      c.add(
        this.add
          .text(x + w / 2 - 14, y - h / 2 + 12, "✓", { fontSize: "22px", color: "#ffd54f", fontStyle: "bold" })
          .setOrigin(0.5)
      );
    }

    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.togglePlant(kind));
    c.add(zone);
  }

  private togglePlant(kind: PlantKind): void {
    if (!this.level) return;
    if (this.selected.has(kind)) {
      this.selected.delete(kind);
    } else {
      if (this.selected.size >= this.level.selectSlots) return;
      this.selected.add(kind);
    }
    // 事件处理中销毁自身 zone 不安全，延后一帧重绘
    this.time.delayedCall(0, () => this.renderCardSelect());
  }

  private startBattle(): void {
    if (!this.level) return;
    if (this.selected.size !== this.level.selectSlots) return;
    this.scene.start("game", { levelId: this.level.id, deck: [...this.selected] });
  }
}
