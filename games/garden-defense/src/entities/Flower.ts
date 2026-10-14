import Phaser from "phaser";
import {
  CELL_H,
  CELL_W,
  COMBAT,
  cellCenter,
  flowerDef,
  upgradeCost,
  MAX_FLOWER_LEVEL,
  type AttackKind,
  type FlowerDef,
  type FlowerKind,
  type FlowerLevelStats,
} from "../config";

export interface FlowerCtx {
  hasEnemyInCol(col: number, fromY: number): boolean;
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
  ): void;
  addSeeds(n: number, x?: number, y?: number): void;
  addPollen(n: number, x?: number, y?: number): void;
  onFlowerDestroyed(id: number, col: number, row: number): void;
  onFlowerShoot(kind: FlowerKind, x: number, y: number): void;
  onFlowerProduce(x: number, y: number, seeds: number, pollen: number): void;
  onFlowerEvolved(level: number, label: string): void;
  sfx: { shoot(): void; sun(): void };
  buffAt(col: number, row: number): number;
}

let nextId = 1;

/** Lv 外形倍率（贴图切换为主，倍率克制防出格） */
const LEVEL_SCALE = [1, 1.06, 1.1, 1.14, 1.18] as const;
const LEVEL_RING = [0x8fbf8a, 0x6eb8e0, 0xc4a8e8, 0xf5c84c, 0xffe08a] as const;
const LEVEL_BULLET_PX = [16, 18, 20, 22, 26] as const;

export class Flower extends Phaser.GameObjects.Container {
  readonly id: number;
  readonly kind: FlowerKind;
  readonly col: number;
  readonly row: number;
  private _level = 1;
  private _alive = true;
  private _hp: number;
  private _maxHp: number;
  private sprite: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;
  private aura: Phaser.GameObjects.Image | null = null;
  private groundAura: Phaser.GameObjects.Graphics | null = null;
  private nextAttackAt = 0;
  private nextProduceAt = 0;
  private ctx: FlowerCtx;
  private def: FlowerDef;
  private selected = false;
  private baseSx = 1;
  private baseSy = 1;
  private evolving = false;

