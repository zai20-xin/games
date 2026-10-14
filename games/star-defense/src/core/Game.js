// ================================================================
// 游戏主控制器 - 状态机、游戏循环、关卡管理
// 支持自动波次、选卡机制、组合效果、宝箱奖励
// ================================================================
import { EventBus } from '../core/EventBus.js';
import { BattleMode } from '../modes/BattleMode.js';
import { GAME_STATE, SPEED, ECONOMY, DIFFICULTY, LEVEL_CONFIG, WAVE_CONFIG, PROGRESSION } from '../core/Constants.js';
import { GameMap } from '../map/GameMap.js';
import { TOWER_TYPES, getTowerIcon } from '../data/TowerTypes.js';
import { LEVELS, ALL_LEVELS } from '../data/LevelConfig.js';
import { generateWaves, calculateWaveEnemyStats, buildEnemyListForWave } from '../data/WaveConfig.js';
import { TowerSystem } from '../systems/TowerSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { EffectSystem } from '../systems/EffectSystem.js';
import { BossPhaseSystem } from '../systems/BossPhaseSystem.js';
import { ScreenShake } from '../systems/ScreenShake.js';
import { AbilitySystem } from '../systems/AbilitySystem.js';
import { AudioManager } from '../audio/AudioManager.js';
import { Renderer } from '../render/Renderer.js';
import { UIManager } from '../ui/UIManager.js';
import { TowerPanel } from '../ui/TowerPanel.js';
import { OverlayManager } from '../ui/OverlayManager.js';
import { LevelSelectManager } from '../ui/LevelSelectManager.js';

import { UpgradeShop } from '../ui/UpgradeShop.js';
import { TutorialManager } from '../ui/TutorialManager.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { AchievementSystem } from '../systems/AchievementSystem.js';
import { DailyChallenge } from '../systems/DailyChallenge.js';
import { DailySeedMode } from '../modes/DailySeedMode.js';
import { ChapterRunMode, CHAPTER_RUN_CONFIG } from '../modes/ChapterRunMode.js';
import { saveProfile } from '../data/PlayerProfile.js';
import { UiAnimator } from '../ui/UiAnimator.js';


export class Game {
  constructor(canvas) {
    // 画布
    this.canvas = canvas;

    // 事件总线
    this.eventBus = new EventBus();

    // 地图（初始为null，加载关卡时创建）
    this.gameMap = null;

    // 系统
    this.audio = new AudioManager();
    this.audioSystem = this.audio; // 兼容别名，供 Game Feel 系统调用
    this.effectSystem = new EffectSystem(this.eventBus);
    this.screenShake = new ScreenShake();
    // === Agent E: 主动技能系统 ===
    this.abilitySystem = new AbilitySystem({
      effectSystem: this.effectSystem,
      enemySystem: null, // 在 _loadLevel 中注入
      game: this,
      audio: this.audio,
      eventBus: this.eventBus,
    });
    this.towerSystem = null;
    this.enemySystem = null;
    this.bossPhaseSystem = null;  // P2-6: 在 _loadLevel 中实例化
    this.combatSystem = new CombatSystem(this.eventBus, this.effectSystem, this.audio);
    this.combatSystem.setGame(this); // 注入 game 引用，用于屏幕震动/击中冻结
    this.combatSystem.setAbilitySystem(this.abilitySystem); // 注入 ability（过载模式判定）
    this.waveSystem = null;

    // 渲染器
    this.renderer = null;

    // UI
    this.uiManager = new UIManager(this.eventBus);
    this.uiManager.setAbilitySystem(this.abilitySystem);
    // 启动时同步静音指示（从 localStorage 恢复的设置）
    this.uiManager.setMuted(this.audio.isMuted);
    // === Agent A1: 注入 UI 动画管理工具 ===
    this.uiAnimator = new UiAnimator();
    this.uiManager.setUiAnimator(this.uiAnimator);
    this.towerPanel = new TowerPanel();
    this.overlayManager = new OverlayManager(this.audio);
    this.levelSelectManager = new LevelSelectManager();
    // === Agent A1: 关卡选择页也使用同一动画管理器 ===
    this.levelSelectManager.setUiAnimator(this.uiAnimator);

    this.upgradeShop = new UpgradeShop();

    // 新手引导
    this.tutorial = new TutorialManager(document.getElementById('gameContainer'), this.eventBus);

    // 游戏状态
    this.state = GAME_STATE.MENU;
    this.gameSpeed = SPEED.NORMAL;
    this.energy = 50;
    this.hp = 20;
    this.maxHp = 25;
    this.kills = 0;
    this.currentWave = 0;
    this.waveActive = false;
    this.hoverCell = null;
    this.selectedTower = null;
    this.selectedPlacedTower = null;
    this.gameStartTime = 0;

    // 关卡系统
    this.currentLevel = null;
    this.currentLevelId = 1;

    // 元游戏进展系统
    this.meta = new MetaProgression();
    // 关键：将 meta 注入 combatSystem，使升级商店/星际图谱的 buff 在战斗中生效
    this.combatSystem.setMetaProgression(this.meta);

    // 成就系统
    this.achievementSystem = new AchievementSystem(this.eventBus);

    // 每日挑战
    this.dailyChallenge = null;
    this.isDailyChallengeMode = false;
    this.dailyChallengeRestriction = null;
    // 每日关卡（DailySeedMode，P4-5 接线）
    this.dailySeedMode = null;
    this.isDailySeedMode = false;
    // 章节挑战（ChapterRunMode，P4-6 接线）
    this.chapterRunMode = null;

    // 无尽模式
    this.isEndlessMode = false;
    this.endlessWaveCount = 0;

    // 对战模式
    this.battleMode = new BattleMode(this.canvas, this);

    // 能量计时器
    this.energyTimer = 0;

    // 波次配置
    this.waves = [];

    // 游戏循环
    this.lastTime = 0;
    this.animFrameId = null;
    /** 绑定一次的循环回调（避免每帧分配箭头函数） */
    this._boundLoop = this._gameLoop.bind(this);

    // 命中暂停（打击感增强）
    this.hitPause = 0;           // 当前暂停剩余时间（秒）
    this.hitPauseDuration = 0;    // 总暂停时长（用于渲染闪烁）

    // 命中冻结（hit-stop）：与 hitPause 同步，但作为 Game Feel 系统的对外接口
    this.hitStopTimer = 0;        // 当前冻结剩余时间（秒）

    // === P1-5 命中停止（慢动作）：与 hitPause 区分，提供 factor 倍速衰减 ===
    this._hitStopTimer = 0;        // 慢动作剩余时间（秒，独立于 hitPause/hitStopTimer）
    this._hitStopFactor = 1;       // 慢动作速度系数（1=正常, 0.3=慢动作30%）

    // 星际图谱科技效果运行时状态（由 _enterLevel 重置）
    this._techSlowStartTimer = 0;
    this._techSlowStartFactor = 0;
    this._techEnergyRegenTimer = 0;
    this._techEnergyRegenAmount = 0;

    // 渲染状态复用对象（减少GC压力）
    this._renderState = {};

    // === 自动波次系统 ===
    this.countdownTimer = 0;      // 倒计时计时器
    this.countdownValue = 3;       // 当前倒计时值（3/2/1/0）
    this.waveIntervalTimer = 0;    // 波间等待计时器
    this.preparingPhase = false;   // 是否在准备阶段
    this.waveIntervalPhase = false; // 是否在波间等待阶段

    // === Rogue选塔机制 ===


    // 初始化
    this._setupCallbacks();
    this._setupEvents();
    this._setupInput(canvas);
  }

