// ================================================================
// P2-12 测试：失败/重试配置（续命 + 状态保留）
// ================================================================
import { REVIVE_CONFIG, computeReviveRetain, canRevive } from '../ReviveConfig.js';

describe('P2-12 ReviveConfig', () => {
  test('REVIVE_CONFIG 有合理默认值', () => {
    expect(REVIVE_CONFIG.stardustCost).toBeGreaterThan(0);
    expect(REVIVE_CONFIG.maxRevivesPerLevel).toBeGreaterThan(0);
    expect(REVIVE_CONFIG.retainMoneyPercent).toBeGreaterThanOrEqual(0);
    expect(REVIVE_CONFIG.retainMoneyPercent).toBeLessThanOrEqual(1);
    expect(REVIVE_CONFIG.retainHpPercent).toBeGreaterThan(0);
    expect(REVIVE_CONFIG.retainHpPercent).toBeLessThanOrEqual(1);
  });

  test('computeReviveRetain 正常路径：保留 50% 能量 + 30% HP', () => {
    const snapshot = { energy: 100, hp: 20, wave: 3, towers: [{ typeId: 'laser' }] };
    const result = computeReviveRetain(snapshot, 0);
    expect(result.success).toBe(true);
    expect(result.retain.energy).toBe(50);     // 50%
    expect(result.retain.hp).toBe(6);          // 30% of 20
    expect(result.retain.wave).toBe(3);
    expect(result.retain.towers).toHaveLength(1);
    expect(result.usedRevives).toBe(1);
  });

  test('computeReviveRetain 超过 maxRevivesPerLevel 失败', () => {
    const snapshot = { energy: 100, hp: 20, wave: 0, towers: [] };
    const result = computeReviveRetain(snapshot, REVIVE_CONFIG.maxRevivesPerLevel);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('max_revives');
  });

  test('computeReviveRetain HP 至少保留 1', () => {
    const snapshot = { energy: 0, hp: 1, wave: 0, towers: [] };
    const result = computeReviveRetain(snapshot, 0);
    expect(result.retain.hp).toBeGreaterThanOrEqual(1);
  });

  test('canRevive 根据星尘与已用次数判断', () => {
    const profile = { stardust: 200 };
    expect(canRevive(profile, 0)).toBe(true);
    expect(canRevive(profile, REVIVE_CONFIG.maxRevivesPerLevel)).toBe(false);
    expect(canRevive({ stardust: 100 }, 0)).toBe(false);
  });
});
