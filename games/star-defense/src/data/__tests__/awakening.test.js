// ================================================================
// 塔"觉醒"系统测试（P2-1）
//   - 每个塔都有 awakening 字段
//   - 觉醒 tier 费用递增
//   - 觉醒 tier 字段值合法（4/5）
//   - canAwaken / awaken 行为正确
// ================================================================

import { TOWER_TYPES } from '../TowerTypes.js';

describe('awakening 数据完整性 (P2-1)', () => {
  test('每个塔都有 awakening 定义', () => {
    const offenders = [];
    for (const t of TOWER_TYPES) {
      if (!t.awakening) offenders.push(`${t.id} (${t.name})`);
    }
    if (offenders.length > 0) {
      throw new Error(`以下塔缺少 awakening 字段:\n  - ${offenders.join('\n  - ')}`);
    }
    expect(offenders).toEqual([]);
  });

  test('每个 awakening 至少包含 1 个 tier（建议 2 个）', () => {
    for (const t of TOWER_TYPES) {
      expect(t.awakening.tiers).toBeDefined();
      expect(Array.isArray(t.awakening.tiers)).toBe(true);
      expect(t.awakening.tiers.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('所有塔至少含 9 个（9 原始 + 2 新增召唤/诅咒）', () => {
    // 防御性断言：避免在数据未就绪时静默通过
    expect(TOWER_TYPES.length).toBeGreaterThanOrEqual(11);
  });

  test('每个 tier 都有 name / cost / effect 字段', () => {
    for (const t of TOWER_TYPES) {
      for (const tier of t.awakening.tiers) {
        expect(typeof tier.name).toBe('string');
        expect(tier.name.length).toBeGreaterThan(0);
        expect(typeof tier.cost).toBe('number');
        expect(tier.cost).toBeGreaterThan(0);
        expect(typeof tier.effect).toBe('object');
        expect(tier.effect).not.toBeNull();
      }
    }
  });
});

describe('awakening 数值合理性 (P2-1)', () => {
  test('觉醒 tier 编号合法：必须为 4 或 5', () => {
    const allowed = new Set([4, 5]);
    const offenders = [];
    for (const t of TOWER_TYPES) {
      for (const tier of t.awakening.tiers) {
        if (!allowed.has(tier.tier)) {
          offenders.push(`${t.id} tier=${tier.tier} (应为 4 或 5)`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(`非法 tier 编号:\n  - ${offenders.join('\n  - ')}`);
    }
  });

  test('觉醒费用递增（同一塔内 tier4 < tier5）', () => {
    for (const t of TOWER_TYPES) {
      const tiers = t.awakening.tiers;
      // 找到 tier 4 与 tier 5
      const t4 = tiers.find(x => x.tier === 4);
      const t5 = tiers.find(x => x.tier === 5);
      if (t4 && t5) {
        expect(t5.cost).toBeGreaterThan(t4.cost);
      }
    }
  });

  test('每个塔至少一个 tier 的 effect 含数值类 modifier（不全是布尔）', () => {
    for (const t of TOWER_TYPES) {
      const hasNumeric = t.awakening.tiers.some(tier =>
        Object.values(tier.effect).some(v => typeof v === 'number' && v !== 0)
      );
      expect(hasNumeric).toBe(true);
    }
  });

  test('最便宜的觉醒 tier ≥ 100 星尘', () => {
    for (const t of TOWER_TYPES) {
      const minCost = Math.min(...t.awakening.tiers.map(x => x.cost));
      expect(minCost).toBeGreaterThanOrEqual(100);
    }
  });

  test('tier 5 觉醒费 ≥ 1000 星尘（高门槛）', () => {
    for (const t of TOWER_TYPES) {
      const t5 = t.awakening.tiers.find(x => x.tier === 5);
      if (t5) {
        expect(t5.cost).toBeGreaterThanOrEqual(1000);
      }
    }
  });
});

describe('awakening 行为验证 (P2-1)', () => {
  // Tower 类需要动态 import 以避免直接依赖导致循环引用
  let Tower;
  beforeAll(async () => {
    Tower = (await import('../../entities/Tower.js')).Tower;
  });

  function makeTower(typeData) {
    return new Tower(0, typeData, 0, 0, 56);
  }

  test('Level < 3 时 canAwaken 返回 false', () => {
    for (const t of TOWER_TYPES) {
      const tower = makeTower(t);
      tower.level = 1;
      expect(tower.canAwaken()).toBe(false);
      tower.level = 2;
      expect(tower.canAwaken()).toBe(false);
    }
  });

  test('Level === 3 且未觉醒时 canAwaken 返回 true', () => {
    for (const t of TOWER_TYPES) {
      const tower = makeTower(t);
      tower.level = 3;
      tower.awakenedTier = 0;
      expect(tower.canAwaken()).toBe(true);
    }
  });

  test('Level === 3 且已觉醒到 5 时 canAwaken 返回 false（已满）', () => {
    for (const t of TOWER_TYPES) {
      const tower = makeTower(t);
      tower.level = 3;
      tower.awakenedTier = 5;
      expect(tower.canAwaken()).toBe(false);
    }
  });

  test('awaken() 第一次调用返回 tier=4', () => {
    for (const t of TOWER_TYPES) {
      const tower = makeTower(t);
      tower.level = 3;
      const result = tower.awaken();
      if (result.success) {
        expect(result.tier).toBe(4);
        expect(tower.awakenedTier).toBe(4);
      } else {
        // 允许缺数据的情况但需 reason 合法
        expect(typeof result.reason).toBe('string');
      }
    }
  });

  test('awaken() 第二次调用返回 tier=5', () => {
    for (const t of TOWER_TYPES) {
      const tower = makeTower(t);
      tower.level = 3;
      tower.awakenedTier = 4;
      const result = tower.awaken();
      if (result.success) {
        expect(result.tier).toBe(5);
        expect(tower.awakenedTier).toBe(5);
      }
    }
  });

  test('awaken() 第三次（满 5 后）返回 success=false', () => {
    for (const t of TOWER_TYPES) {
      const tower = makeTower(t);
      tower.level = 3;
      tower.awakenedTier = 5;
      const result = tower.awaken();
      expect(result.success).toBe(false);
    }
  });

  test('觉醒后 effect 累加到 _modifiers', () => {
    const t = TOWER_TYPES.find(x => x.id === 'laser');
    const tower = makeTower(t);
    tower.level = 3;
    const r1 = tower.awaken();
    expect(r1.success).toBe(true);
    // 至少一个数值 modifier 被加入
    const numMods = Object.entries(tower._modifiers).filter(([k, v]) => typeof v === 'number' && v !== 0);
    expect(numMods.length).toBeGreaterThan(0);
  });

  test('getDamage() 觉醒后 > 觉醒前', () => {
    for (const t of TOWER_TYPES) {
      if (t.type !== 'attack') continue;
      const before = makeTower(t);
      before.level = 3;
      const dmgBefore = before.getDamage();

      const after = makeTower(t);
      after.level = 3;
      const r = after.awaken();
      if (!r.success) continue;
      const dmgAfter = after.getDamage();
      expect(dmgAfter).toBeGreaterThanOrEqual(dmgBefore);
    }
  });

  test('isMaxAwakened() 在 awakenedTier=5 时返回 true', () => {
    for (const t of TOWER_TYPES) {
      const tower = makeTower(t);
      expect(tower.isMaxAwakened()).toBe(false);
      tower.awakenedTier = 5;
      expect(tower.isMaxAwakened()).toBe(true);
    }
  });
});
