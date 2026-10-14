// ================================================================
// 防御塔类 - 属性、升级、攻击逻辑
// ================================================================
import { TOWER_LEVEL_MULT, MAX_TOWER_LEVEL, UPGRADE_COST_MULT, CELL } from '../core/Constants.js';

export class Tower {
  /**
   * @param {number} typeIndex - 塔类型索引
   * @param {Object} typeData - 塔类型数据
   * @param {number} row - 行
   * @param {number} col - 列
   * @param {number} cellSize - 格子大小（动态）
   */
  constructor(typeIndex, typeData, row, col, cellSize = CELL) {
    this.typeIndex = typeIndex;
    this.type = typeData;
    this.row = row;
    this.col = col;
    this.cellSize = cellSize;
    this.x = col * cellSize + cellSize / 2;
    this.y = row * cellSize + cellSize / 2;

    // 等级系统
    this.level = 1;
    this.totalInvested = typeData.cost;

    // 升级分支选择（任务5：塔升级分支系统）—— 兼容老字段
    this.branch = null; // 'A' | 'B' | 'C' | null
    this.branchUpgrades = 0; // 分支内升级次数

    // P2-8 专精系统（在 level===3 时弹出选择）
    // 专精升级到 5 级时使用 specializations[chosenSpec].effect
    this.chosenSpec = null; // 'A' | 'B' | null
    this.specLevel = 0;      // 专精内升级次数（用于 4/5 级）

    // P2-1 觉醒系统
    this.awakenedTier = 0;   // 0=未觉醒, 4/5
    this._modifiers = {};    // 觉醒效果累积

    // P4-8 皮肤（默认 = typeData.skin 指向 TOWER_SKINS 中的 key）
    this.skin = typeData.skin || `${typeData.id}_default`;

    // 攻击冷却
    this.cooldown = 0;

    // 辅助塔计时器
    this.energyTimer = 0;

    // 状态
    this.shielded = false;
    this.placeAnim = 1.0; // 放置动画（1.0 -> 0）

    // === 动画系统字段 ===
    // 攻击动画状态: 'idle' | 'charging' | 'firing' | 'recoiling'
    this.attackState = 'idle';
    // 攻击动画计时器
    this.attackAnimTimer = 0;
    // 蓄力时间（秒）
    this.chargeDuration = 0.15;
    // 发射瞬间时长
    this.fireDuration = 0.08;
    // 后坐力恢复时长
    this.recoilDuration = 0.2;
    // 炮塔朝向角度（弧度，0 = 朝右，-PI/2 = 朝上）
    this.turretAngle = -Math.PI / 2;
    // 目标朝向角度（平滑插值）
    this.targetTurretAngle = -Math.PI / 2;
    // 待机动画时间累加器
    this.idleTime = Math.random() * Math.PI * 2;
    // 当前目标敌人引用（用于朝向跟踪）
    this.targetEnemy = null;
    // 光晕脉动相位
    this.glowPhase = Math.random() * Math.PI * 2;
  }

  /**
   * 获取专精效果对象（P2-8 优先，老 upgradeBranches 兜底）
   * @returns {Object|null}
   */
  _getBranchEffect() {
    // 优先使用 specializations（专精）
    if (this.chosenSpec && this.type.specializations && this.type.specializations[this.chosenSpec]) {
      return this.type.specializations[this.chosenSpec].effect;
    }
    // 兜底：老 upgradeBranches（A/B/C 自由选择）
    if (this.branch && this.type.upgradeBranches && this.type.upgradeBranches[this.branch]) {
      return this.type.upgradeBranches[this.branch].effect;
    }
    return null;
  }

  /**
   * 获取实际伤害
   */
  getDamage() {
    let dmg = this.type.damage * TOWER_LEVEL_MULT.DAMAGE(this.level);
    const effect = this._getBranchEffect();
    if (effect && effect.damageMult) {
      // 觉醒后 specLevel >= 1；专精系统下 specLevel 表示在专精内的升级次数
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      dmg *= Math.pow(effect.damageMult, stack);
    }
    // 觉醒 modifier 叠加
    if (this._modifiers.damageMult) {
      dmg *= this._modifiers.damageMult;
    }
    return dmg;
  }

