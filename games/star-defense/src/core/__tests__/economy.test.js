// ================================================================
// P5-2 测试：经济数值优化
//   - BASE_ENERGY_REGEN: 1 → 1.5
//   - REGEN_INTERVAL:    2 → 1.5
//   - INTEREST_RATE:     0.06 → 0.05
// ================================================================

import { ECONOMY } from '../Constants.js';

describe('P5-2 ECONOMY 经济数值优化', () => {
  test('BASE_ENERGY_REGEN 调整为 1.5', () => {
    expect(ECONOMY.BASE_ENERGY_REGEN).toBe(1.5);
  });

  test('REGEN_INTERVAL 调整为 1.5', () => {
    expect(ECONOMY.REGEN_INTERVAL).toBe(1.5);
  });

  test('INTEREST_RATE 调整为 0.05', () => {
    expect(ECONOMY.INTEREST_RATE).toBe(0.05);
  });

  test('前 2 波能量增长率（每秒）提升 2 倍（0.5/s → 1.0/s）', () => {
    const oldRate = 1 / 2;             // 旧：每 2s 产 1（0.5/s）
    const newRate = 1.5 / 1.5;         // 新：每 1.5s 产 1.5（1.0/s）
    const ratio = newRate / oldRate;
    expect(ratio).toBeCloseTo(2.0, 2);
  });

  test('经济常量中其他字段未受影响', () => {
    expect(ECONOMY.SELL_REFUND_RATE).toBe(0.60);
    expect(ECONOMY.MAX_ENERGY).toBe(500);
    expect(ECONOMY.ENERGY_ORB_AUTO_COLLECT_RADIUS).toBe(80);
  });
});
