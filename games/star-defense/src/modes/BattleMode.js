// ================================================================
// 对战模式 - 兵营对线
// 增强点：
//   P2-7 波次间"事件"系统：每波结束 30% 概率弹事件卡
//   P2-12 失败/重试体验优化：失败时弹"续命（200 星尘）/ 放弃"两按钮
// ================================================================
import { CELL, COLS, ROWS, GAME_STATE } from '../core/Constants.js';
import { BattleMap } from '../map/BattleMap.js';
import { BarrackSystem } from '../systems/BarrackSystem.js';
import { BattleUnitSystem } from '../systems/BattleUnitSystem.js';
import { BattleRenderer } from '../render/BattleRenderer.js';
import { WAVE_EVENTS, pickRandomEvent } from '../data/WaveEvents.js';
import { EventOverlay } from '../ui/EventOverlay.js';
import { REVIVE_CONFIG, computeReviveRetain } from '../data/ReviveConfig.js';

/** 波次间事件触发概率（30%） */
const WAVE_EVENT_PROBABILITY = 0.3;

// 兵营类型定义
export const BARRACK_TYPES = [
  {
    id: 'marine',
    name: '星际陆战队',
    cost: 15,
    hp: 80,
    damage: 12,
    speed: 0.8,
    attackRate: 0.8,
    range: 1.2,
    color: '#ff8866',
    desc: '基础步兵，攻守兼备',
    spawnInterval: 3.0
  },
  {
    id: 'heavy',
    name: '重装战士',
    cost: 30,
    hp: 200,
    damage: 18,
    speed: 0.4,
    attackRate: 1.2,
    range: 1.0,
    color: '#ff8844',
    desc: '高血量坦克，移动缓慢',
    spawnInterval: 5.0
  },
  {
    id: 'sniper',
    name: '能量狙击手',
    cost: 25,
    hp: 50,
    damage: 30,
    speed: 0.6,
    attackRate: 1.5,
    range: 3.0,
    color: '#aa44ff',
    desc: '远程高伤害，血量低',
    spawnInterval: 4.0
  },
  {
    id: 'medic',
    name: '纳米医疗兵',
    cost: 20,
    hp: 60,
    damage: 5,
    speed: 0.7,
    attackRate: 1.0,
    range: 1.5,
    color: '#44ff88',
    desc: '治疗附近友军，辅助单位',
    spawnInterval: 3.5,
    special: 'heal'
  },
  {
    id: 'berserker',
    name: '狂暴突击兵',
    cost: 35,
    hp: 120,
    damage: 25,
    speed: 1.2,
    attackRate: 0.6,
    range: 0.8,
    color: '#ff4444',
    desc: '极速近战，高攻低防',
    spawnInterval: 4.5
  },
  {
    id: 'shield',
    name: '能量盾卫',
    cost: 28,
    hp: 150,
    damage: 8,
    speed: 0.5,
    attackRate: 1.0,
    range: 1.0,
    color: '#77ccdd',
    desc: '护盾减伤30%，保护后排',
    spawnInterval: 4.0,
    special: 'shield'
  }
];

// 敌方兵种（AI使用）- 复用塔防敌人类型ID
export const ENEMY_BARRACK_TYPES = [
  { id: 'bug', hp: 70, damage: 10, speed: 0.75, attackRate: 0.8, range: 1.0, color: '#44dd44', size: 0.7, spawnInterval: 3.0, name: '外星虫族' },
  { id: 'mech', hp: 180, damage: 15, speed: 0.35, attackRate: 1.2, range: 0.8, color: '#dd4444', size: 0.9, spawnInterval: 5.0, name: '机甲战士' },
  { id: 'drone', hp: 45, damage: 14, speed: 1.1, attackRate: 0.7, range: 0.8, color: '#aabbcc', size: 0.5, spawnInterval: 2.5, name: '无人机群' },
  { id: 'stealth', hp: 55, damage: 22, speed: 0.5, attackRate: 1.4, range: 2.5, color: '#888888', size: 0.6, spawnInterval: 4.0, name: '隐形刺客' },
  { id: 'tank', hp: 350, damage: 28, speed: 0.3, attackRate: 1.5, range: 1.2, color: '#666688', size: 1.1, spawnInterval: 6.0, name: '电磁坦克' }
];

export class BattleMode {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game; // 引用主Game，用于访问UI
    this.active = false;

    // 地图
    this.battleMap = null;

    // 子系统
    this.barrackSystem = null;
    this.unitSystem = null;
    this.renderer = null;

    // 游戏状态
    this.energy = 40;
    this.maxEnergy = 200;
    this.baseHp = 100;
    this.maxBaseHp = 100;
    this.enemyBaseHp = 150;
    this.enemyMaxBaseHp = 150;

    // 时间
    this.gameTime = 0;
    this.lastTimestamp = 0;
    this.gameSpeed = 1;
    this.state = 'idle'; // idle, countdown, playing, victory, defeat

    // 倒计时
    this.countdown = 3;

    // 能量恢复
    this.energyTimer = 0;
    this.energyRegenRate = 1.5; // 每2秒+1.5能量

    // AI
    this.aiTimer = 0;
    this.aiDifficulty = 1.0;
    this.aiSpawnTimer = 0;
    this.enemySlots = []; // { row, col, channel, typeIndex, spawnTimer }
    this.waveCount = 0;
    this.waveTimer = 0;
    this.waveInterval = 12; // 每12秒换一波敌方配置

    // 选中兵营
    this.selectedBarrack = null;
    this.placingBarrack = null;

