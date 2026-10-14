// ================================================================
// 敌人管理系统 - 生成、移动、清理、能量宝珠掉落（支持多路径、特殊机制）
// ================================================================
import { Enemy } from '../entities/Enemy.js';
import { ENEMY_BASE } from '../data/EnemyTypes.js';
import { ECONOMY, SHAKE } from '../core/Constants.js';

export class EnemySystem {
  /**
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('../map/GameMap.js').GameMap} gameMap
   * @param {import('../audio/AudioManager.js').AudioManager} [audio]
   * @param {import('./BossPhaseSystem.js').BossPhaseSystem} [bossPhaseSystem] - P2-6 多阶段 Boss 抽象
   */
  constructor(eventBus, gameMap, audio = null, bossPhaseSystem = null) {
    this.eventBus = eventBus;
    this.gameMap = gameMap;

    /** 音频引用（可选） */
    this.audio = audio;

    /** P2-6: 多阶段 Boss 系统引用（可选） */
    this.bossPhaseSystem = bossPhaseSystem;

    /** @type {Enemy[]} 敌人数组 */
    this.enemies = [];

    /** 能量宝珠数组 */
    this.energyOrbs = [];

    /** 游戏数据引用 */
    this.gameData = null;

    /** 当前关卡特殊机制 */
    this.levelMechanic = null;

    /** 塔系统引用（由Game设置，用于自爆虫爆炸效果） */
    this.towerSystem = null;

    /** Agent C: 特效系统引用（用于 boss 大爆炸） */
    this.effectSystem = null;

    /** 敌人数组 */
    this._enemyPool = [];

    /** Agent A9 P2-9: 元游戏引用（用于写入 meta.codex） */
    this.meta = null;

    /** Agent A9 P2-9: 本局已记录 firstSeen 的敌人类型 Set（避免重复触发） */
    this._firstSeen = new Set();

    // Agent C: 监听 boss 阶段切换事件
    if (eventBus) {
      eventBus.on('boss:phaseChange', (data) => {
        this._handleBossPhaseChange(data);
      });
    }
  }

  /**
   * 设置音频引用
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   */
  setAudio(audio) {
    this.audio = audio;
  }

  /**
   * Agent C: 设置特效系统引用
   * @param {import('./EffectSystem.js').EffectSystem} effectSystem
   */
  setEffectSystem(effectSystem) {
    this.effectSystem = effectSystem;
  }

  /**
   * Agent A9 P2-9: 设置元游戏引用（用于写入 meta.codex）
   * @param {import('./MetaProgression.js').MetaProgression} meta
   */
  setMeta(meta) {
    this.meta = meta;
  }

  /**
   * 回收敌人到对象池
   */
  _recycleEnemy(enemy) {
    // 重置状态（reset() 已定义）
    // 这里只做入池，reset 在复用时会调用
    this._enemyPool.push(enemy);
  }

  /**
   * 设置游戏数据引用
   */
  setGameData(data) {
    this.gameData = data;
  }

  /**
   * 设置关卡特殊机制
   * @param {string|null} mechanic - 机制标识
   */
  setLevelMechanic(mechanic) {
    this.levelMechanic = mechanic;
  }

  /**
   * 设置塔系统引用
   * @param {import('./TowerSystem.js').TowerSystem} towerSystem
   */
  setTowerSystem(towerSystem) {
    this.towerSystem = towerSystem;
  }