  /**
   * 获取实际射程（像素）
   */
  getRange() {
    let range = this.type.range * TOWER_LEVEL_MULT.RANGE(this.level);
    const effect = this._getBranchEffect();
    if (effect && effect.rangeMult) {
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      range *= Math.pow(effect.rangeMult, stack);
    }
    if (this._modifiers.rangeMult) {
      range *= this._modifiers.rangeMult;
    }
    return range * this.cellSize;
  }

  /**
   * 获取实际射程（格子数）
   */
  getRangeCells() {
    let range = this.type.range * TOWER_LEVEL_MULT.RANGE(this.level);
    const effect = this._getBranchEffect();
    if (effect && effect.rangeMult) {
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      range *= Math.pow(effect.rangeMult, stack);
    }
    if (this._modifiers.rangeMult) {
      range *= this._modifiers.rangeMult;
    }
    return range;
  }

  /**
   * 获取实际攻击间隔
   */
  getFireRate() {
    let rate = this.type.fireRate * TOWER_LEVEL_MULT.FIRE_RATE(this.level);
    const effect = this._getBranchEffect();
    if (effect && effect.fireRateMult) {
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      rate *= Math.pow(effect.fireRateMult, stack);
    }
    if (this._modifiers.fireRateMult) {
      rate *= this._modifiers.fireRateMult;
    }
    return rate;
  }

  /**
   * 获取穿透概率（分支效果）
   * @returns {number} 0-1
   */
  getPierce() {
    let v = 0;
    const effect = this._getBranchEffect();
    if (effect && effect.pierce) {
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      v = Math.min(1, effect.pierce * stack);
    }
    if (this._modifiers.pierce) v = Math.max(v, this._modifiers.pierce);
    return v;
  }

  /**
   * 获取冰冻概率（分支效果）
   * @returns {number} 0-1
   */
  getFreezeChance() {
    let v = 0;
    const effect = this._getBranchEffect();
    if (effect && effect.freezeChance) {
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      v = Math.min(1, effect.freezeChance * stack);
    }
    if (this._modifiers.freezeChance) v = Math.max(v, this._modifiers.freezeChance);
    return v;
  }

  /**
   * 获取引力牵引概率（分支效果）
   * @returns {number} 0-1
   */
  getPullChance() {
    let v = 0;
    const effect = this._getBranchEffect();
    if (effect && effect.pullChance) {
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      v = Math.min(1, effect.pullChance * stack);
    }
    if (this._modifiers.pullChance) v = Math.max(v, this._modifiers.pullChance);
    return v;
  }

  /**
   * 获取溅射范围倍率（分支效果）
   * @returns {number} 默认1
   */
  getSplashMult() {
    const effect = this._getBranchEffect();
    let v = 1;
    if (effect && effect.splashMult) {
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      v = Math.pow(effect.splashMult, stack);
    }
    if (this._modifiers.splashMult) v *= this._modifiers.splashMult;
    return v;
  }

  /**
   * 获取溅射半径（格子数，分支效果，等离子炮专用）
   * @returns {number} 默认0
   */
  getSplashRadius() {
    const effect = this._getBranchEffect();
    let v = 0;
    if (effect && effect.splashRadius) {
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      v = effect.splashRadius * stack;
    }
    if (this._modifiers.splashRadius) v += this._modifiers.splashRadius;
    return v;
  }

  /**
   * 获取链式攻击额外跳跃次数（分支效果，电磁塔专用）
   * @returns {number} 默认0
   */
  getChainBonus() {
    const effect = this._getBranchEffect();
    let v = 0;
    if (effect && effect.chainBonus) {
      const stack = this.chosenSpec ? this.specLevel : this.branchUpgrades;
      v = effect.chainBonus * stack;
    }
    if (this._modifiers.chainBonus) v += this._modifiers.chainBonus;
    return v;
  }

  /**
   * 获取护盾射程（格子数）
   */
  getShieldRange() {
    let r = this.type.range * TOWER_LEVEL_MULT.SHIELD_RANGE(this.level);
    if (this._modifiers.shieldRangeMult) r *= this._modifiers.shieldRangeMult;
    return r;
  }

