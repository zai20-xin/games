// ================================================================
// 章节挑战模式（Chapter Run）— P4-6
// 流程：
//   1) 选定 1 个起始关卡，自动拼成 3 关连打（base → base+1 → base+2）
//   2) 每通关 1 关后：保留所有塔 + 50% 能量 + 当前 HP
//   3) 全部 3 关通关给"完美章节"奖励（stardust 100）
//   4) 任意 1 关失败 → 整个章节挑战结束
// 设计：薄包装层，事件驱动衔接 Game 主循环（不修改 Game.js）
// 约束：ChapterConfig 当前每章节只 1 关，所以用 "起始关卡 ID" 拼出 3 关
// ================================================================
import { ALL_LEVELS } from '../data/LevelConfig.js';
import { TOWER_TYPES } from '../data/TowerTypes.js';
import { Tower } from '../entities/Tower.js';

// === 章节挑战配置 ===
export const CHAPTER_RUN_CONFIG = {
  LEVELS_PER_RUN: 3,           // 1 次章节挑战 = 3 关
  ENERGY_CARRYOVER: 0.5,       // 跨关保留 50% 能量
  HP_CARRYOVER: 1.0,           // 跨关保留 100% HP（不重置）
  KILLS_CARRYOVER: false,      // 击杀数不跨关累计
  PERFECT_REWARD: 100,         // "完美章节"星尘奖励
  RUN_PROGRESS_KEY: 'star-defense-chapter-runs',  // 通关记录
  MAX_BASE_LEVEL: 17,          // LEVEL_CONFIG.TOTAL_LEVELS（17 关）
};

/**
 * 给定一个起始关卡 ID，计算章节挑战的 3 关（自动夹断到最后一关）
 * 例：start=1 → [1,2,3]；start=5 → [5,6,7]；start=15 → [15,16,17]
 * @param {number} startLevelId
 * @returns {number[]} 关卡 ID 数组（长度 = LEVELS_PER_RUN）
 */
export function buildChapterRunLevels(startLevelId) {
  const out = [];
  const max = Math.min(CHAPTER_RUN_CONFIG.MAX_BASE_LEVEL, ALL_LEVELS.length);
  for (let i = 0; i < CHAPTER_RUN_CONFIG.LEVELS_PER_RUN; i++) {
    const id = startLevelId + i;
    if (id > max) break;
    if (ALL_LEVELS.find(l => l.id === id)) out.push(id);
  }
  // 不足 3 关时用最后一关补齐（避免空关）
  while (out.length < CHAPTER_RUN_CONFIG.LEVELS_PER_RUN) {
    const last = out[out.length - 1] || max;
    out.push(last);
  }
  return out;
}

/**
 * 把 Tower 对象序列化为可跨关保存的纯数据
 * 不存 cellSize（不同关卡 cell 可能不同）
 * @param {Array} towers
 * @returns {Array}
 */
export function snapshotTowers(towers) {
  if (!Array.isArray(towers)) return [];
  return towers.map(t => ({
    typeId: t.type?.id || t.typeId,        // 塔类型 id
    typeIndex: t.typeIndex,                // 塔类型索引
    row: t.row,
    col: t.col,
    level: t.level || 1,
    branch: t.branch || null,
    branchUpgrades: t.branchUpgrades || 0,
    chosenSpec: t.chosenSpec || null,
    specLevel: t.specLevel || 0,
    awakenedTier: t.awakenedTier || 0,
    skin: t.skin || null,
    totalInvested: t.totalInvested || (t.type?.cost || 0),
  })).filter(s => s.typeId);
}

/**
 * 把快照反序列化回 Tower 对象数组
 * 跳过那些在新关卡中不是合法放置位的位置
 * @param {Array} snapshots
 * @param {Object} gameMap - 目标关卡的 gameMap（用于 isPlacementSlot）
 * @param {number} cellSize - 新关卡格子大小
 * @returns {Array<Tower>}
 */
