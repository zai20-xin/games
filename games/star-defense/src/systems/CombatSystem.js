// ================================================================
// 战斗系统 - 伤害计算、克制、连击、组合效果、元素克制（性能优化版）
// 优化：空间分区网格、弹道对象池增强、碰撞检测加速
// ================================================================
import { COMBO, ECONOMY, SHAKE, BATTLE } from '../core/Constants.js';
import { Projectile } from '../entities/Projectile.js';
import { getElementBonus } from '../data/ElementConfig.js';

/** 空间网格单元大小（像素）- 约为2个格子，兼顾查询范围和更新开销 */
const GRID_CELL_SIZE = 112;
/** 弹道对象池最大大小 */
const PROJECTILE_POOL_MAX = 100;
/** 共享空组合效果集合（避免热路径每次查询分配新 Set） */
const EMPTY_SYNERGIES = new Set();

export class CombatSystem {
  /**
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('./EffectSystem.js').EffectSystem} effectSystem
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   */
  constructor(eventBus, effectSystem, audio) {
    this.eventBus = eventBus;
    this.effectSystem = effectSystem;
    this.audio = audio;

    /** 弹道数组 */
    this.projectiles = [];

    /** 弹道对象池（性能优化） */
    this._projectilePool = [];

    /** 连击状态 */
    this.comboCount = 0;
    this.comboTimer = 0;

    /** 游戏数据引用（由Game设置） */
    this.energy = 0;
    this.kills = 0;

    /** 当前格子大小（由Game设置） */
    this.cellSize = 56;

    /** 塔系统引用（由Game设置，用于获取组合效果） */
    this.towerSystem = null;

    /** 元游戏进展系统引用 */
    this.meta = null;

    /** 当前关卡元素属性（由Game设置） */
    this.levelElement = null;

    // === 主动技能系统引用（用于过载模式倍率） ===
    this.abilitySystem = null;

    // === 空间分区网格（用于加速碰撞检测/范围查询） ===
    this._grid = null;
    this._gridCols = 0;
    this._gridRows = 0;
    this._gridBuilt = false;

    /** 范围查询复用结果数组（调用方必须同步消费，不得跨帧持有） */
    this._queryResults = [];

    /** 连击事件去重：仅在数量/激活态变化时向 UI 广播 */
    this._lastComboCount = 0;
    this._lastComboActive = false;
  }

  /**
   * 设置主动技能系统
   * @param {import('./AbilitySystem.js').AbilitySystem} abilitySystem
   */
  setAbilitySystem(abilitySystem) {
    this.abilitySystem = abilitySystem;
  }

  /**
   * 设置关卡元素属性
   * @param {string|null} element - 元素标识（fire/earth/wind/water）
   */
  setLevelElement(element) {
    this.levelElement = element;
  }

  /**
   * 设置格子大小
   */
  setCellSize(size) {
    this.cellSize = size;
    this._gridBuilt = false; // 网格尺寸依赖cellSize，需要重建
  }

  /**
   * 设置游戏数据引用
   */
  setGameData(data) {
    this.gameData = data;
  }

  /**
   * 设置塔系统引用
   */
  setTowerSystem(towerSystem) {
    this.towerSystem = towerSystem;
  }

  /**
   * 设置元游戏进展系统引用
   */
  setMetaProgression(meta) {
    this.meta = meta;
  }

  /**
   * 设置游戏实例引用
   * @param {Object} game
   */
  setGame(game) {
    this.game = game;
  }

