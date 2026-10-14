// ================================================================
// 组合效果配置测试（P2-2）
//   - 三塔组合 key 合法性
//   - 小队奖励递增
//   - getTripleSynergyKey / getSquadBonus 边界
// ================================================================

import {
  TRIPLE_SYNERGIES,
  SQUAD_BONUS,
  getTripleSynergyKey,
  getSquadBonus,
} from '../SynergyConfig.js';

describe('triple synergy config', () => {
  test('所有三塔组合 key 排序后 3 个塔种且无重复', () => {
    for (const key of Object.keys(TRIPLE_SYNERGIES)) {
      const types = key.split('+');
      expect(types).toHaveLength(3);
      expect(new Set(types).size).toBe(3);
    }
  });

  test('三塔组合至少 1 个', () => {
    // 防御性断言：避免数据被清空后静默通过
    expect(Object.keys(TRIPLE_SYNERGIES).length).toBeGreaterThanOrEqual(1);
  });

  test('每个三塔组合都有 name / desc / effect / color 字段', () => {
    for (const [key, cfg] of Object.entries(TRIPLE_SYNERGIES)) {
      expect(typeof cfg.name).toBe('string');
      expect(cfg.name.length).toBeGreaterThan(0);
      expect(typeof cfg.desc).toBe('string');
      expect(cfg.desc.length).toBeGreaterThan(0);
      expect(typeof cfg.effect).toBe('string');
      expect(cfg.effect.length).toBeGreaterThan(0);
      expect(typeof cfg.color).toBe('string');
      expect(cfg.color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      // 防止误用 key 当 name
      expect(cfg.name).not.toBe(key);
    }
  });
});

describe('squad bonus config', () => {
  test('小队奖励 count3 < count4 < count5', () => {
    expect(SQUAD_BONUS.count4.mult).toBeGreaterThan(SQUAD_BONUS.count3.mult);
    expect(SQUAD_BONUS.count5.mult).toBeGreaterThan(SQUAD_BONUS.count4.mult);
  });

  test('小队奖励 mult > 1', () => {
    for (const v of Object.values(SQUAD_BONUS)) {
      expect(v.mult).toBeGreaterThan(1);
    }
  });
});

describe('getTripleSynergyKey', () => {
  test('按字母排序拼接 3 个不同塔种', () => {
    expect(getTripleSynergyKey('tesla', 'cryo', 'laser')).toBe('cryo+laser+tesla');
    expect(getTripleSynergyKey('a', 'c', 'b')).toBe('a+b+c');
  });

  test('包含重复塔种返回 null', () => {
    expect(getTripleSynergyKey('laser', 'laser', 'tesla')).toBeNull();
  });

  test('任一参数为空返回 null', () => {
    expect(getTripleSynergyKey('', 'a', 'b')).toBeNull();
    expect(getTripleSynergyKey('a', null, 'b')).toBeNull();
  });

  test('返回 key 命中 TRIPLE_SYNERGIES', () => {
    const key = getTripleSynergyKey('cryo', 'laser', 'tesla');
    expect(TRIPLE_SYNERGIES[key]).toBeDefined();
  });
});

describe('getSquadBonus', () => {
  test('count < 3 无奖励', () => {
    expect(getSquadBonus(0)).toBeNull();
    expect(getSquadBonus(1)).toBeNull();
    expect(getSquadBonus(2)).toBeNull();
  });

  test('count == 3 → count3', () => {
    expect(getSquadBonus(3)).toEqual(SQUAD_BONUS.count3);
  });

  test('count == 4 → count4', () => {
    expect(getSquadBonus(4)).toEqual(SQUAD_BONUS.count4);
  });

  test('count >= 5 → count5', () => {
    expect(getSquadBonus(5)).toEqual(SQUAD_BONUS.count5);
    expect(getSquadBonus(8)).toEqual(SQUAD_BONUS.count5);
  });
});
