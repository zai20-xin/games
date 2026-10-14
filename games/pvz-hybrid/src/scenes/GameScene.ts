import Phaser from "phaser";
import {
  CELL_H,
  CELL_W,
  COLS,
  COMBO_REWARD_EVERY,
  COMBO_WINDOW_MS,
  HITSTOP_BOOM_MS,
  HITSTOP_KILL_MS,
  HOUSE_LINE_X,
  H,
  LAWN_X,
  LAWN_Y,
  MOWER_X,
  PLANT_BEHAVIORS,
  ROWS,
  SLOWMO_FACTOR,
  SLOWMO_MS,
  W,
  plantDef,
  waveScale,
  type PlantKind,
  type Projectile,
  type ZombieKind,
} from "../config";
import { bus } from "../bus";
import { GridModel } from "../systems/GridModel";
import { Sfx } from "../systems/Sfx";
import { Fx } from "../systems/Fx";
import { WaveManager } from "../systems/WaveManager";
import { Conveyor, BELT_CAPACITY, BELT_SPAWN_MS } from "../systems/Conveyor";
import { getLevel, WATER_SLOW_MUL, type LevelDef } from "../levels";
import { Plant, type PlantCtx } from "../entities/Plant";
import { Zombie, type ZombieCtx } from "../entities/Zombie";
import { Bullet, type BulletCtx, type BulletOpts } from "../entities/Bullet";

import { Mower } from "../entities/Mower";
import { rollFusion, canFuse } from "../systems/Fusion";
import { rollEvolution } from "../engine/fusion";
import type { EvolvedPlant, FormTier } from "../types/dictionaries";
import { toPlantVariant } from "../systems/EvolvedBridge";
import { PLANTS, FORMS, SKILLS } from "../data/dictionaries";
import { Collection } from "../systems/Collection";

export class GameScene extends Phaser.Scene implements PlantCtx, ZombieCtx, BulletCtx {
  private grid = new GridModel();
  readonly sfx = new Sfx();
  readonly fx: Fx = new Fx(this);
  private wm = new WaveManager();
  private plants: Plant[] = [];
  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private mowers: (Mower | undefined)[] = [];
  /** 当前关卡（SelectScene 传入，默认白天） */
  private level: LevelDef = getLevel("day");
  /** 出战卡组（选卡结果，作为传送带出卡池） */
  private deck: PlantKind[] = [];
  private selected: PlantKind | "shovel" | null = null;
  /** 传送带选中的免费种植：从带上下来的植物免阳光（免费） */
  private freeSelect = false;
  /** 当前选中的传送带卡 id（种植成功后据此从带扣卡） */
  private selectedBeltId: number | null = null;
  /** 当前选中的传送带进化卡数据 */
  private selectedEvolved: EvolvedPlant | null = null;
  /** 传送带出卡 */
  private conveyor = new Conveyor();
  private hitstopUntil = 0;
  private slowFactor = 1;
  private combo = 0;
  private lastKillAt = 0;
  private ghost: Phaser.GameObjects.Sprite | null = null;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private betweenWaves = true;
  private ended = false;
  private killed = 0;
  private lastSpawnRow = -1;
  readonly collection = new Collection();

  constructor() {
    super("game");
  }

  /** SelectScene 传入关卡与卡组；scene.restart() 会保留同一份 data */
  init(data: { levelId?: string; deck?: PlantKind[] }): void {
    this.level = getLevel(data?.levelId ?? "day");
    this.deck =
      data?.deck && data.deck.length > 0
        ? [...data.deck]
        : [...this.level.selectable.slice(0, this.level.selectSlots)];
  }

  create(): void {
    // 重启安全：全部状态归零
    this.grid = new GridModel();
    this.wm = new WaveManager(this.level.totalWaves, this.level.zombiePool);
    this.plants = [];
    this.zombies = [];
    this.bullets = [];
    this.mowers = [];
    this.selected = null;
    this.freeSelect = false;
    this.selectedBeltId = null;
    this.conveyor = new Conveyor(BELT_CAPACITY, this.deck);
    this.ghost = null;
    this.spawnTimer = null;
    this.betweenWaves = true;
    this.ended = false;
    this.killed = 0;
    this.lastSpawnRow = -1;
    this.hitstopUntil = 0;
    this.slowFactor = 1;
    this.combo = 0;
    this.lastKillAt = 0;

    if (!this.scene.isActive("ui")) this.scene.launch("ui");
    bus.emit("collection-ref", this.collection);

    this.drawLawn();
    this.initMowers();
    this.bindInput();

    bus.on("card-selected", this.onCardSelected, this);
    bus.on("belt-select", this.onBeltSelect, this);
    bus.on("request-restart", this.onRestart, this);
    bus.on("request-level-select", this.onLevelSelect, this);
    this.events.once("shutdown", () => {
      bus.off("card-selected", this.onCardSelected, this);
      bus.off("belt-select", this.onBeltSelect, this);
      bus.off("request-restart", this.onRestart, this);
      bus.off("request-level-select", this.onLevelSelect, this);
    });

    // 传送带开刷：先铺几张卡供开局选择
    for (let i = 0; i < 4; i++) this.conveyor.spawn();
    bus.emit("belt", this.conveyor.snapshot());
    this.time.addEvent({
      delay: BELT_SPAWN_MS,
      loop: true,
      callback: () => this.beltSpawn(),
    });

    // 延迟一拍发初始状态：等 UiScene 完成订阅（首启与重启均适用）
    this.time.delayedCall(80, () => {
      bus.emit("level", {
        name: this.level.name,
        totalWaves: this.level.totalWaves,
        terrain: this.level.terrain,
      });
      bus.emit("progress", 0);
      bus.emit("toast", "先种植射手植物！");
    });
    this.exposeDebugHooks();
    this.time.delayedCall(7000, () => {
      this.startNextWave();
      this.betweenWaves = false;
    });
  }

  /** e2e 测试钩子：定向出怪 / 读状态 */
  private exposeDebugHooks(): void {
    (window as unknown as { __pvz?: Record<string, unknown> }).__pvz = {
      spawnZombie: (kind: ZombieKind, row: number, x: number = W + 30) => {
        this.zombies.push(new Zombie(this, row, x, this.cellBottom(row) + 2, kind, this));
      },
      state: () => ({
        level: this.level.id,
        terrain: this.level.terrain,
        totalWaves: this.level.totalWaves,
        deck: this.deck,
        zombies: this.zombies.filter((z) => !z.isDying).length,
        killed: this.killed,
        wave: this.wm.currentWave,
        ended: this.ended,
        trail: this.zombies.map((z) => ({
          k: z.kind,
          r: z.row,
          x: Math.round(z.x),
          hp: Math.round(z.hp),
          armor: Math.round(z.armor),
          dying: z.isDying,
        })),
        mowers: this.mowers.map((m) => (m ? m.used : "none")),
        plants: this.plants.map((p) => p.kind),
        selected: this.selected,
        freeSelect: this.freeSelect,
        selectedBeltId: this.selectedBeltId,
        belt: this.conveyor.list.map((s) => ({ id: s.id, kind: s.kind })),
        ghost: this.ghost
          ? { visible: this.ghost.visible, x: Math.round(this.ghost.x), y: Math.round(this.ghost.y) }
          : null,
        collection: {
          discovered: this.collection.getDiscoveredCount(),
          total: this.collection.getTotalCombinations(),
          fragments: this.collection.getFragments(),
        },
      }),
    };
  }

