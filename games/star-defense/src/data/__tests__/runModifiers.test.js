// ================================================================
// P2-3 测试：Roguelike 局内词条
// ================================================================
import { MODIFIERS, getModifier, applyModifierEffect, pickRandomModifiers } from '../RunModifiers.js';

describe('P2-3 RunModifiers', () => {
  test('MODIFIERS 至少 8 个', () => {
    expect(MODIFIERS.length).toBeGreaterThanOrEqual(8);
  });

  test('每个 modifier 都有 id/name/desc/effect/icon', () => {
    for (const m of MODIFIERS) {
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
      expect(typeof m.desc).toBe('string');
      expect(m.desc.length).toBeGreaterThan(0);
      expect(typeof m.effect).toBe('object');
      expect(typeof m.icon).toBe('string');
    }
  });

  test('id 唯一', () => {
    const ids = new Set();
    for (const m of MODIFIERS) {
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
    }
  });

  test('getModifier 按 id 查找', () => {
    const m = getModifier('glass_cannon');
    expect(m).not.toBeNull();
    expect(m.id).toBe('glass_cannon');
    expect(getModifier('not_existing')).toBeNull();
  });

  test('applyModifierEffect 合并基础值与 modifier effect', () => {
    const base = { dmgMult: 1, fireRateMult: 1 };
    const out = applyModifierEffect(base, { dmgMult: 1.5 });
    expect(out.dmgMult).toBeCloseTo(1.5);
    expect(out.fireRateMult).toBe(1);
  });

  test('applyModifierEffect 加算字段', () => {
    const out = applyModifierEffect({}, { chainExtra: 2, lifesteal: 5 });
    expect(out.chainExtra).toBe(2);
    expect(out.lifesteal).toBe(5);
  });

  test('pickRandomModifiers 返回 n 个不重复 modifier', () => {
    const choices = pickRandomModifiers(20260624, 3);
    expect(choices).toHaveLength(3);
    const ids = new Set(choices.map(m => m.id));
    expect(ids.size).toBe(3);
  });

  test('pickRandomModifiers 同样种子同样结果（确定性）', () => {
    const a = pickRandomModifiers(12345, 3).map(m => m.id).join(',');
    const b = pickRandomModifiers(12345, 3).map(m => m.id).join(',');
    expect(a).toBe(b);
  });

  test('pickRandomModifiers 不同种子不同结果', () => {
    const a = pickRandomModifiers(1, 3).map(m => m.id).join(',');
    const b = pickRandomModifiers(2, 3).map(m => m.id).join(',');
    expect(a).not.toBe(b);
  });
});