  /**
   * 更新敌人系统
   * @param {number} dt - 时间增量
   * @returns {number} 本帧穿过终点的敌人数
   */
  update(dt) {
    let leakedCount = 0;

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (!enemy.alive) {
        if (enemy.deathAnim !== undefined && enemy.deathAnim > 0) {
          enemy.move(dt, enemy.path);
        }
        continue;
      }
      const reached = enemy.move(dt, enemy.path);
      if (reached) {
        leakedCount++;
      }

      if (enemy.stealthed) {
        enemy.stealthTimer -= dt;
        if (enemy.stealthTimer <= 0) {
          enemy.stealthed = false;
        }
      }

      // === Agent F: 治疗虫：根据自身 healInterval 治疗周围友军（用距离平方避免sqrt） ===
      if (enemy.type === 'healer' && enemy.alive && enemy.healInterval > 0) {
        if (enemy.healTimer >= enemy.healInterval) {
          enemy.healTimer = 0;
          const r = enemy.healRadius || 60;
          const healRangeSq = r * r;
          for (let j = 0; j < this.enemies.length; j++) {
            const ally = this.enemies[j];
            if (ally === enemy || !ally.alive) continue;
            const dx = ally.x - enemy.x;
            const dy = ally.y - enemy.y;
            if (dx * dx + dy * dy <= healRangeSq) {
              const healAmt = ally.maxHp * (enemy.healPct || 0.05);
              ally.hp = Math.min(ally.maxHp, ally.hp + healAmt);
            }
          }
        }
      }
    }

