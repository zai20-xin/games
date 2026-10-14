// ================================================================
// 波次管理系统 - 生成、完成检查、利息
// ================================================================
import { ECONOMY, WAVE_CONFIG } from '../core/Constants.js';
import { ENEMY_BASE } from '../data/EnemyTypes.js';

export class WaveSystem {
  /**
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('./EnemySystem.js').EnemySystem} enemySystem
   * @param {import('./EffectSystem.js').EffectSystem} effectSystem
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   */
  constructor(eventBus, enemySystem, effectSystem, audio) {
    this.eventBus = eventBus;
    this.enemySystem = enemySystem;
    this.effectSystem = effectSystem;
    this.audio = audio;

    /** 波次配置数组 */
    this.waves = [];
    /** 当前波次索引（0-based） */
    this.currentWave = 0;
    /** 是否正在波次中 */
    this.waveActive = false;
    /** 当前波次敌人队列 */
    this.currentWaveEnemies = [];
    /** 生成计时器 */
    this.waveSpawnTimer = 0;
    /** 生成索引 */
    this.waveSpawnIndex = 0;

    /** 游戏数据引用 */
    this.gameData = null;

    /** 网格尺寸（由Game设置） */
    this.gridW = 0;
    this.gridH = 0;
  }

  /**
   * 设置游戏数据引用
   */
  setGameData(data) {
    this.gameData = data;
  }

  /**
   * 设置网格尺寸
   */
  setGridSize(w, h) {
    this.gridW = w;
    this.gridH = h;
  }

  /**
   * 设置波次配置
   * @param {Array} waves - 波次配置数组
   */
  setWaves(waves) {
    this.waves = waves;
  }

  /**
   * 更新波次系统
   * @param {number} dt - 时间增量
   */
  update(dt) {
    if (!this.waveActive) return;

    // 敌人生成
    if (this.waveSpawnIndex < this.currentWaveEnemies.length) {
      this.waveSpawnTimer += dt;
      const interval = this.waves[this.currentWave].spawnInterval;

      while (this.waveSpawnTimer >= interval && this.waveSpawnIndex < this.currentWaveEnemies.length) {
        this.waveSpawnTimer -= interval;
        const enemyType = this.currentWaveEnemies[this.waveSpawnIndex];
        const stats = this.waves[this.currentWave].enemyStats[enemyType];
        this.enemySystem.spawnEnemy(enemyType, stats);
        this.waveSpawnIndex++;
      }
    }

    // 检查波次完成
    this._checkWaveComplete();
  }

  /**
   * 开始下一波
   * @returns {boolean} 是否成功开始
   */
  startWave() {
    if (this.waveActive) return false;
    if (this.currentWave >= this.waves.length) return false;

    this.audio.init();
    this.audio.play('waveStart');

    this.waveActive = true;
    const wave = this.waves[this.currentWave];
    this.currentWaveEnemies = [...wave.enemies];
    this.waveSpawnIndex = 0;
    this.waveSpawnTimer = 0;

    // === Agent C: 每 5 波（currentWave 4, 9, 14, 19）追加外星母舰 Boss ===
    // 0-based 索引下，(currentWave + 1) % 5 === 0 意味着第 5/10/15/20 波
    if (this.currentWave < this.waves.length &&
        (this.currentWave + 1) % WAVE_CONFIG.BOSS_INTERVAL === 0 &&
        wave.enemyStats && wave.enemyStats.boss_brute) {
      // 把 boss_brute 放到本波敌人队列最前面（先出现，给玩家反应时间）
      this.currentWaveEnemies.unshift('boss_brute');
    }

    this.eventBus.emit('wave:started', { waveNum: this.currentWave + 1 });
    this.eventBus.emit('ui:update', null);

    return true;
  }

  /**
   * 检查波次是否完成
   */
  _checkWaveComplete() {
    if (!this.waveActive) return;
    if (this.waveSpawnIndex < this.currentWaveEnemies.length) return;
    if (this.enemySystem.getAliveCount() > 0) return;

    // 波次完成
    this.waveActive = false;
    this.currentWave++;

    // 利息机制
    if (this.gameData) {
      const interest = Math.max(1, Math.ceil(this.gameData.energy * ECONOMY.INTEREST_RATE));
      this.gameData.energy = Math.min(ECONOMY.MAX_ENERGY, this.gameData.energy + interest);

      // 利息特效
      const centerX = this.gridW / 2;
      const centerY = this.gridH / 2;
      this.effectSystem.addInterestEffect(centerX, centerY, interest);
    }

    this.eventBus.emit('wave:completed', {
      waveNum: this.currentWave,
      totalWaves: this.waves.length
    });
    this.eventBus.emit('ui:update', null);

    // 检查是否全部通关
    if (this.currentWave >= this.waves.length) {
      this.eventBus.emit('game:victory', null);
    }
  }

  /**
   * 获取当前波次配置
   */
  getCurrentWave() {
    if (this.currentWave < this.waves.length) {
      return this.waves[this.currentWave];
    }
    return null;
  }

  /**
   * 是否所有波次已完成
   */
  isAllWavesComplete() {
    return this.currentWave >= this.waves.length;
  }

  /**
   * 重置波次系统
   */
  reset() {
    this.currentWave = 0;
    this.waveActive = false;
    this.currentWaveEnemies = [];
    this.waveSpawnTimer = 0;
    this.waveSpawnIndex = 0;
  }
}
