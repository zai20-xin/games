import { describe, expect, it } from "vitest";
import {
  HUGE_WAVES,
  TOTAL_WAVES,
  buildWaves,
  waveScale,
} from "../src/config";
import { WaveManager } from "../src/systems/WaveManager";

describe("buildWaves", () => {
  it("生成指定数量的波次", () => {
    expect(buildWaves(10)).toHaveLength(10);
  });

  it("大波只出现在配置的位置且僵尸更多", () => {
    const waves = buildWaves(TOTAL_WAVES);
    waves.forEach((w, i) => {
      expect(w.huge).toBe(HUGE_WAVES.includes(i + 1));
    });
    for (const n of HUGE_WAVES) {
      const base = 4 + n;
      expect(waves[n - 1]!.count).toBeGreaterThan(base);
    }
  });

  it("终局波比普通大波更强（数量更多、间隔更短）", () => {
    const waves = buildWaves(TOTAL_WAVES);
    const mid = waves[HUGE_WAVES[0]! - 1]!;
    const finale = waves[TOTAL_WAVES - 1]!;
    expect(finale.count).toBeGreaterThan(mid.count);
    expect(finale.intervalMs).toBeLessThan(mid.intervalMs);
    expect(waves[TOTAL_WAVES - 2]!.intervalMs).toBeGreaterThan(finale.intervalMs);
  });

  it("僵尸池随波次解锁且后期种类更多", () => {
    const waves = buildWaves(TOTAL_WAVES);
    expect(waves[0]!.pool).toEqual(["basic"]);
    expect(waves[1]!.pool).toContain("cone");
    expect(waves[3]!.pool).toContain("bucket");
    const late = waves[6]!.pool;
    // 后期波次应该包含更多种类
    expect(late.length).toBeGreaterThan(3);
    const finale = waves[TOTAL_WAVES - 1]!;
    // 终局波应该包含所有种类
    expect(finale.pool.length).toBeGreaterThanOrEqual(5);
  });

  it("出怪间隔随波次单调递减", () => {
    const waves = buildWaves(TOTAL_WAVES);
    for (let i = 1; i < waves.length; i++) {
      if (!waves[i]!.huge && !waves[i - 1]!.huge) {
        expect(waves[i]!.intervalMs).toBeLessThanOrEqual(waves[i - 1]!.intervalMs);
      }
    }
  });

  it("自定义出怪池按波次解锁 + 终局护甲加权", () => {
    const pool = ["basic", "cone", "bucket", "runner", "runner"];
    const waves = buildWaves(TOTAL_WAVES, pool);
    expect(waves[0]!.pool).toEqual(["basic"]);
    expect(waves[1]!.pool).toContain("cone");
    expect(waves[3]!.pool).toContain("bucket");
    expect(waves[5]!.pool).toContain("runner");
    const finale = waves[TOTAL_WAVES - 1]!.pool;
    expect(finale.filter((k) => k === "cone" || k === "bucket").length).toBeGreaterThan(
      finale.filter((k) => k === "basic").length
    );
  });

  it("自定义出怪池不含任何已解锁种类时回退 basic", () => {
    const waves = buildWaves(3, ["flag"]);
    expect(waves[0]!.pool).toEqual(["basic"]);
  });
});

describe("waveScale", () => {
  it("血量/护甲/速度随波次单调爬坡", () => {
    const w1 = waveScale(1, 10);
    const w5 = waveScale(5, 10);
    const w10 = waveScale(10, 10);
    expect(w1.hpMul).toBe(1);
    expect(w5.hpMul).toBeGreaterThan(w1.hpMul);
    expect(w10.hpMul).toBeGreaterThan(w5.hpMul);
    expect(w10.armorMul).toBeGreaterThan(w5.armorMul);
    expect(w10.speedMul).toBeGreaterThan(w5.speedMul);
  });

  it("速度爬坡有上限，不失控", () => {
    expect(waveScale(50, 10).speedMul).toBeLessThanOrEqual(1.4);
    expect(waveScale(10, 10).speedMul).toBeCloseTo(1.4, 5);
  });
});

describe("WaveManager", () => {
  it("startNextWave 按顺序推进并在最后一波后返回 null", () => {
    const wm = new WaveManager(3);
    expect(wm.startNextWave()).not.toBeNull();
    expect(wm.currentWave).toBe(1);
    wm.startNextWave();
    wm.startNextWave();
    expect(wm.lastWaveStarted).toBe(true);
    expect(wm.startNextWave()).toBeNull();
  });

  it("pullNext 消耗队列并统计总出怪数", () => {
    const wm = new WaveManager(2);
    const total = wm.totalZombies;
    wm.startNextWave();
    while (!wm.queueEmpty) wm.pullNext();
    wm.startNextWave();
    while (!wm.queueEmpty) wm.pullNext();
    expect(wm.spawnedTotal).toBe(total);
    expect(wm.allSpawned).toBe(true);
    expect(wm.pullNext()).toBeUndefined();
  });

  it("大波首个出怪是旗帜僵尸", () => {
    const wm = new WaveManager(TOTAL_WAVES);
    let def = wm.startNextWave();
    for (let i = 0; i < TOTAL_WAVES; i++) {
      def = wm.startNextWave();
      if (def?.huge) break;
    }
    expect(def?.huge).toBe(true);
    expect(wm.pullNext()).toBe("flag");
  });

  it("大波数量为 count（含旗子占位）", () => {
    const wm = new WaveManager(TOTAL_WAVES);
    wm.startNextWave();
    for (let i = 0; i < 4; i++) wm.startNextWave();
    const def = wm.waves[4]!;
    expect(def.huge).toBe(true);
    let n = 0;
    while (!wm.queueEmpty) {
      wm.pullNext();
      n++;
    }
    expect(n).toBe(def.count);
  });
});