export function restoreTowers(snapshots, gameMap, cellSize) {
  if (!Array.isArray(snapshots) || !gameMap) return [];
  const restored = [];
  for (const s of snapshots) {
    if (!s || !s.typeId) continue;
    const typeData = TOWER_TYPES.find(t => t.id === s.typeId);
    if (!typeData) continue;
    const typeIndex = TOWER_TYPES.findIndex(t => t.id === s.typeId);
    if (typeIndex < 0) continue;
    // 检查目标位置是否合法（不是路径、不是已占用）
    if (typeof gameMap.isPlacementSlot === 'function' && !gameMap.isPlacementSlot(s.row, s.col)) {
      continue;
    }
    if (typeof gameMap.isPath === 'function' && gameMap.isPath(s.row, s.col)) {
      continue;
    }
    const tower = new Tower(typeIndex, typeData, s.row, s.col, cellSize);
    // 恢复等级（用 upgrade 提升到目标等级）
    if (s.level && s.level > 1) {
      for (let lv = 1; lv < s.level; lv++) {
        if (tower.isMaxLevel && typeof tower.isMaxLevel === 'function' && tower.isMaxLevel()) break;
        if (typeof tower.upgrade === 'function') {
          tower.upgrade(s.branch || null);
        }
      }
    }
    if (s.chosenSpec) tower.chosenSpec = s.chosenSpec;
    if (s.specLevel) tower.specLevel = s.specLevel;
    if (s.awakenedTier) {
      tower.awakenedTier = s.awakenedTier;
    }
    if (s.skin) tower.skin = s.skin;
    restored.push(tower);
  }
  return restored;
}

export class ChapterRunMode {
  /**
   * @param {Object} game - Game 实例
   */
  constructor(game) {
    this.game = game;
    /** @type {number[]} 3 关 ID */
    this.runLevels = [];
    /** @type {number} 当前在跑第几关（0/1/2） */
    this.currentIndex = 0;
    /** @type {number} 开始时间 */
    this.startedAt = 0;
    /** @type {boolean} 是否已全部完成 */
    this.completed = false;
    /** @type {boolean} 是否失败 */
    this.failed = false;
    /** 跨关状态保留 */
    this._carriedTowers = [];
    this._carriedEnergy = 0;
    this._carriedHp = 0;
    this._carriedKills = 0;
    this._carriedMaxHp = 0;

    // 事件 hook（避免重复注册）
    this._hooked = false;
    this._onVictoryHandler = null;
    this._onDefeatHandler = null;
    this._transitioning = false;
  }

  /**
   * 启动章节挑战
   * @param {number} startLevelId - 起始关卡 ID（章节首关）
   * @returns {{success:boolean, reason?:string, levels?:number[]}}
   */
  start(startLevelId) {
    if (!this.game) return { success: false, reason: 'no_game' };
    this.runLevels = buildChapterRunLevels(startLevelId);
    if (this.runLevels.length === 0) {
      return { success: false, reason: 'no_levels' };
    }
    this.currentIndex = 0;
    this.startedAt = Date.now();
    this.completed = false;
    this.failed = false;
    this._carriedTowers = [];
    this._carriedEnergy = 0;
    this._carriedHp = 0;
    this._carriedKills = 0;
    this._carriedMaxHp = 0;

    this.game.isChapterRunMode = true;

    this._installHooks();
    this._enterCurrent();
    return { success: true, levels: [...this.runLevels] };
  }

  /**
   * 获取当前关卡 ID
   * @returns {number|null}
   */
  getCurrentLevelId() {
    if (this.currentIndex < 0 || this.currentIndex >= this.runLevels.length) return null;
    return this.runLevels[this.currentIndex];
  }

  /**
   * 获取当前进度
   * @returns {{current:number, total:number, levelId:number|null, completed:boolean, failed:boolean}}
   */
  getProgress() {
    return {
      current: this.currentIndex + 1,
      total: this.runLevels.length,
      levelId: this.getCurrentLevelId(),
      completed: this.completed,
      failed: this.failed,
    };
  }

  /**
   * 主动放弃整个章节挑战
   */
  abort() {
    if (this.completed || this.failed) return;
    this.failed = true;
    if (this.game) this.game.isChapterRunMode = false;
    this._uninstallHooks();
  }

  // === 私有方法 ===

  _enterCurrent() {
    const levelId = this.getCurrentLevelId();
    if (levelId == null) return;
    if (typeof this.game._enterLevel === 'function') {
      this.game._enterLevel(levelId);
    }
    // 跨关状态恢复（在 _enterLevel 之后覆盖默认重置值）
    this._applyCarryover();
  }

