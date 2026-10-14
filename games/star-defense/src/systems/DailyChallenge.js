// ================================================================
// 每日挑战系统 - 基于日期种子的伪随机挑战（P2-3 升级版）
// 流程：进入每日挑战时，先从种子选 3 个 modifier 让玩家选 1
// 选中的 modifier 会被 apply() 写入 game.runModifier
// 老的 hard-coded challenge 类型保留为兼容旧接口（每日硬约束）
// ================================================================
import { ALL_LEVELS } from '../data/LevelConfig.js';
import { MODIFIERS, pickRandomModifiers } from '../data/RunModifiers.js';

const DAILY_STORAGE_KEY = 'star-defense-daily';
const MODIFIER_CHOICES = 3;

export class DailyChallenge {
  constructor() {
    this.seed = this._getTodaySeed();
    this.challenge = this._generateChallenge();
    // modifier 选卡状态
    this._modifiers = null;       // 当前可选的 3 个 modifier
    this._chosenModifier = null;  // 玩家选中的 modifier（apply 前必须先选）
  }

  /**
   * 获取今日种子（YYYYMMDD 格式数字）
   */
  _getTodaySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  }

  /**
   * 基于种子生成今日挑战（关卡 + modifier 选择池）
   * 老的 5 种限制型 modifier（limitedTowers / strongEnemies / ...）合并到新 modifier 体系中
   */
  _generateChallenge() {
    const levelIdx = this._getLevelIdxBySeed();
    const level = ALL_LEVELS[levelIdx];

    return {
      // === 老字段（保留兼容） ===
      name: '每日挑战',
      desc: '选一个词条开始今日挑战',
      type: 'roguelike',
      levelIndex: levelIdx,
      levelId: level.id,
      levelName: level.name,
      date: new Date().toISOString().split('T')[0],
      reward: { stardust: 50 },
    };
  }

  /**
   * 基于 seed 选一个关卡
   */
  _getLevelIdxBySeed() {
    const rand = this._createRng(this.seed);
    return Math.floor(rand() * ALL_LEVELS.length);
  }

  /**
   * 基于种子的伪随机数生成器
   */
  _createRng(seed) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  /**
   * 准备 3 选 1 modifier 选择
   * 每次进入挑战时调用，会基于 seed 生成 3 个 modifier
   * @returns {Array<{id, name, desc, icon, effect, rarity, tags}>}
   */
  getModifierChoices() {
    if (!this._modifiers) {
      this._modifiers = pickRandomModifiers(this.seed, MODIFIER_CHOICES);
    }
    return this._modifiers;
  }

  /**
   * 玩家从 3 选 1 中选定一个 modifier
   * @param {string} modifierId
   * @returns {{success: boolean, reason?: string, modifier?: Object}}
   */
  chooseModifier(modifierId) {
    const choices = this.getModifierChoices();
    const mod = choices.find(m => m.id === modifierId);
    if (!mod) return { success: false, reason: 'not_in_choices' };
    this._chosenModifier = mod;
    return { success: true, modifier: mod };
  }

  /**
   * 获取当前选中的 modifier
   * @returns {Object|null}
   */
  getChosenModifier() {
    return this._chosenModifier;
  }

  /**
   * 应用挑战规则到游戏
   * 1) 写入 runModifier 到 game（供 CombatSystem/TowerSystem 读取）
   * 2) 保留旧版 dailyChallengeRestriction 兼容（hpMult 等可在 modifier effect 中体现）
   * @param {import('../core/Game.js').Game} game
   */
  apply(game) {
    if (!this._chosenModifier) {
      // 没选就 fallback 选第一个（防御性）
      const choices = this.getModifierChoices();
      this._chosenModifier = choices[0];
    }
    const m = this._chosenModifier;
    // 新版接口：game.runModifier 存放完整 modifier 对象
    game.runModifier = m;
    // 老版接口：把 effect 关键字段写入 dailyChallengeRestriction
    // 供 EnemySystem/CombatSystem 已有逻辑使用
    const eff = m.effect || {};
    const restriction = {
      type: 'run_modifier',
      modifierId: m.id,
      // 关键字段平铺出来（兼容老逻辑）
      hpMultiplier: eff.hpMult,        // 敌人 HP 乘算
      initHpMult: eff.initHpMult,
      initEnergyMult: eff.initEnergyMult,
      regenMult: eff.regenMult,
      enemySpeedMult: eff.enemySpeedMult,
      rewardMult: eff.rewardMult,
      dmgMult: eff.dmgMult,
      fireRateMult: eff.fireRateMult,
      chainExtra: eff.chainExtra,
      lifesteal: eff.lifesteal,
      freezeChance: eff.freezeChance,
    };
    game.dailyChallengeRestriction = restriction;
  }

  /**
   * 检查今天是否已完成
   */
  isCompleted() {
    try {
      const completed = JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY) || '{}');
      return completed[this.seed] === true;
    } catch {
      return false;
    }
  }

  /**
   * 标记今天已完成
   */
  markCompleted() {
    try {
      const completed = JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY) || '{}');
      completed[this.seed] = true;
      localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(completed));
    } catch {
      // 忽略存储错误
    }
  }

  /**
   * 获取挑战信息（用于 UI 显示）
   */
  getInfo() {
    return {
      name: this.challenge.name,
      desc: this.challenge.desc,
      type: this.challenge.type,
      levelId: this.challenge.levelId,
      levelName: this.challenge.levelName,
      date: this.challenge.date,
      reward: this.challenge.reward,
      completed: this.isCompleted(),
    };
  }

  /**
   * 静态方法：获取所有 modifier（供 UI 总览）
   * @returns {Array}
   */
  static getAllModifiers() {
    return MODIFIERS;
  }
}