  /**
   * 初始化游戏
   */
  init() {
    // 加载默认关卡（关卡3）用于显示背景
    this._loadLevel(3);

    // 设置游戏数据引用
    const gameData = this._getGameData();
    this.towerSystem.setGameData(gameData);
    this.enemySystem.setGameData(gameData);
    this.combatSystem.setGameData(gameData);
    this.uiManager.setGameData(gameData);
    this.waveSystem.setGameData(gameData);

    // 设置战斗系统的塔系统引用（用于组合效果）
    this.combatSystem.setTowerSystem(this.towerSystem);

    // 显示开始界面（传入星尘结晶余额）
    this.overlayManager.showStartScreen(this.meta.getStardust());

    // 开始渲染循环
    this.lastTime = performance.now();
    this._gameLoop(this.lastTime);
  }

  /**
   * 加载指定关卡
   * 支持两种入参：关卡 ID（数字）或完整地图对象（DailySeedMode 传入）
   */
  _loadLevel(levelId) {
    const level = (levelId && typeof levelId === 'object')
      ? levelId
      : ALL_LEVELS.find(l => l.id === levelId);
    if (!level) return;

    this.currentLevel = level;
    this.currentLevelId = level.id;

    // 创建地图
    this.gameMap = new GameMap(level);

    // 重建系统（需要新的gameMap引用）
    this.towerSystem = new TowerSystem(this.eventBus, this.effectSystem, this.audio, this.gameMap, this.abilitySystem);
    this.enemySystem = new EnemySystem(this.eventBus, this.gameMap, this.audio);
    this.abilitySystem.enemySystem = this.enemySystem; // 注入 enemies
    this.waveSystem = new WaveSystem(this.eventBus, this.enemySystem, this.effectSystem, this.audio);

    // 设置网格尺寸
    this.waveSystem.setGridSize(this.gameMap.gridW, this.gameMap.gridH);

    // 设置战斗系统的格子大小和塔系统引用
    this.combatSystem.setCellSize(this.gameMap.cell);
    this.combatSystem.setTowerSystem(this.towerSystem);

    // 设置敌人系统的塔系统引用（用于自爆虫爆炸效果）
    this.enemySystem.setTowerSystem(this.towerSystem);

    // 传入关卡元素属性给战斗系统
    this.combatSystem.setLevelElement(level.element || null);

    // 传入关卡特殊机制给塔系统
    this.towerSystem.setLevelMechanic(level.specialMechanic || null, level);

    // 传入关卡特殊机制给敌人系统
    this.enemySystem.setLevelMechanic(level.specialMechanic || null);

    // 创建/更新渲染器
    if (!this.renderer) {
      this.renderer = new Renderer(
        document.getElementById('gameCanvas'),
        this.gameMap,
        this
      );
    } else {
      this.renderer.gameMap = this.gameMap;
      this.renderer.setGame(this);
      this.renderer.resizeForLevel(level);
    }

    // 传入关卡主题给渲染器
    this.renderer.setLevelTheme(level.theme || null, level.constellation || null);

    // 设置游戏数据引用
    const gameData = this._getGameData();
    this.towerSystem.setGameData(gameData);
    this.enemySystem.setGameData(gameData);
    this.combatSystem.setGameData(gameData);
    this.uiManager.setGameData(gameData);
    this.waveSystem.setGameData(gameData);

    // 设置关卡名称
    this.uiManager.setLevelName(level.name);
  }

  /**
   * 获取游戏数据对象（供系统引用）
   */
  _getGameData() {
    return {
      get energy() { return this._game.energy; },
      set energy(v) { this._game.energy = v; },
      get hp() { return this._game.hp; },
      set hp(v) { this._game.hp = v; },
      get kills() { return this._game.kills; },
      set kills(v) { this._game.kills = v; },
      get state() { return this._game.state; },
      get currentWave() { return this._game.currentWave; },
      get waveActive() { return this._game.waveActive; },
      get totalWaves() { return this._game.waves.length; },
      _game: this
    };
  }

