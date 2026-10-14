// ================================================================
// UI管理 - 卡牌栏、状态栏、按钮、连击显示（支持关卡系统、自动波次）
// ================================================================
import { TOWER_TYPES, getTowerIcon } from '../data/TowerTypes.js';
import { ECONOMY, COMBO } from '../core/Constants.js';
import { getWavePreviewData } from '../data/WaveConfig.js';
import { UiAnimator, EASE } from './UiAnimator.js';
import { getTowerLore } from '../data/TowerLore.js';

export class UIManager {
  constructor(eventBus) {
    this.eventBus = eventBus;

    // DOM元素引用
    this.waveDisplay = document.getElementById('waveDisplay');
    this.hpDisplay = document.getElementById('hpDisplay');
    this.hpBar = document.getElementById('hpBar');
    this.energyDisplay = document.getElementById('energyDisplay');
    this.energyBar = document.getElementById('energyBar');
    this.killDisplay = document.getElementById('killDisplay');
    this.interestDisplay = document.getElementById('interestDisplay');
    this.waveBtn = document.getElementById('waveBtn');
    this.wavePreview = document.getElementById('wavePreview');
    this.pauseOverlay = document.getElementById('pauseOverlay');
    this.comboDisplay = document.getElementById('comboDisplay');
    this.bottomBar = document.getElementById('bottomBar');
    this.muteBtn = document.getElementById('muteBtn');
    this.retreatBtn = document.getElementById('retreatBtn');
    this.waveAnnouncement = document.getElementById('waveAnnouncement');

    // 速度按钮
    this.speedBtns = {
      pause: document.getElementById('speedPause'),
      speed1: document.getElementById('speed1'),
      speed2: document.getElementById('speed2'),
      speed3: document.getElementById('speed3')
    };

    // 当前选中的塔类型索引
    this.selectedTower = null;

    // 游戏数据引用
    this.gameData = null;

    // 当前关卡名称
    this.currentLevelName = '';

    // 回调
    this.onSelectTower = null;
    this.onStartWave = null;
    this.onSetSpeed = null;
    this.onToggleMute = null;
    this.onRetreat = null;

    // === Agent E: 主动技能系统（由 Game 注入） ===
    this.abilitySystem = null;
    this.abilityButton = null;
    this.abilityIconEl = null;
    this.abilityNameEl = null;
    this.abilityCdEl = null;
    this.abilityKeyEl = null;

    // 初始化卡牌栏
    this._initCardBar();
    // === Agent E: 初始化主动技能按钮 ===
    this._initAbilityButton();

    // 隐藏"开始波次"按钮（改为自动波次系统）
    if (this.waveBtn) {
      this.waveBtn.style.display = 'none';
    }

    // 绑定速度和静音事件（带点击涟漪反馈）
    Object.entries(this.speedBtns).forEach(([key, btn]) => {
      btn.addEventListener('click', (e) => {
        this._playClickRipple(e, btn);
        const speed = key === 'pause' ? 0 : parseInt(key.replace('speed', ''));
        if (this.onSetSpeed) this.onSetSpeed(speed);
      });
    });

    this.muteBtn.addEventListener('click', (e) => {
      this._playClickRipple(e, this.muteBtn);
      if (this.onToggleMute) this.onToggleMute();
    });

    this.retreatBtn.addEventListener('click', (e) => {
      this._playClickRipple(e, this.retreatBtn);
      if (this.onRetreat) this.onRetreat();
    });

    // 应用入场动画到顶部状态栏各元素
    this._playEntranceAnimations();

    // 监听事件
    this.eventBus.on('ui:update', () => this.update());
    this.eventBus.on('combo:update', (data) => this._updateCombo(data));
    this.eventBus.on('wave:started', () => this._onWaveStarted());
    this.eventBus.on('wave:completed', () => this._onWaveCompleted());
  }

  /**
   * 设置游戏数据引用
   */
  setGameData(data) {
    this.gameData = data;
    // 初始化 tween 显示值，避免一上来就动画飞过去
    this._displayed = {
      hp: data.hp,
      energy: data.energy,
      kills: data.kills
    };
  }

  /**
   * 设置当前关卡名称
   */
  setLevelName(name) {
    this.currentLevelName = name;
  }

  /**
   * 设置回调
   */
  setSelectTowerCallback(cb) { this.onSelectTower = cb; }
  setStartWaveCallback(cb) { this.onStartWave = cb; }
  setSetSpeedCallback(cb) { this.onSetSpeed = cb; }
  setToggleMuteCallback(cb) { this.onToggleMute = cb; }

  // === Agent A1: 注入 UI 动画管理工具 ===
  setUiAnimator(uiAnimator) {
    this.uiAnimator = uiAnimator;
  }

  // === Agent E: 注入主动技能系统 ===
  /**
   * @param {import('../systems/AbilitySystem.js').AbilitySystem} abilitySystem
   */
  setAbilitySystem(abilitySystem) {
    this.abilitySystem = abilitySystem;
    // 监听事件，触发 UI 更新
    this.eventBus.on('ability:triggered', () => this._refreshAbilityButton());
    this.eventBus.on('ability:selectionChanged', () => this._refreshAbilityButton());
    // 初始刷新
    this._refreshAbilityButton();
  }