  /**
   * 构建空间分区网格（每帧调用一次，在处理攻击前）
   * 将敌人按位置分配到网格单元中，加速范围查询
   * @param {Array<Enemy>} enemies
   * @param {number} gridW - 地图宽度（像素）
   * @param {number} gridH - 地图高度（像素）
   */
  _buildSpatialGrid(enemies, gridW, gridH) {
    const cellSize = GRID_CELL_SIZE;
    this._gridCols = Math.ceil(gridW / cellSize) + 1;
    this._gridRows = Math.ceil(gridH / cellSize) + 1;

    // 重用已有网格数组或创建新的
    if (!this._grid || this._grid.length !== this._gridCols * this._gridRows) {
      this._grid = new Array(this._gridCols * this._gridRows);
      for (let i = 0; i < this._grid.length; i++) {
        this._grid[i] = [];
      }
    } else {
      // 清空所有单元格
      for (let i = 0; i < this._grid.length; i++) {
        this._grid[i].length = 0;
      }
    }

    // 将敌人分配到对应单元格
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const col = Math.max(0, Math.min(this._gridCols - 1, Math.floor(e.x / cellSize)));
      const row = Math.max(0, Math.min(this._gridRows - 1, Math.floor(e.y / cellSize)));
      this._grid[row * this._gridCols + col].push(e);
    }
    this._gridBuilt = true;
  }

  /**
   * 查询圆形范围内的敌人（使用空间网格加速）
   * 性能：结果写入复用数组并返回，调用方必须同步消费（下一帧/下一次查询会覆盖）
   * @param {number} x - 圆心X
   * @param {number} y - 圆心Y
   * @param {number} radius - 半径
   * @param {Array<Enemy>} [exclude] - 排除的敌人列表
   * @returns {Array<Enemy>}
   */
  _queryEnemiesInRadius(x, y, radius, exclude = null) {
    const results = this._queryResults;
    results.length = 0;
    if (!this._gridBuilt || !this._grid) {
      return results;
    }
    const cellSize = GRID_CELL_SIZE;
    const r = radius;
    const minCol = Math.max(0, Math.floor((x - r) / cellSize));
    const maxCol = Math.min(this._gridCols - 1, Math.floor((x + r) / cellSize));
    const minRow = Math.max(0, Math.floor((y - r) / cellSize));
    const maxRow = Math.min(this._gridRows - 1, Math.floor((y + r) / cellSize));
    const rSq = r * r;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cell = this._grid[row * this._gridCols + col];
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const e = cell[i];
          if (!e.alive) continue;
          if (exclude && exclude.includes(e)) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= rSq) {
            results.push(e);
          }
        }
      }
    }
    return results;
  }

  /**
   * 更新战斗系统
   * @param {number} dt - 时间增量
   * @param {Array<Tower>} towers - 塔数组
   * @param {Array<Enemy>} enemies - 敌人数组
   */
  update(dt, towers, enemies) {
    // 更新连击
    this._updateCombo(dt);

    // 构建空间分区网格（用于弹道溅射范围查询）
    // 估算地图尺寸：用敌人最大位置或cellSize推算
    const mapW = this.cellSize * 15; // 安全估算
    const mapH = this.cellSize * 10;
    this._buildSpatialGrid(enemies, mapW, mapH);

    // 更新弹道
    this._updateProjectiles(dt, enemies);
  }

  /**
   * 处理塔的攻击逻辑
   * @param {Tower} tower - 防御塔
   * @param {Array<Enemy>} enemies - 敌人数组
   */
  processTowerAttack(tower, enemies, dt = 0.016) {
    // 每帧更新塔动画状态（所有塔都需要）
    if (tower.updateAnimation) tower.updateAnimation(dt);

    // 放置动画
    if (tower.placeAnim > 0) {
      tower.placeAnim -= dt;
      if (tower.placeAnim < 0) tower.placeAnim = 0;
    }

    // 能量采集器 - 也需要待机动画
    if (tower.type.supportType === 'energy') {
      return; // 由TowerSystem处理
    }

    // 非攻击塔跳过（但仍更新动画）
    if (tower.type.type !== 'attack') return;

    // 冷却
    tower.cooldown -= dt;

    // 寻找目标（使用空间网格加速）
    const target = this._findTarget(tower, enemies);
    if (!target) {
      tower.cooldown = 0;
      return;
    }

    // 持续更新炮塔朝向目标
    if (tower.aimAtTarget) tower.aimAtTarget(target);

    if (tower.cooldown > 0) return;

    // 获取组合效果
    const synergs = this.towerSystem ? this.towerSystem.getTowerSynergies(tower) : EMPTY_SYNERGIES;

    // 组合效果：超导冷冻 - 电磁塔攻击速度+20%
    let fireRate = tower.getFireRate();
    if (synergs.has('speed_boost') && tower.type.attackType === 'tesla') {
      fireRate *= 0.8;
    }
    // 元游戏攻速加成
    if (this.meta) {
      fireRate *= this.meta.getTowerModifiers().fireRateMult;
    }
    // 过载模式
    if (this.abilitySystem && this.abilitySystem.isOverloaded(tower)) {
      fireRate *= 0.333;
    }
    tower.cooldown = fireRate;

    // 确保空间网格已构建（延迟构建，兼容外部调用）
    if (!this._gridBuilt) {
      const mapW = this.cellSize * 15;
      const mapH = this.cellSize * 10;
      this._buildSpatialGrid(enemies, mapW, mapH);
    }

    // 触发攻击动画
    if (tower.triggerAttackAnim) tower.triggerAttackAnim(target);

    // 发射攻击
    switch (tower.type.attackType) {
      case 'laser':
        this._fireLaser(tower, target, enemies, synergs);
        break;
      case 'tesla':
        this._fireTesla(tower, target, enemies, synergs);
        break;
      case 'missile':
        this._fireMissile(tower, target, synergs);
        break;
      case 'cryo':
        this._fireCryo(tower, target, synergs);
        break;
      case 'plasma':
        this._firePlasma(tower, target, enemies, synergs);
        break;
    }
  }

  /**
   * 寻找最佳目标（使用空间网格加速范围查询）
   */
  _findTarget(tower, enemies) {
    let target = null;
    let bestProgress = -1;
    let rangePx = tower.getRange();

    const synergs = this.towerSystem ? this.towerSystem.getTowerSynergies(tower) : EMPTY_SYNERGIES;
    if (synergs.has('range_boost') && tower.type.attackType === 'laser') {
      rangePx += this.cellSize;
    }
    if (this.meta) {
      rangePx *= this.meta.getTowerModifiers().rangeMult;
    }

    const tx = tower.x;
    const ty = tower.y;

    // 优先使用空间网格查询范围内敌人
    if (this._gridBuilt && this._grid) {
      const candidates = this._queryEnemiesInRadius(tx, ty, rangePx);
      const rangeSq = rangePx * rangePx;
      for (let i = 0; i < candidates.length; i++) {
        const e = candidates[i];
        if (!e.alive || !tower.canAttack(e) || e.stealthed) continue;
        // 网格查询可能包含边界外的敌人，二次确认
        const dx = e.x - tx;
        const dy = e.y - ty;
        if (dx * dx + dy * dy <= rangeSq && e.progress > bestProgress) {
          bestProgress = e.progress;
          target = e;
        }
      }
      if (target) return target;
    }

    // 回退：全量遍历（网格未构建时）
    const rangeSq = rangePx * rangePx;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || !tower.canAttack(e) || e.stealthed) continue;
      const dx = e.x - tx;
      const dy = e.y - ty;
      if (dx * dx + dy * dy <= rangeSq && e.progress > bestProgress) {
        bestProgress = e.progress;
        target = e;
      }
    }

    return target;
  }

  /**
   * 造成伤害
   * @param {Enemy} enemy - 目标敌人
   * @param {number} damage - 原始伤害
   * @param {Tower|null} tower - 攻击塔
   * @returns {number} 实际伤害
   */
  dealDamage(enemy, damage, tower) {
    if (!enemy.alive) return 0;

    // 组合效果：电磁护盾
    if (tower && this.towerSystem) {
      const synergs = this.towerSystem.getTowerSynergies(tower);
      if (synergs.has('shield_damage') && tower.shielded) {
        damage *= BATTLE.SHIELD_DAMAGE_BOOST;
      }
      if (synergs.has('damage_boost') && tower.type.attackType === 'tesla') {
        damage *= BATTLE.TESLA_DAMAGE_BOOST;
      }
    }

    // 元素克制加成
    if (tower && this.levelElement) {
      const elementBonus = getElementBonus(tower.type.id, this.levelElement);
      damage *= elementBonus;
    }

    // 基础暴击
    let isCrit = false;
    let baseCrit = false;
    if (Math.random() < BATTLE.BASE_CRIT_CHANCE) {
      damage *= BATTLE.CRIT_MULTIPLIER;
      isCrit = true;
      baseCrit = true;
    }

    // 元游戏暴击
    if (this.meta && tower) {
      const mods = this.meta.getTowerModifiers();
      if (Math.random() < mods.critChance) {
        damage *= mods.critMult;
        isCrit = true;
      }
    }

    const actualDamage = enemy.takeDamage(damage);

    // 暴击慢动作
    if (isCrit && actualDamage > 0) {
      this.game?.hitStop?.(0.04, 0.3);
    }

    // Game Feel
    if (actualDamage > 0) {
      if (actualDamage >= 100) {
        this.game?.screenShake?.shake(6, 0.2);
        this.game?.hitStop?.(0.08);
      } else if (actualDamage >= 60) {
        this.game?.screenShake?.shake(4, 0.15);
      } else if (actualDamage >= 30) {
        this.game?.screenShake?.shake(2, 0.1);
      }
      this.game?.audioSystem?.play('hit');
    }

    // 击退效果
    if (actualDamage > enemy.maxHp * BATTLE.KNOCKBACK_THRESHOLD) {
      const pathIdx = enemy.pathIndex || 0;
      if (pathIdx > 0 && enemy.path) {
        const prevPoint = enemy.path[pathIdx - 1];
        const dx = prevPoint.c * enemy.cellSize + enemy.cellSize / 2 - enemy.x;
        const dy = prevPoint.r * enemy.cellSize + enemy.cellSize / 2 - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const kbx = (dx / dist) * BATTLE.KNOCKBACK_DISTANCE;
        const kby = (dy / dist) * BATTLE.KNOCKBACK_DISTANCE;
        enemy.x += kbx;
        enemy.y += kby;
        // 设置击退方向供渲染使用
        enemy.knockbackDx = kbx;
        enemy.knockbackDy = kby;
      }
    }

    this.eventBus.emit('game:hit', {
      damage: actualDamage,
      isCrit,
      isBoss: enemy.type === 'boss',
      x: enemy.x,
      y: enemy.y,
    });

    // 护甲碎片特效
    if (enemy.armor > 0 && actualDamage < damage) {
      this.effectSystem.addArmorFragmentEffect(enemy.x, enemy.y);
    }

    // 伤害数字
    let dmgColor, dmgBig, dmgMega;
    if (baseCrit) {
      dmgColor = '#ff9944';
      dmgBig = true;
      dmgMega = actualDamage >= 100;
    } else if (enemy.armor > 0 && actualDamage < damage) {
      dmgColor = '#999999';
      dmgBig = false;
      dmgMega = false;
    } else {
      dmgColor = null;
      dmgBig = false;
      dmgMega = false;
    }
    this.effectSystem.addDamageNumber(enemy.x, enemy.y, actualDamage, dmgColor, dmgBig, dmgMega);

    // 受击火花
    const sparkColor = baseCrit ? '#ff9944'
      : (enemy.armor > 0 && actualDamage < damage ? '#bbbbbb'
        : (actualDamage >= 100 ? '#ffd966' : (actualDamage >= 30 ? '#ffdd66' : '#ffcc88')));
    this.effectSystem.addHitSpark(enemy.x, enemy.y, sparkColor, dmgMega ? 1.8 : (dmgBig ? 1.3 : 1));

    // 击杀处理
    if (!enemy.alive) {
      if (enemy.maxHp > 100 && this.effectSystem && this.effectSystem.shakePreset) {
        this.effectSystem.shakePreset(SHAKE.BIG_HIT);
      }
      this._onEnemyKilled(enemy);
    }

    return actualDamage;
  }

  /**
   * 敌人被击杀
   */
  _onEnemyKilled(enemy) {
    if (this.gameData) {
      this.gameData.kills++;

      this.comboCount++;
      this.comboTimer = COMBO.TIMEOUT;

      let bonusEnergy = enemy.reward;
      if (this.comboCount >= COMBO.BONUS_THRESHOLD) {
        bonusEnergy += COMBO.BONUS_ENERGY;
      }

      if (this.meta) {
        const buffs = this.meta.getBuffs();
        if (buffs.killEnergy) {
          bonusEnergy += buffs.killEnergy;
        }
      }

      if (COMBO.TIER_BONUS && COMBO.TIER_BONUS.length > 0) {
        for (const tier of COMBO.TIER_BONUS) {
          if (this.comboCount === tier.count) {
            bonusEnergy += tier.energy;
            this.effectSystem?.addDamageNumber?.(
              enemy.x, enemy.y - 20, tier.energy, '#ffdd44', true, true
            );
            break;
          }
        }
      }

      this.gameData.energy = Math.min(ECONOMY.MAX_ENERGY, this.gameData.energy + bonusEnergy);

      if (enemy.type === 'boss') {
        this.effectSystem.shake(SHAKE.BOSS_DEATH.intensity, SHAKE.BOSS_DEATH.timer);
        this.audio.play('explosion');
      } else if (enemy.type === 'virusking') {
        this.effectSystem.shake(SHAKE.BOSS_DEATH.intensity * 1.5, SHAKE.BOSS_DEATH.timer * 1.5);
        this.audio.play('explosion');
        setTimeout(() => {
          this.effectSystem.addExplosion(enemy.x - 15, enemy.y - 10, '#ff4466', 1.2);
          this.effectSystem.addExplosion(enemy.x + 15, enemy.y + 10, '#ffcc44', 1.0);
        }, 100);
      }

      this.audio.play('kill');
      this.game?.screenShake?.shake(1, 0.05);
      this.eventBus.emit('ui:update', null);
    }

    this.effectSystem.addExplosion(enemy.x, enemy.y, enemy.color, enemy.size);
  }

  /**
   * 更新连击
   * 性能：仅在连击数/激活态变化时广播事件，避免每帧分配事件对象并触发 UI DOM 写入
   */
  _updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboTimer = 0;
      }
    }

    const active = this.comboCount >= COMBO.DISPLAY_THRESHOLD;
    if (this.comboCount !== this._lastComboCount || active !== this._lastComboActive) {
      this._lastComboCount = this.comboCount;
      this._lastComboActive = active;
      this.eventBus.emit('combo:update', {
        count: this.comboCount,
        active
      });
    }
  }

  /**
   * 更新弹道（使用空间网格加速溅射伤害范围查询）
   */
  _updateProjectiles(dt, enemies) {
    const projectiles = this.projectiles;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      const hit = p.update(dt);
      if (hit) {
        let splashRadius = p.splashRadius;
        if (p.tower && this.towerSystem) {
          const synergs = this.towerSystem.getTowerSynergies(p.tower);
          if (synergs.has('aoe_boost')) {
            splashRadius *= BATTLE.MISSILE_AOE_BOOST;
          }
        }

        // 使用空间网格查询溅射范围内的敌人（替代全量遍历）
        const splashEnemies = this._gridBuilt
          ? this._queryEnemiesInRadius(p.x, p.y, splashRadius)
          : enemies;

        const splashRadiusSq = splashRadius * splashRadius;
        for (let j = 0; j < splashEnemies.length; j++) {
          const e = splashEnemies[j];
          if (!e.alive) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= splashRadiusSq) {
            const dist = Math.sqrt(distSq);
            this.dealDamage(e, p.damage * (1 - dist / splashRadius * BATTLE.SPLASH_FALLOFF), p.tower || null);
            if (p.tower && this.towerSystem) {
              const synergs = this.towerSystem.getTowerSynergies(p.tower);
              if (synergs.has('freeze_missile')) {
                e.applySlow(BATTLE.FREEZE_MISSILE_SLOW, BATTLE.FREEZE_MISSILE_DURATION);
              }
            }
            if (p.tower && p.tower.getFreezeChance) {
              const freezeChance = p.tower.getFreezeChance();
              if (freezeChance > 0 && Math.random() < freezeChance) {
                e.applySlow(BATTLE.FREEZE_CHANCE_SLOW, BATTLE.FREEZE_CHANCE_DURATION);
              }
            }
          }
        }
        this.effectSystem.addMissileExplosion(p.x, p.y, splashRadius);
        this.effectSystem.shake(SHAKE.MISSILE_EXPLODE.intensity, SHAKE.MISSILE_EXPLODE.timer);
        this.audio.play('explosion');
      }
    }

    // 更新尾迹
    for (let i = 0; i < projectiles.length; i++) {
      projectiles[i].updateTrail(dt);
    }

    // swap-and-pop 清理已死亡弹道（回收至对象池）
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (!projectiles[i].alive) {
        const dead = projectiles[i];
        // 回收前释放尾迹
        dead.dispose();
        if (this._projectilePool.length < PROJECTILE_POOL_MAX) {
          this._projectilePool.push(dead);
        }
        projectiles[i] = projectiles[projectiles.length - 1];
        projectiles.pop();
      }
    }
  }

  /**
   * 从对象池获取或创建弹道
   */
  _acquireProjectile(type, x, y, target, damage, splashRadius, color) {
    let proj;
    if (this._projectilePool.length > 0) {
      proj = this._projectilePool.pop();
      proj.reset(type, x, y, target, damage, splashRadius, color);
    } else {
      proj = new Projectile(type, x, y, target, damage, splashRadius, color);
    }
    return proj;
  }

  // === 攻击方法 ===

  _fireLaser(tower, target, enemies, synergs) {
    let damage = tower.getDamage();
    if (this.meta) damage *= this.meta.getTowerModifiers().damageMult;

    if (synergs.has('freeze_boost')) {
      damage *= BATTLE.LASER_DAMAGE_BOOST;
    }

    this.dealDamage(target, damage, tower);

    // 穿透射击（使用空间网格查询身后敌人）
    const pierceChance = tower.getPierce ? tower.getPierce() : 0;
    if (pierceChance > 0 && Math.random() < pierceChance) {
      const pierceRange = this.cellSize * BATTLE.PIERCE_RANGE_CELLS;
      const candidates = this._gridBuilt
        ? this._queryEnemiesInRadius(target.x, target.y, pierceRange, [target])
        : enemies;
      const pierceRangeSq = pierceRange * pierceRange;
      for (let i = 0; i < candidates.length; i++) {
        const e = candidates[i];
        if (e === target || !e.alive) continue;
        const dx = e.x - target.x;
        const dy = e.y - target.y;
        if (dx * dx + dy * dy <= pierceRangeSq) {
          this.dealDamage(e, damage * BATTLE.PIERCE_DAMAGE_MULT, tower);
          this.effectSystem.addLaserEffect(target.x, target.y, e.x, e.y, tower.type.color);
          break;
        }
      }
    }

    if (synergs.has('slow_on_hit')) {
      target.applySlow(BATTLE.SLOW_ON_HIT_FACTOR, BATTLE.SLOW_ON_HIT_DURATION);
    }

    if (synergs.has('freeze_boost')) {
      target.applySlow(BATTLE.FREEZE_BOOST_SLOW, BATTLE.FREEZE_BOOST_DURATION);
    }

    this.effectSystem.addLaserEffect(tower.x, tower.y, target.x, target.y, tower.type.color);
    this.audio.playTowerFire('laser', tower.level);
  }

  _fireTesla(tower, target, enemies, synergs) {
    let damage = tower.getDamage();
    if (this.meta) damage *= this.meta.getTowerModifiers().damageMult;
    const hitEnemies = [target];
    this.dealDamage(target, damage, tower);

    // 链式攻击（使用空间网格查找最近的未命中敌人）
    const chainCount = BATTLE.TESLA_CHAIN_COUNT + (tower.getChainBonus ? tower.getChainBonus() : 0);
    const chainRange = this.cellSize * 2;
    for (let i = 0; i < chainCount; i++) {
      const lastHit = hitEnemies[hitEnemies.length - 1];
      let chainTarget = null;
      let chainDistSq = chainRange * chainRange;

      // 使用空间网格查询附近敌人
      const candidates = this._gridBuilt
        ? this._queryEnemiesInRadius(lastHit.x, lastHit.y, chainRange, hitEnemies)
        : enemies;

      for (let j = 0; j < candidates.length; j++) {
        const e = candidates[j];
        if (!e.alive || hitEnemies.includes(e)) continue;
        const dx = e.x - lastHit.x;
        const dy = e.y - lastHit.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < chainDistSq) {
          chainDistSq = distSq;
          chainTarget = e;
        }
      }

      if (chainTarget) {
        hitEnemies.push(chainTarget);
        this.dealDamage(chainTarget, damage * BATTLE.CHAIN_DAMAGE_MULT, tower);
      }
    }

    const points = [{ x: tower.x, y: tower.y }];
    hitEnemies.forEach(e => points.push({ x: e.x, y: e.y }));
    this.effectSystem.addTeslaEffect(points, tower.type.color);

    hitEnemies.forEach((e, idx) => {
      const isMain = idx === 0;
      const scale = isMain ? 1.0 : 0.75 + (tower.level - 1) * 0.05;
      this.effectSystem.addPixelBoltEffect(e.x, e.y, scale, isMain);
    });

    this.audio.playTowerFire('tesla', tower.level);
  }

  _fireMissile(tower, target, synergs) {
    const damage = tower.getDamage() * (this.meta ? this.meta.getTowerModifiers().damageMult : 1);
    const splashMult = tower.getSplashMult ? tower.getSplashMult() : 1;
    const baseSplashRadius = this.cellSize * 0.8 * splashMult;
    const proj = this._acquireProjectile(
      'missile',
      tower.x, tower.y,
      target,
      damage,
      baseSplashRadius,
      tower.type.color
    );
    proj.tower = tower;
    this.projectiles.push(proj);
    this.audio.playTowerFire('missile', tower.level);
  }

  _fireCryo(tower, target, synergs) {
    let damage = tower.getDamage();
    if (this.meta) damage *= this.meta.getTowerModifiers().damageMult;
    this.dealDamage(target, damage, tower);
    target.applySlow(BATTLE.SLOW_FACTOR_ICE, BATTLE.SLOW_DURATION_ICE);

    const freezeChance = tower.getFreezeChance ? tower.getFreezeChance() : 0;
    if (freezeChance > 0 && Math.random() < freezeChance) {
      target.applySlow(BATTLE.FREEZE_CHANCE_SLOW, BATTLE.FREEZE_CHANCE_DURATION_CRYO);
      this.effectSystem?.addHitSpark?.(target.x, target.y, '#aaddff', 1.5);
    }

    this.effectSystem.addCryoBeamEffect(tower.x, tower.y, target.x, target.y);
    this.audio.playTowerFire('cryo', tower.level);
  }

  /**
   * 等离子炮攻击 - 无视50%护甲
   */
  _firePlasma(tower, target, enemies, synergs) {
    let damage = tower.getDamage();
    if (this.meta) damage *= this.meta.getTowerModifiers().damageMult;

    if (synergs.has('damage_boost') && tower.type.attackType === 'plasma') {
      damage *= 1.25;
    }

    if (this.levelElement) {
      const elementBonus = getElementBonus(tower.type.id, this.levelElement);
      damage *= elementBonus;
    }

    const effectiveArmor = target.armor * BATTLE.PLASMA_ARMOR_PIERCE;
    damage = damage * (1 - effectiveArmor);

    const actualDamage = target.takeDamage(damage);

    this.eventBus.emit('game:hit', {
      damage: actualDamage,
      isCrit: false,
      isBoss: target.type === 'boss',
      x: target.x,
      y: target.y,
    });

    const dmgColor = actualDamage > 50 ? '#ff99bb' : null;
    const dmgBig = actualDamage > 30;
    const dmgMega = actualDamage > 80;
    this.effectSystem.addDamageNumber(target.x, target.y, actualDamage, dmgColor, dmgBig, dmgMega);
    this.effectSystem.addHitSpark(target.x, target.y, dmgColor || '#ffaa66', dmgMega ? 1.6 : (dmgBig ? 1.3 : 1));

    // 范围溅射（使用空间网格加速）
    const splashRadiusCells = tower.getSplashRadius ? tower.getSplashRadius() : 0;
    if (splashRadiusCells > 0) {
      const splashRadiusPx = splashRadiusCells * this.cellSize;
      const candidates = this._gridBuilt
        ? this._queryEnemiesInRadius(target.x, target.y, splashRadiusPx, [target])
        : enemies;
      const splashRadiusSq = splashRadiusPx * splashRadiusPx;
      for (let i = 0; i < candidates.length; i++) {
        const e = candidates[i];
        if (e === target || !e.alive) continue;
        const dx = e.x - target.x;
        const dy = e.y - target.y;
        if (dx * dx + dy * dy <= splashRadiusSq) {
          const splashDmg = damage * BATTLE.PLASMA_SPLASH_DAMAGE_MULT * (1 - e.armor * BATTLE.PLASMA_SPLASH_ARMOR_MULT);
          e.takeDamage(splashDmg);
          this.effectSystem.addDamageNumber(e.x, e.y, Math.floor(splashDmg), '#ff88aa', false, false);
          if (!e.alive) this._onEnemyKilled(e);
        }
      }
      this.effectSystem.addMissileExplosion(target.x, target.y, splashRadiusPx);
    }

    if (!target.alive) {
      this._onEnemyKilled(target);
    }

    this.effectSystem.addPlasmaEffect(tower.x, tower.y, target.x, target.y);
    this.audio.playTowerFire('laser', tower.level);
  }

  /**
   * 清除所有弹道
   */
  clear() {
    // 回收所有弹道到对象池
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].dispose();
      if (this._projectilePool.length < PROJECTILE_POOL_MAX) {
        this._projectilePool.push(this.projectiles[i]);
      }
    }
    this.projectiles = [];
    this.comboCount = 0;
    this.comboTimer = 0;
    this._lastComboCount = 0;
    this._lastComboActive = false;
    this._gridBuilt = false;
  }
}
