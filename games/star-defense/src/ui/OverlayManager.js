// ================================================================
// 覆盖层管理 - 开始/胜利/失败/关卡选择/宝箱奖励界面
// ================================================================
import { LEVEL_CONFIG } from '../core/Constants.js';
import { loadProfile } from '../data/PlayerProfile.js';
import { TECH_TREE } from '../data/TechTree.js';
import { ALL_LEVELS } from '../data/LevelConfig.js';
import { matchVictoryFlavor } from '../data/VictoryFlavor.js';

export class OverlayManager {
  /**
   * @param {import('../audio/AudioManager.js').AudioManager} [audio]
   */
  constructor(audio = null) {
    this.audio = audio;

    this.overlay = document.getElementById('overlay');
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlaySubtitle = document.getElementById('overlaySubtitle');
    this.overlayButtons = document.getElementById('overlayButtons');

    /** 宝箱容器 */
    this.chestReward = document.getElementById('chestReward');

    /** 回调函数 */
    this.onStartGame = null;
    this.onRestartGame = null;
    this.onShowLevelSelect = null;
    this.onBackToLevelSelect = null;
    /** 宝箱实际奖励回调（由 Game 注册） */
    this.onChestReward = null;
  }

  /**
   * 设置音频引用（兼容延迟注入场景）
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   */
  setAudio(audio) {
    this.audio = audio;
  }

  /**
   * 播放UI点击音效
   */
  _playClick() {
    this.audio?.play('click');
  }

  /**
   * 获取幸运值（从玩家档案统计中获取）
   * @returns {number} 幸运值
   */
  _getLuckValue() {
    try {
      const profile = loadProfile();
      // 基础幸运值来自总游戏局数
      const luck = (profile.stats.totalGames || 0);
      return luck;
    } catch (e) {
      return 0;
    }
  }

  /**
   * 设置回调
   */
  setStartGameCallback(cb) { this.onStartGame = cb; }
  setRestartGameCallback(cb) { this.onRestartGame = cb; }
  setShowLevelSelectCallback(cb) { this.onShowLevelSelect = cb; }
  setBackToLevelSelectCallback(cb) { this.onBackToLevelSelect = cb; }
  /** 注册宝箱实际奖励回调 */
  setChestRewardCallback(cb) { this.onChestReward = cb; }
  /** 注册升级商店回调 */
  setShowUpgradeCallback(cb) { this.onShowUpgrade = cb; }
  /** 注册每日挑战回调 */
    setShowDailyCallback(cb) { this.onShowDaily = cb; }
    /** 注册无尽模式回调 */
    setShowEndlessCallback(cb) { this.onShowEndless = cb; }
    /** 注册对战模式回调 */
    setShowBattleCallback(cb) { this.onShowBattle = cb; }
    /** 注册章节挑战回调（P4-6） */
    setShowChapterCallback(cb) { this.onShowChapter = cb; }
    /** 注册星际图谱回调 */
    setShowTechTreeCallback(cb) { this.onShowTechTree = cb; }

