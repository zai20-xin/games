// ================================================================
// P2-7 测试：波次间事件系统
// ================================================================
import { WAVE_EVENTS, pickRandomEvent, getWaveEvent, WAVE_EVENT_IDS } from '../WaveEvents.js';

describe('P2-7 WaveEvents', () => {
  test('WAVE_EVENTS 至少 6 个事件', () => {
    expect(Object.keys(WAVE_EVENTS).length).toBeGreaterThanOrEqual(6);
  });

  test('每个事件有 name/desc/effect/icon/type', () => {
    for (const [id, e] of Object.entries(WAVE_EVENTS)) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.name).toBe('string');
      expect(e.name.length).toBeGreaterThan(0);
      expect(typeof e.desc).toBe('string');
      expect(e.desc.length).toBeGreaterThan(0);
      expect(typeof e.effect).toBe('object');
      expect(typeof e.icon).toBe('string');
      expect(['positive', 'negative', 'neutral']).toContain(e.type);
    }
  });

  test('id 唯一', () => {
    const ids = new Set();
    for (const e of Object.values(WAVE_EVENTS)) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
    }
  });

  test('getWaveEvent 按 id 查找', () => {
    const e = getWaveEvent('merchant');
    expect(e).not.toBeNull();
    expect(e.id).toBe('merchant');
  });

  test('pickRandomEvent 返回有效事件 id', () => {
    for (let i = 0; i < 20; i++) {
      const id = pickRandomEvent(Math.random);
      expect(WAVE_EVENT_IDS).toContain(id);
    }
  });
});
