import Phaser from "phaser";
import { COMBAT, HOME_Y, PETS, colX, type PetDef, type PetKind } from "../config";

export interface PetCtx {
  flowersInCol(col: number): Array<{ y: number; takeDamage(d: number): void; alive: boolean }>;
  onPetReachHome(col: number): void;
  onPetKilled(kind: PetKind, x: number, y: number, dropSeeds: number, dropPollen: number): void;
  spawnSplit(x: number, y: number, kind: PetKind, hp: number, armor: number, speed: number): void;
  sfx: { kill(): void; hit(): void };
}

let nextId = 1;

export class Pet extends Phaser.GameObjects.Container {
  readonly id: number;
  readonly kind: PetKind;
  readonly col: number;
  private def: PetDef;
  private _hp: number;
  private maxHp: number;
  private armor: number;
  private speed: number;
  private sprite: Phaser.GameObjects.Image;
  private hpBar: Phaser.GameObjects.Graphics;
  private slowUntil = 0;
  private slowMul = 1;
  private biteAt = 0;
  private _alive = true;
  private ctx: PetCtx;
  private reachedHome = false;
  private isSplit: boolean;

  constructor(
    scene: Phaser.Scene,
    kind: PetKind,
    col: number,
    y: number,
    ctx: PetCtx,
    scale: { hpMul: number; armorMul: number; speedMul: number },
    opts: { hpOverride?: number; armorOverride?: number; speedOverride?: number; isSplit?: boolean } = {}
  ) {
    const x = colX(col);
    super(scene, x, y);
    this.id = nextId++;
    this.kind = kind;
    this.col = col;
    this.ctx = ctx;
    this.def = PETS[kind];
    this.isSplit = opts.isSplit ?? false;
    this.maxHp = Math.round((opts.hpOverride ?? this.def.hp * scale.hpMul));
    this._hp = this.maxHp;
    this.armor = Math.round((opts.armorOverride ?? this.def.armor * scale.armorMul));
    this.speed = (opts.speedOverride ?? this.def.speed * scale.speedMul);

    const { w, h } = COMBAT.PET_DISPLAY;
    this.sprite = scene.add.image(0, 0, this.def.texture);
    const tw = Math.max(1, this.sprite.width);
    const th = Math.max(1, this.sprite.height);
    this.sprite.setScale(w / tw, h / th);
    this.hpBar = scene.add.graphics();
    this.add([this.sprite, this.hpBar]);
    scene.add.existing(this);
    this.setDepth(10);
    this.drawHp();

    scene.tweens.add({
      targets: this.sprite,
      y: { from: -6, to: 2 },
      duration: 320 + (idHash(this.id) % 80),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  get alive(): boolean {
    return this._alive;
  }
  get yTop(): number {
    return this.y;
  }

  setSlow(mul: number, ms: number, now: number): void {
    this.slowMul = mul;
    this.slowUntil = now + ms;
    this.sprite.setTint(0xa8d0e8);
    this.scene.time.delayedCall(ms, () => {
      if (this._alive) this.sprite.clearTint();
    });
  }

  takeDamage(dmg: number): void {
    if (!this._alive) return;
    let left = dmg;
    if (this.armor > 0) {
      const abs = Math.min(this.armor, left);
      this.armor -= abs;
      left -= abs;
    }
    this._hp -= left;
    this.drawHp();
    this.ctx.sfx.hit();
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.5,
      duration: 50,
      yoyo: true,
    });
    if (this._hp <= 0) this.die(true);
  }

  private drawHp(): void {
    this.hpBar.clear();
    const w = COMBAT.PET_DISPLAY.w * 0.85;
    const ratio = Phaser.Math.Clamp(this._hp / this.maxHp, 0, 1);
    const y = -COMBAT.PET_DISPLAY.h * 0.55;
    this.hpBar.fillStyle(0x2f4a3e, 0.3);
    this.hpBar.fillRoundedRect(-w / 2, y, w, 6, 3);
    this.hpBar.fillStyle(ratio > 0.35 ? 0x8fbf8a : 0xe86b5c, 1);
    this.hpBar.fillRoundedRect(-w / 2, y, w * ratio, 6, 3);
  }

  private die(fromKill: boolean): void {
    if (!this._alive) return;
    this._alive = false;
    this.scene.tweens.killTweensOf(this.sprite);
    if (fromKill) {
      this.ctx.onPetKilled(this.kind, this.x, this.y, this.def.dropSeeds, this.def.dropPollen);
      this.ctx.sfx.kill();
      if (this.def.splitCount && !this.isSplit) {
        for (let i = 0; i < this.def.splitCount; i++) {
          this.ctx.spawnSplit(
            this.x + (i === 0 ? -12 : 12),
            this.y,
            this.kind,
            Math.round(this.maxHp * (this.def.splitHpMul ?? 0.45)),
            Math.round(this.armor * 0.3),
            this.speed * 1.05
          );
        }
      }
    }
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.7,
      duration: 180,
      onComplete: () => this.destroy(),
    });
  }

  updateGame(time: number, dt: number): void {
    if (!this._alive || this.reachedHome) return;
    const mul = time < this.slowUntil ? this.slowMul : 1;
    const dy = this.speed * mul * (dt / 1000);

    const targets = this.ctx.flowersInCol(this.col);
    const front = targets
      .filter((t) => t.alive && this.y - t.y > -20 && this.y - t.y < 56)
      .sort((a, b) => b.y - a.y)[0];

    if (front) {
      if (time >= this.biteAt) {
        this.biteAt = time + 500;
        front.takeDamage(Math.round(this.def.biteDps * 0.5));
        this.scene.tweens.add({
          targets: this.sprite,
          x: { from: -4, to: 4 },
          duration: 90,
          yoyo: true,
          repeat: 1,
        });
      }
      return;
    }

    this.y += dy;
    if (this.y >= HOME_Y) {
      this.reachedHome = true;
      this.ctx.onPetReachHome(this.col);
      this.die(false);
    }
  }
}

function idHash(n: number): number {
  return Math.abs(Math.imul(n, 2654435761) >>> 0);
}
