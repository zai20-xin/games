// ================================================================
// P4-5/P4-6 模式接线集成测试
// 验证 Game.js 的 startDailySeedMode / startChapterRunMode / _loadLevel(对象)
// 是否正确创建模式实例、设置状态、隐藏 UI
// ================================================================
import { describe, test, expect, vi, beforeEach } from 'vitest';

// node 环境下 mock 浏览器全局（Game 构造与部分方法会访问）
globalThis.document = {
  getElementById: () => null,
  addEventListener: vi.fn(),
};
globalThis.localStorage = {
  getItem: () => null,
  setItem: vi.fn(),
};

// 通用 stub 工厂：所有方法为 vi.fn（可 spy），字段可读写
const createStub = vi.hoisted(() => {
  return function createStub(initial = {}) {
    const target = { ...initial };
    return new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop];
        if (prop === 'towers') return [];
        if (prop === 'active') return false;
        if (prop === 'waveActive') return false;
        if (prop === 'isMuted') return false;
        if (!t[prop]) t[prop] = vi.fn(() => undefined);
        return t[prop];
      },
      set(t, prop, v) { t[prop] = v; return true; },
    });
  };
});

// mock 两个模式：验证 Game 是否正确调用（模式自身逻辑已有独立测试）
vi.mock('../../modes/DailySeedMode.js', () => ({
  DailySeedMode: class {
    constructor(game) {
      this.game = game;
      this.dailyWaves = [{ waveNum: 1, enemies: ['bug'] }];
    }
    start() {
      this.game.isDailySeedMode = true;
      this.game.dailyChallengeRestriction = { type: 'daily_seed', seed: 1 };
    }
  },
}));

vi.mock('../../modes/ChapterRunMode.js', () => ({
  CHAPTER_RUN_CONFIG: { PERFECT_REWARD: 100 },
  ChapterRunMode: class {
    constructor(game) {
      this.game = game;
      this.completed = false;
      this.failed = false;
    }
    start(startLevelId) {
      this.game.isChapterRunMode = true;
      return { success: true, levels: [startLevelId, startLevelId + 1, startLevelId + 2] };
    }
    abort() {
      this.failed = true;
      this.game.isChapterRunMode = false;
    }
  },
}));

// mock 依赖 DOM/audio/canvas 的系统模块
vi.mock('../../map/GameMap.js', () => ({
  GameMap: class {
    constructor(level) {
      this.level = level;
      this.cols = level.cols;
      this.rows = level.rows;
      this.cell = level.cell;
      this.gridW = level.cols * level.cell;
      this.gridH = level.rows * level.cell;
    }
    isPlacementSlot() { return true; }
    isPath() { return false; }
  },
}));
vi.mock('../../systems/TowerSystem.js', () => ({ TowerSystem: class { constructor() { return createStub(); } } }));
vi.mock('../../systems/EnemySystem.js', () => ({ EnemySystem: class { constructor() { return createStub(); } } }));
vi.mock('../../systems/WaveSystem.js', () => ({ WaveSystem: class { constructor() { return createStub(); } } }));
vi.mock('../../systems/CombatSystem.js', () => ({ CombatSystem: class { constructor() { return createStub(); } } }));
vi.mock('../../systems/EffectSystem.js', () => ({ EffectSystem: class { constructor() { return createStub(); } } }));
vi.mock('../../systems/ScreenShake.js', () => ({ ScreenShake: class { constructor() { return createStub(); } } }));
vi.mock('../../systems/AbilitySystem.js', () => ({ AbilitySystem: class { constructor() { return createStub(); } } }));
vi.mock('../../systems/BossPhaseSystem.js', () => ({ BossPhaseSystem: class { constructor() { return createStub(); } } }));
vi.mock('../../systems/MetaProgression.js', () => ({ MetaProgression: class { constructor() { return createStub({ getStardust: () => 0 }); } } }));
vi.mock('../../systems/AchievementSystem.js', () => ({ AchievementSystem: class { constructor() { return createStub(); } } }));
vi.mock('../../audio/AudioManager.js', () => ({ AudioManager: class { constructor() { return createStub(); } } }));
vi.mock('../../render/Renderer.js', () => ({ Renderer: class { constructor() { return createStub(); } } }));
vi.mock('../../ui/UIManager.js', () => ({ UIManager: class { constructor() { return createStub(); } } }));
vi.mock('../../ui/TowerPanel.js', () => ({ TowerPanel: class { constructor() { return createStub(); } } }));
vi.mock('../../ui/OverlayManager.js', () => ({ OverlayManager: class { constructor() { return createStub(); } } }));
vi.mock('../../ui/LevelSelectManager.js', () => ({ LevelSelectManager: class { constructor() { return createStub(); } } }));
vi.mock('../../ui/UpgradeShop.js', () => ({ UpgradeShop: class { constructor() { return createStub(); } } }));
vi.mock('../../ui/TutorialManager.js', () => ({ TutorialManager: class { constructor() { return createStub(); } } }));
vi.mock('../../ui/UiAnimator.js', () => ({ UiAnimator: class { constructor() { return createStub(); } } }));
vi.mock('../../modes/BattleMode.js', () => ({ BattleMode: class { constructor() { return createStub(); } } }));

