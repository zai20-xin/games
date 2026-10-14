import { TOTAL_WAVES, buildWaves, type WaveDef, type ZombieKind } from "../config";

// 纯波次调度：只管队列与进度，不碰 DOM/场景（可单测）
export class WaveManager {
  readonly waves: WaveDef[];
  waveIndex = -1;
  spawnedTotal = 0;
  private queue: ZombieKind[] = [];
  /** 当前波次的出怪池副本，用于大波特殊僵尸抽取 */
  private currentPool: ZombieKind[] = [];

  constructor(totalWaves: number = TOTAL_WAVES, zombiePool?: ZombieKind[]) {
    this.waves = buildWaves(totalWaves, zombiePool);
  }

  get totalZombies(): number {
    return this.waves.reduce((s, w) => s + w.count, 0);
  }

  get waveCount(): number {
    return this.waves.length;
  }

  get currentWave(): number {
    return this.waveIndex + 1;
  }

  get queueEmpty(): boolean {
    return this.queue.length === 0;
  }

  get allSpawned(): boolean {
    return this.spawnedTotal >= this.totalZombies;
  }

  get lastWaveStarted(): boolean {
    return this.waveIndex >= this.waves.length - 1;
  }

  startNextWave(): WaveDef | null {
    if (this.lastWaveStarted) return null;
    this.waveIndex++;
    const def = this.waves[this.waveIndex]!;
    this.currentPool = [...def.pool];
    this.queue = [];
    if (def.huge) this.queue.push("flag");
    const rest: ZombieKind[] = [];
    const restCount = def.count - (def.huge ? 1 : 0);
    for (let i = 0; i < restCount; i++) {
      rest.push(def.pool[Math.floor(Math.random() * def.pool.length)]!);
    }
    // 打乱出场顺序
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = rest[i]!;
      rest[i] = rest[j]!;
      rest[j] = t;
    }
    this.queue.push(...rest);
    return def;
  }

  pullNext(): ZombieKind | undefined {
    const kind = this.queue.shift();
    if (kind) this.spawnedTotal++;

    // 大波特殊机制：每3只出一只特殊僵尸，增加后期压力
    const wave = this.waves[this.waveIndex];
    if (wave?.huge && this.spawnedTotal % 3 === 0 && this.spawnedTotal > 0) {
      const specialKinds: ZombieKind[] = ["giant", "dancer", "digger", "balloon", "catapult"];
      // 只从当前波次已解锁的特殊僵尸中抽取
      const available = specialKinds.filter((k) => this.currentPool.includes(k));
      if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)]!;
      }
    }

    return kind;
  }
}
