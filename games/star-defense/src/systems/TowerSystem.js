// ================================================================
// 塔管理系统 - 放置、升级、出售、护盾、组合效果、特殊机制（支持动态格子大小）
// ================================================================
import { Tower } from '../entities/Tower.js';
import { ECONOMY } from '../core/Constants.js';
import { getSynergyKey, getSynergy, SYNERGIES, TRIPLE_SYNERGIES, getTripleSynergyKey, getSquadBonus } from '../data/SynergyConfig.js';

/** 共享空组合效果集合（热路径 fallback，避免每次查询分配新 Set） */
const EMPTY_SYNERGIES = new Set();

export class TowerSystem {
  /**
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('./EffectSystem.js').EffectSystem} effectSystem
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   * @param {import('../map/GameMap.js').GameMap} gameMap
   * @param {import('./AbilitySystem.js').AbilitySystem} [abilitySystem] - 可选注入（Agent E）
   */
  constructor(eventBus, effectSystem, audio, gameMap, abilitySystem = null) {
    this.eventBus = eventBus;
    this.effectSystem = effectSystem;
    this.audio = audio;
    this.gameMap = gameMap;
    this.abilitySystem = abilitySystem;

    /** @type {Tower[]} 所有已放置的塔 */
    this.towers = [];

    /** 游戏数据引用 */
    this.gameData = null;

    /** 组合效果缓存 */
    this.synergyLinks = []; // [{towerA, towerB, synergy}]
    this.towerSynergies = new Map(); // tower -> Set<synergy effects>

    /** 三塔组合 + 小队羁绊（任务 P2-2 扩展） */
    this.activeTripleSynergies = new Set(); // 当前激活的 triple synergy key 集合
    this.tripleSynergyMembers = new Map();   // tripleKey -> Tower[]
    this.squadBonusMap = new Map();          // tower -> {name, mult, count}

    /** 当前关卡特殊机制 */
    this.levelMechanic = null;
    this.levelConfig = null;
  }

  /**
   * 设置关卡特殊机制
   * @param {string|null} mechanic - 机制标识
   * @param {Object} levelConfig - 关卡配置
   */
  setLevelMechanic(mechanic, levelConfig) {
    this.levelMechanic = mechanic;
    this.levelConfig = levelConfig;
  }

  /**
   * 获取塔的射程加成（基于特殊机制）
   * @param {Tower} tower - 防御塔
   * @returns {number} 射程加成倍率
   */
  getRangeBonus(tower) {
    let bonus = 1.0;

    // 摩羯座：高度加成——越高的放置位射程越远（每升高2行+0.5格射程）
    if (this.levelMechanic === 'height_bonus' && this.levelConfig) {
      const maxRow = this.levelConfig.rows - 1;
      const heightRatio = tower.row / maxRow; // 0-1，越高越大
      bonus += (1 - heightRatio) * 0.5; // 越低（越"高"在地图上）加成越大
    }

    return bonus;
  }

  /**
   * 获取塔的伤害加成（基于特殊机制）
   * @param {Tower} tower - 防御塔
   * @returns {number} 伤害加成倍率
   */
  getDamageBonus(tower) {
    let bonus = 1.0;

    // 天秤座：对称加成——检查对称位置是否有塔
    if (this.levelMechanic === 'symmetry_bonus' && this.levelConfig) {
      const mirrorCol = this.levelConfig.cols - 1 - tower.col;
      const hasMirror = this.towers.find(t => t.row === tower.row && t.col === mirrorCol);
      if (hasMirror) {
        bonus *= 1.25; // 对称放置伤害+25%
      }
    }

    // 天蝎座：转弯加成——检查塔是否在路径转弯处
    if (this.levelMechanic === 'turn_boost') {
      if (this._isAtPathTurn(tower.row, tower.col)) {
        bonus *= 1.5; // 转弯处伤害×1.5
      }
    }

    return bonus;
  }

