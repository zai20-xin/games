// ================================================================
// 主动技能系统 - 9 个塔各自拥有 R 键大招（30 秒冷却）
// ================================================================
import { ECONOMY } from '../core/Constants.js';

export class AbilitySystem {
  /**
   * @param {Object} deps
   * @param {import('./EffectSystem.js').EffectSystem} deps.effectSystem
   * @param {import('./EnemySystem.js').EnemySystem} deps.enemySystem
   * @param {import('../core/Game.js').Game} deps.game
   * @param {import('../audio/AudioManager.js').AudioManager} deps.audio
   * @param {import('eventbus').EventBus} deps.eventBus
   */
  constructor({ effectSystem, enemySystem, game, audio, eventBus } = {}) {
    this.effectSystem = effectSystem;
    this.enemySystem = enemySystem;
    this.game = game;
    this.audio = audio;
    this.eventBus = eventBus;

    /** @type {Object|null} 当前选中的塔 */
    this.selectedTower = null;

    /** @type {Object<string, number>} abilityId -> 剩余冷却秒数 */
    this.cooldowns = {};

    /** 临时状态：过载模式（电磁塔 R 键） */
    this._overloadActive = false;
    this._overloadTower = null;
    this._overloadTimer = 0;

    /** 临时状态：基地能量护盾（护盾塔 R 键） */
    this._baseShieldCharges = 0;

    // === Agent A8 P2-4: 大招全屏动画状态 ===
    /** @type {{id:string, progress:number, duration:number}|null} */
    this._animating = null;
    /** 大招动画固定时长（秒） */
    this._animatingDuration = 1.5;
  }

  /**
   * 选中一个塔（用于 R 键 + 按钮触发）
   * @param {import('../entities/Tower.js').Tower|null} tower
   */
  selectTower(tower) {
    this.selectedTower = tower;
    this.eventBus?.emit('ability:selectionChanged', tower);
  }

  /**
   * 取消选中
   */
  deselect() {
    this.selectedTower = null;
    this.eventBus?.emit('ability:selectionChanged', null);
  }

  /**
   * 获取当前选中塔的 ability 配置
   * @returns {Object|null}
   */
  getSelectedAbility() {
    if (!this.selectedTower) return null;
    return this.selectedTower.type?.ability || null;
  }

  /**
   * 获取指定 ability 的剩余冷却
   * @param {string} abilityId
   * @returns {number} 剩余秒数
   */
  getCooldown(abilityId) {
    if (!abilityId) return 0;
    return this.cooldowns[abilityId] || 0;
  }

  /**
   * 获取当前选中 ability 的剩余冷却
   * @returns {number}
   */
  getSelectedCooldown() {
    const ab = this.getSelectedAbility();
    if (!ab) return 0;
    return this.getCooldown(ab.id);
  }

  /**
   * 触发当前选中塔的技能
   * @returns {boolean} 是否成功触发
   */
  trigger() {
    const tower = this.selectedTower;
    if (!tower) return false;
    const ability = tower.type?.ability;
    if (!ability) return false;

    const remaining = this.getCooldown(ability.id);
    if (remaining > 0) return false;

    // 分发到具体实现
    this._execute(ability, tower);

    // 设置冷却
    this.cooldowns[ability.id] = ability.cooldown;

    // 视觉反馈（中心放射）
    this.effectSystem?.addAbilityEffect(tower.x, tower.y, ability.color);

    // 提示音
    try { this.audio?.play('waveStart'); } catch (e) { /* 忽略 */ }

    // === Agent A8 P2-4: 启动全屏动画状态 ===
    this._animating = {
      id: ability.id,
      progress: 0,
      duration: this._animatingDuration,
    };
    // 立即推送一帧 progress=0 给 EffectRenderer
    this.eventBus?.emit('ability:fx', {
      id: this._animating.id,
      progress: 0,
      duration: this._animatingDuration,
    });

    // 通知 UI 更新
    this.eventBus?.emit('ability:triggered', { tower, ability });
    return true;
  }

  /**
   * 帧更新
   * @param {number} dt
   */
  update(dt) {
    // 冷却递减
    for (const id in this.cooldowns) {
      this.cooldowns[id] -= dt;
      if (this.cooldowns[id] <= 0) {
        delete this.cooldowns[id];
      }
    }

    // 过载模式计时
    if (this._overloadActive) {
      this._overloadTimer -= dt;
      if (this._overloadTimer <= 0) {
        this._overloadActive = false;
        this._overloadTower = null;
      }
    }

    // === Agent A8 P2-4: 推进全屏动画状态 ===
    if (this._animating) {
      this._animating.progress += dt / this._animating.duration;
      if (this._animating.progress >= 1) {
        // 动画结束：推最终帧 + 结束事件
        this._animating.progress = 1;
        this.eventBus?.emit('ability:fx', {
          id: this._animating.id,
          progress: 1,
          duration: this._animating.duration,
        });
        this.eventBus?.emit('ability:fxEnd', { id: this._animating.id });
        this._animating = null;
      } else {
        // 正常推进：推一帧 progress
        this.eventBus?.emit('ability:fx', {
          id: this._animating.id,
          progress: this._animating.progress,
          duration: this._animating.duration,
        });
      }
    }
  }