    // 冰霜魔像减速光环：只遍历冰霜魔像，再对范围内的敌人减速
    const auraRangeSq = 80 * 80;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.type !== 'ice_golem' || !e.alive) continue;
      for (let j = 0; j < this.enemies.length; j++) {
        const other = this.enemies[j];
        if (other === e || !other.alive) continue;
        const dx = other.x - e.x;
        const dy = other.y - e.y;
        if (dx * dx + dy * dy < auraRangeSq) {
          other.slowTimer = Math.max(other.slowTimer, 0.5);
        }
      }
    }

    // 处理穿过的敌人
    if (leakedCount > 0 && this.gameData) {
      this.gameData.hp -= leakedCount;
      if (this.gameData.hp < 0) this.gameData.hp = 0;
      // 敌人到达基地的轰鸣（每只敌人到达时播一次，因 50ms 节流会自然限频）
      this.audio?.play('reachBase');
      // 玩家扣血音效（每帧最多一次；多次扣血会因节流合并）
      this.audio?.play('loseLife');
      // === Agent A2 P1-3: 敌人到达基地时调用 SHAKE.BASE_DAMAGE ===
      this.effectSystem?.shakePreset?.(SHAKE.BASE_DAMAGE);
      this.eventBus.emit('enemy:leaked', { count: leakedCount });
      this.eventBus.emit('ui:update', null);
    }

    // 清理死亡敌人（in-place，避免每帧filter创建新数组）
    let writeIdx = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive && e.hp <= 0) {
        if (Math.random() < ECONOMY.ENERGY_ORB_DROP_CHANCE) {
          this._spawnEnergyOrb(e.x, e.y);
        }
        if (e.type === 'bomber') {
          this._handleBomberDeath(e);
        }
        if (e.type === 'splitter') {
          this._handleSplitterDeath(e);
        }
        // Agent F: 爆裂虫死亡分裂成 2 个小型爆裂虫
        if (e.type === 'swarm' && e.shouldSplit) {
          this._handleSwarmDeath(e);
        }
        // Agent C: Boss 死亡钩子（大爆炸 + 震动 + 胜利音效）
        if (e.isBoss) {
          this._handleBossDeath(e);
        }
        // P2-6: 从 BossPhaseSystem 取消注册（释放内存）
        if (this.bossPhaseSystem && e._bossPhaseSystem === this.bossPhaseSystem) {
          this.bossPhaseSystem.unregister(e);
        }
        this._recycleEnemy(e);
      } else if (e.alive) {
        this.enemies[writeIdx++] = e;
      } else {
        // 死亡动画中的敌人保留
        this.enemies[writeIdx++] = e;
      }
    }
    this.enemies.length = writeIdx;

    return leakedCount;
  }

  /**
   * 生成敌人（支持多路径、特殊机制）
   * @param {string} type - 敌人类型
   * @param {Object} stats - 敌人属性
   * @param {number|null} pathIndex - 指定路径索引（null则自动选择）
   */
  spawnEnemy(type, stats, pathIndex = null) {
    const paths = this.gameMap.getPaths();
    const cellSize = this.gameMap.cell;

    // 多路径关卡：随机选择入口路径
    let selectedPathIndex;
    if (pathIndex !== null) {
      selectedPathIndex = pathIndex;
    } else if (paths.length > 1) {
      // 多路径关卡：随机选择第一条或第二条路径（入口路径）
      selectedPathIndex = Math.floor(Math.random() * Math.min(2, paths.length));
    } else {
      selectedPathIndex = 0;
    }

    const path = paths[selectedPathIndex];
    if (!path || path.length === 0) return;

    const start = path[0];
    const startX = start.c * cellSize + cellSize / 2;
    const startY = start.r * cellSize + cellSize / 2;

    // 应用特殊机制修改敌人属性
    const modifiedStats = { ...stats };

    // 白羊座：速度加成——敌人速度×1.5
    if (this.levelMechanic === 'speed_boost') {
      modifiedStats.speed = stats.speed * 1.5;
    }

    // 金牛座：坦克敌人——敌人血量×1.8
    if (this.levelMechanic === 'tank_enemies') {
      modifiedStats.hp = Math.floor(stats.hp * 1.8);
      modifiedStats.maxHp = modifiedStats.hp;
    }

    let enemy;
    if (this._enemyPool.length > 0) {
      enemy = this._enemyPool.pop();
      enemy.reset(type, modifiedStats, startX, startY, cellSize, path, this.eventBus);
    } else {
      enemy = new Enemy(type, modifiedStats, startX, startY, cellSize, path, this.eventBus);
    }
    // Agent F: 注入 EnemySystem 引用（供 healer 跨敌人治疗等用）
    enemy.setEnemySystem(this);

    // 隐形刺客：初始隐形3秒
    if (type === 'stealth') {
      enemy.stealthed = true;
      enemy.stealthTimer = 3;
    }

    this.enemies.push(enemy);
    // 敌人从传送门出现的低频冒泡音效
    this.audio?.play('spawn');

    // Agent C: Boss 出现时加重型音效 + 屏幕震动
    if (enemy.isBoss) {
      this.audio?.play('explosion');
      // === Agent A2 P1-3: Boss 出现时调用 SHAKE.BOSS_PHASE ===
      if (this.effectSystem) {
        this.effectSystem.shakePreset(SHAKE.BOSS_PHASE);
      }
      // === P2-6: 注册到 BossPhaseSystem（多阶段抽象）===
      if (this.bossPhaseSystem) {
        const phases = this.bossPhaseSystem.getDefaultPhases(enemy);
        if (phases) {
          const aura = this.bossPhaseSystem.getAuraColor(enemy);
          this.bossPhaseSystem.register(enemy, phases, aura);
          enemy._bossPhaseSystem = this.bossPhaseSystem;
        }
      }
    }

    // === Agent A9 P2-9: 第一次遇到该敌人类型 → emit firstSeen + 写 meta.codex ===
    this._maybeEmitFirstSeen(type);

    this.eventBus.emit('enemy:spawned', enemy);
  }

  /**
   * Agent A9 P2-9: 第一次遇到某敌人类型时
   *   - 写入 meta.codex[type] = true（持久化）
   *   - 广播 enemy:firstSeen 事件（供 CodexOverlay 弹图鉴卡）
   *   - 用 _firstSeen Set 本局去重，避免重复弹卡
   * @param {string} type
   */
  _maybeEmitFirstSeen(type) {
    if (!type || this._firstSeen.has(type)) return;
    this._firstSeen.add(type);

    // 1) 写入 meta.codex
    if (this.meta && this.meta.profile) {
      const profile = this.meta.profile;
      if (!profile.codex) profile.codex = {};
      if (!profile.codex[type]) {
        profile.codex[type] = true;
        // 持久化（profile.save() 会写入 localStorage）
        if (typeof profile.save === 'function') {
          try { profile.save(); } catch (e) { /* ignore */ }
        }
      }
    }

    // 2) 广播 firstSeen 事件
    if (this.eventBus) {
      this.eventBus.emit('enemy:firstSeen', { type });
    }
  }

  /**
   * Agent A9 P2-9: 重置本局 firstSeen 集合（新关开始时调用）
   * 注意：meta.codex 不重置，跨局累计
   */
  resetFirstSeen() {
    this._firstSeen = new Set();
  }

  /**
   * 生成能量宝珠
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   */
  _spawnEnergyOrb(x, y) {
    const jitter = ECONOMY.ENERGY_ORB_JITTER;
    this.energyOrbs.push({
      x: x + (Math.random() - 0.5) * jitter * 2,
      y: y + (Math.random() - 0.5) * jitter * 2,
      alive: true,
      life: ECONOMY.ENERGY_ORB_LIFETIME
    });
  }

  /**
   * 收集能量宝珠
   * @param {number} mx - 鼠标X坐标
   * @param {number} my - 鼠标Y坐标
   * @returns {boolean} 是否收集到
   */
  collectEnergyOrb(mx, my) {
    for (let i = 0; i < this.energyOrbs.length; i++) {
      const orb = this.energyOrbs[i];
      if (!orb.alive) continue;
      const dx = mx - orb.x;
      const dy = my - orb.y;
      if (dx * dx + dy * dy < ECONOMY.ENERGY_ORB_CLICK_RADIUS * ECONOMY.ENERGY_ORB_CLICK_RADIUS) {
        orb.alive = false;
        if (this.gameData) {
          this.gameData.energy = Math.min(ECONOMY.ENERGY_ORB_CAP, this.gameData.energy + ECONOMY.ENERGY_ORB_VALUE);
          this.eventBus.emit('ui:update', null);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * 更新能量宝珠
   * @param {number} dt - 时间增量
   */
  updateEnergyOrbs(dt) {
    const autoRadius = ECONOMY.ENERGY_ORB_AUTO_COLLECT_RADIUS || 80;
    const autoRadiusSq = autoRadius * autoRadius;
    const towers = this.towerSystem ? this.towerSystem.towers : [];

    for (let i = 0; i < this.energyOrbs.length; i++) {
      const orb = this.energyOrbs[i];
      if (!orb.alive) continue;
      orb.life -= dt;
      if (orb.life <= 0) { orb.alive = false; continue; }

      // 自动吸附：宝珠靠近任意塔时自动收集
      for (let j = 0; j < towers.length; j++) {
        const t = towers[j];
        const dx = orb.x - t.x;
        const dy = orb.y - t.y;
        if (dx * dx + dy * dy <= autoRadiusSq) {
          orb.alive = false;
          if (this.gameData) {
            this.gameData.energy = Math.min(ECONOMY.ENERGY_ORB_CAP, this.gameData.energy + ECONOMY.ENERGY_ORB_VALUE);
            this.eventBus.emit('ui:update', null);
          }
          break;
        }
      }
    }
    // swap-and-pop 清理已消失的宝珠（避免每帧创建新数组）
    for (let i = this.energyOrbs.length - 1; i >= 0; i--) {
      if (!this.energyOrbs[i].alive) {
        this.energyOrbs[i] = this.energyOrbs[this.energyOrbs.length - 1];
        this.energyOrbs.pop();
      }
    }
  }

  /**
   * 获取存活敌人数（无分配实现，波次完成检查每帧调用）
   */
  getAliveCount() {
    let count = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].alive) count++;
    }
    return count;
  }

  /**
   * 自爆虫死亡处理：范围内塔暂停2秒
   * @param {Enemy} enemy - 死亡的自爆虫
   */
  _handleBomberDeath(enemy) {
    const blastRange = this.gameMap.cell * 1.5;
    if (this.towerSystem) {
      this.towerSystem.towers.forEach(tower => {
        const dx = tower.x - enemy.x;
        const dy = tower.y - enemy.y;
        if (Math.sqrt(dx * dx + dy * dy) <= blastRange) {
          // 暂停塔2秒
          tower.cooldown = Math.max(tower.cooldown, 2);
        }
      });
    }
    // 爆炸特效
    this.eventBus.emit('enemy:bomberExplode', { x: enemy.x, y: enemy.y, range: blastRange });
  }

  /**
   * 分裂虫死亡处理：生成2只幼虫
   * @param {Enemy} enemy - 死亡的分裂虫
   */
  _handleSplitterDeath(enemy) {
    const minibugStats = ENEMY_BASE.minibug;
    for (let i = 0; i < 2; i++) {
      const offsetX = i === 0 ? -10 : 10;
      const miniEnemy = new Enemy(
        'minibug',
        minibugStats,
        enemy.x + offsetX,
        enemy.y,
        enemy.cellSize,
        enemy.path
      );
      this.enemies.push(miniEnemy);
      this.eventBus.emit('enemy:spawned', miniEnemy);
    }
  }

  /**
   * Agent F: 爆裂虫死亡处理：分裂为 2 个小型爆裂虫（HP = 原 maxHp * splitHpPct）
   * @param {Enemy} enemy - 死亡的爆裂虫
   */
  _handleSwarmDeath(enemy) {
    if (enemy.splitsDone >= enemy.splitMax) return;
    const baseStats = ENEMY_BASE.swarm;
    if (!baseStats) return;
    const newHp = Math.max(1, Math.floor(enemy.maxHp * (enemy.splitHpPct || 0.5)));
    // 小型爆裂虫 size 略小（视觉上变小）
    const newStats = {
      ...baseStats,
      hp: newHp,
      maxHp: newHp,
      size: (baseStats.size || 0.6) * 0.7,
    };
    const count = enemy.splitCount || 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const offset = 12;
      const miniEnemy = new Enemy(
        'swarm',
        newStats,
        enemy.x + Math.cos(angle) * offset,
        enemy.y + Math.sin(angle) * offset,
        enemy.cellSize,
        enemy.path,
        this.eventBus
      );
      // 继承分裂计数（防止无限制分裂）
      miniEnemy.splitsDone = enemy.splitsDone + 1;
      // 注入 EnemySystem 引用（供 cross-enemy 逻辑使用）
      miniEnemy.setEnemySystem(this);
      this.enemies.push(miniEnemy);
      this.eventBus.emit('enemy:spawned', miniEnemy);
    }
    // 广播分裂事件（供特效系统监听）
    this.eventBus.emit('enemy:swarmSplit', {
      x: enemy.x,
      y: enemy.y,
      count: count,
    });
  }

  /**
   * Agent F: 按类型 ID 生成敌人（从 ENEMY_BASE 读取 stats）
   * 供测试 / 关卡配置直接调用，无需自己构造 stats
   * @param {string} typeId - 敌人类型 id（'healer' / 'shield' / 'swarm' / ...）
   * @param {number} [x] - 可选：覆盖起始 X（默认使用路径起点）
   * @param {number} [y] - 可选：覆盖起始 Y（默认使用路径起点）
   * @param {number} [pathIndex] - 可选：指定路径索引
   * @returns {Enemy|null} 新生成的敌人，类型不存在时返回 null
   */
  spawnEnemyByType(typeId, x = null, y = null, pathIndex = null) {
    const stats = ENEMY_BASE[typeId];
    if (!stats) return null;
    // 路径起点
    const paths = this.gameMap.getPaths();
    const cellSize = this.gameMap.cell;
    let selectedPathIndex;
    if (pathIndex !== null) {
      selectedPathIndex = pathIndex;
    } else if (paths.length > 1) {
      selectedPathIndex = Math.floor(Math.random() * Math.min(2, paths.length));
    } else {
      selectedPathIndex = 0;
    }
    const path = paths[selectedPathIndex];
    if (!path || path.length === 0) return null;
    const start = path[0];
    const startX = x !== null ? x : (start.c * cellSize + cellSize / 2);
    const startY = y !== null ? y : (start.r * cellSize + cellSize / 2);
    let enemy;
    if (this._enemyPool.length > 0) {
      enemy = this._enemyPool.pop();
      enemy.reset(typeId, stats, startX, startY, cellSize, path, this.eventBus);
    } else {
      enemy = new Enemy(typeId, stats, startX, startY, cellSize, path, this.eventBus);
    }
    // 注入 EnemySystem 引用（供 healer 跨敌人治疗等用）
    enemy.setEnemySystem(this);
    // 隐形刺客：初始隐形3秒
    if (typeId === 'stealth') {
      enemy.stealthed = true;
      enemy.stealthTimer = 3;
    }
    this.enemies.push(enemy);
    this.audio?.play('spawn');
    if (enemy.isBoss) {
      this.audio?.play('explosion');
      // === Agent A2 P1-3: Boss 出现时调用 SHAKE.BOSS_PHASE ===
      this.effectSystem?.shakePreset?.(SHAKE.BOSS_PHASE);
      // === P2-6: 注册到 BossPhaseSystem（多阶段抽象）===
      if (this.bossPhaseSystem) {
        const phases = this.bossPhaseSystem.getDefaultPhases(enemy);
        if (phases) {
          const aura = this.bossPhaseSystem.getAuraColor(enemy);
          this.bossPhaseSystem.register(enemy, phases, aura);
          enemy._bossPhaseSystem = this.bossPhaseSystem;
        }
      }
    }
    // === Agent A9 P2-9: 第一次遇到该敌人类型 → emit firstSeen + 写 meta.codex ===
    this._maybeEmitFirstSeen(typeId);
    this.eventBus.emit('enemy:spawned', enemy);
    return enemy;
  }

  // ================================================================
  // Agent C: Boss 死亡 & 阶段切换处理
  // ================================================================

  /**
   * Boss 死亡钩子：触发大爆炸 + 强震动 + 胜利音效
   * @param {Enemy} enemy - 死亡的 Boss
   */
  _handleBossDeath(enemy) {
    // 1) 大爆炸特效（30+ 粒子 + 冲击波 + 闪光）
    if (this.effectSystem && this.effectSystem.addBigExplosion) {
      this.effectSystem.addBigExplosion(enemy.x, enemy.y, enemy.auraColor || '#ffaa44', 1.5);
    }
    // 2) 强震动（8 强度 / 0.5 秒）
    if (this.effectSystem && this.effectSystem.shake) {
      this.effectSystem.shake(8, 0.5);
    }
    // 3) 胜利号角音效
    this.audio?.play('victory');
    // 4) 广播事件（供 UI/Game Feel 系统监听）
    this.eventBus.emit('boss:death', { x: enemy.x, y: enemy.y, type: enemy.type });
  }

  /**
   * Boss 阶段切换钩子：阶段2 时小震动 + 冲击环提示
   * @param {Object} data - { x, y, phase }
   */
  _handleBossPhaseChange(data) {
    if (!data) return;
    // 阶段切换时小震动（仅在阶段从 1 → 2 时）
    if (data.phase === 2) {
      // === Agent A2 P1-3: 阶段切换时调用 SHAKE.BOSS_PHASE ===
      this.effectSystem?.shakePreset?.(SHAKE.BOSS_PHASE);
    }
    // 闪光提示
    if (this.effectSystem && this.effectSystem.effects) {
      this.effectSystem.effects.push({
        type: 'flash',
        x: data.x,
        y: data.y,
        timer: 0.4,
        maxTimer: 0.4,
        size: 60,
        color: data.phase === 2 ? '#ff3322' : '#ffaa44'
      });
      // 冲击波
      this.effectSystem.effects.push({
        type: 'shockwave',
        x: data.x,
        y: data.y,
        timer: 0.5,
        maxTimer: 0.5,
        radius: 0,
        maxRadius: 70,
        life: 0.5,
        maxLife: 0.5,
        color: data.phase === 2 ? '#ff5533' : '#ffaa44'
      });
    }
  }

  /**
   * 清除所有敌人
   */
  clear() {
    this.enemies = [];
    this.energyOrbs = [];
  }
}