    // === P2-7 波次间事件状态 ===
    this.eventOverlay = new EventOverlay();
    this.activeWaveEvent = null;        // 当前激活的 wave event（永久/下一波效果）
    this.nextWaveModifiers = null;      // 下一波专用 modifier（一次性）
    this._waveEventPaused = false;      // 弹事件时是否暂停游戏

    // === P2-12 续命状态 ===
    this._usedRevives = 0;              // 本关已续命次数
    this._defeatSnapshot = null;        // 失败时状态快照（用于续命恢复）
    this._reviveOverlayShown = false;
  }

  /**
   * 启动对战模式
   */
  start() {
    this.active = true;
    this.energy = 50;
    this.baseHp = 100;
    this.maxBaseHp = 100;
    this.enemyBaseHp = 100;
    this.enemyMaxBaseHp = 100;
    this.gameTime = 0;
    this.countdown = 3;
    this.state = 'countdown';
    this.gameSpeed = 1;
    this.energyTimer = 0;
    this.aiTimer = 0;
    this.aiSpawnTimer = 0;
    this.selectedBarrack = null;
    this.placingBarrack = null;

    // === P2-7 / P2-12 重置事件/续命状态 ===
    this.activeWaveEvent = null;
    this.nextWaveModifiers = null;
    this._waveEventPaused = false;
    this._usedRevives = 0;
    this._defeatSnapshot = null;
    this._reviveOverlayShown = false;
    this.eventOverlay?.hide();

    // 设置canvas尺寸为容器大小
    const container = document.getElementById('gameContainer');
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';

    // 隐藏原有UI，显示对战UI（先显示UI才能获取栏高度）
    this._hideOriginalUI();
    this._showBattleUI();

    // 获取顶部栏高度（不再有底部栏）
    const topBar = document.getElementById('battleTopBar');
    this._topBarH = topBar ? topBar.offsetHeight : 40;

    // 初始化子系统（只排除顶部栏）
    this.battleMap = new BattleMap();
    this.battleMap.resize(this.canvas, this._topBarH, 0);

    // 初始化敌方槽位（随机分配初始兵种）
    this._assignEnemyWave();

    this.barrackSystem = new BarrackSystem(this.battleMap);
    this.unitSystem = new BattleUnitSystem(this.battleMap);
    this.renderer = new BattleRenderer(this.ctx, this.battleMap);

    // 开始游戏循环
    this.lastTimestamp = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  /**
   * 停止对战模式
   */
  stop() {
    this.active = false;
    const clickLayer = document.getElementById('battleClickLayer');
    if (clickLayer && this._canvasClickHandler) {
      clickLayer.removeEventListener('click', this._canvasClickHandler);
      this._canvasClickHandler = null;
    }
    this._hideBarrackMenu();
    this._showOriginalUI();
    this._hideBattleUI();
  }

  _hideOriginalUI() {
    const ids = ['topBar', 'bottomBar', 'towerPanel', 'waveBtn', 'wavePreview'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  _showOriginalUI() {
    const ids = ['topBar', 'bottomBar'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
  }

  _showBattleUI() {
    this._ensureBattleUI();
    const ui = document.getElementById('battleUI');
    if (ui) ui.style.display = '';
    this._updateBattleUI();
  }

  _hideBattleUI() {
    const ui = document.getElementById('battleUI');
    if (ui) ui.style.display = 'none';
  }

  _ensureBattleUI() {
    if (document.getElementById('battleUI')) return;

    const container = document.getElementById('gameContainer');
    const ui = document.createElement('div');
    ui.id = 'battleUI';
    ui.style.cssText = `
      position:absolute; top:0; left:0; right:0; bottom:0;
      pointer-events:auto; z-index:10; display:none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    // 顶部状态栏 - Enhanced Glassmorphism
    ui.innerHTML = `
      <div id="battleTopBar" style="
        display:flex; justify-content:space-between; align-items:center;
        padding:0 20px; height:56px;
        background:linear-gradient(180deg, rgba(30,15,20,0.92) 0%, rgba(40,20,25,0.85) 100%);
        backdrop-filter:blur(16px) saturate(1.2); -webkit-backdrop-filter:blur(16px) saturate(1.2);
        border-bottom:1px solid rgba(200,120,80,0.1);
        box-shadow:0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(200,120,80,0.06) inset;
      ">
        <!-- 我方基地 -->
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="
            width:36px; height:36px; border-radius:10px;
            background:linear-gradient(135deg,#3a1a1e,#2a1015);
            border:1px solid rgba(255,136,102,0.2);
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 0 12px rgba(255,136,102,0.1), inset 0 1px 0 rgba(255,255,255,0.05);
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff8866" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div style="font-size:9px; color:rgba(255,136,102,0.55); text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:4px;">ALLIED BASE</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="width:100px; height:5px; background:rgba(255,255,255,0.04); border-radius:3px; overflow:hidden; border:1px solid rgba(255,136,102,0.08);">
                <div id="battleBaseHpBar" style="width:100%; height:100%; background:linear-gradient(90deg,#cc5533,#ff8866); border-radius:2px; transition:width 0.5s cubic-bezier(0.4,0,0.2,1); box-shadow:0 0 6px rgba(255,136,102,0.4);"></div>
              </div>
              <span id="battleBaseHpText" style="color:rgba(255,255,255,0.7); font-size:11px; font-variant-numeric:tabular-nums; font-weight:600; min-width:42px; letter-spacing:0.3px;">100/100</span>
            </div>
          </div>
        </div>

        <!-- 中间信息 -->
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="
            display:flex; align-items:center; gap:6px;
            padding:5px 14px; border-radius:20px;
            background:linear-gradient(135deg, rgba(255,200,40,0.08), rgba(255,160,20,0.04));
            border:1px solid rgba(255,200,40,0.12);
            box-shadow:0 0 12px rgba(255,200,40,0.04);
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffdd44" opacity="0.7"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/></svg>
            <span style="color:#ffdd44; font-size:13px; font-weight:800; font-variant-numeric:tabular-nums; text-shadow:0 0 8px rgba(255,220,60,0.3);" id="battleEnergyText">40</span>
            <span style="color:rgba(255,220,60,0.35); font-size:9px; font-weight:600; letter-spacing:0.5px;">能量</span>
          </div>
          <div style="
            display:flex; align-items:center; gap:5px;
            padding:5px 12px; border-radius:20px;
            background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04);
          ">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style="color:rgba(255,255,255,0.45); font-size:11px; font-variant-numeric:tabular-nums; font-weight:500;" id="battleTimeText">0:00</span>
          </div>
          <div style="
            display:flex; align-items:center; gap:5px;
            padding:5px 12px; border-radius:20px;
            background:linear-gradient(135deg, rgba(255,120,50,0.06), rgba(255,80,40,0.03));
            border:1px solid rgba(255,120,50,0.1);
          ">
            <span style="color:#ff8844; font-size:10px; font-weight:800; letter-spacing:0.5px;">WAVE</span>
            <span style="color:rgba(255,136,68,0.75); font-size:12px; font-weight:700; font-variant-numeric:tabular-nums;" id="battleWaveText">1</span>
          </div>
        </div>

        <!-- 敌方基地 -->
        <div style="display:flex; align-items:center; gap:12px;">
          <div>
            <div style="font-size:9px; color:rgba(255,68,68,0.55); text-transform:uppercase; letter-spacing:1.5px; font-weight:700; text-align:right; margin-bottom:4px;">ENEMY BASE</div>
            <div style="display:flex; align-items:center; gap:8px; flex-direction:row-reverse;">
              <div style="width:100px; height:5px; background:rgba(255,255,255,0.04); border-radius:3px; overflow:hidden; border:1px solid rgba(255,68,68,0.08);">
                <div id="battleEnemyHpBar" style="width:100%; height:100%; background:linear-gradient(90deg,#cc4422,#ff4444); border-radius:2px; transition:width 0.5s cubic-bezier(0.4,0,0.2,1); box-shadow:0 0 6px rgba(255,68,68,0.4);"></div>
              </div>
              <span id="battleEnemyHpText" style="color:rgba(255,255,255,0.7); font-size:11px; font-variant-numeric:tabular-nums; font-weight:600; min-width:42px; letter-spacing:0.3px;">150/150</span>
            </div>
          </div>
          <div style="
            width:36px; height:36px; border-radius:10px;
            background:linear-gradient(135deg,#3d0d0d,#280808);
            border:1px solid rgba(255,68,68,0.2);
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 0 12px rgba(255,68,68,0.1), inset 0 1px 0 rgba(255,255,255,0.03);
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div id="battleBackBtn" style="
            margin-left:6px; padding:6px 14px; border-radius:8px; cursor:pointer;
            background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06);
            color:rgba(255,255,255,0.4); font-size:11px; font-weight:600;
            transition:all 0.2s ease; letter-spacing:0.5px;
            display:flex; align-items:center; gap:4px;
          " onmouseenter="this.style.background='rgba(255,60,60,0.1)';this.style.borderColor='rgba(255,60,60,0.25)';this.style.color='#ff8888'"
             onmouseleave="this.style.background='rgba(255,255,255,0.02)';this.style.borderColor='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.4)'"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            撤退
          </div>
        </div>
      </div>

      <!-- 透明点击层 -->
      <div id="battleClickLayer" style="position:absolute; top:0; left:0; right:0; bottom:0; cursor:pointer;"></div>

      <!-- 倒计时/结果覆盖层 -->
      <div id="battleOverlay" style="position:absolute; top:50%; left:50%;
        transform:translate(-50%,-50%); text-align:center; display:none;
        padding:48px 64px; border-radius:20px;
        background:linear-gradient(180deg, rgba(30,15,22,0.94) 0%, rgba(40,20,28,0.9) 100%);
        backdrop-filter:blur(24px) saturate(1.3); -webkit-backdrop-filter:blur(24px) saturate(1.3);
        border:1px solid rgba(200,120,80,0.08);
        box-shadow:0 16px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,120,80,0.04), 0 1px 0 rgba(255,255,255,0.03) inset;
      ">
        <div id="battleOverlayText" style="font-size:48px; font-weight:900; color:#fff;
          text-shadow:0 0 40px rgba(100,140,255,0.2); letter-spacing:3px;
          font-family:'Orbitron',sans-serif;"></div>
        <div id="battleOverlaySub" style="font-size:13px; color:rgba(255,255,255,0.4); margin-top:10px; line-height:1.7; letter-spacing:0.3px;"></div>
        <button id="battleOverlayBtn" style="
          margin-top:28px; padding:12px 36px; border-radius:12px; cursor:pointer;
          background:linear-gradient(135deg,rgba(60,90,180,0.5),rgba(90,60,180,0.5));
          border:1px solid rgba(120,120,255,0.2);
          color:rgba(255,255,255,0.85); font-size:13px; font-weight:600;
          transition:all 0.25s ease; display:none; letter-spacing:0.5px;
          box-shadow:0 4px 16px rgba(80,80,200,0.15);
        " onmouseenter="this.style.background='linear-gradient(135deg,rgba(80,110,200,0.65),rgba(110,80,200,0.65))';this.style.borderColor='rgba(140,140,255,0.35)';this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 24px rgba(80,80,200,0.25)'"
           onmouseleave="this.style.background='linear-gradient(135deg,rgba(60,90,180,0.5),rgba(90,60,180,0.5))';this.style.borderColor='rgba(120,120,255,0.2)';this.style.transform='translateY(0)';this.style.boxShadow='0 4px 16px rgba(80,80,200,0.15)'"
        >返回主菜单</button>
      </div>
    `;

    container.appendChild(ui);
    this._bindBattleEvents();
  }

  _bindBattleEvents() {
    // 撤退
    const backBtn = document.getElementById('battleBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.stop();
        this.game._showMainMenu();
      });
    }

    // 结果界面返回
    const overlayBtn = document.getElementById('battleOverlayBtn');
    if (overlayBtn) {
      overlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.stop();
        this.game._showMainMenu();
      });
    }

    // 地图点击 → 检测点击了什么
    const clickLayer = document.getElementById('battleClickLayer');
    this._canvasClickHandler = (e) => {
      if (!this.active || this.state !== 'playing') return;

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const grid = this.battleMap.pixelToGrid(x, y);

      // 点击我方槽位
      if (this.battleMap.isPlayerSlot(grid.row, grid.col)) {
        const existing = this.barrackSystem.barracks.find(b => b.row === grid.row && b.col === grid.col);
        if (existing) {
          // 已有兵营 → 弹出更换菜单
          this._showBarrackMenu(e.clientX, e.clientY, grid.row, grid.col, existing.typeIndex);
        } else {
          // 空槽位 → 弹出选择菜单
          this._showBarrackMenu(e.clientX, e.clientY, grid.row, grid.col, null);
        }
        return;
      }

      // 点击敌方槽位 → 查看属性
      if (this.battleMap.isEnemySlot(grid.row, grid.col)) {
        const slot = this.enemySlots.find(s => s.row === grid.row && s.col === grid.col);
        if (slot) {
          this._showEnemySlotInfo(e.clientX, e.clientY, slot);
        }
        return;
      }

      // 点击其他地方 → 关闭菜单
      this._hideBarrackMenu();
    };
    clickLayer.addEventListener('click', this._canvasClickHandler);
  }

  /**
   * 在点击位置弹出兵营选择菜单
   * @param {number} existingTypeIndex - 已有兵营类型索引（更换模式），null为新建
   */
  _showBarrackMenu(clientX, clientY, row, col, existingTypeIndex) {
    this._hideBarrackMenu();

    const isReplace = existingTypeIndex !== null;
    const menu = document.createElement('div');
    menu.id = 'barrackSelectMenu';
    menu.style.cssText = `
      position:fixed; z-index:9999;
      background:linear-gradient(180deg, rgba(32,16,22,0.95) 0%, rgba(40,20,28,0.92) 100%);
      backdrop-filter:blur(20px) saturate(1.2); -webkit-backdrop-filter:blur(20px) saturate(1.2);
      border:1px solid rgba(200,120,80,0.12);
      border-radius:14px; padding:8px; pointer-events:auto;
      box-shadow:0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,120,80,0.04), 0 1px 0 rgba(255,255,255,0.03) inset;
      min-width:180px;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-size:9px; color:rgba(255,255,255,0.25); margin-bottom:6px; text-align:center; text-transform:uppercase; letter-spacing:2px; font-weight:700;';
    title.textContent = isReplace ? '更换兵营' : '选择兵营';
    menu.appendChild(title);

    BARRACK_TYPES.forEach((b, i) => {
      const item = document.createElement('div');
      const cost = isReplace ? Math.floor(b.cost * 0.6) : b.cost;
      const canAfford = this.energy >= cost;
      const isCurrent = isReplace && i === existingTypeIndex;
      item.style.cssText = `
        padding:9px 12px; margin:2px 0; border-radius:10px; cursor:pointer;
        background:${isCurrent ? 'rgba(255,255,255,0.02)' : canAfford ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.15)'};
        border:1px solid ${isCurrent ? 'rgba(255,255,255,0.04)' : canAfford ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)'};
        opacity:${isCurrent ? '0.35' : canAfford ? '1' : '0.25'};
        transition:all 0.15s ease;
      `;
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:6px; height:6px; border-radius:50%; background:${b.color}; box-shadow:0 0 6px ${b.color}60; flex-shrink:0;"></div>
            <span style="font-size:12px; color:${canAfford ? b.color : 'rgba(255,255,255,0.3)'}; font-weight:600;">${b.name}${isCurrent ? ' <span style="color:rgba(255,255,255,0.2);font-weight:400;font-size:9px;">当前</span>' : ''}</span>
          </div>
          <span style="font-size:10px; color:${canAfford ? 'rgba(255,220,60,0.6)' : 'rgba(255,255,255,0.15)'}; font-weight:700; font-variant-numeric:tabular-nums;">${cost}${isReplace ? ' <span style="font-size:8px;font-weight:400;opacity:0.5;">6折</span>' : ''}</span>
        </div>
        <div style="font-size:9px; color:rgba(255,255,255,0.18); margin-top:4px; display:flex; gap:8px; padding-left:12px;">
          <span>HP ${b.hp}</span><span>ATK ${b.damage}</span><span>SPD ${b.speed}</span>
        </div>
      `;
      if (canAfford && !isCurrent) {
        item.addEventListener('mouseenter', () => {
          item.style.background = 'rgba(255,255,255,0.05)';
          item.style.borderColor = b.color + '30';
          item.style.transform = 'translateX(3px)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'rgba(255,255,255,0.02)';
          item.style.borderColor = 'rgba(255,255,255,0.03)';
          item.style.transform = 'translateX(0)';
        });
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isReplace) {
            // 更换兵营：先删旧的，再放新的（跳过能量检查）
            this.barrackSystem.barracks = this.barrackSystem.barracks.filter(
              bb => !(bb.row === row && bb.col === col)
            );
            const placed = this.barrackSystem.placeBarrack(row, col, i, Infinity);
            if (placed) {
              this.energy -= cost;
              this.barrackSystem.barracks[this.barrackSystem.barracks.length - 1].spawnTimer = 0;
            }
          } else {
            // 新建兵营
            if (this.barrackSystem.placeBarrack(row, col, i, this.energy)) {
              this.energy -= b.cost;
            }
          }
          this._hideBarrackMenu();
        });
      }
      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    let left = clientX + 10;
    let top = clientY - menuRect.height / 2;
    if (left + menuRect.width > window.innerWidth) left = clientX - menuRect.width - 10;
    if (top < 0) top = 10;
    if (top + menuRect.height > window.innerHeight) top = window.innerHeight - menuRect.height - 10;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  /**
   * 显示敌方槽位信息
   */
  _showEnemySlotInfo(clientX, clientY, slot) {
    this._hideBarrackMenu();

    const type = ENEMY_BARRACK_TYPES[slot.typeIndex];
    const waveMultiplier = 1 + this.waveCount * 0.15;
    const boostedHp = Math.floor(type.hp * waveMultiplier);
    const boostedDmg = Math.floor(type.damage * waveMultiplier);
    const menu = document.createElement('div');
    menu.id = 'barrackSelectMenu';
    menu.style.cssText = `
      position:fixed; z-index:9999;
      background:linear-gradient(180deg, rgba(18,6,6,0.95) 0%, rgba(22,10,10,0.92) 100%);
      backdrop-filter:blur(20px) saturate(1.2); -webkit-backdrop-filter:blur(20px) saturate(1.2);
      border:1px solid rgba(255,60,60,0.1);
      border-radius:14px; padding:14px 16px; pointer-events:auto;
      box-shadow:0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,60,60,0.04), 0 1px 0 rgba(255,255,255,0.02) inset;
      min-width:190px;
    `;

    menu.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <div style="width:8px; height:8px; border-radius:50%; background:${type.color}; box-shadow:0 0 8px ${type.color}80; flex-shrink:0;"></div>
        <span style="font-size:14px; color:${type.color}; font-weight:700;">${type.name}</span>
      </div>
      <div style="font-size:11px; color:rgba(255,255,255,0.5); line-height:2.1;">
        <div style="display:flex; justify-content:space-between; padding:0 2px;">
          <span style="color:rgba(255,255,255,0.35);">HP</span>
          <span style="color:rgba(255,255,255,0.8); font-weight:600; font-variant-numeric:tabular-nums;">${boostedHp} <span style="color:rgba(255,255,255,0.2); font-weight:400; font-size:10px;">(${type.hp}×${waveMultiplier.toFixed(2)})</span></span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0 2px;">
          <span style="color:rgba(255,255,255,0.35);">ATK</span>
          <span style="color:rgba(255,255,255,0.8); font-weight:600; font-variant-numeric:tabular-nums;">${boostedDmg} <span style="color:rgba(255,255,255,0.2); font-weight:400; font-size:10px;">(${type.damage}×${waveMultiplier.toFixed(2)})</span></span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0 2px;">
          <span style="color:rgba(255,255,255,0.35);">SPD</span>
          <span style="color:rgba(255,255,255,0.8); font-variant-numeric:tabular-nums;">${(type.speed * (1 + this.waveCount * 0.03)).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0 2px;">
          <span style="color:rgba(255,255,255,0.35);">RNG</span>
          <span style="color:rgba(255,255,255,0.8); font-variant-numeric:tabular-nums;">${type.range}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:0 2px;">
          <span style="color:rgba(255,255,255,0.35);">CD</span>
          <span style="color:rgba(255,255,255,0.8); font-variant-numeric:tabular-nums;">${(type.spawnInterval / (1 + this.waveCount * 0.08)).toFixed(1)}s</span>
        </div>
      </div>
      <div style="
        margin-top:10px; padding-top:8px;
        border-top:1px solid rgba(255,255,255,0.04);
        font-size:9px; color:rgba(255,255,255,0.2); display:flex; justify-content:space-between;
        letter-spacing:0.5px; font-weight:500;
      ">
        <span>WAVE ${this.waveCount + 1} · ×${waveMultiplier.toFixed(2)}</span>
        <span>换波 ${Math.ceil(this.waveInterval - this.waveTimer)}s</span>
      </div>
    `;

    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    let left = clientX - menuRect.width - 10;
    let top = clientY - menuRect.height / 2;
    if (left < 0) left = clientX + 10;
    if (top < 0) top = 10;
    if (top + menuRect.height > window.innerHeight) top = window.innerHeight - menuRect.height - 10;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  _hideBarrackMenu() {
    const existing = document.getElementById('barrackSelectMenu');
    if (existing) existing.remove();
  }

  _updateBattleUI() {
    if (!this.active) return;

    // 基地血量
    const baseBar = document.getElementById('battleBaseHpBar');
    const baseText = document.getElementById('battleBaseHpText');
    if (baseBar) baseBar.style.width = (this.baseHp / this.maxBaseHp * 100) + '%';
    if (baseText) baseText.textContent = `${Math.ceil(this.baseHp)}/${this.maxBaseHp}`;

    // 敌方血量
    const enemyBar = document.getElementById('battleEnemyHpBar');
    const enemyText = document.getElementById('battleEnemyHpText');
    if (enemyBar) enemyBar.style.width = (this.enemyBaseHp / this.enemyMaxBaseHp * 100) + '%';
    if (enemyText) enemyText.textContent = `${Math.ceil(this.enemyBaseHp)}/${this.enemyMaxBaseHp}`;

    // 能量
    const energyText = document.getElementById('battleEnergyText');
    if (energyText) energyText.textContent = Math.floor(this.energy);

    // 时间
    const timeText = document.getElementById('battleTimeText');
    if (timeText) {
      const mins = Math.floor(this.gameTime / 60);
      const secs = Math.floor(this.gameTime % 60);
      timeText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // 波次
    const waveText = document.getElementById('battleWaveText');
    if (waveText) waveText.textContent = this.waveCount + 1;
  }

  // === 游戏循环 ===

  _loop(timestamp) {
    if (!this.active) return;

    const rawDt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;
    const dt = rawDt * this.gameSpeed;

    // 逻辑更新
    if (this.state === 'countdown') {
      this.countdown -= rawDt;
      if (this.countdown <= 0) {
        this.state = 'playing';
        this._showBattleOverlay('', '', false);
      } else {
        this._showBattleOverlay(Math.ceil(this.countdown).toString(), '准备战斗！', false);
      }
    }

    if (this.state === 'playing') {
      this.gameTime += dt;

      // 能量恢复
      this.energyTimer += dt;
      if (this.energyTimer >= 2) {
        this.energyTimer -= 2;
        this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegenRate);
      }

      // 兵营出兵
      this.barrackSystem.update(dt, this.unitSystem);
      // 敌方AI出兵
      this._updateAI(dt);
      // 单位更新（移动+战斗）
      this.unitSystem.update(dt);
      // 检查基地伤害
      const baseDmg = this.unitSystem.checkBaseDamage();
      if (baseDmg.enemyDamage > 0) {
        this.baseHp -= baseDmg.enemyDamage;
      }
      if (baseDmg.playerDamage > 0) {
        this.enemyBaseHp -= baseDmg.playerDamage;
      }
      // 检查胜负
      this._checkWinLose();
    }

    // 渲染
    this._render(timestamp / 1000);
    // UI更新
    this._updateBattleUI();

    requestAnimationFrame(this._loop);
  }

  _updateAI(dt) {
    // 波次倍率（随时间增强）
    const waveMultiplier = 1 + this.waveCount * 0.15;
    // === P2-7: 下一波专用 modifier（仅生效 1 波） ===
    const nextMod = this.nextWaveModifiers || {};
    const enemyHpMult = nextMod.enemyHpMult || 1;

    // 敌方槽位出兵（间隔随波次缩短）
    for (const slot of this.enemySlots) {
      const type = ENEMY_BARRACK_TYPES[slot.typeIndex];
      const adjustedInterval = type.spawnInterval / (1 + this.waveCount * 0.08);
      slot.spawnTimer += dt;
      if (slot.spawnTimer >= adjustedInterval) {
        slot.spawnTimer = 0;
        // 生成增强后的敌方单位
        const boostedType = {
          ...type,
          hp: Math.floor(type.hp * waveMultiplier * enemyHpMult),
          damage: Math.floor(type.damage * waveMultiplier),
          speed: type.speed * (1 + this.waveCount * 0.03)
        };
        this.unitSystem.spawnEnemyUnit(boostedType, slot.channel, slot.col - 1);
      }
    }

    // 波次切换
    this.waveTimer += dt;
    if (this.waveTimer >= this.waveInterval) {
      this.waveTimer = 0;
      this.waveCount++;
      this._assignEnemyWave();
      // === P2-7: 每波结束 30% 概率触发事件卡 ===
      this._maybeTriggerWaveEvent();
    }
  }

  /**
   * === P2-7: 根据概率触发波次间事件
   * 弹窗时暂停游戏（pause gameSpeed），等玩家接受/拒绝后恢复
   */
  _maybeTriggerWaveEvent() {
    if (this.state !== 'playing') return;
    if (this._waveEventPaused) return;
    if (this.eventOverlay.isVisible()) return;
    if (Math.random() > WAVE_EVENT_PROBABILITY) return;

    const eventId = pickRandomEvent(Math.random);
    const event = WAVE_EVENTS[eventId];
    if (!event) return;

    // 暂停游戏
    this._waveEventPaused = true;
    const prevSpeed = this.gameSpeed;
    this.gameSpeed = 0;

    this.eventOverlay.show(
      event,
      // 接受
      (evt) => {
        this._applyWaveEvent(evt);
        this._waveEventPaused = false;
        this.gameSpeed = prevSpeed;
      },
      // 拒绝
      (evt) => {
        // 拒绝 = 不应用 effect，清除 nextWaveModifiers
        this.nextWaveModifiers = null;
        this._waveEventPaused = false;
        this.gameSpeed = prevSpeed;
      }
    );
  }

  /**
   * === P2-7: 应用波次事件效果
   */
  _applyWaveEvent(event) {
    if (!event || !event.effect) return;
    const eff = event.effect;
    if (eff.scope === 'instant') {
      // 立即生效
      if (eff.energyBonus) {
        this.energy = Math.min(this.maxEnergy, this.energy + eff.energyBonus);
      }
      if (eff.revealNextWave) {
        // 预留：把下一波敌人类写入 nextWaveModifiers 供 UI 展示
        this.nextWaveModifiers = { ...eff };
      }
      this.activeWaveEvent = { id: event.id, scope: 'instant', effect: eff };
    } else if (eff.scope === 'permanent') {
      this.activeWaveEvent = { id: event.id, scope: 'permanent', effect: eff };
    } else if (eff.scope === 'next_wave') {
      this.nextWaveModifiers = { ...eff };
      // 进入下一波后自动失效（在 _assignEnemyWave 中清空）
    }
  }

  /**
   * 为敌方4个槽位随机分配兵种（一波配置）
   */
  _assignEnemyWave() {
    // === P2-7: 进入新一波 → 清空 nextWaveModifiers（一次性 modifier 失效） ===
    this.nextWaveModifiers = null;

    // 根据波次数决定可用兵种
    const available = ENEMY_BARRACK_TYPES.filter((_, i) => {
      if (i <= 1) return true; // bug, mech 始终可用
      if (i <= 3) return this.waveCount >= 1; // drone, stealth 第2波起
      return this.waveCount >= 3; // tank 第4波起
    });

    const enemySlotDefs = this.battleMap.getEnemySlots();
    this.enemySlots = enemySlotDefs.map(slot => {
      const type = available[Math.floor(Math.random() * available.length)];
      const typeIdx = ENEMY_BARRACK_TYPES.indexOf(type);
      return {
        row: slot.row,
        col: slot.col,
        channel: slot.channel,
        typeIndex: typeIdx,
        spawnTimer: 0
      };
    });
  }

  _checkWinLose() {
    if (this.baseHp <= 0) {
      this.state = 'defeat';
      this.baseHp = 0;
      const overlay = document.getElementById('battleOverlay');
      const text = document.getElementById('battleOverlayText');
      if (overlay && text) {
        text.style.color = '#ff4466';
        text.style.textShadow = '0 0 40px rgba(255,68,102,0.3)';
      }
      this._showBattleOverlay('基地失守', '敌方入侵成功...', true);
      // === P2-12: 弹出续命/放弃选项 ===
      this._showReviveOption();
    } else if (this.enemyBaseHp <= 0) {
      this.state = 'victory';
      this.enemyBaseHp = 0;
      const overlay = document.getElementById('battleOverlay');
      const text = document.getElementById('battleOverlayText');
      if (overlay && text) {
        text.style.color = '#44ff88';
        text.style.textShadow = '0 0 40px rgba(68,255,136,0.3)';
      }
      this._showBattleOverlay('胜利！', '成功摧毁敌方基地！', true);
    }
  }

  /**
   * === P2-12: 弹出"续命（200 星尘）/ 放弃"两按钮
   * - 已用满续命次数 → 仅显示放弃按钮
   * - 星尘不足 → 续命按钮置灰
   * 成功后按 ReviveConfig 恢复状态：保留部分塔/能量/HP
   */
  _showReviveOption() {
    if (this._reviveOverlayShown) return;
    this._reviveOverlayShown = true;

    // 拍快照（用于续命恢复）
    if (!this._defeatSnapshot) {
      this._defeatSnapshot = {
        energy: this.energy,
        hp: this.maxBaseHp,
        maxHp: this.maxBaseHp,
        wave: this.waveCount,
        towers: (this.barrackSystem?.barracks || []).map(b => ({
          row: b.row, col: b.col, typeIndex: b.typeIndex, spawnTimer: b.spawnTimer || 0,
        })),
      };
    }

    const used = this._usedRevives;
    const max = REVIVE_CONFIG.maxRevivesPerLevel;
    const remaining = max - used;
    const stardust = this.game?.meta?.getStardust?.() ?? 0;
    const enough = stardust >= REVIVE_CONFIG.stardustCost;
    const canRevive = remaining > 0 && enough;

    // 标题/副标题
    const overlayText = document.getElementById('battleOverlayText');
    const subText = document.getElementById('battleOverlaySub');
    if (overlayText) overlayText.textContent = canRevive ? '续命再战？' : (remaining <= 0 ? '已无续命次数' : '星尘不足');
    if (subText) {
      subText.innerHTML = canRevive
        ? `消耗 <span style="color:#ffcc55;font-weight:700;">${REVIVE_CONFIG.stardustCost}</span> 星尘可继续战斗<br>剩余续命次数：<b>${remaining}/${max}</b> · 当前星尘：<b style="color:#ffcc55;">${stardust}</b>`
        : (remaining <= 0
          ? '本关已用完续命次数<br>是否放弃？'
          : `续命需要 ${REVIVE_CONFIG.stardustCost} 星尘，当前仅 <b style="color:#ffcc55;">${stardust}</b>`);
    }

    // 重写 overlay 按钮区为两按钮
    const overlay = document.getElementById('battleOverlay');
    if (!overlay) return;
    // 找到主按钮（id=battleOverlayBtn）保留 hide，避免双按钮叠加
    const mainBtn = document.getElementById('battleOverlayBtn');
    if (mainBtn) mainBtn.style.display = 'none';

    // 清除可能存在的旧续命按钮
    const oldRevive = document.getElementById('battleReviveBtn');
    if (oldRevive) oldRevive.remove();
    const oldGiveUp = document.getElementById('battleGiveUpBtn');
    if (oldGiveUp) oldGiveUp.remove();

    const container = document.createElement('div');
    container.id = 'battleReviveGroup';
    container.style.cssText = 'display:flex; flex-direction:column; gap:10px; align-items:center; margin-top:20px;';

    // 续命按钮
    const reviveBtn = document.createElement('button');
    reviveBtn.id = 'battleReviveBtn';
    reviveBtn.textContent = canRevive
      ? `✦ 续命（${REVIVE_CONFIG.stardustCost} 星尘）`
      : (remaining <= 0 ? '已用完续命' : '✦ 星尘不足');
    reviveBtn.disabled = !canRevive;
    reviveBtn.style.cssText = `
      padding: 12px 32px; border-radius: 10px; cursor: ${canRevive ? 'pointer' : 'not-allowed'};
      background: ${canRevive
        ? 'linear-gradient(135deg, rgba(255,200,40,0.85), rgba(255,140,40,0.85))'
        : 'rgba(255,255,255,0.06)'};
      border: 1px solid ${canRevive ? 'rgba(255,200,40,0.6)' : 'rgba(255,255,255,0.08)'};
      color: ${canRevive ? '#1a0f0a' : 'rgba(255,255,255,0.3)'};
      font-size: 14px; font-weight: 700; letter-spacing: 0.5px;
      box-shadow: ${canRevive ? '0 4px 16px rgba(255,180,40,0.3)' : 'none'};
      transition: all 0.2s ease;
      min-width: 220px;
    `;
    if (canRevive) {
      reviveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._doRevive();
      });
    }
    container.appendChild(reviveBtn);

    // 放弃按钮
    const giveUpBtn = document.createElement('button');
    giveUpBtn.id = 'battleGiveUpBtn';
    giveUpBtn.textContent = '放弃';
    giveUpBtn.style.cssText = `
      padding: 10px 32px; border-radius: 10px; cursor: pointer;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.55); font-size: 13px; font-weight: 600;
      transition: all 0.2s ease; min-width: 220px;
    `;
    giveUpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._giveUp();
    });
    container.appendChild(giveUpBtn);

    overlay.appendChild(container);
  }

  /**
   * === P2-12: 实际执行续命
   * - 扣 200 星尘
   * - 恢复 HP（按 ReviveConfig.retainHpPercent）
   * - 恢复能量（按 ReviveConfig.retainMoneyPercent）
   * - 恢复塔（从快照重建）
   * - 重置游戏状态为 playing
   */
  _doRevive() {
    if (!this._defeatSnapshot) return;
    const snapshot = this._defeatSnapshot;
    const result = computeReviveRetain(snapshot, this._usedRevives);
    if (!result.success) return;

    // 扣星尘
    if (this.game?.meta?.getProfile?.()?.spendStardust) {
      const ok = this.game.meta.getProfile().spendStardust(REVIVE_CONFIG.stardustCost);
      if (!ok) return; // 防御性：余额不足
    }
    this._usedRevives = result.usedRevives;

    // 恢复状态
    this.baseHp = result.retain.hp;
    this.maxBaseHp = Math.max(snapshot.maxHp, result.retain.hp);
    this.energy = result.retain.energy;

    // 重建塔
    if (REVIVE_CONFIG.retainTowers && this.barrackSystem && Array.isArray(result.retain.towers)) {
      this.barrackSystem.barracks = [];
      for (const t of result.retain.towers) {
        this.barrackSystem.placeBarrack(t.row, t.col, t.typeIndex, Infinity);
        const created = this.barrackSystem.barracks[this.barrackSystem.barracks.length - 1];
        if (created) created.spawnTimer = t.spawnTimer || 0;
      }
    }

    // 重置游戏状态
    this.state = 'playing';
    this._reviveOverlayShown = false;
    this._defeatSnapshot = null;

    // 隐藏 overlay
    const overlay = document.getElementById('battleOverlay');
    if (overlay) overlay.style.display = 'none';
    const reviveGroup = document.getElementById('battleReviveGroup');
    if (reviveGroup) reviveGroup.remove();
    const mainBtn = document.getElementById('battleOverlayBtn');
    if (mainBtn) mainBtn.style.display = 'none';

    // 刷新 HUD
    this._updateBattleUI();

    // 提示音
    if (this.game?.audio) this.game.audio.play?.('waveStart');
  }

  /**
   * === P2-12: 放弃 → 退到主菜单
   */
  _giveUp() {
    this.stop();
    if (this.game?._showMainMenu) this.game._showMainMenu();
  }

  _showBattleOverlay(title, sub, showBtn) {
    const overlay = document.getElementById('battleOverlay');
    const text = document.getElementById('battleOverlayText');
    const subText = document.getElementById('battleOverlaySub');
    const btn = document.getElementById('battleOverlayBtn');
    if (overlay) overlay.style.display = title ? '' : 'none';
    if (text) text.textContent = title;
    if (subText) subText.textContent = sub;
    if (btn) btn.style.display = showBtn ? '' : 'none';
  }

  _render(time) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 清屏
    ctx.fillStyle = '#1a0f1e';
    ctx.fillRect(0, 0, w, h);

    // 渲染地图
    this.renderer.renderMap(time);

    // 渲染兵营
    this.renderer.renderBarracks(this.barrackSystem.barracks, time);

    // 渲染敌方槽位
    this.renderer.renderEnemySlots(this.enemySlots, time);

    // 渲染单位
    this.renderer.renderUnits(this.unitSystem.playerUnits, this.unitSystem.enemyUnits, time);
  }

  /**
   * 处理canvas大小变化
   */
  resize() {
    if (this.battleMap) {
      this.battleMap.resize(this.canvas);
    }
  }
}