  /**
   * 重置系统（关卡切换/重开）
   */
  reset() {
    this.selectedTower = null;
    this.cooldowns = {};
    this._overloadActive = false;
    this._overloadTower = null;
    this._overloadTimer = 0;
    this._baseShieldCharges = 0;
    // === Agent A8 P2-4: 重置全屏动画 ===
    if (this._animating) {
      this.eventBus?.emit('ability:fxEnd', { id: this._animating.id });
      this._animating = null;
    }
  }

  /**
   * 当前是否处于过载模式（供 CombatSystem 查询）
   */
  isOverloaded(tower) {
    return this._overloadActive && this._overloadTower === tower;
  }

  /**
   * 当前基地是否还有免疫护盾
   */
  hasBaseShield() {
    return this._baseShieldCharges > 0;
  }

  /**
   * 消耗一次基地护盾（enemy:leaked 路径上拦截）
   * @returns {boolean} 是否成功消耗（即本次伤害被吸收）
   */
  consumeBaseShield() {
    if (this._baseShieldCharges <= 0) return false;
    this._baseShieldCharges -= 1;
    return true;
  }

  // === 内部：技能分发 ===
  _execute(ability, tower) {
    const fn = this[`_do_${ability.id}`];
    if (typeof fn === 'function') {
      try {
        fn.call(this, tower);
      } catch (e) {
        console.warn(`[AbilitySystem] execute ${ability.id} failed:`, e);
      }
    }
  }

  _liveEnemies() {
    return (this.enemySystem?.enemies || []).filter(e => e && e.alive);
  }

  // ================================================================
  // 9 个塔技能实现
  // ================================================================

  /** 激光炮台：穿透射线 - 对一条线上的所有敌人造成 200 伤害 */
  _do_laser_pierce(tower) {
    const enemies = this._liveEnemies();
    if (enemies.length === 0) return;

    // 找最远（最靠近基地）的敌人方向作为线
    let target = null;
    let bestProgress = -1;
    for (const e of enemies) {
      if (e.progress > bestProgress) { bestProgress = e.progress; target = e; }
    }
    if (!target) return;

    const dx = target.x - tower.x;
    const dy = target.y - tower.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    // 在该方向上找出与射线方向接近的敌人
    const RAY_LENGTH = 1200; // 像素
    const RAY_HALF_WIDTH = 50; // 命中带宽
    let count = 0;
    for (const e of enemies) {
      const ex = e.x - tower.x;
      const ey = e.y - tower.y;
      const proj = ex * nx + ey * ny;
      if (proj < 0 || proj > RAY_LENGTH) continue;
      const px = ex - proj * nx;
      const py = ey - proj * ny;
      if (px * px + py * py <= RAY_HALF_WIDTH * RAY_HALF_WIDTH) {
        if (e.takeDamage) e.takeDamage(200);
        count++;
      }
    }

    // 视觉：一条很长的红线
    if (this.effectSystem?.addLaserEffect) {
      const ex = tower.x + nx * RAY_LENGTH;
      const ey = tower.y + ny * RAY_LENGTH;
      this.effectSystem.addLaserEffect(tower.x, tower.y, ex, ey, '#ff5544');
    }
    if (this.effectSystem?.addBigExplosion) {
      this.effectSystem.addBigExplosion(tower.x, tower.y, '#ff5544', 1.2);
    }
  }

  /** 电磁塔：过载模式 - 自身 5s 攻速 ×3 */
  _do_overload(tower) {
    this._overloadActive = true;
    this._overloadTower = tower;
    this._overloadTimer = 5;
    // 过载期间的视觉标记：粒子环
    this.effectSystem?.addBigExplosion?.(tower.x, tower.y, '#ffdd55', 0.8);
  }

  /** 导弹塔：集束导弹 - 同时发射 5 枚导弹到随机敌人 */
  _do_cluster_missile(tower) {
    const enemies = this._liveEnemies();
    if (enemies.length === 0) return;

    // 弹 5 个目标（带去重）
    const targets = [];
    for (let i = 0; i < 5 && enemies.length > 0; i++) {
      const idx = Math.floor(Math.random() * enemies.length);
      targets.push(enemies[idx]);
    }

    let lastTarget = null;
    for (const t of targets) {
      if (this.effectSystem?.addMissileExplosion) {
        this.effectSystem.addMissileExplosion(t.x, t.y, 0.6);
      }
      if (t.takeDamage) t.takeDamage(80);
      lastTarget = t;
    }
    if (lastTarget) {
      this.effectSystem?.addBigExplosion?.(lastTarget.x, lastTarget.y, '#ffaa33', 1.0);
    }
  }

  /** 护盾发生器：能量护盾 - 基地免疫下一次伤害 */
  _do_energy_shield(tower) {
    this._baseShieldCharges = Math.max(this._baseShieldCharges, 1);
    this.effectSystem?.addBigExplosion?.(tower.x, tower.y, '#88dd66', 0.8);
  }

