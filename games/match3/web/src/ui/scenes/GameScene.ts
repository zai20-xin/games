import Phaser from "phaser";
import { GameSession } from "../../game/session";
import type { BoardEvent } from "../../game/board";
import { LevelData } from "../../game/levels";
import { Pos, Special, hasTile, manhattan } from "../../game/cells";
import { SaveManager, BOOSTER_NAMES, BoosterKind } from "../save";
import { Sfx } from "../sfx";
import { UIKit, PALETTE, SHAPE_VERTICES, comboWord, panelStyle } from "../uikit";
import { downloadScoreCard } from "../scorecard";
import { recordDailyRun } from "../../game/daily";

const CELL = 86;
const RADIUS = 36;

const TUTORIAL_CARDS: Record<string, { title: string; body: string }> = {
  basic: {
    title: "欢迎来到糖果连锁",
    body: "点击或拖动交换相邻棋子，凑成横竖 3 个同色即可消除。在步数内完成目标即通关！",
  },
  stripe: {
    title: "条纹棋子",
    body: "一次消除 4 个同色棋子会生成条纹棋子：横向四连生成竖条纹（清一列），纵向四连生成横条纹（清一行）。两个条纹直接互换触发十字双清！",
  },
  bomb_rainbow: {
    title: "炸弹与彩虹球",
    body: "L/T 形消除生成炸弹（3×3 爆破）；五连生成彩虹球，与任意棋子交换可清除全场同色。特殊棋子两两互换还有更强组合！",
  },
  frost: {
    title: "冰霜障碍",
    body: "冰霜格无法移动，需要在其相邻处消除、或用特殊棋子波及来削层。多层冰霜需要多次打击！",
  },
};

interface TileView {
  container: Phaser.GameObjects.Container;
  /** 糖果本体：共享烘焙纹理的 Image（同色同特殊型全局复用一张纹理） */
  body: Phaser.GameObjects.Image;
  ring?: Phaser.GameObjects.Graphics;
  spinner?: Phaser.GameObjects.Graphics;
  spark?: Phaser.GameObjects.Graphics;
  color: number;
  special: Special;
}

