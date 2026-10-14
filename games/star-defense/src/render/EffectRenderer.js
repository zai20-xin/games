// ================================================================
// 特效渲染 - 粒子、视觉特效（暖色Q萌科幻风格）
// 升级：Bloom辉光后处理（离屏Canvas）、多类型粒子（拖尾/螺旋/碎片/火花）、
//       击中火花、塔充能、敌人死亡爆炸、屏幕闪光
// ================================================================
import { AbilityRenderer } from './AbilityRenderer.js';
import { getPixelSprite } from '../data/PixelSprites.js';

/** 颜色工具：把 #rrggbb 转成 rgba 字符串 */
function hexToAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 解析颜色为 [r,g,b] 数组
 * @param {string} color - #rrggbb 或 rgb()/rgba() 或 已解析的颜色字符串
 * @returns {[number,number,number]}
 */
function parseColorRGB(color) {
  if (!color) return [255, 255, 255];
  if (color.startsWith('#')) {
    const h = color.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }
  // rgb(r,g,b) 或 rgba(r,g,b,a)
  const m = color.match(/\d+/g);
  if (m && m.length >= 3) {
    return [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])];
  }
  return [255, 255, 255];
}

export class EffectRenderer {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    /** 默认格子大小（由Renderer设置） */
    this.cellSize = 56;
    /** 低质量模式：减少特效装饰层、关闭部分 glow */
    this.lowQuality = !!options.lowQuality;
    /** Agent A8 P2-4: 大招全屏 FX 状态 */
    this._activeAbilityFx = null;

    // === 升级：Bloom 辉光后处理 ===
    /** 辉光强度 0~1（低质量模式自动降低） */
    this.bloomIntensity = this.lowQuality ? 0.3 : 0.7;
    /** Bloom 离屏 Canvas（延迟初始化，需要知道画布尺寸） */
    this._bloomCanvas = null;
    this._bloomCtx = null;
    this._bloomCanvasH = null; // 水平模糊临时 canvas
    this._bloomCtxH = null;
    this._bloomWidth = 0;
    this._bloomHeight = 0;
    /** Bloom 阈值（亮度高于此值的像素才会产生辉光，0~255） */
    this._bloomThreshold = 170;