  /**
   * 设置回调
   */
  _setupCallbacks() {
    // UI回调
    this.uiManager.setSelectTowerCallback((index) => {
      this.selectedTower = index;
      if (index !== null) {
        this.towerPanel.close();
      }
    });

    this.uiManager.setStartWaveCallback(() => {
      this._startWave();
    });

    this.uiManager.setSetSpeedCallback((speed) => {
      this._setGameSpeed(speed);
    });

    this.uiManager.setToggleMuteCallback(() => {
      const muted = this.audio.toggleMute();
      this.uiManager.setMuted(muted);
    });

    // 撤退按钮回调（局内放弃，返回关卡选择）
    this.uiManager.onRetreat = () => {
      this._showLevelSelect();
    };

    // 覆盖层回调
    this.overlayManager.onRestartGame = () => {
      this._restartGame();
    };
    this.overlayManager.onBackToLevelSelect = () => {
      this._showLevelSelect();
    };

    // 宝箱奖励回调：实际写入元游戏档案
    this.overlayManager.setChestRewardCallback((type, value) => {
      const profile = this.meta.getProfile();
      switch (type) {
        case 'stardust':
          // 使用 addStardust 以正确累计 totalStardustEarned 统计
          profile.addStardust(value);
          break;
        case 'skin':
          profile.unlockedSkins = profile.unlockedSkins || [];
          if (!profile.unlockedSkins.includes('star')) {
            profile.unlockedSkins.push('star');
          }
          saveProfile(profile);
          break;
        case 'nextEnergy':
          profile.nextGameEnergyBonus = (profile.nextGameEnergyBonus || 0) + value;
          saveProfile(profile);
          break;
        case 'hpRestore':
          profile.stats.totalHpRestore = (profile.stats.totalHpRestore || 0) + value;
          saveProfile(profile);
          break;
      }
      // 刷新主菜单显示的星尘数
      this.overlayManager.showStartScreen(profile.stardust);
      this._refreshStardustHud();
    });

    // 升级商店回调
    this.overlayManager.setShowUpgradeCallback(() => {
      this._showUpgradeShop();
    });

    // 每日挑战回调（P4-5 DailySeedMode 接线：程序化地图 + seed 波次）
    this.overlayManager.setShowDailyCallback(() => {
      this.startDailySeedMode();
    });
    // 无尽模式回调
    this.overlayManager.setShowEndlessCallback(() => {
      this.startEndlessMode();
    });
    // 对战模式回调
    this.overlayManager.setShowBattleCallback(() => {
      this.startBattleMode();
    });
    // 章节挑战回调（P4-6 ChapterRunMode 接线：3 关连打）
    this.overlayManager.setShowChapterCallback(() => {
      this.startChapterRunMode();
    });

    // 塔面板回调
    this.towerPanel.setUpgradeCallback((tower, branchChoice) => {
      const success = this.towerSystem.upgradeTower(tower, branchChoice);
      if (success) {
        // 延迟一帧刷新面板，确保tower.level已更新
        requestAnimationFrame(() => {
          this.towerPanel.update(this.energy);
        });
      }
    });

    this.towerPanel.setSellCallback((tower) => {
      this.towerSystem.sellTower(tower);
      this.towerPanel.close();
      this.uiManager.update();
    });

    // P2-8: 专精路线选择回调
    this.towerPanel.setChooseSpecCallback((tower, specKey) => {
      const success = this.towerSystem.chooseSpecialization(tower, specKey);
      if (success) {
        // 选择成功后刷新面板和UI
        requestAnimationFrame(() => {
          this.towerPanel.update(this.energy);
          this.uiManager.update();
        });
      }
    });

    // P4-8: 换肤回调 + 获取profile回调
    this.towerPanel.setChangeSkinCallback((tower, skinId) => {
      const success = this.towerSystem.changeTowerSkin(tower, skinId);
      if (success) {
        requestAnimationFrame(() => {
          this.towerPanel.update(this.energy);
        });
      }
    });
    this.towerPanel.onGetProfile = () => this.meta ? this.meta.getProfile() : null;

    // P2-1: 觉醒回调
    this.towerPanel.setAwakenCallback((tower) => {
      const result = this.towerSystem.awakenTower(tower, this.meta ? this.meta.getProfile() : null);
      if (result.success) {
        requestAnimationFrame(() => {
          this.towerPanel.update(this.energy);
          this.uiManager.update();
          this._refreshStardustHud();
        });
      }
    });

    // 覆盖层回调
    this.overlayManager.setStartGameCallback(() => {
      // 不再直接开始游戏，而是显示关卡选择
    });

    this.overlayManager.setRestartGameCallback(() => {
      this._restartGame();
    });

    // 关卡选择回调
    this.overlayManager.setShowLevelSelectCallback(() => {
      this._showLevelSelect();
    });

    this.overlayManager.setBackToLevelSelectCallback(() => {
      this._showLevelSelect();
    });

    // 关卡选择管理器回调
    this.levelSelectManager.setSelectLevelCallback((levelId, difficulty) => {
      this._enterLevel(levelId, difficulty);
    });

    this.levelSelectManager.setBackCallback(() => {
      this._showMainMenu();
    });
  }

  /**
   * 设置事件监听
   */
  _setupEvents() {
    this.eventBus.on('enemy:leaked', (data) => {
      // === Agent E: 基地能量护盾先拦截一次 ===
      if (this.abilitySystem && this.abilitySystem.hasBaseShield()) {
        this.abilitySystem.consumeBaseShield();
        this.effectSystem?.addBigExplosion?.(
          (this.renderer?.gridW || this.gameMap?.gridW || 200) / 2,
          (this.renderer?.gridH || this.gameMap?.gridH || 200) / 2,
          '#88dd66', 1.0
        );
        this.uiManager?.update?.();
        return; // 吸收这次伤害，不扣血
      }
      if (this.hp <= 0) {
        this._gameOver(false);
      }
    });

    this.eventBus.on('game:victory', () => {
      setTimeout(() => this._gameOver(true), 500);
    });

    // 命中暂停（打击感增强）
    this.eventBus.on('game:hit', (data) => {
      if (data.isBoss) {
        this.hitPause = 0.15;
        this.effectSystem.shake(8, 0.2);
      } else if (data.isCrit) {
        this.hitPause = 0.08;
        this.effectSystem.shake(4, 0.1);
      } else if (data.damage > 30) {
        this.hitPause = 0.06;
        this.effectSystem.shake(3, 0.08);
      } else if (data.damage > 10) {
        this.hitPause = 0.03;
      }
      this.hitPauseDuration = this.hitPause;
    });

    // 波次完成事件
    this.eventBus.on('wave:completed', (data) => {
      // 无尽模式：动态生成下一波
      if (this.isEndlessMode) {
        this._generateEndlessWave();
        return;
      }
      // 最后一波完成由game:victory处理
    });

    // 成就解锁通知
    this.eventBus.on('achievement:unlocked', (achievement) => {
      this.uiManager.showAchievementNotification(achievement);
    });

    // Boss 击杀额外星尘奖励
    this.eventBus.on('boss:death', (data) => {
      if (this.meta) {
        this.meta.addStardust(PROGRESSION.BOSS_KILL_STARDUST);
        this._refreshStardustHud();
        // 在 Boss 死亡位置显示星尘奖励特效
        if (data && this.effectSystem) {
          this.effectSystem.addDamageNumber(
            data.x, data.y - 30, PROGRESSION.BOSS_KILL_STARDUST,
            '#ffcc55', true, true
          );
        }
      }
    });
  }

