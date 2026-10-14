// ================================================================
// 敌人类 - 移动、属性、状态效果
// ================================================================
import { CELL, BATTLE } from '../core/Constants.js';

export class Enemy {
  /**
   * @param {string} type - 敌人类型
   * @param {Object} stats - 敌人属性（已计算波次加成）
   * @param {number} startX - 起始X坐标
   * @param {number} startY - 起始Y坐标
   * @param {number} cellSize - 格子大小（动态）
   * @param {Array} path - 敌人跟随的路径
   * @param {Object} [eventBus] - 可选事件总线（用于 boss 阶段切换通知）
   */
  constructor(type, stats, startX, startY, cellSize = CELL, path = null, eventBus = null) {
    this.type = type;
    this.x = startX;
    this.y = startY;
    this.pathIndex = 0;
    this.progress = 0;
    this.cellSize = cellSize;
    this.path = path; // 敌人跟随的路径

    // 属性
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.speed = stats.speed;
    this.baseSpeed = stats.speed; // 阶段切换前的基准速度
    this.reward = stats.reward;
    this.armor = stats.armor || 0;
    this.flying = stats.flying || false;
    this.size = stats.size;
    this.color = stats.color;
    this.icon = stats.icon;
    this.name = stats.name;

    // === Agent C: Boss 标记 & 阶段切换 ===
    this.isBoss = !!(stats.isBoss || type === 'boss_brute');
    this.sizeMultiplier = stats.size || 1;
    this.phase = 1;
    this.phaseThreshold = (stats.phases && stats.phases[0]) || 0.5;
    this.auraColor = stats.auraColor || null;
    this.accentColor = stats.accentColor || null;
    this.eventBus = eventBus; // 可选，用于阶段切换事件

    // === Agent F: 功能型敌人行为参数 ===
    // 治疗虫 (healer)
    this.healRadius = stats.healRadius || 0;
    this.healPct = stats.healPct || 0;
    this.healInterval = stats.healInterval || 0;
    this.healTimer = 0;
    // 护盾兵 (shield)
    this.shieldDuration = stats.shieldDuration || 0;
    this.shieldCooldown = stats.shieldCooldown || 0;
    this.shieldWarning = stats.shieldWarning || 0;
    this.shieldTimer = 0;        // 距离上次激活的累计时间
    this.isShielded = false;     // 当前是否处于无敌期
    this.shieldWarningActive = false; // 当前是否处于警告期
    // 爆裂虫 (swarm)
    this.splitCount = stats.splitCount || 0;
    this.splitHpPct = stats.splitHpPct || 0;
    this.splitMax = stats.splitMax || 0;
    this.splitsDone = 0;     // 已分裂次数
    this.shouldSplit = false; // 死亡时是否需要分裂

    // 系统引用（由 EnemySystem 在创建后注入）
    this.enemySystem = null;

    // === P2-6: BossPhaseSystem 引用（由 EnemySystem 在 spawn 时注入）===
    this._bossPhaseSystem = null;
    this.baseDamage = stats.damage || null;  // 阶段切换前基准伤害

    // 状态
    this.alive = true;
    this.hitFlash = 0;
    this.slowTimer = 0;
    this.slowFactor = 1;

    // === Agent A2 P1-4: 受击闪白计时器（致命伤害时整体闪白 80ms，死亡瞬间 150ms）===
    this.hitFlashTimer = 0;

    // === 动画系统字段 ===
    // 行走动画相位（用于腿部摆动/身体浮动错位）
    this.walkPhase = Math.random() * Math.PI * 2;
    // 受击缩放反馈（受击瞬间放大到 1.2，然后回弹）
    this.hitScale = 1.0;
    // 击退方向向量（由 dealDamage 设置，渲染时读取）
    this.knockbackDx = 0;
    this.knockbackDy = 0;
    // 状态效果：燃烧/中毒计时器
    this.burnTimer = 0;
    this.burnDps = 0;
    this.poisonTimer = 0;
    this.poisonDps = 0;
    // 死亡动画类型：'shatter'（碎裂/甲虫、机甲）、'dissolve'（消散/幽灵、刺客）、'explode'（爆炸/轰炸机、BOSS）
    this.deathType = 'dissolve';
    // 动画时间累加器（用于 idle 动画相位）
    this.animTime = Math.random() * 10;
  }

