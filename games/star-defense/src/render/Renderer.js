// ================================================================
// 渲染器主类 - 管理Canvas上下文、协调子渲染器（性能优化版）
// 优化：对象池、视口裁剪、星空缓存、批量绘制、弹道角度缓存
// ================================================================
import { hexToRgb } from '../core/Constants.js';
import { MapRenderer } from './MapRenderer.js';
import { TowerRenderer } from './TowerRenderer.js';
import { EnemyRenderer } from './EnemyRenderer.js';
import { EffectRenderer } from './EffectRenderer.js';

/** 预计算的 Math.PI * 2 常量 */
const PI2 = Math.PI * 2;
/** 视口裁剪边距（像素）- 防止边缘物体被误裁剪 */
const CULL_MARGIN = 50;

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../map/GameMap.js').GameMap} gameMap
   * @param {Object} [game] - 游戏实例引用（用于屏幕震动）
   */
  constructor(canvas, gameMap, game = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gameMap = gameMap;
    this.game = game;
    this.dpr = window.devicePixelRatio || 1;

    // === 渲染质量配置 ===
    const urlParams = new URLSearchParams(window.location.search);
    this.quality = urlParams.get('quality') || 'auto';
    this.lowQuality = this._detectLowQuality();
    this.usePrerender = this.lowQuality || this.quality === 'sprite';

    // 初始化子渲染器
    this.mapRenderer = new MapRenderer(this.ctx, gameMap);
    this.towerRenderer = new TowerRenderer(this.ctx, {
      lowQuality: this.lowQuality,
      usePrerender: this.usePrerender
    });
    this.enemyRenderer = new EnemyRenderer(this.ctx);
    this.effectRenderer = new EffectRenderer(this.ctx, { lowQuality: this.lowQuality });

    // 星星背景
    this.stars = [];
    /** 静态星星离屏缓存（不闪烁的星星绘制到离屏Canvas，每帧只drawImage） */
    this._starCanvas = null;
    this._starCanvasValid = false;
    /** 闪烁/亮星（每帧动态绘制） */
    this._dynamicStars = [];
    this._initStars();

    // 漂浮太空垃圾
    const debrisCount = this.lowQuality ? 6 : 12;
    this._debris = Array.from({length: debrisCount}, () => ({
      x: Math.random() * 1000,
      y: Math.random() * 800,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 5 + 2,
      angle: Math.random() * PI2,
      /** 预计算cos/sin，每帧复用，避免重复三角函数调用 */
      _cos: 0,
      _sin: 0,
      rotSpeed: (Math.random() - 0.5) * 0.5,
      shape: Math.random() > 0.5 ? 'rect' : 'tri'
    }));
    // 初始化debris的cos/sin缓存
    this._debris.forEach(d => {
      d._cos = Math.cos(d.angle);
      d._sin = Math.sin(d.angle);
    });

    // 星云流动
    this._nebulae = [
      { x: 0, y: 0, radius: 80, color: 'rgba(120,50,40,0.08)', phase: 0 },
      { x: 0, y: 0, radius: 60, color: 'rgba(100,60,30,0.06)', phase: 2 },
      { x: 0, y: 0, radius: 70, color: 'rgba(80,40,50,0.05)', phase: 4 },
    ];

    // 流星状态（复用对象，避免GC）
    this.meteor = null;

    // 波次开始闪光
    this._waveFlash = 0;

    // 背景渐变缓存
    this._bgGradient = null;
    this._bgGradientH = 0;
    this._bgGradientColors = null;

    // 星云离屏Canvas缓存
    this._nebulaCanvas = null;
    this._nebulaFrameCount = 0;
    this._nebulaDrawn = false;

    // 关卡主题
    this.levelTheme = null;
    this.levelConstellation = null;

    // 渲染时间缓存（用于弹道绘制，避免每帧多次调用Date.now()）
    this._renderTime = 0;
    this._lastFrameTime = 0;
  }

  /**
   * 设置关卡主题
   */
  setLevelTheme(theme, constellation) {
    this.levelTheme = theme;
    this.levelConstellation = constellation;
    this.mapRenderer.setTheme(theme, constellation);
  }

  /**
   * 设置游戏引用
   */
  setGame(game) {
    this.game = game;
  }

  /**
   * 初始化星星背景（多层次、多颜色）
   * 分离静态星和动态星（闪烁/亮星），静态星缓存到离屏Canvas
   */
  _initStars() {
    const gridW = this.gameMap.gridW;
    const gridH = this.gameMap.gridH;
    this.stars = [];
    this._dynamicStars = [];
    const starColors = ['rgba(255,230,200,', 'rgba(255,220,180,', 'rgba(255,210,160,'];
    const total = this.lowQuality ? 50 : 100;
    const brightCount = this.lowQuality ? 2 : 5;
    const twinkleCount = this.lowQuality ? 2 : 5;
    for (let i = 0; i < total; i++) {
      const isBright = i < brightCount;
      const isTwinkle = i >= brightCount && i < brightCount + twinkleCount;
      const star = {
        x: Math.random() * gridW,
        y: Math.random() * gridH,
        size: isBright ? (Math.random() * 2 + 2) : (Math.random() * 2 + 0.5),
        brightness: isBright ? (Math.random() * 0.2 + 0.8) : (Math.random() * 0.5 + 0.5),
        twinkleSpeed: Math.random() * 2 + 1,
        colorBase: starColors[Math.floor(Math.random() * starColors.length)],
        twinkle: isTwinkle,
        twinklePhase: isTwinkle ? Math.random() * PI2 : 0,
        /** 预计算的静态alpha（非闪烁星使用） */
        _staticAlpha: 0,
        _isDynamic: isBright || isTwinkle
      };
      star._staticAlpha = star.brightness * 0.7;
      this.stars.push(star);
      if (star._isDynamic) {
        this._dynamicStars.push(star);
      }
    }
    // 使星空缓存失效，需要重新绘制
    this._starCanvasValid = false;
  }

  /**
   * 检测是否应启用低质量模式
   */
  _detectLowQuality() {
    if (this.quality === 'low') return true;
    if (this.quality === 'high') return false;
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      if (navigator.hardwareConcurrency <= 4) return true;
    }
    if (typeof window !== 'undefined' && window.devicePixelRatio >= 2.5) return true;
    return false;
  }

  /**
   * 启用 shadowBlur 劫持
   */
  _enableShadowIntercept() {
    const ctx = this.ctx;
    if (!ctx) return null;
    const saved = {};
    try {
      const props = ['shadowBlur', 'shadowColor'];
      for (const p of props) {
        const desc = Object.getOwnPropertyDescriptor(ctx, p) ||
                     Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), p);
        if (!desc) continue;
        saved[p] = desc;
        Object.defineProperty(ctx, p, {
          configurable: true,
          enumerable: true,
          get: function () { return 0; },
          set: function () { /* swallow */ }
        });
      }
      this._shadowInterceptActive = true;
      return saved;
    } catch (e) {
      return null;
    }
  }

  /**
   * 恢复 shadowBlur 劫持
   */
  _disableShadowIntercept(saved) {
    if (!saved) return;
    const ctx = this.ctx;
    try {
      for (const p of Object.keys(saved)) {
        Object.defineProperty(ctx, p, saved[p]);
      }
    } catch (e) {}
    this._shadowInterceptActive = false;
  }

  /**
   * 根据关卡调整画布尺寸
   */
  resizeForLevel(level) {
    this.dpr = window.devicePixelRatio || 1;
    this.gridW = level.cols * level.cell;
    this.gridH = level.rows * level.cell;
    this.canvas.width = Math.round(this.gridW * this.dpr);
    this.canvas.height = Math.round(this.gridH * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._fitCanvas();
    if (!this._resizeBound) {
      this._resizeBound = true;
      window.addEventListener('resize', () => this._fitCanvas());
    }
    this._initStars();
    this.mapRenderer.gameMap = this.gameMap;
    this.mapRenderer.invalidateCache();
    this.mapRenderer.cacheGrid(level);
    if (this.towerRenderer && this.towerRenderer.clearSpriteCache) {
      this.towerRenderer.clearSpriteCache();
    }
    this.effectRenderer.setCellSize(level.cell);
    this.mapRenderer.setTheme(this.levelTheme, this.levelConstellation);
  }

  /** 动态调整Canvas CSS尺寸 */
  _fitCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const topBar = document.getElementById('topBar');
    const bottomBar = document.getElementById('bottomBar');
    const topH = topBar ? topBar.offsetHeight : 50;
    const botH = bottomBar ? bottomBar.offsetHeight : 110;
    const marginX = 8;
    const marginY = 4;
    const availW = vw - marginX * 2;
    const availH = vh - topH - botH - marginY * 2;
    if (availW <= 0 || availH <= 0) return;
    const ratio = this.gridW / this.gridH;
    const availRatio = availW / availH;
    let cssW, cssH;
    if (availRatio > ratio) {
      cssH = availH;
      cssW = availH * ratio;
    } else {
      cssW = availW;
      cssH = availW / ratio;
    }
    this.canvas.style.width = Math.floor(cssW) + 'px';
    this.canvas.style.height = Math.floor(cssH) + 'px';
    this.canvas.style.top = (topH + marginY + Math.floor((availH - cssH) / 2)) + 'px';
    this.canvas.style.left = (marginX + Math.floor((availW - cssW) / 2)) + 'px';
    this.canvas.style.transform = 'none';
  }

  /**
   * 判断坐标是否在可见区域内（视口裁剪）
   * @param {number} x
   * @param {number} y
   * @param {number} [margin] - 额外边距
   * @returns {boolean}
   */
  _isVisible(x, y, margin = CULL_MARGIN) {
    return x >= -margin && x <= this.gridW + margin &&
           y >= -margin && y <= this.gridH + margin;
  }

  /**
   * 构建静态星星离屏缓存
   */
  _buildStarCache() {
    const gridW = this.gameMap.gridW;
    const gridH = this.gameMap.gridH;
    if (!this._starCanvas ||
        this._starCanvas.width !== gridW ||
        this._starCanvas.height !== gridH) {
      this._starCanvas = document.createElement('canvas');
      this._starCanvas.width = gridW;
      this._starCanvas.height = gridH;
    }
    const sctx = this._starCanvas.getContext('2d');
    sctx.clearRect(0, 0, gridW, gridH);
    // 只绘制静态（非闪烁、非亮星）星星
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      if (s._isDynamic) continue;
      const alpha = s._staticAlpha;
      sctx.globalAlpha = alpha;
      sctx.fillStyle = `${s.colorBase}${alpha})`;
      sctx.beginPath();
      sctx.arc(s.x, s.y, s.size, 0, PI2);
      sctx.fill();
    }
    sctx.globalAlpha = 1.0;
    this._starCanvasValid = true;
  }

  /**
   * 渲染一帧
   * @param {number} time - 时间（秒）
   * @param {Object} gameState - 游戏状态数据
   * @param {import('../systems/EffectSystem.js').EffectSystem} effectSystem
   */
  render(time, gameState, effectSystem) {
    const ctx = this.ctx;
    const gridW = this.gameMap.gridW;
    const gridH = this.gameMap.gridH;

    // 缓存渲染时间（供内部绘制方法复用，避免多次Date.now()调用）
    this._renderTime = time;
    this._gridW = gridW;
    this._gridH = gridH;

    // === 低质量模式：劫持 shadowBlur ===
    let shadowIntercept = null;
    if (this.lowQuality && !this._shadowInterceptActive) {
      shadowIntercept = this._enableShadowIntercept();
    }

    // 清除画布
    ctx.clearRect(-10, -10, gridW + 20, gridH + 20);

    // 应用屏幕震动偏移
    const shakeX = this.game?.screenShake?.getOffsetX() || 0;
    const shakeY = this.game?.screenShake?.getOffsetY() || 0;
    const shaking = shakeX !== 0 || shakeY !== 0;
    if (shaking) {
      ctx.save();
      ctx.translate(shakeX, shakeY);
    }

    // 背景
    this._drawBackground(time, gameState.deltaTime || 0.016);

    // 地图
    this.mapRenderer.render(time, gameState.towers, gameState.hoverCell,
      gameState.selectedTower, gameState.energy, gameState.towerTypes);

    // 基地
    if (gameState.hp !== undefined) {
      this.mapRenderer.drawBase(time, gameState.hp, gameState.maxHp || 25);
    }

    // 悬停预览
    this._drawHoverPreview(gameState);

    // 塔
    this.towerRenderer.render(time, gameState.towers, gameState.selectedPlacedTower,
      gameState.synergyLinks);

    // 敌人（子渲染器内部可自行裁剪，但此处不额外裁剪以免越界）
    this.enemyRenderer.render(time, gameState.enemies);

    // 弹道（视口裁剪 + 角度缓存优化）
    if (gameState.projectiles && gameState.projectiles.length > 0) {
      this._drawProjectilesOptimized(gameState.projectiles);
    }

    // 特效
    this.effectRenderer.render(time, effectSystem.effects, effectSystem.particles);

    // 能量宝珠（视口裁剪）
    if (gameState.energyOrbs) {
      this._drawEnergyOrbs(gameState.energyOrbs, time);
    }

    // 波次警告线
    if (gameState.waveActive) {
      this._drawWarningLine(time);
    }

    // 低血量警告
    if (gameState.hp !== undefined && gameState.maxHp) {
      this._drawLowHpWarning(time, gameState.hp, gameState.maxHp);
    }

    // 倒计时
    if (gameState.preparingPhase) {
      this._drawCountdown(time, gameState);
    }

    // 波间等待
    if (gameState.waveIntervalPhase) {
      this._drawWaveInterval(time, gameState);
    }

    // 波次闪光
    if (this._waveFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this._waveFlash * 0.3})`;
      ctx.fillRect(0, 0, gridW, gridH);
      this._waveFlash -= 0.05;
      if (this._waveFlash < 0) this._waveFlash = 0;
    }

    if (shaking) {
      ctx.restore();
    }

    if (shadowIntercept) {
      this._disableShadowIntercept(shadowIntercept);
    }
  }

  /**
   * 绘制背景（优化版：静态星空缓存、debris三角函数缓存）
   */
  _drawBackground(time, deltaTime) {
    const ctx = this.ctx;
    const gridW = this.gameMap.gridW;
    const gridH = this.gameMap.gridH;
    const dt = deltaTime || 0.016;

    // 背景渐变
    let bgGradient;
    if (this.levelTheme && this.levelTheme.bg) {
      bgGradient = this.levelTheme.bg;
    } else {
      bgGradient = this.gameMap.level?.bgGradient || ['#1a0f1e', '#2a1520', '#1f1018'];
    }

    if (!this._bgGradient || this._bgGradientH !== gridH || this._bgGradientColors !== bgGradient) {
      this._bgGradient = ctx.createLinearGradient(0, 0, 0, gridH);
      this._bgGradient.addColorStop(0, bgGradient[0]);
      this._bgGradient.addColorStop(0.5, bgGradient[1]);
      this._bgGradient.addColorStop(1, bgGradient[2]);
      this._bgGradientH = gridH;
      this._bgGradientColors = bgGradient;
    }
    ctx.fillStyle = this._bgGradient;
    ctx.fillRect(0, 0, gridW, gridH);

    // 星云（离屏Canvas缓存，每10帧更新）
    if (!this._nebulaCanvas || this._nebulaCanvas.width !== gridW || this._nebulaCanvas.height !== gridH) {
      this._nebulaCanvas = document.createElement('canvas');
      this._nebulaCanvas.width = gridW;
      this._nebulaCanvas.height = gridH;
      this._nebulaDrawn = false;
    }
    this._nebulaFrameCount = (this._nebulaFrameCount || 0) + 1;
    if (this._nebulaFrameCount % 10 === 1 || !this._nebulaDrawn) {
      const nctx = this._nebulaCanvas.getContext('2d');
      nctx.clearRect(0, 0, gridW, gridH);
      for (let i = 0; i < this._nebulae.length; i++) {
        const n = this._nebulae[i];
        if (n.x === 0 && n.y === 0) {
          n.x = gridW * (0.2 + n.phase * 0.1);
          n.y = gridH * (0.3 + n.phase * 0.1);
        }
        const pulse = Math.sin(time * 0.3 + n.phase) * 0.3 + 1;
        const r = n.radius * pulse;
        const gradient = nctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
        gradient.addColorStop(0, n.color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        nctx.fillStyle = gradient;
        nctx.beginPath();
        nctx.arc(n.x, n.y, r, 0, PI2);
        nctx.fill();
      }
      this._nebulaDrawn = true;
    }
    ctx.drawImage(this._nebulaCanvas, 0, 0);

    // === 星星优化：静态星从缓存绘制，动态星每帧更新 ===
    if (!this._starCanvasValid) {
      this._buildStarCache();
    }
    ctx.drawImage(this._starCanvas, 0, 0);

    // 只绘制动态星（亮星+闪烁星）
    const dynStars = this._dynamicStars;
    for (let i = 0; i < dynStars.length; i++) {
      const s = dynStars[i];
      let alpha;
      if (s.twinkle) {
        alpha = 0.3 + Math.sin(time * s.twinkleSpeed * 1.5 + s.twinklePhase) * 0.3 + 0.3;
      } else {
        alpha = s.brightness * (Math.sin(time * s.twinkleSpeed) * 0.3 + 0.7);
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `${s.colorBase}${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, PI2);
      ctx.fill();

      // 亮星十字光芒
      if (s.brightness > 0.8) {
        const crossSize = s.size * 4 * alpha;
        ctx.strokeStyle = `rgba(255,220,180,${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x - crossSize, s.y);
        ctx.lineTo(s.x + crossSize, s.y);
        ctx.moveTo(s.x, s.y - crossSize);
        ctx.lineTo(s.x, s.y + crossSize);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;

    // 漂浮太空垃圾（使用缓存的cos/sin）
    const debris = this._debris;
    for (let i = 0; i < debris.length; i++) {
      const d = debris[i];
      d.x += d._cos * d.speed * dt;
      d.y += d._sin * d.speed * dt;
      d.angle += d.rotSpeed * dt;
      // 环绕边界
      if (d.x < -10) { d.x = gridW + 10; }
      else if (d.x > gridW + 10) { d.x = -10; }
      if (d.y < -10) { d.y = gridH + 10; }
      else if (d.y > gridH + 10) { d.y = -10; }

      // angle变化后重新计算cos/sin（仅在旋转时更新，减少计算量）
      if (d.rotSpeed !== 0) {
        d._cos = Math.cos(d.angle);
        d._sin = Math.sin(d.angle);
      }

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      ctx.fillStyle = 'rgba(150, 100, 80, 0.3)';
      if (d.shape === 'rect') {
        ctx.fillRect(-d.size, -d.size, d.size * 2, d.size * 2);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -d.size);
        ctx.lineTo(d.size, d.size);
        ctx.lineTo(-d.size, d.size);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 流星（复用对象）
    const meteorProb = this.lowQuality ? 0.001 : 0.002;
    if (!this.meteor && Math.random() < meteorProb) {
      this.meteor = {
        x: Math.random() * gridW,
        y: 0,
        vx: -3 - Math.random() * 2,
        vy: 2 + Math.random() * 2,
        life: 1.0,
        length: 30 + Math.random() * 40
      };
    }
    if (this.meteor) {
      const m = this.meteor;
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.02;
      if (m.life > 0) {
        const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * m.length / 3, m.y - m.vy * m.length / 3);
        grad.addColorStop(0, `rgba(255,230,200,${m.life})`);
        grad.addColorStop(1, 'rgba(255,220,180,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * m.length / 3, m.y - m.vy * m.length / 3);
        ctx.stroke();
      } else {
        this.meteor = null;
      }
    }
  }

  /**
   * 绘制悬停预览
   */
  _drawHoverPreview(gameState) {
    if (gameState.selectedTower === null || !gameState.hoverCell) return;

    const ctx = this.ctx;
    const cell = this.gameMap.cell;

    const isValidSlot = this.gameMap.isPlacementSlot(gameState.hoverCell.row, gameState.hoverCell.col);
    if (!isValidSlot) return;

    const t = gameState.towerTypes[gameState.selectedTower];
    const cx = gameState.hoverCell.col * cell + cell / 2;
    const cy = gameState.hoverCell.row * cell + cell / 2;
    const rangeR = t.range * cell;

    const occupied = gameState.towers.find(tw =>
      tw.row === gameState.hoverCell.row && tw.col === gameState.hoverCell.col);
    const canAfford = gameState.energy >= t.cost;
    const ok = canAfford && !occupied;
    const rgb = ok ? hexToRgb(t.color) : '255,80,80';

    // 范围填充
    const fillGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rangeR);
    fillGrad.addColorStop(0, `rgba(${rgb}, 0.15)`);
    fillGrad.addColorStop(0.6, `rgba(${rgb}, 0.08)`);
    fillGrad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rangeR, 0, PI2);
    ctx.fill();

    // 范围外圈
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(${rgb}, 0.85)`;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, rangeR, 0, PI2);
    ctx.stroke();
    ctx.restore();

    // 外层光晕
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = `rgba(${rgb}, 0.15)`;
    ctx.beginPath();
    ctx.arc(cx, cy, rangeR, 0, PI2);
    ctx.stroke();
    ctx.restore();

    // 底盘发光
    const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.4);
    baseGrad.addColorStop(0, `rgba(${rgb}, 0.4)`);
    baseGrad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.4, 0, PI2);
    ctx.fill();

    ctx.globalAlpha = 0.7;
    this.towerRenderer.drawTowerSprite(cx, cy, t, 0, 1, cell);
    ctx.globalAlpha = 1.0;
  }

  /**
   * 优化版弹道绘制 - 使用缓存角度、减少save/restore、批量相似绘制
   */
  _drawProjectilesOptimized(projectiles) {
    const ctx = this.ctx;
    const renderTime = this._renderTime;
    const gridW = this._gridW;
    const gridH = this._gridH;

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];

      // === 视口裁剪：导弹在屏幕外不绘制 ===
      if (p.type === 'missile') {
        if (!this._isVisible(p.x, p.y, 30)) continue;
        this._drawMissile(ctx, p, renderTime);
      } else if (p.type === 'laser') {
        // 激光是即时射线，目标必须存活且可见
        if (p.target && p.target.alive) {
          this._drawLaserBeam(ctx, p, renderTime);
        }
      }
      // tesla/cryo/plasma 是即时特效，由EffectSystem绘制（laser是beam类型，这里不绘制）
      // 注意：原代码中 laser/tesla/cryo/plasma 类型的"弹道"其实是直接伤害+特效，
      // 只有 missile 是真正移动的弹道。但原代码_drawProjectiles包含了所有类型的即时绘制。
      // 让我保持原逻辑：检查target存在且可见
      else if (p.type === 'tesla') {
        if (p.targets && p.targets.length > 1) {
          this._drawTeslaChain(ctx, p, renderTime);
        }
      } else if (p.type === 'cryo') {
        if (p.target && p.target.alive) {
          this._drawCryoBeam(ctx, p, renderTime);
        }
      } else if (p.type === 'plasma') {
        if (p.target && p.target.alive) {
          this._drawPlasmaBeam(ctx, p, renderTime);
        }
      }
    }
  }

  /**
   * 绘制导弹（使用缓存角度，减少Math.atan2重复计算）
   */
  _drawMissile(ctx, p, renderTime) {
    // 尾迹
    if (p.trail && p.trail.length > 0) {
      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        const alpha = t.life / 0.3;
        const size = 3 + (1 - alpha) * 2;

        ctx.fillStyle = `rgba(80,180,255,${alpha * 0.25})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, size * 2.2, 0, PI2);
        ctx.fill();

        ctx.fillStyle = `rgba(120,210,255,${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, size * 1.2, 0, PI2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, size * 0.4, 0, PI2);
        ctx.fill();
      }
    }

    // 导弹主体 - 使用缓存角度避免重复计算atan2
    ctx.save();
    const t = renderTime * 5; // 等价于 Date.now() * 0.005
    const flamePulse = Math.sin(t * 3) * 0.3 + 0.7;
    // 使用Projectile缓存的角度，避免重复atan2
    const angle = (p._angle !== undefined && p._angle !== 0) ? p._angle : Math.atan2(p.vy, p.vx);

    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    // 外层推进器光晕
    ctx.shadowColor = '#00aaff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(0,170,255,${0.35 * flamePulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, PI2);
    ctx.fill();

    // 导弹主体
    const bodyGrad = ctx.createLinearGradient(0, -5, 0, 5);
    bodyGrad.addColorStop(0, '#ff5566');
    bodyGrad.addColorStop(0.4, '#e63946');
    bodyGrad.addColorStop(0.6, '#c1121f');
    bodyGrad.addColorStop(1, '#8b0a14');
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5, 0, 0, PI2);
    ctx.fill();

    // 金色装饰边
    ctx.shadowBlur = 0;
    const goldGrad = ctx.createLinearGradient(0, -3, 0, 3);
    goldGrad.addColorStop(0, '#ffe680');
    goldGrad.addColorStop(0.5, '#ffd700');
    goldGrad.addColorStop(1, '#b8860b');
    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.ellipse(2, 0, 4.5, 2.8, 0, 0, PI2);
    ctx.fill();

    // 金属高光
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(2, -2, 3, 0.8, 0, 0, PI2);
    ctx.fill();

    // 推进器火焰
    const flameLength = 10 + Math.sin(t * 5) * 4;
    ctx.save();
    ctx.shadowColor = '#00aaff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = `rgba(0,170,255,${flamePulse * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-flameLength, -4);
    ctx.lineTo(-flameLength, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(120,220,255,${flamePulse * 0.85})`;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-flameLength * 0.7, -2.5);
    ctx.lineTo(-flameLength * 0.7, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${flamePulse})`;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(-flameLength * 0.4, -1.2);
    ctx.lineTo(-flameLength * 0.4, 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 核心亮点
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(2, -1, 1.5, 0, PI2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 绘制激光束
   */
  _drawLaserBeam(ctx, p, renderTime) {
    const t = renderTime * 5;
    const sx = p.x, sy = p.y;
    const tx = p.target.x, ty = p.target.y;
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    ctx.save();
    ctx.shadowColor = '#9933ff';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = `rgba(153,51,255,${0.25 + Math.sin(t) * 0.1})`;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.shadowColor = '#cc66ff';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(204,102,255,${0.7 + Math.sin(t * 1.5) * 0.2})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 流动符文
    ctx.save();
    ctx.shadowColor = '#cc66ff';
    ctx.shadowBlur = 8;
    const runeCount = Math.max(3, Math.floor(dist / 25));
    const flowOffset = (t * 60) % (dist / Math.max(1, runeCount));
    for (let r = 0; r < runeCount; r++) {
      const rt = ((r / runeCount) * dist + flowOffset) % dist;
      const px = sx + nx * rt;
      const py = sy + ny * rt;
      const runeAlpha = 0.4 + Math.sin(t * 4 + r) * 0.4;
      ctx.strokeStyle = `rgba(230,180,255,${runeAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(t * 2 + r * 0.7);
      ctx.beginPath();
      ctx.rect(-3, -3, 6, 6);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${runeAlpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, 1.2, 0, PI2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 起点魔法阵
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = '#9933ff';
    ctx.shadowBlur = 12;
    ctx.rotate(t * 1.5);
    ctx.strokeStyle = `rgba(153,51,255,${0.7 + Math.sin(t * 2) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * PI2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, PI2);
    ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * PI2;
      ctx.fillStyle = `rgba(204,153,255,0.9)`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 10, Math.sin(a) * 10, 1.5, 0, PI2);
      ctx.fill();
    }
    ctx.restore();

    // 内层魔法阵
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = '#cc66ff';
    ctx.shadowBlur = 8;
    ctx.rotate(-t * 2);
    ctx.strokeStyle = `rgba(204,102,255,${0.6 + Math.sin(t * 3) * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, PI2);
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * PI2;
      if (k === 0) ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      else ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 目标点爆炸
    const pulse = Math.sin(t * 3) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = '#9933ff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = `rgba(153,51,255,${0.4 * pulse})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 14 * pulse, 0, PI2);
    ctx.fill();
    ctx.fillStyle = `rgba(204,102,255,${0.6 * pulse})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 8 * pulse, 0, PI2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.9 * pulse})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 3 * pulse, 0, PI2);
    ctx.fill();
    ctx.restore();

    // 紫色粒子
    ctx.save();
    ctx.shadowColor = '#cc66ff';
    ctx.shadowBlur = 6;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * PI2 + t * 0.5;
      const partDist = (8 + Math.sin(t * 4 + i * 1.3) * 4) * pulse;
      const px = tx + Math.cos(angle) * partDist;
      const py = ty + Math.sin(angle) * partDist;
      const pAlpha = 0.5 + Math.sin(t * 5 + i) * 0.4;
      ctx.fillStyle = `rgba(204,153,255,${pAlpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, PI2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 绘制电磁链
   */
  _drawTeslaChain(ctx, p, renderTime) {
    const t = renderTime * 5;
    for (let i = 0; i < p.targets.length - 1; i++) {
      const from = p.targets[i];
      const to = p.targets[i + 1];
      if (from && from.alive && to && to.alive) {
        const segments = 8;
        const path = [];
        const fdx = to.x - from.x, fdy = to.y - from.y;
        const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
        const fnx = fdist > 0 ? -fdy / fdist : 0;
        const fny = fdist > 0 ? fdx / fdist : 0;
        path.push({ x: from.x, y: from.y });
        for (let j = 1; j < segments; j++) {
          const tj = j / segments;
          const baseX = from.x + fdx * tj;
          const baseY = from.y + fdy * tj;
          const seed = i * 1000 + j * 37;
          const wobble = Math.sin(t * 18 + seed) * 14 * Math.sin(tj * Math.PI);
          path.push({ x: baseX + fnx * wobble, y: baseY + fny * wobble });
        }
        path.push({ x: to.x, y: to.y });

        ctx.save();
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 22;
        ctx.strokeStyle = `rgba(255,204,0,${0.3 + Math.sin(t + i) * 0.2})`;
        ctx.lineWidth = 9;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let j = 1; j < path.length; j++) ctx.lineTo(path[j].x, path[j].y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(255,220,80,${0.8 + Math.sin(t * 1.5 + i) * 0.2})`;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let j = 1; j < path.length; j++) ctx.lineTo(path[j].x, path[j].y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let j = 1; j < path.length; j++) ctx.lineTo(path[j].x, path[j].y);
        ctx.stroke();
        ctx.restore();

        // 分支
        ctx.save();
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = `rgba(255,220,100,0.6)`;
        ctx.lineWidth = 1.5;
        for (let b = 2; b < path.length - 1; b += 2) {
          const branchSeed = i * 100 + b * 13;
          const branchAngle = Math.sin(t * 10 + branchSeed) * 1.2 + (b % 2 === 0 ? 1 : -1) * 0.8;
          const branchLen = 6 + Math.abs(Math.sin(t * 8 + branchSeed)) * 6;
          const bx = path[b].x + Math.cos(branchAngle) * branchLen;
          const by = path[b].y + Math.sin(branchAngle) * branchLen;
          ctx.beginPath();
          ctx.moveTo(path[b].x, path[b].y);
          const mx = (path[b].x + bx) / 2 + Math.sin(t * 20 + branchSeed) * 2;
          const my = (path[b].y + by) / 2 + Math.cos(t * 20 + branchSeed) * 2;
          ctx.lineTo(mx, my);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
        ctx.restore();

        // 端点冲击波
        const shockPulse = Math.sin(t * 4 + i) * 0.5 + 0.5;
        ctx.save();
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = `rgba(255,220,80,${0.6 * (1 - shockPulse)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(from.x, from.y, 8 + shockPulse * 12, 0, PI2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,200,${0.8 * (1 - shockPulse)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(from.x, from.y, 6 + shockPulse * 8, 0, PI2);
        ctx.stroke();
        const ballPulse = Math.sin(t * 3 + i) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255,204,0,${0.6 * ballPulse})`;
        ctx.beginPath();
        ctx.arc(from.x, from.y, 7 * ballPulse, 0, PI2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(from.x - 2, from.y - 2, 3 * ballPulse, 0, PI2);
        ctx.fill();
        ctx.restore();

        // 电火花
        ctx.save();
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 5;
        for (let s = 0; s < 5; s++) {
          const sparkSeed = i * 50 + s * 11;
          const sparkAngle = (s / 5) * PI2 + t * 2;
          const sparkDist = 6 + Math.abs(Math.sin(t * 12 + sparkSeed)) * 8;
          const spx = from.x + Math.cos(sparkAngle) * sparkDist;
          const spy = from.y + Math.sin(sparkAngle) * sparkDist;
          const sparkAlpha = 0.4 + Math.sin(t * 15 + sparkSeed) * 0.4;
          ctx.fillStyle = `rgba(255,240,150,${sparkAlpha})`;
          ctx.beginPath();
          ctx.arc(spx, spy, 1.2, 0, PI2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  /**
   * 绘制冷冻射线
   */
  _drawCryoBeam(ctx, p, renderTime) {
    const t = renderTime * 5;
    const sx = p.x, sy = p.y;
    const tx = p.target.x, ty = p.target.y;
    const cdx = tx - sx, cdy = ty - sy;
    const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

    // 冰雾
    ctx.save();
    ctx.shadowColor = '#87ceeb';
    ctx.shadowBlur = 20;
    for (let m = 0; m < 4; m++) {
      const mt = (m + (t * 0.3) % 1) / 4;
      const mx = sx + cdx * mt;
      const my = sy + cdy * mt + Math.sin(t * 2 + m) * 6;
      const mAlpha = 0.08 + Math.sin(t + m) * 0.04;
      ctx.fillStyle = `rgba(200,235,255,${mAlpha})`;
      ctx.beginPath();
      ctx.arc(mx, my, 10 + Math.sin(t * 1.5 + m) * 3, 0, PI2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#00bfff';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = `rgba(0,191,255,${0.2 + Math.sin(t) * 0.1})`;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#87ceeb';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(135,206,235,${0.6 + Math.sin(t * 1.5) * 0.2})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // 冰晶折射
    ctx.save();
    ctx.shadowColor = '#00bfff';
    ctx.shadowBlur = 8;
    const refractCount = Math.max(2, Math.floor(cdist / 30));
    for (let r = 0; r < refractCount; r++) {
      const rt = (r + 0.5) / refractCount;
      const rx = sx + cdx * rt + Math.sin(t * 3 + r) * 3;
      const ry = sy + cdy * rt + Math.cos(t * 3 + r) * 3;
      const rAlpha = 0.3 + Math.sin(t * 4 + r * 1.5) * 0.3;
      ctx.strokeStyle = `rgba(180,230,255,${rAlpha})`;
      ctx.lineWidth = 1;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(t * 1.5 + r);
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const ha = (h / 6) * PI2;
        const hr = 3;
        if (h === 0) ctx.moveTo(Math.cos(ha) * hr, Math.sin(ha) * hr);
        else ctx.lineTo(Math.cos(ha) * hr, Math.sin(ha) * hr);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // 雪花
    ctx.save();
    ctx.shadowColor = '#00bfff';
    ctx.shadowBlur = 6;
    for (let i = 0; i < 8; i++) {
      const st = (Math.sin(t * 2 + i * 0.9) * 0.5 + 0.5);
      const px = sx + cdx * st + Math.sin(t * 3 + i * 1.7) * 10;
      const py = sy + cdy * st + Math.sin(t * 5 + i * 7) * 8;
      const size = 2.5 + Math.sin(t * 2 + i) * 1.5;
      const sAlpha = 0.5 + Math.sin(t + i) * 0.3;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(t * 2 + i);
      ctx.strokeStyle = `rgba(220,245,255,${sAlpha})`;
      ctx.lineWidth = 1;
      for (let j = 0; j < 6; j++) {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(0, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.6);
        ctx.lineTo(-size * 0.3, -size * 0.9);
        ctx.moveTo(0, -size * 0.6);
        ctx.lineTo(size * 0.3, -size * 0.9);
        ctx.stroke();
        ctx.rotate(Math.PI / 3);
      }
      ctx.restore();
    }
    ctx.restore();

    // 目标冰冻
    const frostPulse = Math.sin(t * 3) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = '#00bfff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(0,191,255,${0.4 * frostPulse})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 15 * frostPulse, 0, PI2);
    ctx.fill();
    ctx.fillStyle = `rgba(135,206,235,${0.6 * frostPulse})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 8 * frostPulse, 0, PI2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = frostPulse;
    ctx.beginPath();
    ctx.arc(tx, ty, 4 * frostPulse, 0, PI2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#87ceeb';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(220,245,255,${0.7 * frostPulse})`;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = `rgba(180,230,255,${0.5 * frostPulse})`;
    for (let c = 0; c < 6; c++) {
      const ca = (c / 6) * PI2 + t * 0.5;
      const cLen = 8 + Math.sin(t * 4 + c) * 3;
      const cx1 = tx + Math.cos(ca) * 6;
      const cy1 = ty + Math.sin(ca) * 6;
      const cx2 = tx + Math.cos(ca) * (6 + cLen);
      const cy2 = ty + Math.sin(ca) * (6 + cLen);
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx2, cy2, 1.5, 0, PI2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 绘制等离子束
   */
  _drawPlasmaBeam(ctx, p, renderTime) {
    const t = renderTime * 5;
    const sx = p.x, sy = p.y;
    const tx = p.target.x, ty = p.target.y;
    const pdx = tx - sx, pdy = ty - sy;
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
    const pnx = pdist > 0 ? pdx / pdist : 0;
    const pny = pdist > 0 ? pdy / pdist : 0;

    const goldColor = '#ffd700';
    const redColor = '#ff3322';

    const pulseWave = (t * 200) % (pdist + 20);

    ctx.save();
    ctx.shadowColor = redColor;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = `rgba(255,80,40,${0.3 + Math.sin(t * 2) * 0.1})`;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.shadowColor = goldColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(255,200,50,${0.7 + Math.sin(t * 3) * 0.2})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 脉冲波
    ctx.save();
    ctx.shadowColor = goldColor;
    ctx.shadowBlur = 12;
    if (pulseWave < pdist) {
      const pwx = sx + pnx * pulseWave;
      const pwy = sy + pny * pulseWave;
      const pulseAlpha = 0.6 + Math.sin(t * 5) * 0.3;
      ctx.fillStyle = `rgba(255,240,180,${pulseAlpha})`;
      ctx.beginPath();
      ctx.arc(pwx, pwy, 4, 0, PI2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,200,50,${pulseAlpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(pwx, pwy, 8, 0, PI2);
      ctx.fill();
    }
    ctx.restore();

    // 旋转粒子
    ctx.save();
    ctx.shadowColor = goldColor;
    ctx.shadowBlur = 6;
    const partCount = 6;
    for (let i = 0; i < partCount; i++) {
      const pt = (i / partCount + t * 0.4) % 1;
      const baseX = sx + pdx * pt;
      const baseY = sy + pdy * pt;
      const orbitAngle = t * 4 + i * (PI2 / partCount);
      const orbitR = 4 + Math.sin(t * 3 + i) * 2;
      const ppx = baseX + (-pny) * Math.cos(orbitAngle) * orbitR;
      const ppy = baseY + (pnx) * Math.cos(orbitAngle) * orbitR;
      const pAlpha = 0.5 + Math.sin(t * 5 + i) * 0.4;
      ctx.fillStyle = `rgba(255,220,100,${pAlpha})`;
      ctx.beginPath();
      ctx.arc(ppx, ppy, 2, 0, PI2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${pAlpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(ppx, ppy, 0.8, 0, PI2);
      ctx.fill();
    }
    ctx.restore();

    // 目标爆发
    const burstPulse = Math.sin(t * 4) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = redColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(255,60,30,${0.4 * burstPulse})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 14 * burstPulse, 0, PI2);
    ctx.fill();
    ctx.shadowColor = goldColor;
    ctx.fillStyle = `rgba(255,200,50,${0.6 * burstPulse})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 9 * burstPulse, 0, PI2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.9 * burstPulse})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 4 * burstPulse, 0, PI2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = goldColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(255,220,100,${0.6 * burstPulse})`;
    ctx.lineWidth = 1.5;
    for (let r = 0; r < 6; r++) {
      const ra = (r / 6) * PI2 + t * 1.5;
      const rLen = 10 + Math.sin(t * 6 + r) * 4;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(ra) * rLen, ty + Math.sin(ra) * rLen);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 绘制右侧警告线
   */
  _drawWarningLine(time) {
    const ctx = this.ctx;
    const gridW = this.gameMap.gridW;
    const gridH = this.gameMap.gridH;
    const warningAlpha = Math.sin(time * 4) * 0.3 + 0.3;
    ctx.strokeStyle = `rgba(255,100,80,${warningAlpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(gridW, 0);
    ctx.lineTo(gridW, gridH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * 绘制低血量警告边框
   */
  _drawLowHpWarning(time, hp, maxHp) {
    if (hp >= 5) return;

    const ctx = this.ctx;
    const gridW = this.gameMap.gridW;
    const gridH = this.gameMap.gridH;

    const intensity = Math.max(0, 1 - hp / 5);
    const pulseAlpha = (Math.sin(time * 4) * 0.3 + 0.7) * intensity * 0.6;

    const topGrad = ctx.createLinearGradient(0, 0, 0, 40);
    topGrad.addColorStop(0, `rgba(255,100,80,${pulseAlpha})`);
    topGrad.addColorStop(1, `rgba(255,100,80,0)`);
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, gridW, 40);

    const botGrad = ctx.createLinearGradient(0, gridH, 0, gridH - 40);
    botGrad.addColorStop(0, `rgba(255,100,80,${pulseAlpha})`);
    botGrad.addColorStop(1, `rgba(255,100,80,0)`);
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, gridH - 40, gridW, 40);

    const leftGrad = ctx.createLinearGradient(0, 0, 40, 0);
    leftGrad.addColorStop(0, `rgba(255,100,80,${pulseAlpha})`);
    leftGrad.addColorStop(1, `rgba(255,100,80,0)`);
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 40, gridH);

    const rightGrad = ctx.createLinearGradient(gridW, 0, gridW - 40, 0);
    rightGrad.addColorStop(0, `rgba(255,100,80,${pulseAlpha})`);
    rightGrad.addColorStop(1, `rgba(255,100,80,0)`);
    ctx.fillStyle = rightGrad;
    ctx.fillRect(gridW - 40, 0, 40, gridH);

    const pulseIntensity = Math.sin(time * 4) * 0.5 + 0.5;
    const overlayAlpha = (1 - hp / maxHp) * 0.12 * pulseIntensity;
    ctx.fillStyle = `rgba(255,100,80,${overlayAlpha})`;
    ctx.fillRect(0, 0, gridW, gridH);

    const vignette = ctx.createRadialGradient(gridW / 2, gridH / 2, gridW * 0.3, gridW / 2, gridH / 2, gridW * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, gridW, gridH);
  }

  /**
   * 绘制3-2-1倒计时
   */
  _drawCountdown(time, gameState) {
    const ctx = this.ctx;
    const gridW = this.gameMap.gridW;
    const gridH = this.gameMap.gridH;

    if (gameState.countdownValue > 0) {
      const progress = gameState.countdownTimer % 1;
      const scale = 1 + (1 - progress) * 0.5;
      const alpha = 1 - progress * 0.3;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${80 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,136,102,0.3)';
      ctx.fillText(gameState.countdownValue.toString(), gridW / 2 + 2, gridH / 2 + 2);
      ctx.fillStyle = '#ff8866';
      ctx.fillText(gameState.countdownValue.toString(), gridW / 2, gridH / 2);
      ctx.restore();
    } else if (gameState.countdownValue <= 0 && gameState.countdownTimer >= 3) {
      const progress = gameState.countdownTimer - 3;
      if (progress < 1) {
        const scale = 1 + progress * 0.3;
        const alpha = 1 - progress;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${60 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,170,68,0.3)';
        ctx.fillText('战斗！', gridW / 2 + 2, gridH / 2 + 2);
        ctx.fillStyle = '#ffaa44';
        ctx.fillText('战斗！', gridW / 2, gridH / 2);
        ctx.restore();
      }
    }
  }

  /**
   * 绘制波间等待提示
   */
  _drawWaveInterval(time, gameState) {
    const ctx = this.ctx;
    const gridW = this.gameMap.gridW;
    const gridH = this.gameMap.gridH;

    const remaining = Math.max(0, 5 - gameState.waveIntervalTimer);
    const pulseAlpha = Math.sin(time * 3) * 0.2 + 0.8;

    ctx.save();
    ctx.globalAlpha = pulseAlpha;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,204,102,0.3)';
    ctx.fillText(`下一波即将到来... ${Math.ceil(remaining)}秒`, gridW / 2 + 1, gridH / 2 + 1);
    ctx.fillStyle = '#ffcc66';
    ctx.fillText(`下一波即将到来... ${Math.ceil(remaining)}秒`, gridW / 2, gridH / 2);
    ctx.restore();
  }

  /**
   * 绘制能量宝珠（带视口裁剪）
   */
  _drawEnergyOrbs(orbs, time) {
    const ctx = this.ctx;
    for (let i = 0; i < orbs.length; i++) {
      const orb = orbs[i];
      if (!orb.alive) continue;
      if (!this._isVisible(orb.x, orb.y, 20)) continue;

      const pulse = Math.sin(time * 5 + orb.x) * 0.3 + 0.7;
      const radius = 8 * pulse;

      ctx.save();
      ctx.fillStyle = `rgba(255,170,68,${0.3 * pulse})`;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, radius + 10, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(255,170,68,${0.3 * pulse})`;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, radius + 4, 0, PI2);
      ctx.fill();

      const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, radius);
      grad.addColorStop(0, `rgba(255,245,230,${0.9 * pulse})`);
      grad.addColorStop(0.5, `rgba(255,200,100,${0.7 * pulse})`);
      grad.addColorStop(1, `rgba(255,170,68,${0.3 * pulse})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, radius, 0, PI2);
      ctx.fill();

      ctx.fillStyle = '#ffcc66';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+10', orb.x, orb.y - radius - 5);

      ctx.restore();
    }
  }

  /**
   * 触发波次开始闪光
   */
  triggerWaveFlash() {
    this._waveFlash = 1.0;
  }
}
