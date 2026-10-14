import Phaser from "phaser";
import {
  CARD_W,
  CELL_H,
  CELL_W,
  COLS,
  COMBAT,
  FLOWERS,
  H,
  HOME_Y,
  LAWN_H,
  LAWN_W,
  LAWN_X,
  LAWN_Y,
  ROWS,
  TRAY_Y,
  W,
  cellCenter,
  flowerDef,
  waveScale,
  type Difficulty,
  type FlowerKind,
  type PetKind,
  type AttackKind,
} from "../config";
import { C, bodyStyle, drawPanel, drawSceneBackdrop, hudStyle, makeButton, titleStyle } from "../ui/theme";
import { BattleHud } from "../ui/BattleHud";
import { WaveRunner } from "../systems/WaveRunner";
import { GridModel } from "../systems/Grid";
import { Fx } from "../systems/Fx";
import { Sfx } from "../systems/Sfx";
import { Flower, type FlowerCtx } from "../entities/Flower";
import { Pet, type PetCtx } from "../entities/Pet";
import { Bullet, type BulletCtx } from "../entities/Bullet";
import { getProgress, isSoundMuted, isTutorialDone, markTutorialDone, recordRun } from "../systems/Progress";

type Ctx = FlowerCtx & PetCtx & BulletCtx;

/**
 * 主战斗：网格种花塔防
 * 经济：种子（种植）+ 花粉（进化），全部自动入账。
 */
export class GameScene extends Phaser.Scene implements Ctx {
  private difficulty: Difficulty = "standard";
  private grid = new GridModel();
  private flowers = new Map<number, Flower>();
  private pets: Pet[] = [];
  private petsByCol: Pet[][] = [];
  private bullets: Bullet[] = [];
  private seeds = 0;
  private pollen = 0;
  private lives = COMBAT.LIVES;
  private killed = 0;
  private combo = 0;
  private bestCombo = 0;
  private lastKillAt = 0;
  private selectedKind: FlowerKind | null = null;
  private selectedFlowerId: number | null = null;
  private ended = false;
  private paused = false;
  private nextGardenSeedAt = 0;
  private waveKilled = 0;

  readonly sfx = new Sfx();
  private fx!: Fx;
  private hud!: BattleHud;
  private waves!: WaveRunner;
  private ambientTimer: Phaser.Time.TimerEvent | null = null;

  // UI（托盘/浮层）
  private cardGfx: Array<{ bg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Image; cost: Phaser.GameObjects.Text; kind: FlowerKind; highlight: Phaser.GameObjects.Rectangle }> = [];
  private bannerText: Phaser.GameObjects.Text | null = null;
  private upgradeBar: Phaser.GameObjects.Container | null = null;
  private shovelOn = false;
  private shovelBtn: Phaser.GameObjects.Container | null = null;
  private lawnGraphics!: Phaser.GameObjects.Graphics;
  private highlight!: Phaser.GameObjects.Rectangle;
  private overlay: Phaser.GameObjects.Container | null = null;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private ghost: Phaser.GameObjects.Image | null = null;
  /** 首局引导：0 种植 / 1 击杀掉落 / 2 进化 / 3 完成 */
  private tutorialStep = -1;
  private tutorialPlanted = false;
  private tutorialKilled = false;
  private tutorialEvolved = false;

  constructor() {
    super("game");
  }

  private get wave(): number {
    return this.waves?.currentWave ?? 0;
  }

  init(data: { difficulty?: Difficulty }): void {
    this.difficulty = data.difficulty ?? "standard";
    this.grid.reset();
    this.flowers.clear();
    this.pets = [];
    this.petsByCol = Array.from({ length: COLS }, () => []);
    this.bullets = [];
    this.seeds = COMBAT.START_SEEDS;
    this.pollen = COMBAT.START_POLLEN;
    this.lives = COMBAT.LIVES;
    this.killed = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.selectedKind = "rose";
    this.selectedFlowerId = null;
    this.ended = false;
    this.paused = false;
    this.shovelOn = false;
    this.nextGardenSeedAt = 0;
    this.waveKilled = 0;
    this.overlay = null;
    this.upgradeBar = null;
    this.pauseOverlay = null;
    this.bannerText = null;
    this.ghost = null;
    this.cardGfx = [];
    this.tutorialStep = -1;
    this.tutorialPlanted = false;
    this.tutorialKilled = false;
    this.tutorialEvolved = false;
  }

