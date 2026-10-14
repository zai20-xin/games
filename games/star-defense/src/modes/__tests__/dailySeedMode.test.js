// ================================================================
// P4-5 测试：每日关卡（Daily Seed 挑战）
// ================================================================
import {
  getDailySeed,
  generateDailyMap,
  generateDailyWaves,
  DailySeedMode,
} from '../../modes/DailySeedMode.js';
import { EventBus } from '../../core/EventBus.js';

describe('P4-5 DailySeedMode', () => {
  test('getDailySeed 返回 YYYYMMDD 数字', () => {
    const seed = getDailySeed();
    expect(typeof seed).toBe('number');
    const s = String(seed);
    expect(s.length).toBeGreaterThanOrEqual(8);
  });

  test('generateDailyMap 同样 seed 同样地图', () => {
    const a = generateDailyMap(20260624);
    const b = generateDailyMap(20260624);
    expect(a.path).toEqual(b.path);
    expect(a.cols).toBe(b.cols);
    expect(a.rows).toBe(b.rows);
  });

  test('generateDailyMap 不同 seed 不同地图', () => {
    // 用相差较大的 seed 避免 LCG 巧合产生相同 style
    const a = generateDailyMap(1);
    const b = generateDailyMap(100000);
    expect(JSON.stringify(a.path)).not.toBe(JSON.stringify(b.path));
  });

  test('generateDailyMap 返回 5 波和必要字段', () => {
    const map = generateDailyMap(20260624);
    expect(map.path.length).toBeGreaterThanOrEqual(5);
    expect(map._isDaily).toBe(true);
    expect(map.initHP).toBeGreaterThan(0);
    expect(map.initEnergy).toBeGreaterThanOrEqual(0);
  });

  test('generateDailyWaves 同样 seed 同样波次', () => {
    const a = generateDailyWaves(20260624, () => 1.0);
    const b = generateDailyWaves(20260624, () => 1.0);
    expect(a).toHaveLength(5);
    expect(b).toHaveLength(5);
    expect(a.map(w => w.waveNum)).toEqual(b.map(w => w.waveNum));
    expect(a.map(w => w.enemies.length)).toEqual(b.map(w => w.enemies.length));
  });

  test('generateDailyWaves 最后一波含 boss', () => {
    const waves = generateDailyWaves(20260624, () => 1.0);
    const last = waves[waves.length - 1];
    expect(last.enemies).toContain('boss');
  });

  test('DailySeedMode.start 设置 isDailySeedMode 标记', () => {
    // mock 一个最小 game 对象
    const game = {
      _loadLevel: () => {},
      waveSystem: { setWaves: () => {} },
      eventBus: new EventBus(),
    };
    const mode = new DailySeedMode(game);
    mode.start();
    expect(game.isDailySeedMode).toBe(true);
    expect(game.dailyChallengeRestriction?.type).toBe('daily_seed');
  });
});