  constructor(scene: Phaser.Scene, kind: FlowerKind, col: number, row: number, ctx: FlowerCtx) {
    const { x, y } = cellCenter(col, row);
    super(scene, x, y);
    this.id = nextId++;
    this.kind = kind;
    this.col = col;
    this.row = row;
    this.ctx = ctx;
    this.def = flowerDef(kind);
    this._maxHp = this.def.hp;
    this._hp = this._maxHp;

    const size = COMBAT.FLOWER_DISPLAY;
    this.sprite = scene.add.image(0, 4, this.lookTexture()).setOrigin(0.5, 0.5);
    const texW = Math.max(1, this.sprite.width);
    const texH = Math.max(1, this.sprite.height);
    this.baseSx = size / texW;
    this.baseSy = size / texH;
    this.applyLevelScale(1);
    this.ring = scene.add.graphics();
    this.hpBar = scene.add.graphics();
    this.add([this.sprite, this.ring, this.hpBar]);
    scene.add.existing(this);
    this.setDepth(12);
    this.drawRing();
    this.drawHp();

    const hit = Math.max(size * 0.95, CELL_W * 0.85);
    this.setSize(hit, hit);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-hit / 2, -hit / 2, hit, hit),
      Phaser.Geom.Rectangle.Contains
    );

    scene.tweens.add({
      targets: this.sprite,
      scaleX: { from: this.baseSx * 0.5, to: this.baseSx },
      scaleY: { from: this.baseSy * 0.5, to: this.baseSy },
      duration: 280,
      ease: "Back.easeOut",
    });

    if (this.kind === "orchid") this.ensureGroundAura();
  }

  get level(): number {
    return this._level;
  }
  get alive(): boolean {
    return this._alive;
  }
  get hp(): number {
    return this._hp;
  }
  get maxHp(): number {
    return this._maxHp;
  }

  get stats(): FlowerLevelStats {
    return this.def.levels[this._level - 1] ?? this.def.levels[0]!;
  }

  nextLevelStats(): FlowerLevelStats | null {
    if (this._level >= MAX_FLOWER_LEVEL) return null;
    return this.def.levels[this._level] ?? null;
  }

  upgradeCostToNext(): number | null {
    if (this._level >= MAX_FLOWER_LEVEL) return null;
    return upgradeCost(this.kind, this._level + 1);
  }

  lookLabel(): string {
    return this.def.looks[this._level - 1]?.label ?? this.def.name;
  }

  private lookTexture(): string {
    return this.def.looks[this._level - 1]?.texture ?? this.def.looks[0]!.texture;
  }

  setSelected(v: boolean): void {
    this.selected = v;
    this.drawRing();
    if (this.kind === "orchid") this.drawGroundAura();
  }

  tryUpgrade(): boolean {
    if (this._level >= MAX_FLOWER_LEVEL || this.evolving || !this._alive) return false;
    this._level += 1;
    this._maxHp = Math.round(this.def.hp * (1 + 0.22 * (this._level - 1)));
    this._hp = this._maxHp;
    // 换名贵贴图
    const tex = this.lookTexture();
    if (this.scene.textures.exists(tex)) this.sprite.setTexture(tex);
    const tw = Math.max(1, this.sprite.width);
    const th = Math.max(1, this.sprite.height);
    this.baseSx = COMBAT.FLOWER_DISPLAY / tw;
    this.baseSy = COMBAT.FLOWER_DISPLAY / th;
    this.playEvolutionCeremony();
    this.drawGroundAura();
    this.ctx.onFlowerEvolved(this._level, `${this.def.name}·${this.lookLabel()}`);
    return true;
  }

  private applyLevelScale(mul: number): void {
    const lv = LEVEL_SCALE[Math.min(this._level - 1, LEVEL_SCALE.length - 1)] ?? 1;
    const s = lv * mul;
    this.sprite.setScale(this.baseSx * s, this.baseSy * s);
  }

  private levelScale(): number {
    return LEVEL_SCALE[Math.min(this._level - 1, LEVEL_SCALE.length - 1)] ?? 1;
  }

  private playEvolutionCeremony(): void {
    this.evolving = true;
    const scene = this.scene;
    const ringColor = LEVEL_RING[Math.min(this._level - 1, 4)] ?? 0xf5c84c;
    const mul = this.levelScale();

    scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseSx * mul * 0.72,
      scaleY: this.baseSy * mul * 1.18,
      duration: 120,
      ease: "Sine.easeIn",
      onComplete: () => {
        const flash = scene.add
          .image(this.x, this.y - 6, "ring")
          .setTint(0xffffff)
          .setScale(0.15)
          .setDepth(30)
          .setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({
          targets: flash,
          scale: 1.7,
          alpha: 0,
          duration: 300,
          ease: "Cubic.easeOut",
          onComplete: () => flash.destroy(),
        });

        const ring1 = scene.add.image(this.x, this.y - 4, "ring").setTint(ringColor).setScale(0.2).setDepth(29);
        scene.tweens.add({
          targets: ring1,
          scale: 1.25,
          alpha: 0,
          duration: 400,
          ease: "Cubic.easeOut",
          onComplete: () => ring1.destroy(),
        });

        if (scene.textures.exists("dot")) {
          const em = scene.add.particles(this.x, this.y - 8, "dot", {
            tint: [ringColor, 0xfff6ee, 0xffe08a],
            scale: { start: 1.3, end: 0 },
            speed: { min: 50, max: 170 },
            angle: { min: -130, max: -50 },
            lifespan: 480,
            quantity: 16,
            emitting: false,
          });
          em.explode(16, this.x, this.y - 6);
          scene.time.delayedCall(560, () => em.destroy());
        }

        scene.tweens.add({
          targets: this.sprite,
          scaleX: this.baseSx * mul,
          scaleY: this.baseSy * mul,
          duration: 260,
          ease: "Back.easeOut",
          onComplete: () => {
            this.evolving = false;
            this.applyLevelScale(1);
          },
        });

        const tag = scene.add
          .text(this.x, this.y - 48, this.lookLabel(), {
            fontFamily: "'PingFang SC', sans-serif",
            fontSize: "18px",
            fontStyle: "bold",
            color: this._level >= 4 ? "#D4A83A" : "#9B7FC4",
            stroke: "#FFFCF7",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(40);
        scene.tweens.add({
          targets: tag,
          y: this.y - 72,
          alpha: 0,
          duration: 700,
          ease: "Cubic.easeOut",
          onComplete: () => tag.destroy(),
        });
      },
    });

    this.drawRing();
    this.drawHp();
    this.ensureAura();
  }

  private ensureAura(): void {
    if (this._level < 3 || !this.scene.textures.exists("ring")) return;
    if (this.aura) {
      this.aura.setTint(this._level >= 5 ? 0xffe08a : this._level >= 4 ? 0xf5c84c : 0xc4a8e8);
      return;
    }
    this.aura = this.scene.add
      .image(0, -2, "ring")
      .setTint(this._level >= 4 ? 0xf5c84c : 0xc4a8e8)
      .setAlpha(0.32)
      .setScale(0.5)
      .setDepth(1);
    this.addAt(this.aura, 0);
    this.scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.2, to: 0.45 },
      scale: { from: 0.46, to: 0.56 },
      duration: 1100 + this.id * 30,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private ensureGroundAura(): void {
    if (this.groundAura) return;
    this.groundAura = this.scene.add.graphics().setDepth(2);
    this.addAt(this.groundAura, 0);
    this.drawGroundAura();
  }

  private drawGroundAura(): void {
    if (!this.groundAura || this.kind !== "orchid") return;
    const g = this.groundAura;
    g.clear();
    const cells = this.stats.buffRadiusCells ?? 1.5;
    const rx = cells * CELL_W * 0.9;
    const ry = cells * CELL_H * 0.9;
    const alpha = this.selected ? 0.15 : 0.07;
    const strokeA = this.selected ? 0.5 : 0.25;
    g.fillStyle(0xc4a8e8, alpha);
    g.fillEllipse(0, 6, rx * 2, ry * 2);
    g.lineStyle(this.selected ? 2 : 1.2, 0xc4a8e8, strokeA);
    g.strokeEllipse(0, 6, rx * 2, ry * 2);
  }

  private drawRing(): void {
    this.ring.clear();
    const r = COMBAT.FLOWER_DISPLAY * 0.46 * this.levelScale();
    const color = LEVEL_RING[Math.min(this._level - 1, 4)] ?? 0x8fbf8a;
    if (this._level >= 4) {
      this.ring.lineStyle(3, color, 0.9);
      this.ring.strokeCircle(0, 0, r);
      this.ring.lineStyle(1.5, 0xffe08a, 0.45);
      this.ring.strokeCircle(0, 0, r + 4);
    } else if (this._level >= 2) {
      this.ring.lineStyle(2.2, color, 0.75);
      this.ring.strokeCircle(0, 0, r);
    }
    if (this.selected) {
      this.ring.lineStyle(3, 0xffe08a, 1);
      this.ring.strokeCircle(0, 0, r + 7);
    }
  }

  private drawHp(): void {
    this.hpBar.clear();
    if (this._hp >= this._maxHp) return;
    const w = COMBAT.FLOWER_DISPLAY * 0.8 * this.levelScale();
    const ratio = Phaser.Math.Clamp(this._hp / this._maxHp, 0, 1);
    const top = -COMBAT.FLOWER_DISPLAY * 0.92 * this.levelScale();
    this.hpBar.fillStyle(0x2f4a3e, 0.35);
    this.hpBar.fillRoundedRect(-w / 2, top, w, 6, 3);
    this.hpBar.fillStyle(ratio > 0.4 ? 0x6dbf7a : 0xe86b5c, 1);
    this.hpBar.fillRoundedRect(-w / 2, top, w * ratio, 6, 3);
  }

  takeDamage(dmg: number): void {
    if (!this._alive) return;
    this._hp -= dmg;
    this.drawHp();
    this.scene.tweens.add({ targets: this.sprite, alpha: 0.55, duration: 60, yoyo: true });
    if (this._hp <= 0) this.destroyFlower();
  }

  private destroyFlower(): void {
    if (!this._alive) return;
    this._alive = false;
    this.aura?.destroy();
    this.aura = null;
    this.groundAura?.destroy();
    this.groundAura = null;
    this.ctx.onFlowerDestroyed(this.id, this.col, this.row);
    this.destroy();
  }

  updateGame(time: number): void {
    if (!this._alive || this.evolving) return;
    const s = this.stats;

    if ((s.produceSeeds || s.producePollen) && time >= this.nextProduceAt) {
      this.nextProduceAt = time + (s.produceMs ?? 5000);
      const seeds = s.produceSeeds ?? 0;
      const pollen = s.producePollen ?? 0;
      if (seeds) this.ctx.addSeeds(seeds);
      if (pollen) this.ctx.addPollen(pollen);
      this.ctx.onFlowerProduce(this.x, this.y - 36, seeds, pollen);
      this.ctx.sfx.sun();
      this.scene.tweens.add({
        targets: this.sprite,
        scaleY: this.sprite.scaleY * 0.9,
        scaleX: this.sprite.scaleX * 1.08,
        duration: 120,
        yoyo: true,
      });
    }

    if (!s.atk || time < this.nextAttackAt) return;
    if (!this.ctx.hasEnemyInCol(this.col, this.y)) return;

    this.nextAttackAt = time + s.rateMs;
    const buff = 1 + this.ctx.buffAt(this.col, this.row);
    const dmg = Math.round(s.atk * buff);
    const bulletPx = LEVEL_BULLET_PX[Math.min(this._level - 1, 4)] ?? 16;
    const attack = s.attack ?? "straight";
    const trail = this._level >= 2 || attack !== "straight";

    const fire = (offsetX: number, vx?: number) => {
      this.ctx.spawnBullet(this.col, this.x + offsetX, this.y - 8, this.def.petal, dmg, {
        attack,
        slowMul: s.slowMul,
        slowMs: s.slowMs,
        splashCells: s.splashCells,
        sizePx: bulletPx,
        trail,
        vx,
      });
    };

    if (s.triple) {
      fire(-16, -30);
      fire(0);
      fire(16, 30);
    } else if (s.double) {
      fire(-8, -18);
      fire(8, 18);
    } else {
      fire(0);
    }

    this.ctx.onFlowerShoot(this.kind, this.x, this.y - 24);
    this.ctx.sfx.shoot();
    const y0 = this.sprite.y;
    this.scene.tweens.add({ targets: this.sprite, y: y0 + 5, duration: 70, yoyo: true });
  }

  describe(): string {
    return `${this.def.name}·${this.lookLabel()} Lv${this._level}`;
  }

  statSummary(): string {
    const s = this.stats;
    if (!s.atk) {
      return `产出 种${s.produceSeeds ?? 0}+粉${s.producePollen ?? 0} / ${((s.produceMs ?? 5000) / 1000).toFixed(1)}s`;
    }
    const dps = (s.atk / (s.rateMs / 1000)).toFixed(1);
    const kindLabel: Record<string, string> = {
      straight: "直线",
      homing: "追踪",
      parabola: "抛物",
      whirl: "旋风",
      laser: "激光",
    };
    const extra = [s.double ? "双发" : "", s.triple ? "三连" : "", s.slowMul ? "减速" : "", kindLabel[s.attack ?? "straight"] ?? ""]
      .filter(Boolean)
      .join("·");
    return `攻 ${s.atk} · 射速 ${(s.rateMs / 1000).toFixed(2)}s · DPS ${dps}${extra ? " · " + extra : ""}`;
  }
}