export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private level!: LevelData;
  private originX = 0;
  private originY = 0;
  private tiles = new Map<string, TileView>();
  private busy = true;
  private aimMode: "" | "hammer" | "swap" = "";
  private swapFirstPick: Pos | null = null;
  private pressedCell: Pos | null = null;
  private swipeConsumed = false;
  private selectedCell: Pos | null = null;
  private hintTargets: Phaser.GameObjects.Container[] = [];
  private idleTimer!: Phaser.Time.TimerEvent;
  private boosterButtons = new Map<BoosterKind, ReturnType<typeof UIKit.button>>();
  private aimLabel!: Phaser.GameObjects.Text;
  private hudTexts = new Map<string, Phaser.GameObjects.Text>();
  private goalsBox!: Phaser.GameObjects.Container;
  private paused = false;
  private resultOpen = false;
  private pauseUI: Phaser.GameObjects.GameObject[] = [];
  private isDaily = false;

  constructor() {
    super("Game");
  }

  async create(data: { level?: LevelData; daily?: boolean }): Promise<void> {
    UIKit.attach(this);
    UIKit.backdrop(this);
    UIKit.fade();

    if (!data.level) {
      this.scene.start("LevelMap");
      return;
    }
    this.level = data.level;
    this.isDaily = !!data.daily;
    this.paused = false;
    this.resultOpen = false;
    this.pauseUI = [];

    const seed = Math.floor(Math.random() * 100000);
    this.session = new GameSession(this.level);
    this.session.start(seed);

    this.originX = (720 - this.level.width * CELL) / 2;
    this.originY = Math.max(230, (1280 - this.level.height * CELL) / 2 + 40);
    this.tiles.clear();

    this.drawBoardFrame();
    this.rebuildTiles();
    this.dealIn();

    this.buildHud();
    this.buildBoosterBar();
    this.initBurstPool();
    this.buildInput();
    this.buildIdleTimer();

    Sfx.applySettings(SaveManager.getSetting("sfx"), SaveManager.getSetting("music"));
    Sfx.playMusic();

    this.showBriefing();
  }

  override update(_time: number, delta: number): void {
    if (this.paused) return;
    const d = delta / 1000;
    for (const view of this.tiles.values()) {
      if (view.spinner) view.spinner.rotation += d * 1.5;
      if (view.spark) {
        const flicker = Math.sin(this.time.now / 90) * 0.5 + 0.5;
        view.spark.alpha = 0.45 + 0.55 * flicker;
        const s = 0.85 + 0.3 * flicker;
        view.spark.setScale(s);
      }
    }
  }

  // ---------- 布局工具 ----------

  private cellCenter(pos: Pos): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      this.originX + (pos.x + 0.5) * CELL,
      this.originY + (pos.y + 0.5) * CELL,
    );
  }

  private keyOf(pos: Pos): string {
    return `${pos.x},${pos.y}`;
  }

  private posToCell(worldX: number, worldY: number): Pos | null {
    const x = Math.floor((worldX - this.originX) / CELL);
    const y = Math.floor((worldY - this.originY) / CELL);
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) return null;
    return { x, y };
  }

  // ---------- 棋盘渲染 ----------

  private drawBoardFrame(): void {
    const g = this.add.graphics().setDepth(1);
    const pad = 20;
    const x = this.originX - pad;
    const y = this.originY - pad;
    const w = this.level.width * CELL + pad * 2;
    const h = this.level.height * CELL + pad * 2;
    g.fillStyle(0xffffff, 0.055);
    g.fillRoundedRect(x, y, w, h, 28);
    g.lineStyle(2, 0xffffff, 0.1);
    g.strokeRoundedRect(x, y, w, h, 28);
    for (let r = 0; r < this.level.height; r++) {
      for (let c = 0; c < this.level.width; c++) {
        const center = this.cellCenter({ x: c, y: r });
        g.fillStyle(0x000000, 0.17);
        g.fillCircle(center.x, center.y, 33);
        g.lineStyle(2, 0xffffff, 0.05);
        g.strokeCircle(center.x, center.y, 30);
      }
    }
  }

  /** 五层伪立体糖果绘制 */
  private drawCandy(g: Phaser.GameObjects.Graphics, color: number, special: Special): void {
    const body = PALETTE[Phaser.Math.Clamp(color, 0, PALETTE.length - 1)];
    const darken = (amount: number) => this.shadeColor(body, -amount);
    const lighten = (amount: number) => this.shadeColor(body, amount);

    // 落地投影
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(0, RADIUS * 0.62 + 7, RADIUS * 1.9, RADIUS * 0.78);

    const shape = SHAPE_VERTICES[Phaser.Math.Clamp(color, 0, 5)];
    if (!shape) {
      for (let i = 1; i <= 3; i++) {
        g.fillStyle(darken(14 * i), 1);
        g.fillCircle(0, i * 2.6, RADIUS - 1);
      }
      g.fillStyle(lighten(5), 1);
      g.fillCircle(0, 0, RADIUS);
      g.fillStyle(lighten(16), 1);
      g.fillCircle(0, -2.5, RADIUS * 0.8);
    } else {
      for (let i = 1; i <= 3; i++) {
        g.fillStyle(darken(14 * i), 1);
        this.fillPoly(g, shape, RADIUS - 1, 0, i * 2.6);
      }
      g.fillStyle(lighten(5), 1);
      this.fillPoly(g, shape, RADIUS, 0, 0);
      g.fillStyle(lighten(16), 1);
      this.fillPoly(g, shape, RADIUS * 0.78, 0, -2.5);
    }

    // 高光
    g.fillStyle(0xffffff, 0.42);
    g.fillEllipse(-RADIUS * 0.34, -RADIUS * 0.42, RADIUS * 0.52, RADIUS * 0.29);
    g.fillStyle(0xffffff, 0.75);
    g.fillCircle(-RADIUS * 0.1, -RADIUS * 0.52, 4.5);

    if (special === Special.STRIPE_H || special === Special.STRIPE_V) {
      const vertical = special === Special.STRIPE_V;
      for (const k of [-13, 0, 13]) {
        const bx = vertical ? k - 3.5 : -RADIUS + 9;
        const by = vertical ? -RADIUS + 9 : k - 3.5;
        const bw = vertical ? 7 : (RADIUS - 9) * 2;
        const bh = vertical ? (RADIUS - 9) * 2 : 7;
        g.fillStyle(0xffffff, 0.28);
        g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        g.fillStyle(0xffffff, 0.88);
        g.fillRect(bx, by, bw, bh);
      }
    } else if (special === Special.BOMB) {
      g.fillStyle(0x1a1a26, 1);
      g.fillCircle(0, 0, 21);
      g.lineStyle(3, 0xffffff, 0.35);
      g.beginPath();
      g.arc(0, 0, 21, Phaser.Math.DegToRad(126), Phaser.Math.DegToRad(288));
      g.strokePath();
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(-7, -8, 4.5);
    } else if (special === Special.RAINBOW) {
      g.fillStyle(0xffffff, 0.94);
      g.fillCircle(0, 0, 17);
    }
  }

  private fillPoly(
    g: Phaser.GameObjects.Graphics,
    shape: [number, number][],
    scale: number,
    ox: number,
    oy: number,
  ): void {
    const pts = shape.map(([vx, vy]) => new Phaser.Geom.Point(vx * scale + ox, vy * scale + oy));
    g.fillPoints(pts, true);
  }

  private shadeColor(color: number, amount: number): number {
    const cl = Phaser.Display.Color.IntegerToColor(color);
    const target = amount > 0 ? 255 : 0;
    const ratio = Math.abs(amount) / 100;
    const r = Phaser.Math.Linear(cl.red, target, ratio);
    const gch = Phaser.Math.Linear(cl.green, target, ratio);
    const b = Phaser.Math.Linear(cl.blue, target, ratio);
    return Phaser.Display.Color.GetColor(Math.round(r), Math.round(gch), Math.round(b));
  }

  /**
   * 糖果纹理烘焙缓存：每种 (颜色, 特殊型) 组合只画一次 Graphics 并存成纹理，
   * 之后所有同款宝石复用同一张 Image 纹理 —— 消除每颗宝石独立 Graphics 的
   * 命令缓冲开销，大幅降低 draw call 与重建成本。
   */
  private ensureCandyTexture(color: number, special: Special): string {
    const key = `candy-${color}-${special}`;
    if (this.textures.exists(key)) return key;
    const g = this.add.graphics();
    this.drawCandy(g, color, special);
    const rt = this.add.renderTexture(0, 0, CELL, CELL).setVisible(false);
    rt.beginDraw();
    rt.batchDraw(g, CELL / 2, CELL / 2);
    rt.endDraw();
    rt.saveTexture(key);
    g.destroy();
    rt.destroy();
    return key;
  }

  private makeTileView(pos: Pos, color: number, special: Special, depth = 10): TileView {
    const center = this.cellCenter(pos);
    const container = this.add.container(center.x, center.y).setDepth(depth);
    const body = this.add.image(0, 0, this.ensureCandyTexture(color, special));
    container.add(body);

    const view: TileView = { container, body, color, special };

    if (special === Special.RAINBOW) {
      const spinner = this.add.graphics();
      const colors = [0xff5a5f, 0xffc043, 0x7ae582, 0x4cc9f0, 0xb388ff];
      for (let i = 0; i < colors.length; i++) {
        spinner.lineStyle(8, colors[i], 1);
        spinner.beginPath();
        spinner.arc(0, 0, 26, ((Math.PI * 2) * i) / 5, ((Math.PI * 2) * (i + 0.8)) / 5);
        spinner.strokePath();
      }
      spinner.lineStyle(2, 0xffffff, 0.25);
      spinner.strokeCircle(0, 0, 30);
      container.add(spinner);
      view.spinner = spinner;
    }
    if (special === Special.BOMB) {
      const spark = this.add.graphics();
      spark.lineStyle(3, 0xffb703, 1);
      for (let i = 0; i < 4; i++) {
        const angle = ((Math.PI * 2) * i) / 4 + 0.4;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        spark.beginPath();
        spark.moveTo(dx * 6, dy * 6);
        spark.lineTo(dx * 13, dy * 13);
        spark.strokePath();
      }
      spark.fillStyle(0xfff3c4, 1);
      spark.fillCircle(0, 0, 4);
      spark.setPosition(RADIUS * 0.52, -RADIUS * 0.62);
      container.add(spark);
      view.spark = spark;
    }

    this.tiles.set(this.keyOf(pos), view);
    return view;
  }

  private rebuildTiles(): void {
    for (const view of this.tiles.values()) view.container.destroy();
    this.tiles.clear();
    for (let r = 0; r < this.level.height; r++) {
      for (let c = 0; c < this.level.width; c++) {
        const cell = this.session.board.cellAt({ x: c, y: r });
        if (!hasTile(cell)) continue;
        this.makeTileView({ x: c, y: r }, cell.color, cell.special);
      }
    }
  }

  /** 发牌入场：按列错峰弹跳落位 */
  private dealIn(): void {
    for (const [key, view] of this.tiles.entries()) {
      const [x, y] = key.split(",").map(Number);
      const target = this.cellCenter({ x, y });
      view.container.y = target.y - CELL * (3.5 + (x % 3));
    }
    for (const [key, view] of this.tiles.entries()) {
      const [x, y] = key.split(",").map(Number);
      const target = this.cellCenter({ x, y });
      this.tweens.add({
        targets: view.container,
        y: target.y,
        duration: 450,
        delay: x * 60 + (y % 2) * 20,
        ease: "Bounce.easeOut",
      });
    }
  }

  // ---------- HUD ----------

  private buildHud(): void {
    UIKit.button(110, 52, 190, 52, "← 选关", () => this.scene.start("LevelMap"), 22);

    const title = UIKit.label(
      220,
      36,
      `第 ${this.level.id} 关 · ${this.level.levelName}`,
      24,
    );
    this.hudTexts.set("title", title);

    const moves = UIKit.label(700, 30, "", 32).setOrigin(1, 0);
    this.hudTexts.set("moves", moves);

    const score = UIKit.label(220, 70, "", 30);
    this.hudTexts.set("score", score);

    const stars = UIKit.label(420, 74, "", 26, "#ffc043");
    this.hudTexts.set("stars", stars);

    this.goalsBox = this.add.container(220, 116).setDepth(20);

    // 触屏暂停入口（键盘 P 的等效按钮）
    UIKit.button(600, 112, 96, 46, "暂停", () => this.togglePause(), 18);

    const bar = this.add.graphics().setDepth(19);
    bar.fillStyle(0x171a2e, 0.82);
    bar.fillRoundedRect(16, 18, 692, 168, 22);
    bar.lineStyle(2, 0xffffff, 0.1);
    bar.strokeRoundedRect(16, 18, 692, 168, 22);

    this.refreshHud();
    this.refreshBoosters();
  }

  private refreshHud(): void {
    const moves = this.hudTexts.get("moves")!;
    moves.setText(`步数 ${this.session.movesLeft}`);
    moves.setColor(this.session.movesLeft <= 3 ? "#ff5a5f" : "#ffffff");

    this.hudTexts.get("score")!.setText(`分数 ${this.session.score}`);

    const thresholds = this.level.stars;
    let liveStars = 0;
    for (let i = 0; i < 3; i++) {
      if (this.session.score >= thresholds[i]) liveStars = i + 1;
    }
    let starText = "";
    for (let i = 0; i < 3; i++) starText += i < liveStars ? "★" : "☆";
    this.hudTexts.get("stars")!.setText(starText);

    this.goalsBox.removeAll(true);
    let gy = 0;
    for (const goal of this.session.goalSnapshots()) {
      const icon = this.add.graphics();
      const iconColor =
        goal.type === "collect" ? PALETTE[goal.color] : goal.type === "frost" ? 0xcdeaff : 0xffc043;
      if (goal.type === "frost") {
        icon.lineStyle(3.5, 0xcdeaff, 1);
        for (let i = 0; i < 3; i++) {
          const angle = (Math.PI * i) / 3;
          icon.beginPath();
          icon.moveTo(8 - Math.cos(angle) * 13, gy + 14 - Math.sin(angle) * 13);
          icon.lineTo(8 + Math.cos(angle) * 13, gy + 14 + Math.sin(angle) * 13);
          icon.strokePath();
        }
      } else if (goal.type === "score") {
        icon.fillStyle(goal.done ? 0xffc043 : 0x444a6e, 1);
        this.drawStar(icon, 8, gy + 14, 13, goal.done ? 0.28 : 0);
      } else {
        icon.fillStyle(iconColor, 1);
        icon.fillCircle(8, gy + 14, 13);
        icon.fillStyle(0xffffff, 0.4);
        icon.fillEllipse(4, gy + 9, 10, 6);
      }
      this.goalsBox.add(icon);

      const done = goal.done ? "  ✓" : "";
      const text =
        goal.type === "score"
          ? `达到 ${goal.target} 分`
          : goal.type === "frost"
            ? `剩余冰霜 ${goal.target - goal.progress}${done}`
            : `收集${this.colorName(goal.color)}棋 ${goal.progress}/${goal.target}${done}`;
      const label = UIKit.label(28, gy, text, 21);
      this.goalsBox.add(label);
      gy += 30;
    }
  }

  private drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, glowAlpha: number): void {
    if (glowAlpha > 0) {
      g.fillStyle(0xffc043, glowAlpha);
      const glowPts: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r + 3.5 : (r + 3.5) * 0.46;
        const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
        glowPts.push(new Phaser.Geom.Point(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr));
      }
      g.fillPoints(glowPts, true);
    }
    const pts: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.46;
      const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      pts.push(new Phaser.Geom.Point(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr));
    }
    g.fillPoints(pts, true);
  }

  private colorName(color: number): string {
    return ["红", "蓝", "绿", "黄", "紫", "粉"][color] ?? "?";
  }

  // ---------- 道具栏 ----------

  private buildBoosterBar(): void {
    const y = this.originY + this.level.height * CELL + 64;
    const xs: Record<BoosterKind, number> = { hammer: 150, swap: 360, shuffle: 570 };
    for (const kind of ["hammer", "swap", "shuffle"] as BoosterKind[]) {
      const btn = UIKit.button(xs[kind],
        y,
        186,
        56,
        `${BOOSTER_NAMES[kind]} x${SaveManager.getBooster(kind)}`,
        () => this.onBoosterPressed(kind),
        20,
      );
      this.boosterButtons.set(kind, btn);
    }
    this.aimLabel = UIKit.label(360, y + 52, "", 20, "#ffc043").setOrigin(0.5);
    this.aimLabel.setVisible(false);
  }

  private refreshBoosters(): void {
    for (const [kind, btn] of this.boosterButtons.entries()) {
      const count = SaveManager.getBooster(kind);
      btn.setText(`${BOOSTER_NAMES[kind]} x${count}`);
      btn.setEnabled(count > 0 && this.aimMode !== kind);
    }
  }

  private onBoosterPressed(kind: BoosterKind): void {
    if (this.busy || this.paused || this.session.finished) return;
    if (this.aimMode === kind) {
      this.cancelAim();
      return;
    }
    if (kind === "hammer" && SaveManager.getBooster("hammer") > 0) {
      this.enterAim("hammer", "点击要敲碎的棋子/冰霜");
    } else if (kind === "swap" && SaveManager.getBooster("swap") > 0) {
      this.swapFirstPick = null;
      this.enterAim("swap", "选择第一枚棋子");
    } else if (kind === "shuffle" && SaveManager.getBooster("shuffle") > 0) {
      const result = this.session.useShuffleHand();
      if (!result.ok) return;
      SaveManager.consumeBooster("shuffle");
      Sfx.play("shuffle");
      this.busy = true;
      void this.playEvents(result.events).then(() => {
        this.refreshHud();
        this.busy = false;
        this.refreshBoosters();
      });
    }
  }

  private enterAim(mode: "hammer" | "swap", hint: string): void {
    this.aimMode = mode;
    this.boardViewTargeting(true);
    this.aimLabel.setText(`${hint}（再点道具取消）`);
    this.aimLabel.setVisible(true);
    this.idleTimer.paused = true;
    this.clearHint();
    this.refreshBoosters();
  }

  private aimTargeting = false;

  private boardViewTargeting(v: boolean): void {
    this.aimTargeting = v;
  }

  private cancelAim(): void {
    this.aimMode = "";
    this.swapFirstPick = null;
    this.boardViewTargeting(false);
    this.aimLabel.setVisible(false);
    this.refreshBoosters();
  }

  private onTargetPicked(pos: Pos): void {
    const mode = this.aimMode;
    if (mode === "hammer") {
      this.cancelAim();
      const result = this.session.useHammer(pos);
      if (!result.ok) return;
      SaveManager.consumeBooster("hammer");
      this.busy = true;
      void this.playEvents(result.events).then(() => {
        this.afterSettle();
      });
    } else if (mode === "swap") {
      if (!this.swapFirstPick) {
        this.swapFirstPick = pos;
        this.aimLabel.setText("选择第二枚棋子（相邻）");
        return;
      }
      const first = this.swapFirstPick;
      this.cancelAim();
      if ((first.x === pos.x && first.y === pos.y) || manhattan(first, pos) !== 1) return;
      const result = this.session.useFreeSwap(first, pos);
      if (!result.ok) return;
      SaveManager.consumeBooster("swap");
      this.busy = true;
      void this.playEvents(result.events).then(() => this.afterSettle());
    }
  }

  private afterSettle(): void {
    this.refreshHud();
    this.busy = false;
    this.refreshBoosters();
    if (this.session.finished) {
      this.showResult();
    }
  }

  // ---------- 暂停 / 快速重开（P / R）----------

  private togglePause(): void {
    if (this.resultOpen || this.session.finished) return;
    if (this.paused) {
      this.paused = false;
      for (const go of this.pauseUI) go.destroy();
      this.pauseUI = [];
      Sfx.play("swap");
      this.resetIdle();
      return;
    }
    this.paused = true;
    this.idleTimer.paused = true;
    this.clearHint();
    if (this.aimMode !== "") this.cancelAim();
    const dim = this.add.rectangle(360, 640, 720, 1280, 0x000000, 0.62).setDepth(200);
    const panel = this.add.container(360, 640).setDepth(201);
    const bg = this.add.graphics();
    panelStyle(bg, 480, 380);
    panel.add(bg);
    panel.add(UIKit.label(0, -130, "已暂停", 44).setOrigin(0.5));
    panel.add(UIKit.label(0, -78, "P 继续 · R 重玩 · M 静音", 20, "#8f96c9").setOrigin(0.5));
    const resume = UIKit.button(0, -10, 260, 62, "继续 (P)", () => this.togglePause(), 24);
    const restart = UIKit.button(0, 66, 260, 62, "重玩本关 (R)", () => this.restartLevel(), 24);
    const quit = UIKit.button(0, 142, 260, 58, "返回选关", () => this.scene.start("LevelMap"), 22);
    panel.add([resume.container, restart.container, quit.container]);
    this.pauseUI = [dim, panel];
  }

  private restartLevel(): void {
    if (this.paused) {
      this.paused = false;
      for (const go of this.pauseUI) go.destroy();
      this.pauseUI = [];
    }
    this.scene.start("Game", { level: this.level });
  }

  // ---------- 输入 ----------

  private buildInput(): void {
    this.input.keyboard?.on("keydown-P", () => this.togglePause());
    this.input.keyboard?.on("keydown-R", () => {
      if (this.paused || this.resultOpen || this.session.finished) this.restartLevel();
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.paused) return;
      this.resetIdle();
      if (this.busy || this.session.finished) return;
      this.swipeConsumed = false;
      this.pressedCell = this.posToCell(p.worldX, p.worldY);
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.paused) return;
      if (!p.isDown || this.pressedCell === null) return;
      if (this.aimTargeting) return;
      const current = this.posToCell(p.worldX, p.worldY);
      if (
        current &&
        !(current.x === this.pressedCell.x && current.y === this.pressedCell.y) &&
        manhattan(current, this.pressedCell) === 1
      ) {
        const a = this.pressedCell;
        this.pressedCell = null;
        this.selectedCell = null;
        this.swipeConsumed = true;
        this.onSwapRequested(a, current);
      }
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.paused) {
        this.pressedCell = null;
        return;
      }
      if (this.aimTargeting) {
        const pick = this.posToCell(p.worldX, p.worldY);
        if (pick) {
          this.boardViewTargeting(false);
          this.onTargetPicked(pick);
        }
        this.pressedCell = null;
        return;
      }
      if (this.pressedCell === null) return;
      const release = this.posToCell(p.worldX, p.worldY);
      const press = this.pressedCell;
      this.pressedCell = null;
      if (this.swipeConsumed || !release) return;

      if (release.x === press.x && release.y === press.y) {
        // 点选流程
        if (this.selectedCell && manhattan(this.selectedCell, release) === 1) {
          const a = this.selectedCell;
          this.selectedCell = null;
          this.setSelection(a, false);
          this.onSwapRequested(a, release);
        } else if (
          this.selectedCell &&
          this.selectedCell.x === release.x &&
          this.selectedCell.y === release.y
        ) {
          this.setSelection(release, false);
          this.selectedCell = null;
        } else {
          if (this.selectedCell) this.setSelection(this.selectedCell, false);
          this.selectedCell = release;
          this.setSelection(release, true);
          Sfx.play("swap");
        }
      } else if (manhattan(release, press) === 1) {
        this.selectedCell = null;
        this.onSwapRequested(press, release);
      }
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.aimMode !== "") this.cancelAim();
    });
  }

  private setSelection(pos: Pos, on: boolean): void {
    const view = this.tiles.get(this.keyOf(pos));
    if (!view) return;
    if (on && !view.ring) {
      const ring = this.add.graphics();
      ring.lineStyle(5, 0xffffff, 0.95);
      ring.strokeCircle(0, 0, RADIUS + 4);
      view.container.add(ring);
      view.ring = ring;
    } else if (!on && view.ring) {
      view.ring.destroy();
      view.ring = undefined;
    }
  }

  private onSwapRequested(a: Pos, b: Pos): void {
    if (this.busy || this.session.finished) return;
    this.busy = true;
    this.idleTimer.paused = true;
    this.clearHint();
    const result = this.session.playerSwap(a, b);
    void this.playEvents(result.events).then(() => {
      this.refreshHud();
      if (!result.legal) Sfx.play("invalid");
      if (this.session.finished) {
        Sfx.play(this.session.won ? "win" : "lose");
        this.time.delayedCall(150, () => this.showResult());
      } else {
        this.busy = false;
        this.resetIdle();
      }
    });
  }

  // ---------- 事件流动画 ----------

  private async playEvents(events: BoardEvent[]): Promise<void> {
    for (const event of events) {
      switch (event.type) {
        case "swap":
          await this.animateSwap(event.a, event.b);
          Sfx.play("swap");
          break;
        case "revert":
          await this.animateSwap(event.a, event.b);
          Sfx.play("invalid");
          break;
        case "cleared":
          await this.animateClear(event);
          break;
        case "falls":
          await this.animateFalls(event);
          break;
        case "shuffle":
          await this.animateShuffle(event);
          break;
        case "convert": {
          const view = this.tiles.get(this.keyOf(event.pos));
          if (view) {
            Sfx.play("special");
            await new Promise<void>((resolve) => {
              this.tweens.add({
                targets: view.container,
                scale: { from: 1, to: 1.25 },
                duration: 120,
                yoyo: true,
                onComplete: () => resolve(),
              });
            });
          }
          break;
        }
        default:
          break;
      }
    }
    this.rebuildTiles();
  }

  private animateSwap(a: Pos, b: Pos): Promise<void> {
    const ta = this.tiles.get(this.keyOf(a));
    const tb = this.tiles.get(this.keyOf(b));
    if (!ta || !tb) return Promise.resolve();
    this.tiles.set(this.keyOf(a), tb);
    this.tiles.set(this.keyOf(b), ta);
    const ca = this.cellCenter(a);
    const cb = this.cellCenter(b);
    return new Promise((resolve) => {
      this.tweens.add({ targets: ta.container, x: cb.x, y: cb.y, duration: 160, ease: "Sine.easeInOut" });
      this.tweens.add({
        targets: tb.container,
        x: ca.x,
        y: ca.y,
        duration: 160,
        ease: "Sine.easeInOut",
        onComplete: () => resolve(),
      });
    });
  }

  // ---------- 爆裂粒子（发射器池复用：常驻 8 个轮转，不再每次消除建/毁 emitter）----------
  private burstPool: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private burstCursor = 0;

  private initBurstPool(): void {
    this.burstPool = [];
    for (let i = 0; i < 8; i++) {
      this.burstPool.push(
        this.add.particles(0, 0, "softdot", {
          lifespan: 450,
          speed: { min: 60, max: 160 },
          scale: { start: 0.45, end: 0 },
          gravityY: 500,
          emitting: false,
        }).setDepth(50),
      );
    }
  }

  private burstAt(x: number, y: number, tint: number, big = false): void {
    if (this.burstPool.length === 0) return;
    const emitter = this.burstPool[this.burstCursor];
    this.burstCursor = (this.burstCursor + 1) % this.burstPool.length;
    emitter.setParticleTint(tint);
    emitter.setConfig({
      speed: big ? { min: 120, max: 280 } : { min: 60, max: 160 },
      scale: { start: big ? 0.7 : 0.45, end: 0 },
    });
    emitter.explode(big ? 26 : 10, x, y);
  }

  private animateClear(event: Extract<BoardEvent, { type: "cleared" }>): Promise<void> {
    const roundNo = event.round;
    Sfx.play(event.spawns.some((s) => !s.converted) ? "special" : "match", Math.min(roundNo - 1, 6));
    if (roundNo >= 2) this.spawnComboText(roundNo);

    const hasBig =
      event.cells.length >= 8 ||
      event.cells.some((c) => c.special === Special.BOMB || c.special === Special.RAINBOW) ||
      event.spawns.some((s) => s.special === Special.BOMB);
    if (hasBig) {
      this.cameras.main.shake(240, Math.min(0.004 + event.cells.length * 0.00035, 0.012));
      this.cameras.main.flash(180, 255, 255, 255, false); // 大消除：全屏短暂白闪
      Sfx.play("explosion");
    }

    const dying: Phaser.GameObjects.Container[] = [];
    const promises: Promise<void>[] = [];
    for (const info of event.cells) {
      const view = this.tiles.get(this.keyOf(info.pos));
      if (!view) continue;
      this.tiles.delete(this.keyOf(info.pos));
      dying.push(view.container);
      const center = this.cellCenter(info.pos);
      this.burstAt(center.x, center.y, PALETTE[info.color % PALETTE.length], hasBig);
      // 白色光环闪光（candy pop 即视感，0.18s 消散）
      this.spawnClearFlash(center.x, center.y, PALETTE[info.color % PALETTE.length]);
      promises.push(
        new Promise<void>((resolve) => {
          this.tweens.add({
            targets: view.container,
            scale: 0.05,
            alpha: 0,
            duration: 220,
            ease: "Back.easeIn",
            onComplete: () => resolve(),
          });
        }),
      );
    }
    return Promise.all(promises).then(() => {
      for (const c of dying) c.destroy();
      const popIns: Promise<void>[] = [];
      for (const spawn of event.spawns) {
        if (spawn.converted) continue;
        const view = this.makeTileView(spawn.pos, spawn.color, spawn.special, 12);
        view.container.setScale(0.05);
        popIns.push(
          new Promise<void>((resolve) => {
            this.tweens.add({
              targets: view.container,
              scale: 1,
              duration: 240,
              ease: "Back.easeOut",
              onComplete: () => resolve(),
            });
          }),
        );
        // 生成特殊棋子时：紫色光环脉冲
        if (spawn.special !== Special.NONE) {
          this.spawnSpecialRing(spawn.pos, spawn.color);
        }
      }
      return Promise.all(popIns).then(() => undefined);
    });
  }

  /** 消除时白色光环闪光 */
  private spawnClearFlash(x: number, y: number, tint: number): void {
    const ring = this.add.circle(x, y, RADIUS * 0.4, 0xffffff, 0.85).setDepth(45);
    this.tweens.add({
      targets: ring,
      radius: RADIUS * 1.4,
      alpha: 0,
      duration: 240,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    // 内圈糖果色填充闪（更"甜"的爆点感）
    const inner = this.add.circle(x, y, RADIUS * 0.3, tint, 0.55).setDepth(46);
    this.tweens.add({
      targets: inner,
      scale: 2.2,
      alpha: 0,
      duration: 280,
      ease: "Cubic.easeOut",
      onComplete: () => inner.destroy(),
    });
  }

  /** 特殊棋子出现光环脉冲 */
  private spawnSpecialRing(_pos: Pos, _color: number): void {
    const center = this.cellCenter(_pos);
    const ring = this.add.circle(center.x, center.y, RADIUS * 0.6, 0xb388ff, 0.7).setDepth(47);
    this.tweens.add({
      targets: ring,
      radius: RADIUS * 1.6,
      alpha: 0,
      duration: 380,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  private animateFalls(event: Extract<BoardEvent, { type: "falls" }>): Promise<void> {
    Sfx.play("swap");
    const promises: Promise<void>[] = [];
    for (const move of event.moves) {
      const view = this.tiles.get(this.keyOf(move.from));
      if (!view) continue;
      this.tiles.delete(this.keyOf(move.from));
      this.tiles.set(this.keyOf(move.to), view);
      const target = this.cellCenter(move.to);
      promises.push(
        new Promise<void>((resolve) => {
          this.tweens.add({
            targets: view.container,
            x: target.x,
            y: target.y,
            duration: 100 + Math.abs(move.to.y - move.from.y) * 50,
            ease: "Bounce.easeOut",
            onComplete: () => resolve(),
          });
        }),
      );
    }
    for (const refill of event.refills) {
      const view = this.makeTileView(refill.pos, refill.color, Special.NONE, 11);
      const target = this.cellCenter(refill.pos);
      view.container.y = target.y - CELL * 2.2;
      promises.push(
        new Promise<void>((resolve) => {
          this.tweens.add({
            targets: view.container,
            y: target.y,
            duration: 100 + CELL * 0.06 * 2.2,
            ease: "Bounce.easeOut",
            onComplete: () => resolve(),
          });
        }),
      );
    }
    return Promise.all(promises).then(() => undefined);
  }

  private animateShuffle(event: Extract<BoardEvent, { type: "shuffle" }>): Promise<void> {
    Sfx.play("shuffle");
    this.showFloatingHint("无可消除，重新洗牌！");
    const views = [...this.tiles.values()].map((v) => v.container);
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: views,
        scale: 0,
        duration: 180,
        ease: "Back.easeIn",
        onComplete: () => {
          this.rebuildTiles();
          const rebuilt = [...this.tiles.values()].map((v) => v.container);
          rebuilt.forEach((c) => c.setScale(0));
          this.tweens.add({
            targets: rebuilt,
            scale: 1,
            duration: 220,
            ease: "Back.easeOut",
            onComplete: () => resolve(),
          });
        },
      });
    });
  }

  private showFloatingHint(text: string): void {
    const label = UIKit.label(360, this.originY - 34, text, 28, "#ffffff").setOrigin(0.5).setDepth(80);
    this.tweens.add({
      targets: label,
      alpha: { from: 0, to: 1 },
      duration: 200,
      yoyo: true,
      hold: 900,
      onComplete: () => label.destroy(),
    });
  }

  private spawnComboText(round: number): void {
    const label = UIKit.label(360, this.originY + this.level.height * CELL * 0.25, comboWord(round), round >= 4 ? 56 : 46, round >= 5 ? "#ff5a8a" : "#ffd166")
      .setOrigin(0.5)
      .setDepth(80);
    label.setScale(0.3);
    this.tweens.add({
      targets: label,
      scale: 1,
      duration: 220,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          delay: 320,
          duration: 250,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  // ---------- 闲置提示 ----------

  private buildIdleTimer(): void {
    this.idleTimer = this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        if (this.busy || this.paused || this.session.finished) return;
        const hint = this.session.board.findHint();
        if (hint.length === 2) this.showHintPair(hint[0], hint[1]);
      },
    });
  }

  private showHintPair(a: Pos, b: Pos): void {
    this.clearHint();
    for (const pos of [a, b]) {
      const view = this.tiles.get(this.keyOf(pos));
      if (!view) continue;
      this.hintTargets.push(view.container);
      this.tweens.add({
        targets: view.container,
        scale: { from: 1, to: 1.14 },
        duration: 480,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private clearHint(): void {
    for (const target of this.hintTargets) {
      this.tweens.killTweensOf(target);
      target.setScale(1);
    }
    this.hintTargets = [];
  }

  private resetIdle(): void {
    this.clearHint();
    this.idleTimer.paused = this.busy || this.session.finished;
  }

  // ---------- 弹窗流 ----------

  private showBriefing(): void {
    const { panel, close } = UIKit.popup(560, 520);
    panel.add(UIKit.label(0, -170, `第 ${this.level.id} 关 · ${this.level.levelName}`, 34).setOrigin(0.5));
    panel.add(UIKit.label(0, -115, `可用步数：${this.level.moves}`, 25).setOrigin(0.5));

    let gy = -60;
    for (const goal of this.session.goalSnapshots()) {
      const icon = this.add.graphics();
      if (goal.type === "collect") {
        icon.fillStyle(PALETTE[goal.color], 1);
        icon.fillCircle(-140, gy + 12, 13);
        icon.fillStyle(0xffffff, 0.4);
        icon.fillEllipse(-144, gy + 7, 10, 6);
      } else if (goal.type === "frost") {
        icon.lineStyle(3.5, 0xcdeaff, 1);
        for (let i = 0; i < 3; i++) {
          const angle = (Math.PI * i) / 3;
          icon.beginPath();
          icon.moveTo(-140 - Math.cos(angle) * 12, gy + 12 - Math.sin(angle) * 12);
          icon.lineTo(-140 + Math.cos(angle) * 12, gy + 12 + Math.sin(angle) * 12);
          icon.strokePath();
        }
      } else {
        this.drawStar(icon, -140, gy + 12, 13, 0.3);
      }
      panel.add(icon);

      const text =
        goal.type === "score"
          ? `达到 ${goal.target} 分`
          : goal.type === "frost"
            ? `清除全部冰霜`
            : `收集${this.colorName(goal.color)}棋 ${goal.target} 个`;
      panel.add(UIKit.label(-118, gy, text, 24));
      gy += 44;
    }

    panel.add(UIKit.label(0, gy + 10, `★${this.level.stars[0]}  ★${this.level.stars[1]}  ★${this.level.stars[2]}`, 22, "#ffd166").setOrigin(0.5));

    const startBtn = UIKit.button(0,
      190,
      260,
      68,
      "开 始",
      () => {
        close();
        this.showPendingTutorials();
      },
      28,
    );
    panel.add(startBtn.container);
  }

  private showPendingTutorials(): void {
    const keys: string[] = [];
    if (this.level.id === 1 && !SaveManager.hasTutorial("basic")) keys.push("basic");
    if (this.level.features.includes("stripe") && !SaveManager.hasTutorial("stripe")) keys.push("stripe");
    if (
      (this.level.features.includes("bomb") || this.level.features.includes("rainbow")) &&
      !SaveManager.hasTutorial("bomb_rainbow")
    )
      keys.push("bomb_rainbow");
    if (this.level.obstacles.length > 0 && !SaveManager.hasTutorial("frost")) keys.push("frost");
    this.showTutorialChain(keys);
  }

  private showTutorialChain(keys: string[]): void {
    if (keys.length === 0) {
      this.beginPlay();
      return;
    }
    const key = keys.shift()!;
    const card = TUTORIAL_CARDS[key];
    const { panel, close } = UIKit.popup(600, 420);
    panel.add(UIKit.label(0, -120, card.title, 34, "#4cc9f0").setOrigin(0.5));

    const body = UIKit.label(0, -30, card.body, 23).setOrigin(0.5);
    body.setWordWrapWidth(500);
    panel.add(body);

    const okBtn = UIKit.button(0, 105, 210, 58, "知道了", () => {
      SaveManager.markTutorial(key);
      close();
      this.showTutorialChain(keys);
    }, 24);
    panel.add(okBtn.container);
  }

  private beginPlay(): void {
    this.busy = false;
    this.resetIdle();
  }

  private showResult(): void {
    this.resultOpen = true;
    this.clearHint();
    let rewardText = "";
    if (this.session.won) {
      const previousStars = SaveManager.getStars(this.level.id);
      SaveManager.recordWin(this.level.id, this.session.starsEarned());
      if (this.session.starsEarned() === 3 && previousStars < 3) {
        const kind = SaveManager.randomBoosterKind();
        SaveManager.addBooster(kind);
        rewardText = `首次三星奖励：${BOOSTER_NAMES[kind]} x1`;
      }
    }

    const { panel } = UIKit.popup(500, 560);
    panel.add(UIKit.label(0, -190, this.session.won ? "甜蜜通关！" : "步数用完了", 44).setOrigin(0.5));

    const starIcons: Phaser.GameObjects.Graphics[] = [];
    if (this.session.won) {
      for (let i = 0; i < 3; i++) {
        const icon = this.add.graphics();
        icon.setPosition(-90 + i * 90, -95);
        this.drawStar(icon, 0, 0, 30, 0);
        icon.setAlpha(0.18);
        panel.add(icon);
        starIcons.push(icon);
      }
    }

    panel.add(UIKit.label(0, 0, `最终得分 ${this.session.score}`, 27).setOrigin(0.5));
    if (rewardText !== "") {
      panel.add(UIKit.label(0, 48, rewardText, 24, "#7ae582").setOrigin(0.5));
    }

    const earned = this.session.starsEarned();
    for (let i = 0; i < earned; i++) {
      const icon = starIcons[i];
      this.tweens.add({
        targets: icon,
        alpha: 1,
        scale: { from: 0.4, to: 1 },
        delay: 350 * (i + 1),
        duration: 260,
        ease: "Back.easeOut",
        onStart: () => Sfx.play("sparkle", i),
      });
    }

    const mkBtn = (text: string, x: number, cb: () => void) => {
      const b = UIKit.button(x, 130, 140, 58, text, cb, 24);
      panel.add(b.container);
    };
    mkBtn("重玩", -150, () => this.scene.start("Game", { level: this.level, daily: this.isDaily }));
    if (this.session.won && this.hasNext()) {
      const next = this.nextLevel()!;
      mkBtn("下一关", 0, () => this.scene.start("Game", { level: next }));
    }
    mkBtn("选关", 150, () => this.scene.start("LevelMap"));

    // 成绩卡导出（通关时）：下载 PNG
    if (this.session.won) {
      // 记录每日挑战成绩（仅 daily 模式）
      if (this.isDaily) {
        const rec = recordDailyRun(this.level.levelName.replace(/^每日挑战 · /, ""), this.session.score, this.session.movesLeft);
        if (rec) panel.add(UIKit.label(0, 200, "已记录今日成绩", 20, "#7ae582").setOrigin(0.5));
      }
      const exportBtn = UIKit.button(0, 215, 240, 50, "📤 导出成绩卡", () => {
        downloadScoreCard({
          title: this.level.levelName,
          score: this.session.score,
          movesLeft: this.session.movesLeft,
          movesTotal: this.level.moves,
          stars: this.session.starsEarned(),
          isDaily: this.isDaily,
        });
      }, 22);
      panel.add(exportBtn.container);
    }

    if (this.session.won) this.confettiBurst();
  }

  private hasNext(): boolean {
    return this.nextLevel() !== null;
  }

  private nextLevel(): LevelData | null {
    // 关卡列表由 LevelMap 缓存；这里通过 registry 共享
    const levels = (this.registry.get("levels") as LevelData[] | undefined) ?? [];
    const next = levels.find((l) => l.id === this.level.id + 1);
    return next ?? null;
  }

  private confettiBurst(): void {
    const emitter = this.add.particles(360, -20, "softdot", {
      x: { min: 60, max: 660 },
      lifespan: 1800,
      speedY: { min: 60, max: 160 },
      speedX: { min: -40, max: 40 },
      gravityY: 420,
      scale: { min: 0.3, max: 0.65 },
      quantity: 4,
      frequency: 40,
      tint: [0xff5a5f, 0xffc043, 0x7ae582, 0x4cc9f0],
    }).setDepth(102);
    this.time.delayedCall(2200, () => emitter.destroy());
  }
}
