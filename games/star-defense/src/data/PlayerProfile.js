// ================================================================
// 玩家持久化档案 — 跨局进度、货币、升级树、成就进度
// 存储于 localStorage（key: star-defense-profile）
// ================================================================

const UPGRADE_TREES = {
  attack: {
    label: '攻击型',
    color: '#ff4466',
    icon: '⚔️',
    nodes: [
      { id: 'atk_dmg1',  label: '伤害强化Ⅰ',     desc: '所有塔伤害+5%',   cost: 50,  effect: { dmgMult: 1.05 }, maxLvl: 5 },
      { id: 'atk_dmg2',  label: '伤害强化Ⅱ',     desc: '所有塔伤害+5%',   cost: 120, effect: { dmgMult: 1.05 }, maxLvl: 5, req: 'atk_dmg1' },
      { id: 'atk_fireRate', label: '急速射击',     desc: '所有塔攻速+8%',   cost: 100, effect: { fireRateMult: 0.92 }, maxLvl: 3 },
      { id: 'atk_crit',   label: '精准打击',       desc: '暴击率+3%',      cost: 80,  effect: { critChance: 0.03 }, maxLvl: 5 },
      { id: 'atk_critDmg', label: '致命暴击',     desc: '暴击伤害+20%',   cost: 150, effect: { critMult: 0.2 }, maxLvl: 3, req: 'atk_crit' },
      { id: 'atk_chain',  label: '连锁闪电强化',   desc: '特斯拉跳跃+1',    cost: 200, effect: { chainExtra: 1 }, maxLvl: 2 },
      { id: 'atk_armor',  label: '穿甲弹',         desc: '忽略敌人10%护甲', cost: 180, effect: { armorPen: 0.1 }, maxLvl: 3 },
      { id: 'atk_splash', label: '范围扩散',       desc: '溅射半径+15%',   cost: 160, effect: { splashMult: 1.15 }, maxLvl: 3 },
    ]
  },
  economy: {
    label: '经济型',
    color: '#77ccdd',
    icon: '💰',
    nodes: [
      { id: 'eco_init',    label: '初始储备',     desc: '起始能量+15',      cost: 40,  effect: { initEnergy: 15 }, maxLvl: 3 },
      { id: 'eco_regen',   label: '能量回流',     desc: '能量恢复间隔-10%', cost: 60,  effect: { regenMult: 0.9 }, maxLvl: 5 },
      { id: 'eco_interest', label: '利息收入',     desc: '利息率+0.5%',     cost: 100, effect: { interestBonus: 0.005 }, maxLvl: 5 },
      { id: 'eco_kill',    label: '击杀赏金',     desc: '击杀能量奖励+15%', cost: 80,  effect: { killBonus: 0.15 }, maxLvl: 3 },
      { id: 'eco_combo',   label: '连击提成',     desc: '连击能量奖励+20%', cost: 120, effect: { comboBonus: 0.2 }, maxLvl: 3 },
      { id: 'eco_chest',   label: '宝箱探测',     desc: '宝箱稀有度概率+15%', cost: 150, effect: { chestLuck: 0.15 }, maxLvl: 2 },
      { id: 'eco_freeTower', label: '免费部署',   desc: '每局免费塔+1次',   cost: 200, effect: { freeTowerBonus: 1 }, maxLvl: 2 },
    ]
  },
  defense: {
    label: '防御型',
    color: '#44ff88',
    icon: '🛡️',
    nodes: [
      { id: 'def_hp',     label: '加固基地',     desc: '基地初始HP+5',     cost: 50,  effect: { initHpBonus: 5 }, maxLvl: 5 },
      { id: 'def_regen',  label: '缓慢修复',     desc: '每波恢复1HP（最多5）', cost: 100, effect: { hpRegen: 1 }, maxLvl: 3 },
      { id: 'def_armor',  label: '基地护甲',     desc: '敌人到达终点时扣HP-1（最低1）', cost: 120, effect: { leakReduction: 1 }, maxLvl: 3 },
      { id: 'def_shield',  label: '能量护盾',     desc: '每局开局获得1次免伤', cost: 200, effect: { shieldCharges: 1 }, maxLvl: 2 },
      { id: 'def_thorn',   label: '荆棘光环',     desc: '敌人接近基地时受到每秒伤害', cost: 180, effect: { thornDps: 5 }, maxLvl: 3 },
      { id: 'def_slow',    label: '减速力场',     desc: '基地周围敌人减速15%', cost: 150, effect: { baseSlow: 0.15 }, maxLvl: 3 },
    ]
  }
};

