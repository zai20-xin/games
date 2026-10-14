// ================================================================
// P2-10 测试：科技树新增 5 个特殊分支
//   - spec_combo / spec_luck / spec_revive / spec_emp / spec_meteor
//   - SPECIAL_TECH_IDS 与 isSpecialTech 辅助函数
// ================================================================

import {
  TECH_TREE,
  SPECIAL_TECH_IDS,
  isSpecialTech,
  findTech,
} from '../TechTree.js';

describe('P2-10 科技树新增 5 个特殊分支', () => {
  test('5 个新科技都存在', () => {
    const ids = ['spec_combo', 'spec_luck', 'spec_revive', 'spec_emp', 'spec_meteor'];
    for (const id of ids) {
      const t = findTech(id);
      expect(t).toBeDefined();
      expect(t.id).toBe(id);
    }
  });

  test('5 个新科技都属于"特殊"分支', () => {
    expect(SPECIAL_TECH_IDS.has('spec_combo')).toBe(true);
    expect(SPECIAL_TECH_IDS.has('spec_luck')).toBe(true);
    expect(SPECIAL_TECH_IDS.has('spec_revive')).toBe(true);
    expect(SPECIAL_TECH_IDS.has('spec_emp')).toBe(true);
    expect(SPECIAL_TECH_IDS.has('spec_meteor')).toBe(true);
  });

  test('isSpecialTech 行为正确', () => {
    expect(isSpecialTech('spec_combo')).toBe(true);
    expect(isSpecialTech('spec_meteor')).toBe(true);
    expect(isSpecialTech('start_energy')).toBe(false);
    expect(isSpecialTech('tower_damage')).toBe(false);
    expect(isSpecialTech('unknown_id')).toBe(false);
  });

  test('spec_combo 字段定义正确', () => {
    const t = findTech('spec_combo');
    expect(t.effect.comboBoost).toBe(0.25);
    expect(t.maxLvl).toBe(3);
    expect(t.cost).toBe(250);
  });

  test('spec_luck 字段定义正确', () => {
    const t = findTech('spec_luck');
    expect(t.effect.chestLuckBonus).toBe(0.2);
    expect(t.maxLvl).toBe(3);
  });

  test('spec_revive 字段定义正确', () => {
    const t = findTech('spec_revive');
    expect(t.effect.autoRevive).toBe(1);
    expect(t.maxLvl).toBe(2);
  });

  test('spec_emp 字段定义正确（单次购买）', () => {
    const t = findTech('spec_emp');
    expect(t.effect.autoEmp).toBe(1);
    expect(t.maxLvl).toBe(1);
  });

  test('spec_meteor 字段定义正确（单次购买）', () => {
    const t = findTech('spec_meteor');
    expect(t.effect.autoMeteor).toBe(1);
    expect(t.maxLvl).toBe(1);
  });

  test('科技总数（原有 9 + 新增 5 = 14）', () => {
    expect(TECH_TREE.length).toBeGreaterThanOrEqual(14);
  });

  test('每个科技都有必需字段 (id/name/cost/icon/effect)', () => {
    for (const t of TECH_TREE) {
      expect(typeof t.id).toBe('string');
      expect(t.id.length).toBeGreaterThan(0);
      expect(typeof t.name).toBe('string');
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.cost).toBe('number');
      expect(t.cost).toBeGreaterThan(0);
      expect(typeof t.icon).toBe('string');
      expect(t.effect).toBeDefined();
      expect(typeof t.effect).toBe('object');
    }
  });

  test('科技 id 唯一', () => {
    const ids = new Set();
    const dups = [];
    for (const t of TECH_TREE) {
      if (ids.has(t.id)) dups.push(t.id);
      ids.add(t.id);
    }
    expect(dups).toEqual([]);
  });
});
