import Phaser from "phaser";
import { COMBAT, waveDefFor, type Difficulty, type PetKind } from "../config";

export interface WaveSpawnRequest {
  kind: PetKind;
  count: number;
  intervalMs: number;
  pool: PetKind[];
  huge: boolean;
}

/** 波次导演：开波、间隔、剩余出怪数。不持有实体，只回调 spawn。 */
export class WaveRunner {
  private scene: Phaser.Scene;
  private difficulty: Difficulty = "standard";
  private wave = 0;
  private betweenWaves = true;
  private nextWaveAt = 0;
  private spawnLeft = 0;
  private spawnInterval = 1200;
  private wavePool: PetKind[] = ["cat"];
  private waveTotal = 0;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private onWaveStart: (wave: number, huge: boolean, total: number) => void;
  private onSpawnOne: () => void;
  private onWaveCleared: () => void;

  constructor(
    scene: Phaser.Scene,
    hooks: {
      onWaveStart: (wave: number, huge: boolean, total: number) => void;
      onSpawnOne: () => void;
      onWaveCleared: () => void;
    }
  ) {
    this.scene = scene;
    this.onWaveStart = hooks.onWaveStart;
    this.onSpawnOne = hooks.onSpawnOne;
    this.onWaveCleared = hooks.onWaveCleared;
  }

  reset(difficulty: Difficulty, now: number): void {
    this.difficulty = difficulty;
    this.wave = 0;
    this.betweenWaves = true;
    this.nextWaveAt = now + COMBAT.FIRST_WAVE_DELAY_MS;
    this.spawnLeft = 0;
    this.waveTotal = 0;
    this.spawnTimer?.remove();
    this.spawnTimer = null;
  }

  get currentWave(): number {
    return this.wave;
  }
  get isBetween(): boolean {
    return this.betweenWaves;
  }
  get remaining(): number {
    return this.spawnLeft;
  }
  get total(): number {
    return this.waveTotal;
  }
  get pool(): PetKind[] {
    return this.wavePool;
  }
  get nextAt(): number {
    return this.nextWaveAt;
  }

  /** 倒计时文案用 */
  countdownSec(now: number): number {
    if (!this.betweenWaves) return 0;
    return Math.max(0, Math.ceil((this.nextWaveAt - now) / 1000));
  }

  update(now: number, petsAlive: number): void {
    if (this.spawnLeft <= 0 && petsAlive <= 0) {
      if (!this.betweenWaves) {
        this.betweenWaves = true;
        this.nextWaveAt = now + COMBAT.WAVE_GAP_MS;
        this.onWaveCleared();
      }
    }
    if (this.betweenWaves && now >= this.nextWaveAt && this.spawnLeft <= 0) {
      this.startWave();
    }
  }

  /** 分裂个体不占配额；返回是否允许生成 */
  consumeSpawnQuota(isSplit: boolean): boolean {
    if (isSplit) return true;
    if (this.spawnLeft <= 0) return false;
    this.spawnLeft -= 1;
    return true;
  }

  private startWave(): void {
    this.wave += 1;
    const def = waveDefFor(this.wave, this.difficulty);
    this.wavePool = def.pool;
    this.spawnLeft = def.count;
    this.waveTotal = def.count;
    this.spawnInterval = def.intervalMs;
    this.betweenWaves = false;
    this.onWaveStart(this.wave, def.huge, def.count);

    this.spawnTimer?.remove();
    this.spawnTimer = null;
    this.onSpawnOne();
    const remain = Math.max(0, this.spawnLeft);
    if (remain > 0) {
      this.spawnTimer = this.scene.time.addEvent({
        delay: this.spawnInterval,
        repeat: remain - 1,
        callback: () => this.onSpawnOne(),
      });
    }
  }

  destroy(): void {
    this.spawnTimer?.remove();
    this.spawnTimer = null;
  }
}