// 从 localStorage 加载档案（返回 PlayerProfile 实例，带方法）
function loadProfile() {
  try {
    const raw = localStorage.getItem('star-defense-profile');
    if (raw) {
      const data = JSON.parse(raw);
      return new PlayerProfile(data);
    }
  } catch (e) { /* ignore */ }
  return new PlayerProfile();
}

function createDefaultProfile() {
  return {
    stardust: 0,          // 星尘结晶（货币）
    ownedTowers: ['laser', 'tesla', 'missile'], // 默认解锁的塔
    upgradeLevels: {},      // { [nodeId]: currentLevel }
    achievementProgress: {}, // { [achievementId]: progress }
    unlockedAchievements: [], // 已解锁成就ID列表
    achievements: [],       // 兼容别名：元游戏循环成就ID列表（与 unlockedAchievements 同义）
    techs: [],              // 已解锁的全局科技 id 列表
    unlockedSkins: [],      // 已解锁皮肤
    nextGameEnergyBonus: 0, // 下一局起始能量加成
    stats: {               // 累计统计
      totalKills: 0,
      totalWaves: 0,
      totalGames: 0,
      bestWave: 0,         // 无尽模式最高波次
      totalStardustEarned: 0,
      totalHpRestore: 0,    // 累计HP恢复次数
    },
    dailyChallengeDate: null,  // 上次完成每日挑战的日期
    endlessHighScore: 0,       // 无尽模式最高分
  };
}

// 保存档案到 localStorage
function saveProfile(profile) {
  try {
    localStorage.setItem('star-defense-profile', JSON.stringify(profile));
  } catch (e) { /* quota exceeded */ }
}

// 计算某升级节点的当前总效果值（考虑已购买的等级）
function getNodeEffect(profile, nodeId) {
  const level = profile.upgradeLevels[nodeId] || 0;
  if (level === 0) return null;

  const node = findNode(nodeId);
  if (!node) return null;

  const effect = {};
  for (const [key, perLevelVal] of Object.entries(node.effect)) {
    // 乘算类效果：perLevelVal^level
    if (key === 'dmgMult' || key === 'fireRateMult' || key === 'regenMult' || key === 'splashMult') {
      effect[key] = Math.pow(perLevelVal, level);
    } else {
      // 加算类效果：perLevelVal * level
      effect[key] = perLevelVal * level;
    }
  }
  return effect;
}

// 计算所有已购买升级的叠加效果
function getAllEffects(profile) {
  const combined = {};
  for (const [nodeId, level] of Object.entries(profile.upgradeLevels)) {
    if (level <= 0) continue;
    const node = findNode(nodeId);
    if (!node) continue;
    // 将该节点的效果按等级次数重复应用
    for (let i = 0; i < level; i++) {
      for (const [key, perLevelVal] of Object.entries(node.effect)) {
        // 乘算类效果：伤害倍率、攻速倍率、恢复倍率、溅射倍率
        if (key === 'dmgMult' || key === 'fireRateMult' || key === 'regenMult' || key === 'splashMult') {
          combined[key] = (combined[key] || 1) * perLevelVal;
        } else {
          // 加算类效果：暴击率、暴击伤害、穿甲、连锁等
          combined[key] = (combined[key] || 0) + perLevelVal;
        }
      }
    }
  }
  return combined;
}

// 检查升级节点的前置条件是否满足
function canUpgrade(profile, nodeId) {
  const node = findNode(nodeId);
  if (!node) return false;
  if ((profile.upgradeLevels[nodeId] || 0) >= node.maxLvl) return false;
  if (node.req && !(profile.upgradeLevels[node.req] >= 1)) return false;
  return profile.stardust >= node.cost;
}

function findNode(nodeId) {
  for (const tree of Object.values(UPGRADE_TREES)) {
    const node = tree.nodes.find(n => n.id === nodeId);
    if (node) return node;
  }
  return null;
}

// 购买升级（返回是否成功）
function purchaseUpgrade(profile, nodeId) {
  if (!canUpgrade(profile, nodeId)) return false;
  const node = findNode(nodeId);
  profile.stardust -= node.cost;
  profile.upgradeLevels[nodeId] = (profile.upgradeLevels[nodeId] || 0) + 1;
  saveProfile(profile);
  return true;
}

// 计算一局游戏结束后的星尘奖励
function calculateReward(stats, starCount, difficulty) {
  let base = 0;
  base += stats.kills * 0.5;         // 每击杀 0.5
  base += stats.wavesCompleted * 3;   // 每波 3
  base += starCount * 20;             // 星级奖励
  // 难度倍率
  const diffMult = { easy: 0.8, normal: 1.0, hard: 1.4 }[difficulty] || 1.0;
  return Math.floor(base * diffMult);
}