  // ---------- 场景搭建 ----------

  private drawLawn(): void {
    const night = this.level.terrain === "night";
    this.cameras.main.setBackgroundColor(night ? "#0d1b2a" : "#243d12");
    const g = this.add.graphics().setDepth(0);

    // 房屋前小径：墙面渐变 + 木纹走道 + 正门方向阴影
    g.fillGradientStyle(0x8b5a33, 0x8b5a33, 0x5c3a1f, 0x5c3a1f, 1);
    g.fillRect(0, 0, LAWN_X, H);
    g.fillStyle(0x7d5836, 1);
    for (let y = 8; y < H; y += 34) {
      g.fillRect(14, y, LAWN_X - 40, 4);
    }
    g.fillStyle(0x000000, 0.1);
    g.fillRect(LAWN_X - 12, 0, 12, H);

    // 草坪棋盘格（夜间用暗色调）
    const even = night ? 0x2f4a2f : 0x78ad45;
    const odd = night ? 0x37523a : 0x83bb54;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        g.fillStyle((r + c) % 2 === 0 ? even : odd, 1);
        g.fillRect(LAWN_X + c * CELL_W, LAWN_Y + r * CELL_H, CELL_W, CELL_H);
      }
    }

    // 草地细则噪点（确定性生成，稳定不闪）+ 每格左上斜光
    const grass = this.add.graphics().setDepth(0);
    let seed = 20260827;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    grass.fillStyle(night ? 0x9fd8a0 : 0xecffce, night ? 0.1 : 0.16);
    for (let k = 0; k < 150; k++) {
      grass.fillCircle(LAWN_X + rnd() * (COLS * CELL_W), LAWN_Y + rnd() * (ROWS * CELL_H), 1 + rnd() * 1.7);
    }
    grass.fillStyle(0xffffff, 0.05);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const bx = LAWN_X + c * CELL_W;
        const by = LAWN_Y + r * CELL_H;
        grass.fillTriangle(bx + 5, by + 5, bx + 15, by + 5, bx + 9, by + 15);
      }
    }

    // 泳池水行：覆盖在草地上方（水面 + 波光 + 荷叶）
    if (this.level.terrain === "pool") this.drawWaterRows();

    // 草坪边界柔影 + 轮毂
    g.fillStyle(0x1c2f10, 0.18);
    g.fillRect(LAWN_X - 3, LAWN_Y, 3, ROWS * CELL_H);
    g.fillStyle(0x1c2f10, 0.14);
    g.fillRect(LAWN_X + COLS * CELL_W, LAWN_Y, 3, ROWS * CELL_H);
    g.lineStyle(4, night ? 0x2c4a2c : 0x3e6b1f, 1);
    g.strokeRect(LAWN_X, LAWN_Y, COLS * CELL_W, ROWS * CELL_H);

    // 右侧出怪林带：渐变暗绿过渡
    g.fillGradientStyle(
      night ? 0x1f3a2a : 0x35603a,
      night ? 0x1f3a2a : 0x35603a,
      night ? 0x12241a : 0x1f3a1f,
      night ? 0x12241a : 0x1f3a1f,
      1
    );
    g.fillRect(LAWN_X + COLS * CELL_W + 4, LAWN_Y - 8, W, ROWS * CELL_H + 16);

    // 夜间点缀：星空 + 月亮
    if (night) this.drawNightSky();
  }

  /** 泳池水行：水面渐变 + 波光横纹 + 荷叶（装饰性承载植物） */
  private drawWaterRows(): void {
    const g = this.add.graphics().setDepth(0);
    for (const r of this.level.waterRows ?? []) {
      const y = LAWN_Y + r * CELL_H;
      g.fillGradientStyle(0x3f9fd9, 0x3f9fd9, 0x1f6fae, 0x1f6fae, 1);
      g.fillRect(LAWN_X, y, COLS * CELL_W, CELL_H);
      g.fillStyle(0xbfe8ff, 0.22);
      for (let x = LAWN_X + 10; x < LAWN_X + COLS * CELL_W; x += 46) {
        g.fillEllipse(x, y + 22 + ((x / 46) % 2) * 30, 30, 5);
      }
      g.fillStyle(0x0b3a5e, 0.28);
      g.fillRect(LAWN_X, y + CELL_H - 10, COLS * CELL_W, 10);
      for (let c = 0; c < COLS; c++) {
        const cx = LAWN_X + c * CELL_W + CELL_W / 2;
        const cy = y + CELL_H / 2 + 10;
        g.fillStyle(0x2e7d32, 0.92);
        g.fillEllipse(cx, cy, 58, 28);
        g.fillStyle(0x43a047, 0.92);
        g.fillEllipse(cx - 8, cy - 4, 42, 18);
        g.lineStyle(2, 0x1b5e20, 0.8);
        g.strokeEllipse(cx, cy, 58, 28);
      }
    }
  }

  /** 夜间天空点缀：草坪上方星空 + 右侧林带月亮 */
  private drawNightSky(): void {
    const g = this.add.graphics().setDepth(0);
    let seed = 20260827;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    g.fillStyle(0xffffff, 0.7);
    for (let k = 0; k < 46; k++) {
      g.fillCircle(LAWN_X + 20 + rnd() * (COLS * CELL_W - 40), 8 + rnd() * (LAWN_Y - 16), 1 + rnd() * 1.5);
    }
    // 月亮：右上林带内，避开顶部 UI 栏
    const mx = W - 64;
    const my = LAWN_Y + 16;
    g.fillStyle(0xf5f0d0, 0.95);
    g.fillCircle(mx, my, 22);
    g.fillStyle(0x1f3a2a, 1);
    g.fillCircle(mx + 8, my - 6, 18);
  }

  private initMowers(): void {
    for (let r = 0; r < ROWS; r++) {
      this.mowers[r] = new Mower(this, r, MOWER_X, this.cellBottom(r) - 27);
    }
  }

  private bindInput(): void {
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.sfx.resume();
      if (this.ended) return;
      if (p.rightButtonDown()) {
        this.select(null);
        bus.emit("card-selected", null);
        return;
      }
      const row = this.grid.rowAt(p.y);
      const col = this.grid.colAt(p.x);
      if (row < 0 || col < 0) return;
      if (this.selected === "shovel") {
        this.dig(row, col);
        return;
      }
      if (this.selected) this.tryPlant(this.selected, row, col);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.updateGhost(p));
  }

  // ---------- 选择与种植 ----------

  private onCardSelected(kind: PlantKind | "shovel" | null, free = false): void {
    this.armSelect(kind, free);
  }

  /** 从传送带点卡：免费选择（免阳光），记录带卡 id 以便种植后扣卡 */
  private onBeltSelect(id: number | null, evolved?: EvolvedPlant | null): void {
    if (id === null) {
      this.selectedBeltId = null;
      this.selectedEvolved = null;
      this.armSelect(null, false);
      return;
    }
    const slot = this.conveyor.list.find((s) => s.id === id);
    if (!slot) return;
    this.selectedBeltId = id;
    this.selectedEvolved = evolved ?? slot.evolved ?? null;
    this.armSelect(slot.kind, true);
    // 必须带 free=true：否则回环的 onCardSelected 会用 free=false 覆盖，
    // 免费种植与扣卡链路（canAfford/spend/consumeBeltPlace）全部失效
    bus.emit("card-selected", slot.kind, true);
  }

  /** 统一武装选择态：设置选中植物 + 是否免费 + 幽灵预览贴图 */
  private armSelect(kind: PlantKind | "shovel" | null, free: boolean): void {
    this.selected = kind;
    this.freeSelect = free;
    if (!kind) {
      this.ghost?.setVisible(false);
      return;
    }
    const texture = kind === "shovel" ? "shovel" : plantDef(kind).texture;
    if (!this.ghost) {
      this.ghost = this.add
        .sprite(0, 0, texture)
        .setOrigin(0.5, 1)
        .setDisplaySize(kind === "shovel" ? 64 : 84, kind === "shovel" ? 64 : 84)
        .setAlpha(0.55)
        .setDepth(60)
        .setVisible(false);
    } else {
      this.ghost.setTexture(texture).setVisible(false);
    }
  }

  private updateGhost(p: Phaser.Input.Pointer): void {
    if (!this.selected || !this.ghost) return;
    const row = this.grid.rowAt(p.y);
    const col = this.grid.colAt(p.x);
    if (this.selected === "shovel") {
      const occ = row >= 0 && col >= 0 ? this.grid.at(row, col) : undefined;
      this.ghost.setVisible(!!occ).setPosition(p.x, p.y).setTint(occ ? 0xffdddd : 0xffffff);
      return;
    }
    if (row < 0 || col < 0) {
      this.ghost.setVisible(false);
      return;
    }
    const center = this.grid.cellCenter(row, col);
    const occupant = this.grid.at(row, col);
    const fused = occupant && (occupant as Plant).variant.fused;
    const fusable = occupant && !fused && canFuse(this.selected, (occupant as Plant).kind);
    const tint = !occupant
      ? 0xffffff                  // 空格 = 正常
      : fusable
        ? 0xffd94d                // 可融合 = 金色提示
        : 0xff6b6b;               // 不可融合 = 红
    this.ghost
      .setVisible(true)
      .setPosition(center.x, this.cellBottom(row) - 4)
      .setTint(tint);
  }

  private tryPlant(kind: PlantKind, row: number, col: number): void {
    const def = plantDef(kind);
    const occupant = this.grid.at(row, col);

    // 占用格：尝试融合
    if (occupant) {
      const old = occupant as Plant;
      if (!old.alive) return;
      if (old.variant.fused) {
        bus.emit("toast", "已融合过的植物无法再次融合！");
        return;
      }
      if (!canFuse(kind, old.kind)) {
        bus.emit("toast", "这两种植物无法融合！");
        return;
      }
      this.tryFuse(old, kind, row, col);
      return;
    }

    const center = this.grid.cellCenter(row, col);

    // 传送带进化卡：直接用 EvolvedPlant 的 variant
    if (this.selectedEvolved && this.freeSelect) {
      const variant = toPlantVariant(this.selectedEvolved);
      const plant = new Plant(this, row, col, center.x, this.cellBottom(row) - 4, def, variant);
      plant.evolved = this.selectedEvolved;
      plant.setDepth(10 + row);
      this.grid.place(plant);
      this.plants.push(plant);
      this.fx.dirtBurst(center.x, this.cellBottom(row) - 6);
      plant.setScale(plant.scaleX * 1.18, plant.scaleY * 0.82);
      this.tweens.add({
        targets: plant,
        scaleX: plant.scaleX / 1.18,
        scaleY: plant.scaleY / 0.82,
        duration: 200,
        ease: "Back.easeOut",
      });
      this.sfx.place();
      this.consumeBeltPlace();
      this.select(null);
      bus.emit("card-selected", null);
      return;
    }

    const plant = new Plant(this, row, col, center.x, this.cellBottom(row) - 4, def);
    plant.setDepth(10 + row);
    this.grid.place(plant);
    this.plants.push(plant);
    // 种植反馈：泥土飞溅 + 弹性落地
    this.fx.dirtBurst(center.x, this.cellBottom(row) - 6);
    plant.setScale(plant.scaleX * 1.18, plant.scaleY * 0.82);
    this.tweens.add({
      targets: plant,
      scaleX: plant.scaleX / 1.18,
      scaleY: plant.scaleY / 0.82,
      duration: 200,
      ease: "Back.easeOut",
    });
    this.sfx.place();
    if (!this.freeSelect) bus.emit("card-used", kind, def.cooldownMs);
    this.consumeBeltPlace();
    this.select(null);
    bus.emit("card-selected", null);
  }

  /** 种植/融合成功后，若来源是传送带则扣掉对应卡并同步 UI */
  private consumeBeltPlace(): void {
    if (!this.freeSelect || this.selectedBeltId === null) return;
    this.conveyor.take(this.selectedBeltId);
    this.selectedBeltId = null;
    this.selectedEvolved = null;
    bus.emit("belt", this.conveyor.snapshot());
  }

  /** 融合：拆旧株 → 形态进化动画（吸收→凝核→破茧成形） */
  private tryFuse(old: Plant, newKind: PlantKind, row: number, col: number): void {
    const newDef = plantDef(newKind);

    // 使用新引擎：将旧株转换为 EvolvedPlant
    const oldEvolved: EvolvedPlant = old.evolved ?? {
      base: { id: old.kind, name: old.def.name, family: "shooter", baseStats: { attack: 20, health: 300, speed: 1 }, cost: 100, texture: "pea" },
      mods: [],
      level: 0,
    };

    // 传送带进化卡直接作为新株的 EvolvedPlant
    let newEvolved: EvolvedPlant;
    if (this.selectedEvolved) {
      newEvolved = this.selectedEvolved;
    } else {
      const newBasePlant = PLANTS.find((p) => p.id === newKind);
      newEvolved = {
        base: newBasePlant ?? { id: newKind, name: newDef.name, family: "shooter", baseStats: { attack: 20, health: 300, speed: 1 }, cost: 100, texture: "pea" },
        mods: [],
        level: 0,
      };
    }

    // 调用新融合引擎，传递击杀数用于动态配方判定
    const result = rollEvolution(oldEvolved, newEvolved, FORMS, SKILLS, this.wm.currentWave, row, col, this.killed, false, this.killed);

    // 如果新引擎失败，回退到旧引擎
    if (!result.success) {
      // 尝试旧引擎
      const legacyResult = rollFusion(old.kind, newKind);
      const variant = legacyResult.variant;
      const cx = old.x;
      const cy = this.cellBottom(row) - 4;
      old.kill();
      this.plants = this.plants.filter((p) => p !== old);
      this.grid.removeAt(row, col);
      const newPlant = new Plant(this, row, col, cx, cy, plantDef(legacyResult.kind), variant);
      newPlant.setDepth(10 + row);
      newPlant.setVisible(false);
      this.grid.place(newPlant);
      this.plants.push(newPlant);
      this.playFusionEvolution(old, newPlant, cx, cy);
      const toastColor = variant.tier === "super" ? "⚡" : variant.tier === "weak" ? "💧" : "✨";
      const fusionMsg = variant.isMonster
        ? `${toastColor} 变异怪物！${plantDef(legacyResult.kind).name}·${variant.label}`
        : `${toastColor} 变异！${plantDef(legacyResult.kind).name}·${variant.label}`;
      this.time.delayedCall(320, () => {
        if (variant.isMonster) {
          bus.emit("banner", fusionMsg);
          this.fx.chaosStorm(cx, cy - 42, !!variant.skill);
          this.cameras.main.shake(420, 0.012);
          this.time.delayedCall(80, () => this.fx.confettiRain());
        } else if (variant.tier === "super") {
          bus.emit("banner", fusionMsg);
        } else {
          bus.emit("toast", fusionMsg);
        }
      });
      if (!this.freeSelect) bus.emit("card-used", newKind, newDef.cooldownMs);
      this.consumeBeltPlace();
      this.select(null);
      bus.emit("card-selected", null);
      return;
    }

    // 新引擎成功：使用进化结果
    const evolved = result.evolved!;
    const variant = toPlantVariant(evolved);
    const cx = old.x;
    const cy = this.cellBottom(row) - 4;

    // 释放旧株占格，创建新形态株
    old.kill();
    this.plants = this.plants.filter((p) => p !== old);
    this.grid.removeAt(row, col);
    const newPlant = new Plant(this, row, col, cx, cy, plantDef(evolved.base.id as PlantKind), variant);
    newPlant.evolved = evolved;
    newPlant.setDepth(10 + row);
    newPlant.setVisible(false);
    this.grid.place(newPlant);
    this.plants.push(newPlant);

    this.playFusionEvolution(old, newPlant, cx, cy);

    // 收集记录：新发现 / 碎片掉落
    if (evolved.mods[0]) {
      const isNew = this.collection.record(evolved.mods[0]);
      if (isNew) bus.emit("toast", "新发现已记录！");
    }
    if (result.droppedMods && result.droppedMods.length > 0) {
      this.collection.addFragments(result.droppedMods.length);
      bus.emit("toast", `获得 ${result.droppedMods.length} 碎片`);
    }

    // 文字/屏幕反馈
    const formName = evolved.mods[0]?.form.name ?? "";
    const skillName = evolved.mods[0]?.skill.name ?? "";
    const toastColor = variant.tier === "super" ? "⚡" : "✨";
    const fusionMsg = variant.isMonster
      ? `${toastColor} 进化！${evolved.base.name}·${formName}·${skillName}`
      : `${toastColor} 变异！${evolved.base.name}·${variant.label}`;
    this.time.delayedCall(320, () => {
      if (variant.isMonster) {
        bus.emit("banner", fusionMsg);
        this.fx.chaosStorm(cx, cy - 42, !!variant.skill);
        this.cameras.main.shake(420, 0.012);
        this.time.delayedCall(80, () => this.fx.confettiRain());
      } else if (variant.tier === "super") {
        bus.emit("banner", fusionMsg);
      } else {
        bus.emit("toast", fusionMsg);
      }
    });

    // 动态配方专属视觉：金色冲击波 + 全屏闪光 + 屏幕震动
    if (result.bonusEffect) {
      this.time.delayedCall(350, () => {
        bus.emit("banner", "动态配方激活！");
        this.fx.shockwave(cx, cy - 42, 160);
        this.fx.confettiRain();
        this.cameras.main.shake(500, 0.015);
        this.fx.flash(0.4);
        const gold = this.add.graphics().setDepth(50);
        gold.lineStyle(5, 0xffd700, 1);
        gold.strokeCircle(cx, cy - 42, 10);
        this.tweens.add({
          targets: gold,
          alpha: 0,
          duration: 800,
          ease: "Quad.easeOut",
          onUpdate: () => {
            gold.clear();
            gold.lineStyle(5, 0xffd700, gold.alpha);
            const r = 10 + (1 - gold.alpha) * 120;
            gold.strokeCircle(cx, cy - 42, r);
          },
          onComplete: () => gold.destroy(),
        });
      });
    }

    // 结算清理
    if (!this.freeSelect) bus.emit("card-used", newKind, newDef.cooldownMs);
    this.consumeBeltPlace();
    this.select(null);
    bus.emit("card-selected", null);
  }

  /**
   * 形态进化三段动画（摒弃"叠特效"，改为可读的升级叙事）：
   * 1) 吸收：旧株受激膨胀、亮度拉到白热
   * 2) 凝核：旧株塌缩成一颗白色核心
   * 3) 破茧：核心迸裂粒子，新形态从核心破壳而出，缩放回弹过长 + 染形态色成型
   * + 稀有度特效：rare 蓝光 / epic 紫环 / legendary 金波+彩纸
   */
  private playFusionEvolution(old: Plant, newPlant: Plant, cx: number, cy: number): void {
    const coreY = cy - 42;
    // 稀有度判定：优先取进化数据的 mod tier，否则从 variant 推断
    let rarityTier: FormTier = "common";
    if (newPlant.evolved && newPlant.evolved.mods.length > 0) {
      rarityTier = newPlant.evolved.mods[0]!.tier;
    } else if (newPlant.variant.tier === "super") {
      rarityTier = "epic";
    } else if (newPlant.variant.isMonster) {
      rarityTier = "legendary";
    }

    // 白热核心（跟随旧株位置）
    const core = this.add
      .image(cx, coreY, "dot")
      .setTint(0xffffff)
      .setDepth(48)
      .setScale(2)
      .setAlpha(0);

    // 1) 吸收：旧株白热膨胀
    this.tweens.add({
      targets: old,
      scaleX: old.scaleX * 1.3,
      scaleY: old.scaleY * 1.3,
      duration: 130,
      ease: "Quad.easeOut",
    });
    this.tweens.add({ targets: old, alpha: 0.5, duration: 130 });

    // 2) 凝核：核心亮起 → 旧株塌缩
    this.tweens.add({ targets: core, alpha: 1, scale: 4.2, duration: 150, delay: 100 });
    this.tweens.add({
      targets: old,
      scaleX: 0.06,
      scaleY: 0.06,
      alpha: 0,
      duration: 200,
      delay: 120,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.tweens.killTweensOf(old);
        old.destroy();
      },
    });

    // 3) 破茧成形：核心迸发粒子 + 新形态破壳而出
    const baseX = newPlant.scaleX;
    const baseY = newPlant.scaleY;
    this.time.delayedCall(300, () => {
      core.destroy();
      this.fx.fusionBurst(cx, coreY, newPlant.variant.tier);
      this.fx.damageText(cx, cy - 70, 0, false);
      newPlant.setVisible(true).setAlpha(0.92).setTint(0xffffff).setScale(0.1, 0.1);
      // 染成形态色（弱/平凡：从白冷焰落回本体；传说：白→金）
      if (newPlant.formColor !== null) {
        this.tweens.add({
          targets: newPlant,
          tint: { from: 0xffffff, to: newPlant.formColor },
          duration: 200,
          ease: "Sine.easeIn",
        });
      }
      // 稀有度特效
      if (rarityTier === "rare") {
        // 蓝色闪烁粒子
        const sparkles = this.add.particles(cx, coreY, "dot", {
          speed: { min: 40, max: 100 },
          angle: { min: 0, max: 360 },
          lifespan: 500,
          scale: { start: 0.8, end: 0 },
          tint: [0x4488ff, 0x88bbff, 0xffffff],
          alpha: { start: 0.9, end: 0 },
          quantity: 12,
          emitting: false,
        }).setDepth(49);
        sparkles.explode(12);
        this.time.delayedCall(600, () => sparkles.destroy());
      } else if (rarityTier === "epic") {
        // 紫色能量环
        const ring = this.add.graphics().setDepth(49);
        ring.lineStyle(3, 0xaa44ff, 0.9);
        ring.strokeCircle(cx, coreY, 10);
        this.tweens.add({
          targets: ring,
          alpha: 0,
          duration: 500,
          ease: "Quad.easeOut",
          onUpdate: () => {
            ring.clear();
            ring.lineStyle(3, 0xaa44ff, ring.alpha);
            const r = 10 + (1 - ring.alpha) * 60;
            ring.strokeCircle(cx, coreY, r);
          },
          onComplete: () => ring.destroy(),
        });
      } else if (rarityTier === "legendary") {
        // 金色冲击波 + 彩纸
        this.fx.shockwave(cx, coreY, 120);
        this.fx.confettiRain();
        const gold = this.add.graphics().setDepth(49);
        gold.lineStyle(4, 0xffd700, 1);
        gold.strokeCircle(cx, coreY, 10);
        this.tweens.add({
          targets: gold,
          alpha: 0,
          duration: 600,
          ease: "Quad.easeOut",
          onUpdate: () => {
            gold.clear();
            gold.lineStyle(4, 0xffd700, gold.alpha);
            const r = 10 + (1 - gold.alpha) * 80;
            gold.strokeCircle(cx, coreY, r);
          },
          onComplete: () => gold.destroy(),
        });
        this.cameras.main.shake(300, 0.006);
      }
      // 缩放回弹过头 + 落地
      this.tweens.add({
        targets: newPlant,
        scaleX: baseX * 1.22,
        scaleY: baseY * 1.22,
        duration: 130,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: newPlant,
            scaleX: baseX,
            scaleY: baseY,
            alpha: 1,
            duration: 240,
            ease: "Back.easeOut",
          });
        },
      });
      this.sfx.place();
      this.sfx.explode();
    });
  }

  private dig(row: number, col: number): void {
    const occ = this.grid.at(row, col);
    if (!occ) return;
    const p = occ as Plant;
    // 立即释放格子 + 走统一死亡回收，避免同帧重新种植被当成"融合目标"静默拦截
    this.grid.removeAt(row, col);
    p.kill();
    if (!p.deathStarted) {
      p.deathStarted = true;
      p.playDeath(this, () => {});
    }
    this.sfx.shovel();
    this.select(null);
    bus.emit("card-selected", null);
  }

  private select(kind: PlantKind | "shovel" | null): void {
    this.selected = kind;
    if (!kind) this.ghost?.setVisible(false);
  }

  // ---------- 波次与出怪 ----------

  private startNextWave(): void {
    const def = this.wm.startNextWave();
    if (!def) return;
    bus.emit("wave", this.wm.currentWave, this.wm.waveCount);
    if (def.huge) {
      bus.emit("banner", "一大波僵尸正在接近！");
      this.sfx.waveHorn();
      // 大波特殊效果：屏幕震动增强紧张感
      this.cameras.main.shake(500, 0.005);
    } else {
      bus.emit("toast", `第 ${this.wm.currentWave} 波来袭`);
    }
    const interval = def.huge ? def.intervalMs / 2.5 : def.intervalMs;
    this.spawnTimer?.remove();
    this.spawnTimer = this.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => this.spawnOne(),
    });
    if (def.huge) {
      for (let i = 0; i < 3; i++) this.spawnOne();
    }
  }

  private spawnOne(): void {
    const kind = this.wm.pullNext();
    if (!kind) {
      this.spawnTimer?.remove();
      this.spawnTimer = null;
      return;
    }
    const row = this.pickRow();
    const s = waveScale(this.wm.currentWave, this.wm.waveCount);
    // 关卡速度倍率：夜间提速；泳池水行减速
    const levelMul = this.level.zombieSpeedMul ?? 1;
    const waterMul = this.level.waterRows?.includes(row) ? WATER_SLOW_MUL : 1;

    // 特殊僵尸出生位置
    let spawnX = W + 30;
    let spawnY = this.cellBottom(row) + 2;

    // 矿工僵尸：从屏幕左侧出现，绕过防线
    if (kind === "digger") {
      spawnX = LAWN_X - 30;
    }
    // 气球僵尸：从屏幕顶部飘入，无视地面植物
    if (kind === "balloon") {
      spawnY = -50;
    }
    // 投石车僵尸：从屏幕右侧较远位置出现，给玩家更多反应时间
    if (kind === "catapult") {
      spawnX = W + 80;
    }

    this.zombies.push(
      new Zombie(this, row, spawnX, spawnY, kind, this, {
        hpMul: s.hpMul,
        armorMul: s.armorMul,
        speedMul: s.speedMul * levelMul * waterMul,
      })
    );
  }

  private pickRow(): number {
    let row = Math.floor(Math.random() * ROWS);
    if (row === this.lastSpawnRow) row = Math.floor(Math.random() * ROWS);
    this.lastSpawnRow = row;
    return row;
  }

  /** 召唤伴舞僵尸：舞王僵尸技能调用，血量减半 */
  summonZombie(row: number, x: number, kind: ZombieKind): void {
    const s = waveScale(this.wm.currentWave, this.wm.waveCount);
    this.zombies.push(
      new Zombie(this, row, x, this.cellBottom(row) + 2, kind, this, {
        hpMul: s.hpMul * 0.5,
        armorMul: s.armorMul,
        speedMul: s.speedMul,
      })
    );
  }

  /** 传送带定期入卡：入队并广播新列表给 UI */
  private beltSpawn(): void {
    if (this.ended) return;
    this.conveyor.spawn();
    bus.emit("belt", this.conveyor.snapshot());
  }

  private checkWaveFlow(): void {
    if (!this.wm.queueEmpty || this.zombies.some((z) => !z.isDying)) return;
    if (this.wm.lastWaveStarted && this.wm.allSpawned) {
      this.victory();
      return;
    }
    if (!this.betweenWaves) {
      this.betweenWaves = true;
      this.time.delayedCall(2400, () => {
        this.startNextWave();
        this.betweenWaves = false;
      });
    }
  }

  // ---------- 胜负 ----------

  private gameOver(): void {
    if (this.ended) return;
    this.ended = true;
    this.spawnTimer?.remove();
    this.sfx.lose();
    bus.emit("game-over", this.wm.currentWave);
  }

  private victory(): void {
    if (this.ended) return;
    this.ended = true;
    this.spawnTimer?.remove();
    this.sfx.win();
    bus.emit("victory");
  }

  private onRestart(): void {
    this.scene.restart();
  }

  /** 结算「选关」：停掉 UI 场景并回到选关场景 */
  private onLevelSelect(): void {
    this.scene.stop("ui");
    this.scene.start("select");
  }

  private startSlowmo(): void {
    this.slowFactor = SLOWMO_FACTOR;
    this.tweens.timeScale = SLOWMO_FACTOR;
    this.time.delayedCall(SLOWMO_MS, () => {
      this.slowFactor = 1;
      this.tweens.timeScale = 1;
    });
  }

  // ---------- PlantCtx ----------

  hasZombieInRow(row: number, fromX: number): boolean {
    return this.zombies.some(
      (z) => z.row === row && !z.isDying && z.x > fromX - 6 && z.x < W - 4
    );
  }

  hasZombieNear(row: number, x: number, radius: number): boolean {
    return this.zombies.some(
      (z) => z.row === row && !z.isDying && Math.abs(z.x - x) < radius
    );
  }

  hasAirTargetInRow(row: number, fromX: number): boolean {
    return this.zombies.some(
      (z) => z.row === row && !z.isDying && z.isFlying && z.x > fromX - 6 && z.x < W - 4
    );
  }

  damageZombiesInRadius(row: number, x: number, radius: number, dmg: number): void {
    for (const z of this.zombies) {
      if (z.row === row && !z.isDying && Math.abs(z.x - x) < radius) {
        z.takeDamage(dmg);
      }
    }
  }

  knockbackZombie(zombie: Zombie, distance: number): void {
    const targetX = Math.min(zombie.x + distance, W - 40);
    this.tweens.add({
      targets: zombie,
      x: targetX,
      duration: 200,
      ease: "Quad.easeOut",
    });
  }

  stunZombie(zombie: Zombie, durationMs: number): void {
    const origMul = (zombie as unknown as Record<string, number>)["speedMul"] ?? 1;
    (zombie as unknown as Record<string, number>)["speedMul"] = 0;
    zombie.setTint(0xffff00);
    this.time.delayedCall(durationMs, () => {
      if (zombie.active && !zombie.isDying) {
        (zombie as unknown as Record<string, number>)["speedMul"] = origMul;
        zombie.clearTint();
      }
    });
  }

  spawnBounceBullet(fromX: number, fromY: number, row: number, dmg: number, kind: Projectile, opts: BulletOpts = {}): void {
    const targets = this.zombies.filter((z) => !z.isDying && Math.abs(z.row - row) <= 1);
    if (targets.length === 0) return;
    // 找最近的目标
    let closest: Zombie | null = null;
    let minDist = Infinity;
    for (const z of targets) {
      const d = Math.abs(z.x - fromX);
      if (d < minDist && d < 120) {
        minDist = d;
        closest = z;
      }
    }
    if (!closest) return;
    const bullet = new Bullet(this, row, fromX, fromY, kind, dmg, false, { ...opts, bounceCount: 0 });
    this.add.existing(bullet);
  }

  spawnBullet(
    row: number,
    x: number,
    y: number,
    kind: Projectile,
    dmg: number,
    slow: boolean,
    opts: BulletOpts = {}
  ): void {
    // 检查是否有空中目标：有则标记对空攻击，伤害加倍
    if (this.hasAirTarget(row, x)) {
      dmg *= 2;
      opts.isAirAttack = true;
    }
    // 弹道沿用目标行的标准高度而非发射方植物本体高度——三线射手三管各打一行，
    // 若共用炮口 y 会三颗叠在同一高度，视觉上"只发射一颗"
    this.bullets.push(new Bullet(this, row, x, this.cellBottom(row) - 62, kind, dmg, slow, opts));
  }

  /** 大嘴花吞噬：咬住范围内最靠前的一只僵尸 */
  chomperBite(row: number, x: number, rangeCells: number, dmg: number): boolean {
    let best: Zombie | null = null;
    for (const z of this.zombies) {
      if (z.isDying || z.row !== row) continue;
      if (Math.abs(z.x - x) < rangeCells * 90 && (!best || z.x < best.x)) best = z;
    }
    if (!best) return false;
    best.takeDamage(dmg);
    this.fx.hitBurst(best.x, best.y - 50, 0xa8e87c);
    this.fx.damageText(best.x, best.y - 70, dmg, true);
    if (best.hp <= 0) this.fx.shatter(best.x, best.y - 40);
    return true;
  }

  /** 射手发射瞬间的炮口闪光：通用绿光 / 寒冰蓝光+冰雾 / 三线橙绿 / 西瓜青蓝 */
  onPlantShoot(kind: PlantKind, x: number, y: number): void {
    if (kind === "snowpea") {
      this.fx.muzzleFlash(x, y, 0x9fe8ff);
      const mist = this.add.particles(x, y, "dot", {
        speed: { min: 20, max: 70 },
        angle: { min: -30, max: 30 },
        lifespan: 260,
        scale: { start: 0.9, end: 0 },
        tint: 0xd8f4ff,
        alpha: { start: 0.7, end: 0 },
        emitting: false,
      });
      mist.explode(5);
      mist.setDepth(44);
      this.time.delayedCall(500, () => mist.destroy());
    } else if (kind === "wintermelon") {
      this.fx.muzzleFlash(x, y, 0x7cd0e8);
      this.fx.frostPuff(x, y);
    } else if (kind === "threepeater") {
      this.fx.muzzleFlash(x, y, 0x8ae06a);
      this.fx.muzzleFlash(x, y, 0xc9e3ff);
    } else if (kind === "peashooter") {
      this.fx.muzzleFlash(x, y, 0xb8f08a);
    } else if (kind === "flakcannon") {
      this.fx.muzzleFlash(x, y, 0x808080);
    } else if (kind === "cactusball") {
      this.fx.muzzleFlash(x, y, 0x32cd32);
    } else if (kind === "fireflower") {
      this.fx.muzzleFlash(x, y, 0xff4500);
    }
  }

  explodeAt(row: number, col: number, radiusCells: number, dmg: number): void {
    const center = this.grid.cellCenter(row, col);
    const radius = radiusCells * CELL_W;
    const boom = this.add.sprite(center.x, center.y - 20, "boom").setDepth(50);
    boom.setDisplaySize(radius * 2, radius * 2);
    this.tweens.add({
      targets: boom,
      scale: boom.scale * 1.25,
      alpha: 0,
      duration: 420,
      ease: "Quad.easeOut",
      onComplete: () => boom.destroy(),
    });
    this.fx.shockwave(center.x, center.y - 20, radius * 2.4);
    this.fx.flash(0.32);
    this.fx.scorch(center.x, this.cellBottom(row) - 10, radius * 1.9, 46);
    this.cameras.main.shake(200, 0.008);
    this.startSlowmo();
    this.hitstopUntil = this.time.now + HITSTOP_BOOM_MS;
    for (const z of this.zombies) {
      if (z.isDying) continue;
      const dz = Math.hypot(z.x - center.x, z.y - 50 - center.y);
      if (dz < radius) z.takeDamage(dmg);
    }
    this.sfx.explode();
  }

  detonateMine(plant: Plant): void {
    for (const z of this.zombies) {
      if (!z.isDying && z.row === plant.row && Math.abs(z.x - plant.x) < 52) {
        z.takeDamage(PLANT_BEHAVIORS.potatomine.atk ?? 9999);
      }
    }
    const boom = this.add.sprite(plant.x, plant.y - 24, "boom").setDepth(50);
    boom.setDisplaySize(90, 90);
    this.tweens.add({
      targets: boom,
      alpha: 0,
      scale: boom.scale * 1.3,
      duration: 320,
      onComplete: () => boom.destroy(),
    });
    this.fx.shockwave(plant.x, plant.y - 24, 150);
    this.fx.scorch(plant.x, plant.y + 6, 110, 34);
    this.cameras.main.shake(140, 0.005);
    this.hitstopUntil = this.time.now + HITSTOP_KILL_MS;
    this.sfx.explode();
  }

  /** 火爆辣椒：整行火焰清屏 */
  burnRow(row: number, dmg: number): void {
    const y = this.cellCenterY(row) - 20;
    this.fx.fireSweep(LAWN_X + 20, y, COLS * CELL_W - 40, () => {});
    this.fx.scorch(LAWN_X + COLS * CELL_W / 2, this.cellBottom(row) - 10, COLS * CELL_W - 30, 44, 0x7a2408);
    this.fx.flash(0.22);
    this.cameras.main.shake(220, 0.007);
    this.startSlowmo();
    this.hitstopUntil = this.time.now + HITSTOP_BOOM_MS;
    for (const z of this.zombies) {
      if (!z.isDying && z.row === row) z.takeDamage(dmg);
    }
    this.sfx.jalapeno();
  }

  onPlantDead(plant: Plant): void {
    this.grid.removeAt(plant.row, plant.col);
    this.plants = this.plants.filter((p) => p !== plant);
  }

  // ---------- ZombieCtx ----------

  plantInFront(row: number, mouthX: number) {
    return this.grid.plantInFront(row, mouthX) as Plant | undefined;
  }

  hasAirTarget(row: number, x: number): boolean {
    return this.zombies.some((z) => z.row === row && !z.isDying && z.x > x && z.isFlying);
  }

  requestMower(row: number, zombie: Zombie): void {
    if (this.ended) return;
    const mower = this.mowers[row];
    if (mower && !mower.used) {
      mower.trigger();
      this.sfx.mower();
      return;
    }
    if (zombie.x < HOUSE_LINE_X) this.gameOver();
  }

  onBulletHit(
    x: number,
    y: number,
    kind: Projectile,
    dmg: number,
    killed: boolean,
    opts: BulletOpts = {}
  ): void {
    // ─── 形态专属命中特效 ───
    if (kind === "fireball") {
      // 火球爆炸：橙红粒子爆 + 冲击波 + 灼烧地面
      this.fx.hitBurst(x, y, 0xff6b3d);
      this.fx.shockwave(x, y, 80);
      this.fx.scorch(x, y + 8, 60, 12, 0xff4400);
      this.cameras.main.shake(60, 0.003);
    } else if (kind === "axe") {
      // 冰斧：蓝色碎片飞散 + 减速光环
      this.fx.hitBurst(x, y, 0x88ccff);
      const iceRing = this.add.image(x, y, "ring").setTint(0x88ccff).setDepth(44).setAlpha(0.6).setScale(0.4);
      this.tweens.add({
        targets: iceRing,
        scale: { from: 0.4, to: 1.0 },
        alpha: { from: 0.6, to: 0 },
        duration: 350,
        ease: "Quad.easeOut",
        onComplete: () => iceRing.destroy(),
      });
    } else if (kind === "chain") {
      // 闪电链：黄色电弧爆 + 多段闪击
      this.fx.hitBurst(x, y, 0xffee44);
      this.fx.shockwave(x, y, 60);
      this.cameras.main.shake(40, 0.002);
    } else if (kind === "beam") {
      // 激光：红色贯穿线 + 闪白
      this.fx.hitBurst(x, y, 0xff4444);
      const beamLine = this.add.graphics().setDepth(44);
      beamLine.lineStyle(4, 0xff2222, 0.8);
      beamLine.lineBetween(x - 40, y, x + 40, y);
      beamLine.lineStyle(2, 0xffffff, 0.6);
      beamLine.lineBetween(x - 30, y, x + 30, y);
      this.tweens.add({
        targets: beamLine,
        alpha: 0,
        duration: 200,
        onComplete: () => beamLine.destroy(),
      });
    } else if (kind === "missile") {
      // 导弹爆炸：大范围橙红爆炸 + 冲击波 + 震屏
      this.fx.hitBurst(x, y, 0xff8844);
      this.fx.shockwave(x, y, 120);
      this.fx.scorch(x, y + 8, 80, 16, 0xcc4400);
      this.fx.flash(0.15);
      this.cameras.main.shake(120, 0.006);
      this.hitstopUntil = Math.max(this.hitstopUntil, this.time.now + 60);
    } else if (kind === "cannonball") {
      // 高射炮命中：灰色爆炸 + 冲击波 + 焦痕
      this.fx.hitBurst(x, y, 0x808080);
      this.fx.shockwave(x, y, 80);
      this.fx.scorch(x, y + 8, 60, 12, 0x444444);
      this.cameras.main.shake(60, 0.003);
    } else if (kind === "drone") {
      // 无人机自爆：绿色毒雾爆炸 + 大范围冲击
      this.fx.hitBurst(x, y, 0x44ff88);
      this.fx.shockwave(x, y, 140);
      this.fx.flash(0.2);
      this.cameras.main.shake(150, 0.008);
      this.hitstopUntil = Math.max(this.hitstopUntil, this.time.now + 80);
      // 毒雾残留
      const toxicCloud = this.add.image(x, y, "dot").setTint(0x33aa55).setDepth(44).setAlpha(0.6).setScale(2);
      this.tweens.add({
        targets: toxicCloud,
        scale: { from: 2, to: 3.5 },
        alpha: { from: 0.6, to: 0 },
        duration: 500,
        ease: "Quad.easeOut",
        onComplete: () => toxicCloud.destroy(),
      });
    } else if (kind === "melon" || kind === "wintermelon") {
      this.fx.frostBurst(x, y);
    } else if (kind === "icebolt") {
      this.fx.iceCrystal(x, y);
    } else {
      this.fx.hitBurst(x, y, kind === "icepea" ? 0x9fe8ff : 0xa8e87c);
    }
    if (kind === "icebolt") this.fx.damageText(x, y - 20, dmg, true);
    else this.fx.damageText(x, y - 20, dmg, killed);

    // ─── 技能专属命中特效（12种分明特效） ───

    // 寒霜减速：蓝色冰霜扩散环
    if (opts.freezeMs && opts.freezeMs > 0) {
      const frostRing = this.add.image(x, y, "ring").setTint(0x88ccff).setDepth(44).setAlpha(0.7).setScale(0.3);
      this.tweens.add({
        targets: frostRing,
        scale: { from: 0.3, to: 0.8 },
        alpha: { from: 0.7, to: 0 },
        duration: 400,
        ease: "Quad.easeOut",
        onComplete: () => frostRing.destroy(),
      });
    }

    // 眩晕冲击：黄色星星环绕
    if (opts.stunChance && opts.stunDurationMs) {
      for (let i = 0; i < 3; i++) {
        const star = this.add.text(x, y - 30, "★", { fontSize: "16px", color: "#ffdd00" }).setOrigin(0.5).setDepth(55);
        const angle = (i * 120) * Math.PI / 180;
        this.tweens.add({
          targets: star,
          x: x + Math.cos(angle) * 25,
          y: y - 30 + Math.sin(angle) * 15,
          alpha: { from: 1, to: 0 },
          duration: 800,
          ease: "Quad.easeOut",
          onComplete: () => star.destroy(),
        });
      }
    }

    // 击退风暴：白色冲击波向前推
    if (opts.knockbackChance && opts.knockbackDistance) {
      const pushWave = this.add.graphics().setDepth(44);
      pushWave.lineStyle(3, 0xffffff, 0.8);
      pushWave.beginPath();
      pushWave.moveTo(x, y - 20);
      pushWave.lineTo(x + 40, y - 20);
      pushWave.strokePath();
      this.tweens.add({
        targets: pushWave,
        x: 30,
        alpha: 0,
        duration: 300,
        ease: "Quad.easeOut",
        onComplete: () => pushWave.destroy(),
      });
    }

    // 穿刺射击：白色穿透线
    if (opts.pierceCount && opts.pierceCount > 0) {
      const pierceLine = this.add.graphics().setDepth(44);
      pierceLine.lineStyle(2, 0xffffff, 0.9);
      pierceLine.lineBetween(x - 60, y, x + 60, y);
      this.tweens.add({
        targets: pierceLine,
        alpha: 0,
        duration: 200,
        onComplete: () => pierceLine.destroy(),
      });
    }

    // 弹射闪电：黄色电弧跳转
    if (opts.bounceCount && opts.bounceCount > 0) {
      const arc = this.add.graphics().setDepth(44);
      arc.lineStyle(3, 0xffee44, 0.9);
      const segments = 5;
      arc.beginPath();
      arc.moveTo(x, y);
      for (let i = 1; i <= segments; i++) {
        const sx = x + (i / segments) * 60;
        const sy = y + Phaser.Math.Between(-15, 15);
        arc.lineTo(sx, sy);
      }
      arc.strokePath();
      this.tweens.add({
        targets: arc,
        alpha: 0,
        duration: 250,
        onComplete: () => arc.destroy(),
      });
    }

    // 爆破炸弹：大爆炸特效
    if (opts.explosionRadius && opts.explosionRadius > 0) {
      this.fx.hitBurst(x, y, 0xff6633);
      this.fx.shockwave(x, y, opts.explosionRadius);
      this.fx.scorch(x, y + 8, opts.explosionRadius * 0.6, 12, 0xcc4400);
      this.cameras.main.shake(80, 0.004);
    }

    // 烈焰灼烧：红色火星持续飞散
    if (opts.burnDmg && opts.burnMs && opts.burnMs > 0) {
      const burnEm = this.add.particles(x, y, "dot", {
        speed: { min: 20, max: 60 },
        angle: { min: 200, max: 340 },
        gravityY: -30,
        lifespan: { min: 300, max: 600 },
        scale: { start: 0.8, end: 0 },
        tint: [0xff4400, 0xff8833, 0xffcc00],
        emitting: false,
      }).setDepth(45);
      burnEm.explode(6);
      this.time.delayedCall(700, () => burnEm.destroy());
    }

    // 荆棘反伤：绿色尖刺扩散
    if (opts.knockbackChance && !opts.knockbackDistance) {
      const thornRing = this.add.image(x, y, "ring").setTint(0x44cc44).setDepth(44).setAlpha(0.6).setScale(0.5);
      this.tweens.add({
        targets: thornRing,
        scale: { from: 0.5, to: 1.2 },
        alpha: { from: 0.6, to: 0 },
        duration: 350,
        ease: "Quad.easeOut",
        onComplete: () => thornRing.destroy(),
      });
    }
  }

  /** 冰西瓜范围溅射：命中点周围跨行 AOE + 减速（排除主目标避免双重结算） */
  splashAt(x: number, y: number, row: number, dmg: number, radiusCells: number, exclude: Zombie): void {
    const radius = radiusCells * CELL_W;
    let hit = 0;
    for (const z of this.zombies) {
      if (z === exclude || z.isDying) continue;
      if (Math.abs(z.row - row) <= 1 && Math.abs(z.x - x) < radius) {
        z.takeDamage(dmg, true);
        hit += z.hp + z.armor <= dmg ? 1 : 0;
      }
    }
    if (hit > 0) this.fx.frostBurst(x, y);
  }

  onZombieDeath(zombie: Zombie): void {
    this.fx.shatter(zombie.x, zombie.y);
    this.hitstopUntil = Math.max(this.hitstopUntil, this.time.now + HITSTOP_KILL_MS);
    this.sfx.kill(this.combo + 1);
    // 连杀统计
    const now = this.time.now;
    this.combo = now - this.lastKillAt <= COMBO_WINDOW_MS ? this.combo + 1 : 1;
    this.lastKillAt = now;
    if (this.combo >= 2) {
      bus.emit("combo", { count: this.combo, x: zombie.x, y: zombie.y - 90 });
    }
    if (this.combo % COMBO_REWARD_EVERY === 0) {
      bus.emit("toast", `连击 x${this.combo}！`);
      this.sfx.comboReward();
    }
    this.killed++;
    bus.emit("progress", Math.min(1, this.killed / this.wm.totalZombies));
  }

  // ---------- BulletCtx ----------

  zombiesInRow(row: number): Zombie[] {
    return this.zombies.filter((z) => z.row === row);
  }

  // ---------- 主循环 ----------

  update(time: number, delta: number): void {
    if (this.ended) return;
    // 命中顿帧：短暂冻结战场逻辑，打击更有重量
    if (time < this.hitstopUntil) return;

    const dt = delta * this.slowFactor;
    for (const p of this.plants) p.updateGame(time, this);
    for (const p of this.plants) {
      if (!p.alive && !p.deathStarted) {
        p.deathStarted = true;
        p.playDeath(this, () => {});
      }
    }
    this.plants = this.plants.filter((p) => p.active);

    for (const z of this.zombies) z.updateGame(time, dt);
    this.zombies = this.zombies.filter((z) => z.active);

    for (const b of this.bullets) b.updateGame(dt, this);
    this.bullets = this.bullets.filter((b) => b.active);

    for (const m of this.mowers) if (m) m.updateGame(this.zombies);

    this.checkWaveFlow();
  }

  private cellBottom(row: number): number {
    return LAWN_Y + (row + 1) * CELL_H;
  }

  private cellCenterY(row: number): number {
    return LAWN_Y + row * CELL_H + CELL_H / 2;
  }
}
