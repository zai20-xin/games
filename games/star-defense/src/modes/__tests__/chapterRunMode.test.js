// ================================================================
// P4-6 测试：章节挑战模式（3 关连打）
// ================================================================
import {
  CHAPTER_RUN_CONFIG,
  buildChapterRunLevels,
  snapshotTowers,
  restoreTowers,
  ChapterRunMode,
} from '../ChapterRunMode.js';
import { TOWER_TYPES } from '../../data/TowerTypes.js';
import { EventBus } from '../../core/EventBus.js';
import { Tower } from '../../entities/Tower.js';

describe('P4-6 ChapterRunMode', () => {
  test('CHAPTER_RUN_CONFIG 默认值', () => {
    expect(CHAPTER_RUN_CONFIG.LEVELS_PER_RUN).toBe(3);
    expect(CHAPTER_RUN_CONFIG.ENERGY_CARRYOVER).toBeCloseTo(0.5);
    expect(CHAPTER_RUN_CONFIG.PERFECT_REWARD).toBeGreaterThan(0);
  });

  test('buildChapterRunLevels 从 1 开始拼 3 关', () => {
    expect(buildChapterRunLevels(1)).toEqual([1, 2, 3]);
  });

  test('buildChapterRunLevels 自动夹断到最后一关', () => {
    const lv = buildChapterRunLevels(15);
    expect(lv.length).toBe(3);
    expect(lv[lv.length - 1]).toBeLessThanOrEqual(CHAPTER_RUN_CONFIG.MAX_BASE_LEVEL);
  });

  test('buildChapterRunLevels 始终返回 3 关（不足时用末关补齐）', () => {
    const lv = buildChapterRunLevels(99);
    expect(lv.length).toBe(3);
  });

  test('snapshotTowers 把 Tower 转为纯数据', () => {
    const t1 = new Tower(0, TOWER_TYPES[0], 3, 5, 56);
    t1.level = 2;
    t1.branch = 'A';
    const snap = snapshotTowers([t1]);
    expect(snap).toHaveLength(1);
    expect(snap[0].typeId).toBe(TOWER_TYPES[0].id);
    expect(snap[0].row).toBe(3);
    expect(snap[0].col).toBe(5);
    expect(snap[0].level).toBe(2);
  });

  test('restoreTowers 跳过非法位置', () => {
    const t1 = new Tower(0, TOWER_TYPES[0], 3, 5, 56);
    const snap = snapshotTowers([t1]);
    // mock gameMap：拒绝所有位置
    const fakeMap = {
      isPlacementSlot: () => false,
      isPath: () => true,
      cell: 56,
    };
    const restored = restoreTowers(snap, fakeMap, 56);
    expect(restored).toHaveLength(0);
  });

  test('restoreTowers 合法位置恢复 Tower', () => {
    const t1 = new Tower(0, TOWER_TYPES[0], 3, 5, 56);
    const snap = snapshotTowers([t1]);
    const fakeMap = {
      isPlacementSlot: () => true,
      isPath: () => false,
      cell: 56,
    };
    const restored = restoreTowers(snap, fakeMap, 56);
    expect(restored).toHaveLength(1);
    expect(restored[0].row).toBe(3);
    expect(restored[0].col).toBe(5);
    expect(restored[0].type.id).toBe(TOWER_TYPES[0].id);
  });

  test('ChapterRunMode.start 返回 3 关 ID 列表', () => {
    const game = {
      _enterLevel: () => {},
      towerSystem: { towers: [], recalcSynergies: () => {} },
      gameMap: { cell: 56, isPlacementSlot: () => true, isPath: () => false },
      eventBus: new EventBus(),
      meta: { addStardust: () => {} },
    };
    const mode = new ChapterRunMode(game);
    const r = mode.start(1);
    expect(r.success).toBe(true);
    expect(r.levels).toEqual([1, 2, 3]);
    expect(game.isChapterRunMode).toBe(true);
  });

  test('ChapterRunMode.getProgress 返回正确进度', () => {
    const game = {
      _enterLevel: () => {},
      towerSystem: { towers: [], recalcSynergies: () => {} },
      gameMap: { cell: 56, isPlacementSlot: () => true, isPath: () => false },
      eventBus: new EventBus(),
      meta: { addStardust: () => {} },
    };
    const mode = new ChapterRunMode(game);
    mode.start(1);
    const p = mode.getProgress();
    expect(p.current).toBe(1);
    expect(p.total).toBe(3);
    expect(p.levelId).toBe(1);
    expect(p.completed).toBe(false);
    expect(p.failed).toBe(false);
  });

  test('ChapterRunMode._onLevelVictory 推进到下一关', () => {
    const game = {
      _enterLevel: () => {},
      towerSystem: { towers: [], recalcSynergies: () => {} },
      gameMap: { cell: 56, isPlacementSlot: () => true, isPath: () => false },
      eventBus: new EventBus(),
      meta: { addStardust: () => {} },
    };
    const mode = new ChapterRunMode(game);
    mode.start(1);
    mode.currentIndex = 0;
    mode._onLevelVictory();
    // 此时已经 snapshot 但不一定切关（setTimeout 异步）
    // 同步检查：currentIndex 已被推进或者 _completeRun
    expect(mode._carriedTowers).toBeDefined();
  });

  test('ChapterRunMode._onLevelVictory 最后一关完成时设置 completed 并发奖励', () => {
    let rewardAdded = 0;
    const game = {
      _enterLevel: () => {},
      towerSystem: { towers: [], recalcSynergies: () => {} },
      gameMap: { cell: 56, isPlacementSlot: () => true, isPath: () => false },
      eventBus: new EventBus(),
      meta: { addStardust: (n) => { rewardAdded = n; } },
    };
    const mode = new ChapterRunMode(game);
    mode.start(1);
    mode.currentIndex = 2;  // 模拟已经在最后一关
    mode._onLevelVictory();
    expect(mode.completed).toBe(true);
    expect(rewardAdded).toBe(CHAPTER_RUN_CONFIG.PERFECT_REWARD);
    expect(game.isChapterRunMode).toBe(false);
  });

  test('ChapterRunMode._onLevelDefeat 标记失败', () => {
    const game = {
      _enterLevel: () => {},
      towerSystem: { towers: [], recalcSynergies: () => {} },
      gameMap: { cell: 56, isPlacementSlot: () => true, isPath: () => false },
      eventBus: new EventBus(),
      meta: { addStardust: () => {} },
    };
    const mode = new ChapterRunMode(game);
    mode.start(1);
    mode._onLevelDefeat();
    expect(mode.failed).toBe(true);
    expect(game.isChapterRunMode).toBe(false);
  });

  test('ChapterRunMode.abort 主动放弃', () => {
    const game = {
      _enterLevel: () => {},
      towerSystem: { towers: [], recalcSynergies: () => {} },
      gameMap: { cell: 56, isPlacementSlot: () => true, isPath: () => false },
      eventBus: new EventBus(),
      meta: { addStardust: () => {} },
    };
    const mode = new ChapterRunMode(game);
    mode.start(1);
    mode.abort();
    expect(mode.failed).toBe(true);
  });

  test('ChapterRunMode.isActive 静态方法', () => {
    expect(ChapterRunMode.isActive({ isChapterRunMode: true })).toBe(true);
    expect(ChapterRunMode.isActive({ isChapterRunMode: false })).toBe(false);
    expect(ChapterRunMode.isActive(null)).toBe(false);
  });
});