  // === Agent E: 初始化主动技能按钮 ===
  _initAbilityButton() {
    const container = document.getElementById('gameContainer');
    if (!container) return;
    // 已存在则不重复创建
    if (document.getElementById('abilityButton')) return;

    const btn = document.createElement('div');
    btn.id = 'abilityButton';
    btn.className = 'ability-button ability-hidden';
    btn.innerHTML = `
      <div class="ability-icon" id="abilityIcon">🔥</div>
      <div class="ability-info">
        <div class="ability-name" id="abilityName">大招</div>
        <div class="ability-cooldown" id="abilityCooldown"></div>
      </div>
      <div class="ability-key" id="abilityKey">R</div>
      <div class="ability-cd-overlay" id="abilityCdOverlay"></div>
    `;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.abilitySystem) return;
      this._playClickRipple(e, btn);
      this.abilitySystem.trigger();
    });
    container.appendChild(btn);

    this.abilityButton = btn;
    this.abilityIconEl = btn.querySelector('#abilityIcon');
    this.abilityNameEl = btn.querySelector('#abilityName');
    this.abilityCdEl = btn.querySelector('#abilityCooldown');
    this.abilityKeyEl = btn.querySelector('#abilityKey');
    this.abilityCdOverlayEl = btn.querySelector('#abilityCdOverlay');
  }

  // === Agent E: 刷新技能按钮显示（每帧调用） ===
  _refreshAbilityButton() {
    if (!this.abilityButton) return;
    if (!this.abilitySystem) {
      this.abilityButton.classList.add('ability-hidden');
      return;
    }
    const ab = this.abilitySystem.getSelectedAbility();
    if (!ab) {
      this.abilityButton.classList.add('ability-hidden');
      return;
    }
    this.abilityButton.classList.remove('ability-hidden');
    this.abilityIconEl.textContent = ab.icon || '🔥';
    this.abilityNameEl.textContent = ab.name || '大招';
    this.abilityKeyEl.textContent = 'R';

    const cd = this.abilitySystem.getSelectedCooldown();
    if (cd > 0) {
      this.abilityButton.classList.add('ability-cooldown-active');
      this.abilityButton.classList.remove('ability-ready');
      this.abilityCdEl.textContent = cd.toFixed(1) + 's';
      // 倒计时遮罩：高度比例
      const ratio = Math.max(0, Math.min(1, cd / ab.cooldown));
      this.abilityCdOverlayEl.style.height = (ratio * 100) + '%';
    } else {
      this.abilityButton.classList.remove('ability-cooldown-active');
      this.abilityButton.classList.add('ability-ready');
      this.abilityCdEl.textContent = '就绪';
      this.abilityCdOverlayEl.style.height = '0%';
    }

    // 颜色提示
    this.abilityButton.style.setProperty('--ability-color', ab.color || '#ffdd44');
    this.abilityButton.title = (ab.desc || ab.name) + '\n[点击或按 R 键]';
  }

  /**
   * 播放顶部状态栏入场动画（错位淡入上浮）
   */
  _playEntranceAnimations() {
    // 顶部状态栏 stat-items 错位入场
    const statItems = document.querySelectorAll('#topBar .stat-item');
    statItems.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-12px)';
      el.style.transition = `opacity 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.07}s, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.07}s`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        });
      });
      // 清理内联 transition
      setTimeout(() => {
        el.style.transition = '';
      }, 700 + i * 70);
    });

    // 速度控制按钮入场
    const speedControls = document.getElementById('speedControls');
    if (speedControls) {
      speedControls.style.opacity = '0';
      speedControls.style.transform = 'translateY(-10px)';
      speedControls.style.transition = 'opacity 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s, transform 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          speedControls.style.opacity = '1';
          speedControls.style.transform = 'translateY(0)';
        });
      });
      setTimeout(() => { speedControls.style.transition = ''; }, 900);
    }
  }

  /**
   * 按钮点击涟漪反馈效果
   * @param {MouseEvent} e - 点击事件
   * @param {HTMLElement} btn - 按钮元素
   */
  _playClickRipple(e, btn) {
    if (!btn) return;
    // 弹性缩放反馈
    btn.style.transform = 'scale(0.92)';
    btn.style.transition = 'transform 0.1s cubic-bezier(0.34,1.56,0.64,1)';
    setTimeout(() => {
      btn.style.transform = '';
      btn.style.transition = '';
    }, 150);

    // 创建涟漪元素
    try {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height) * 1.5;
      const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
      const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;

      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.25);
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        transform: scale(0);
        animation: rippleEffect 0.5s ease-out forwards;
        pointer-events: none;
        z-index: 10;
      `;
      // 确保按钮有 position: relative/absolute
      const pos = getComputedStyle(btn).position;
      if (pos === 'static') btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 550);
    } catch (_) { /* 静默失败 */ }
  }

  /**
   * 卡牌点击弹性反馈
   * @param {HTMLElement} card - 卡牌元素
   */
  _playCardClickFeedback(card) {
    if (!card) return;
    card.style.transform = 'translateY(-4px) scale(1.02)';
    card.style.transition = 'transform 0.08s cubic-bezier(0.34,1.56,0.64,1)';
    setTimeout(() => {
      card.style.transform = '';
      card.style.transition = '';
    }, 160);
  }

  /**
   * 显示免费放置塔提示
   * @param {string} towerId - 塔类型ID
   */
  showFreeTowerHint(towerId) {
    const towerType = TOWER_TYPES.find(t => t.id === towerId);
    if (!towerType) return;
    const hint = document.createElement('div');
    hint.className = 'free-tower-hint';
    hint.textContent = `免费放置: ${towerType.name} ${towerType.icon}`;
    hint.style.cssText = `
      position: absolute; top: 50px; left: 50%; transform: translateX(-50%);
      padding: 6px 16px; background: rgba(40,30,15,0.9); border: 1px solid #88cc66;
      border-radius: 6px; color: #88cc66; font-size: 13px; font-weight: bold;
      z-index: 10; animation: pulse 1s ease-in-out infinite;
    `;
    const container = document.getElementById('gameContainer');
    // 移除旧提示
    const oldHint = container.querySelector('.free-tower-hint');
    if (oldHint) oldHint.remove();
    container.appendChild(hint);
    // 5秒后自动移除
    setTimeout(() => { if (hint.parentNode) hint.remove(); }, 8000);
  }

  // Element color mapping for card element bars
  static ELEMENT_COLORS = {
    fire: '#ff8866',
    earth: '#b8a44e',
    wind: '#ffbb77',
    water: '#77bbcc'
  };

  static TOWER_ELEMENT_MAP = {
    laser: 'fire',
    missile: 'fire',
    tesla: 'wind',
    plasma: 'wind',
    cryo: 'water',
    shield: 'earth',
    collector: 'earth',
    gravity: 'earth',
    repair: 'earth'
  };

  /**
   * 初始化卡牌栏
   */
  _initCardBar() {
    this.bottomBar.innerHTML = '';
    TOWER_TYPES.forEach((t, i) => {
      const card = document.createElement('div');
      card.className = 'tower-card';
      card.id = 'card-' + i;
      card.addEventListener('click', (e) => {
        if (this.gameData && this.gameData.state !== 'playing') return;
        // 点击弹性反馈
        this._playCardClickFeedback(card);
        if (this.selectedTower === i) {
          this.selectedTower = null;
          this._hideCardTooltip();
        } else {
          this.selectedTower = i;
          this._showCardTooltip(t, card);
        }
        this._updateCardUI();
        if (this.onSelectTower) this.onSelectTower(this.selectedTower);
      });

      const element = UIManager.TOWER_ELEMENT_MAP[t.id] || 'earth';
      const elementColor = UIManager.ELEMENT_COLORS[element] || '#b8a44e';

      card.style.setProperty('--element-color', elementColor);

      card.innerHTML = `
        <div class="card-icon" style="border:2px solid ${t.color};">
          <canvas class="card-canvas" width="40" height="40"></canvas>
        </div>
        <div class="card-element-bar" style="background:${elementColor};"></div>
        <div class="card-name">${t.name}</div>
        <div class="card-cost">\u2605 ${t.cost}</div>
      `;

      const canvas = card.querySelector('.card-canvas');
      const ctx = canvas.getContext('2d');
      this._drawMiniTower(ctx, t, 40, 40);

      // === Agent A1: 入场动画（错位弹性缩放） ===
      if (this.uiAnimator) {
        this.uiAnimator.play({
          duration: 0.45,
          delay: i * 0.05,
          ease: EASE.outBack,
          onUpdate: (s) => {
            card.style.opacity = s;
            card.style.transform = `translateY(${(1 - s) * 20}px) scale(${0.7 + s * 0.3})`;
          },
        });
      }

      // === Agent A1: 长按查看塔角色档案 ===
      this._attachLoreLongPress(card, t);

      this.bottomBar.appendChild(card);
    });
  }

  _showCardTooltip(t, cardEl) {
    this._hideCardTooltip();
    const tip = document.createElement('div');
    tip.id = 'globalCardTooltip';
    const dps = t.damage > 0 ? (t.damage / t.fireRate).toFixed(1) : '-';
    let stats = '';
    if (t.type === 'attack') {
      stats = `<div style="font-size:10px;color:#aa9988;margin-top:3px;">伤害:${t.damage} | 射程:${t.range} | 攻速:${t.fireRate}s | DPS:${dps}</div>`;
    }
    tip.innerHTML = `<div style="font-weight:bold;color:${t.color};margin-bottom:3px;">${t.name}</div>
      <div style="font-size:11px;color:#eeddcc;">${t.desc}</div>${stats}
      <div style="font-size:9px;color:#aa99bb;margin-top:4px;opacity:0.7;">长按查看档案</div>`;
    tip.style.cssText = `
      position:fixed; z-index:9999; pointer-events:none;
      background:rgba(30,15,25,0.95); border:1px solid rgba(255,127,127,0.4);
      border-radius:8px; padding:8px 12px; font-size:12px; color:#eeddcc;
      box-shadow:0 4px 12px rgba(0,0,0,0.5); white-space:nowrap;
    `;
    document.body.appendChild(tip);
    const rect = cardEl.getBoundingClientRect();
    tip.style.left = (rect.left + rect.width / 2) + 'px';
    tip.style.top = (rect.top - 8) + 'px';
    tip.style.transform = 'translate(-50%, -100%)';
  }

  _hideCardTooltip() {
    const existing = document.getElementById('globalCardTooltip');
    if (existing) existing.remove();
  }

  // === Agent A1: 长按 600ms 触发塔档案弹窗 ===
  _attachLoreLongPress(cardEl, t) {
    let pressTimer = null;
    let triggered = false;
    const start = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      triggered = false;
      pressTimer = setTimeout(() => {
        triggered = true;
        this._showTowerLore(t);
      }, 600);
    };
    const cancel = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
    };
    cardEl.addEventListener('mousedown', start);
    cardEl.addEventListener('touchstart', start, { passive: true });
    cardEl.addEventListener('mouseup', cancel);
    cardEl.addEventListener('mouseleave', cancel);
    cardEl.addEventListener('touchend', cancel);
    cardEl.addEventListener('touchcancel', cancel);
    // 兼容 oncontextmenu 触发布局
    cardEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._showTowerLore(t);
    });
  }

  _showTowerLore(t) {
    const lore = getTowerLore(t.id);
    if (!lore) return;
    // 移除旧弹窗
    const old = document.getElementById('towerLoreOverlay');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'towerLoreOverlay';
    overlay.style.cssText = `
      position:absolute; inset:0; z-index:4500;
      display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.6);
    `;
    overlay.innerHTML = `
      <div class="tower-lore-card" style="
        max-width: 420px; width: 88%;
        background: linear-gradient(135deg, rgba(40, 24, 48, 0.96), rgba(20, 10, 30, 0.96));
        border: 2px solid ${lore.color};
        border-radius: 14px; padding: 20px 24px;
        box-shadow: 0 0 32px ${lore.color}55, 0 8px 32px rgba(0,0,0,0.6);
        color: #f0e8ff; font-family: inherit;
        text-align: center;
      ">
        <div style="font-size:11px;color:${lore.color};letter-spacing:2px;margin-bottom:6px;">${lore.title}</div>
        <div style="font-size:22px;font-weight:bold;color:#f0e8ff;margin-bottom:10px;">${lore.name}</div>
        <div style="font-size:13px;color:#d0c0d8;line-height:1.6;margin-bottom:14px;">${lore.story}</div>
        <div style="font-size:13px;color:${lore.color};font-style:italic;margin-bottom:14px;">${lore.quote}</div>
        <button class="overlay-btn btn-back" id="towerLoreClose" style="margin-top:6px;">关闭</button>
      </div>
    `;
    this.bottomBar?.parentElement?.appendChild(overlay)
      || document.getElementById('gameContainer')?.appendChild(overlay)
      || document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    const closeBtn = overlay.querySelector('#towerLoreClose');
    if (closeBtn) closeBtn.addEventListener('click', close);
  }

  /**
   * 更新UI
   */
  update() {
    if (!this.gameData) return;

    // 波次显示：关卡名称 + 波次
    const levelPrefix = this.currentLevelName ? `${this.currentLevelName} ` : '';
    const totalWaves = this.gameData.totalWaves;
    if (totalWaves === 0 || this.gameData.currentWave >= totalWaves) {
      // 无尽模式或波次动态生成中
      this.waveDisplay.textContent = `${levelPrefix}波次 ${this.gameData.currentWave + 1}`;
    } else {
      this.waveDisplay.textContent = `${levelPrefix}${this.gameData.currentWave + 1} / ${totalWaves}`;
    }
    // === 数字 tween + 弹动反馈 ===
    if (!this._displayed) {
      this._displayed = { hp: this.gameData.hp, energy: this.gameData.energy, kills: this.gameData.kills };
    }
    // 更平滑的缓动系数
    const hpEase = 0.22;
    const energyEase = 0.2;
    this._displayed.hp = this._tweenNum(this._displayed.hp, this.gameData.hp, hpEase);
    this._displayed.energy = this._tweenNum(this._displayed.energy, this.gameData.energy, energyEase);
    this._displayed.kills = this._tweenNum(this._displayed.kills, this.gameData.kills, 0.35);
    this._setNumberWithBump(this.hpDisplay, this._displayed.hp, this.gameData.hp, '#ff5e7e');
    this._setNumberWithBump(this.energyDisplay, this._displayed.energy, this.gameData.energy, '#b388ff');
    this._setNumberWithBump(this.killDisplay, this._displayed.kills, this.gameData.kills, '#ff8a50');

    // 更新生命值条
    if (this.hpBar) {
      const maxHP = this.gameData.maxHP || 20;
      const hpPercent = Math.max(0, (this.gameData.hp / maxHP) * 100);
      this.hpBar.style.width = hpPercent + '%';

      // 低生命值警告（红色闪烁渐变）
      if (hpPercent < 30) {
        this.hpBar.style.background = 'linear-gradient(90deg, #ff3355, #ff5e7e)';
        this.hpBar.style.animation = 'barShine 1.5s linear infinite, hpCritical 0.8s ease-in-out infinite';
      } else {
        this.hpBar.style.background = 'linear-gradient(90deg, #ff5e7e, #ff8a50)';
        this.hpBar.style.animation = 'barShine 2s linear infinite';
      }
    }

    // 更新能量条
    if (this.energyBar) {
      const maxEnergy = this.gameData.maxEnergy || 200;
      const energyPercent = Math.min(100, (this.gameData.energy / maxEnergy) * 100);
      this.energyBar.style.width = energyPercent + '%';
      this.energyBar.style.background = 'linear-gradient(90deg, #7c4dff, #4fc3f7)';
      this.energyBar.style.animation = 'barShine 2.5s linear infinite';
    }

    // 预计利息显示
    if (!this.gameData.waveActive && this.gameData.currentWave < this.gameData.totalWaves) {
      const interest = Math.max(1, Math.ceil(this.gameData.energy * ECONOMY.INTEREST_RATE));
      this.interestDisplay.textContent = `(+${interest})`;
      this.interestDisplay.style.color = '#ffcc55';
    } else {
      this.interestDisplay.textContent = '';
    }

    this._updateCardUI();
    // === Agent E: 刷新主动技能按钮（每帧更新冷却） ===
    this._refreshAbilityButton();
  }

  /**
   * 更新卡牌UI
   */
  _updateCardUI() {
    TOWER_TYPES.forEach((t, i) => {
      const card = document.getElementById('card-' + i);
      if (!card) return;
      card.classList.toggle('selected', this.selectedTower === i);
      const canAfford = this.gameData ? this.gameData.energy >= t.cost : false;
      card.classList.toggle('disabled', !canAfford && this.selectedTower !== i);
    });
  }

  /**
   * 重置选卡状态（放置塔后调用）
   */
  resetCardSelection() {
    this.selectedTower = null;
    this._hideCardTooltip();
    this._updateCardUI();
  }

  /**
   * 数字 tween 缓动（指数衰减）
   */
  _tweenNum(current, target, ease) {
    if (current === target) return current;
    return current + (target - current) * ease;
  }

  /**
   * 设置数字并在变化时打上"弹动"动画
   * @param {HTMLElement} el  - 数字 DOM
   * @param {number}      displayed - 当前 tween 后的浮点值
   * @param {number}      target    - 真实目标值
   * @param {string}      [accent]  - 弹动时主色（默认继承 currentColor）
   */
  _setNumberWithBump(el, displayed, target, accent) {
    if (!el) return;
    const shown = Math.round(displayed);
    if (el._lastShown === shown) return;

    const prev = el._lastShown ?? shown;
    el.textContent = shown;
    el._lastShown = shown;

    // 弹动（无变化则跳过）
    if (prev !== shown) {
      const dir = shown > prev ? 'up' : 'down';
      el.classList.remove('num-bump-up', 'num-bump-down');
      // 强制重排
      void el.offsetWidth;
      el.classList.add(dir === 'up' ? 'num-bump-up' : 'num-bump-down');
      if (accent) el.style.setProperty('--bump-color', accent);
    }
  }

  /**
   * 更新波次预览
   */
  updateWavePreview(wave) {
    if (!wave || this.gameData.waveActive || this.gameData.currentWave >= this.gameData.totalWaves) {
      this.wavePreview.classList.add('hidden');
      return;
    }

    this.wavePreview.classList.remove('hidden');
    const previewData = getWavePreviewData(wave);

    // Calculate threat level for the wave
    let totalThreat = 0;
    previewData.forEach(item => {
      totalThreat += item.count * (item.type === 'boss' || item.type === 'virusking' ? 5 :
                                  item.type === 'tank' || item.type === 'ice_golem' || item.type === 'ogre' ? 3 :
                                  item.type === 'mech' || item.type === 'beetle' || item.type === 'werewolf' ? 2 : 1);
    });
    const waveThreat = totalThreat > 20 ? 'extreme' : totalThreat > 12 ? 'high' : totalThreat > 6 ? 'medium' : 'low';
    const threatLabels = { low: '轻松', medium: '适中', high: '困难', extreme: '危险' };
    const threatColors = { low: '#88cc66', medium: '#ffcc55', high: '#ff8866', extreme: '#dd5544' };

    let html = `<div class="wave-preview-header">`;
    html += `<span class="wave-preview-icon">🔭</span>`;
    html += `<span class="wave-preview-title">第${wave.waveNum}波</span>`;
    html += `<span class="wave-threat" style="color:${threatColors[waveThreat]}">${threatLabels[waveThreat]}</span>`;
    html += `</div>`;

    previewData.forEach(item => {
      const isBoss = item.type === 'boss' || item.type === 'virusking';
      const isElite = item.type === 'tank' || item.type === 'ice_golem' || item.type === 'ogre' || item.type === 'mech';
      const tierClass = isBoss ? 'boss' : isElite ? 'elite' : 'normal';
      const tierLabel = isBoss ? 'BOSS' : isElite ? '精英' : '';
      const tierColor = isBoss ? '#dd5544' : isElite ? '#ffaa55' : item.color;

      html += `<div class="wave-enemy-row ${tierClass}">`;
      html += `<span class="wave-enemy-icon">${item.icon}</span>`;
      html += `<span class="wave-enemy-name" style="color:${item.color}">${item.name}</span>`;
      if (tierLabel) {
        html += `<span class="wave-enemy-tier" style="background:${tierColor}22;color:${tierColor};border:1px solid ${tierColor}44;">${tierLabel}</span>`;
      }
      html += `<span class="wave-enemy-count">\u00d7${item.count}</span>`;
      html += `</div>`;
    });

    this.wavePreview.innerHTML = html;
  }

  /**
   * 显示波次公告
   * @param {number} waveNum - 波次编号
   * @param {string} levelName - 关卡名称（可选）
   */
  showWaveAnnouncement(waveNum, levelName = '') {
    if (!this.waveAnnouncement) return;

    // 三段式：标签 + 大数字 + 关卡副标题
    const num = `第 ${waveNum} 波`;
    this.waveAnnouncement.innerHTML = `
      <div class="wa-label">WAVE INCOMING</div>
      <div class="wa-main">${num}</div>
      ${levelName ? `<div class="wa-sub">${levelName}</div>` : ''}
    `;
    this.waveAnnouncement.classList.remove('wave-announcement');

    // 触发重排以重新启动动画
    void this.waveAnnouncement.offsetWidth;

    this.waveAnnouncement.classList.add('wave-announcement');

    // 动画结束后隐藏
    setTimeout(() => {
      this.waveAnnouncement.classList.remove('wave-announcement');
    }, 2200);
  }

  /**
   * 波次开始
   */
  _onWaveStarted() {
    this.wavePreview.classList.add('hidden');
    
    // 显示波次公告
    if (this.gameData) {
      this.showWaveAnnouncement(
        this.gameData.currentWave + 1,
        this.currentLevelName
      );
    }
  }

  /**
   * 波次完成
   */
  _onWaveCompleted() {
    this.update();
  }

  /**
   * 更新连击显示
   * 性能：仅在连击数/可见性变化时写 DOM（事件已由 CombatSystem 去重节流）；
   * 脉冲动画交给 CSS keyframes（.visible 上的 comboPulse）
   */
  _updateCombo(data) {
    if (data.active) {
      if (!this._comboVisible) {
        this._comboVisible = true;
        this.comboDisplay.classList.add('visible');
      }
      if (this._comboCount !== data.count) {
        this._comboCount = data.count;
        const exclamation = data.count >= 10 ? '\uff01\uff01\uff01' : data.count >= 5 ? '\uff01\uff01' : '\uff01';
        this.comboDisplay.innerHTML = `<div class="combo-num">${data.count}\u8fde\u51fb${exclamation}</div>`;
      }
    } else if (this._comboVisible) {
      this._comboVisible = false;
      this._comboCount = 0;
      this.comboDisplay.classList.remove('visible');
    }
  }

  /**
   * 设置游戏速度UI
   */
  setSpeed(speed) {
    this.speedBtns.pause.classList.toggle('active', speed === 0);
    this.speedBtns.speed1.classList.toggle('active', speed === 1);
    this.speedBtns.speed2.classList.toggle('active', speed === 2);
    this.speedBtns.speed3.classList.toggle('active', speed === 3);
    this.pauseOverlay.classList.toggle('visible', speed === 0);
  }

  /**
   * 设置静音按钮状态
   */
  setMuted(muted) {
    this.muteBtn.textContent = muted ? '\ud83d\udd07' : '\ud83d\udd0a';
    this.muteBtn.classList.toggle('muted', muted);
  }

  /**
   * 取消塔选择
   */
  deselectTower() {
    this.selectedTower = null;
    this._updateCardUI();
  }

  /**
   * 重置UI
   */
  reset() {
    this.selectedTower = null;
    this._comboVisible = false;
    this._comboCount = 0;
    this.comboDisplay.classList.remove('visible');
    this.pauseOverlay.classList.remove('visible');
    this._updateCardUI();
    // 移除免费放置提示
    const oldHint = document.getElementById('gameContainer').querySelector('.free-tower-hint');
    if (oldHint) oldHint.remove();
  }

  /**
   * 显示成就解锁通知
   * @param {Object} achievement - 成就数据 { id, name, desc, icon }
   */
  showAchievementNotification(achievement) {
    const container = document.getElementById('gameContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-notification-icon">${achievement.icon}</div>
      <div class="achievement-notification-body">
        <div class="achievement-notification-label">成就解锁</div>
        <div class="achievement-notification-name">${achievement.name}</div>
        <div class="achievement-notification-desc">${achievement.desc}</div>
      </div>
    `;
    container.appendChild(notification);

    // 3秒后自动移除
    setTimeout(() => {
      notification.classList.add('achievement-notification-out');
      setTimeout(() => {
        if (notification.parentNode) notification.remove();
      }, 500);
    }, 3000);
  }

  /**
   * Draw a simplified Q-version mini tower character on a card canvas
   */
  _drawMiniTower(ctx, type, w, h) {
    const cx = w / 2, cy = h / 2;
    const s = w * 0.35;
    const color = type.color;

    ctx.clearRect(0, 0, w, h);

    switch(type.id) {
      case 'laser':
        this._drawMiniDrStrange(ctx, cx, cy, s);
        break;
      case 'tesla':
        this._drawMiniThor(ctx, cx, cy, s);
        break;
      case 'missile':
        this._drawMiniIronMan(ctx, cx, cy, s);
        break;
      case 'cryo':
        this._drawMiniElsa(ctx, cx, cy, s);
        break;
      case 'gravity':
        this._drawMiniHulk(ctx, cx, cy, s);
        break;
      case 'shield':
        this._drawMiniCaptain(ctx, cx, cy, s);
        break;
      case 'collector':
        this._drawMiniPanther(ctx, cx, cy, s);
        break;
      case 'plasma':
        this._drawMiniMarvel(ctx, cx, cy, s);
        break;
      case 'repair':
        this._drawMiniSpider(ctx, cx, cy, s);
        break;
      default:
        this._drawDefaultMini(ctx, type, cx, cy, s);
    }
  }

  _drawMiniDrStrange(ctx, cx, cy, s) {
    // 紫色魔法平台
    ctx.fillStyle = '#1a0a2e';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.7, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 魔法斗篷
    ctx.fillStyle = '#6c3483';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.2, s * 0.45, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 身体
    ctx.fillStyle = '#4a235a';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.1, s * 0.25, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.45, s * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 法师帽
    ctx.fillStyle = '#7d3c98';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.35, cy - s * 0.55);
    ctx.lineTo(cx, cy - s * 0.95);
    ctx.lineTo(cx + s * 0.35, cy - s * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9b59b6';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.75, s * 0.15, Math.PI, 0);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath();
    ctx.arc(cx - s * 0.12, cy - s * 0.48, s * 0.06, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.12, cy - s * 0.48, s * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // 悬浮魔法环
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.15, s * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#9b59b6';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.15, s * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawMiniThor(ctx, cx, cy, s) {
    // 金色闪电平台
    ctx.fillStyle = '#1a1505';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.7, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 维京战甲
    ctx.fillStyle = '#8b7355';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.05, s * 0.3, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.1, s * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 头
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.5, s * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 带翅膀的头盔
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.65, s * 0.25, Math.PI, 0);
    ctx.fill();
    // 翅膀
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.35, cy - s * 0.55);
    ctx.lineTo(cx - s * 0.55, cy - s * 0.7);
    ctx.lineTo(cx - s * 0.35, cy - s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.35, cy - s * 0.55);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.35, cy - s * 0.7);
    ctx.closePath();
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath();
    ctx.arc(cx - s * 0.12, cy - s * 0.52, s * 0.06, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.12, cy - s * 0.52, s * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // 雷神之锤
    ctx.fillStyle = '#a0a0a0';
    ctx.beginPath();
    ctx.roundRect(cx + s * 0.25, cy - s * 0.2, s * 0.15, s * 0.25, 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(cx + s * 0.25, cy - s * 0.2, s * 0.03, s * 0.25);
    ctx.fillRect(cx + s * 0.37, cy - s * 0.2, s * 0.03, s * 0.25);
    ctx.fillRect(cx + s * 0.25, cy - s * 0.2, s * 0.15, s * 0.03);
    // 锤柄
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(cx + s * 0.28, cy + s * 0.05, s * 0.08, s * 0.3);
  }

  _drawMiniIronMan(ctx, cx, cy, s) {
    // 红金装甲平台
    ctx.fillStyle = '#2a1010';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.7, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 红金装甲身体
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.05, s * 0.3, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // 胸口反应炉
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.1, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00a8cc';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.1, s * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // 头（钢铁侠头盔）
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.5, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
    // 面罩
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.45, s * 0.25, Math.PI, 0);
    ctx.fill();
    // 眼部发光
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.08, cy - s * 0.48, s * 0.06, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.08, cy - s * 0.48, s * 0.06, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();

    // 金色装饰线条
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(cx - s * 0.35, cy - s * 0.55, s * 0.7, s * 0.06);
  }

  _drawMiniElsa(ctx, cx, cy, s) {
    // 冰雪平台
    ctx.fillStyle = '#0a1520';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.7, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#74b9ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 蓝色连衣裙
    ctx.fillStyle = '#0984e3';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy - s * 0.1);
    ctx.lineTo(cx - s * 0.4, cy + s * 0.3);
    ctx.lineTo(cx, cy + s * 0.4);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.3);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.1);
    ctx.closePath();
    ctx.fill();

    // 身体
    ctx.fillStyle = '#74b9ff';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.15, s * 0.22, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.5, s * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 冰雪皇冠
    ctx.fillStyle = '#74b9ff';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.25, cy - s * 0.7);
    ctx.lineTo(cx - s * 0.2, cy - s * 0.85);
    ctx.lineTo(cx - s * 0.1, cy - s * 0.75);
    ctx.lineTo(cx, cy - s * 0.9);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.75);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.85);
    ctx.lineTo(cx + s * 0.25, cy - s * 0.7);
    ctx.closePath();
    ctx.fill();

    // 金色长发
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.25, cy - s * 0.35, s * 0.12, s * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.25, cy - s * 0.35, s * 0.12, s * 0.25, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath();
    ctx.arc(cx - s * 0.12, cy - s * 0.52, s * 0.06, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.12, cy - s * 0.52, s * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // 雪花装饰
    ctx.fillStyle = '#ffffff';
    ctx.font = `${s * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('❄', cx, cy + s * 0.55);
  }

  _drawMiniHulk(ctx, cx, cy, s) {
    // 绿色平台
    ctx.fillStyle = '#0a200a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.7, s * 0.75, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 紫色裤子
    ctx.fillStyle = '#6c3483';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.2, s * 0.35, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 绿色皮肤身体
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.15, s * 0.35, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头（愤怒表情）
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.55, s * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 愤怒的眉毛
    ctx.strokeStyle = '#1e8449';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.2, cy - s * 0.62);
    ctx.lineTo(cx - s * 0.05, cy - s * 0.58);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.2, cy - s * 0.62);
    ctx.lineTo(cx + s * 0.05, cy - s * 0.58);
    ctx.stroke();

    // 眼睛
    ctx.fillStyle = '#1e8449';
    ctx.beginPath();
    ctx.arc(cx - s * 0.15, cy - s * 0.55, s * 0.08, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.15, cy - s * 0.55, s * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // 愤怒的嘴巴
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.42, s * 0.12, 0, Math.PI);
    ctx.fill();
    // 牙齿
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - s * 0.08, cy - s * 0.45, s * 0.04, s * 0.08);
    ctx.fillRect(cx + s * 0.04, cy - s * 0.45, s * 0.04, s * 0.08);

    // 手臂
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.5, cy - s * 0.05, s * 0.15, s * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.5, cy - s * 0.05, s * 0.15, s * 0.25, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 重力能量球
    ctx.fillStyle = '#9b59b6';
    ctx.beginPath();
    ctx.arc(cx + s * 0.55, cy - s * 0.25, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8e44ad';
    ctx.beginPath();
    ctx.arc(cx + s * 0.55, cy - s * 0.25, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawDefaultMini(ctx, type, cx, cy, s) {
    const color = type.color;

    ctx.fillStyle = '#2a1a1e';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.8, s * 0.8, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = this._darkenColor(color, 0.3);
    this._roundRect(ctx, cx - s * 0.3, cy - s * 0.1, s * 0.6, s * 0.7, s * 0.15);
    ctx.fill();

    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.35, s * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath();
    ctx.arc(cx - s * 0.15, cy - s * 0.38, s * 0.07, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.15, cy - s * 0.38, s * 0.07, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - s * 0.13, cy - s * 0.40, s * 0.03, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.17, cy - s * 0.40, s * 0.03, 0, Math.PI * 2);
    ctx.fill();

    this._drawMiniAccessory(ctx, type.id, cx, cy, s, color);
  }

  _drawMiniCaptain(ctx, cx, cy, s) {
    // 蓝白平台
    ctx.fillStyle = '#1a2a3a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.7, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a88cc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 身体
    ctx.fillStyle = '#3a68aa';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.1, s * 0.28, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 白色条纹
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - s * 0.25, cy - s * 0.25, s * 0.5, s * 0.5);

    // 星星
    ctx.fillStyle = '#ffdd44';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const sx = cx + Math.cos(angle) * s * 0.15;
      const sy = cy - s * 0.1 + Math.sin(angle) * s * 0.15;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();

    // 头
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.45, s * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // 面罩
    ctx.fillStyle = '#3a68aa';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.45, s * 0.28, Math.PI, 0);
    ctx.fill();

    // 眼罩
    ctx.fillStyle = '#1a385a';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.18, cy - s * 0.45, s * 0.15, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.18, cy - s * 0.45, s * 0.15, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - s * 0.18, cy - s * 0.45, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.18, cy - s * 0.45, s * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // 小盾牌
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.arc(cx + s * 0.35, cy - s * 0.1, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a68aa';
    ctx.beginPath();
    ctx.arc(cx + s * 0.35, cy - s * 0.1, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + s * 0.35, cy - s * 0.1, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a68aa';
    ctx.beginPath();
    ctx.arc(cx + s * 0.35, cy - s * 0.1, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffdd44';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const sx = cx + s * 0.35 + Math.cos(angle) * s * 0.06;
      const sy = cy - s * 0.1 + Math.sin(angle) * s * 0.06;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
  }

  _drawMiniPanther(ctx, cx, cy, s) {
    // 深色平台
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.7, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6a288a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 身体
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.1, s * 0.26, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 银色装饰
    ctx.fillStyle = '#c0c0d0';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy - s * 0.2);
    ctx.lineTo(cx, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.2);
    ctx.closePath();
    ctx.fill();

    // 头
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.48, s * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.22, cy - s * 0.4);
    ctx.lineTo(cx - s * 0.35, cy - s * 0.7);
    ctx.lineTo(cx - s * 0.15, cy - s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.22, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.35, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.15, cy - s * 0.5);
    ctx.closePath();
    ctx.fill();

    // 发光眼睛
    ctx.save();
    ctx.shadowColor = '#8a44aa';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#aa66ff';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.18, cy - s * 0.48, s * 0.1, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.18, cy - s * 0.48, s * 0.1, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 能量球
    ctx.save();
    ctx.shadowColor = '#aa66ff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(170, 102, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(cx - s * 0.35, cy - s * 0.05, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawMiniMarvel(ctx, cx, cy, s) {
    // 深色平台
    ctx.fillStyle = '#1a0a1a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.7, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff66aa';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 身体
    ctx.fillStyle = '#cc2244';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.1, s * 0.28, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 金色条纹
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(cx - s * 0.06, cy - s * 0.4, s * 0.12, s * 0.6);

    // 星星
    ctx.fillStyle = '#ffdd44';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const sx = cx + Math.cos(angle) * s * 0.12;
      const sy = cy - s * 0.1 + Math.sin(angle) * s * 0.12;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();

    // 头
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.45, s * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // 头盔
    ctx.fillStyle = '#cc2244';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.45, s * 0.28, Math.PI, 0);
    ctx.fill();

    // 眼罩
    ctx.fillStyle = '#1a0a1a';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.25, cy - s * 0.52);
    ctx.lineTo(cx - s * 0.25, cy - s * 0.38);
    ctx.lineTo(cx - s * 0.1, cy - s * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.25, cy - s * 0.52);
    ctx.lineTo(cx + s * 0.25, cy - s * 0.38);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.45);
    ctx.closePath();
    ctx.fill();

    // 发光眼睛
    ctx.save();
    ctx.shadowColor = '#ff88cc';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ffaaee';
    ctx.beginPath();
    ctx.arc(cx - s * 0.22, cy - s * 0.45, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.22, cy - s * 0.45, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawMiniSpider(ctx, cx, cy, s) {
    // 红色平台
    ctx.fillStyle = '#1a0a0a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.7, s * 0.7, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cc2233';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 身体
    ctx.fillStyle = '#cc2233';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.1, s * 0.26, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 蜘蛛图案
    ctx.fillStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.25);
    ctx.lineTo(cx, cy + s * 0.2);
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.1);
      ctx.lineTo(cx + i * s * 0.12, cy + s * 0.18);
      ctx.stroke();
    }

    // 头
    ctx.fillStyle = '#cc2233';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.48, s * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 眼罩
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.18, cy - s * 0.48, s * 0.14, s * 0.22, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.18, cy - s * 0.48, s * 0.14, s * 0.22, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // 眼罩边框
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.18, cy - s * 0.48, s * 0.14, s * 0.22, 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.18, cy - s * 0.48, s * 0.14, s * 0.22, -0.1, 0, Math.PI * 2);
    ctx.stroke();

    // 镜片反光
    ctx.fillStyle = '#66aacc';
    ctx.beginPath();
    ctx.arc(cx - s * 0.22, cy - s * 0.52, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.14, cy - s * 0.52, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw type-specific accessory for the mini tower character
   */
  _drawMiniAccessory(ctx, typeId, cx, cy, s, color) {
    ctx.save();
    switch (typeId) {
      case 'laser': // Goggles
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx - s * 0.15, cy - s * 0.42, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.15, cy - s * 0.42, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'tesla': // Spiky hair
        ctx.fillStyle = color;
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI / 2 + (i - 2) * 0.4;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * s * 0.3, cy - s * 0.35 + Math.sin(angle) * s * 0.3);
          ctx.lineTo(cx + Math.cos(angle) * s * 0.65, cy - s * 0.35 + Math.sin(angle) * s * 0.65);
          ctx.lineTo(cx + Math.cos(angle + 0.2) * s * 0.3, cy - s * 0.35 + Math.sin(angle + 0.2) * s * 0.3);
          ctx.fill();
        }
        break;
      case 'missile': // Cap + launcher
        ctx.fillStyle = color;
        ctx.fillRect(cx - s * 0.35, cy - s * 0.72, s * 0.7, s * 0.15);
        ctx.fillStyle = '#555';
        ctx.fillRect(cx + s * 0.25, cy - s * 0.1, s * 0.12, s * 0.5);
        break;
      case 'shield': // Wings + halo
        ctx.fillStyle = 'rgba(168,204,85,0.4)';
        ctx.beginPath();
        ctx.ellipse(cx - s * 0.5, cy - s * 0.1, s * 0.2, s * 0.35, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.5, cy - s * 0.1, s * 0.2, s * 0.35, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy - s * 0.8, s * 0.2, s * 0.08, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'collector': // Explorer hat + gold
        ctx.fillStyle = color;
        ctx.fillRect(cx - s * 0.35, cy - s * 0.72, s * 0.7, s * 0.12);
        ctx.fillRect(cx - s * 0.2, cy - s * 0.85, s * 0.4, s * 0.15);
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.2, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'cryo': // Ice crown + scarf
        ctx.fillStyle = color;
        for (let i = 0; i < 3; i++) {
          const px = cx + (i - 1) * s * 0.2;
          ctx.beginPath();
          ctx.moveTo(px, cy - s * 0.7);
          ctx.lineTo(px - s * 0.08, cy - s * 0.55);
          ctx.lineTo(px + s * 0.08, cy - s * 0.55);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = '#aaddcc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.3, cy - s * 0.15);
        ctx.quadraticCurveTo(cx, cy + s * 0.1, cx + s * 0.4, cy - s * 0.05);
        ctx.stroke();
        break;
      case 'plasma': // Twin tails + orb
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.35, cy - s * 0.55);
        ctx.quadraticCurveTo(cx - s * 0.6, cy + s * 0.1, cx - s * 0.45, cy + s * 0.4);
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s * 0.35, cy - s * 0.55);
        ctx.quadraticCurveTo(cx + s * 0.6, cy + s * 0.1, cx + s * 0.45, cy + s * 0.4);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,136,170,0.6)';
        ctx.beginPath();
        ctx.arc(cx + s * 0.35, cy + s * 0.15, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'gravity': // Topknot + vortex
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.82, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(204,136,102,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.3, s * 0.25, 0, Math.PI * 1.5);
        ctx.stroke();
        break;
      case 'repair': // Nurse cap + cross
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - s * 0.2, cy - s * 0.82, s * 0.4, s * 0.12);
        ctx.fillStyle = color;
        ctx.fillRect(cx - s * 0.04, cy - s * 0.85, s * 0.08, s * 0.18);
        ctx.fillRect(cx - s * 0.08, cy - s * 0.8, s * 0.16, s * 0.08);
        break;
    }
    ctx.restore();
  }

  /**
   * Darken a hex color by a given amount (0-1)
   */
  _darkenColor(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * (1 - amount))},${Math.floor(g * (1 - amount))},${Math.floor(b * (1 - amount))})`;
  }

  /**
   * Draw a rounded rectangle path on the given context
   */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