    // 订阅能力 FX 事件
    const eventBus = options.eventBus;
    if (eventBus && typeof eventBus.on === 'function') {
      eventBus.on('ability:fx', (data) => {
        if (!data) return;
        this._activeAbilityFx = {
          id: data.id,
          progress: data.progress,
          duration: data.duration,
        };
      });
      eventBus.on('ability:fxEnd', () => {
        this._activeAbilityFx = null;
      });
    }
  }

  /**
   * 设置格子大小
   */
  setCellSize(size) {
    this.cellSize = size;
  }

  /**
   * 初始化/调整 Bloom 离屏 Canvas 尺寸
   * 主 Canvas 尺寸变化时调用（由 Renderer 在 resize 时触发）
   * @param {number} w - 逻辑宽度（CSS 像素，不含 DPR）
   * @param {number} h - 逻辑高度
   * @param {number} [dpr=1] - 设备像素比
   */
  resizeBloom(w, h, dpr = 1) {
    // 使用半分辨率渲染 bloom 以提升性能
    const bw = Math.max(1, Math.floor(w * dpr * 0.5));
    const bh = Math.max(1, Math.floor(h * dpr * 0.5));
    if (this._bloomWidth === bw && this._bloomHeight === bh && this._bloomCanvas) return;
    this._bloomWidth = bw;
    this._bloomHeight = bh;

    if (!this._bloomCanvas) {
      this._bloomCanvas = document.createElement('canvas');
      this._bloomCtx = this._bloomCanvas.getContext('2d');
      this._bloomCanvasH = document.createElement('canvas');
      this._bloomCtxH = this._bloomCanvasH.getContext('2d');
    }
    this._bloomCanvas.width = bw;
    this._bloomCanvas.height = bh;
    this._bloomCanvasH.width = bw;
    this._bloomCanvasH.height = bh;
  }

  /**
   * 渲染所有特效和粒子（Bloom 后处理流程）
   * @param {number} time - 当前时间
   * @param {Array} effects - 特效数组
   * @param {Array} particles - 粒子数组
   * @param {Object} [screenFlash] - 屏幕闪光状态 {alpha, color}
   */
  render(time, effects, particles, screenFlash = null) {
    const ctx = this.ctx;
    const useBloom = !this.lowQuality && this._bloomCanvas && this.bloomIntensity > 0;

    // === 第一步：在 Bloom 离屏 Canvas 上绘制高亮粒子/特效（辉光层） ===
    if (useBloom) {
      const bctx = this._bloomCtx;
      bctx.save();
      // 缩放到半分辨率
      bctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
      bctx.clearRect(0, 0, this._bloomWidth * 2, this._bloomHeight * 2);
      // 绘制亮粒子到 bloom 层（这些会被模糊后叠加产生辉光）
      this._drawBloomLayer(time, effects, particles);
      bctx.restore();

      // === 第二步：对 bloom 层进行阈值提取 + 双向高斯模糊 ===
      this._applyBloomThreshold();
      this._blurBloom(2); // 2 次模糊迭代
    }

    // === 第三步：正常绘制所有特效和粒子到主 Canvas ===
    this._drawEffects(time, effects);
    this._drawParticles(particles);

    // === 第四步：叠加 Bloom 辉光层到主 Canvas ===
    if (useBloom) {
      this._compositeBloom();
    }

    // === 第五步：屏幕闪光（最上层叠加） ===
    if (screenFlash && screenFlash.alpha > 0) {
      this._drawScreenFlash(screenFlash);
    }

    // === 大招全屏 FX（绘制在所有特效之上） ===
    this._drawAbilityFx(time);
  }

  /**
   * 在 Bloom 层绘制发光元素（仅高亮部分）
   */
  _drawBloomLayer(time, effects, particles) {
    const bctx = this._bloomCtx;
    // 发光特效
    effects.forEach(e => {
      const progress = 1 - e.timer / e.maxTimer;
      switch (e.type) {
        case 'flash':
        case 'hitSpark': {
          const r = (e.size || 20) * (0.5 + progress * 0.8);
          const alpha = (1 - progress) * 0.8;
          bctx.save();
          bctx.globalAlpha = alpha;
          bctx.fillStyle = e.color || '#fff5e6';
          bctx.beginPath();
          bctx.arc(e.x, e.y, r * 1.2, 0, Math.PI * 2);
          bctx.fill();
          // 白色核心
          bctx.fillStyle = '#ffffff';
          bctx.globalAlpha = alpha * 0.7;
          bctx.beginPath();
          bctx.arc(e.x, e.y, r * 0.4, 0, Math.PI * 2);
          bctx.fill();
          bctx.restore();
          break;
        }
        case 'deathExplosion': {
          const p = progress;
          const r = e.radius * (0.3 + p * 1.5);
          const alpha = (1 - p) * 0.9;
          bctx.save();
          bctx.globalAlpha = alpha;
          bctx.fillStyle = e.glowColor || e.edgeColor || '#ffcc66';
          bctx.beginPath();
          bctx.arc(e.x, e.y, r * 1.3, 0, Math.PI * 2);
          bctx.fill();
          bctx.fillStyle = '#ffffff';
          bctx.globalAlpha = alpha * 0.5;
          bctx.beginPath();
          bctx.arc(e.x, e.y, r * 0.5, 0, Math.PI * 2);
          bctx.fill();
          bctx.restore();
          break;
        }
        case 'towerCharge': {
          const p = e.chargeProgress || progress;
          // 充能环发光（脉冲增强）
          const pulse = 0.7 + Math.sin(time * 0.02) * 0.3;
          const r = this.cellSize * 0.4 * (0.6 + p * 0.6);
          bctx.save();
          bctx.globalAlpha = (0.3 + p * 0.7) * pulse;
          bctx.fillStyle = e.color || '#ffcc44';
          bctx.beginPath();
          bctx.arc(e.x, e.y, r * 1.5, 0, Math.PI * 2);
          bctx.fill();
          bctx.restore();
          break;
        }
        case 'shockwave': {
          const swProgress = 1 - e.life / e.maxLife;
          const swRadius = e.radius + (e.maxRadius - e.radius) * swProgress;
          bctx.save();
          bctx.globalAlpha = (1 - swProgress) * 0.5;
          bctx.strokeStyle = e.color || '#ff8866';
          bctx.lineWidth = 10;
          bctx.beginPath();
          bctx.arc(e.x, e.y, swRadius, 0, Math.PI * 2);
          bctx.stroke();
          bctx.restore();
          break;
        }
      }
    });

    // 发光粒子
    particles.forEach(p => {
      if (!p.glowSize || p.glowSize <= 0) return;
      const alpha = Math.max(0, p.life / p.maxLife);
      const size = p.size * p.glowSize * (0.5 + alpha * 0.5);
      const color = p.currentColor || p.color;
      bctx.save();
      bctx.globalAlpha = alpha * 0.6;
      bctx.fillStyle = color;
      bctx.beginPath();
      bctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    });
  }

  /**
   * 提取亮度高于阈值的像素（bloom 高亮提取）
   */
  _applyBloomThreshold() {
    const ctx = this._bloomCtx;
    const w = this._bloomWidth;
    const h = this._bloomHeight;
    if (w < 2 || h < 2) return;
    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const threshold = this._bloomThreshold;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // 亮度公式（感知亮度）
        const brightness = r * 0.299 + g * 0.587 + b * 0.114;
        if (brightness < threshold) {
          // 低于阈值：变暗（保留少量，使柔和过渡）
          const factor = Math.max(0, (brightness / threshold) - 0.3) * 0.5;
          data[i] = r * factor;
          data[i + 1] = g * factor;
          data[i + 2] = b * factor;
          data[i + 3] = data[i + 3] * factor;
        }
        // 高于阈值：保持原色（会被模糊后增亮）
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      // getImageData 在跨域 tainted canvas 时可能失败，静默降级
    }
  }

  /**
   * 对 bloom canvas 执行近似高斯模糊（水平+垂直方向盒子模糊迭代）
   * @param {number} iterations - 模糊迭代次数（1~3）
   */
  _blurBloom(iterations = 2) {
    const src = this._bloomCanvas;
    const dst = this._bloomCanvasH;
    const sctx = this._bloomCtx;
    const dctx = this._bloomCtxH;
    const w = this._bloomWidth;
    const h = this._bloomHeight;

    for (let iter = 0; iter < iterations; iter++) {
      // 水平模糊：src -> dst
      dctx.clearRect(0, 0, w, h);
      // 使用多次 drawImage + offset 近似盒子模糊（性能远优于逐像素卷积）
      const radius = iter === 0 ? 3 : 5;
      dctx.globalAlpha = 1;
      for (let i = -radius; i <= radius; i++) {
        dctx.globalAlpha = 1 / (radius * 2 + 1);
        dctx.drawImage(src, i, 0);
      }
      dctx.globalAlpha = 1;

      // 垂直模糊：dst -> src
      sctx.clearRect(0, 0, w, h);
      for (let i = -radius; i <= radius; i++) {
        sctx.globalAlpha = 1 / (radius * 2 + 1);
        sctx.drawImage(dst, 0, i);
      }
      sctx.globalAlpha = 1;
    }
  }

  /**
   * 将 Bloom 辉光层叠加到主 Canvas（使用 Screen 混合模式产生自然辉光）
   */
  _compositeBloom() {
    const ctx = this.ctx;
    ctx.save();
    // 获取主 canvas 的 dpr
    let dpr = 1;
    try {
      const m = ctx.getTransform();
      if (m && typeof m.a === 'number' && m.a > 0) dpr = m.a;
    } catch (e) { dpr = 1; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = this.bloomIntensity;
    ctx.imageSmoothingEnabled = true;
    // bloom canvas 是半分辨率，drawImage 时拉伸到全尺寸
    const cw = ctx.canvas.width / dpr;
    const ch = ctx.canvas.height / dpr;
    ctx.drawImage(this._bloomCanvas, 0, 0, cw, ch);
    ctx.restore();
  }

  /**
   * 绘制屏幕闪光（全屏叠加半透明色块）
   */
  _drawScreenFlash(flash) {
    const ctx = this.ctx;
    let dpr = 1;
    try {
      const m = ctx.getTransform();
      if (m && typeof m.a === 'number' && m.a > 0) dpr = m.a;
    } catch (e) { dpr = 1; }
    const cw = ctx.canvas.width / dpr;
    const ch = ctx.canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 径向渐变：中心最亮，边缘自然暗下去
    const grd = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    grd.addColorStop(0, hexToAlpha(flash.color, flash.alpha * 0.8));
    grd.addColorStop(0.5, hexToAlpha(flash.color, flash.alpha * 0.4));
    grd.addColorStop(1, hexToAlpha(flash.color, 0));
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }

  /**
   * 绘制视觉特效
   */
  _drawEffects(time, effects) {
    const ctx = this.ctx;

    effects.forEach(e => {
      const progress = 1 - e.timer / e.maxTimer;

      switch (e.type) {
        case 'laser':
          // 外层发光（用多层半透明线条代替shadowBlur）— 暖珊瑚色
          ctx.strokeStyle = '#ff8866';
          ctx.lineWidth = 6 * (1 - progress);
          ctx.globalAlpha = 0.15 * (1 - progress);
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          ctx.lineWidth = 4 * (1 - progress);
          ctx.globalAlpha = 0.3 * (1 - progress);
          ctx.stroke();
          // 主线条
          ctx.globalAlpha = 1;
          ctx.lineWidth = 3 * (1 - progress);
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          // 暖白色核心
          ctx.strokeStyle = '#fff0e6';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          break;

        case 'tesla':
          if (e.points && e.points.length > 1) {
            for (let i = 0; i < e.points.length - 1; i++) {
              const p1 = e.points[i];
              const p2 = e.points[i + 1];
              // 外层发光（多层半透明线条代替shadowBlur）— 暖桃色
              ctx.strokeStyle = '#ffcc88';
              ctx.lineWidth = 5 * (1 - progress);
              ctx.globalAlpha = 0.12 * (1 - progress);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
              ctx.lineWidth = 3 * (1 - progress);
              ctx.globalAlpha = 0.25 * (1 - progress);
              ctx.stroke();
              // 主线条
              ctx.globalAlpha = 1;
              ctx.lineWidth = 2 * (1 - progress);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              const segments = 6;
              for (let j = 1; j <= segments; j++) {
                const t2 = j / segments;
                const mx = p1.x + (p2.x - p1.x) * t2;
                const my = p1.y + (p2.y - p1.y) * t2;
                const offset = (Math.random() - 0.5) * 15 * (1 - progress);
                const nx = -(p2.y - p1.y);
                const ny = (p2.x - p1.x);
                const len = Math.sqrt(nx * nx + ny * ny) || 1;
                ctx.lineTo(mx + (nx / len) * offset, my + (ny / len) * offset);
              }
              ctx.stroke();
              // 暖橙色电弧核心
              ctx.strokeStyle = '#ffddaa';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
          break;

        case 'cryoBeam':
          // 外层发光（多层半透明线条代替shadowBlur）— 暖调柔青
          ctx.strokeStyle = '#99ddee';
          ctx.lineWidth = 7 * (1 - progress);
          ctx.globalAlpha = 0.1 * (1 - progress);
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          ctx.lineWidth = 5 * (1 - progress);
          ctx.globalAlpha = 0.2 * (1 - progress);
          ctx.stroke();
          // 主线条
          ctx.globalAlpha = 1;
          ctx.lineWidth = 3 * (1 - progress);
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          // 暖调霜色核心
          ctx.strokeStyle = '#cceedd';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          break;

        case 'plasmaBeam':
          // 等离子束：暖玫瑰色宽光束 + 暖白核心
          ctx.strokeStyle = '#ff99aa';
          ctx.lineWidth = 8 * (1 - progress);
          ctx.globalAlpha = 0.1 * (1 - progress);
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          ctx.lineWidth = 6 * (1 - progress);
          ctx.globalAlpha = 0.2 * (1 - progress);
          ctx.stroke();
          // 主线条
          ctx.globalAlpha = 1;
          ctx.lineWidth = 4 * (1 - progress);
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          ctx.strokeStyle = '#ffbbcc';
          ctx.lineWidth = 2 * (1 - progress);
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          // 暖白色核心
          ctx.strokeStyle = '#fff0e6';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          break;

        case 'explosion':
          // 暖化爆炸效果
          ctx.strokeStyle = '#ff9966';
          ctx.lineWidth = 3 * (1 - progress);
          ctx.globalAlpha = 1 - progress;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius * progress, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = `rgba(255,153,85,${0.15 * (1 - progress)})`;
          ctx.fill();
          ctx.globalAlpha = 1;
          break;

        case 'shockwave': {
          // 冲击波环效果 — 暖珊瑚色
          const swProgress = 1 - e.life / e.maxLife;
          const swRadius = e.radius + (e.maxRadius - e.radius) * swProgress;
          const swAlpha = (1 - swProgress) * 0.7;
          const isBig = e.maxRadius > 60;
          const baseColor = e.color || '#ff8866';
          ctx.save();
          // 外层大光晕
          ctx.strokeStyle = hexToAlpha(baseColor, swAlpha * 0.25);
          ctx.lineWidth = isBig ? 14 : 8;
          ctx.beginPath();
          ctx.arc(e.x, e.y, swRadius, 0, Math.PI * 2);
          ctx.stroke();
          // 中层
          ctx.strokeStyle = hexToAlpha(baseColor, swAlpha * 0.5);
          ctx.lineWidth = isBig ? 6 : 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, swRadius, 0, Math.PI * 2);
          ctx.stroke();
          // 内层亮线
          ctx.strokeStyle = hexToAlpha('#fff5e8', swAlpha);
          ctx.lineWidth = isBig ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.arc(e.x, e.y, swRadius, 0, Math.PI * 2);
          ctx.stroke();
          // 大型冲击波：附加第二道内环
          if (isBig) {
            ctx.strokeStyle = hexToAlpha(baseColor, swAlpha * 0.4);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(e.x, e.y, swRadius * 0.7, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          break;
        }

        case 'place': {
          // 放置效果：彩色光柱下射 + 扩散环 + 8 个上升能量点
          const color = e.color || '#ffcc88';

          // 1) 下射光柱
          const colH = this.cellSize * 1.2;
          const colW = 8 * (1 - progress);
          const colGrd = ctx.createLinearGradient(e.x, e.y - colH / 2, e.x, e.y + colH / 2);
          colGrd.addColorStop(0, 'rgba(255, 240, 200, 0)');
          colGrd.addColorStop(0.5, hexToAlpha(color, 0.55 * (1 - progress)));
          colGrd.addColorStop(1, 'rgba(255, 240, 200, 0)');
          ctx.fillStyle = colGrd;
          ctx.globalAlpha = 1 - progress * 0.5;
          ctx.fillRect(e.x - colW / 2, e.y - colH / 2, colW, colH);

          // 2) 扩散环
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 1 - progress;
          ctx.beginPath();
          ctx.arc(e.x, e.y, this.cellSize * 0.45 * (1 + progress * 0.7), 0, Math.PI * 2);
          ctx.stroke();

          // 3) 8 个上升能量点
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i + progress * Math.PI;
            const px = e.x + Math.cos(angle) * this.cellSize * 0.35;
            const py = e.y + Math.sin(angle) * this.cellSize * 0.35 - progress * 20;
            const size = 2 + (1 - progress) * 1.2;
            ctx.fillStyle = color;
            ctx.globalAlpha = (1 - progress) * 0.85;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.globalAlpha = 1;
          break;
        }

        case 'upgrade': {
          // 升级效果：金色光柱 + 多层扩散环 + 上升金点带
          const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, this.cellSize * 1.8);
          grd.addColorStop(0, `rgba(255, 215, 100, ${0.5 * (1 - progress)})`);
          grd.addColorStop(0.4, `rgba(255, 180, 80, ${0.25 * (1 - progress)})`);
          grd.addColorStop(1, 'rgba(255, 180, 80, 0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(e.x, e.y, this.cellSize * 1.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffcc55';
          ctx.lineWidth = 3;
          ctx.globalAlpha = 1 - progress;
          ctx.beginPath();
          ctx.arc(e.x, e.y, this.cellSize * 0.5 * (1 + progress * 1.2), 0, Math.PI * 2);
          ctx.stroke();

          if (progress > 0.2) {
            const p2 = (progress - 0.2) / 0.8;
            ctx.strokeStyle = '#ffdd88';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1 - p2;
            ctx.beginPath();
            ctx.arc(e.x, e.y, this.cellSize * 0.3 * (1 + p2 * 1.6), 0, Math.PI * 2);
            ctx.stroke();
          }

          const dotCount = 8;
          for (let i = 0; i < dotCount; i++) {
            const angle = (Math.PI * 2 / dotCount) * i + progress * Math.PI;
            const px = e.x + Math.cos(angle) * this.cellSize * 0.4;
            const py = e.y + Math.sin(angle) * this.cellSize * 0.4 - progress * 28;
            const size = 2 + (1 - progress) * 1.5;
            ctx.fillStyle = '#ffdd66';
            ctx.globalAlpha = (1 - progress) * 0.9;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
          }

          const colW = 6 + (1 - progress) * 6;
          const colH = this.cellSize * 2.2 * (1 - progress * 0.5);
          const colGrd = ctx.createLinearGradient(e.x, e.y - colH / 2, e.x, e.y + colH / 2);
          colGrd.addColorStop(0, 'rgba(255, 240, 180, 0)');
          colGrd.addColorStop(0.5, `rgba(255, 220, 120, ${0.6 * (1 - progress)})`);
          colGrd.addColorStop(1, 'rgba(255, 240, 180, 0)');
          ctx.fillStyle = colGrd;
          ctx.globalAlpha = (1 - progress);
          ctx.fillRect(e.x - colW / 2, e.y - colH / 2, colW, colH);

          ctx.globalAlpha = 1;
          break;
        }

        case 'energyGain':
          ctx.fillStyle = '#ffcc55';
          ctx.globalAlpha = 1 - progress;
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`+${e.value || 3} ★`, e.x, e.y - 20 * progress);
          ctx.globalAlpha = 1;
          break;

        case 'sellText':
          ctx.fillStyle = '#ffcc55';
          ctx.globalAlpha = 1 - progress;
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`+${e.value} ★`, e.x, e.y - 30 * progress);
          ctx.globalAlpha = 1;
          break;

        case 'interestText':
          ctx.fillStyle = '#99cc66';
          ctx.globalAlpha = Math.min(1, (1 - progress) * 2);
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          ctx.globalAlpha = Math.min(1, (1 - progress) * 2) * 0.2;
          ctx.fillText(`利息 +${e.value} ★`, e.x + 1, e.y - 30 * progress + 1);
          ctx.globalAlpha = Math.min(1, (1 - progress) * 2);
          ctx.fillText(`利息 +${e.value} ★`, e.x, e.y - 30 * progress);
          ctx.globalAlpha = 1;
          break;

        case 'damageNumber': {
          const isBig = !!e.big;
          const isMega = e.mega || (!isBig && e.value >= 100);

          const t = progress;
          let scale;
          if (isMega) {
            if (t < 0.18) {
              const k = t / 0.18;
              scale = 2.0 * (1 - Math.pow(1 - k, 2.5));
            } else if (t < 0.32) {
              const k = (t - 0.18) / 0.14;
              scale = 2.0 - 0.7 * k;
            } else if (t < 0.45) {
              const k = (t - 0.32) / 0.13;
              scale = 1.3 - 0.3 * (1 - Math.pow(1 - k, 3));
            } else {
              scale = 1.0;
            }
          } else if (isBig) {
            if (t < 0.22) {
              const k = t / 0.22;
              scale = 1.7 * (1 - Math.pow(1 - k, 2.2));
            } else if (t < 0.36) {
              const k = (t - 0.22) / 0.14;
              scale = 1.7 - 0.6 * (1 - Math.pow(k, 0.6));
            } else {
              scale = 1.0;
            }
          } else {
            if (t < 0.22) {
              const k = t / 0.22;
              scale = 1.4 * (1 - Math.pow(1 - k, 2.4));
            } else {
              scale = 1.0;
            }
          }

          let rotation = 0;
          if (isMega && t < 0.3) {
            rotation = (1 - t / 0.3) * (Math.random() < 0.5 ? 0.06 : -0.06);
          }
          if (isBig && t < 0.2) {
            rotation = (1 - t / 0.2) * (Math.random() < 0.5 ? 0.03 : -0.03);
          }

          const floatY = 32 * progress;
          const actualFloatY = isMega ? 44 * progress : floatY;

          const baseFont = isMega ? 26 : (isBig ? 21 : 15);
          const fontSize = baseFont * scale;

          let mainColor, edgeColor, lightColor, burstColor, ringColor;
          if (e.color) {
            mainColor = e.color;
            edgeColor = '#ff4422';
            lightColor = '#fff8e8';
            burstColor = e.color;
            ringColor = e.color;
          } else if (isMega) {
            mainColor = '#ffe699';
            edgeColor = '#ff5533';
            lightColor = '#ffffff';
            burstColor = '#ffd966';
            ringColor = '#ffaa44';
          } else if (isBig) {
            mainColor = '#ffdd44';
            edgeColor = '#ff7733';
            lightColor = '#fff8e8';
            burstColor = '#ffaa44';
            ringColor = '#ffdd66';
          } else {
            mainColor = '#ffefd0';
            edgeColor = '#cc7744';
            lightColor = '#ffffff';
            burstColor = null;
            ringColor = null;
          }

          const alpha = t < 0.12
            ? (t / 0.12)
            : (1 - (t - 0.12) / 0.88) * 0.95 + 0.05;

          ctx.save();
          ctx.translate(e.x, e.y - actualFloatY);
          if (rotation) ctx.rotate(rotation);

          if (burstColor) {
            const burstAlpha = t < 0.35 ? 1 : (1 - (t - 0.35) / 0.65);
            ctx.save();
            ctx.globalAlpha = alpha * burstAlpha * 0.9;
            ctx.fillStyle = burstColor;
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = 2;

            const spikeCount = isMega ? 12 : 8;
            const outerR = isMega ? fontSize * 1.05 : fontSize * 0.85;
            const innerR = isMega ? fontSize * 0.45 : fontSize * 0.4;

            if (isMega) {
              ctx.rotate(t * Math.PI * 2);
            } else {
              ctx.rotate(t * Math.PI * 0.8);
            }

            ctx.beginPath();
            for (let i = 0; i < spikeCount * 2; i++) {
              const r = (i % 2 === 0) ? outerR : innerR;
              const angle = (Math.PI * 2 * i) / (spikeCount * 2);
              const px = Math.cos(angle) * r;
              const py = Math.sin(angle) * r;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha *= 0.5;
            ctx.stroke();
            ctx.restore();
          }

          if (ringColor && t < 0.4) {
            const ringT = t / 0.4;
            const ringR = fontSize * (0.5 + ringT * 1.4);
            ctx.save();
            ctx.globalAlpha = alpha * (1 - ringT) * 0.7;
            ctx.strokeStyle = ringColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          ctx.globalAlpha = alpha;
          ctx.font = `900 ${fontSize}px 'Orbitron', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeStyle = 'rgba(15, 5, 10, 0.95)';
          ctx.lineWidth = isMega ? 6 : (isBig ? 5 : 4);
          ctx.lineJoin = 'round';
          ctx.strokeText(e.value, 0, 0);

          if (isBig || isMega) {
            ctx.fillStyle = mainColor;
            ctx.globalAlpha = alpha * 0.25;
            const g = isMega ? 2.5 : 2;
            for (let i = 0; i < 4; i++) {
              const a = (Math.PI * 2 * i) / 4;
              ctx.fillText(e.value, Math.cos(a) * g, Math.sin(a) * g);
            }
          }

          ctx.globalAlpha = alpha;
          ctx.fillStyle = mainColor;
          ctx.fillText(e.value, 0, 0);

          ctx.globalAlpha = alpha * 0.9;
          ctx.fillStyle = lightColor;
          ctx.font = `900 ${fontSize * (isMega ? 0.6 : 0.5)}px 'Orbitron', sans-serif`;
          ctx.fillText(e.value, 0, -fontSize * 0.16);

          if (isMega && e.value >= 150) {
            ctx.font = `900 ${fontSize * 0.45}px 'Orbitron', sans-serif`;
            ctx.fillStyle = '#ff4422';
            ctx.globalAlpha = alpha;
            ctx.fillText('!!', 0, -fontSize * 0.55);
          }

          ctx.restore();
          break;
        }

        case 'flash': {
          const r = e.size * (0.3 + progress * 0.9);
          const alpha = 1 - progress;
          const baseColor = e.color || '#fff0e6';
          ctx.save();
          const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
          grd.addColorStop(0, hexToAlpha(baseColor, alpha * 0.95));
          grd.addColorStop(0.4, hexToAlpha(baseColor, alpha * 0.55));
          grd.addColorStop(1, hexToAlpha(baseColor, 0));
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(e.x, e.y, r * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();
          break;
        }

        case 'sparkFlash': {
          // 受击瞬间小爆点
          const r = e.size * (0.6 + progress * 0.8);
          const alpha = 1 - progress;
          ctx.save();
          const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
          grd.addColorStop(0, `rgba(255, 248, 232, ${alpha})`);
          grd.addColorStop(0.4, e.color
            ? hexToAlpha(e.color, alpha * 0.7)
            : `rgba(255, 200, 150, ${alpha * 0.7})`);
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = alpha * 0.6;
          ctx.strokeStyle = '#fff8e8';
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          const arm = r * 1.4;
          ctx.beginPath();
          ctx.moveTo(e.x - arm, e.y);
          ctx.lineTo(e.x + arm, e.y);
          ctx.moveTo(e.x, e.y - arm);
          ctx.lineTo(e.x, e.y + arm);
          ctx.stroke();
          ctx.restore();
          break;
        }

        // === 新增：击中火花特效（增强版，带方向星芒） ===
        case 'hitSpark': {
          const r = (e.size || 8) * (0.5 + progress * 0.6);
          const alpha = 1 - progress;
          const baseColor = e.color || '#ffcc88';
          ctx.save();
          // 外层光晕
          const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 1.8);
          grd.addColorStop(0, hexToAlpha('#ffffff', alpha * 0.9));
          grd.addColorStop(0.3, hexToAlpha(baseColor, alpha * 0.7));
          grd.addColorStop(1, hexToAlpha(baseColor, 0));
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(e.x, e.y, r * 1.8, 0, Math.PI * 2);
          ctx.fill();

          // 六芒星/八角星闪光线（Star burst）
          ctx.globalAlpha = alpha * 0.8;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 * (1 - progress);
          ctx.lineCap = 'round';
          const spikes = 6;
          for (let i = 0; i < spikes; i++) {
            const ang = (Math.PI * 2 / spikes) * i + progress * 0.5;
            const innerR = r * 0.3;
            const outerR = r * (1.2 + Math.sin(progress * Math.PI) * 0.4);
            ctx.beginPath();
            ctx.moveTo(e.x + Math.cos(ang) * innerR, e.y + Math.sin(ang) * innerR);
            ctx.lineTo(e.x + Math.cos(ang) * outerR, e.y + Math.sin(ang) * outerR);
            ctx.stroke();
          }

          // 白色核心
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(e.x, e.y, r * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        // === 新增：塔攻击充能特效（光环 + 能量环 + 中心亮点） ===
        case 'towerCharge': {
          const p = e.chargeProgress !== undefined ? e.chargeProgress : progress;
          const color = e.color || '#ffcc44';
          const level = e.chargeLevel || 1;
          const baseR = this.cellSize * 0.35;

          ctx.save();
          // 1) 底部径向光晕（越接近完成越亮）
          const glowR = baseR * (0.8 + p * 0.8);
          const glowGrd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowR * 2);
          glowGrd.addColorStop(0, hexToAlpha(color, 0.4 * p));
          glowGrd.addColorStop(0.5, hexToAlpha(color, 0.15 * p));
          glowGrd.addColorStop(1, hexToAlpha(color, 0));
          ctx.fillStyle = glowGrd;
          ctx.beginPath();
          ctx.arc(e.x, e.y, glowR * 2, 0, Math.PI * 2);
          ctx.fill();

          // 2) 旋转充能环（3 段弧形，速度随充能加快）
          const rotSpeed = 2 + p * 5;
          const ringR = baseR * (0.6 + p * 0.5);
          for (let ring = 0; ring < Math.min(level, 3); ring++) {
            const ringAngle = time * 0.003 * rotSpeed * (ring % 2 === 0 ? 1 : -1) + ring * Math.PI / 3;
            ctx.strokeStyle = hexToAlpha(color, 0.3 + p * 0.5);
            ctx.lineWidth = 2 + level * 0.5;
            ctx.lineCap = 'round';
            // 3 段弧
            for (let a = 0; a < 3; a++) {
              const startA = ringAngle + (Math.PI * 2 / 3) * a;
              const arcLen = 0.4 + p * 0.3;
              ctx.beginPath();
              ctx.arc(e.x, e.y, ringR + ring * 5, startA, startA + arcLen);
              ctx.stroke();
            }
          }

          // 3) 收缩光环（从外向内聚拢）
          const shrinkR = baseR * (1.2 - p * 0.9);
          ctx.strokeStyle = hexToAlpha(color, (1 - p) * 0.7);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(e.x, e.y, shrinkR, 0, Math.PI * 2);
          ctx.stroke();

          // 4) 中心能量点（脉动）
          const pulse = 0.8 + Math.sin(time * 0.015) * 0.2;
          ctx.fillStyle = hexToAlpha('#ffffff', p * pulse);
          ctx.beginPath();
          ctx.arc(e.x, e.y, 4 + p * 6, 0, Math.PI * 2);
          ctx.fill();

          // 5) 指向目标的能量线（如果有目标位置）
          if (e.targetX !== undefined && e.targetY !== undefined && p > 0.3) {
            const tx = e.targetX;
            const ty = e.targetY;
            ctx.strokeStyle = hexToAlpha(color, (p - 0.3) * 1.2);
            ctx.lineWidth = 1.5 * p;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -time * 0.1;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.restore();
          break;
        }

        // === 新增：敌人死亡爆炸特效（多层光环 + 火焰） ===
        case 'deathExplosion': {
          const p = progress;
          const coreColor = e.coreColor || '#ff9944';
          const edgeColor = e.edgeColor || '#ffcc66';
          const glowColor = e.glowColor || '#ffdd88';
          const baseR = e.radius || 20;
          const isBoss = !!e.isBoss;

          ctx.save();
          // 1) 最外层火焰光晕
          const outerR = baseR * (0.5 + p * (isBoss ? 2.5 : 1.8));
          const outerGrd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, outerR);
          outerGrd.addColorStop(0, hexToAlpha(glowColor, (1 - p) * 0.5));
          outerGrd.addColorStop(0.5, hexToAlpha(edgeColor, (1 - p) * 0.25));
          outerGrd.addColorStop(1, hexToAlpha(coreColor, 0));
          ctx.fillStyle = outerGrd;
          ctx.beginPath();
          ctx.arc(e.x, e.y, outerR, 0, Math.PI * 2);
          ctx.fill();

          // 2) 中层火球
          const midR = baseR * (0.3 + p * (isBoss ? 1.8 : 1.3));
          const midGrd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, midR);
          midGrd.addColorStop(0, hexToAlpha('#ffffff', (1 - p) * 0.9));
          midGrd.addColorStop(0.3, hexToAlpha(glowColor, (1 - p) * 0.8));
          midGrd.addColorStop(0.7, hexToAlpha(edgeColor, (1 - p) * 0.5));
          midGrd.addColorStop(1, hexToAlpha(coreColor, 0));
          ctx.fillStyle = midGrd;
          ctx.beginPath();
          ctx.arc(e.x, e.y, midR, 0, Math.PI * 2);
          ctx.fill();

          // 3) 不规则火焰边缘（锯齿圆环，模拟火焰撕裂）
          if (p < 0.7) {
            const flameR = baseR * (0.4 + p * (isBoss ? 2 : 1.4));
            ctx.strokeStyle = hexToAlpha(edgeColor, (1 - p) * 0.6);
            ctx.lineWidth = isBoss ? 4 : 2.5;
            ctx.lineCap = 'round';
            const flamePoints = isBoss ? 16 : 12;
            ctx.beginPath();
            for (let i = 0; i <= flamePoints; i++) {
              const ang = (Math.PI * 2 / flamePoints) * i;
              const noise = 0.7 + Math.sin(ang * 5 + p * 10) * 0.3;
              const fr = flameR * noise;
              const px = e.x + Math.cos(ang) * fr;
              const py = e.y + Math.sin(ang) * fr;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.stroke();
          }

          // 4) 白色核心（仅前段可见）
          if (p < 0.4) {
            const coreR = baseR * (0.2 + p * 0.5);
            ctx.fillStyle = hexToAlpha('#ffffff', (1 - p / 0.4) * 0.9);
            ctx.beginPath();
            ctx.arc(e.x, e.y, coreR, 0, Math.PI * 2);
            ctx.fill();
          }

          // 5) Boss 额外：多道放射光条
          if (isBoss && p < 0.6) {
            const rayAlpha = (1 - p / 0.6) * 0.7;
            ctx.strokeStyle = hexToAlpha(glowColor, rayAlpha);
            ctx.lineWidth = 3;
            const rays = 8;
            for (let i = 0; i < rays; i++) {
              const ang = (Math.PI * 2 / rays) * i + p * 2;
              const innerRay = baseR * 0.3;
              const outerRay = baseR * (1 + p * 3);
              ctx.beginPath();
              ctx.moveTo(e.x + Math.cos(ang) * innerRay, e.y + Math.sin(ang) * innerRay);
              ctx.lineTo(e.x + Math.cos(ang) * outerRay, e.y + Math.sin(ang) * outerRay);
              ctx.stroke();
            }
          }
          ctx.restore();
          break;
        }

        // === FreeGameSprites 真实 CC0 雷电 PNG ===
        case 'pixelBolt': {
          const sprite = getPixelSprite('lightningBolt');
          if (!sprite) break;
          const frame = sprite.frames[0];

          const aspect = sprite.height / sprite.width;
          const baseW = this.cellSize * 0.55 * (e.scale || 1.0);
          const baseH = baseW * aspect;

          let scale, alpha;
          if (progress < 0.3) {
            const t = progress / 0.3;
            scale = 0.4 + (1.05 - 0.4) * (1 - Math.pow(1 - t, 3));
            alpha = t;
          } else if (progress < 0.7) {
            scale = 1.0 + Math.sin(progress * Math.PI * 8) * 0.06;
            alpha = 1.0;
          } else {
            const t = (progress - 0.7) / 0.3;
            scale = 1.0 + t * 0.25;
            alpha = 1 - t;
          }

          const drawW = baseW * scale;
          const drawH = baseH * scale;
          const alphaBoost = e.isMain ? 1.0 : 0.85;

          ctx.save();
          ctx.globalAlpha = alpha * alphaBoost;
          ctx.imageSmoothingEnabled = false;
          const rot = progress >= 0.3 && progress < 0.7
            ? Math.sin(progress * Math.PI * 16) * 0.08
            : 0;
          ctx.translate(e.x, e.y);
          if (rot !== 0) ctx.rotate(rot);
          ctx.drawImage(frame, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.imageSmoothingEnabled = true;
          ctx.restore();
          break;
        }

        case 'pixelSpark': {
          const sprite = getPixelSprite('sparkBurst');
          if (!sprite) break;
          let frameIdx;
          if (progress < 0.33) frameIdx = 0;
          else if (progress < 0.66) frameIdx = 1;
          else frameIdx = 2;
          const frame = sprite.frames[Math.min(frameIdx, sprite.frameCount - 1)];

          const targetSize = this.cellSize * 0.9 * (e.scale || 1.0);
          const burstScale = 0.5 + progress * 0.6;
          const drawSize = targetSize * burstScale;
          const alpha = Math.sin(progress * Math.PI) * 0.9;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(frame, e.x - drawSize / 2, e.y - drawSize / 2, drawSize, drawSize);
          ctx.imageSmoothingEnabled = true;
          ctx.restore();
          break;
        }
      }
    });
  }

  /**
   * 绘制粒子（升级：根据 particleType 分发到不同绘制方法）
   */
  _drawParticles(particles) {
    const ctx = this.ctx;
    particles.forEach(p => {
      const type = p.particleType || 'dot';
      switch (type) {
        case 'shrapnel': this._drawShrapnelParticle(ctx, p); break;
        case 'spark':    this._drawSparkParticle(ctx, p); break;
        case 'trail':    this._drawTrailParticle(ctx, p); break;
        case 'spiral':   this._drawGlowParticle(ctx, p); break; // 螺旋粒子使用发光渲染
        case 'glow':     this._drawGlowParticle(ctx, p); break;
        default:         this._drawDotParticle(ctx, p);
      }
    });
    ctx.globalAlpha = 1;
  }

  /**
   * 基础圆点粒子（原有行为，保持向后兼容）
   */
  _drawDotParticle(ctx, p) {
    const alpha = Math.max(0, p.life / p.maxLife);
    const size = p.size * (0.5 + alpha * 0.5);
    const color = p.currentColor || p.color;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 发光粒子（多层半透明模拟辉光，不使用 shadowBlur）
   */
  _drawGlowParticle(ctx, p) {
    const alpha = Math.max(0, p.life / p.maxLife);
    const size = p.size * (0.5 + alpha * 0.5);
    const color = p.currentColor || p.color;
    const glowMul = p.glowSize || 1.5;
    const [r, g, b] = parseColorRGB(color);

    ctx.save();
    // 外层大光晕（淡）
    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = `rgba(${r},${g},${b},0.2)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * glowMul * 1.8, 0, Math.PI * 2);
    ctx.fill();
    // 中层光晕
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * glowMul, 0, Math.PI * 2);
    ctx.fill();
    // 核心
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
    // 白色高光核心
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 火花粒子（拉长的椭球，带速度方向感，模拟飞溅火星）
   */
  _drawSparkParticle(ctx, p) {
    const alpha = Math.max(0, p.life / p.maxLife);
    const color = p.currentColor || p.color;
    const [r, g, b] = parseColorRGB(color);
    // 速度方向
    const vLen = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
    const angle = Math.atan2(p.vy, p.vx);
    const size = p.size * (0.4 + alpha * 0.6);
    // 拖尾长度随速度增加
    const tailLen = Math.min(size * 4, vLen * 0.02 + size * 1.5);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    // 外层光晕
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = `rgba(${r},${g},${b},0.4)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, tailLen, size * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 主体
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-tailLen * 0.2, 0, tailLen * 0.8, size, 0, 0, Math.PI * 2);
    ctx.fill();
    // 头部亮点
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tailLen * 0.2, 0, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 拖尾粒子（大尺寸柔光、快速淡出，用于投射物尾迹）
   */
  _drawTrailParticle(ctx, p) {
    const alpha = Math.max(0, p.life / p.maxLife);
    const color = p.currentColor || p.color;
    const [r, g, b] = parseColorRGB(color);
    const size = p.size * (0.3 + alpha * 0.7);

    ctx.save();
    // 大柔光
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
    ctx.fill();
    // 中层
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
    ctx.fill();
    // 核心
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 爆炸碎片粒子（带旋转的几何形状：方块/三角/短线）
   */
  _drawShrapnelParticle(ctx, p) {
    const alpha = Math.max(0, p.life / p.maxLife);
    const color = p.currentColor || p.color;
    const size = p.size * (0.4 + alpha * 0.6);
    const shape = p.shrapnelShape || 0;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation || 0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;

    switch (shape) {
      case 0: // 方块碎片
        ctx.fillRect(-size, -size * 0.7, size * 2, size * 1.4);
        ctx.strokeRect(-size, -size * 0.7, size * 2, size * 1.4);
        // 高光面
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(-size, -size * 0.7, size * 2, size * 0.4);
        break;
      case 1: // 三角碎片
        ctx.beginPath();
        ctx.moveTo(size * 1.2, 0);
        ctx.lineTo(-size * 0.8, -size);
        ctx.lineTo(-size * 0.5, size * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 2: // 短线碎片
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, size * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-size * 1.5, 0);
        ctx.lineTo(size * 1.5, 0);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  // ================================================================
  // Agent A8 P2-4: 大招全屏 FX 渲染
  // ================================================================
  _drawAbilityFx(time) {
    if (!this._activeAbilityFx) return;
    const fx = this._activeAbilityFx;
    if (!fx.id) return;

    const ctx = this.ctx;
    let dpr = 1;
    try {
      const m = ctx.getTransform();
      if (m && typeof m.a === 'number' && m.a > 0) dpr = m.a;
    } catch (e) {
      dpr = 1;
    }
    const w = ctx.canvas.width / dpr;
    const h = ctx.canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try {
      if (AbilityRenderer && typeof AbilityRenderer.draw === 'function') {
        AbilityRenderer.draw(fx.id, ctx, fx.progress, w, h, time);
      }
    } catch (e) {
      console.warn('[EffectRenderer] ability fx failed:', e);
    } finally {
      ctx.restore();
    }
  }
}
