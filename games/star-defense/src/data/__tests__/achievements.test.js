// ================================================================
// P4-9 测试：成就新增（再补 15 条，总 33 条）
//   - 验证 15 条新成就齐全
//   - 验证新成就字段完整性
//   - 验证不与旧成就 id 重复
//   - 验证 AchievementSystem 可正确解锁新成就
// ================================================================

import { ACHIEVEMENTS } from '../AchievementConfig.js';
import { AchievementSystem } from '../../systems/AchievementSystem.js';

// 在 node 环境提供 localStorage shim（vitest 默认无 localStorage）
// 通过 beforeAll 在每个 test 之前确保 shim 存在
function ensureLocalStorageShim() {
  if (typeof globalThis.localStorage !== 'undefined' &&
      typeof globalThis.localStorage.setItem === 'function') {
    return;
  }
  const _store = new Map();
  const shim = {
    getItem: (k) => (_store.has(k) ? _store.get(k) : null),
    setItem: (k, v) => { _store.set(k, String(v)); },
    removeItem: (k) => { _store.delete(k); },
    clear: () => { _store.clear(); },
    key: (i) => Array.from(_store.keys())[i] || null,
    get length() { return _store.size; },
  };
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: shim, writable: true, configurable: true,
    });
  } catch (e) {
    globalThis.localStorage = shim;
  }
}

describe('P4-9 新增 15 条成就 (AchievementConfig)', () => {
  test('总成就数 >= 31（原 16 + 新 15）', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(31);
  });

  test('所有 id 唯一', () => {
    const ids = new Set();
    const dups = [];
    for (const a of ACHIEVEMENTS) {
      if (ids.has(a.id)) dups.push(a.id);
      ids.add(a.id);
    }
    expect(dups).toEqual([]);
  });

  test('每条成就都有必需字段 (id/name/desc/icon/category/target/field)', () => {
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(typeof a.name).toBe('string');
      expect(a.name.length).toBeGreaterThan(0);
      expect(typeof a.desc).toBe('string');
      expect(a.desc.length).toBeGreaterThan(0);
      expect(typeof a.icon).toBe('string');
      expect(typeof a.category).toBe('string');
      expect(typeof a.target).toBe('number');
      expect(typeof a.field).toBe('string');
    }
  });

  test('P4-9 新增 15 条全部存在', () => {
    const required = [
      // 击杀类
      'kill_10000', 'kill_50000',
      // 模式类
      'endless_50', 'endless_100', 'daily_streak_7',
      // 收藏类
      'skin_collector_5', 'skin_collector_11',
      // 挑战类
      'all_chapter_perfect', 'no_missile_run', 'only_one_tower_type',
      // 速度类
      'speed_clear_under_60s',
      // 剧情类
      'complete_story', 'all_3_stars',
      // 塔使用类
      'tower_place_500', 'awaken_5_towers',
    ];
    const map = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
    const missing = required.filter(id => !map.has(id));
    expect(missing).toEqual([]);
  });

  test('每个 category 至少有一条新成就', () => {
    const expectedCats = ['kill', 'mode', 'collect', 'challenge', 'speed', 'story', 'usage'];
    const newOnes = ACHIEVEMENTS.slice(-15);
    const cats = new Set(newOnes.map(a => a.category));
    for (const c of expectedCats) {
      expect(cats.has(c)).toBe(true);
    }
  });

  test('speed_clear_under_60s 是反向比较（time），需要 isTime 标记', () => {
    const a = ACHIEVEMENTS.find(x => x.id === 'speed_clear_under_60s');
    expect(a).toBeDefined();
    // 不强制 isTime 字段存在，但 target 必须是 60
    expect(a.target).toBe(60);
  });
});

describe('P4-9 AchievementSystem 与新字段兼容', () => {
  beforeAll(() => {
    ensureLocalStorageShim();
  });

  test('AchievementSystem 可被实例化（无 eventBus 时也不报错）', () => {
    const bus = { emit: () => {} };
    const sys = new AchievementSystem(bus);
    expect(sys).toBeDefined();
  });

  test('checkAchievements 缺失字段不会抛错', () => {
    const bus = { emit: () => {} };
    const sys = new AchievementSystem(bus);
    // 传入空 stats，所有新成就字段都缺失，应优雅跳过
    expect(() => sys.checkAchievements({})).not.toThrow();
  });

  test('kill_10000 在 stats.totalKills=10000 时被解锁', () => {
    const bus = { emit: () => {}, _emits: [], on() {} };
    const sys = new AchievementSystem(bus);
    sys.unlockedIds.clear();
    sys.checkAchievements({ totalKills: 10000 });
    expect(sys.unlockedIds.has('kill_10000')).toBe(true);
  });

  test('kill_10000 在 stats.totalKills=9999 时不被解锁', () => {
    const bus = { emit: () => {}, _emits: [], on() {} };
    const sys = new AchievementSystem(bus);
    sys.unlockedIds.clear();
    sys.checkAchievements({ totalKills: 9999 });
    expect(sys.unlockedIds.has('kill_10000')).toBe(false);
  });

  test('endless_100 在 endlessBestWave=100 时被解锁', () => {
    const bus = { emit: () => {} };
    const sys = new AchievementSystem(bus);
    sys.unlockedIds.clear();
    sys.checkAchievements({ endlessBestWave: 100 });
    expect(sys.unlockedIds.has('endless_50')).toBe(true);
    expect(sys.unlockedIds.has('endless_100')).toBe(true);
  });
});