  /**
   * 由 EnemySystem 创建后注入系统引用（用于跨敌人逻辑）
   * @param {Object} enemySystem - EnemySystem 实例
   */
  setEnemySystem(enemySystem) {
    this.enemySystem = enemySystem;
  }

  /**
   * 沿路径移动
   * @param {number} dt - 时间增量
   * @param {Array} path - 路径数组（如果不传则使用构造时的路径）
   * @returns {boolean} 是否到达终点
   */
  move(dt, path) {
    // 动画时间累加
    this.animTime += dt;

    if (!this.alive) {
      // 死亡动画计时器递减
      if (this.deathAnim !== undefined && this.deathAnim > 0) {
        this.deathAnim -= dt;
      }
      return false;
    }

    const currentPath = path || this.path;
    if (!currentPath || currentPath.length === 0) return false;

    const cell = this.cellSize;

    // 行走动画相位更新（速度越快相位变化越快）
    this.walkPhase += dt * this.speed * this.slowFactor * 8;

    // 受击缩放回弹
    if (this.hitScale > 1.0) {
      this.hitScale -= dt * 8;
      if (this.hitScale < 1.0) this.hitScale = 1.0;
    }
    // 击退偏移回弹
    if (Math.abs(this.knockbackDx) > 0.1 || Math.abs(this.knockbackDy) > 0.1) {
      this.knockbackDx *= 0.85;
      this.knockbackDy *= 0.85;
    } else {
      this.knockbackDx = 0;
      this.knockbackDy = 0;
    }

    // 燃烧伤害
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      if (this.burnDps > 0) {
        const burnDmg = this.burnDps * dt;
        this.hp -= burnDmg;
        if (this.hp <= 0) {
          this.hp = 0;
          this.deathAnim = 0.3;
          this.alive = false;
          this.hitFlashTimer = 0.15;
        }
      }
      if (this.burnTimer <= 0) { this.burnTimer = 0; this.burnDps = 0; }
    }