  /**
   * 获取能量产出
   */
  getEnergyOutput() {
    let v = TOWER_LEVEL_MULT.ENERGY_OUTPUT(this.level);
    if (this._modifiers.energyMult) v *= this._modifiers.energyMult;
    return v;
  }

  /**
   * 是否可以攻击指定敌人（克制关系）
   * @param {Enemy} enemy - 目标敌人
   * @returns {boolean}
   */
  canAttack(enemy) {
    if (!enemy.alive) return false;
    // 激光塔和冷冻塔不能攻击飞行单位
    if (enemy.flying && (this.type.attackType === 'laser' || this.type.attackType === 'cryo')) {
      return false;
    }
    return true;
  }

  /**
   * 是否已满级（基础 3 级）
   */
  isMaxLevel() {
    return this.level >= MAX_TOWER_LEVEL;
  }

  /**
   * 是否已满觉醒（5 级）
   */
  isMaxAwakened() {
    return this.awakenedTier >= 5;
  }

  /**
   * 获取升级费用
   */
  getUpgradeCost() {
    if (this.isMaxLevel() && this.isMaxAwakened()) return 0;
    // 4/5 级：觉醒费用
    if (this.level >= 3 && this.awakenedTier < 5) {
      const cfg = this.type.awakening;
      if (!cfg || !cfg.tiers) return 0;
      // 找下一个 tier（tier 4 起步，跳过 0~3 的初值）
      const candidates = cfg.tiers.filter(t => t.tier > this.awakenedTier);
      if (candidates.length === 0) return 0;
      candidates.sort((a, b) => a.tier - b.tier);
      return candidates[0].cost;
    }
    return Math.ceil(this.type.cost * UPGRADE_COST_MULT[this.level]);
  }

  /**
   * 获取出售回收金额
   */
  getSellValue() {
    return Math.floor(this.totalInvested * 0.7);
  }

  /**
   * 升级（支持分支选择 / 专精选择 / 觉醒）
   * 旧 API 保留：branchChoice = 'A'|'B'|'C' 用于 level 1 首次升级
   * 新增：specChoice = 'A'|'B' 用于 level===3 时选专精
   * @returns {number} 升级费用（觉醒时返回星尘费用）
   */
  upgrade(branchChoice = null, specChoice = null) {
    // 1) 满 3 级后：选专精（仅在第一次升 3 级时弹）
    if (this.level === 2 && specChoice && this.type.specializations) {
      this.chosenSpec = specChoice;
    }

    // 2) 满级（3 级）后：走觉醒路线
    if (this.level === MAX_TOWER_LEVEL) {
      return 0; // 升级操作不直接消耗，由 canAwaken()/awaken() 单独触发
    }

    // 3) 首次升级（level 1→2 或 2→3）：使用老 branch 选择（如果有）
    if (this.level === 1 && branchChoice) {
      this.branch = branchChoice;
      this.branchUpgrades = 1;
    } else if (this.level >= 2 && this.level < MAX_TOWER_LEVEL) {
      // 升 2/3 级：如果已选专精则 specLevel++，否则走老 branch
      if (this.chosenSpec) {
        this.specLevel += 1;
      } else {
        this.branchUpgrades++;
      }
    } else {
      this.branchUpgrades++;
    }

    const cost = Math.ceil(this.type.cost * UPGRADE_COST_MULT[this.level]);
    this.level++;
    this.totalInvested += cost;
    return cost;
  }

  /**
   * P2-1：是否可以觉醒
   * 条件：达到 3 级（MAX_TOWER_LEVEL） && 未达 5 级
   */
  canAwaken() {
    return this.level >= MAX_TOWER_LEVEL && this.awakenedTier < 5 && !!this.type.awakening;
  }