  /**
   * 把上一关保存的塔/能量/HP 应用到当前关
   * 必须等 _enterLevel 把 towers 清空、energy/hp 重置后再覆盖
   */
  _applyCarryover() {
    if (!this.game) return;
    const ts = this.game.towerSystem;
    const map = this.game.gameMap;
    if (ts && Array.isArray(this._carriedTowers) && this._carriedTowers.length > 0) {
      const cellSize = map?.cell || 56;
      const restored = restoreTowers(this._carriedTowers, map, cellSize);
      // 注入回 towerSystem（绕开 placeTower 的能量扣除）
      if (Array.isArray(ts.towers)) {
        ts.towers = restored.concat(ts.towers);
        // 重新计算组合效果
        if (typeof ts.recalcSynergies === 'function') {
          ts.recalcSynergies();
        }
      }
    }
    // 能量：保留 50%
    this.game.energy = Math.floor(this._carriedEnergy * CHAPTER_RUN_CONFIG.ENERGY_CARRYOVER);
    // HP：保留 100%
    this.game.hp = this._carriedHp;
    this.game.maxHp = this._carriedMaxHp || this._carriedHp;
    // 击杀数不跨关
    this.game.kills = 0;
  }

  /**
   * 在每关胜利后调用：保存状态、推进到下一关
   */
  _onLevelVictory() {
    if (this.completed || this.failed) return;
    if (this._transitioning) return;
    this._transitioning = true;

    // 1) 快照本关的塔/能量/HP
    this._snapshotCurrentState();

    // 2) 是否最后一关？
    if (this.currentIndex >= this.runLevels.length - 1) {
      this._completeRun();
      this._transitioning = false;
      return;
    }

    // 3) 推进到下一关
    this.currentIndex += 1;
    // 等胜利 overlay 播放一下再切关（500ms 跟 _gameOver 一致）
    setTimeout(() => {
      this._enterCurrent();
      this._transitioning = false;
    }, 600);
  }

  /**
   * 关卡失败：结束整个章节挑战
   */
  _onLevelDefeat() {
    if (this.completed || this.failed) return;
    this.failed = true;
    if (this.game) this.game.isChapterRunMode = false;
    this._uninstallHooks();
  }

  /**
   * 快照当前关卡的塔/能量/HP/击杀
   */
  _snapshotCurrentState() {
    if (!this.game) return;
    const ts = this.game.towerSystem;
    this._carriedTowers = ts && Array.isArray(ts.towers) ? snapshotTowers(ts.towers) : [];
    this._carriedEnergy = this.game.energy || 0;
    this._carriedHp = this.game.hp || 0;
    this._carriedMaxHp = this.game.maxHp || this._carriedHp;
    this._carriedKills = this.game.kills || 0;
  }

  /**
   * 全部 3 关完成：发"完美章节"奖励
   */
  _completeRun() {
    this.completed = true;
    if (this.game) this.game.isChapterRunMode = false;
    this._uninstallHooks();

    // 完美章节奖励
    const reward = CHAPTER_RUN_CONFIG.PERFECT_REWARD;
    if (this.game?.meta?.addStardust) {
      this.game.meta.addStardust(reward);
    }
    if (this.game?._refreshStardustHud) {
      this.game._refreshStardustHud();
    }

    // 记录通关历史
    try {
      const key = CHAPTER_RUN_CONFIG.RUN_PROGRESS_KEY;
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      const list = data[this.runLevels[0]] || [];
      list.push({ at: Date.now(), elapsedMs: Date.now() - this.startedAt });
      data[this.runLevels[0]] = list.slice(-20); // 最多保留 20 条
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // 忽略
    }

    // 触发奖励 UI（emit 到 eventBus 让 OverlayManager/UI 监听）
    try {
      this.game.eventBus?.emit('chapter:complete', {
        levels: [...this.runLevels],
        reward,
        elapsedMs: Date.now() - this.startedAt,
      });
    } catch {
      // 忽略
    }
  }

  // === Event Hooks ===

  _installHooks() {
    if (this._hooked || !this.game?.eventBus) return;
    this._onVictoryHandler = () => this._onLevelVictory();
    this._onDefeatHandler = () => this._onLevelDefeat();
    this.game.eventBus.on('game:victory', this._onVictoryHandler);
    this.game.eventBus.on('game:defeat', this._onDefeatHandler);
    this._hooked = true;
  }

  _uninstallHooks() {
    if (!this._hooked || !this.game?.eventBus) return;
    if (this._onVictoryHandler) {
      this.game.eventBus.off('game:victory', this._onVictoryHandler);
    }
    if (this._onDefeatHandler) {
      this.game.eventBus.off('game:defeat', this._onDefeatHandler);
    }
    this._onVictoryHandler = null;
    this._onDefeatHandler = null;
    this._hooked = false;
  }

  /**
   * 静态方法：判断当前是否在章节挑战中
   * @param {Object} game
   * @returns {boolean}
   */
  static isActive(game) {
    return !!(game && game.isChapterRunMode);
  }
}