  /**
   * 检查指定位置是否在路径转弯处
   * @param {number} row - 行
   * @param {number} col - 列
   * @returns {boolean}
   */
  _isAtPathTurn(row, col) {
    const paths = this.gameMap.getPaths();
    for (const path of paths) {
      for (let i = 1; i < path.length - 1; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        const next = path[i + 1];
        if (curr.r === row && curr.c === col) {
          // 检查方向是否改变
          const dr1 = curr.r - prev.r;
          const dc1 = curr.c - prev.c;
          const dr2 = next.r - curr.r;
          const dc2 = next.c - curr.c;
          if (dr1 !== dr2 || dc1 !== dc2) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 设置游戏数据引用
   */
  setGameData(data) {
    this.gameData = data;
  }

  /**
   * 更新塔系统
   * @param {number} dt - 时间增量
   * @param {Array<Enemy>} enemies - 敌人数组
   * @param {import('./CombatSystem.js').CombatSystem} combatSystem
   */
  update(dt, enemies, combatSystem) {
    this._updateShields();
    this._updateAuras();

    for (let i = 0; i < this.towers.length; i++) {
      const tower = this.towers[i];

      // 能量采集器
      if (tower.type.supportType === 'energy') {
        tower.energyTimer += dt;
        let output = tower.getEnergyOutput();
        const synergs = this.towerSynergies.get(tower) || EMPTY_SYNERGIES;
        if (synergs.has('energy_boost')) {
          output *= 1.5;
        }
        if (tower.energyTimer >= 5) {
          tower.energyTimer = 0;
          if (this.gameData) {
            this.gameData.energy = Math.min(ECONOMY.MAX_ENERGY, this.gameData.energy + output);
            this.effectSystem.addEnergyGainEffect(tower.x, tower.y, output);
            this.eventBus.emit('ui:update', null);
          }
        }
      }

      // 重力场减速（用距离平方避免sqrt）
      if (tower.type.supportType === 'gravity') {
        const rangePx = tower.getRange();
        const rangeSq = rangePx * rangePx;
        const synergs = this.towerSynergies.get(tower) || EMPTY_SYNERGIES;
        const slowFactor = synergs.has('shield_slow') ? 0.60 : 0.75;
        // 分支C：引力牵引概率
        const pullChance = tower.getPullChance ? tower.getPullChance() : 0;
        for (let j = 0; j < enemies.length; j++) {
          const enemy = enemies[j];
          if (!enemy.alive) continue;
          const dx = enemy.x - tower.x;
          const dy = enemy.y - tower.y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= rangeSq) {
            enemy.applySlow(slowFactor, 0.5);
            // 分支C：概率拉回敌人（向重力场中心移动一小段距离）
            if (pullChance > 0 && Math.random() < pullChance * dt) {
              const dist = Math.sqrt(distSq) || 1;
              const pullDist = this.gameMap.cell * 0.3; // 拉回0.3格
              enemy.x -= (dx / dist) * pullDist;
              enemy.y -= (dy / dist) * pullDist;
            }
          }
        }
      }

      // 修复站
      if (tower.type.supportType === 'repair') {
        tower._repairTimer = (tower._repairTimer || 0) + dt;
        const synergs = this.towerSynergies.get(tower) || EMPTY_SYNERGIES;
        const repairInterval = synergs.has('energy_boost') ? 3.33 : 5;
        const repairAmount = synergs.has('energy_boost') ? 3 : 2;
        if (tower._repairTimer >= repairInterval) {
          tower._repairTimer = 0;
          if (this.gameData && this.gameData.hp < this.gameData.maxHp) {
            this.gameData.hp = Math.min(this.gameData.maxHp, this.gameData.hp + repairAmount);
            this.effectSystem.addEnergyGainEffect(tower.x, tower.y, 1);
            this.eventBus.emit('game:hpChanged', { hp: this.gameData.hp });
            this.eventBus.emit('ui:update', null);
          }
        }
      }

      // P4-2 召唤塔：周期性召唤小虫
      if (tower.type.supportType === 'summon') {
        tower._summonTimer = (tower._summonTimer || 0) + dt;
        const interval = tower.type.summonInterval || 5;
        if (tower._summonTimer >= interval) {
          tower._summonTimer = 0;
          // 召唤小虫通过 BattleUnitSystem 注册（占位：触发事件）
          this.eventBus?.emit('tower:summon', {
            tower,
            count: (tower.type.summonCount || 2) + (tower.specLevel || 0),
            hp: (tower.type.summonHp || 50) * (1 + (tower.specLevel || 0) * 0.3),
          });
          this.effectSystem?.addPlaceEffect?.(tower.x, tower.y + 30, tower.type.color);
        }
      }

      // P4-2 诅咒塔：每 0.5s 对范围内敌人上诅咒
      if (tower.type.supportType === 'curse') {
        tower._curseTimer = (tower._curseTimer || 0) + dt;
        const fireRate = tower.getFireRate ? tower.getFireRate() : (tower.type.fireRate || 0.5);
        if (tower._curseTimer >= fireRate) {
          tower._curseTimer = 0;
          const rangePx = tower.getRange();
          const rangeSq = rangePx * rangePx;
          for (let j = 0; j < enemies.length; j++) {
            const e = enemies[j];
            if (!e.alive) continue;
            const dx = e.x - tower.x;
            const dy = e.y - tower.y;
            if (dx * dx + dy * dy <= rangeSq) {
              // DPS 叠加专精+觉醒 modifier
              const dpsMult = (tower._modifiers && tower._modifiers.curseDpsMult) || 1;
              const dps = (tower.type.curseDps || 5) * (1 + (tower.specLevel || 0) * 0.25) * dpsMult;
              if (e.applyDot) e.applyDot(dps, tower.type.curseDuration || 3, tower.type.color);
              else if (e.takeDamage) e.takeDamage(dps * (tower.type.curseDuration || 3) * 0.2);
            }
          }
          this.effectSystem?.addEnergyGainEffect?.(tower.x, tower.y, 1);
        }
      }
    }
  }

  /**
   * P2-11：更新每个塔的 modifiers.aura
   * 支援塔（shield/energy/gravity/repair/summon/curse）会把自身光环写入 modifiers，
   * TowerRenderer._drawAura 读这个字段画圆环。
   */
  _updateAuras() {
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i];
      if (!t.modifiers) t.modifiers = {};
      const st = t.type.supportType;
      let aura = null;
      if (st === 'shield') {
        aura = { type: 'shield', color: '#a8cc55', radius: t.getShieldRange() * t.cellSize };
      } else if (st === 'energy') {
        aura = { type: 'energy', color: '#ffcc55', radius: (t.type.range || 2) * t.cellSize + 20 };
      } else if (st === 'gravity') {
        aura = { type: 'gravity', color: '#cc8866', radius: t.getRange() };
      } else if (st === 'repair') {
        aura = { type: 'repair', color: '#77ddaa', radius: 80 };
      } else if (st === 'summon') {
        aura = { type: 'summon', color: t.type.color, radius: 90 };
      } else if (st === 'curse') {
        aura = { type: 'curse', color: t.type.color, radius: t.getRange() };
      }
      t.modifiers.aura = aura;
    }
  }

  /**
   * 放置防御塔
   * @param {number} typeIndex - 塔类型索引
   * @param {number} row - 行
   * @param {number} col - 列
   * @param {Array} towerTypes - 塔类型数据
   * @returns {boolean} 是否放置成功
   */
  placeTower(typeIndex, row, col, towerTypes) {
    if (typeIndex === null || typeIndex === undefined) return false;
    const typeData = towerTypes[typeIndex];
    if (!typeData) return false;

    // 检查能量
    if (this.gameData && this.gameData.energy < typeData.cost) return false;

    // 检查放置位
    if (!this.gameMap.isPlacementSlot(row, col)) return false;

    // 检查是否已占用
    if (this.towers.find(t => t.row === row && t.col === col)) return false;

    // 扣除能量
    if (this.gameData) {
      this.gameData.energy -= typeData.cost;
    }

    // 创建塔（使用当前关卡的格子大小）
    const cellSize = this.gameMap.cell;
    const tower = new Tower(typeIndex, typeData, row, col, cellSize);
    this.towers.push(tower);

    // 放置特效
    this.effectSystem.addPlaceEffect(tower.x, tower.y, typeData.color);
    this.audio.play('place');

    // 通知UI更新
    this.eventBus.emit('tower:placed', tower);
    this.eventBus.emit('ui:update', null);

    // 重新计算组合效果（2 塔 + 3 塔 + 小队羁绊）
    this.recalcSynergies();

    return true;
  }

  /**
   * 升级塔（支持分支选择）
   * @param {Tower} tower - 目标塔
   * @param {string|null} branchChoice - 分支选择（'A'/'B'/'C'）
   * @returns {boolean} 是否升级成功
   */
  upgradeTower(tower, branchChoice = null) {
    if (!tower || tower.isMaxLevel()) return false;

    const cost = tower.getUpgradeCost();
    if (this.gameData && this.gameData.energy < cost) return false;

    // 扣除能量
    if (this.gameData) {
      this.gameData.energy -= cost;
    }

    tower.upgrade(branchChoice);

    // 升级特效
    this.effectSystem.addUpgradeEffect(tower.x, tower.y);
    this.audio.play('upgrade');

    // 通知UI更新
    this.eventBus.emit('tower:upgraded', tower);
    this.eventBus.emit('ui:update', null);

    return true;
  }

  /**
   * P2-1：觉醒塔（升 3 级后消耗星尘突破 tier 4/5）
   * @param {Tower} tower
   * @param {Object|null} profile - 玩家档案（用于扣星尘），可选
   * @returns {{success:boolean, reason?:string, tier?:number, cost?:number}}
   */
  awakenTower(tower, profile = null) {
    if (!tower || !tower.canAwaken || !tower.canAwaken()) {
      return { success: false, reason: 'cannot_awaken' };
    }
    // 先看需要的星尘（找下一个最高 tier：4 起步，5 收尾）
    const cfg = tower.type.awakening;
    const candidates = (cfg.tiers || []).filter(t => t.tier > tower.awakenedTier);
    if (candidates.length === 0) return { success: false, reason: 'max_awakened' };
    candidates.sort((a, b) => a.tier - b.tier);
    const tierData = candidates[0];
    if (!tierData) return { success: false, reason: 'no_tier' };

    // 扣除星尘（profile 不可用时不强制扣，但返回 cost 提示调用方）
    if (profile && typeof profile.spendStardust === 'function') {
      if (!profile.spendStardust(tierData.cost)) {
        return { success: false, reason: 'no_stardust', cost: tierData.cost };
      }
    }

    const result = tower.awaken();
    if (!result.success) return result;

    // 觉醒特效
    this.effectSystem?.addBigExplosion?.(tower.x, tower.y, '#ff88ff', 1.3);
    this.effectSystem?.addAbilityEffect?.(tower.x, tower.y, '#ff88ff');
    this.audio?.play?.('towerEvolve');

    this.eventBus?.emit('tower:awakened', { tower, tier: result.tier, cost: result.cost });
    this.eventBus?.emit('ui:update', null);
    return result;
  }

  /**
   * P2-8：选择专精（满 3 级后调用）
   * @param {Tower} tower
   * @param {string} spec 'A' | 'B'
   * @returns {boolean}
   */
  chooseSpecialization(tower, spec) {
    if (!tower || typeof tower.chooseSpecialization !== 'function') return false;
    const ok = tower.chooseSpecialization(spec);
    if (ok) {
      this.eventBus?.emit('tower:specialized', { tower, spec });
      this.eventBus?.emit('ui:update', null);
    }
    return ok;
  }

  /**
   * P4-8：切换皮肤（仅外观，不改数值）
   * @param {Tower} tower
   * @param {string} skinId
   * @returns {boolean}
   */
  changeTowerSkin(tower, skinId) {
    if (!tower || typeof tower.setSkin !== 'function') return false;
    tower.setSkin(skinId);
    this.eventBus?.emit('tower:skinChanged', { tower, skinId });
    return true;
  }

  /**
   * 出售塔
   * @param {Tower} tower - 目标塔
   * @returns {number} 回收金额
   */
  sellTower(tower) {
    if (!tower) return 0;

    const refund = tower.getSellValue();

    // 返还能量
    if (this.gameData) {
      this.gameData.energy = Math.min(ECONOMY.MAX_ENERGY, this.gameData.energy + refund);
    }

    // 出售特效
    this.effectSystem.addSellEffect(tower.x, tower.y, refund);
    this.audio.play('sell');

    // 移除塔
    this.towers = this.towers.filter(t => t !== tower);

    // 通知UI更新
    this.eventBus.emit('tower:sold', { tower, refund });
    this.eventBus.emit('ui:update', null);

    // 重新计算组合效果（2 塔 + 3 塔 + 小队羁绊）
    this.recalcSynergies();

    // === Agent E: 如果被卖的是当前选中的塔，取消选中 ===
    if (this.abilitySystem && this.abilitySystem.selectedTower === tower) {
      this.abilitySystem.deselect();
    }

    return refund;
  }

  /**
   * 更新护盾状态
   */
  _updateShields() {
    for (let i = 0; i < this.towers.length; i++) {
      this.towers[i].shielded = false;
    }

    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i];
      if (t.type.supportType !== 'shield') continue;
      let shieldRange = t.getShieldRange();
      const synergs = this.towerSynergies.get(t) || EMPTY_SYNERGIES;
      if (synergs.has('shield_range')) {
        shieldRange += 0.5;
      }
      for (let j = 0; j < this.towers.length; j++) {
        if (i === j) continue;
        const other = this.towers[j];
        const dist = Math.abs(other.row - t.row) + Math.abs(other.col - t.col);
        if (dist <= shieldRange) {
          other.shielded = true;
        }
      }
    }
  }

  /**
   * 更新所有塔的组合效果（任务 P2-2 扩展）
   * - 2 塔组合（既有逻辑）
   * - 3 塔组合（在 1 格 Chebyshev 半径内同时存在 3 种塔）
   * - 小队羁绊（同种塔上下左右相邻成片，≥3 触发）
   */
  updateSynergies() {
    this.synergyLinks = [];
    this.towerSynergies.clear();
    this.activeTripleSynergies = new Set();
    this.tripleSynergyMembers = new Map();
    this.squadBonusMap = new Map();

    // 为每个塔初始化组合效果集合
    this.towers.forEach(t => {
      this.towerSynergies.set(t, new Set());
    });

    // === 1. 2 塔组合（上下左右相邻） ===
    for (let i = 0; i < this.towers.length; i++) {
      for (let j = i + 1; j < this.towers.length; j++) {
        const a = this.towers[i];
        const b = this.towers[j];

        const dist = Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
        if (dist !== 1) continue;

        const synergy = getSynergy(a.type.id, b.type.id);
        if (!synergy) continue;

        this.synergyLinks.push({ towerA: a, towerB: b, synergy });
        this.towerSynergies.get(a).add(synergy.effect);
        this.towerSynergies.get(b).add(synergy.effect);
      }
    }

    // === 2. 3 塔组合（1 格 Chebyshev 半径内同时存在 3 种塔） ===
    this._detectTripleSynergies();

    // === 3. 小队羁绊（同种塔上下左右相邻成片） ===
    this._detectSquadBonus();

    // 通知 UI
    this.eventBus?.emit('synergy:recalculated', {
      triples: Array.from(this.activeTripleSynergies),
      squads: this.squadBonusMap,
    });
  }

  /**
   * 重新计算组合效果（recalcSynergies 与 updateSynergies 同义，保留别名方便调用方阅读）
   */
  recalcSynergies() {
    this.updateSynergies();
  }

  /**
   * 扫描所有塔，检测在 1 格 Chebyshev 半径内同时存在的三塔组合
   * @private
   */
  _detectTripleSynergies() {
    // 位置 -> 塔 的索引（用于快速查找 3x3 邻域）
    const grid = new Map();
    for (const t of this.towers) {
      grid.set(`${t.row},${t.col}`, t);
    }

    // 对每座塔为中心，检查其 3x3 邻域（含中心）
    for (const t of this.towers) {
      const neighbors = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nb = grid.get(`${t.row + dr},${t.col + dc}`);
          if (nb) neighbors.push(nb);
        }
      }

      // 收集邻域内不同塔种
      const typeSet = new Set(neighbors.map(n => n.type.id));
      if (typeSet.size < 3) continue;

      // 枚举 typeSet 中 3 个不同塔种，查找是否匹配某个 TRIPLE_SYNERGIES
      const types = Array.from(typeSet);
      for (let i = 0; i < types.length; i++) {
        for (let j = i + 1; j < types.length; j++) {
          for (let k = j + 1; k < types.length; k++) {
            const key = getTripleSynergyKey(types[i], types[j], types[k]);
            if (!key) continue;
            if (!TRIPLE_SYNERGIES[key]) continue;
            if (this.activeTripleSynergies.has(key)) continue;
            // 收集真正参与该三塔组合的 3 座塔（按塔种取第一座）
            const usedTypes = new Set();
            const members = [];
            for (const n of neighbors) {
              if (!usedTypes.has(n.type.id)) {
                usedTypes.add(n.type.id);
                members.push(n);
              }
              if (usedTypes.size === 3) break;
            }
            this.activeTripleSynergies.add(key);
            this.tripleSynergyMembers.set(key, members);
          }
        }
      }
    }
  }

  /**
   * 扫描所有塔，使用 BFS 找出每种塔的相邻连通分量；>=3 的簇触发小队奖励
   * @private
   */
  _detectSquadBonus() {
    const visited = new Set();
    for (const t of this.towers) {
      const key = `${t.row},${t.col}`;
      if (visited.has(key)) continue;

      // BFS 找所有相邻的同种塔
      const cluster = [];
      const queue = [t];
      visited.add(key);
      while (queue.length > 0) {
        const cur = queue.shift();
        cluster.push(cur);
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          const nk = `${cur.row + dr},${cur.col + dc}`;
          if (visited.has(nk)) continue;
          const nt = this.towers.find(x => `${x.row},${x.col}` === nk && x.type.id === cur.type.id);
          if (!nt) continue;
          visited.add(nk);
          queue.push(nt);
        }
      }

      // 簇大小 >=3 触发小队奖励
      const bonus = getSquadBonus(cluster.length);
      if (!bonus) continue;
      const info = { name: bonus.name, mult: bonus.mult, count: cluster.length };
      for (const m of cluster) {
        // 同一座塔同种类型时只记一次（多次入簇时取最高档）
        const prev = this.squadBonusMap.get(m);
        if (!prev || prev.mult < info.mult) {
          this.squadBonusMap.set(m, info);
        }
      }
    }
  }

  /**
   * 获取指定塔当前激活的小队奖励（若有）
   * @param {Tower} tower
   * @returns {{name: string, mult: number, count: number}|null}
   */
  getSquadBonusFor(tower) {
    return this.squadBonusMap.get(tower) || null;
  }

  /**
   * 获取当前激活的所有三塔组合 key
   * @returns {string[]}
   */
  getActiveTripleSynergies() {
    return Array.from(this.activeTripleSynergies);
  }

  /**
   * 获取指定塔的所有组合效果
   * @param {Tower} tower - 目标塔
   * @returns {Set<string>} 组合效果集合
   */
  getTowerSynergies(tower) {
    return this.towerSynergies.get(tower) || EMPTY_SYNERGIES;
  }

  /**
   * 查找指定位置的塔
   */
  findTowerAt(row, col) {
    return this.towers.find(t => t.row === row && t.col === col) || null;
  }

  /**
   * 清除所有塔
   */
  clear() {
    this.towers = [];
    this.synergyLinks = [];
    this.towerSynergies.clear();
    this.activeTripleSynergies = new Set();
    this.tripleSynergyMembers = new Map();
    this.squadBonusMap = new Map();
  }
}