  /**
   * P2-1：执行觉醒（升到下一觉醒档位）
   * @returns {{success:boolean, reason?:string, tier?:number, cost?:number}}
   */
  awaken() {
    const cfg = this.type.awakening;
    if (!cfg) return { success: false, reason: 'no_awakening' };
    if (this.level < MAX_TOWER_LEVEL) return { success: false, reason: 'need_level_3' };
    if (this.awakenedTier >= 5) return { success: false, reason: 'max_awakened' };

    // 找下一个尚未达到的最高 tier（tiers 数组按 tier 升序）
    const candidates = (cfg.tiers || []).filter(t => t.tier > this.awakenedTier);
    if (candidates.length === 0) return { success: false, reason: 'max_awakened' };
    candidates.sort((a, b) => a.tier - b.tier);
    const tierData = candidates[0];
    if (!tierData) return { success: false, reason: 'no_tier' };

    this.awakenedTier = tierData.tier;
    // 累加 modifier（多次觉醒的 effect 累加）
    if (tierData.effect) {
      for (const key of Object.keys(tierData.effect)) {
        if (typeof this._modifiers[key] === 'number' && typeof tierData.effect[key] === 'number') {
          this._modifiers[key] += tierData.effect[key];
        } else {
          this._modifiers[key] = tierData.effect[key];
        }
      }
    }
    return { success: true, tier: tierData.tier, cost: tierData.cost };
  }

  /**
   * P2-8：是否需要选专精（满 3 级且未选）
   */
  needsSpecChoice() {
    return this.level >= MAX_TOWER_LEVEL && !this.chosenSpec && !!this.type.specializations;
  }

  /**
   * P2-8：选专精
   */
  chooseSpecialization(spec) {
    if (!this.type.specializations || !this.type.specializations[spec]) return false;
    this.chosenSpec = spec;
    this.specLevel = Math.max(this.specLevel, 1);
    return true;
  }

  /**
   * P4-8：设置皮肤
   */
  setSkin(skinId) {
    this.skin = skinId;
  }

  // ================================================================
  // 动画系统方法
  // ================================================================

  /**
   * 每帧更新动画状态
   * @param {number} dt - 时间增量（秒）
   */
  updateAnimation(dt) {
    this.idleTime += dt;
    this.glowPhase += dt * 2;

    // 放置动画衰减
    if (this.placeAnim > 0) {
      this.placeAnim -= dt * 3;
      if (this.placeAnim < 0) this.placeAnim = 0;
    }

    // 炮塔朝向平滑插值
    let angleDiff = this.targetTurretAngle - this.turretAngle;
    // 标准化角度差到 [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.turretAngle += angleDiff * Math.min(1, dt * 12);

    // 攻击动画状态机
    if (this.attackState !== 'idle') {
      this.attackAnimTimer -= dt;
      switch (this.attackState) {
        case 'charging':
          if (this.attackAnimTimer <= 0) {
            this.attackState = 'firing';
            this.attackAnimTimer = this.fireDuration;
          }
          break;
        case 'firing':
          if (this.attackAnimTimer <= 0) {
            this.attackState = 'recoiling';
            this.attackAnimTimer = this.recoilDuration;
          }
          break;
        case 'recoiling':
          if (this.attackAnimTimer <= 0) {
            this.attackState = 'idle';
            this.attackAnimTimer = 0;
          }
          break;
      }
    }
  }

  /**
   * 触发攻击动画（由 CombatSystem 在发射前调用）
   * @param {Enemy} target - 目标敌人（用于计算朝向）
   */
  triggerAttackAnim(target) {
    if (target && target.alive) {
      this.targetEnemy = target;
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      this.targetTurretAngle = Math.atan2(dy, dx);
    }
    this.attackState = 'charging';
    this.attackAnimTimer = this.chargeDuration;
  }

  /**
   * 更新炮塔朝向目标（在有目标时持续调用）
   * @param {Enemy} target - 当前目标
   */
  aimAtTarget(target) {
    if (target && target.alive) {
      this.targetEnemy = target;
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      this.targetTurretAngle = Math.atan2(dy, dx);
    }
  }

  /**
   * 获取攻击动画进度（0~1），用于渲染器计算缩放/偏移
   * @returns {{ charge: number, fire: number, recoil: number }}
   */
  getAttackAnimProgress() {
    const charge = this.attackState === 'charging'
      ? 1 - this.attackAnimTimer / this.chargeDuration
      : (this.attackState === 'firing' || this.attackState === 'recoiling' ? 1 : 0);
    const fire = this.attackState === 'firing'
      ? 1 - this.attackAnimTimer / this.fireDuration
      : 0;
    const recoil = this.attackState === 'recoiling'
      ? 1 - this.attackAnimTimer / this.recoilDuration
      : 0;
    return { charge, fire, recoil };
  }
}
