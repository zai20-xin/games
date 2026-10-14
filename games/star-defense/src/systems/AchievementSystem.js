// ================================================================
// 成就系统 - 检查、解锁、持久化
// ================================================================
import { ACHIEVEMENTS } from '../data/AchievementConfig.js';

const STORAGE_KEY = 'star-defense-achievements';

export class AchievementSystem {
  /**
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('../ui/AchievementToast.js').AchievementToast} [toast] 可选：成就解锁的全屏大横幅
   */
  constructor(eventBus, toast = null) {
    this.eventBus = eventBus;
    this.toast = toast;
    this.unlockedIds = this._loadUnlocked();
  }

  /**
   * 设置成就解锁大横幅（兼容延迟注入）
   * @param {import('../ui/AchievementToast.js').AchievementToast} toast
   */
  setToast(toast) {
    this.toast = toast;
  }

  /**
   * 从 localStorage 加载已解锁成就
   * @returns {Set<string>}
   */
  _loadUnlocked() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return new Set(data);
    } catch {
      return new Set();
    }
  }

  /**
   * 保存已解锁成就到 localStorage
   */
  _saveUnlocked() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.unlockedIds]));
  }

  /**
   * 检查成就是否达成（遍历所有成就，对比 stats）
   * @param {Object} stats - 当前统计数据
   * @param {number} stats.totalKills - 累计击杀
   * @param {number} stats.maxCombo - 单局最大连击
   * @param {number} stats.synergiesTriggered - 单局组合效果次数
   * @param {number} stats.perfectClears - 无伤通关次数
   * @param {number} stats.speedClears - 速通次数
   * @param {number} stats.bossKills - Boss击杀数
   * @param {number} stats.totalGames - 完成局数
   * @param {number} stats.totalStardust - 累计星尘
   * @param {number} stats.totalTowersPlaced - 累计放置塔数
   * @param {number} stats.totalInterest - 单局累计利息
   * @param {number} stats.totalEnergy - 单局累计能量
   */
  checkAchievements(stats) {
    for (const achievement of ACHIEVEMENTS) {
      // 跳过已解锁的
      if (this.unlockedIds.has(achievement.id)) continue;

      const value = stats[achievement.field];
      if (value === undefined) continue;

      // 挑战类成就 target 为 0，表示计数型（只要 > 0 就算达成）
      if (achievement.target === 0) {
        if (value > 0) {
          this.unlock(achievement.id);
        }
      } else {
        if (value >= achievement.target) {
          this.unlock(achievement.id);
        }
      }
    }
  }

  /**
   * 解锁成就
   * @param {string} id - 成就ID
   */
  unlock(id) {
    if (this.unlockedIds.has(id)) return;

    this.unlockedIds.add(id);
    this._saveUnlocked();

    // 查找成就数据并发送事件
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
      this.eventBus.emit('achievement:unlocked', achievement);
      // P3-5：触发全屏大横幅（史诗播报）
      this.toast?.push(achievement);
    }
  }

  /**
   * 获取已解锁成就ID列表
   * @returns {string[]}
   */
  getUnlocked() {
    return [...this.unlockedIds];
  }

  /**
   * 获取所有成就配置
   * @returns {Array}
   */
  getAllAchievements() {
    return ACHIEVEMENTS;
  }
}