// ================================================================
// PlayerProfile 类 — 持久化档案（带方法的对象）
// 通过 loadProfile() 加载到内存，方法在修改后自动 save
// 与上面函数式 API 共存；Game 端可直接 .addStardust() / .unlockTech()
// ================================================================
export class PlayerProfile {
  /**
   * @param {Object|null} data 已存在的档案对象（通常来自 localStorage），null 表示新建
   */
  constructor(data = null) {
    const d = data || createDefaultProfile();
    // 拷贝所有字段到实例（保持对外的简单对象行为）
    this.stardust = d.stardust || 0;
    this.ownedTowers = d.ownedTowers || ['laser', 'tesla', 'missile'];
    this.upgradeLevels = d.upgradeLevels || {};
    this.achievementProgress = d.achievementProgress || {};
    this.unlockedAchievements = d.unlockedAchievements || [];
    this.achievements = d.achievements || this.unlockedAchievements.slice();
    this.techs = d.techs || [];
    this.unlockedSkins = d.unlockedSkins || [];
    this.nextGameEnergyBonus = d.nextGameEnergyBonus || 0;
    this.stats = d.stats || {
      totalKills: 0, totalWaves: 0, totalGames: 0, bestWave: 0,
      totalStardustEarned: 0, totalHpRestore: 0,
    };
    this.dailyChallengeDate = d.dailyChallengeDate || null;
    this.endlessHighScore = d.endlessHighScore || 0;
  }

  /** 持久化到 localStorage */
  save() {
    try {
      // 同步 achievements 别名
      this.achievements = this.unlockedAchievements.slice();
      localStorage.setItem('star-defense-profile', JSON.stringify(this));
    } catch (e) { /* quota exceeded */ }
  }

  /** 重新从 localStorage 加载（覆盖当前实例字段） */
  load() {
    try {
      const raw = localStorage.getItem('star-defense-profile');
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.stardust = d.stardust || 0;
      this.ownedTowers = d.ownedTowers || ['laser', 'tesla', 'missile'];
      this.upgradeLevels = d.upgradeLevels || {};
      this.achievementProgress = d.achievementProgress || {};
      this.unlockedAchievements = d.unlockedAchievements || [];
      this.achievements = d.achievements || this.unlockedAchievements.slice();
      this.techs = d.techs || [];
      this.unlockedSkins = d.unlockedSkins || [];
      this.nextGameEnergyBonus = d.nextGameEnergyBonus || 0;
      this.stats = d.stats || this.stats;
      this.dailyChallengeDate = d.dailyChallengeDate || null;
      this.endlessHighScore = d.endlessHighScore || 0;
      return true;
    } catch (e) {
      return false;
    }
  }

  /** 增加星尘（通关、宝箱、调试用） */
  addStardust(n) {
    const amount = Math.max(0, Math.floor(Number(n) || 0));
    this.stardust += amount;
    this.stats.totalStardustEarned = (this.stats.totalStardustEarned || 0) + amount;
    this.save();
    return this.stardust;
  }

  /** 尝试花费星尘；成功返回 true，余额不足返回 false */
  spendStardust(n) {
    const cost = Math.max(0, Math.floor(Number(n) || 0));
    if (this.stardust < cost) return false;
    this.stardust -= cost;
    this.save();
    return true;
  }

  /** 检查是否已解锁某个科技 */
  hasTech(id) {
    return Array.isArray(this.techs) && this.techs.includes(id);
  }

  /** 解锁科技（不会自动扣费，请先 spendStardust） */
  unlockTech(id) {
    if (!this.techs) this.techs = [];
    if (this.techs.includes(id)) return false;
    this.techs.push(id);
    this.save();
    return true;
  }

  /** 检查是否已解锁某个成就 */
  hasAchievement(id) {
    return Array.isArray(this.unlockedAchievements) && this.unlockedAchievements.includes(id);
  }

  /** 解锁成就（成就系统也会调用） */
  unlockAchievement(id) {
    if (!this.unlockedAchievements) this.unlockedAchievements = [];
    if (this.unlockedAchievements.includes(id)) return false;
    this.unlockedAchievements.push(id);
    if (!this.achievements) this.achievements = [];
    this.achievements.push(id);
    this.save();
    return true;
  }
}

export {
  UPGRADE_TREES,
  loadProfile,
  saveProfile,
  getNodeEffect,
  getAllEffects,
  canUpgrade,
  purchaseUpgrade,
  calculateReward,
  findNode,
};