import { Game } from '../Game.js';
import { GAME_STATE } from '../Constants.js';
import { DailySeedMode } from '../../modes/DailySeedMode.js';
import { ChapterRunMode } from '../../modes/ChapterRunMode.js';

function makeCanvas() {
  return {
    addEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
}

describe('Game 模式接线（P4-5/P4-6）', () => {
  let canvas;
  beforeEach(() => {
    canvas = makeCanvas();
  });

  test('_loadLevel 接受地图对象（DailySeedMode 契约）', () => {
    const g = new Game(canvas);
    const mapObj = {
      id: -1, name: '每日挑战', cols: 16, rows: 9, cell: 56,
      path: [{ r: 0, c: 15 }], initEnergy: 50, initHP: 20,
      starThresholds: [15, 10, 5], _isDaily: true,
    };
    g._loadLevel(mapObj);
    expect(g.currentLevel).toBe(mapObj);
    expect(g.currentLevelId).toBe(-1);
    expect(g.gameMap).toBeDefined();
    expect(g.gameMap.level).toBe(mapObj);
  });

  test('startDailySeedMode 创建 DailySeedMode 并完整初始化', () => {
    const g = new Game(canvas);
    g.startDailySeedMode();
    expect(g.dailySeedMode).toBeInstanceOf(DailySeedMode);
    expect(g.isDailySeedMode).toBe(true);
    expect(g.state).toBe(GAME_STATE.PLAYING);
    expect(g.waves).toEqual([{ waveNum: 1, enemies: ['bug'] }]);
    expect(g.overlayManager.hide).toHaveBeenCalled();
    expect(g.levelSelectManager.hide).toHaveBeenCalled();
    expect(g.uiManager.update).toHaveBeenCalled();
    expect(g.meta.applyToGame).toHaveBeenCalled();
  });

  test('startChapterRunMode 创建 ChapterRunMode 并从第 1 关启动', () => {
    const g = new Game(canvas);
    g.startChapterRunMode();
    expect(g.chapterRunMode).toBeInstanceOf(ChapterRunMode);
    expect(g.isChapterRunMode).toBe(true);
    expect(g.overlayManager.hide).toHaveBeenCalled();
    expect(g.levelSelectManager.hide).toHaveBeenCalled();
  });

  test('startChapterRunMode 支持指定起始关卡', () => {
    const g = new Game(canvas);
    g.startChapterRunMode(5);
    expect(g.chapterRunMode).toBeInstanceOf(ChapterRunMode);
    expect(g.isChapterRunMode).toBe(true);
  });

  test('_showLevelSelect 退出每日/章节挑战并清理状态', () => {
    const g = new Game(canvas);
    g.startDailySeedMode();
    g.startChapterRunMode();
    g._showLevelSelect();
    expect(g.isDailySeedMode).toBe(false);
    expect(g.chapterRunMode.failed).toBe(true);
    expect(g.isChapterRunMode).toBe(false);
  });
});