  /**
   * 设置输入处理
   */
  _setupInput(canvas) {
    // 鼠标移动
    canvas.addEventListener('mousemove', (e) => {
      if (!this.gameMap) return;
      const rect = canvas.getBoundingClientRect();
      // 使用逻辑网格尺寸（非物理像素），避免 dpr 导致坐标偏移
      const gridW = this.renderer.gridW || this.gameMap.gridW;
      const gridH = this.renderer.gridH || this.gameMap.gridH;
      const scaleX = gridW / rect.width;
      const scaleY = gridH / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const cell = this.gameMap.cell;
      const col = Math.floor(mx / cell);
      const row = Math.floor(my / cell);

      if (col >= 0 && col < this.gameMap.cols && row >= 0 && row < this.gameMap.rows) {
        if (this.gameMap.isPlacementSlot(row, col)) {
          this.hoverCell = { row, col };
        } else {
          this.hoverCell = null;
        }
      } else {
        this.hoverCell = null;
      }
    });

    canvas.addEventListener('mouseleave', () => {
      this.hoverCell = null;
    });

    // 鼠标点击
    canvas.addEventListener('click', (e) => {
      this._handleCanvasClick(e, canvas);
    });

    // 触摸支持
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this._handleCanvasClick(touch, canvas);
    });

    // 键盘事件
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.towerPanel.close();
        if (this.selectedTower !== null) {
          this.selectedTower = null;
          this.uiManager.deselectTower();
        }
      }
      // P / 空格：暂停/恢复（游戏中）
      if ((e.key === 'p' || e.key === 'P') && this.state === GAME_STATE.PLAYING) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        this._setGameSpeed(this.gameSpeed === 0 ? SPEED.NORMAL : SPEED.PAUSE);
      }
      if (e.key === ' ' && this.state === GAME_STATE.PLAYING) {
        e.preventDefault();
        this._setGameSpeed(this.gameSpeed === 0 ? SPEED.NORMAL : SPEED.PAUSE);
      }
      // === Agent E: R 键触发当前选中塔的主动技能 ===
      // R 键双职责：局内（PLAYING）= 大招；结算界面（DEFEAT/VICTORY）= 秒重开
      if ((e.key === 'r' || e.key === 'R') && this.state === GAME_STATE.PLAYING) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        this.abilitySystem?.trigger();
      }
      if ((e.key === 'r' || e.key === 'R' || e.key === 'Enter') &&
          (this.state === GAME_STATE.DEFEAT || this.state === GAME_STATE.VICTORY)) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        this._restartGame();
      }
      // M：音效开关（菜单/局内均可用）
      if (e.key === 'm' || e.key === 'M') {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        const muted = this.audio.toggleMute();
        this.uiManager.setMuted(muted);
      }
    });
  }

  /**
   * 处理画布点击
   */
  _handleCanvasClick(e, canvas) {
    if (this.state !== GAME_STATE.PLAYING) return;
    if (!this.gameMap) return;

    const rect = canvas.getBoundingClientRect();
    const gridW = this.renderer.gridW || this.gameMap.gridW;
    const gridH = this.renderer.gridH || this.gameMap.gridH;
    const scaleX = gridW / rect.width;
    const scaleY = gridH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // 尝试收集能量宝珠
    if (this.enemySystem.collectEnergyOrb(mx, my)) {
      this.effectSystem.addEnergyGainEffect(mx, my, 10);
      return;
    }

    const cell = this.gameMap.cell;
    const col = Math.floor(mx / cell);
    const row = Math.floor(my / cell);

    if (col < 0 || col >= this.gameMap.cols || row < 0 || row >= this.gameMap.rows) return;

    // 检查是否点击了已放置的塔
    const clickedTower = this.towerSystem.findTowerAt(row, col);
    if (clickedTower && this.selectedTower === null) {
      this.towerPanel.open(clickedTower, canvas.getBoundingClientRect(),
        document.getElementById('gameContainer').getBoundingClientRect(),
        this.renderer.gridW, this.renderer.gridH);
      // === Agent E: 选中已放置塔以启用 R 键大招 ===
      this.abilitySystem?.selectTower(clickedTower);
      return;
    }

    // 如果有选中的卡牌且点击了放置位
    if (this.selectedTower !== null) {
      if (this.gameMap.isPlacementSlot(row, col)) {
        this.towerSystem.placeTower(
          this.selectedTower, row, col,
          TOWER_TYPES
        );
        // 放置成功后重置选卡状态
        this.selectedTower = null;
        this.uiManager.resetCardSelection();
      }
      return;
    }

    // 点击其他地方关闭面板
    this.towerPanel.close();
  }

  /**
   * 显示关卡选择界面
   */
  _showLevelSelect() {
    this.state = GAME_STATE.MENU;
    this.gameSpeed = SPEED.NORMAL;
    // 退出每日挑战 / 章节挑战
    this.isDailySeedMode = false;
    if (this.chapterRunMode && !this.chapterRunMode.completed && !this.chapterRunMode.failed) {
      this.chapterRunMode.abort();
    }
    this.overlayManager.hide();
    this.towerPanel.close();
    this.uiManager.resetCardSelection();
    this.levelSelectManager.show();
  }

  /**
   * 显示升级商店
   */
  _showUpgradeShop() {
    this.state = GAME_STATE.MENU; // 暂停游戏循环
    // 注入meta实例，确保升级商店与游戏数据同步
    this.upgradeShop.setMeta(this.meta);
    this.upgradeShop.onClose = () => {
      // 关闭商店后回到主菜单，刷新星尘显示和buff效果
      this.meta._refreshEffects();
      this.overlayManager.showStartScreen(this.meta.getStardust());
      this._refreshStardustHud();
    };
    this.upgradeShop.open();
  }

  /**
   * 刷新顶部 HUD 的星尘结晶显示
   */
  _refreshStardustHud() {
    const el = document.getElementById('stardustDisplay');
    if (el && this.meta) {
      el.textContent = String(this.meta.getStardust() || 0);
    }
  }

  /**
   * 显示主菜单
   */
  _showMainMenu() {
    if (this.battleMode && this.battleMode.active) {
      this.battleMode.stop();
    }
    // 退出每日挑战 / 章节挑战
    this.isDailySeedMode = false;
    if (this.chapterRunMode && !this.chapterRunMode.completed && !this.chapterRunMode.failed) {
      this.chapterRunMode.abort();
    }
    this.levelSelectManager.hide();
    this.overlayManager.showStartScreen();
  }

  /**
   * 进入指定关卡
   */
  _enterLevel(levelId, difficulty = 'easy') {
    // 设置难度
    this.difficulty = difficulty;
    const diffData = DIFFICULTY[difficulty];
    this.difficultyName = diffData.label;

    // 加载关卡
    this._loadLevel(levelId);

    // 设置初始能量和生命值（受难度系数影响）
    const level = this.currentLevel;
    this.energy = Math.floor(level.initEnergy * (diffData.initEnergy / 50));
    this.hp = Math.floor(level.initHP * (diffData.initHP / 20));
    this.maxHp = this.hp;
    this.kills = 0;
    this.currentWave = 0;
    this.waveActive = false;
    this.selectedTower = null;
    this.selectedPlacedTower = null;
    this.energyTimer = 0;
    this.gameSpeed = SPEED.NORMAL;
    this.gameStartTime = Date.now();
    this.state = GAME_STATE.PLAYING;

    // 重置模式标志（由 startEndlessMode 和 _showDailyChallenge 设置）
    // 如果不是从无尽模式或每日挑战进入，重置标志
    if (!this.isEndlessMode && !this.isDailyChallengeMode) {
      this.dailyChallengeRestriction = null;
    }

    // 应用元游戏永久升级效果
    this.meta.applyToGame(this);

    // 应用上局宝箱获得的下局能量加成
    const profile = this.meta.getProfile();
    if (profile.nextGameEnergyBonus) {
      this.energy += profile.nextGameEnergyBonus;
      profile.nextGameEnergyBonus = 0;
      saveProfile(profile);
    }

    // 生成波次配置（无尽模式由 startEndlessMode 单独处理）
    if (!this.isEndlessMode) {
      this.waves = generateWaves(levelId, this.difficulty);
    } else {
      this.waves = [];
    }
    this.waveSystem.setWaves(this.waves);

    // 清除所有系统
    this.towerSystem.clear();
    this.enemySystem.clear();
    this.combatSystem.clear();
    this.effectSystem.clear();
    this.waveSystem.reset();
    // === Agent E: 重置技能系统 ===
    this.abilitySystem?.reset();

    // 重置自动波次系统
    this.preparingPhase = true;
    this.countdownTimer = 0;
    this.countdownValue = 3;
    this.waveIntervalTimer = 0;
    this.waveIntervalPhase = false;

    // 星际图谱：冰封开局 - 开局全场敌人减速（持续 TECH_SLOW_START_DURATION 秒）
    if (this._meta_tech_slowStart) {
      this._techSlowStartTimer = PROGRESSION.TECH_SLOW_START_DURATION;
      this._techSlowStartFactor = this._meta_tech_slowStart;
    } else {
      this._techSlowStartTimer = 0;
      this._techSlowStartFactor = 0;
    }
    // 星际图谱：星尘利息 - 每 10 秒获得能量
    this._techEnergyRegenTimer = 0;
    this._techEnergyRegenAmount = this._meta_tech_energyRegen || 0;

    // 隐藏界面
    this.levelSelectManager.hide();
    this.overlayManager.hide();

    // 新手引导：第一关启动教学，其他关卡销毁教学
    if (levelId === 1) {
      this.tutorial.start();
    } else {
      this.tutorial.destroy();
    }

    // 更新UI
    this.uiManager.setSpeed(SPEED.NORMAL);
    this.uiManager.reset();
    this.uiManager.setLevelName(level.name);
    this.towerPanel.close();
    this.uiManager.update();
    this.uiManager.updateWavePreview(this.waves[0]);
  }

  /**
   * 重新开始当前关卡
   * - 失败（DEFEAT）：重打当前关（秒重开语义）
   * - 胜利（VICTORY）：按既有规则进入下一关（最后一关则重打）
   * - 无尽模式：重新开始无尽
   */
  _restartGame() {
    // 无尽模式重新开始
    if (this.isEndlessMode) {
      this.startEndlessMode();
      return;
    }

    // 每日关卡失败重开：重打今日 seed（currentLevelId 为 -1，不能走普通重开）
    if (this.isDailySeedMode) {
      this.startDailySeedMode();
      return;
    }

    // 失败秒重开：重打当前关
    if (this.state === GAME_STATE.DEFEAT) {
      this._enterLevel(this.currentLevelId, this.difficulty);
      return;
    }

    // 如果当前关卡是最后一关，重新开始当前关
    // 否则进入下一关
    if (this.currentLevelId < LEVEL_CONFIG.TOTAL_LEVELS) {
      this._enterLevel(this.currentLevelId + 1, this.difficulty);
    } else {
      this._enterLevel(this.currentLevelId, this.difficulty);
    }
  }

  /**
   * 开始波次
   */
  _startWave() {
    if (this.waveSystem.waveActive || this.state !== GAME_STATE.PLAYING) return;
    // 波次开始闪光效果
    if (this.renderer) {
      this.renderer._waveFlash = 1;
    }
    this.waveSystem.startWave();
  }

  /**
   * 设置游戏速度
   */
  _setGameSpeed(speed) {
    this.gameSpeed = speed;
    this.uiManager.setSpeed(speed);
  }

  /**
   * 游戏结束
   */
  _gameOver(victory) {
    this.state = victory ? GAME_STATE.VICTORY : GAME_STATE.DEFEAT;
    this.towerPanel.close();

    // 停止自动波次
    this.preparingPhase = false;
    this.waveIntervalPhase = false;

    if (victory) {
      // 无尽模式没有胜利，只记录最高波次
      if (this.isEndlessMode) {
        const best = parseInt(localStorage.getItem('star-defense-endless-best') || '0');
        if (this.endlessWaveCount > best) {
          localStorage.setItem('star-defense-endless-best', String(this.endlessWaveCount));
        }
        // 无尽模式不会触发victory，但以防万一
        this.overlayManager.showDefeat({
          kills: this.kills,
          currentWave: this.endlessWaveCount
        });
        this.overlayManager.overlayTitle.textContent = '无尽模式结束';
        this.overlayManager.overlayTitle.style.color = '#ffaa44';
        this.overlayManager.overlaySubtitle.textContent =
          `坚持到第 ${this.endlessWaveCount} 波！击杀: ${this.kills}，最高纪录: ${Math.max(this.endlessWaveCount, best)} 波`;
        this.isEndlessMode = false;
        return;
      }

      // 每日关卡（DailySeedMode）胜利：发首通奖励，不存星级
      if (this.isDailySeedMode && this.dailySeedMode) {
        const r = this.dailySeedMode.markCompleted();
        this.isDailySeedMode = false;
        this._refreshStardustHud();
        this.overlayManager.showVictory({
          hp: this.hp,
          kills: this.kills,
          towerCount: this.towerSystem.towers.length,
          startTime: this.gameStartTime,
          difficultyName: '每日挑战',
          levelName: '每日挑战',
          starThresholds: [15, 10, 5],
          stardustReward: r.reward,
          stardustTotal: this.meta.getStardust(),
        });
        return;
      }

      const level = this.currentLevel;
      const wavesCompleted = this.currentWave;
      const thresholds = level.starThresholds || [20, 15, 10];
      let starCount = 1;
      if (this.hp >= thresholds[0]) starCount = 3;
      else if (this.hp >= thresholds[1]) starCount = 2;

      const rewardData = this.meta.awardEndGame(
        { kills: this.kills, wavesCompleted },
        starCount,
        this.difficulty
      );
      this.overlayManager.showVictory({
        hp: this.hp,
        kills: this.kills,
        towerCount: this.towerSystem.towers.length,
        startTime: this.gameStartTime,
        difficultyName: this.difficultyName,
        levelName: level.name,
        starThresholds: level.starThresholds,
        stardustReward: rewardData.reward,
        stardustTotal: rewardData.total,
        chapterComplete: (this.chapterRunMode && this.chapterRunMode.completed)
          ? { reward: CHAPTER_RUN_CONFIG.PERFECT_REWARD }
          : null,
        onLevelComplete: (starCount) => {
          const starKey = `${this.currentLevelId}_${this.difficulty}`;
          const stars = JSON.parse(localStorage.getItem(LEVEL_CONFIG.STARS_KEY) || '{}');
          const prevBest = stars[starKey] || 0;
          if (starCount > prevBest) {
            stars[starKey] = starCount;
            localStorage.setItem(LEVEL_CONFIG.STARS_KEY, JSON.stringify(stars));
          }
        }
      });

      // 每日挑战胜利处理
      if (this.isDailyChallengeMode && this.dailyChallenge) {
        this.dailyChallenge.markCompleted();
        // 奖励星尘（使用 addStardust 以正确累计统计）
        const profile = this.meta.getProfile();
        profile.addStardust(this.dailyChallenge.challenge.reward.stardust);
        this.isDailyChallengeMode = false;
        this._refreshStardustHud();
      }
    } else {
      // 无尽模式失败
      if (this.isEndlessMode) {
        const best = parseInt(localStorage.getItem('star-defense-endless-best') || '0');
        if (this.endlessWaveCount > best) {
          localStorage.setItem('star-defense-endless-best', String(this.endlessWaveCount));
        }
        this.overlayManager.showDefeat({
          kills: this.kills,
          currentWave: this.endlessWaveCount
        });
        this.overlayManager.overlayTitle.textContent = '无尽模式结束';
        this.overlayManager.overlayTitle.style.color = '#ffaa44';
        this.overlayManager.overlaySubtitle.textContent =
          `坚持到第 ${this.endlessWaveCount} 波！击杀: ${this.kills}，最高纪录: ${Math.max(this.endlessWaveCount, best)} 波`;
        this.isEndlessMode = false;
        return;
      }

      this.overlayManager.showDefeat({
        kills: this.kills,
        currentWave: this.currentWave
      });

      // 每日挑战失败处理
      if (this.isDailyChallengeMode) {
        this.isDailyChallengeMode = false;
      }
      // 每日关卡（DailySeedMode）失败：保留 isDailySeedMode 供"秒重开"重打今日 seed
    }
  }

  /**
   * 游戏主循环
   */
  _gameLoop(timestamp) {
    // 对战模式激活时，跳过原有游戏循环
    if (this.battleMode && this.battleMode.active) {
      requestAnimationFrame(this._boundLoop);
      return;
    }

    const rawDt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    const time = timestamp / 1000;
    let dt = rawDt * this.gameSpeed;
    this._lastRawDt = rawDt;

    // 屏幕震动与特效：始终按真实时间更新（不随游戏暂停或命中冻结而停止衰减）
    this.screenShake.update(rawDt);
    this.effectSystem.update(rawDt);

    // 命中暂停（打击感增强）：冻结逻辑帧，继续渲染
    // 同步 hitStopTimer 与 hitPause（双轨记录，向后兼容旧的事件触发路径）
    this.hitStopTimer = this.hitPause;
    if (this.hitPause > 0 && this.gameSpeed > 0) {
      dt = 0;
      this.hitPause = Math.max(0, this.hitPause - rawDt);
    } else {
      // 只有在非命中暂停期间才更新lastTime，避免时间跳跃
      this.lastTime = timestamp;
    }

    // === P1-5 命中停止（慢动作）：在 hitPause 之上叠加慢动作效果 ===
    // hitPause 优先（dt=0），结束后慢动作继续生效
    if (this._hitStopTimer > 0 && this.gameSpeed > 0) {
      dt *= this._hitStopFactor;
      this._hitStopTimer = Math.max(0, this._hitStopTimer - rawDt);
      if (this._hitStopTimer <= 0) {
        this._hitStopFactor = 1;
      }
    }

    // 更新游戏逻辑
    if (this.state === GAME_STATE.PLAYING && this.gameSpeed > 0) {
      // === 自动波次系统 ===

      // 准备阶段倒计时（参数见 WAVE_CONFIG.COUNTDOWN_*）
      if (this.preparingPhase) {
        this.countdownTimer += rawDt; // 用rawDt不受游戏速度影响
        this.countdownValue = WAVE_CONFIG.COUNTDOWN_SECONDS - Math.floor(this.countdownTimer);
        if (this.countdownTimer >= WAVE_CONFIG.COUNTDOWN_TOTAL) {
          this.preparingPhase = false;
          this._startWave();
        }
      }

      // 波间自动衔接
      if (!this.preparingPhase && !this.waveActive && this.currentWave > 0 && this.currentWave < this.waves.length) {
        this.waveIntervalPhase = true;
        this.waveIntervalTimer += rawDt;
        const interval = (this.dailyChallengeRestriction && this.dailyChallengeRestriction.waveIntervalMult)
          ? WAVE_CONFIG.WAVE_INTERVAL * this.dailyChallengeRestriction.waveIntervalMult
          : WAVE_CONFIG.WAVE_INTERVAL;
        if (this.waveIntervalTimer >= interval) {
          this.waveIntervalTimer = 0;
          this.waveIntervalPhase = false;
          this._startWave();
        }
      }

      // 能量自动产生
      this.energyTimer += dt;
      if (this.energyTimer >= ECONOMY.REGEN_INTERVAL) {
        this.energyTimer -= ECONOMY.REGEN_INTERVAL;
        this.energy = Math.min(ECONOMY.MAX_ENERGY, this.energy + ECONOMY.BASE_ENERGY_REGEN);
        this.uiManager.update();
      }

      // 星际图谱：星尘利息 - 每 TECH_INTEREST_INTERVAL 秒获得额外能量
      if (this._techEnergyRegenAmount > 0) {
        this._techEnergyRegenTimer += dt;
        if (this._techEnergyRegenTimer >= PROGRESSION.TECH_INTEREST_INTERVAL) {
          this._techEnergyRegenTimer -= PROGRESSION.TECH_INTEREST_INTERVAL;
          this.energy = Math.min(ECONOMY.MAX_ENERGY, this.energy + this._techEnergyRegenAmount);
          this.uiManager.update();
        }
      }

      // 星际图谱：冰封开局 - 前 10 秒全场敌人减速
      if (this._techSlowStartTimer > 0) {
        this._techSlowStartTimer -= dt;
        const slowFactor = this._techSlowStartFactor;
        for (const enemy of this.enemySystem.enemies) {
          if (enemy.alive && !enemy._techSlowApplied) {
            enemy.applySlow(1 - slowFactor, PROGRESSION.TECH_SLOW_START_DURATION);
            enemy._techSlowApplied = true;
          }
        }
        if (this._techSlowStartTimer <= 0) {
          this._techSlowStartTimer = 0;
        }
      }

      // 更新波次系统
      this.waveSystem.update(dt);

      // 更新塔系统
      this.towerSystem.update(dt, this.enemySystem.enemies, this.combatSystem);

      // === Agent E: 更新主动技能冷却 ===
      this.abilitySystem.update(dt);

      // 处理塔攻击（for 循环避免每帧分配回调闭包）
      const towers = this.towerSystem.towers;
      for (let i = 0; i < towers.length; i++) {
        this.combatSystem.processTowerAttack(towers[i], this.enemySystem.enemies, dt);
      }

      // 更新战斗系统
      this.combatSystem.update(dt, this.towerSystem.towers, this.enemySystem.enemies);

      // 更新敌人系统
      this.enemySystem.update(dt);

      // 更新能量宝珠
      this.enemySystem.updateEnergyOrbs(rawDt);

      // 同步波次状态
      this.waveActive = this.waveSystem.waveActive;
      this.currentWave = this.waveSystem.currentWave;

      // 更新波次预览
      if (!this.waveActive && this.currentWave < this.waves.length) {
        this.uiManager.updateWavePreview(this.waves[this.currentWave]);
      }
    } else if (this.state === GAME_STATE.PLAYING && this.gameSpeed === 0) {
      // 暂停时仍然更新连击显示
      this.combatSystem._updateCombo(0);
    }

    // 渲染（即使暂停也继续渲染；屏幕震动偏移已移入 Renderer.render 内部）
    if (this.renderer && this.gameMap) {
      this.renderer.render(time, this._fillRenderState(), this.effectSystem);
    }

    // 继续循环
    this.animFrameId = requestAnimationFrame(this._boundLoop);
  }

  /**
   * 填充渲染状态（复用对象，避免每帧分配闭包/对象）
   */
  _fillRenderState() {
    const s = this._renderState;
    s.towers = this.towerSystem.towers;
    s.enemies = this.enemySystem.enemies;
    s.projectiles = this.combatSystem.projectiles;
    s.hoverCell = this.hoverCell;
    s.selectedTower = this.selectedTower;
    s.selectedPlacedTower = this.selectedPlacedTower;
    s.energy = this.energy;
    s.towerTypes = TOWER_TYPES;
    s.waveActive = this.waveActive;
    // 新增数据
    s.hp = this.hp;
    s.maxHp = this.maxHp;
    s.synergyLinks = this.towerSystem.synergyLinks;
    s.energyOrbs = this.enemySystem.energyOrbs;
    // 倒计时数据
    s.preparingPhase = this.preparingPhase;
    s.countdownTimer = this.countdownTimer;
    s.countdownValue = this.countdownValue;
    // 波间等待数据
    s.waveIntervalPhase = this.waveIntervalPhase;
    s.waveIntervalTimer = this.waveIntervalTimer;
    // 真实帧间隔，供渲染器使用
    s.deltaTime = this._lastRawDt || 0.016;
    return s;
  }

  /**
   * 显示每日挑战
   */
  _showDailyChallenge() {
    this.dailyChallenge = new DailyChallenge();
    const info = this.dailyChallenge.getInfo();

    if (info.completed) {
      // 今天已完成，用游戏内弹窗提示
      this.overlayManager.overlayTitle.textContent = '每日挑战';
      this.overlayManager.overlayTitle.style.color = '#ff8866';
      this.overlayManager.overlaySubtitle.innerHTML = `
        <div style="text-align:center;margin:10px 0;">
          <div style="font-size:40px;margin-bottom:10px;">✅</div>
          <div style="color:#aaa;font-size:14px;">今日挑战已完成！</div>
          <div style="color:#888;font-size:12px;margin-top:4px;">明天再来吧，指挥官</div>
        </div>
      `;
      this.overlayManager.overlayButtons.innerHTML = `
        <button class="overlay-btn btn-back" id="dailyBackBtn">返回</button>
      `;
      this.overlayManager.overlay.classList.remove('hidden');
      document.getElementById('dailyBackBtn').addEventListener('click', () => {
        this.overlayManager.showStartScreen(this.meta.getStardust());
      });
      return;
    }

    // 用游戏内弹窗显示每日挑战信息
    this.overlayManager.overlayTitle.textContent = '📅 每日挑战';
    this.overlayManager.overlayTitle.style.color = '#ff8866';
    this.overlayManager.overlaySubtitle.innerHTML = `
      <div style="text-align:center;margin:10px 0;">
        <div style="font-size:18px;color:#e0e0ff;margin-bottom:8px;">${info.name}</div>
        <div style="color:#aaa;font-size:14px;margin-bottom:12px;">${info.desc}</div>
        <div style="display:flex;justify-content:center;gap:20px;font-size:13px;">
          <span style="color:#ffcc44;">⭐ 奖励: ${info.reward.stardust} 星尘</span>
          <span style="color:#ffaa77;">🗺️ 关卡: ${info.levelName || '关卡' + info.levelId}</span>
        </div>
      </div>
    `;
    this.overlayManager.overlayButtons.innerHTML = `
      <button class="overlay-btn btn-start" id="dailyStartBtn" style="background:#ff8866;color:#fff5e6;">开始挑战</button>
      <button class="overlay-btn btn-back" id="dailyCancelBtn" style="margin-top:6px;">返回</button>
    `;
    this.overlayManager.overlay.classList.remove('hidden');

    document.getElementById('dailyStartBtn').addEventListener('click', () => {
      this.overlayManager.hide();
      this.isDailyChallengeMode = true;
      this._enterLevel(info.levelId);
      if (this.dailyChallenge) {
        this.dailyChallenge.apply(this);
      }
    });
    document.getElementById('dailyCancelBtn').addEventListener('click', () => {
      this.overlayManager.showStartScreen(this.meta.getStardust());
    });
  }

  /**
   * 开始每日关卡（DailySeedMode，P4-5）
   * 用今日 seed 生成程序化地图 + 波次，通关发首通奖励
   */
  startDailySeedMode() {
    this.dailySeedMode = new DailySeedMode(this);
    this.dailySeedMode.start();
    // DailySeedMode.start 只设置核心字段，补齐常规初始化
    this.waves = this.dailySeedMode.dailyWaves;
    this.state = GAME_STATE.PLAYING;
    this.gameStartTime = Date.now();
    this.gameSpeed = SPEED.NORMAL;
    this.selectedTower = null;
    this.selectedPlacedTower = null;
    this.energyTimer = 0;
    this.meta.applyToGame(this);
    this.combatSystem.clear();
    this.effectSystem.clear();
    this.abilitySystem?.reset();
    this.preparingPhase = true;
    this.countdownTimer = 0;
    this.countdownValue = 3;
    this.waveIntervalTimer = 0;
    this.waveIntervalPhase = false;
    this.levelSelectManager.hide();
    this.overlayManager.hide();
    this.uiManager.setSpeed(SPEED.NORMAL);
    this.uiManager.reset();
    this.towerPanel.close();
    this.uiManager.update();
    this.uiManager.updateWavePreview(this.waves[0]);
  }

  /**
   * 开始章节挑战（ChapterRunMode，P4-6）
   * 从起始关卡拼 3 关连打，跨关保留塔/能量/HP，失败即结束
   * @param {number} [startLevelId=1] 起始关卡 ID
   */
  startChapterRunMode(startLevelId = 1) {
    this.chapterRunMode = new ChapterRunMode(this);
    const r = this.chapterRunMode.start(startLevelId);
    if (!r.success) {
      this.overlayManager.showStartScreen(this.meta.getStardust());
      return;
    }
    this.overlayManager.hide();
    this.levelSelectManager.hide();
  }

  /**
   * 开始无尽模式
   */
  startEndlessMode() {
    this.isEndlessMode = true;
    this.endlessWaveCount = 0;

    // 使用关卡3作为无尽模式地图
    this._enterLevel(3);

    // 生成无尽模式波次（动态生成）
    this._generateEndlessWave();
  }

  /**
   * 开始对战模式
   */
  startBattleMode() {
    this.state = GAME_STATE.PLAYING;
    this.overlayManager.hide();
    this.levelSelectManager.hide();
    this.battleMode.start();
  }

  /**
   * 生成无尽模式的下一波
   */
  _generateEndlessWave() {
    this.endlessWaveCount++;
    const waveNum = this.endlessWaveCount;

    // 难度指数递增：每波HP += 12%，速度 += 3%（与关卡模式公式一致）
    const hpMult = Math.pow(1.12, waveNum - 1);

    // 使用共享函数构建敌人列表
    const isBossWave = waveNum % 10 === 0;
    const enemies = buildEnemyListForWave(waveNum, {
      isBossWave,
      isEndless: true,
    });

    // 生成间隔随波次缩短
    const spawnInterval = Math.max(0.3, 1.2 - waveNum * 0.02);

    // 使用共享函数计算敌人属性
    const enemyStats = calculateWaveEnemyStats(waveNum, hpMult);

    const wave = {
      waveNum: waveNum,
      enemies,
      spawnInterval,
      enemyStats
    };

    // 追加到波次数组
    this.waves.push(wave);
    this.waveSystem.setWaves(this.waves);

    // 更新UI波次预览
    if (!this.waveActive) {
      this.uiManager.updateWavePreview(wave);
    }
  }

  /**
   * 响应式缩放（画布尺寸由 Renderer._fitCanvas 适配视口，此处保留为占位以兼容外部调用）
   */
  resize() {
    if (this.renderer && typeof this.renderer._fitCanvas === 'function') {
      this.renderer._fitCanvas();
    }
  }

  /**
   * 击中冻结（Game Feel 核心接口）：在重击时短暂冻结游戏帧，制造"砸到位"的打击感
   * 取较大者：若已有更长冻结则保留
   * @param {number} duration - 冻结时长（秒）
   * @param {number} [factor=0.3] - 慢动作系数（1=正常, 0=全暂停, 0.3=30% 慢动作）
   */
  hitStop(duration, factor = 0.3) {
    if (duration <= 0) return;
    // 与现有 hitStopTimer 同步（旧系统兼容，但实际慢动作走 _hitStopTimer）
    this.hitStopTimer = Math.max(this.hitStopTimer || 0, duration);
    // 慢动作系统：取较长的剩余时间
    this._hitStopTimer = Math.max(this._hitStopTimer || 0, duration);
    this._hitStopFactor = factor;
  }

  /**
   * 获取当前游戏有效速度（已应用慢动作系数）
   * @returns {number} 当前帧的游戏速度倍率
   */
  getGameSpeed() {
    return this.gameSpeed * (this._hitStopTimer > 0 ? this._hitStopFactor : 1);
  }

  // ================================================================
  // Agent A2 P5-1: 难度曲线自检工具
  // 在控制台调用 game.runDiagnostics() 可查看各关理论剩余 HP，
  // 用于分析"简单关过松 / 困难关过紧"问题
  // ================================================================
  /**
   * 跑一遍所有（或指定）关卡，返回每关的理论剩余 HP 等统计
   * - 简单 AI 估算：假设玩家放置 3 个中等塔（平均 DPS=45），按"总血量 / DPS"推算击杀时间
   * - 漏过的敌人按"击杀时间 > 时间预算"线性外推
   * - 输出可直接用 console.table 打印
   *
   * @param {Object} [opts]
   * @param {number[]} [opts.levels] - 要诊断的关卡列表（默认 [1..17]）
   * @param {string}   [opts.difficulty] - 难度 'easy' | 'normal' | 'hard'（默认 'easy'）
   * @param {string}   [opts.aiType] - 'simple'（简单AI估算）| 'none'（纯理论）（默认 'simple'）
   * @returns {Array<{levelId:number, levelName:string, difficulty:string, initialHP:number, remainingHP:number, leaks:number, totalEnemies:number, totalEnemyHp:number, clearTimeSec:number, stars:number, tag:string}>}
   */
  runDiagnostics(opts = {}) {
    const { levels = null, difficulty = 'easy', aiType = 'simple' } = opts;
    const targetLevels = levels && levels.length > 0
      ? levels
      : ALL_LEVELS.map(l => l.id);

    const diff = DIFFICULTY[difficulty] || DIFFICULTY.easy;
    const results = [];

    targetLevels.forEach(levelId => {
      const level = ALL_LEVELS.find(l => l.id === levelId);
      if (!level) return;

      const initHP = Math.floor((level.initHP || 20) * ((diff.initHP || 20) / 20));
      const waves = generateWaves(levelId, difficulty);
      if (!waves || waves.length === 0) return;

      // 累计每关总血量 / 总敌人数
      let totalEnemies = 0;
      let totalEnemyHp = 0;
      let avgSpeedSum = 0;
      let speedSamples = 0;
      for (const w of waves) {
        for (const enemyType of w.enemies) {
          const s = (w.enemyStats && w.enemyStats[enemyType]) || null;
          if (!s) continue;
          totalEnemies += 1;
          totalEnemyHp += s.hp;
          avgSpeedSum += s.speed;
          speedSamples += 1;
        }
      }
      const avgSpeed = speedSamples > 0 ? avgSpeedSum / speedSamples : 0.3;

      // 简单 AI 估算：3 个 3 级激光塔（平均 DPS ≈ 45）
      const AI_DPS = 3 * 45;
      const totalClearTime = totalEnemyHp / AI_DPS;
      // 击杀时间预算：每波 5s 间隔 + 20s 出怪 ≈ 25s/波 × waves.length
      const TIME_BUDGET = 25 * waves.length;

      // 漏过估算：超出时间预算的"余量"按 avgSpeed 折算成漏过敌人数
      const overflow = Math.max(0, totalClearTime - TIME_BUDGET);
      const leaks = Math.round(overflow * avgSpeed * 0.5); // 0.5 系数：实际有 AOE 多目标
      const remainingHP = Math.max(0, initHP - leaks);

      // 估算星级（基于关卡的 starThresholds）
      const thresholds = level.starThresholds || [20, 15, 10];
      let stars = 0;
      if (remainingHP >= thresholds[0]) stars = 3;
      else if (remainingHP >= thresholds[1]) stars = 2;
      else if (remainingHP > 0) stars = 1;

      // 诊断 tag：简单关剩余 HP > 阈值[0] 算"过松"，困难关剩余 HP < 3 算"过紧"
      const isHard = (level.difficulty === 'hard' || level.difficulty === 'ultimate');
      const isEasy = (level.difficulty === 'easy' || levelId <= 5);
      let tag = 'balanced';
      if (isEasy && remainingHP > thresholds[0]) tag = 'too_easy';
      else if (isHard && remainingHP < 3) tag = 'too_hard';

      results.push({
        levelId,
        levelName: level.name,
        difficulty: level.difficulty || 'normal',
        initialHP: initHP,
        remainingHP,
        leaks,
        totalEnemies,
        totalEnemyHp: Math.round(totalEnemyHp),
        clearTimeSec: Math.round(totalClearTime),
        stars,
        tag
      });
    });

    return results;
  }
}