  /**
   * 显示开始界面（重做版：Hero 标题 + 双列按钮 + 压缩规则）
   */
  showStartScreen(stardust) {
    this.overlay.classList.remove('hidden');

    const stardustHtml = stardust !== undefined
      ? `<span class="hero-stardust">✦ 星尘结晶 <strong>${stardust}</strong></span>`
      : '';

    this.overlayTitle.textContent = '';
    this.overlayTitle.style.color = 'transparent';

    this.overlaySubtitle.innerHTML = `
      <div class="hero-block">
        <div class="hero-en">S T A R &nbsp; D E F E N S E</div>
        <h1 class="hero-title">星际防线</h1>
        <div class="hero-line"></div>
        <div class="hero-tagline">在星海尽头，守护最后的家园</div>
        <div class="hero-stardust-row">${stardustHtml}</div>
      </div>

      <div class="menu-grid">
        <button class="menu-card menu-card--primary" id="startGameBtn">
          <div class="menu-card-icon">▶</div>
          <div class="menu-card-body">
            <div class="menu-card-title">开始游戏</div>
            <div class="menu-card-sub">选择关卡 · 保卫基地</div>
          </div>
          <div class="menu-card-glow"></div>
        </button>

        <button class="menu-card menu-card--shop" id="upgradeBtn">
          <div class="menu-card-icon">⬡</div>
          <div class="menu-card-body">
            <div class="menu-card-title">升级商店</div>
            <div class="menu-card-sub">永久强化</div>
          </div>
        </button>

        <button class="menu-card menu-card--daily" id="dailyBtn">
          <div class="menu-card-icon">📅</div>
          <div class="menu-card-body">
            <div class="menu-card-title">每日挑战</div>
            <div class="menu-card-sub">限定种子</div>
          </div>
        </button>

        <button class="menu-card menu-card--endless" id="endlessBtn">
          <div class="menu-card-icon">∞</div>
          <div class="menu-card-body">
            <div class="menu-card-title">无尽模式</div>
            <div class="menu-card-sub">坚持到极限</div>
          </div>
        </button>

        <button class="menu-card menu-card--battle" id="battleBtn">
          <div class="menu-card-icon">⚔</div>
          <div class="menu-card-body">
            <div class="menu-card-title">对战模式</div>
            <div class="menu-card-sub">1v1 兵营对决</div>
          </div>
        </button>

        <button class="menu-card menu-card--chapter" id="chapterBtn">
          <div class="menu-card-icon">📖</div>
          <div class="menu-card-body">
            <div class="menu-card-title">章节挑战</div>
            <div class="menu-card-sub">3 关连打</div>
          </div>
        </button>

        <button class="menu-card menu-card--techtree" id="techTreeBtn" data-page="techTree">
          <div class="menu-card-icon">✦</div>
          <div class="menu-card-body">
            <div class="menu-card-title">星际图谱</div>
            <div class="menu-card-sub">解锁全局科技</div>
          </div>
        </button>
      </div>

      <button class="rules-toggle" id="rulesToggle" aria-expanded="false">
        <span class="rules-toggle-icon">?</span>
        <span>玩法说明</span>
      </button>

      <div class="rules-panel hidden" id="rulesPanel">
        <div class="rules-grid">
          <div class="rule"><span class="rule-num">1</span>在路径旁的标记位置放置防御塔</div>
          <div class="rule"><span class="rule-num">2</span>敌人从右侧入口沿路径入侵</div>
          <div class="rule"><span class="rule-num">3</span>消灭敌人获取星尘能量</div>
          <div class="rule"><span class="rule-num">4</span>每关${LEVEL_CONFIG.WAVES_PER_LEVEL}波进攻，保护左侧基地</div>
          <div class="rule"><span class="rule-num">5</span>点击已放置的塔可升级或出售</div>
          <div class="rule"><span class="rule-num">6</span>共${LEVEL_CONFIG.TOTAL_LEVELS}个关卡（含12星座关卡）</div>
          <div class="rule"><span class="rule-num">7</span>相邻塔可触发组合效果</div>
          <div class="rule"><span class="rule-num">8</span>星座关卡有独特元素克制和特殊机制</div>
        </div>
      </div>
    `;

    this.overlayButtons.innerHTML = '';

    document.getElementById('startGameBtn').addEventListener('click', () => {
      this._playClick();
      if (this.onShowLevelSelect) this.onShowLevelSelect();
    });
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        this._playClick();
        if (this.onShowUpgrade) this.onShowUpgrade();
      });
    }
    const dailyBtn = document.getElementById('dailyBtn');
    if (dailyBtn) {
      dailyBtn.addEventListener('click', () => {
        this._playClick();
        if (this.onShowDaily) this.onShowDaily();
      });
    }
    const endlessBtn = document.getElementById('endlessBtn');
    if (endlessBtn) {
      endlessBtn.addEventListener('click', () => {
        this._playClick();
        if (this.onShowEndless) this.onShowEndless();
      });
    }
    const battleBtn = document.getElementById('battleBtn');
    if (battleBtn) {
      battleBtn.addEventListener('click', () => {
        this._playClick();
        if (this.onShowBattle) this.onShowBattle();
      });
    }
    const chapterBtn = document.getElementById('chapterBtn');
    if (chapterBtn) {
      chapterBtn.addEventListener('click', () => {
        this._playClick();
        if (this.onShowChapter) this.onShowChapter();
      });
    }
    const techTreeBtn = document.getElementById('techTreeBtn');
    if (techTreeBtn) {
      techTreeBtn.addEventListener('click', () => {
        this._playClick();
        if (this.onShowTechTree) this.onShowTechTree();
      });
    }

    // 玩法说明折叠
    const rulesToggle = document.getElementById('rulesToggle');
    const rulesPanel = document.getElementById('rulesPanel');
    if (rulesToggle && rulesPanel) {
      rulesToggle.addEventListener('click', () => {
        this._playClick();
        const open = rulesPanel.classList.toggle('hidden');
        rulesToggle.setAttribute('aria-expanded', String(!open));
      });
    }
  }

  /**
   * 显示胜利界面（带星级评价、关卡信息和星尘奖励）
   */
  showVictory(data) {
    this.overlay.classList.remove('hidden');
    // 胜利号角
    this.audio?.play('victory');

    // 使用关卡配置的星级阈值
    const thresholds = data.starThresholds || [20, 15, 10];
    let starCount = 1;
    if (data.hp >= thresholds[0]) starCount = 3;
    else if (data.hp >= thresholds[1]) starCount = 2;

    const starsHtml = '<span class="star-filled">' + '\u2605'.repeat(starCount) + '</span>' +
                      '<span class="star-empty">' + '\u2606'.repeat(3 - starCount) + '</span>';

    const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    // 匹配通关评语（P3-4）
    const flavor = this._resolveVictoryFlavor(data, starCount, elapsed);

    this.overlayTitle.textContent = '胜利！';
    this.overlayTitle.style.color = '#a8cc55';
    this.overlaySubtitle.innerHTML = `
      <div style="font-size:14px;color:#aa8877;margin-bottom:6px;">${data.levelName || ''}</div>
      <div class="stars-display">${starsHtml}</div>
      <div class="victory-flavor" style="
        display:flex;align-items:center;justify-content:center;gap:8px;
        margin:10px auto 4px;padding:10px 16px;
        max-width:340px;
        background:linear-gradient(135deg, rgba(255,204,85,0.18), rgba(180,130,220,0.18));
        border:1px solid rgba(255,204,85,0.45);
        border-radius:12px;
        box-shadow:0 4px 18px rgba(255,170,68,0.18);
      ">
        <span style="font-size:22px;line-height:1;">${flavor.icon}</span>
        <span style="font-size:14px;font-weight:700;color:#ffe8a8;letter-spacing:1px;">${flavor.text}</span>
      </div>
      <div class="stats-info">
        剩余生命: <span style="color:#ff8866;font-weight:bold;">${data.hp}</span><br>
        总击杀: <span style="color:#ffaa77;font-weight:bold;">${data.kills}</span><br>
        防御塔: <span style="color:#ffbb77;font-weight:bold;">${data.towerCount}</span><br>
        用时: <span style="color:#88bbcc;font-weight:bold;">${minutes}分${seconds}秒</span><br>
        难度: <span style="color:#ffcc55;font-weight:bold;">${data.difficultyName}</span>
      </div>
    `;

    // 显示星尘奖励（新增）
    const stardustHtml = data.stardustReward
      ? `<div style="margin-top:8px;color:#ffcc55;font-size:14px;">
           ✦ 获得 <span style="font-weight:bold;color:#ffcc55;">${data.stardustReward}</span> 星尘结晶（累计：${data.stardustTotal}）
         </div>`
      : '';

    // 章节挑战完成提示（P4-6）
    const chapterHtml = data.chapterComplete
      ? `<div style="margin-top:10px;padding:8px 14px;border:1px solid rgba(255,204,85,0.4);border-radius:10px;background:rgba(255,204,85,0.12);">
           📖 章节挑战完成！额外奖励 <span style="font-weight:bold;color:#ffcc55;">${data.chapterComplete.reward}</span> 星尘
         </div>`
      : '';

    this.overlayButtons.innerHTML = `
      <button class="overlay-btn btn-victory" id="openChestBtn">开启宝箱</button>
      <button class="overlay-btn btn-back" id="backToLevelsBtn">关卡选择</button>
      ${stardustHtml}
      ${chapterHtml}
    `;

    // 保存进度（在评语匹配后调用，避免 firstClear 误判）
    if (data.onLevelComplete) {
      data.onLevelComplete(starCount);
    }

    // 绑定事件 - 点击"开启宝箱"
    document.getElementById('openChestBtn').addEventListener('click', () => {
      this._playClick();
      this.overlay.classList.add('hidden');
      this._showChestReward();
    });

    document.getElementById('backToLevelsBtn').addEventListener('click', () => {
      this._playClick();
      if (this.onBackToLevelSelect) this.onBackToLevelSelect();
    });
  }

  /**
   * 解析通关评语（P3-4）
   * 根据 data / 关卡档案匹配最合适的一条评语
   * @param {Object} data
   * @param {number} starCount
   * @param {number} elapsed
   * @returns {{id:string,text:string,icon:string}}
   * @private
   */
  _resolveVictoryFlavor(data, starCount, elapsed) {
    const ctx = {
      starCount,
      elapsed,
      maxHp: 0,
      remainingHp: data.hp || 0,
      isFirstClear: false,
    };

    // 通过关卡名称查找关卡 id & 初始 HP
    const level = this._findLevelByName(data.levelName);
    if (level) {
      const diffKey = this._mapDifficultyNameToKey(data.difficultyName);
      if (diffKey) {
        ctx.maxHp = this._computeMaxHp(level, diffKey);
        ctx.isFirstClear = this._isFirstClear(level.id, diffKey);
      }
    }

    return matchVictoryFlavor(data || {}, ctx);
  }

  /**
   * 通过关卡名称在 ALL_LEVELS 中查找关卡对象
   * @private
   */
  _findLevelByName(levelName) {
    if (!levelName) return null;
    try {
      return ALL_LEVELS.find(l => l && l.name === levelName) || null;
    } catch {
      return null;
    }
  }

  /**
   * 把 difficultyName（label）映射回 difficulty key
   * @private
   */
  _mapDifficultyNameToKey(difficultyName) {
    const map = {
      '简单': 'easy',
      '普通': 'normal',
      '普通+': 'normal+',
      '困难': 'hard',
      '终极': 'ultimate',
    };
    return map[difficultyName] || null;
  }

  /**
   * 计算本局起始 HP（与 Game.js 公式保持一致）
   *   hp = floor(level.initHP * (diffData.initHP / 20))
   * @private
   */
  _computeMaxHp(level, difficultyKey) {
    const DIFFICULTY = {
      easy: 30,
      normal: 20,
      'normal+': 20,
      hard: 20,
      ultimate: 10,
    };
    const diffHp = DIFFICULTY[difficultyKey];
    if (!diffHp || !level.initHP) return 0;
    return Math.floor(level.initHP * (diffHp / 20));
  }

  /**
   * 判断本关本难度是否为首次通关
   * 通过 LEVEL_CONFIG.STARS_KEY 中是否已有 ${levelId}_${difficulty} 记录判断
   * @private
   */
  _isFirstClear(levelId, difficultyKey) {
    try {
      const stars = JSON.parse(localStorage.getItem(LEVEL_CONFIG.STARS_KEY) || '{}');
      const starKey = `${levelId}_${difficultyKey}`;
      // 无记录 = 首次通关
      return !stars[starKey];
    } catch {
      return false;
    }
  }

  /**
   * 显示宝箱奖励界面
   */
  _showChestReward() {
    if (!this.chestReward) return;

    this.chestReward.classList.remove('hidden');
    this.chestReward.innerHTML = `
      <div class="chest-container" id="chestContainer">
        <div class="chest" id="chestBox">&#127873;</div>
        <div class="chest-hint">点击开启宝箱</div>
      </div>
      <div class="reward-result hidden" id="rewardResult">
        <div class="reward-rarity" id="rewardRarity"></div>
        <div class="reward-text" id="rewardText"></div>
        <div class="reward-desc" id="rewardDesc"></div>
        <button class="overlay-btn btn-back" id="chestBackBtn" style="margin-top:20px;">返回关卡选择</button>
      </div>
    `;

    // 点击宝箱开启
    document.getElementById('chestContainer').addEventListener('click', () => {
      this._playClick();
      this._openChest();
    });

    // 返回按钮
    document.getElementById('chestBackBtn').addEventListener('click', () => {
      this._playClick();
      this.chestReward.classList.add('hidden');
      if (this.onBackToLevelSelect) this.onBackToLevelSelect();
    });
  }

  /**
   * 开启宝箱动画（奖励通过回调实际生效）
   */
  _openChest() {
    const chestBox = document.getElementById('chestBox');
    const chestContainer = document.getElementById('chestContainer');
    const rewardResult = document.getElementById('rewardResult');

    if (!chestBox || !chestContainer || !rewardResult) return;

    // 宝箱翻转动画
    chestBox.classList.add('opened');

    // 1秒后显示奖励
    setTimeout(() => {
      // 随机奖励（与幸运值挂钩）
      const luck = this._getLuckValue();
      const roll = Math.random() * (1 + luck * 0.1);
      let rarity, rarityClass, rewardText, rewardDesc, rewardType, rewardValue;

      if (roll < 0.10) {
        // 史诗（10%）
        const epic = [
          { type: 'stardust', value: 80, text: '+80 星尘结晶', desc: '大量星尘结晶，可用于升级商店' },
          { type: 'skin', value: 1, text: '解锁星际涂装', desc: '所有塔获得全新视觉皮肤' }
        ];
        const r = epic[Math.floor(Math.random() * epic.length)];
        rarity = '史诗奖励'; rarityClass = 'epic';
        rewardText = r.text; rewardDesc = r.desc;
        rewardType = r.type; rewardValue = r.value;
      } else if (roll < 0.40) {
        // 稀有（30%）
        const rare = [
          { type: 'stardust', value: 40, text: '+40 星尘结晶', desc: '星尘结晶可用于元游戏升级' },
          { type: 'nextEnergy', value: 30, text: '下次+30起始能量', desc: '下一局开始时额外获得30能量' }
        ];
        const r = rare[Math.floor(Math.random() * rare.length)];
        rarity = '稀有奖励'; rarityClass = 'rare';
        rewardText = r.text; rewardDesc = r.desc;
        rewardType = r.type; rewardValue = r.value;
      } else {
        // 普通（60%）
        const common = [
          { type: 'stardust', value: 15, text: '+15 星尘结晶', desc: '可用于升级商店购买永久升级' },
          { type: 'hpRestore', value: 1, text: '+1 生命上限', desc: '基地最大生命值永久+1' }
        ];
        const r = common[Math.floor(Math.random() * common.length)];
        rarity = '普通奖励'; rarityClass = 'common';
        rewardText = r.text; rewardDesc = r.desc;
        rewardType = r.type; rewardValue = r.value;
      }

      // 调用回调，让 Game 实际生效
      if (this.onChestReward) {
        this.onChestReward(rewardType, rewardValue);
      }

      // 隐藏宝箱，显示奖励
      chestContainer.style.display = 'none';
      rewardResult.classList.remove('hidden');
      document.getElementById('rewardRarity').textContent = rarity;
      document.getElementById('rewardRarity').className = `reward-rarity ${rarityClass}`;
      document.getElementById('rewardText').textContent = rewardText;
      document.getElementById('rewardDesc').textContent = rewardDesc;
    }, 800);
  }

  /**
   * 显示失败界面
   */
  showDefeat(data) {
    this.overlay.classList.remove('hidden');
    // 失败下行音
    this.audio?.play('defeat');
    this.overlayTitle.textContent = '基地沦陷';
    this.overlayTitle.style.color = '#dd6655';
    this.overlaySubtitle.innerHTML =
      `<span style="color:#aa8877;">外星入侵者突破了防线... 击杀: ${data.kills}，坚持到第 ${data.currentWave + 1} 波</span>` +
      `<div style="color:#776655;font-size:12px;margin-top:8px;">按 R 键立即重开</div>`;
    this.overlayButtons.innerHTML = `
      <button class="overlay-btn btn-restart" id="restartBtn">⚡ 秒重开（R）</button>
      <button class="overlay-btn btn-back" id="backToLevelsBtn2">关卡选择</button>
    `;
    document.getElementById('restartBtn').addEventListener('click', () => {
      this._playClick();
      if (this.onRestartGame) this.onRestartGame();
    });
    document.getElementById('backToLevelsBtn2').addEventListener('click', () => {
      this._playClick();
      if (this.onBackToLevelSelect) this.onBackToLevelSelect();
    });
  }

  /**
   * 隐藏覆盖层
   */
  hide() {
    this.overlay.classList.add('hidden');
    // 同时隐藏宝箱
    if (this.chestReward) {
      this.chestReward.classList.add('hidden');
    }
  }

  /**
   * 显示星际图谱（科技树）页面
   * @param {Object} [opts]
   * @param {Object} [opts.profile] 玩家档案（不传则 loadProfile）
   * @param {Object} [opts.meta]    MetaProgression 实例（用于 unlockTech / 持久化）
   * @param {Function} [opts.onBack] 返回主菜单回调
   */
  showTechTree(opts = {}) {
    const profile = opts.profile || loadProfile();
    const meta = opts.meta || null;
    const onBack = opts.onBack || (() => { this.showStartScreen(profile.stardust); });
    // 记忆 onBack 以便内层重渲染时复用
    this._techTreeOnBack = onBack;

    this.overlay.classList.remove('hidden');
    this.overlayTitle.textContent = '';
    this.overlayTitle.style.color = 'transparent';

    const tierLabels = { 1: 'Ⅰ 入门', 2: 'Ⅱ 进阶', 3: 'Ⅲ 终极' };
    const tiers = [1, 2, 3];

    const renderTiers = () => {
      let html = '';
      for (const tier of tiers) {
        const techsInTier = TECH_TREE.filter(t => t.tier === tier);
        html += `<div class="tech-tree-tier">`;
        html += `<div class="tech-tree-tier-label">${tierLabels[tier] || tier}</div>`;
        html += `<div class="tech-tree-grid">`;
        for (const tech of techsInTier) {
          const unlocked = profile.hasTech(tech.id);
          const canBuy = !unlocked && profile.stardust >= tech.cost;
          const cls = unlocked ? 'tech-card--unlocked' : (canBuy ? 'tech-card--available' : 'tech-card--locked');
          const status = unlocked ? '✓ 已解锁' : (canBuy ? '点击解锁' : '✦ ' + tech.cost);
          html += `
            <div class="tech-card ${cls}" data-tech-id="${tech.id}">
              <div class="tech-card-icon">${tech.icon}</div>
              <div class="tech-card-body">
                <div class="tech-card-name">${tech.name}</div>
                <div class="tech-card-desc">${tech.desc}</div>
                <div class="tech-card-status">${status}</div>
              </div>
            </div>
          `;
        }
        html += `</div></div>`;
      }
      return html;
    };

    this.overlaySubtitle.innerHTML = `
      <div class="tech-tree-page">
        <div class="tech-tree-header">
          <button class="overlay-btn tech-tree-back" id="techTreeBackBtn">‹ 返回</button>
          <h2 class="tech-tree-title">✦ 星际图谱</h2>
          <div class="tech-tree-stardust">✦ 星尘 <strong id="techTreeStardust">${profile.stardust}</strong></div>
        </div>
        <div class="tech-tree-hint">点击科技卡解锁，消耗星尘结晶。已解锁的全局生效。</div>
        <div class="tech-tree-tiers" id="techTreeTiers">
          ${renderTiers()}
        </div>
        <div class="tech-tree-toast" id="techTreeToast"></div>
      </div>
    `;
    this.overlayButtons.innerHTML = '';

    // 绑定卡片点击
    const cards = this.overlaySubtitle.querySelectorAll('.tech-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-tech-id');
        this._onTechCardClick(id, profile, meta);
      });
    });

    // 绑定返回
    const backBtn = document.getElementById('techTreeBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this._playClick();
        onBack();
      });
    }
  }

  /** 处理科技卡点击 */
  _onTechCardClick(techId, profile, meta) {
    const tech = TECH_TREE.find(t => t.id === techId);
    if (!tech) return;
    this._playClick();

    if (profile.hasTech(techId)) {
      this._showTechToast(`✓ ${tech.name} 已解锁：${tech.desc}`);
      return;
    }

    if (profile.stardust < tech.cost) {
      this._showTechToast(`✦ 星尘不足，需要 ${tech.cost}`);
      return;
    }

    // 扣费 + 解锁（优先 meta.unlockTech，没有则直接调 profile 方法）
    let ok = false;
    if (meta && typeof meta.unlockTech === 'function') {
      const r = meta.unlockTech(techId);
      ok = !!r.success;
    } else if (profile.spendStardust && profile.unlockTech) {
      if (profile.spendStardust(tech.cost)) {
        profile.unlockTech(techId);
        ok = true;
      }
    }
    if (!ok) {
      this._showTechToast('解锁失败');
      return;
    }
    this._showTechToast(`✦ 解锁成功：${tech.name}`);
    // 重渲染整页（保留返回回调）
    this.showTechTree({
      profile,
      meta,
      onBack: this._techTreeOnBack,
    });
  }

  /** 顶部轻提示 */
  _showTechToast(msg) {
    const t = document.getElementById('techTreeToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('tech-tree-toast--show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      t.classList.remove('tech-tree-toast--show');
    }, 1600);
  }

  /**
   * 是否可见
   */
  isVisible() {
    return !this.overlay.classList.contains('hidden');
  }
}