    // 中毒伤害
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      if (this.poisonDps > 0) {
        const poisonDmg = this.poisonDps * dt;
        this.hp -= poisonDmg;
        if (this.hp <= 0) {
          this.hp = 0;
          this.deathAnim = 0.3;
          this.alive = false;
          this.hitFlashTimer = 0.15;
        }
      }
      if (this.poisonTimer <= 0) { this.poisonTimer = 0; this.poisonDps = 0; }
    }

    // 受击闪烁衰减
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // === Agent A2 P1-4: hitFlashTimer 衰减（受击闪白：致命 80ms / 死亡 150ms）===
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    // 减速计时器
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowFactor = 1;
      }
    }

    // === Agent F: 护盾兵 shield 计时器 ===
    if (this.type === 'shield' && this.alive && this.shieldCooldown > 0) {
      this.shieldTimer += dt;
      // 警告期（最后 0.5s）
      const warnStart = this.shieldCooldown - this.shieldWarning;
      if (!this.isShielded && this.shieldTimer >= warnStart && this.shieldTimer < this.shieldCooldown) {
        this.shieldWarningActive = true;
      } else if (this.shieldTimer < warnStart) {
        this.shieldWarningActive = false;
      }
      // 激活无敌
      if (!this.isShielded && this.shieldTimer >= this.shieldCooldown) {
        this.isShielded = true;
        this.shieldWarningActive = false;
        this.shieldTimer = 0;
      }
      // 无敌期结束
      if (this.isShielded && this.shieldTimer >= this.shieldDuration) {
        this.isShielded = false;
        this.shieldTimer = 0;
      }
    }

    // === Agent F: 治疗虫 heal 计时器（实际治疗在 EnemySystem 中执行） ===
    if (this.type === 'healer' && this.alive && this.healInterval > 0) {
      this.healTimer += dt;
    }

    // 沿路径移动
    if (this.pathIndex < currentPath.length - 1) {
      const target = currentPath[this.pathIndex + 1];
      const tx = target.c * cell + cell / 2;
      const ty = target.r * cell + cell / 2;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = this.speed * this.slowFactor * cell * dt;

      if (dist <= moveSpeed) {
        this.x = tx;
        this.y = ty;
        this.pathIndex++;
        this.progress = this.pathIndex;
      } else {
        this.x += (dx / dist) * moveSpeed;
        this.y += (dy / dist) * moveSpeed;
        this.progress = this.pathIndex + (1 - dist / cell);
      }
    }

    // 检查是否到达终点
    if (this.pathIndex >= currentPath.length - 1) {
      this.alive = false;
      return true;
    }

    return false;
  }

  /**
   * 受到伤害
   * @param {number} damage - 原始伤害
   * @returns {number} 实际伤害
   */
  takeDamage(damage) {
    if (!this.alive) return 0;

    // === Agent F: 护盾兵 无敌期 免疫所有伤害 ===
    if (this.isShielded) {
      // 护盾破解机制：单次伤害超过 maxHp*SHIELD_BREAK_RATIO 时，提前打破护盾
      if (this.maxHp > 0 && damage >= this.maxHp * BATTLE.SHIELD_BREAK_RATIO) {
        this.isShielded = false;
        this.shieldTimer = 0;
        // 破解后继续计算伤害（不再return 0）
      } else {
        return 0;
      }
    }

    // 护甲减免
    const actualDamage = damage * (1 - this.armor);
    this.hp -= actualDamage;
    this.hitFlash = 0.1;
    // === Agent A2 P1-4: 致命伤害闪白（HP <= 0 时延长至 150ms）===
    this.hitFlashTimer = 0.08;
    // 受击缩放反馈
    this.hitScale = 1.15;
    if (this.hp <= 0) this.hitFlashTimer = 0.15;

    // === Agent C: Boss 阶段切换（HP < 50% 时加速 + 变猛） ===
    if (this.isBoss && this.phase === 1 && this.maxHp > 0 &&
        this.hp / this.maxHp < this.phaseThreshold) {
      this.phase = 2;
      this.speed = this.baseSpeed * 1.5;  // 阶段2：速度×1.5
      if (this.eventBus) {
        this.eventBus.emit('boss:phaseChange', {
          x: this.x,
          y: this.y,
          phase: this.phase,
        });
      }
    }

    // === P2-6: 委托 BossPhaseSystem 检查（多阶段抽象）===
    if (this._bossPhaseSystem && typeof this._bossPhaseSystem.check === 'function') {
      this._bossPhaseSystem.check(this);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.deathAnim = 0.4; // 死亡动画持续时间
      this.alive = false;
      // 根据敌人类型设置死亡动画
      if (this.type === 'mech' || this.type === 'tank' || this.type === 'beetle') {
        this.deathType = 'shatter';
      } else if (this.type === 'bomber' || this.type === 'boss' || this.type === 'boss_brute' || this.type === 'virusking' || this.type === 'truck') {
        this.deathType = 'explode';
      } else if (this.type === 'ghost' || this.type === 'stealth' || this.type === 'assassin') {
        this.deathType = 'dissolve';
      } else {
        this.deathType = 'dissolve';
      }

      // === Agent F: 爆裂虫死亡标记分裂（由 EnemySystem 在清理时处理） ===
      if (this.type === 'swarm' && this.splitsDone < this.splitMax) {
        this.shouldSplit = true;
      }
    }

    return actualDamage;
  }

  /**
   * 应用减速效果
   * @param {number} factor - 减速因子（0-1）
   * @param {number} duration - 持续时间（秒）
   */
  applySlow(factor, duration) {
    // 取最强减速效果（factor越小减速越强）
    if (factor < this.slowFactor || this.slowTimer <= 0) {
      this.slowFactor = factor;
      this.slowTimer = duration;
    }
  }

  /**
   * 应用燃烧效果
   * @param {number} dps - 每秒伤害
   * @param {number} duration - 持续时间（秒）
   */
  applyBurn(dps, duration) {
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTimer = Math.max(this.burnTimer, duration);
  }

  /**
   * 应用中毒效果
   * @param {number} dps - 每秒伤害
   * @param {number} duration - 持续时间（秒）
   */
  applyPoison(dps, duration) {
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonTimer = Math.max(this.poisonTimer, duration);
  }

  /**
   * 是否存活
   */
  isAlive() {
    return this.alive;
  }

  /**
   * 重置敌人状态（对象池复用）
   * @param {string} type - 敌人类型
   * @param {Object} stats - 敌人属性
   * @param {number} startX - 起始X坐标
   * @param {number} startY - 起始Y坐标
   * @param {number} cellSize - 格子大小
   * @param {Array} path - 路径数组
   * @param {Object} [eventBus] - 可选事件总线
   */
  reset(type, stats, startX, startY, cellSize, path, eventBus = null) {
    this.type = type;
    this.x = startX;
    this.y = startY;
    this.pathIndex = 0;
    this.progress = 0;
    this.cellSize = cellSize;
    this.path = path;
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.speed = stats.speed;
    this.baseSpeed = stats.speed;
    this.reward = stats.reward;
    this.armor = stats.armor || 0;
    this.flying = stats.flying || false;
    this.size = stats.size;
    this.color = stats.color;
    this.icon = stats.icon;
    this.name = stats.name;
    // === Agent C: Boss 状态重置 ===
    this.isBoss = !!(stats.isBoss || type === 'boss_brute');
    this.sizeMultiplier = stats.size || 1;
    this.phase = 1;
    this.phaseThreshold = (stats.phases && stats.phases[0]) || 0.5;
    this.auraColor = stats.auraColor || null;
    this.accentColor = stats.accentColor || null;
    this.eventBus = eventBus;
    // === Agent F: 功能型敌人参数重置 ===
    this.healRadius = stats.healRadius || 0;
    this.healPct = stats.healPct || 0;
    this.healInterval = stats.healInterval || 0;
    this.healTimer = 0;
    this.shieldDuration = stats.shieldDuration || 0;
    this.shieldCooldown = stats.shieldCooldown || 0;
    this.shieldWarning = stats.shieldWarning || 0;
    this.shieldTimer = 0;
    this.isShielded = false;
    this.shieldWarningActive = false;
    this.splitCount = stats.splitCount || 0;
    this.splitHpPct = stats.splitHpPct || 0;
    this.splitMax = stats.splitMax || 0;
    this.splitsDone = 0;
    this.shouldSplit = false;
    // P2-6: BossPhaseSystem 引用重置（由 EnemySystem 在复用后重新注入）
    this._bossPhaseSystem = null;
    this.baseDamage = stats.damage || null;
    // 状态
    this.alive = true;
    this.hitFlash = 0;
    this.slowTimer = 0;
    this.slowFactor = 1;
    // === Agent A2 P1-4: 重置 hitFlashTimer ===
    this.hitFlashTimer = 0;
    // 动画字段重置
    this.walkPhase = Math.random() * Math.PI * 2;
    this.hitScale = 1.0;
    this.knockbackDx = 0;
    this.knockbackDy = 0;
    this.burnTimer = 0;
    this.burnDps = 0;
    this.poisonTimer = 0;
    this.poisonDps = 0;
    this.deathType = 'dissolve';
    this.animTime = Math.random() * 10;
    // 清除特殊状态
    this.stealthed = false;
    this.stealthTimer = 0;
    this._healTimer = 0;
    this.deathAnim = undefined;
    return this;
  }
}