  /** 能量采集器：能量灌注 - 立即获得 50 能量 */
  _do_energy_infusion(tower) {
    if (this.game) {
      this.game.energy = Math.min(ECONOMY.MAX_ENERGY, (this.game.energy || 0) + 50);
      this.eventBus?.emit('ui:update', null);
    }
    this.effectSystem?.addEnergyGainEffect?.(tower.x, tower.y, 50);
  }

  /** 重力场：震荡波 - 全场敌人眩晕 1.5s（速度设为 0） */
  _do_shock_wave(tower) {
    const enemies = this._liveEnemies();
    for (const e of enemies) {
      // 利用 applySlow 模拟停止移动（factor 越小越慢）
      if (e.applySlow) e.applySlow(0.0, 1.5);
      else if (e.speed !== undefined) e.speed = 0;
    }
    this.effectSystem?.addBigExplosion?.(tower.x, tower.y, '#ffaa66', 1.2);
  }

  /** 冷冻塔：绝对零度 - 全场敌人减速 80%（3 秒） */
  _do_absolute_zero(tower) {
    const enemies = this._liveEnemies();
    for (const e of enemies) {
      if (e.applySlow) e.applySlow(0.2, 3.0);
    }
    this.effectSystem?.addBigExplosion?.(tower.x, tower.y, '#aaddff', 1.2);
  }

  /** 等离子炮：等离子风暴 - 全场敌人 80 伤害 + 减速 30%（3 秒） */
  _do_plasma_storm(tower) {
    const enemies = this._liveEnemies();
    for (const e of enemies) {
      if (e.takeDamage) e.takeDamage(80);
      if (e.applySlow) e.applySlow(0.7, 3.0);
    }
    this.effectSystem?.addBigExplosion?.(tower.x, tower.y, '#ff88ff', 1.3);
  }

  /** 修复站：紧急修复 - 修复基地 15 HP */
  _do_emergency_repair(tower) {
    if (this.game) {
      this.game.hp = Math.min(this.game.maxHp || 20, (this.game.hp || 0) + 15);
      this.eventBus?.emit('game:hpChanged', { hp: this.game.hp });
      this.eventBus?.emit('ui:update', null);
    }
    this.effectSystem?.addEnergyGainEffect?.(tower.x, tower.y, 1);
    this.effectSystem?.addBigExplosion?.(tower.x, tower.y, '#66ddaa', 0.7);
  }

  // ================================================================
  // P4-2：召唤塔 + 诅咒塔 的大招
  // ================================================================

  /** 召唤塔：虫群召唤 - 立即召唤 5 只小虫（基于 tower.specLevel 也会有额外数量） */
  _do_swarm_call(tower) {
    const base = 5;
    const extra = (tower.specLevel || 0) * 1;
    const count = base + extra;
    const hp = (tower.type.summonHp || 50) * (1 + (tower.specLevel || 0) * 0.3);
    // 通过事件总线抛到 BattleUnitSystem / 上层做实际生成
    this.eventBus?.emit('tower:summon', { tower, count, hp });
    // 视觉反馈
    this.effectSystem?.addBigExplosion?.(tower.x, tower.y, tower.type.color || '#ff88cc', 1.0);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const rx = tower.x + Math.cos(ang) * 30;
      const ry = tower.y + Math.sin(ang) * 30;
      this.effectSystem?.addPlaceEffect?.(rx, ry, tower.type.color || '#ff88cc');
    }
  }

  /** 诅咒塔：死亡诅咒 - 范围内敌人 3s 内死亡（按比例扣血） */
  _do_death_curse(tower) {
    const enemies = this._liveEnemies();
    if (enemies.length === 0) {
      this.effectSystem?.addBigExplosion?.(tower.x, tower.y, tower.type.color || '#aa44ff', 0.6);
      return;
    }
    const rangePx = tower.getRange ? tower.getRange() : ((tower.type.range || 3) * (tower.cellSize || 56));
    const rangeSq = rangePx * rangePx;
    const dpsMult = (tower._modifiers && tower._modifiers.curseDpsMult) || 1;
    const dmgPerSec = (tower.type.curseDps || 5) * (1 + (tower.specLevel || 0) * 0.25) * dpsMult;
    const totalDmg = dmgPerSec * 3.0; // 3 秒总伤
    let hitCount = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - tower.x;
      const dy = e.y - tower.y;
      if (dx * dx + dy * dy > rangeSq) continue;
      // 优先用 applyDot（持续伤害），否则一次性扣血
      if (e.applyDot) {
        e.applyDot(dmgPerSec * 2, 3, tower.type.color || '#aa44ff');
      } else if (e.takeDamage) {
        e.takeDamage(totalDmg);
      }
      hitCount++;
    }
    this.effectSystem?.addBigExplosion?.(tower.x, tower.y, tower.type.color || '#aa44ff', 1.0);
  }
}
