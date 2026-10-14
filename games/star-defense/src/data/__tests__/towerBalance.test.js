// ================================================================
// 塔的"性价比"测试（P5-3）
// 目标：检测是否有"废塔"（性价比过差）或"bug 塔"（性价比过强）
//   - DPS / cost 应落在 [0.3, 1.0] 区间
//   - 满级 (Lv3) 伤害应至少为基础的 2 倍
// ================================================================

import { TOWER_TYPES } from '../TowerTypes.js';
import { TOWER_LEVEL_MULT } from '../../core/Constants.js';

describe('tower balance', () => {
  const attackTowers = TOWER_TYPES.filter(t => t.type === 'attack');

  test('每个攻击塔都存在（DPS/cost 计算前提）', () => {
    // 防御性断言：避免在数据未就绪时静默通过
    expect(attackTowers.length).toBeGreaterThan(0);
  });

  test('每塔 DPS / 费用 比在 0.3 ~ 1.0 之间', () => {
    const offenders = [];
    for (const t of attackTowers) {
      // 防御性断言：保证字段存在，避免 0/0 之类的 NaN
      expect(t.damage).toBeGreaterThan(0);
      expect(t.fireRate).toBeGreaterThan(0);
      expect(t.cost).toBeGreaterThan(0);

      const dps = t.damage / t.fireRate;
      const ratio = dps / t.cost;
      if (ratio < 0.3 || ratio > 1.0) {
        offenders.push({ id: t.id, name: t.name, dps, cost: t.cost, ratio });
      }
    }
    if (offenders.length > 0) {
      // 列出所有失衡塔，方便 Agent A5 调整 TowerTypes.js
      const report = offenders
        .map(o => `  - ${o.id} (${o.name}): DPS=${o.dps.toFixed(2)}, cost=${o.cost}, ratio=${o.ratio.toFixed(3)}`)
        .join('\n');
      throw new Error(`发现 ${offenders.length} 个不平衡塔（DPS/cost 超出 [0.3, 1.0]）:\n${report}`);
    }
  });

  test('满级塔（Lv3）伤害至少为基础的 2 倍', () => {
    const offenders = [];
    for (const t of attackTowers) {
      const l3Mult = TOWER_LEVEL_MULT.DAMAGE(3);
      const l3Damage = t.damage * l3Mult;
      const required = t.damage * 2;
      if (!(l3Damage > required)) {
        offenders.push({ id: t.id, name: t.name, base: t.damage, l3Mult, l3Damage, required });
      }
    }
    if (offenders.length > 0) {
      const report = offenders
        .map(o => `  - ${o.id} (${o.name}): base=${o.base}, L3×${o.l3Mult}=${o.l3Damage}, 需要>${o.required}`)
        .join('\n');
      throw new Error(`发现 ${offenders.length} 个满级伤害不足 2x 的攻击塔:\n${report}`);
    }
  });
});