  create(): void {
    drawSceneBackdrop(this);
    this.sfx.setMuted(isSoundMuted());
    this.fx = new Fx(this);
    this.petsByCol = Array.from({ length: COLS }, () => []);

    this.waves = new WaveRunner(this, {
      onWaveStart: (wave, huge, total) => this.handleWaveStart(wave, huge, total),
      onSpawnOne: () => this.spawnOne(),
      onWaveCleared: () => {
        this.showBanner("波次肃清 · 整理花圃", 1000);
        this.refreshWaveHud();
      },
    });
    this.hud = new BattleHud(this, () => this.togglePause());

    this.drawLawn();
    this.drawTray();
    this.ambientTimer = this.fx.ambientPetals();
    this.input.keyboard?.on("keydown-P", () => this.togglePause());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());

    this.waves.reset(this.difficulty, this.time.now);
    this.nextGardenSeedAt = this.time.now + COMBAT.GARDEN_SEED_MS;
    this.refreshEconomyHud();
    this.refreshHeartsHud();
    this.refreshWaveHud();

    if (!isTutorialDone()) {
      this.tutorialStep = 0;
      this.showBanner("① 选底栏月季，点上方格子种植", 2600);
    } else {
      this.showBanner("上方种月季，守住花房！", 1800);
    }
  }

  private handleWaveStart(wave: number, huge: boolean, total: number): void {
    this.waveKilled = 0;
    this.hud.setWaveProgress(0, total);
    this.hud.setWaveLabel(`第 ${wave} 波`);
    this.sfx.wave();
    this.showBanner(huge ? `第 ${wave} 波 · 大型波！` : `第 ${wave} 波来了`, huge ? 1600 : 1100);
    if (huge) {
      this.cameras.main.shake(200, 0.006);
      this.fx.confetti(W / 2, LAWN_Y + 40);
    }
  }

  private refreshWaveHud(): void {
    const w = this.waves;
    if (!w || !this.hud) return;
    if (w.isBetween) {
      const remain = w.countdownSec(this.time.now);
      this.hud.setWaveLabel(w.currentWave > 0 ? `第 ${w.currentWave} 波 · 下一波 ${remain}s` : `准备中 · ${remain}s`);
    } else {
      this.hud.setWaveLabel(`第 ${w.currentWave} 波`);
    }
    this.hud.setWaveProgress(this.waveKilled, w.total);
  }

  private refreshEconomyHud(): void {
    this.hud?.setEconomy(this.seeds, this.pollen);
  }

  private refreshHeartsHud(): void {
    this.hud?.setHearts(this.lives);
  }

  private refreshComboHud(): void {
    this.hud?.setCombo(this.combo);
  }

  // ---------- 绘制 ----------

  private drawLawn(): void {
    this.lawnGraphics = this.add.graphics().setDepth(1);
    const g = this.lawnGraphics;
    g.fillStyle(C.lawn, 1);
    g.fillRoundedRect(LAWN_X - 8, LAWN_Y - 8, LAWN_W + 16, LAWN_H + 16, 18);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const even = (r + c) % 2 === 0;
        g.fillStyle(even ? C.lawn : C.lawnAlt, 0.9);
        g.fillRect(LAWN_X + c * CELL_W + 2, LAWN_Y + r * CELL_H + 2, CELL_W - 4, CELL_H - 4);
      }
    }
    // 栅栏/家
    g.fillStyle(C.fence, 1);
    g.fillRoundedRect(LAWN_X - 8, HOME_Y - 6, LAWN_W + 16, 36, 10);
    g.lineStyle(2, C.fenceShade, 1);
    for (let i = 0; i <= COLS; i++) {
      const x = LAWN_X + i * CELL_W;
      g.lineBetween(x, HOME_Y - 6, x, HOME_Y + 30);
    }
    g.fillStyle(0x2f4a3e, 0.08);
    g.fillRoundedRect(LAWN_X - 8, HOME_Y + 26, LAWN_W + 16, 8, 4);

    this.highlight = this.add
      .rectangle(0, 0, CELL_W - 6, CELL_H - 6, 0xffe08a, 0.35)
      .setStrokeStyle(2, 0xf5c84c, 0.9)
      .setDepth(6)
      .setVisible(false);

    // 网格点击
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const { x, y } = cellCenter(c, r);
        const zone = this.add
          .zone(x, y, CELL_W, CELL_H)
          .setInteractive({ useHandCursor: true })
          .setDepth(4);
        zone.on("pointerover", () => {
          this.highlight.setPosition(x, y).setVisible(true);
          this.updateGhost(x, y, c, r);
        });
        zone.on("pointerout", () => {
          this.highlight.setVisible(false);
          this.hideGhost();
        });
        zone.on("pointerdown", () => this.onCellTap(c, r));
      }
    }
  }

  private updateGhost(x: number, y: number, col: number, row: number): void {
    if (this.ended || this.paused || this.shovelOn || !this.selectedKind) {
      this.hideGhost();
      return;
    }
    if (!this.grid.isEmpty(col, row)) {
      this.hideGhost();
      return;
    }
    const def = flowerDef(this.selectedKind);
    const ok = this.seeds >= def.seedCost;
    const tex = def.looks[0]!.texture;
    if (!this.ghost) {
      this.ghost = this.add.image(x, y + 6, tex).setOrigin(0.5, 0.5).setDepth(11).setAlpha(0.55);
    } else {
      this.ghost.setTexture(tex).setPosition(x, y + 6).setVisible(true);
    }
    const tw = Math.max(1, this.ghost.width);
    const th = Math.max(1, this.ghost.height);
    const s = COMBAT.FLOWER_DISPLAY / tw;
    this.ghost.setScale(s, (COMBAT.FLOWER_DISPLAY / th));
    this.ghost.setTint(ok ? 0xffffff : 0xe86b5c);
    this.highlight.setStrokeStyle(2, ok ? 0xf5c84c : 0xe86b5c, 0.95);
  }

  private hideGhost(): void {
    this.ghost?.setVisible(false);
  }

  private drawTray(): void {
    const y = TRAY_Y;
    drawPanel(this, 8, y - 12, W - 16, 220, { radius: 18 }).setDepth(15);
    FLOWERS.forEach((def, i) => {
      const x = 48 + i * 132;
      const bg = this.add.graphics().setDepth(16);
      const icon = this.add
        .image(x, y + 46, def.looks[0]!.texture)
        .setDisplaySize(68, 68)
        .setDepth(17);
      const cost = this.add
        .text(x, y + 110, `种${def.seedCost}`, hudStyle(15, C.ink))
        .setOrigin(0.5)
        .setDepth(17);
      this.add.text(x, y + 134, def.name, bodyStyle(13, C.ink2)).setOrigin(0.5).setDepth(17);
      this.add.text(x, y + 154, def.role, bodyStyle(11, C.ink3)).setOrigin(0.5).setDepth(17);
      const highlight = this.add
        .rectangle(x, y + 50, CARD_W - 10, 96, 0xffe08a, 0.28)
        .setStrokeStyle(2, 0xf5c84c, 0.95)
        .setDepth(16)
        .setVisible(false);

      bg.fillStyle(0xfffcf7, 0.95);
      bg.fillRoundedRect(x - CARD_W / 2 + 4, y + 2, CARD_W - 8, 178, 14);
      bg.lineStyle(2, 0xe0d4c4, 0.9);
      bg.strokeRoundedRect(x - CARD_W / 2 + 4, y + 2, CARD_W - 8, 178, 14);

      const zone = this.add
        .zone(x, y + 80, CARD_W, 180)
        .setInteractive({ useHandCursor: true })
        .setDepth(18);
      zone.on("pointerdown", () => {
        this.shovelOn = false;
        this.selectedKind = def.kind;
        this.selectedFlowerId = null;
        this.refreshCards();
        this.closeUpgradeBar();
      });

      this.cardGfx.push({ bg, icon, cost, kind: def.kind, highlight });
    });

    // 铲子：放在托盘右上，避开兰花卡
    this.shovelBtn = makeButton(this, W - 64, y + 200, "铲", () => {
      this.shovelOn = !this.shovelOn;
      this.selectedKind = null;
      this.selectedFlowerId = null;
      this.closeUpgradeBar();
      this.refreshCards();
    }, { w: 72, h: 40, variant: "soft", fontSize: 16 });
    this.shovelBtn.setDepth(19);

    this.add
      .text(24, y + 200, "悬停预览 · 点格种植 · 点花进化到 Lv5 名品", bodyStyle(12, C.ink3))
      .setOrigin(0, 0.5)
      .setDepth(16);

    this.refreshCards();
  }

  private refreshCards(): void {
    for (const card of this.cardGfx) {
      const selected = this.selectedKind === card.kind && !this.shovelOn;
      card.highlight.setVisible(selected);
      const affordable = this.seeds >= flowerDef(card.kind).seedCost;
      card.icon.setAlpha(affordable || selected ? 1 : 0.45);
      card.cost.setColor(affordable ? C.ink : C.ink3);
    }
  }

  // ---------- 交互 ----------

  private onCellTap(col: number, row: number): void {
    if (this.ended || this.paused) return;
    const id = this.grid.flowerIdAt(col, row);

    if (this.shovelOn) {
      if (id != null) {
        const f = this.flowers.get(id);
        if (f) {
          const refund = Math.round(flowerDef(f.kind).seedCost * 0.4);
          this.addSeeds(refund, f.x, f.y);
          f.destroy();
        }
        this.flowers.delete(id);
        this.grid.clear(col, row);
        this.fx.burst(cellCenter(col, row).x, cellCenter(col, row).y, 0xc4a8e8, 8, 0.8);
      }
      this.refreshCards();
      return;
    }

    if (id != null) {
      this.openUpgradeBar(id);
      return;
    }

    if (!this.selectedKind) {
      this.showBanner("先选一张花卡", 900);
      return;
    }
    const def = flowerDef(this.selectedKind);
    if (this.seeds < def.seedCost) {
      this.showBanner("种子不够", 800);
      return;
    }
    this.seeds -= def.seedCost;
    this.refreshEconomyHud();
    this.hideGhost();
    const flower = new Flower(this, this.selectedKind, col, row, this);
    this.flowers.set(flower.id, flower);
    this.grid.place(col, row, flower.id);
    const { x, y } = cellCenter(col, row);
    this.fx.burst(x, y, 0x8fbf8a, 12, 1.1);
    this.fx.ring(x, y, 0x8fbf8a, 0.9);
    this.sfx.place();
    this.cameras.main.shake(60, 0.003);
    this.refreshCards();
    this.tutorialPlanted = true;
    this.advanceTutorial();
  }

  private openUpgradeBar(flowerId: number): void {
    this.closeUpgradeBar();
    const f = this.flowers.get(flowerId);
    if (!f || !f.alive) return;
    this.selectedFlowerId = flowerId;
    f.setSelected(true);

    const cost = f.upgradeCostToNext();
    const barY = TRAY_Y - 88;
    const c = this.add.container(W / 2, barY).setDepth(25);
    const g = this.add.graphics();
    g.fillStyle(0xfffcf7, 0.97);
    g.fillRoundedRect(-W / 2 + 16, -62, W - 32, 124, 16);
    g.lineStyle(2, 0xe0d4c4, 1);
    g.strokeRoundedRect(-W / 2 + 16, -62, W - 32, 124, 16);
    c.add(g);

    const label =
      cost == null
        ? `${f.describe()} · 已满级`
        : `${f.describe()} → Lv${f.level + 1} · 花粉 ${cost}`;
    c.add(this.add.text(0, -42, label, hudStyle(16, C.ink)).setOrigin(0.5));

    const next = f.nextLevelStats();
    const nowSummary = f.statSummary();
    const nextSummary = next
      ? next.atk == null || next.atk === 0
        ? `产出 种${next.produceSeeds ?? 0}+粉${next.producePollen ?? 0} / ${((next.produceMs ?? 5000) / 1000).toFixed(1)}s`
        : `攻 ${next.atk} · 射速 ${(next.rateMs / 1000).toFixed(2)}s · DPS ${(next.atk / (next.rateMs / 1000)).toFixed(1)}${next.double ? " 双发" : next.slowMul ? " 减速" : ""}`
      : "";
    if (next) {
      c.add(this.add.text(0, -22, nowSummary, bodyStyle(12, C.ink2)).setOrigin(0.5));
      c.add(this.add.text(0, -4, `→ ${nextSummary}`, bodyStyle(12, "#D4A83A")).setOrigin(0.5));
    }

    if (cost != null) {
      const ok = this.pollen >= cost;
      c.add(
        makeButton(
          this,
          -80,
          36,
          "进化",
          () => {
            if (this.pollen < cost) {
              this.showBanner("花粉不够", 800);
              return;
            }
            this.pollen -= cost;
            this.refreshEconomyHud();
            f.tryUpgrade();
            this.openUpgradeBar(flowerId);
            this.refreshCards();
          },
          { w: 140, h: 44, variant: ok ? "honey" : "soft", fontSize: 16 }
        )
      );
    }

    c.add(
      makeButton(
        this,
        100,
        36,
        "关闭",
        () => this.closeUpgradeBar(),
        { w: 120, h: 44, variant: "soft", fontSize: 15 }
      )
    );

    this.upgradeBar = c;
  }

  private closeUpgradeBar(): void {
    if (this.selectedFlowerId != null) {
      this.flowers.get(this.selectedFlowerId)?.setSelected(false);
    }
    this.selectedFlowerId = null;
    this.upgradeBar?.destroy();
    this.upgradeBar = null;
  }

  private togglePause(): void {
    if (this.ended) return;
    this.paused = !this.paused;
    if (this.paused) this.openPause();
    else this.closePause();
  }

  private openPause(): void {
    this.closePause();
    const c = this.add.container(W / 2, H / 2).setDepth(70);
    const dim = this.add
      .rectangle(0, 0, W, H, 0x2f4a3e, 0.5)
      .setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0xfffcf7, 0.98);
    g.fillRoundedRect(-200, -140, 400, 280, 20);
    g.lineStyle(2, 0xe0d4c4, 1);
    g.strokeRoundedRect(-200, -140, 400, 280, 20);
    c.add([dim, g]);
    c.add(this.add.text(0, -70, "已暂停", titleStyle(28)).setOrigin(0.5));
    c.add(
      makeButton(
        this,
        0,
        10,
        "继续",
        () => {
          this.paused = false;
          this.closePause();
        },
        { w: 200, h: 52, variant: "honey", fontSize: 20 }
      )
    );
    c.add(
      makeButton(
        this,
        0,
        80,
        "回菜单",
        () => this.scene.start("menu"),
        { w: 180, h: 44, variant: "soft", fontSize: 16 }
      )
    );
    this.pauseOverlay = c;
  }

  private closePause(): void {
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
  }

  // ---------- 经济：种子（种植）/ 花粉（进化），自动入账 ----------

  addSeeds(n: number, x?: number, y?: number): void {
    if (n <= 0) return;
    this.seeds += n;
    this.refreshEconomyHud();
    this.refreshCards();
    if (x != null && y != null) this.fx.damageText(x, y, `种+${n}`, "#5A7268");
  }

  addPollen(n: number, x?: number, y?: number): void {
    if (n <= 0) return;
    this.pollen += n;
    this.refreshEconomyHud();
    if (x != null && y != null) this.fx.damageText(x, y, `粉+${n}`, "#D4A83A");
  }

  private spawnOne(opts: { hpOverride?: number; armorOverride?: number; speedOverride?: number; isSplit?: boolean; col?: number; y?: number; kind?: PetKind } = {}): void {
    if (this.ended) return;
    if (!this.waves.consumeSpawnQuota(!!opts.isSplit)) return;
    const kind = opts.kind ?? Phaser.Utils.Array.GetRandom(this.waves.pool);
    const col = opts.col ?? Phaser.Math.Between(0, COLS - 1);
    const scale = waveScale(Math.max(1, this.wave), this.difficulty);
    const pet = new Pet(this, kind, col, opts.y ?? LAWN_Y - 40, this, scale, opts);
    this.pets.push(pet);
    this.petsByCol[col]!.push(pet);
  }

  // ---------- Ctx 实现 ----------

  hasEnemyInCol(col: number, fromY: number): boolean {
    const list = this.petsByCol[col];
    if (!list) return false;
    return list.some((p) => p.alive && p.y < fromY + 20 && p.y > LAWN_Y - 80);
  }

  flowersInCol(col: number): Array<{ y: number; takeDamage(d: number): void; alive: boolean }> {
    const out: Array<{ y: number; takeDamage(d: number): void; alive: boolean }> = [];
    for (const f of this.flowers.values()) {
      if (f.col === col && f.alive) out.push(f);
    }
    return out;
  }

  spawnBullet(
    col: number,
    x: number,
    y: number,
    petal: string,
    dmg: number,
    opts?: {
      attack?: AttackKind;
      slowMul?: number;
      slowMs?: number;
      splashCells?: number;
      sizePx?: number;
      trail?: boolean;
      vx?: number;
    }
  ): void {
    void col;
    const b = new Bullet(this, x, y, petal, dmg, this, opts);
    this.bullets.push(b);
  }

  findTarget(x: number, y: number): Pet | null {
    let best: Pet | null = null;
    let bestScore = Infinity;
    for (const p of this.pets) {
      if (!p.alive) continue;
      if (Math.abs(p.x - x) > 44) continue;
      const dy = y - p.y;
      if (dy < -60 || dy > 70) continue;
      const score = Math.abs(dy);
      if (score < bestScore) {
        best = p;
        bestScore = score;
      }
    }
    return best;
  }

  findHomingTarget(x: number, y: number): Pet | null {
    let best: Pet | null = null;
    let bestDist = Infinity;
    for (const p of this.pets) {
      if (!p.alive) continue;
      if (Math.abs(p.x - x) > 160) continue;
      if (p.y > y + 40) continue;
      const d = Phaser.Math.Distance.Between(x, y, p.x, p.y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  }

  splashAt(x: number, y: number, dmg: number, radiusPx: number): void {
    this.fx.ring(x, y, 0xc4a8e8, radiusPx / 40);
    for (const p of this.pets) {
      if (!p.alive) continue;
      const d = Phaser.Math.Distance.Between(x, y, p.x, p.y);
      if (d <= radiusPx) p.takeDamage(dmg);
    }
  }

  onBulletHit(x: number, y: number, dmg: number): void {
    this.fx.burst(x, y, 0xf5a0b8, 8, 0.9);
    this.fx.damageText(x, y - 10, String(dmg));
  }

  onFlowerDestroyed(id: number, col: number, row: number): void {
    this.flowers.delete(id);
    this.grid.clear(col, row);
    const { x, y } = cellCenter(col, row);
    this.fx.burst(x, y, 0xe86b5c, 14, 1.1);
    this.sfx.hurt();
    if (this.selectedFlowerId === id) this.closeUpgradeBar();
  }

  onFlowerShoot(_kind: FlowerKind, x: number, y: number): void {
    this.fx.burst(x, y, 0xfff6ee, 3, 0.5);
  }

  onFlowerProduce(x: number, y: number, seeds: number, pollen: number): void {
    if (seeds) this.fx.damageText(x, y, `种+${seeds}`, "#5A7268");
    if (pollen) this.fx.damageText(x, y - 18, `粉+${pollen}`, "#D4A83A");
    this.fx.burst(x, y, 0x8fbf8a, 6, 0.7);
    this.sfx.sun();
  }

  onFlowerEvolved(level: number, label: string): void {
    this.sfx.upgrade();
    this.cameras.main.shake(level >= 3 ? 120 : 80, level >= 3 ? 0.006 : 0.003);
    if (level >= 3) this.fx.confetti(W / 2, LAWN_Y + 80);
    this.showBanner(`${label} 进化！`, 1100);
    this.tutorialEvolved = true;
    this.advanceTutorial();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(level >= 3 ? [18, 40, 25] : [12, 30, 18]);
      } catch {
        // ignore
      }
    }
  }

  private advanceTutorial(): void {
    if (this.tutorialStep < 0) return;
    if (this.tutorialStep === 0 && this.tutorialPlanted) {
      this.tutorialStep = 1;
      this.showBanner("② 击杀会自动掉种子和花粉", 2200);
      return;
    }
    if (this.tutorialStep === 1 && this.tutorialKilled) {
      this.tutorialStep = 2;
      this.showBanner("③ 点已种的花，消耗花粉进化", 2400);
      return;
    }
    if (this.tutorialStep === 2 && this.tutorialEvolved) {
      this.tutorialStep = 3;
      markTutorialDone();
      this.showBanner("守住花房，开始无尽防守！", 1800);
    }
  }

  onPetKilled(_kind: PetKind, x: number, y: number, dropSeeds: number, dropPollen: number): void {
    this.killed += 1;
    this.waveKilled += 1;
    this.hud.setWaveProgress(this.waveKilled, this.waves.total);
    const now = this.time.now;
    if (now - this.lastKillAt < COMBAT.KILL_COMBO_WINDOW_MS) this.combo += 1;
    else this.combo = 1;
    this.lastKillAt = now;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.addSeeds(dropSeeds, x, y);
    this.addPollen(dropPollen, x, y - 16);
    this.fx.burst(x, y, 0xc4a8e8, 12, 1.2);
    this.cameras.main.shake(40, 0.002);
    this.refreshComboHud();
    this.tutorialKilled = true;
    this.advanceTutorial();
    if (this.combo >= COMBAT.COMBO_CASH_AT) {
      this.addSeeds(COMBAT.COMBO_SEEDS, x, y - 28);
      this.addPollen(COMBAT.COMBO_POLLEN, x, y - 44);
      this.fx.confetti(x, y);
      this.fx.damageText(x, y - 56, `连击 x${this.combo}!`, "#C4A8E8");
    }
  }

  onPetReachHome(_col: number): void {
    this.lives -= 1;
    this.refreshHeartsHud();
    this.sfx.hurt();
    this.cameras.main.shake(180, 0.01);
    this.fx.ring(W / 2, HOME_Y, 0xe86b5c, 2);
    this.showBanner(this.lives > 0 ? `宠物闯入！还剩 ${this.lives} 颗心` : "花房失守…", 1200);
    if (this.lives <= 0) this.gameOver();
  }

  spawnSplit(x: number, y: number, kind: PetKind, hp: number, armor: number, speed: number): void {
    const col = Phaser.Math.Clamp(Math.floor((x - LAWN_X) / CELL_W), 0, COLS - 1);
    this.spawnOne({ kind, col, y, hpOverride: hp, armorOverride: armor, speedOverride: speed, isSplit: true });
  }

  buffAt(col: number, row: number): number {
    let buff = 0;
    for (const f of this.flowers.values()) {
      if (!f.alive || f.kind !== "orchid") continue;
      const s = f.stats;
      if (!s.buffAtk) continue;
      const dist = Math.hypot(f.col - col, (f.row - row) * (CELL_H / CELL_W));
      if (dist <= (s.buffRadiusCells ?? 1.5)) buff += s.buffAtk;
    }
    return Math.min(buff, 0.6);
  }

  // ---------- 主循环 ----------

  update(time: number, delta: number): void {
    if (this.ended || this.paused) return;
    const dt = Math.min(delta, 40);

    const alive = this.pets.reduce((n, p) => n + (p.alive ? 1 : 0), 0);
    this.waves.update(time, alive);
    this.refreshWaveHud();

    // 花园基础产种：无荷花也持续回血经济
    if (time >= this.nextGardenSeedAt) {
      this.nextGardenSeedAt = time + COMBAT.GARDEN_SEED_MS;
      this.addSeeds(COMBAT.GARDEN_SEED_VALUE, W / 2, LAWN_Y + 24);
    }

    // 实体
    for (const f of this.flowers.values()) f.updateGame(time);

    for (const p of this.pets) p.updateGame(time, dt);

    this.bullets = this.bullets.filter((b) => b.updateGame(dt));

    // 清理死宠物索引
    this.pets = this.pets.filter((p) => p.alive);
    for (let c = 0; c < COLS; c++) {
      this.petsByCol[c] = this.petsByCol[c]!.filter((p) => p.alive);
    }

    // 连击衰减
    if (this.combo > 0 && time - this.lastKillAt > COMBAT.KILL_COMBO_WINDOW_MS) {
      this.combo = 0;
      this.refreshComboHud();
    }
  }

  private showBanner(text: string, ms = 1200): void {
    this.bannerText?.destroy();
    const t = this.add
      .text(W / 2, LAWN_Y + LAWN_H / 2, text, {
        fontFamily: "'PingFang SC', sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#FFFCF7",
        stroke: "#2F4A3E",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);
    this.bannerText = t;
    this.tweens.add({
      targets: t,
      alpha: 1,
      y: LAWN_Y + LAWN_H / 2 - 20,
      duration: 180,
      yoyo: true,
      hold: ms,
      onComplete: () => {
        if (this.bannerText === t) this.bannerText = null;
        t.destroy();
      },
    });
  }

  private gameOver(): void {
    if (this.ended) return;
    this.ended = true;
    this.hideGhost();
    this.closePause();
    if (this.tutorialStep >= 0) {
      markTutorialDone();
      this.tutorialStep = -1;
    }
    this.sfx.gameOver();
    const prevBest = getProgress().bestWave[this.difficulty] ?? 0;
    recordRun({
      wave: this.wave,
      kills: this.killed,
      combo: this.bestCombo,
      difficulty: this.difficulty,
    });

    this.overlay?.destroy();
    const c = this.add.container(W / 2, H / 2).setDepth(80);
    const dim = this.add
      .rectangle(0, 0, W, H, 0x2f4a3e, 0.5)
      .setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0xfffcf7, 0.98);
    g.fillRoundedRect(-270, -260, 540, 520, 24);
    g.lineStyle(3, 0xe0d4c4, 1);
    g.strokeRoundedRect(-270, -260, 540, 520, 24);
    // 顶部色带
    g.fillStyle(0xf5c84c, 0.22);
    g.fillRoundedRect(-270, -260, 540, 78, { tl: 24, tr: 24, bl: 0, br: 0 });
    c.add([dim, g]);

    c.add(this.add.text(0, -210, "花房失守", titleStyle(32)).setOrigin(0.5));
    // 波次徽章
    const badge = this.add.graphics();
    badge.fillStyle(0x8fbf8a, 1);
    badge.fillCircle(0, -120, 52);
    badge.lineStyle(3, 0xffe08a, 0.9);
    badge.strokeCircle(0, -120, 52);
    c.add(badge);
    c.add(this.add.text(0, -132, String(this.wave), titleStyle(36)).setOrigin(0.5));
    c.add(this.add.text(0, -96, "波", hudStyle(14, "#FFFCF7")).setOrigin(0.5));

    const best = getProgress().bestWave[this.difficulty] ?? 0;
    const isRecord = this.wave > prevBest;
    const lines = [
      `击杀 ${this.killed} 只 · 最高连击 x${this.bestCombo}`,
      best > 0 ? `本难度最佳：第 ${best} 波` : "本难度首次出战",
    ];
    if (isRecord) lines.push("刷新纪录！");
    c.add(
      this.add
        .text(0, -20, lines.join("\n"), bodyStyle(16, C.ink2))
        .setOrigin(0.5)
        .setAlign("center")
        .setLineSpacing(8)
    );

    c.add(
      makeButton(
        this,
        0,
        100,
        "再来一局",
        () => {
          this.scene.restart({ difficulty: this.difficulty });
        },
        { w: 240, h: 56, variant: "honey", fontSize: 20 }
      )
    );
    c.add(
      makeButton(
        this,
        0,
        170,
        "回菜单",
        () => this.scene.start("menu"),
        { w: 200, h: 48, variant: "soft", fontSize: 16 }
      )
    );
    this.overlay = c;
  }

  shutdown(): void {
    this.waves?.destroy();
    this.ambientTimer?.remove();
    this.ambientTimer = null;
    this.fx?.destroy();
    this.hud?.destroy();
    this.bullets = [];
    this.pets = [];
    this.petsByCol = Array.from({ length: COLS }, () => []);
    this.flowers.clear();
    this.overlay?.destroy();
    this.overlay = null;
    this.upgradeBar?.destroy();
    this.upgradeBar = null;
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
    this.bannerText?.destroy();
    this.bannerText = null;
    this.ghost?.destroy();
    this.ghost = null;
    this.cardGfx = [];
    this.tweens.killAll();
  }
}
