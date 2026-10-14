// ================================================================
// P4-4 测试：无尽模式（EndlessMode）
// ================================================================
import {
  ENDLESS_DIFFICULTY_MULT,
  ENDLESS_BOSS_INTERVAL,
  ENDLESS_BOSS_POOL,
  ENDLESS_BEST_STORAGE_KEY,
  getEndlessDifficultyMult,
  isEndlessBossWave,
  pickEndlessBossType,
  getEndlessBestWave,
  recordEndlessBest,
  describeEndlessTier,
  EndlessMode,
  _resetEndlessMemBest,
} from '../EndlessMode.js';

describe('P4-4 EndlessMode', () => {
  test('常量定义', () => {
    expect(ENDLESS_DIFFICULTY_MULT).toBeCloseTo(1.3);
    expect(ENDLESS_BOSS_INTERVAL).toBe(50);
    expect(ENDLESS_BOSS_POOL.length).toBeGreaterThanOrEqual(3);
    expect(ENDLESS_BEST_STORAGE_KEY).toBe('star-defense-endless-best');
  });

  test('getEndlessDifficultyMult 每 10 波 ×1.3', () => {
    // 第 1~10 波：1.0
    expect(getEndlessDifficultyMult(1)).toBeCloseTo(1.0);
    expect(getEndlessDifficultyMult(10)).toBeCloseTo(1.0);
    // 第 11~20 波：×1.3
    expect(getEndlessDifficultyMult(11)).toBeCloseTo(1.3);
    expect(getEndlessDifficultyMult(20)).toBeCloseTo(1.3);
    // 第 21~30 波：×1.3^2
    expect(getEndlessDifficultyMult(21)).toBeCloseTo(1.3 * 1.3);
    expect(getEndlessDifficultyMult(30)).toBeCloseTo(1.3 * 1.3);
    // 第 50 波：×1.3^4
    expect(getEndlessDifficultyMult(50)).toBeCloseTo(Math.pow(1.3, 4));
  });

  test('getEndlessDifficultyMult 异常输入', () => {
    expect(getEndlessDifficultyMult(0)).toBe(1);
    expect(getEndlessDifficultyMult(-1)).toBe(1);
    expect(getEndlessDifficultyMult(NaN)).toBe(1);
    expect(getEndlessDifficultyMult(null)).toBe(1);
  });

  test('isEndlessBossWave 仅 50 的倍数返回 true', () => {
    expect(isEndlessBossWave(50)).toBe(true);
    expect(isEndlessBossWave(100)).toBe(true);
    expect(isEndlessBossWave(150)).toBe(true);
    expect(isEndlessBossWave(49)).toBe(false);
    expect(isEndlessBossWave(51)).toBe(false);
    expect(isEndlessBossWave(0)).toBe(false);
    expect(isEndlessBossWave(-50)).toBe(false);
  });

  test('pickEndlessBossType 从池中随机（注入 rng）', () => {
    // 注入固定 rng=0 → 取第一个
    const r0 = pickEndlessBossType(() => 0);
    expect(ENDLESS_BOSS_POOL).toContain(r0);
    // 注入 rng=0.99 → 取最后一个
    const r1 = pickEndlessBossType(() => 0.99);
    expect(ENDLESS_BOSS_POOL).toContain(r1);
  });

  test('getEndlessBestWave 无存档返回 0', () => {
    // 清理 localStorage 和内存缓存
    try { localStorage.removeItem(ENDLESS_BEST_STORAGE_KEY); } catch (e) {}
    _resetEndlessMemBest();
    expect(getEndlessBestWave()).toBe(0);
  });

  test('recordEndlessBest 仅记录更高值', () => {
    try { localStorage.removeItem(ENDLESS_BEST_STORAGE_KEY); } catch (e) {}
    _resetEndlessMemBest();
    const r1 = recordEndlessBest(10);
    expect(r1.best).toBe(10);
    expect(r1.isNewRecord).toBe(true);
    const r2 = recordEndlessBest(20);
    expect(r2.best).toBe(20);
    expect(r2.isNewRecord).toBe(true);
    const r3 = recordEndlessBest(15);  // 小于当前
    expect(r3.best).toBe(20);
    expect(r3.isNewRecord).toBe(false);
    try { localStorage.removeItem(ENDLESS_BEST_STORAGE_KEY); } catch (e) {}
    _resetEndlessMemBest();
  });

  test('describeEndlessTier 文案', () => {
    expect(describeEndlessTier(1)).toContain('1-10');
    expect(describeEndlessTier(11)).toContain('11-20');
    expect(describeEndlessTier(0)).toContain('1-10');  // fallback
  });

  test('EndlessMode 实例化默认字段', () => {
    const m = new EndlessMode();
    expect(m.active).toBe(false);
    expect(m.waveNum).toBe(0);
    expect(m.startEnergy).toBeGreaterThan(0);
    expect(m.startHp).toBeGreaterThan(0);
  });

  test('EndlessMode.start 初始化状态', () => {
    const m = new EndlessMode();
    m.waveNum = 999;
    m.totalKills = 100;
    m.start();
    expect(m.active).toBe(true);
    expect(m.waveNum).toBe(0);
    expect(m.totalKills).toBe(0);
    expect(m.peakDifficultyMult).toBe(1);
  });

  test('EndlessMode.onWaveStart 返回 difficultyMult 与 isBossWave', () => {
    const m = new EndlessMode();
    m.start();
    const r1 = m.onWaveStart(1);
    expect(r1.difficultyMult).toBeCloseTo(1.0);
    expect(r1.isBossWave).toBe(false);
    expect(r1.bossType).toBe(null);

    const r50 = m.onWaveStart(50);
    expect(r50.difficultyMult).toBeCloseTo(Math.pow(1.3, 4));
    expect(r50.isBossWave).toBe(true);
    expect(ENDLESS_BOSS_POOL).toContain(r50.bossType);

    // 同一 Boss 波不重复触发
    const r50_2 = m.onWaveStart(50);
    expect(r50_2.bossType).toBe(null);
  });

  test('EndlessMode.recordKill 累计', () => {
    const m = new EndlessMode();
    m.start();
    m.recordKill(3);
    m.recordKill(2);
    expect(m.totalKills).toBe(5);
  });

  test('EndlessMode.stop 落盘最佳记录', () => {
    try { localStorage.removeItem(ENDLESS_BEST_STORAGE_KEY); } catch (e) {}
    _resetEndlessMemBest();
    const m = new EndlessMode();
    m.start();
    m.onWaveStart(33);
    const r = m.stop();
    expect(m.active).toBe(false);
    expect(r.best).toBeGreaterThanOrEqual(33);
    try { localStorage.removeItem(ENDLESS_BEST_STORAGE_KEY); } catch (e) {}
    _resetEndlessMemBest();
  });
});
