// ================================================================
// 地图渲染 - Q萌暖色科幻风格（路径、放置位、传送门、基地、星座背景）
// ================================================================

export class MapRenderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../map/GameMap.js').GameMap} gameMap
   */
  constructor(ctx, gameMap) {
    this.ctx = ctx;
    this.gameMap = gameMap;

    /** 关卡主题（由Renderer设置） */
    this.theme = null;
    /** 星座连线坐标（由Renderer设置） */
    this.constellation = null;

    /** 离屏网格缓存 */
    this._gridCache = null;
  }

  // ==============================================================
  //  Drawing Helpers
  // ==============================================================

  /**
   * 绘制圆角矩形路径（不自动fill/stroke，调用方自行处理）
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

  /**
   * 绘制4角小星星
   */
  _drawStar(ctx, x, y, outerR, innerR, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * 2 / 8) * i - Math.PI / 2;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 绘制盾牌形状
   */
  _drawShield(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.4);
    ctx.lineTo(x + w * 0.5, y - h * 0.5);
    ctx.lineTo(x + w, y - h * 0.4);
    ctx.lineTo(x + w, y + h * 0.1);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.6, x + w * 0.5, y + h * 0.5);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.6, x, y + h * 0.1);
    ctx.closePath();
  }

  /**
   * 绘制心形
   */
  _drawHeart(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(x, y - size * 0.3, x - size * 0.6, y - size * 0.3, x - size * 0.6, y + size * 0.1);
    ctx.bezierCurveTo(x - size * 0.6, y + size * 0.5, x, y + size * 0.7, x, y + size * 0.7);
    ctx.bezierCurveTo(x, y + size * 0.7, x + size * 0.6, y + size * 0.5, x + size * 0.6, y + size * 0.1);
    ctx.bezierCurveTo(x + size * 0.6, y - size * 0.3, x, y - size * 0.3, x, y + size * 0.3);
    ctx.closePath();
  }

  /**
   * 绘制阿基米德螺旋线
   */
  _drawSpiral(ctx, cx, cy, maxR, turns, startAngle) {
    ctx.beginPath();
    const steps = Math.floor(turns * 60);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + t * turns * Math.PI * 2;
      const r = t * maxR;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }

  /**
   * 绘制小房子图标（三角屋顶+方形房体）
   */
  _drawHouse(ctx, x, y, size) {
    const hw = size * 0.5; // half width
    const hh = size * 0.4; // half height body
    const roofH = size * 0.35;

    // 房体
    ctx.beginPath();
    ctx.rect(x - hw, y - hh + roofH * 0.2, hw * 2, hh * 2);
    // 屋顶
    ctx.moveTo(x - hw * 1.2, y - hh + roofH * 0.2);
    ctx.lineTo(x, y - hh - roofH);
    ctx.lineTo(x + hw * 1.2, y - hh + roofH * 0.2);
    ctx.closePath();
  }

  // ==============================================================
  //  Grid Cache
  // ==============================================================

  /**
   * 缓存网格到离屏Canvas
   * @param {Object} level - 关卡配置（可选，用于标识不同关卡）
   */
  cacheGrid(level) {
    const gameMap = this.gameMap;
    const cell = gameMap.cell;
    const cols = gameMap.cols;
    const rows = gameMap.rows;
    const gridW = gameMap.gridW;
    const gridH = gameMap.gridH;

    const offscreen = document.createElement('canvas');
    offscreen.width = gridW;
    offscreen.height = gridH;
    const offCtx = offscreen.getContext('2d');

    // 更柔和的网格线
    offCtx.strokeStyle = 'rgba(150, 100, 80, 0.08)';
    offCtx.lineWidth = 1;
    for (let r = 0; r <= rows; r++) {
      offCtx.beginPath();
      offCtx.moveTo(0, r * cell);
      offCtx.lineTo(gridW, r * cell);
      offCtx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      offCtx.beginPath();
      offCtx.moveTo(c * cell, 0);
      offCtx.lineTo(c * cell, gridH);
      offCtx.stroke();
    }

    this._gridCache = offscreen;
  }

  /**
   * 使缓存失效（关卡切换时调用）
   */
  invalidateCache() {
    this._gridCache = null;
  }

  // ==============================================================
  //  Theme / Constellation setters
  // ==============================================================

  /**
   * 设置关卡主题
   * @param {Object|null} theme - 主题配置
   * @param {Array|null} constellation - 星座连线坐标
   */
  setTheme(theme, constellation) {
    this.theme = theme;
    if (constellation !== undefined) {
      this.constellation = constellation;
    }
  }

  /**
   * 单独设置星座连线坐标
   * @param {Array|null} stars - 星座星星坐标数组
   */
  setConstellation(stars) {
    this.constellation = stars;
  }

  // ==============================================================
  //  Main Render
  // ==============================================================

  /**
   * 渲染地图
   */
  render(time, towers, hoverCell, selectedTower, energy, towerTypes) {
    const ctx = this.ctx;
    const gameMap = this.gameMap;
    const cell = gameMap.cell;
    const cols = gameMap.cols;
    const rows = gameMap.rows;
    const gridW = gameMap.gridW;
    const gridH = gameMap.gridH;
    const paths = gameMap.getPaths();

    // 主题颜色
    const pathColor = this.theme?.pathColor || null;
    const accentColor = this.theme?.accentColor || null;

    // ---- 1. 网格线（离屏缓存）----
    if (this._gridCache) {
      ctx.drawImage(this._gridCache, 0, 0);
    } else {
      ctx.strokeStyle = 'rgba(150, 100, 80, 0.08)';
      ctx.lineWidth = 1;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cell);
        ctx.lineTo(gridW, r * cell);
        ctx.stroke();
      }
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cell, 0);
        ctx.lineTo(c * cell, gridH);
        ctx.stroke();
      }
    }

    // ---- 2. 星座背景 ----
    this.drawConstellation(time);

    // ---- 3. 路径（低沉暗色 + 极弱暖边，让位给塔和敌人）----
    paths.forEach(path => {
      if (path.length === 0) return;

      const fillColor = pathColor
        ? pathColor + '14'
        : 'rgba(34, 22, 30, 0.65)';
      const edgeColor = pathColor
        ? pathColor + '22'
        : 'rgba(120, 80, 60, 0.18)';
      const coreColor = pathColor
        ? pathColor + '10'
        : 'rgba(120, 90, 70, 0.06)';

      // 单条贯穿全路径的 thick line，round join + round cap
      // 视觉上"退到背景"：宽度只到 cell 的 0.7，留出边界让格子更透气
      const buildPath = () => {
        ctx.beginPath();
        path.forEach((p, i) => {
          const px = p.c * cell + cell / 2;
          const py = p.r * cell + cell / 2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
      };

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 1) 路面填充（窄一些、颜色更冷更暗）
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = cell * 0.7;
      buildPath();
      ctx.stroke();

      // 2) 极轻的暖色描边（仅在路口和弯曲处能看到一点点暖光）
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = cell * 0.7;
      buildPath();
      ctx.stroke();

      ctx.restore();

      // 路径中心虚线（极弱，几乎不可见，暗示走向就够）
      ctx.save();
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 10]);
      ctx.lineCap = 'round';
      buildPath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 路径装饰：保留但更稀疏、更暗，只在起终点和弯道点缀
      if (path.length > 4) {
        // 只在路径的 1/4、2/4、3/4 处各画一个小亮点
        const checkpoints = [
          Math.floor(path.length * 0.2),
          Math.floor(path.length * 0.5),
          Math.floor(path.length * 0.8)
        ];
        checkpoints.forEach((i, idx) => {
          const p = path[i];
          const dx = p.c * cell + cell / 2;
          const dy = p.r * cell + cell / 2;
          const twinkle = Math.sin(time * 2 + i * 1.5) * 0.15 + 0.25;
          ctx.save();
          ctx.globalAlpha = twinkle;
          ctx.fillStyle = '#aa8866';
          ctx.beginPath();
          ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }
    });

    // ---- 4. 路径流动光效（极弱，让位给战斗）----
    paths.forEach(path => {
      if (path.length > 1) {
        const totalLen = path.length;
        const flowSpeed = time * 1.6;
        const dotCount = Math.min(4, Math.floor(totalLen / 6));

        for (let i = 0; i < dotCount; i++) {
          const t = ((flowSpeed + i / dotCount) % 1);
          const idx = Math.floor(t * (totalLen - 1));
          const nextIdx = Math.min(idx + 1, totalLen - 1);
          const frac = t * (totalLen - 1) - idx;

          const px = (path[idx].c + (path[nextIdx].c - path[idx].c) * frac) * cell + cell / 2;
          const py = (path[idx].r + (path[nextIdx].r - path[idx].r) * frac) * cell + cell / 2;

          const alpha = 0.15 + Math.sin(time * 3 + i) * 0.1;

          ctx.save();

          // 拖尾发光（稍大、更柔和）
          const trailLen = 2;
          for (let tr = trailLen; tr >= 1; tr--) {
            const trT = Math.max(0, t - tr * 0.012);
            const trIdx = Math.floor(trT * (totalLen - 1));
            const trNextIdx = Math.min(trIdx + 1, totalLen - 1);
            const trFrac = trT * (totalLen - 1) - trIdx;
            const trx = (path[trIdx].c + (path[trNextIdx].c - path[trIdx].c) * trFrac) * cell + cell / 2;
            const trY = (path[trIdx].r + (path[trNextIdx].r - path[trIdx].r) * trFrac) * cell + cell / 2;

            ctx.globalAlpha = alpha * 0.08 * (1 - tr / (trailLen + 1));
            ctx.fillStyle = pathColor || '#ccaa88';
            ctx.beginPath();
            ctx.arc(trx, trY, 4 + (trailLen - tr) * 1.2, 0, Math.PI * 2);
            ctx.fill();
          }

          // 外层发光圆
          ctx.globalAlpha = alpha * 0.18;
          ctx.fillStyle = pathColor || '#ccaa88';
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fill();

          // 核心（稍大）
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillStyle = pathColor || '#ddbb99';
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }
    });

    // ---- 5. 放置位（极简：淡圆点 + 轻呼吸，不再画"格子"）----
    const occupiedSet = new Set();
    for (let i = 0; i < towers.length; i++) {
      occupiedSet.add(towers[i].row * 1000 + towers[i].col);
    }

    gameMap.placementSlots.forEach(slot => {
      const x = slot.col * cell;
      const y = slot.row * cell;
      if (!occupiedSet.has(slot.row * 1000 + slot.col)) {
        const breathe = Math.sin(time * 1.5 + slot.row * 0.5 + slot.col * 0.3) * 0.18 + 0.82;
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const accent = accentColor || '#c89670';

        // 1) 中心微光（很小、很淡）
        ctx.save();
        ctx.globalAlpha = 0.10 * breathe;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2) "+" 符号（比之前更细、更淡）
        const plusLen = cell * 0.13;
        ctx.save();
        ctx.globalAlpha = 0.22 * breathe;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - plusLen, cy);
        ctx.lineTo(cx + plusLen, cy);
        ctx.moveTo(cx, cy - plusLen);
        ctx.lineTo(cx, cy + plusLen);
        ctx.stroke();
        ctx.restore();
      }
    });

    // ---- 6. 基地防线（可爱圆点虚线）----
    const baseLineColor = accentColor || '#ff8866';
    const dashLen = 8;
    const gapLen = 6;
    const totalH = gridH;
    ctx.save();

    // 先画淡色底线
    ctx.strokeStyle = baseLineColor + '40';
    ctx.lineWidth = 2;
    ctx.setLineDash([dashLen, gapLen]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, totalH);
    ctx.stroke();
    ctx.setLineDash([]);

    // 在每个dash点绘制小暖色圆点
    const dotSpacing = dashLen + gapLen;
    const numDots = Math.ceil(totalH / dotSpacing);
    for (let i = 0; i <= numDots; i++) {
      const dy = i * dotSpacing;
      if (dy > totalH) break;
      const dotPulse = Math.sin(time * 2 + i * 0.8) * 0.15 + 0.55;
      ctx.globalAlpha = dotPulse;
      ctx.fillStyle = baseLineColor;
      ctx.beginPath();
      ctx.arc(0, dy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // ---- 7. 传送门（入口） ----
    this.drawPortal(time);

    // ---- 8. 基地（出口） ----
    this.drawBase(time);
  }

  // ==============================================================
  //  Constellation Background
  // ==============================================================

  /**
   * 绘制星座背景（连线+闪烁星星）
   * @param {number} time - 当前时间（秒）
   */
  drawConstellation(time) {
    if (!this.constellation || !this.theme) return;
    const ctx = this.ctx;
    const w = this.gameMap.gridW;
    const h = this.gameMap.gridH;
    const accentColor = this.theme.accentColor || '#ffffff';

    // 绘制星座连线
    ctx.strokeStyle = accentColor + '18';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.constellation.forEach((star, i) => {
      const x = star.x * w;
      const y = star.y * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 绘制星座星星
    this.constellation.forEach((star, i) => {
      const x = star.x * w;
      const y = star.y * h;
      const pulse = Math.sin(time * 2 + i) * 0.3 + 0.7;
      const size = 3 + pulse * 2;

      // 闪烁效果 - 偶尔闪亮
      const sparkleCycle = Math.sin(time * 3.7 + i * 2.3);
      const isSparkling = sparkleCycle > 0.92;
      const sparkleBoost = isSparkling ? (sparkleCycle - 0.92) * 12 : 0; // 0 ~ ~1

      // 外层发光
      ctx.save();
      ctx.globalAlpha = 0.06 + sparkleBoost * 0.15;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(x, y, size * 2.5 + sparkleBoost * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 星星核心
      ctx.save();
      ctx.globalAlpha = 0.35 + sparkleBoost * 0.5;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(x, y, size + sparkleBoost * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 闪烁时画十字光芒
      if (isSparkling) {
        ctx.save();
        ctx.globalAlpha = sparkleBoost * 0.6;
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1;
        const rayLen = size * 2 + sparkleBoost * 6;
        ctx.beginPath();
        ctx.moveTo(x - rayLen, y);
        ctx.lineTo(x + rayLen, y);
        ctx.moveTo(x, y - rayLen);
        ctx.lineTo(x, y + rayLen);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // ==============================================================
  //  Portal (Entry Point) - Q萌旋涡传送门
  // ==============================================================

  /**
   * 绘制时空之门（路径起点的Q萌旋涡传送门）
   * @param {number} time - 当前时间（秒）
   */
  drawPortal(time) {
    const ctx = this.ctx;
    const gameMap = this.gameMap;
    const paths = gameMap.getPaths();
    const cell = gameMap.cell;

    // 收集所有入口路径的起点
    const entryPoints = [];
    if (gameMap.isMultiPath) {
      for (let i = 0; i < Math.min(2, paths.length); i++) {
        if (paths[i] && paths[i].length > 0) {
          entryPoints.push(paths[i][0]);
        }
      }
    } else {
      if (paths[0] && paths[0].length > 0) {
        entryPoints.push(paths[0][0]);
      }
    }

    entryPoints.forEach(start => {
      const cx = start.c * cell + cell / 2;
      const cy = start.r * cell + cell / 2;
      const radius = cell * 0.75;

      ctx.save();
      ctx.translate(cx, cy);

      const glowAlpha = 0.3 + Math.sin(time * 2) * 0.15;

      // ---- 外层波浪花边环 ----
      ctx.save();
      ctx.rotate(time * 0.5);
      const scallopCount = 16;
      const scallopR = radius * 1.05;
      const bumpAmp = radius * 0.12;
      ctx.beginPath();
      for (let i = 0; i <= scallopCount * 4; i++) {
        const angle = (Math.PI * 2 / (scallopCount * 4)) * i;
        // wave modulation
        const wave = Math.sin(angle * scallopCount + time * 2) * bumpAmp;
        const r = scallopR + wave;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(255, 150, 100, ${glowAlpha * 0.4})`;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();

      // ---- 外层旋转椭圆（暖色）----
      ctx.save();
      ctx.rotate(time * 0.8);
      ctx.strokeStyle = `rgba(255, 150, 100, ${glowAlpha + 0.25})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // ---- 内层旋涡螺旋线 ----
      ctx.save();
      ctx.rotate(-time * 0.6);
      const spiralTurns = 2.5;
      const spiralMaxR = radius * 0.7;
      ctx.strokeStyle = `rgba(255, 185, 140, ${glowAlpha + 0.1})`;
      ctx.lineWidth = 1.5;
      this._drawSpiral(ctx, 0, 0, spiralMaxR, spiralTurns, time * 1.5);
      ctx.stroke();
      ctx.restore();

      // ---- 内圈椭圆（反向旋转）----
      ctx.save();
      ctx.rotate(-time * 1.2);
      ctx.strokeStyle = `rgba(255, 190, 140, ${glowAlpha + 0.15})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.55, radius * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // ---- 旋转星星粒子 ----
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 / 6) * i + time * 2;
        const pr = radius * 0.8;
        const px = Math.cos(angle) * pr;
        const py = Math.sin(angle) * pr * 0.45;
        const particleAlpha = 0.5 + Math.sin(time * 4 + i) * 0.3;

        // 4角小星星代替圆点
        this._drawStar(ctx, px, py, 3.5, 1.5, '#ffbeaa', particleAlpha);
      }

      // ---- 中心暖色发光核心 ----
      const coreAlpha = 0.65 + Math.sin(time * 3) * 0.2;
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.32);
      coreGrad.addColorStop(0, `rgba(255, 220, 180, ${coreAlpha})`);
      coreGrad.addColorStop(0.6, `rgba(255, 170, 120, ${coreAlpha * 0.5})`);
      coreGrad.addColorStop(1, `rgba(255, 140, 100, 0)`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.32, 0, Math.PI * 2);
      ctx.fill();

      // ---- 中心可爱"眼睛"高光 ----
      ctx.save();
      ctx.globalAlpha = 0.7 + Math.sin(time * 2.5) * 0.15;
      ctx.fillStyle = 'rgba(255, 240, 220, 0.9)';
      ctx.beginPath();
      ctx.arc(-radius * 0.06, -radius * 0.06, radius * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    });
  }

  // ==============================================================
  //  Base (Exit Point) - Q萌盾牌+爱心基地
  // ==============================================================

  /**
   * 绘制太空基地（路径终点的Q萌盾牌基地图标）
   * @param {number} time - 当前时间（秒）
   * @param {number} hp - 当前生命值
   * @param {number} maxHp - 最大生命值
   */
  drawBase(time, hp = 20, maxHp = 25) {
    const ctx = this.ctx;
    const gameMap = this.gameMap;
    const cell = gameMap.cell;

    // 获取路径终点
    const lastPath = gameMap.getPaths()[gameMap.getPaths().length - 1];
    if (!lastPath || lastPath.length === 0) return;

    const end = lastPath[lastPath.length - 1];
    let cx = end.c * cell + cell / 2;
    const cy = end.r * cell + cell / 2;
    const radius = cell * 0.65;

    const hpRatio = hp / maxHp;
    const isUnderAttack = hpRatio < 0.3;
    const baseColor = isUnderAttack ? '#ff6655' : '#ff8866';
    const baseGlow = isUnderAttack ? 'rgba(255,102,85,' : 'rgba(255,136,102,';

    // 受攻击时轻微摇晃
    let shakeX = 0;
    if (isUnderAttack) {
      shakeX = Math.sin(time * 15) * 2;
    }

    ctx.save();
    ctx.translate(cx + shakeX, cy);

    // ---- 环境暖色光晕 ----
    if (isUnderAttack) {
      // 受攻击闪红多层
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ff6655';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ff8866';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- 盾牌主体 ----
    const shieldW = radius * 1.6;
    const shieldH = radius * 1.8;

    // 盾牌渐变填充
    const shieldGrd = ctx.createLinearGradient(0, -shieldH * 0.5, 0, shieldH * 0.5);
    if (isUnderAttack) {
      shieldGrd.addColorStop(0, 'rgba(100, 30, 25, 0.85)');
      shieldGrd.addColorStop(1, 'rgba(80, 20, 20, 0.9)');
    } else {
      shieldGrd.addColorStop(0, 'rgba(80, 35, 30, 0.85)');
      shieldGrd.addColorStop(1, 'rgba(60, 25, 25, 0.9)');
    }

    this._drawShield(ctx, -shieldW * 0.5, 0, shieldW, shieldH);
    ctx.fillStyle = shieldGrd;
    ctx.fill();
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ---- 盾牌内部小心形 ----
    const heartSize = radius * 0.45;
    ctx.save();
    ctx.globalAlpha = isUnderAttack ? 0.5 : 0.6;
    ctx.fillStyle = isUnderAttack ? 'rgba(255, 120, 100, 0.7)' : 'rgba(255, 150, 130, 0.6)';
    this._drawHeart(ctx, 0, -radius * 0.05, heartSize);
    ctx.fill();
    ctx.restore();

    // ---- 盾牌中心小房子图标 ----
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = isUnderAttack ? '#ff9988' : '#ffccaa';
    const houseSize = radius * 0.3;
    this._drawHouse(ctx, 0, radius * 0.05, houseSize);
    ctx.fill();
    ctx.restore();

    // ---- HP弧形指示器 ----
    const arcRadius = radius * 1.1;
    const arcStart = -Math.PI * 0.75;
    const arcEnd = arcStart + Math.PI * 1.5 * hpRatio;

    // 底弧（淡色）
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#886655';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, arcRadius, arcStart, arcStart + Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();

    // HP弧
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = hpRatio > 0.5 ? '#88cc88' : hpRatio > 0.25 ? '#ddaa66' : '#ff6655';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, arcRadius, arcStart, arcEnd);
    ctx.stroke();
    ctx.restore();

    // ---- 脉冲光环（暖珊瑚色）----
    const pulsePhase = (time * 1.5) % 2;
    if (pulsePhase < 1.5) {
      const pulseRadius = radius * (1 + pulsePhase * 0.5);
      const pulseAlpha = (1 - pulsePhase / 1.5) * 0.35;
      ctx.strokeStyle = `${baseGlow}${pulseAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ---- 中心核心亮点 ----
    const coreAlpha = 0.7 + Math.sin(time * 2) * 0.2;
    ctx.fillStyle = isUnderAttack
      ? `rgba(255,120,100,${coreAlpha})`
      : `rgba(255,170,130,${coreAlpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 高光点
    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(time * 2.5) * 0.15;
    ctx.fillStyle = 'rgba(255, 240, 220, 0.85)';
    ctx.beginPath();
    ctx.arc(-radius * 0.04, -radius * 0.04, radius * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}
