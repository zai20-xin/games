// ================================================================
// 组合效果强度审计（P5-5）
//   - 2 塔 + 3 塔组合的名称无重复
//   - 描述长度合理（5~40 字）
//   - 关键字段非空
// ================================================================

import { SYNERGIES, TRIPLE_SYNERGIES } from '../SynergyConfig.js';

describe('synergy balance', () => {
  const allSynergies = { ...SYNERGIES, ...TRIPLE_SYNERGIES };

  test('2 塔 + 3 塔组合数量充足（防御性）', () => {
    // SYNERGIES 21 + TRIPLE 4 = 25
    expect(Object.keys(SYNERGIES).length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(TRIPLE_SYNERGIES).length).toBeGreaterThanOrEqual(1);
  });

  test('无组合效果名称重复（2 塔内部）', () => {
    const seen = new Map();
    const dup = [];
    for (const [key, s] of Object.entries(SYNERGIES)) {
      if (seen.has(s.name)) {
        dup.push(`${seen.get(s.name)} 与 ${key} 重名 "${s.name}"`);
      } else {
        seen.set(s.name, key);
      }
    }
    if (dup.length > 0) {
      throw new Error(`SYNERGIES 内部重名:\n  - ${dup.join('\n  - ')}`);
    }
  });

  test('无组合效果名称重复（2 塔 vs 3 塔）', () => {
    const names2 = new Set(Object.values(SYNERGIES).map(s => s.name));
    const dup = [];
    for (const [key, s] of Object.entries(TRIPLE_SYNERGIES)) {
      if (names2.has(s.name)) {
        dup.push(`TRIPLE_SYNERGIES[${key}].name = "${s.name}" 与 2 塔重名`);
      }
    }
    if (dup.length > 0) {
      throw new Error(`2 塔与 3 塔之间重名:\n  - ${dup.join('\n  - ')}`);
    }
  });

  test('3 塔组合内部无重名', () => {
    const seen = new Set();
    const dup = [];
    for (const [key, s] of Object.entries(TRIPLE_SYNERGIES)) {
      if (seen.has(s.name)) {
        dup.push(`"${s.name}" 在 ${key} 重复`);
      } else {
        seen.add(s.name);
      }
    }
    if (dup.length > 0) {
      throw new Error(`TRIPLE_SYNERGIES 内部重名:\n  - ${dup.join('\n  - ')}`);
    }
  });

  test('组合描述长度合理（5 ~ 40 字）', () => {
    const offenders = [];
    for (const [key, s] of Object.entries(allSynergies)) {
      if (typeof s.desc !== 'string') {
        offenders.push(`${key}: desc 非字符串`);
        continue;
      }
      if (s.desc.length < 5 || s.desc.length > 40) {
        offenders.push(`${key}: desc 长度=${s.desc.length} "${s.desc}"`);
      }
    }
    if (offenders.length > 0) {
      throw new Error(`组合描述长度不合法:\n  - ${offenders.join('\n  - ')}`);
    }
  });

  test('每个组合都有 effect 标识', () => {
    const missing = [];
    for (const [key, s] of Object.entries(allSynergies)) {
      if (typeof s.effect !== 'string' || s.effect.length === 0) {
        missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  test('每个组合都有合法 color（hex）', () => {
    const bad = [];
    for (const [key, s] of Object.entries(allSynergies)) {
      if (typeof s.color !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(s.color)) {
        bad.push(`${key}: color=${s.color}`);
      }
    }
    if (bad.length > 0) {
      throw new Error(`组合 color 不合法:\n  - ${bad.join('\n  - ')}`);
    }
  });
});
