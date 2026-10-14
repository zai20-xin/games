// ================================================================
// 元游戏进展系统 — 跨局永久升级、货币奖励、档案管理
// 在 Game.js 中实例化，接入游戏开始/结束流程
// ================================================================
import {
  loadProfile, saveProfile, getAllEffects,
  calculateReward, canUpgrade, purchaseUpgrade, UPGRADE_TREES
} from '../data/PlayerProfile.js';
import { TECH_TREE, findTech } from '../data/TechTree.js';

export class MetaProgression {
  /**
   * @param {import('../core/EventBus.js').EventBus} [eventBus]
   */
  constructor(eventBus = null) {
    this.eventBus = eventBus;
    this.profile = loadProfile();
    this.sessionEffects = {};
    this.techBuffs = {};
    this._refreshEffects();
  }

  /** 设置事件总线（Game 创建 MetaProgression 时还没 eventBus，事后注入） */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
    this._emitBuffsChanged();
  }

  /** 重新计算叠加效果（每次升级后调用）*/
  _refreshEffects() {
    this.sessionEffects = getAllEffects(this.profile);
    this._recalcTechBuffs();
  }

  /** 根据 profile.techs 重新计算科技 buff 集合 */
  _recalcTechBuffs() {
    const buffs = {};
    const unlocked = Array.isArray(this.profile.techs) ? this.profile.techs : [];
    for (const id of unlocked) {
      const t = findTech(id);
      if (!t || !t.effect) continue;
      for (const [key, val] of Object.entries(t.effect)) {
        if (buffs[key] === undefined) {
          buffs[key] = val;
        } else {
          // 加算叠加：科技效果累加
          buffs[key] = buffs[key] + val;
        }
      }
    }
    this.techBuffs = buffs;
  }

  /** 广播 buff 变更事件（其他系统可监听 meta:buffsChanged）*/
  _emitBuffsChanged() {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      try { this.eventBus.emit('meta:buffsChanged', this.getBuffs()); } catch (e) { /* ignore */ }
    }
  }

  /** 获取玩家档案 */
  getProfile() {
    return this.profile;
  }

  /** 获取升级树定义（供UI使用）*/
  getUpgradeTrees() {
    return UPGRADE_TREES;
  }

  /** 尝试购买升级 → {success, nodeId, newLevel} */
  buyUpgrade(nodeId) {
    if (!canUpgrade(this.profile, nodeId)) {
      return { success: false, nodeId, newLevel: this.profile.upgradeLevels[nodeId] || 0 };
    }
    purchaseUpgrade(this.profile, nodeId);
    this._refreshEffects();
    return { success: true, nodeId, newLevel: this.profile.upgradeLevels[nodeId] };
  }

  /** 获取当前星尘结晶 */
  getStardust() {
    return this.profile.stardust;
  }

  // ─────────────────────────────────────────────
  //  科技树（元游戏循环）API
  // ─────────────────────────────────────────────

  /** 暴露科技树定义，供 UI 使用 */
  getTechTree() {
    return TECH_TREE;
  }

  /** 检查是否已解锁科技 */
  hasTech(id) {
    return this.profile.hasTech ? this.profile.hasTech(id) : false;
  }

  /** 获得当前科技 buff 集合（科技树 + 旧升级树叠加） */
  getBuffs() {
    // 合并：techBuffs（科技树）+ sessionEffects（升级树，兼容旧系统）
    return {
      ...this.sessionEffects,
      ...this.techBuffs,
    };
  }

  /** 尝试解锁科技 → { success, id, reason } */
  unlockTech(id) {
    const tech = findTech(id);
    if (!tech) return { success: false, id, reason: 'unknown' };
    if (this.hasTech(id)) return { success: false, id, reason: 'already' };
    if (this.profile.stardust < tech.cost) return { success: false, id, reason: 'insufficient' };

    // 扣费：优先用 profile 的方法（会自动 save），否则手动扣 + save
    if (this.profile.spendStardust) {
      if (!this.profile.spendStardust(tech.cost)) {
        return { success: false, id, reason: 'insufficient' };
      }
    } else {
      this.profile.stardust -= tech.cost;
      saveProfile(this.profile);
    }
    this.profile.unlockTech(id);
    this._refreshEffects();
    this._emitBuffsChanged();
    return { success: true, id, cost: tech.cost, stardust: this.profile.stardust };
  }

  /** 简化版 addStardust（供外部直接调用） */
  addStardust(n) {
    if (this.profile.addStardust) {
      return this.profile.addStardust(n);
    }
    this.profile.stardust = (this.profile.stardust || 0) + n;
    saveProfile(this.profile);
    return this.profile.stardust;
  }

  // ─────────────────────────────────────────────
  //  游戏开始时调用：应用永久升级到游戏初始状态
  // ─────────────────────────────────────────────
  applyToGame(gameState) {
    const e = this.sessionEffects;
    const t = this.techBuffs;  // 科技树 buff

    // 初始能量加成（旧升级树 initEnergy + 科技树 startEnergy）
    const startEnergyBonus = (e.initEnergy || 0) + (t.startEnergy || 0);
    if (startEnergyBonus) {
      gameState.energy = (gameState.energy || 0) + startEnergyBonus;
    }

    // 初始HP加成（旧升级树 + 科技树 baseHp）
    const initHpBonus = (e.initHpBonus || 0) + (t.baseHp || 0);
    if (initHpBonus) {
      gameState.maxHp = (gameState.maxHp || 0) + initHpBonus;
      gameState.hp = (gameState.hp || gameState.maxHp || 0) + initHpBonus;
    }

    // 能量恢复速度倍率（越小越快）
    if (e.regenMult) {
      gameState._meta_regenMult = e.regenMult;
    }

    // 暴击率 / 暴击伤害（旧升级树 + 科技树 critChance）
    const critChanceTotal = (e.critChance || 0) + (t.critChance || 0);
    if (critChanceTotal) {
      gameState._meta_critChance = (gameState._meta_critChance || 0) + critChanceTotal;
    }
    if (e.critMult) {
      gameState._meta_critMult = (gameState._meta_critMult || 1) + e.critMult - 1;
    }

    // 免费塔次数加成
    if (e.freeTowerBonus) {
      gameState._meta_freeTowerBonus = e.freeTowerBonus;
    }

    // 护盾次数
    if (e.shieldCharges) {
      gameState._meta_shieldCharges = e.shieldCharges;
      gameState._meta_shieldHits = 0;
    }

    // 基地每波回复
    if (e.hpRegen) {
      gameState._meta_hpRegenPerWave = e.hpRegen;
    }

    // 漏怪扣HP减免
    if (e.leakReduction) {
      gameState._meta_leakReduction = e.leakReduction;
    }

    // 宝箱幸运值
    if (e.chestLuck) {
      gameState._meta_chestLuck = e.chestLuck;
    }

    // ── 科技树专属 buff（注入到 gameState._meta_tech*）──
    if (t.startEnergy)    gameState._meta_tech_startEnergy = t.startEnergy;
    if (t.energyRegen)    gameState._meta_tech_energyRegen = t.energyRegen;
    if (t.towerDamage)    gameState._meta_tech_towerDamage = t.towerDamage;
    if (t.towerRange)     gameState._meta_tech_towerRange  = t.towerRange;
    if (t.towerSpeed)     gameState._meta_tech_towerSpeed  = t.towerSpeed;
    if (t.killEnergy)     gameState._meta_tech_killEnergy  = t.killEnergy;
    if (t.slowStart)      gameState._meta_tech_slowStart   = t.slowStart;
    if (t.baseHp)         gameState._meta_tech_baseHp     = t.baseHp;
    if (t.critChance)     gameState._meta_tech_critChance = t.critChance;

    this._refreshEffects();
  }

  /** 获取塔属性倍率（CombatSystem 调用）*/
  getTowerModifiers() {
    const e = this.sessionEffects;
    const t = this.techBuffs;
    return {
      damageMult:  (e.dmgMult  || 1) + (t.towerDamage || 0),
      fireRateMult: (e.fireRateMult || 1) + (t.towerSpeed || 0),
      splashMult:   e.splashMult || 1,
      rangeMult:    1 + (t.towerRange || 0),
      armorPen:     e.armorPen    || 0,
      chainExtra:   e.chainExtra  || 0,
      critChance:   (e.critChance  || 0) + (t.critChance || 0),
      critMult:     1.5 + (e.critMult || 0),  // 基础暴击1.5x + 升级加成
    };
  }

  /** 获取经济倍率 */
  getEconomyModifiers() {
    const e = this.sessionEffects;
    return {
      regenMult:    e.regenMult    || 1,
      interestBonus: e.interestBonus || 0,
      killBonus:     e.killBonus     || 0,
      comboBonus:    e.comboBonus    || 0,
    };
  }

  /** 获取防御属性 */
  getDefenseModifiers() {
    const e = this.sessionEffects;
    return {
      thornDps:        e.thornDps       || 0,
      baseSlow:        e.baseSlow       || 0,
      shieldCharges:   e.shieldCharges  || 0,
      hpRegenPerWave: e.hpRegen       || 0,
      leakReduction:   e.leakReduction  || 0,
    };
  }

  // ─────────────────────────────────────────────
  //  游戏结束后调用：计算并发放星尘奖励
  //  stats = { kills, wavesCompleted }
  // ─────────────────────────────────────────────
  awardEndGame(stats, starCount, difficulty) {
    const baseReward = calculateReward(stats, starCount, difficulty);
    const luck = this.sessionEffects.chestLuck || 0;
    const finalReward = Math.floor(baseReward * (1 + luck * 0.1));

    this.profile.stardust += finalReward;
    this.profile.stats.totalKills += stats.kills || 0;
    this.profile.stats.totalWaves += stats.wavesCompleted || 0;
    this.profile.stats.totalGames += 1;
    this.profile.stats.totalStardustEarned += finalReward;

    saveProfile(this.profile);
    this._refreshEffects();

    return { reward: finalReward, total: this.profile.stardust };
  }

  /** 更新累计统计（供 AchievementSystem 使用）*/
  updateStats(key, value) {
    if (key in this.profile.stats) {
      this.profile.stats[key] = Math.max(this.profile.stats[key], value);
    }
    saveProfile(this.profile);
  }

  /** 检查今日每日挑战是否已完成 */
  isDailyCompleted() {
    const today = new Date().toISOString().slice(0, 10);
    return this.profile.dailyChallengeDate === today;
  }

  /** 标记今日每日挑战已完成 */
  setDailyCompleted() {
    const today = new Date().toISOString().slice(0, 10);
    this.profile.dailyChallengeDate = today;
    saveProfile(this.profile);
  }
}
