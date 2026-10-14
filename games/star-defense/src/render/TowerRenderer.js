// ================================================================
// 塔渲染 - 复仇者联盟角色风格
// 电影级特效设计
// ================================================================
import { TOWER_LEVEL_MULT } from '../core/Constants.js';

export class TowerRenderer {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    /** 低质量模式：关闭 shadowBlur、跳过次要装饰 */
    this.lowQuality = !!options.lowQuality;
    /** 预渲染 sprite 开关：drawImage 替代每帧重画，显著降低 CPU */
    this.usePrerender = !!options.usePrerender;
    /** 预渲染 sprite 缓存：key = `${typeId}_${level}_${cell}` -> HTMLCanvasElement */
    this._spriteCache = new Map();
    /** 当前关卡 cell（用于在 cell 变化时清理缓存） */
    this._currentCell = -1;
  }

  /**
   * 关卡变化 / cell 变化时清理 sprite 缓存
   */
  clearSpriteCache() {
    this._spriteCache.clear();
    this._currentCell = -1;
  }

  /**
   * 预渲染单个塔 sprite 到离屏 canvas（首次调用时执行，结果永久缓存）
   * 用法：把 this.ctx 临时替换为离屏 ctx，调用原 drawTowerSprite（time=0），
   *      离屏 canvas 包含完整的"基础身体"，后续 drawImage 即可。
   * @returns {HTMLCanvasElement | null}
   */
  _getOrCreateSprite(type, level, cell) {
    const key = `${type.id}_${level}_${cell}`;
    if (this._spriteCache.has(key)) return this._spriteCache.get(key);
    if (typeof document === 'undefined') return null;  // 非浏览器环境

    // cell 变化时清理旧缓存（不同关卡 cell 不同，sprite 不可复用）
    if (this._currentCell !== cell) {
      this._spriteCache.clear();
      this._currentCell = cell;
    }

    // 离屏 canvas：尺寸 = 2*cell（中心点 ± cell 范围，留出浮动元素空间）
    const size = Math.max(64, Math.ceil(cell * 2));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const pctx = canvas.getContext('2d');
    // 把塔中心 (0,0) 映射到离屏画布中心
    pctx.translate(size / 2, size / 2);

    // 临时替换 this.ctx，调用原始绘制流程（time=0 让动画元素归位）
    const oldCtx = this.ctx;
    this.ctx = pctx;
    try {
      // === 复刻 drawTowerSprite 主体（time=0，无 idleBob）===
      pctx.save();
      const platformY = 0 + cell * 0.25;
      const bodyCenterY = 0;
      const headCenterY = 0 - cell * 0.25;
      const platformR = cell * 0.4;
      const bodyW = cell * 0.3;
      const bodyH = cell * 0.5;
      const headR = cell * 0.22;
      const time = 0;
      const idleBob = 0;

      switch(type.id) {
        case 'laser':    this._drawLaserDrStrange(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        case 'tesla':    this._drawTeslaThor(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        case 'missile':  this._drawMissileIronMan(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        case 'cryo':     this._drawCryoElsa(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        case 'gravity':  this._drawGravityHulk(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        case 'shield':   this._drawShieldCaptain(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        case 'collector':this._drawCollectorPanther(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        case 'plasma':   this._drawPlasmaCaptain(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        case 'repair':   this._drawRepairSpider(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        // P4-2：召唤塔 / 诅咒塔
        case 'summoner': this._drawSummonerShaman(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        case 'curser':   this._drawCurserNecro(0, platformY, bodyCenterY, headCenterY, platformR, bodyW, bodyH, headR, type, level, time, idleBob); break;
        default:         this._drawDefaultTower(0, 0, type, cell, time);
      }
      pctx.restore();
    } catch (e) {
      console.warn('[TowerRenderer] prerender failed for', type.id, e);
    } finally {
      this.ctx = oldCtx;
    }

    this._spriteCache.set(key, canvas);
    return canvas;
  }

  /**
   * 渲染一个 sprite 到主 ctx（调用方传 (x, y) 作为塔中心点）
   * 预渲染模式时直接 drawImage，否则回退到原始绘制
   */
  _blitSprite(sprite, x, y, cell) {
    if (!sprite) return false;
    // sprite 是 2*cell × 2*cell 离屏画布，塔中心位于画布中心
    this.ctx.drawImage(sprite, x - cell, y - cell);
    return true;
  }

  render(time, towers, selectedPlacedTower, synergyLinks = []) {
    if (synergyLinks && synergyLinks.length > 0) {
      this._drawSynergyLinks(time, synergyLinks);
    }

    towers.forEach(tower => {
      const cell = tower.cellSize;
      const placeScale = 1 - tower.placeAnim * 0.7;
      const bounceScale = tower.placeAnim > 0.01
        ? placeScale + Math.sin(tower.placeAnim * Math.PI * 3) * 0.1 * tower.placeAnim
        : 1;

      // 元素属性底座发光光环
      this._drawElementBaseGlow(tower, time);

      // P2-11：支援光环
      this._drawAura(tower, time);

      this.ctx.save();
      this.ctx.translate(tower.x, tower.y);
      this.ctx.scale(bounceScale, bounceScale);
      this.ctx.translate(-tower.x, -tower.y);
      this.drawTowerSprite(tower.x, tower.y, tower.type, time, tower.level, cell, tower);
      this.ctx.restore();

      // 护盾效果
      if (tower.shielded) {
        const ctx = this.ctx;
        const shieldPulse = Math.sin(time * 3) * 0.05 + 0.95;
        ctx.strokeStyle = 'rgba(168,204,85,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, cell * 0.4 * shieldPulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(168,204,85,0.08)';
        ctx.fill();
      }

      // 等级星星
      if (tower.level > 0) {
        this._drawLevelStars(tower.x, tower.y, cell, tower.level, time);
      }

      // 选中框
      if (selectedPlacedTower === tower) {
        const ctx = this.ctx;
        ctx.strokeStyle = '#ffcc55';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(tower.x - cell * 0.4, tower.y - cell * 0.4, cell * 0.8, cell * 0.8);
        ctx.setLineDash([]);
      }

      // 蓄力/发射特效（在最上层）
      this._drawAttackEffects(tower, time);
    });
  }

  /**
   * 元素底座发光光环 - 颜色对应塔的元素属性
   */
  _drawElementBaseGlow(tower, time) {
    if (!tower || !tower.type) return;
    const ctx = this.ctx;
    const cell = tower.cellSize;
    const color = tower.type.color || '#ffffff';
    const glowColor = tower.type.glowColor || 'rgba(255,255,255,0.3)';
    const platY = tower.y + cell * 0.25;
    const platR = cell * 0.4;
    const pulse = 0.85 + Math.sin((tower.glowPhase || time * 2)) * 0.15;
    const level = tower.level || 1;
    const glowIntensity = 0.3 + level * 0.1;

    ctx.save();
    // 地面径向光晕
    const grd = ctx.createRadialGradient(tower.x, platY, 0, tower.x, platY, platR * 2.0);
    grd.addColorStop(0, glowColor.replace('0.4', (glowIntensity * pulse).toFixed(2)));
    grd.addColorStop(0.5, glowColor.replace('0.4', (glowIntensity * 0.4 * pulse).toFixed(2)));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(tower.x, platY + cell * 0.02, platR * 1.8, platR * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 光环圆环
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25 * pulse * (1 + level * 0.1);
    ctx.lineWidth = 1 + level * 0.5;
    ctx.beginPath();
    ctx.ellipse(tower.x, platY, platR * 1.1, platR * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3级觉醒：旋转符文环
    if (level >= 3) {
      ctx.globalAlpha = 0.3 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = -time * 30;
      ctx.beginPath();
      ctx.ellipse(tower.x, platY, platR * 1.3, platR * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /**
   * 绘制攻击特效（蓄力光环、发射闪光、后坐力火花）
   */
  _drawAttackEffects(tower, time) {
    if (!tower || tower.attackState === 'idle' || !tower.type) return;
    const ctx = this.ctx;
    const cell = tower.cellSize;
    const color = tower.type.color || '#ffffff';
    const prog = tower.getAttackAnimProgress ? tower.getAttackAnimProgress() : { charge: 0, fire: 0, recoil: 0 };

    ctx.save();

    // 蓄力阶段：聚集光环
    if (tower.attackState === 'charging') {
      const c = prog.charge;
      const chargeR = cell * (0.1 + c * 0.4);
      const alpha = c * 0.7;
      const grd = ctx.createRadialGradient(tower.x, tower.y - cell * 0.2, 0, tower.x, tower.y - cell * 0.2, chargeR);
      grd.addColorStop(0, color);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y - cell * 0.2, chargeR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 发射瞬间：闪光
    if (tower.attackState === 'firing') {
      const f = prog.fire;
      const flashR = cell * (0.3 + f * 0.3);
      const alpha = (1 - f) * 0.8;
      // 白色核心
      ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(tower.x, tower.y - cell * 0.2, flashR * 0.4, 0, Math.PI * 2);
      ctx.fill();
      // 外层颜色闪光
      const grd = ctx.createRadialGradient(tower.x, tower.y - cell * 0.2, 0, tower.x, tower.y - cell * 0.2, flashR);
      grd.addColorStop(0, color);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y - cell * 0.2, flashR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 后坐力阶段：火花粒子
    if (tower.attackState === 'recoiling') {
      const r = prog.recoil;
      const sparkCount = 6;
      for (let i = 0; i < sparkCount; i++) {
        const a = (tower.turretAngle || -Math.PI / 2) + (Math.PI / sparkCount) * (i - sparkCount / 2);
        const dist = cell * (0.2 + r * 0.5);
        const sx = tower.x + Math.cos(a) * dist;
        const sy = tower.y - cell * 0.2 + Math.sin(a) * dist;
        const sr = cell * 0.03 * (1 - r);
        ctx.fillStyle = color;
        ctx.globalAlpha = (1 - r) * 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _drawLevelStars(x, y, cell, level, time) {
    const ctx = this.ctx;
    const starSize = Math.max(5, cell * 0.08);
    const totalWidth = 3 * starSize * 2.2;
    const startX = x - totalWidth / 2 + starSize;
    const starY = y + cell * 0.38;

    for (let i = 0; i < 3; i++) {
      const sx = startX + i * starSize * 2.2;
      const filled = i < level;
      this._drawStar(sx, starY, starSize, filled, filled ? '#ffcc55' : 'rgba(255,204,85,0.25)', time);
    }
  }

  _drawStar(cx, cy, r, filled, color, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    if (filled) {
      const glow = Math.sin(time * 3) * 0.1 + 0.9;
      ctx.globalAlpha = glow;
    }
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerA = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const innerA = outerA + Math.PI / 5;
      ctx.lineTo(Math.cos(outerA) * r, Math.sin(outerA) * r);
      ctx.lineTo(Math.cos(innerA) * r * 0.5, Math.sin(innerA) * r * 0.5);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  _drawGroundGlow(x, y, r, color, time) {
    const ctx = this.ctx;
    const pulse = Math.sin(time * 2) * 0.1 + 0.9;
    ctx.save();
    ctx.globalAlpha = 0.2 * pulse;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r * 1.5);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawCirclePlatform(x, y, r, innerColor, outerColor, alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = innerColor;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outerColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha || 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _drawAuraRing(x, y, r, color, time) {
    const ctx = this.ctx;
    const pulse = Math.sin(time * 3) * 0.1 + 0.9;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.3 * pulse;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ================================================================
  // 通用等级特效辅助方法
  // ================================================================

  /**
   * 绘制精灵光翼（3级特效）
   */
  _drawSpriteWings(ctx, x, y, size, color, time, level) {
    ctx.save();
    const wingFlap = Math.sin(time * 3) * 0.15;
    const wingAlpha = 0.4 + Math.sin(time * 2) * 0.1;
    const wingScale = 1 + (level - 3) * 0.15;

    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(x + side * size * 0.3, y - size * 0.1);
      ctx.rotate(side * (0.3 + wingFlap));
      ctx.scale(side * wingScale, wingScale);

      // 翅膀主体
      const wingGrad = ctx.createLinearGradient(0, 0, size * 0.5, -size * 0.2);
      wingGrad.addColorStop(0, color);
      wingGrad.addColorStop(0.5, color + '88');
      wingGrad.addColorStop(1, color + '00');
      ctx.fillStyle = wingGrad;
      ctx.globalAlpha = wingAlpha;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(size * 0.3, -size * 0.4, size * 0.6, -size * 0.2);
      ctx.quadraticCurveTo(size * 0.4, -size * 0.05, size * 0.2, size * 0.05);
      ctx.closePath();
      ctx.fill();

      // 翅膀脉络光
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(size * 0.5, -size * 0.15);
      ctx.stroke();

      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * 绘制旋转魔法阵（3级特效）
   */
  _drawMagicCircle(ctx, x, y, radius, color, time, runes = 6) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 1.5);

    // 外圈
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5 + Math.sin(time * 3) * 0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 内圈
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // 符文
    for (let i = 0; i < runes; i++) {
      const a = (Math.PI * 2 / runes) * i;
      const rx = Math.cos(a) * radius * 0.85;
      const ry = Math.sin(a) * radius * 0.85;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6 + Math.sin(time * 4 + i) * 0.3;
      ctx.beginPath();
      ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 六芒星/法阵图案
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    if (runes >= 6) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a1 = (Math.PI / 3) * i - Math.PI / 2;
        const a2 = (Math.PI / 3) * (i + 2) - Math.PI / 2;
        ctx.moveTo(Math.cos(a1) * radius * 0.5, Math.sin(a1) * radius * 0.5);
        ctx.lineTo(Math.cos(a2) * radius * 0.5, Math.sin(a2) * radius * 0.5);
      }
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /**
   * 绘制旋转炮塔/炮管基础（支持朝向旋转、后坐力、蓄力发光）
   * @param {number} angle - 朝向角度（弧度）
   * @param {number} len - 炮管长度
   * @param {number} width - 炮管宽度
   * @param {string} color - 炮管颜色
   * @param {number} chargeProg - 蓄力进度 0~1
   * @param {number} recoilProg - 后坐力进度 0~1
   */
  _drawRotatedTurret(ctx, cx, cy, angle, len, width, color, chargeProg = 0, recoilProg = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // 后坐力后退
    const recoil = recoilProg * width * 2;
    ctx.translate(-recoil, 0);

    // 炮管主体
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-width * 0.5, -width * 0.5, len + recoil * 0.5, width, width * 0.3)
                  : ctx.rect(-width * 0.5, -width * 0.5, len + recoil * 0.5, width);
    ctx.fill();

    // 炮口
    ctx.fillStyle = this._darkenColor(color, 0.6);
    ctx.beginPath();
    ctx.arc(len - width * 0.2, 0, width * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 蓄力发光
    if (chargeProg > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 + chargeProg * 15;
      ctx.fillStyle = color;
      ctx.globalAlpha = chargeProg * 0.6;
      ctx.beginPath();
      ctx.arc(len, 0, width * (0.3 + chargeProg * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /** 颜色变暗工具 */
  _darkenColor(color, factor) {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1,3), 16);
      const g = parseInt(color.slice(3,5), 16);
      const b = parseInt(color.slice(5,7), 16);
      return `rgb(${Math.floor(r*factor)},${Math.floor(g*factor)},${Math.floor(b*factor)})`;
    }
    return color;
  }

  /** 等级装饰：头顶宝石/皇冠 */
  _drawLevelCrown(ctx, x, y, size, color, level, time) {
    if (level < 2) return;
    ctx.save();
    const bob = Math.sin(time * 2) * 2;
    ctx.translate(x, y - size * 0.6 + bob);

    if (level >= 3) {
      // 3级：小皇冠
      ctx.fillStyle = '#ffdd44';
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const crownW = size * 0.4;
      const crownH = size * 0.2;
      ctx.moveTo(-crownW, crownH * 0.3);
      ctx.lineTo(-crownW * 0.6, -crownH);
      ctx.lineTo(-crownW * 0.2, crownH * 0.1);
      ctx.lineTo(0, -crownH * 0.8);
      ctx.lineTo(crownW * 0.2, crownH * 0.1);
      ctx.lineTo(crownW * 0.6, -crownH);
      ctx.lineTo(crownW, crownH * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 皇冠宝石
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(0, -crownH * 0.2, size * 0.05, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 2级：小宝石
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ================================================================
  // P2-11：塔的"支援光环"可视化
  // 在 TowerSystem._updateShields() 后调用，每个支援塔会在自己的
  // modifiers 上注入 aura={radius, color, type}，这里据此画圆环。
  // ================================================================
  _drawAura(tower, time) {
    if (!tower) return;
    const aura = tower.modifiers && tower.modifiers.aura;
    if (!aura || !aura.radius) return;
    const ctx = this.ctx;
    ctx.save();
    // 主体径向渐变
    ctx.globalAlpha = 0.15 + Math.sin(performance.now() * 0.003) * 0.05;
    const grad = ctx.createRadialGradient(tower.x, tower.y, 10, tower.x, tower.y, aura.radius);
    grad.addColorStop(0, (aura.color || '#ffffff') + 'cc');
    grad.addColorStop(1, (aura.color || '#ffffff') + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, aura.radius, 0, Math.PI * 2);
    ctx.fill();
    // 描边脉冲
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = aura.color || '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.lineDashOffset = -performance.now() * 0.05;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, aura.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ================================================================
  // P4-8：皮肤调色板解析
  // 返回 { color, glowColor }。若皮肤 key 在 TOWER_SKINS 中存在则返回
  // 皮肤定义，否则用 tower.type 默认色。
  // ================================================================
  _resolveSkinColors(tower) {
    const fallback = { color: tower.type.color, glowColor: tower.type.glowColor };
    const skinId = tower.skin;
    if (!skinId) return fallback;
    // 简单字符串映射（不依赖 TOWER_SKINS，避免循环引用）
    // 颜色写在 renderer 内部，避免改 TOWER_TYPES 的数值结构
    const TOWER_SKIN_PALETTE = {
      laser_default:   { color: '#ff6b6b', glowColor: 'rgba(255,107,107,0.4)' },
      laser_arcane:    { color: '#6688ff', glowColor: 'rgba(102,136,255,0.4)' },
      laser_void:      { color: '#aa44ff', glowColor: 'rgba(170,68,255,0.4)' },
      tesla_default:   { color: '#ffbb77', glowColor: 'rgba(255,187,119,0.4)' },
      tesla_amber:     { color: '#ffaa33', glowColor: 'rgba(255,170,51,0.4)' },
      tesla_galaxy:    { color: '#ccddff', glowColor: 'rgba(204,221,255,0.4)' },
      missile_default: { color: '#ff9955', glowColor: 'rgba(255,153,85,0.4)' },
      missile_steel:   { color: '#aaaaaa', glowColor: 'rgba(170,170,170,0.4)' },
      missile_phoenix: { color: '#ffdd66', glowColor: 'rgba(255,221,102,0.4)' },
      shield_default:  { color: '#a8cc55', glowColor: 'rgba(168,204,85,0.4)' },
      shield_aegis:    { color: '#5599ff', glowColor: 'rgba(85,153,255,0.4)' },
      shield_mithril:  { color: '#e0eaff', glowColor: 'rgba(224,234,255,0.4)' },
      collector_default: { color: '#ffcc55', glowColor: 'rgba(255,204,85,0.4)' },
      collector_crystal: { color: '#cc88ff', glowColor: 'rgba(204,136,255,0.4)' },
      collector_aurora:  { color: '#88ffcc', glowColor: 'rgba(136,255,204,0.4)' },
      cryo_default:    { color: '#77ccdd', glowColor: 'rgba(119,204,221,0.4)' },
      cryo_glacier:    { color: '#aaddff', glowColor: 'rgba(170,221,255,0.4)' },
      cryo_abyss:      { color: '#3366ff', glowColor: 'rgba(51,102,255,0.4)' },
      plasma_default:  { color: '#ff88aa', glowColor: 'rgba(255,136,170,0.4)' },
      plasma_nebula:   { color: '#cc44ff', glowColor: 'rgba(204,68,255,0.4)' },
      plasma_sun:      { color: '#ffcc44', glowColor: 'rgba(255,204,68,0.4)' },
      gravity_default: { color: '#cc8866', glowColor: 'rgba(204,136,102,0.4)' },
      gravity_obsidian: { color: '#555566', glowColor: 'rgba(85,85,102,0.4)' },
      gravity_singularity: { color: '#aa55ff', glowColor: 'rgba(170,85,255,0.4)' },
      repair_default:  { color: '#77ddaa', glowColor: 'rgba(119,221,170,0.4)' },
      repair_healer:   { color: '#eeffdd', glowColor: 'rgba(238,255,221,0.4)' },
      repair_nano:     { color: '#88ccff', glowColor: 'rgba(136,204,255,0.4)' },
      summoner_default: { color: '#ff88cc', glowColor: 'rgba(255,136,204,0.4)' },
      summoner_demon:   { color: '#ff3344', glowColor: 'rgba(255,51,68,0.4)' },
      summoner_void:    { color: '#8833ff', glowColor: 'rgba(136,51,255,0.4)' },
      curser_default:   { color: '#aa44ff', glowColor: 'rgba(170,68,255,0.4)' },
      curser_blood:     { color: '#cc0033', glowColor: 'rgba(204,0,51,0.4)' },
      curser_necro:     { color: '#66ff66', glowColor: 'rgba(102,255,102,0.4)' },
    };
    return TOWER_SKIN_PALETTE[skinId] || fallback;
  }

  _drawPolyPlatform(x, y, r, sides, rotation, innerColor, outerColor, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    ctx.fillStyle = innerColor;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (Math.PI * 2 / sides) * i;
      const px = Math.cos(a) * r * 0.7;
      const py = Math.sin(a) * r * 0.35;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = outerColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha || 0.6;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (Math.PI * 2 / sides) * i;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.4;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawTowerSprite(x, y, type, time, level, cell, tower) {
    // === 预渲染模式：直接 drawImage 缓存的 sprite（一次替代几十次绘制操作）===
    // 注意：攻击动画期间禁用预渲染，使用实时绘制
    const isAttacking = tower && tower.attackState && tower.attackState !== 'idle';
    if (this.usePrerender && !isAttacking && (!tower || tower.attackState === 'idle')) {
      const sprite = this._getOrCreateSprite(type, level, cell);
      if (sprite) {
        this.ctx.drawImage(sprite, x - cell, y - cell);
        return;
      }
    }

    const ctx = this.ctx;
    const platformY = y + cell * 0.25;
    const bodyCenterY = y;
    const headCenterY = y - cell * 0.25;
    const platformR = cell * 0.4;
    const bodyW = cell * 0.3;
    const bodyH = cell * 0.5;
    const headR = cell * 0.22;

    // 待机动画：呼吸浮动 + 时间源
    const idleTime = tower ? tower.idleTime : time;
    const idleBob = Math.sin(idleTime * 1.5) * 1.5;
    const breatheScale = 1 + Math.sin(idleTime * 2) * 0.02;

    // 攻击动画偏移
    let recoilOffset = 0;
    let chargeGlow = 0;
    if (tower) {
      const prog = tower.getAttackAnimProgress ? tower.getAttackAnimProgress() : { charge: 0, fire: 0, recoil: 0 };
      // 蓄力时身体微微后缩
      if (tower.attackState === 'charging') {
        recoilOffset = -prog.charge * 2;
        chargeGlow = prog.charge;
      }
      // 后坐力：身体向后偏移
      if (tower.attackState === 'recoiling') {
        const angle = tower.turretAngle || -Math.PI / 2;
        const recoilDist = 4 * (1 - prog.recoil);
        recoilOffset = Math.sin(angle) * recoilDist * 0.3;
      }
    }

    ctx.save();

    // 蓄力时整体微微发光
    if (chargeGlow > 0) {
      ctx.shadowColor = type.color;
      ctx.shadowBlur = 10 * chargeGlow;
    }

    // 呼吸缩放
    ctx.translate(x, y + idleBob + recoilOffset);
    ctx.scale(breatheScale, breatheScale);
    ctx.translate(-x, -(y + idleBob + recoilOffset));

    switch(type.id) {
      case 'laser':
        this._drawLaserDrStrange(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      case 'tesla':
        this._drawTeslaThor(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      case 'missile':
        this._drawMissileIronMan(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      case 'cryo':
        this._drawCryoElsa(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      case 'gravity':
        this._drawGravityHulk(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      case 'shield':
        this._drawShieldCaptain(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      case 'collector':
        this._drawCollectorPanther(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      case 'plasma':
        this._drawPlasmaCaptain(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      case 'repair':
        this._drawRepairSpider(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      // P4-2：新增召唤塔 / 诅咒塔
      case 'summoner':
        this._drawSummonerShaman(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      case 'curser':
        this._drawCurserNecro(x, platformY, bodyCenterY + idleBob + recoilOffset, headCenterY + idleBob + recoilOffset, platformR, bodyW, bodyH, headR, type, level, idleTime, idleBob, tower);
        break;
      default:
        this._drawDefaultTower(x, y, type, cell, time);
    }

    ctx.restore();
  }

  // ================================================================
  // 1. 激光塔 - 精灵弓箭手风格（魔法弓手）
  // 标志性特征：精灵长弓、光翼(3级)、魔法箭、精灵耳
  // ================================================================
  _drawLaserDrStrange(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob, tower) {
    const ctx = this.ctx;
    const auraAlpha = 0.6;
    const turretAngle = tower ? tower.turretAngle : -Math.PI / 2;
    const isCharging = tower && tower.attackState === 'charging';
    const chargeProg = isCharging ? (1 - tower.attackAnimTimer / tower.chargeDuration) : 0;
    const isRecoiling = tower && tower.attackState === 'recoiling';
    const recoilProg = isRecoiling ? (1 - tower.attackAnimTimer / tower.recoilDuration) : 0;

    // 魔法平台
    this._drawGroundGlow(x, platY, platR, '#9933ff', time);
    this._drawPolyPlatform(x, platY, platR, 8, Math.PI / 8, '#1a0a2e', '#9933ff', auraAlpha);

    // 魔法符文（等级越高越多）
    const runeCount = 4 + level * 2;
    for (let i = 0; i < runeCount; i++) {
      const a = (Math.PI * 2 / runeCount) * i + time * 0.3;
      const fx = x + Math.cos(a) * platR * 0.7;
      const fy = platY + Math.sin(a) * platR * 0.35;
      ctx.save();
      ctx.shadowColor = '#9933ff';
      ctx.shadowBlur = 6 + level * 2;
      ctx.fillStyle = `rgba(153,51,255,${0.4 + Math.sin(time * 2 + i) * 0.3})`;
      ctx.font = `${6 + level}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(String.fromCharCode(0x2726 + (i % 6)), fx, fy + 3);
      ctx.restore();
    }

    // 3级特效：精灵光翼
    if (level >= 3) {
      this._drawSpriteWings(ctx, x, bodyY - bodyH * 0.1, bodyH, '#cc66ff', time, level);
    }

    // 腿部
    ctx.fillStyle = '#1a0a2e';
    ctx.fillRect(x - 5, bodyY + bodyH / 2 - 5, 5, bodyH * 0.45);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 - 5, 5, bodyH * 0.45);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(x - 5, bodyY + bodyH / 2 - 5, 5, 3);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 - 5, 5, 3);

    // 法师/精灵长袍
    ctx.fillStyle = '#1a0a2e';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.6, bodyY - bodyH * 0.3);
    ctx.lineTo(x - bodyW * 0.7, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.7, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.6, bodyY - bodyH * 0.3);
    ctx.closePath();
    ctx.fill();

    // 长袍金色纹饰（等级越高越华丽）
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.45, bodyY - bodyH * 0.25);
    ctx.lineTo(x - bodyW * 0.4, bodyY + bodyH * 0.25);
    ctx.lineTo(x, bodyY + bodyH * 0.35);
    ctx.lineTo(x + bodyW * 0.4, bodyY + bodyH * 0.25);
    ctx.lineTo(x + bodyW * 0.45, bodyY - bodyH * 0.25);
    ctx.closePath();
    ctx.fill();
    // 等级2+：额外纹饰
    if (level >= 2) {
      ctx.fillStyle = '#ffcc44';
      ctx.beginPath();
      ctx.ellipse(x, bodyY + bodyH * 0.15, bodyW * 0.15, bodyH * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 阿戈摩托之眼/精灵宝石 - 胸前护身符
    const eyePulse = Math.sin(time * 2) * 0.2 + 0.8;
    ctx.save();
    ctx.shadowColor = level >= 2 ? '#22ff88' : '#9933ff';
    ctx.shadowBlur = 12 + eyePulse * 8 + level * 3;
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.ellipse(x, bodyY - bodyH * 0.05, bodyW * 0.18, bodyH * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${level >= 2 ? '34, 255, 136' : '153, 51, 255'}, ${eyePulse})`;
    ctx.beginPath();
    ctx.arc(x, bodyY - bodyH * 0.05, bodyW * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(200, 255, 220, ${eyePulse * 0.8})`;
    ctx.beginPath();
    ctx.arc(x - bodyW * 0.03, bodyY - bodyH * 0.08, bodyW * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 左臂（拉弓手）
    ctx.strokeStyle = '#ffd5b8';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const leftArmEndX = x - bodyW / 2 + Math.cos(Math.PI * 0.55) * bodyH * 0.55;
    const leftArmEndY = bodyY - bodyH * 0.15 + Math.sin(Math.PI * 0.55) * bodyH * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.15);
    ctx.lineTo(leftArmEndX, leftArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 旋转炮塔/武器部分：精灵弓（朝向目标方向）
    ctx.save();
    ctx.translate(x, bodyY - bodyH * 0.1);
    ctx.rotate(turretAngle + Math.PI / 2); // 调整基准角度
    const recoilPush = recoilProg * 6;
    ctx.translate(0, recoilPush);

    // 精灵长弓
    const bowLen = bodyH * 0.6;
    ctx.strokeStyle = '#9933ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#cc66ff';
    ctx.shadowBlur = 8 + chargeProg * 10;
    ctx.beginPath();
    ctx.arc(0, 0, bowLen, Math.PI * 0.15, Math.PI - 0.15);
    ctx.stroke();
    // 弓弦
    ctx.strokeStyle = 'rgba(200,180,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const stringPull = chargeProg * bowLen * 0.3;
    ctx.moveTo(Math.cos(Math.PI * 0.15) * bowLen, Math.sin(Math.PI * 0.15) * bowLen);
    ctx.lineTo(0, stringPull);
    ctx.lineTo(Math.cos(Math.PI - 0.15) * bowLen, Math.sin(Math.PI - 0.15) * bowLen);
    ctx.stroke();
    // 蓄力时的魔法箭
    if (chargeProg > 0) {
      ctx.fillStyle = '#cc66ff';
      ctx.shadowColor = '#ff44ff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.ellipse(0, stringPull - 5, 3 + chargeProg * 3, 8 + chargeProg * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // 右臂 - 施法
    const rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.45) * bodyH * 0.6;
    const rightArmEndY = bodyY - bodyH * 0.15 + Math.sin(-Math.PI * 0.45) * bodyH * 0.6;
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.15);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(rightArmEndX, rightArmEndY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 魔法光束
    ctx.save();
    ctx.shadowColor = '#9933ff';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#cc66ff';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.7 + Math.sin(time * 6) * 0.3;
    ctx.beginPath();
    ctx.moveTo(rightArmEndX + 5, rightArmEndY);
    ctx.lineTo(rightArmEndX + 30, rightArmEndY - 20);
    ctx.stroke();
    ctx.fillStyle = '#ff99ff';
    ctx.beginPath();
    ctx.arc(rightArmEndX + 30, rightArmEndY - 20, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    // 头部
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // 法师帽
    ctx.fillStyle = '#1a0a2e';
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.55, headY - headR * 0.35);
    ctx.lineTo(x + headR * 0.55, headY - headR * 0.35);
    ctx.lineTo(x, headY - headR * 1.4);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x, headY - headR * 0.45, headR * 0.95, headR * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 帽顶宝石
    ctx.save();
    ctx.shadowColor = '#ff6b6b';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(x, headY - headR * 1.4, headR * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(x - headR * 0.04, headY - headR * 1.45, headR * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    // 披风
    const capeWave = Math.sin(time * 2) * 0.08;
    ctx.fillStyle = 'rgba(26,10,46,0.9)';
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.7, headY - headR * 0.25);
    ctx.quadraticCurveTo(x - headR * 2.0 + capeWave * 15, bodyY + capeWave * 15, x - bodyW * 0.9, bodyY + bodyH * 0.4);
    ctx.lineTo(x - bodyW * 0.55, bodyY + bodyH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.7, headY - headR * 0.25);
    ctx.quadraticCurveTo(x + headR * 2.0 - capeWave * 15, bodyY + capeWave * 15, x + bodyW * 0.9, bodyY + bodyH * 0.4);
    ctx.lineTo(x + bodyW * 0.55, bodyY + bodyH * 0.2);
    ctx.closePath();
    ctx.fill();

    // 等级特效
    if (level >= 2) {
      ctx.save();
      ctx.translate(x, bodyY);
      ctx.rotate(time * 1.5);
      ctx.shadowColor = '#9933ff';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(153,51,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, platR * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = '#9933ff';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(153,51,255,0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ================================================================
  // 2. 电磁塔 - 雷神索尔 Thor
  // 标志性特征：雷神之锤、翅膀头盔、闪电特效
  // ================================================================
  _drawTeslaThor(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob, tower) {
    const ctx = this.ctx;
    const cellSize = headR * 2 / 0.44;  // 反推 cellSize
    const turretAngle = tower ? tower.turretAngle : -Math.PI / 2;
    const isCharging = tower && tower.attackState === 'charging';
    const chargeProg = isCharging ? (1 - tower.attackAnimTimer / tower.chargeDuration) : 0;
    const isRecoiling = tower && tower.attackState === 'recoiling';
    const recoilProg = isRecoiling ? (1 - tower.attackAnimTimer / tower.recoilDuration) : 0;

    // 1) 平台 + 地面光晕
    this._drawGroundGlow(x, platY, platR, '#ffcc00', time);
    this._drawCirclePlatform(x, platY, platR, '#1a1a0a', '#ffcc00', 0.6);

    // 2) 地面闪电（环状电弧，持续动画，等级越高越多）
    const boltCount = 4 + level * 2;
    for (let i = 0; i < boltCount; i++) {
      const a = (Math.PI * 2 / boltCount) * i;
      const r = platR * 0.75;
      ctx.save();
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 8 + level * 2;
      ctx.strokeStyle = `rgba(255,200,0,${0.4 + Math.sin(time * 3 + i) * 0.3})`;
      ctx.lineWidth = 2 + level * 0.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r, platY + Math.sin(a) * r * 0.4);
      const midX = x + Math.cos(a + Math.PI / 12) * r * 1.3 + Math.sin(time * 20 + i) * 5;
      const midY = platY + Math.sin(a + Math.PI / 12) * r * 0.55 + Math.cos(time * 18 + i) * 5;
      ctx.lineTo(midX, midY);
      ctx.lineTo(x + Math.cos(a + Math.PI / 6) * r, platY + Math.sin(a + Math.PI / 6) * r * 0.4);
      ctx.stroke();
      ctx.restore();
    }

    // 3级特效：雷神风暴之眼（旋转雷电视界）
    if (level >= 3) {
      this._drawMagicCircle(ctx, x, bodyY - bodyH * 0.1, platR * 0.9, '#ffdd44', time * 2, 8);
    }

    // 3) 计算动画状态（使用新动画系统）
    const attackTimer = tower && tower.lastFireTime != null
      ? time - tower.lastFireTime
      : 99;
    const ultTimer = tower && tower.lastUltTime != null
      ? time - tower.lastUltTime
      : 99;
    // 开火时大幅挥锤
    const isAttacking = isCharging || isRecoiling || (tower && tower.attackState === 'firing') || attackTimer < 0.5;
    // Lv3 / 大招触发时进入"觉醒"姿态
    const isAwaken = level >= 3 || ultTimer < 1.5;

    // 4) === 雷神身体（Canvas 2D 程序化绘制，完美融合游戏美术风格）===

    // === 腿部（从身体底部伸出）===
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(x - 8, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    ctx.fillRect(x + 4, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    // 战靴金边
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(x - 9, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 8, 4);
    ctx.fillRect(x + 3, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 8, 4);

    // === 战甲（梯形躯干）===
    ctx.fillStyle = '#8b7355';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.5, bodyY - bodyH * 0.3);
    ctx.lineTo(x - bodyW * 0.55, bodyY + bodyH * 0.4);
    ctx.lineTo(x, bodyY + bodyH * 0.5);
    ctx.lineTo(x + bodyW * 0.55, bodyY + bodyH * 0.4);
    ctx.lineTo(x + bodyW * 0.5, bodyY - bodyH * 0.3);
    ctx.closePath();
    ctx.fill();

    // === 战甲内层（金色三角）===
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.3, bodyY - bodyH * 0.2);
    ctx.lineTo(x - bodyW * 0.25, bodyY + bodyH * 0.25);
    ctx.lineTo(x, bodyY + bodyH * 0.35);
    ctx.lineTo(x + bodyW * 0.25, bodyY + bodyH * 0.25);
    ctx.lineTo(x + bodyW * 0.3, bodyY - bodyH * 0.2);
    ctx.closePath();
    ctx.fill();

    // === 胸前闪电标志（脉冲发光）===
    ctx.save();
    ctx.shadowColor = '#ffdd00';
    ctx.shadowBlur = 10;
    const lightningPulse = Math.sin(time * 5) * 0.2 + 0.8;
    ctx.fillStyle = `rgba(255,221,0,${lightningPulse})`;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.15, bodyY + bodyH * 0.1);
    ctx.lineTo(x - bodyW * 0.08, bodyY - bodyH * 0.1);
    ctx.lineTo(x, bodyY + bodyH * 0.05);
    ctx.lineTo(x + bodyW * 0.08, bodyY - bodyH * 0.1);
    ctx.lineTo(x + bodyW * 0.15, bodyY + bodyH * 0.1);
    ctx.lineTo(x, bodyY + bodyH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // === 左臂（空闲下垂，攻击时挥起）===
    ctx.strokeStyle = '#ffd5b8';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    let leftArmEndX, leftArmEndY;
    if (isAttacking) {
      // 攻击：左臂向斜前方挥出
      const swingProgress = attackTimer / 0.5;
      const swingAngle = -Math.PI * 0.3 + swingProgress * Math.PI * 0.5;
      leftArmEndX = x - bodyW / 2 + Math.cos(swingAngle) * bodyH * 0.55;
      leftArmEndY = bodyY - bodyH * 0.1 + Math.sin(swingAngle) * bodyH * 0.55;
    } else {
      // 闲置：下垂
      leftArmEndX = x - bodyW / 2 + Math.cos(Math.PI * 0.65) * bodyH * 0.55;
      leftArmEndY = bodyY - bodyH * 0.1 + Math.sin(Math.PI * 0.65) * bodyH * 0.55;
    }
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(leftArmEndX, leftArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY, 4, 0, Math.PI * 2);
    ctx.fill();

    // === 右臂 - 始终扛锤（开火时大幅挥出）===
    let rightArmEndX, rightArmEndY, hammerRot;
    if (isAttacking) {
      // 攻击：右臂大幅前挥（挥锤动作）
      const swingProgress = attackTimer / 0.5;
      hammerRot = -1.2 + swingProgress * 1.5;  // 从 -68° 挥到 +18°
      rightArmEndX = x + bodyW / 2 + Math.cos(hammerRot) * bodyH * 0.6;
      rightArmEndY = bodyY - bodyH * 0.15 + Math.sin(hammerRot) * bodyH * 0.6;
    } else if (isAwaken) {
      // 觉醒（Lv3 / 大招）：锤高举过头
      rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.85) * bodyH * 0.7;
      rightArmEndY = bodyY - bodyH * 0.15 + Math.sin(-Math.PI * 0.85) * bodyH * 0.7;
      hammerRot = -0.3;  // 锤头微倾斜
    } else {
      // 闲置：扛在右肩
      rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.4) * bodyH * 0.6;
      rightArmEndY = bodyY - bodyH * 0.15 + Math.sin(-Math.PI * 0.4) * bodyH * 0.6;
      hammerRot = -0.35;
    }
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.15);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(rightArmEndX, rightArmEndY, 5, 0, Math.PI * 2);
    ctx.fill();

    // === 雷神之锤 Mjolnir ===
    ctx.save();
    ctx.translate(rightArmEndX - 6, rightArmEndY - 8);
    ctx.rotate(hammerRot);

    // 锤柄（木质 + 金环）
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-4, -bodyH * 1.0, 8, bodyH * 1.3);
    ctx.fillStyle = '#ffaa00';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-5, -bodyH * 0.75 + i * bodyH * 0.35, 12, 4);
    }

    // 锤头（银灰主体 + 金色边框 + 符文）
    const hammerGlow = isAwaken
      ? Math.sin(time * 6) * 0.3 + 0.9
      : Math.sin(time * 4) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 25 + hammerGlow * 15;
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.roundRect(-20, -bodyH * 1.3, 40, bodyH * 0.7, 3);
    ctx.fill();

    // 锤头金色边框
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(-20, -bodyH * 1.3, 6, bodyH * 0.7);
    ctx.fillRect(14, -bodyH * 1.3, 6, bodyH * 0.7);
    ctx.fillRect(-20, -bodyH * 1.3, 40, 5);
    ctx.fillRect(-20, -bodyH * 0.65, 40, 5);

    // 中央符文（菱形 + 闪电）
    ctx.fillStyle = '#ffcc00';
    ctx.globalAlpha = hammerGlow;
    ctx.beginPath();
    ctx.moveTo(-6, -bodyH * 1.1);
    ctx.lineTo(0, -bodyH * 0.85);
    ctx.lineTo(6, -bodyH * 1.1);
    ctx.lineTo(0, -bodyH * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.restore();

    // === 头部（脸）===
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // === 维京头盔（银色穹顶）===
    ctx.fillStyle = '#708090';
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.3, headR * 0.85, -Math.PI * 0.92, -Math.PI * 0.08);
    ctx.fill();

    // 翅膀（拍动动画）
    const wingFlap = Math.sin(time * 2) * 0.05;
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.75, headY - headR * 0.45);
    ctx.quadraticCurveTo(x - headR * 1.6 + wingFlap * 15, headY - headR * 0.8, x - headR * 2.2, headY - headR * 0.4);
    ctx.quadraticCurveTo(x - headR * 1.9, headY - headR * 0.15, x - headR * 1.3, headY - headR * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.75, headY - headR * 0.45);
    ctx.quadraticCurveTo(x + headR * 1.6 - wingFlap * 15, headY - headR * 0.8, x + headR * 2.2, headY - headR * 0.4);
    ctx.quadraticCurveTo(x + headR * 1.9, headY - headR * 0.15, x + headR * 1.3, headY - headR * 0.05);
    ctx.closePath();
    ctx.fill();

    // 头盔金色描边
    ctx.save();
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.3, headR * 0.85, -Math.PI * 0.92, -Math.PI * 0.08);
    ctx.stroke();
    ctx.restore();

    // === 金色短发（从头盔下露出）===
    ctx.fillStyle = '#ffcc66';
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.15, headR * 0.6, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.fill();

    // === 头部周围环绕闪电（持续闪烁）===
    for (let i = 0; i < 5; i++) {
      const boltAngle = -Math.PI * 0.7 + (Math.PI * 0.6 / 4) * i;
      const boltR = headR * 1.5;
      const bx = x + Math.cos(boltAngle) * boltR;
      const by = headY + Math.sin(boltAngle) * boltR;
      const boltAlpha = Math.sin(time * 15 + i * 37) * 0.5 + 0.5;
      ctx.save();
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = `rgba(255,204,0,${boltAlpha})`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      const midBX = bx + Math.sin(time * 25 + i * 7) * 6;
      const midBY = by + Math.cos(time * 22 + i * 5) * 6;
      ctx.lineTo(midBX, midBY);
      ctx.lineTo(bx + Math.cos(boltAngle) * 10, by + Math.sin(boltAngle) * 10);
      ctx.stroke();
      ctx.restore();
    }

    // 5) === 等级特效 ===
    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(255,204,0,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.6, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      // 觉醒：锤头光晕 + 多环 + 身体光波
      ctx.save();
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 30;
      // 身体周围光波
      for (let i = 0; i < 5; i++) {
        const a = time * 3 + i * Math.PI * 0.7;
        const arcR = platR * (1.6 + i * 0.5);
        ctx.strokeStyle = `rgba(255,204,0,${0.25 + Math.sin(time * 6 + i) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, bodyY, arcR, a, a + Math.PI * 0.8);
        ctx.stroke();
      }
      ctx.restore();

      // 觉醒时加金色光晕包裹全身
      ctx.save();
      ctx.shadowColor = '#ffdd44';
      ctx.shadowBlur = 20;
      const auraAlpha = 0.3 + Math.sin(time * 4) * 0.15;
      ctx.fillStyle = `rgba(255,220,80,${auraAlpha})`;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ================================================================
  // 3. 导弹塔 - 钢铁侠 Iron Man
  // 标志性特征：红金装甲、反应炉、推进器、掌心炮
  // ================================================================
  _drawMissileIronMan(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob, tower) {
    const ctx = this.ctx;
    const turretAngle = tower ? tower.turretAngle : -Math.PI / 2;
    const isCharging = tower && tower.attackState === 'charging';
    const chargeProg = isCharging ? (1 - tower.attackAnimTimer / tower.chargeDuration) : 0;
    const isRecoiling = tower && tower.attackState === 'recoiling';
    const recoilProg = isRecoiling ? (1 - tower.attackAnimTimer / tower.recoilDuration) : 0;

    // 科技平台
    this._drawGroundGlow(x, platY, platR, '#e63946', time);
    this._drawCirclePlatform(x, platY, platR, '#1a1a2e', '#e63946', 0.6);

    // 平台科技纹路（等级越高越多）
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 1.5;
    const lineCount = 6 + level * 2;
    for (let i = 0; i < lineCount; i++) {
      const a = (Math.PI * 2 / lineCount) * i;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * platR * 0.4, platY + Math.sin(a) * platR * 0.4 * 0.4);
      ctx.lineTo(x + Math.cos(a) * platR * 0.75, platY + Math.sin(a) * platR * 0.75 * 0.4);
      ctx.stroke();
    }

    // 3级特效：肩炮/导弹仓光环
    if (level >= 3) {
      this._drawMagicCircle(ctx, x, platY, platR * 0.9, '#ff6644', time * 0.5, 8);
    }

    // 腿部装甲
    ctx.fillStyle = '#e63946';
    ctx.fillRect(x - 8, bodyY + bodyH / 2 - 5, 7, bodyH * 0.45);
    ctx.fillRect(x + 3, bodyY + bodyH / 2 - 5, 7, bodyH * 0.45);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(x - 8, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 7, 4);
    ctx.fillRect(x + 3, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 7, 4);

    // 脚部推进器
    const footFlame = Math.sin(time * 5) * 0.2 + 0.3;
    ctx.save();
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 6;
    ctx.fillStyle = `rgba(255,100,50,${footFlame})`;
    ctx.beginPath();
    ctx.moveTo(x - 6, bodyY + bodyH / 2 + bodyH * 0.45);
    ctx.lineTo(x - 4, bodyY + bodyH / 2 + bodyH * 0.45 + 10 + footFlame * 4);
    ctx.lineTo(x - 2, bodyY + bodyH / 2 + bodyH * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 5, bodyY + bodyH / 2 + bodyH * 0.45);
    ctx.lineTo(x + 7, bodyY + bodyH / 2 + bodyH * 0.45 + 10 + footFlame * 4);
    ctx.lineTo(x + 9, bodyY + bodyH / 2 + bodyH * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 身体装甲
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.lineTo(x - bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.4, bodyY - bodyH * 0.3);
    ctx.lineTo(x - bodyW * 0.35, bodyY + bodyH * 0.3);
    ctx.lineTo(x, bodyY + bodyH * 0.4);
    ctx.lineTo(x + bodyW * 0.35, bodyY + bodyH * 0.3);
    ctx.lineTo(x + bodyW * 0.4, bodyY - bodyH * 0.3);
    ctx.closePath();
    ctx.fill();

    // 胸口反应炉
    const reactorPulse = Math.sin(time * 3) * 0.25 + 0.75;
    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15 + reactorPulse * 10;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x, bodyY, bodyH * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(0,255,255,${reactorPulse})`;
    ctx.beginPath();
    ctx.arc(x, bodyY, bodyH * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#006666';
    ctx.beginPath();
    ctx.arc(x, bodyY, bodyH * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = reactorPulse * 0.9;
    ctx.beginPath();
    ctx.arc(x, bodyY, bodyH * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    // 背包推进器
    ctx.fillStyle = '#e63946';
    ctx.fillRect(x - bodyW * 0.55, bodyY - bodyH * 0.35, bodyW * 1.1, bodyH * 0.45);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(x - bodyW * 0.55, bodyY - bodyH * 0.35, 3, bodyH * 0.45);
    ctx.fillRect(x + bodyW * 0.52, bodyY - bodyH * 0.35, 3, bodyH * 0.45);

    // 推进器火焰
    const flamePulse = Math.sin(time * 6) * 0.35 + 0.35;
    ctx.save();
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(255,100,30,${flamePulse})`;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.3, bodyY - bodyH * 0.3);
    ctx.lineTo(x - bodyW * 0.45, bodyY - bodyH * 0.6 - flamePulse * 12);
    ctx.lineTo(x - bodyW * 0.15, bodyY - bodyH * 0.6 - flamePulse * 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,200,100,${flamePulse * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.3, bodyY - bodyH * 0.3);
    ctx.lineTo(x - bodyW * 0.38, bodyY - bodyH * 0.48 - flamePulse * 6);
    ctx.lineTo(x - bodyW * 0.22, bodyY - bodyH * 0.48 - flamePulse * 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,100,30,${flamePulse})`;
    ctx.beginPath();
    ctx.moveTo(x + bodyW * 0.3, bodyY - bodyH * 0.3);
    ctx.lineTo(x + bodyW * 0.45, bodyY - bodyH * 0.6 - flamePulse * 12);
    ctx.lineTo(x + bodyW * 0.15, bodyY - bodyH * 0.6 - flamePulse * 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,200,100,${flamePulse * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(x + bodyW * 0.3, bodyY - bodyH * 0.3);
    ctx.lineTo(x + bodyW * 0.38, bodyY - bodyH * 0.48 - flamePulse * 6);
    ctx.lineTo(x + bodyW * 0.22, bodyY - bodyH * 0.48 - flamePulse * 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 左臂
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    const leftArmEndX = x - bodyW / 2 + Math.cos(Math.PI * 0.55) * bodyH * 0.55;
    const leftArmEndY = bodyY - bodyH * 0.1 + Math.sin(Math.PI * 0.55) * bodyH * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(leftArmEndX, leftArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY + 2, 5, -Math.PI * 0.3, Math.PI * 0.3);
    ctx.fill();

    // 右臂 - 掌心炮
    const rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.45) * bodyH * 0.6;
    const rightArmEndY = bodyY - bodyH * 0.15 + Math.sin(-Math.PI * 0.45) * bodyH * 0.6;
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.15);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(rightArmEndX, rightArmEndY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(rightArmEndX, rightArmEndY + 2, 5, -Math.PI * 0.3, Math.PI * 0.3);
    ctx.fill();

    // 掌心炮发射
    const palmPulse = Math.sin(time * 8) * 0.35 + 0.45;
    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = `rgba(0,255,255,${palmPulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(rightArmEndX + 8, rightArmEndY, 10 + palmPulse * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(0,255,255,${palmPulse})`;
    ctx.beginPath();
    ctx.arc(rightArmEndX + 7, rightArmEndY, 5 + palmPulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(200,255,255,${palmPulse * 0.8})`;
    ctx.beginPath();
    ctx.arc(rightArmEndX + 12 + palmPulse * 4, rightArmEndY, 3 + palmPulse * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 头部头盔
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(x, headY, headR * 0.95, -Math.PI * 0.95, -Math.PI * 0.05);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.75, headY - headR * 0.3);
    ctx.lineTo(x - headR * 0.5, headY - headR * 0.85);
    ctx.lineTo(x - headR * 0.35, headY - headR * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.75, headY - headR * 0.3);
    ctx.lineTo(x + headR * 0.5, headY - headR * 0.85);
    ctx.lineTo(x + headR * 0.35, headY - headR * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffd700';
    ctx.fillRect(x - headR * 0.6, headY - headR * 0.15, 3, headR * 0.4);
    ctx.fillRect(x + headR * 0.57, headY - headR * 0.15, 3, headR * 0.4);
    ctx.fillRect(x - headR * 0.6, headY - headR * 0.15, headR * 1.2, 2);
    ctx.fillRect(x - headR * 0.6, headY + headR * 0.2, headR * 1.2, 2);

    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.57, headY - headR * 0.13);
    ctx.lineTo(x - headR * 0.57, headY + headR * 0.18);
    ctx.lineTo(x + headR * 0.54, headY + headR * 0.18);
    ctx.lineTo(x + headR * 0.54, headY - headR * 0.13);
    ctx.closePath();
    ctx.fill();

    const eyeGlow = Math.sin(time * 4) * 0.2 + 0.8;
    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = `rgba(0,255,255,${eyeGlow})`;
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.45, headY - headR * 0.05);
    ctx.lineTo(x - headR * 0.15, headY - headR * 0.1);
    ctx.lineTo(x - headR * 0.15, headY + headR * 0.1);
    ctx.lineTo(x - headR * 0.45, headY + headR * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.15, headY - headR * 0.1);
    ctx.lineTo(x + headR * 0.45, headY - headR * 0.05);
    ctx.lineTo(x + headR * 0.45, headY + headR * 0.05);
    ctx.lineTo(x + headR * 0.15, headY + headR * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 等级特效
    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(255,215,0,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.5, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(0,255,255,0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ================================================================
  // 4. 冷冻塔 - 艾莎公主 Elsa
  // 标志性特征：蓝色长裙、冰雪皇冠、金色长发、雪花特效
  // ================================================================
  _drawCryoElsa(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob, tower) {
    const ctx = this.ctx;
    const turretAngle = tower ? tower.turretAngle : -Math.PI / 2;
    const isCharging = tower && tower.attackState === 'charging';
    const chargeProg = isCharging ? (1 - tower.attackAnimTimer / tower.chargeDuration) : 0;
    const isRecoiling = tower && tower.attackState === 'recoiling';
    const recoilProg = isRecoiling ? (1 - tower.attackAnimTimer / tower.recoilDuration) : 0;

    // 冰雪平台
    this._drawGroundGlow(x, platY, platR, '#00bfff', time);
    this._drawCirclePlatform(x, platY, platR, '#051a2e', '#00bfff', 0.6);

    // 雪花符文（等级越高越多）
    const snowCount = 4 + level * 2;
    for (let i = 0; i < snowCount; i++) {
      const a = (Math.PI * 2 / snowCount) * i + time * 0.2;
      const fx = x + Math.cos(a) * platR * 0.7;
      const fy = platY + Math.sin(a) * platR * 0.35;
      ctx.save();
      ctx.shadowColor = '#00bfff';
      ctx.shadowBlur = 6 + level * 2;
      ctx.fillStyle = `rgba(0,191,255,${0.4 + Math.sin(time * 2 + i) * 0.3})`;
      this._drawSnowflake(fx, fy, 3 + level, '#00bfff', time);
      ctx.restore();
    }

    // 3级特效：冰雪王冠光环
    if (level >= 3) {
      this._drawMagicCircle(ctx, x, bodyY - bodyH * 0.2, platR * 0.7, '#88ddff', time * -0.8, 8);
      // 冰晶光环粒子
      for (let i = 0; i < 6; i++) {
        const a = time * 1.5 + (Math.PI / 3) * i;
        const pr = platR * 0.8;
        const px = x + Math.cos(a) * pr;
        const py = bodyY + Math.sin(a) * pr * 0.3;
        this._drawSnowflake(px, py, 4, '#aaeeff', time);
      }
    }

    // 腿部
    ctx.fillStyle = '#1e90ff';
    ctx.fillRect(x - 6, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 6, bodyY + bodyH / 2 - 5, 6, 3);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 - 5, 6, 3);
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(x - 6, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 6, 3);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 6, 3);

    // 连衣裙
    const gradient = ctx.createLinearGradient(x, bodyY - bodyH * 0.4, x, bodyY + bodyH * 0.55);
    gradient.addColorStop(0, '#4169e1');
    gradient.addColorStop(1, '#1e90ff');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.55, bodyY - bodyH * 0.4);
    ctx.lineTo(x - bodyW * 0.7, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.58);
    ctx.lineTo(x + bodyW * 0.7, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.55, bodyY - bodyH * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b0e0e6';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.45, bodyY + bodyH * 0.05);
    ctx.lineTo(x - bodyW * 0.6, bodyY + bodyH * 0.5);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.5);
    ctx.lineTo(x + bodyW * 0.45, bodyY + bodyH * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.25, bodyY - bodyH * 0.25);
    ctx.lineTo(x - bodyW * 0.15, bodyY - bodyH * 0.05);
    ctx.lineTo(x, bodyY + bodyH * 0.15);
    ctx.lineTo(x + bodyW * 0.15, bodyY - bodyH * 0.05);
    ctx.lineTo(x + bodyW * 0.25, bodyY - bodyH * 0.25);
    ctx.closePath();
    ctx.fill();

    // 披风
    const capeWave = Math.sin(time * 2) * 0.08;
    ctx.fillStyle = 'rgba(100,200,255,0.5)';
    ctx.strokeStyle = 'rgba(150,230,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.7, headY - headR * 0.25);
    ctx.quadraticCurveTo(x - headR * 2.0 + capeWave * 15, bodyY + capeWave * 15, x - bodyW * 0.8, bodyY + bodyH * 0.4);
    ctx.lineTo(x - bodyW * 0.5, bodyY + bodyH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.7, headY - headR * 0.25);
    ctx.quadraticCurveTo(x + headR * 2.0 - capeWave * 15, bodyY + capeWave * 15, x + bodyW * 0.8, bodyY + bodyH * 0.4);
    ctx.lineTo(x + bodyW * 0.5, bodyY + bodyH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 左臂 - 冰雪魔法
    ctx.strokeStyle = '#ffd5b8';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const leftArmEndX = x - bodyW / 2 + Math.cos(Math.PI * 0.55) * bodyH * 0.55;
    const leftArmEndY = bodyY - bodyH * 0.15 + Math.sin(Math.PI * 0.55) * bodyH * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.15);
    ctx.lineTo(leftArmEndX, leftArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 雪花飘出
    for (let i = 0; i < 4; i++) {
      const flakeOffset = (time * 0.5 + i * 0.4) % 1.5;
      const flakeX = leftArmEndX - flakeOffset * 10;
      const flakeY = leftArmEndY - flakeOffset * 6 + Math.sin(time * 3 + i * 2) * 4;
      const flakeAlpha = Math.max(0, 1 - flakeOffset / 1.5);
      const flakeSize = 3 + flakeOffset * 2;

      ctx.save();
      ctx.shadowColor = '#00bfff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(150,230,255,${flakeAlpha * 0.8})`;
      this._drawSnowflake(flakeX, flakeY, flakeSize, '#00bfff', time);
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = '#00bfff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(0,191,255,${0.4 + Math.sin(time * 4) * 0.3})`;
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 右臂
    const rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.45) * bodyH * 0.5;
    const rightArmEndY = bodyY - bodyH * 0.1 + Math.sin(-Math.PI * 0.45) * bodyH * 0.5;
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(rightArmEndX, rightArmEndY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 头部
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // 金色长发
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.25, headR * 1.15, -Math.PI * 0.9, -Math.PI * 0.1);
    ctx.fill();

    ctx.fillStyle = '#ffc125';
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.4, headY - headR * 0.3);
    ctx.quadraticCurveTo(x - headR * 0.55, headY - headR * 0.05, x - headR * 0.45, headY + headR * 0.1);
    ctx.quadraticCurveTo(x - headR * 0.55, headY + headR * 0.35, x - headR * 0.4, bodyY - bodyH * 0.25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.4, headY - headR * 0.3);
    ctx.quadraticCurveTo(x + headR * 0.55, headY - headR * 0.05, x + headR * 0.45, headY + headR * 0.1);
    ctx.quadraticCurveTo(x + headR * 0.55, headY + headR * 0.35, x + headR * 0.4, bodyY - bodyH * 0.25);
    ctx.fill();

    // 冰雪皇冠
    const crownY = headY - headR * 1.0;
    ctx.save();
    ctx.shadowColor = '#00bfff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(x - headR * 0.55, crownY - headR * 0.12, headR * 1.1, headR * 0.18);

    for (let i = -2; i <= 2; i++) {
      const cx = x + i * headR * 0.24;
      const tipH = (i === 0 ? headR * 0.55 : (Math.abs(i) === 1 ? headR * 0.4 : headR * 0.3));
      ctx.beginPath();
      ctx.moveTo(cx - headR * 0.1, crownY);
      ctx.lineTo(cx, crownY - tipH);
      ctx.lineTo(cx + headR * 0.1, crownY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#0066cc';
    ctx.beginPath();
    ctx.moveTo(x, crownY - headR * 0.65);
    ctx.lineTo(x + headR * 0.12, crownY - headR * 0.5);
    ctx.lineTo(x, crownY - headR * 0.4);
    ctx.lineTo(x - headR * 0.12, crownY - headR * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = '#00bfff';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(0,191,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.5, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = '#00bfff';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = 'rgba(0,191,255,0.3)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ================================================================
  // 5. 重力塔 - 绿巨人 Hulk
  // 标志性特征：绿色皮肤、紫色破裤子、肌肉发达、愤怒表情
  // ================================================================
  _drawGravityHulk(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob) {
    const ctx = this.ctx;

    this._drawGroundGlow(x, platY, platR, '#228b22', time);
    this._drawCirclePlatform(x, platY, platR, '#0a1a0a', '#228b22', 0.6);

    // 碎石特效
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i;
      const r = platR * (0.7 + Math.sin(time * 2 + i) * 0.15);
      const sx = x + Math.cos(a) * r;
      const sy = platY + Math.sin(a) * r * 0.4;
      const stoneAlpha = Math.sin(time * 3 + i) * 0.3 + 0.5;
      ctx.save();
      ctx.fillStyle = `rgba(100,80,60,${stoneAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 3 + Math.sin(time * 5 + i * 7) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 腿部 - 紫色破裤子
    ctx.fillStyle = '#4b0082';
    ctx.fillRect(x - 10, bodyY + bodyH / 2 - 8, 10, bodyH * 0.48);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 - 8, 10, bodyH * 0.48);

    // 裤子破洞效果
    ctx.fillStyle = '#3d0066';
    ctx.beginPath();
    ctx.arc(x - 5, bodyY + bodyH / 2 + bodyH * 0.15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 7, bodyY + bodyH / 2 + bodyH * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();

    // 身体 - 肌肉发达的上身
    const bodyGradient = ctx.createRadialGradient(x, bodyY, 0, x, bodyY, bodyW * 0.8);
    bodyGradient.addColorStop(0, '#3cb371');
    bodyGradient.addColorStop(1, '#228b22');
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.6, bodyY - bodyH * 0.35);
    ctx.lineTo(x - bodyW * 0.65, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.52);
    ctx.lineTo(x + bodyW * 0.65, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.6, bodyY - bodyH * 0.35);
    ctx.closePath();
    ctx.fill();

    // 胸肌
    ctx.fillStyle = '#55aa55';
    ctx.beginPath();
    ctx.arc(x - bodyW * 0.2, bodyY - bodyH * 0.1, bodyW * 0.18, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + bodyW * 0.2, bodyY - bodyH * 0.1, bodyW * 0.18, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();

    // 腹部线条
    ctx.strokeStyle = '#1a6b1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.25, bodyY + bodyH * 0.1);
    ctx.lineTo(x - bodyW * 0.15, bodyY + bodyH * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + bodyW * 0.25, bodyY + bodyH * 0.1);
    ctx.lineTo(x + bodyW * 0.15, bodyY + bodyH * 0.3);
    ctx.stroke();

    // 左臂 - 肌肉手臂
    ctx.strokeStyle = '#228b22';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    const leftArmEndX = x - bodyW / 2 + Math.cos(Math.PI * 0.7) * bodyH * 0.5;
    const leftArmEndY = bodyY - bodyH * 0.1 + Math.sin(Math.PI * 0.7) * bodyH * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(leftArmEndX, leftArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#3cb371';
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY, 6, 0, Math.PI * 2);
    ctx.fill();
    // 指节
    ctx.fillStyle = '#228b22';
    ctx.beginPath();
    ctx.arc(leftArmEndX - 4, leftArmEndY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(leftArmEndX + 2, leftArmEndY - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // 右臂 - 重力球
    const rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.5) * bodyH * 0.55;
    const rightArmEndY = bodyY - bodyH * 0.15 + Math.sin(-Math.PI * 0.5) * bodyH * 0.55;
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.15);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#3cb371';
    ctx.beginPath();
    ctx.arc(rightArmEndX, rightArmEndY, 7, 0, Math.PI * 2);
    ctx.fill();

    // 重力能量球
    const gravityPulse = Math.sin(time * 3) * 0.25 + 0.75;
    ctx.save();
    ctx.translate(rightArmEndX + 12, rightArmEndY);
    ctx.rotate(time * 1.5);
    ctx.shadowColor = '#228b22';
    ctx.shadowBlur = 20 + gravityPulse * 15;

    ctx.fillStyle = `rgba(34,139,34,${gravityPulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, 15 + gravityPulse * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(50,200,50,${gravityPulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, 0, 10 + gravityPulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(100,255,100,${gravityPulse * 0.7})`;
    ctx.beginPath();
    ctx.arc(0, 0, 5 + gravityPulse * 2, 0, Math.PI * 2);
    ctx.fill();

    // 旋转碎石
    for (let i = 0; i < 6; i++) {
      const sa = (Math.PI * 2 / 6) * i + time * 3;
      const sr = 12 + Math.sin(time * 5 + i) * 4;
      const stoneX = Math.cos(sa) * sr;
      const stoneY = Math.sin(sa) * sr;
      ctx.fillStyle = `rgba(80,70,50,${gravityPulse * 0.6})`;
      ctx.beginPath();
      ctx.arc(stoneX, stoneY, 2 + Math.sin(time * 7 + i) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 头部 - 愤怒表情
    ctx.fillStyle = '#228b22';
    ctx.beginPath();
    ctx.arc(x, headY, headR * 1.05, 0, Math.PI * 2);
    ctx.fill();

    // 额头纹理
    ctx.strokeStyle = '#1a6b1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.3, headY - headR * 0.15);
    ctx.lineTo(x - headR * 0.1, headY - headR * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.3, headY - headR * 0.15);
    ctx.lineTo(x + headR * 0.1, headY - headR * 0.05);
    ctx.stroke();

    // 愤怒的眼睛
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x - headR * 0.25, headY - headR * 0.05, headR * 0.15, headR * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + headR * 0.25, headY - headR * 0.05, headR * 0.15, headR * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x - headR * 0.22, headY - headR * 0.08, headR * 0.04, headR * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + headR * 0.22, headY - headR * 0.08, headR * 0.04, headR * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // 浓眉
    ctx.strokeStyle = '#1a6b1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.4, headY - headR * 0.18);
    ctx.lineTo(x - headR * 0.1, headY - headR * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.1, headY - headR * 0.12);
    ctx.lineTo(x + headR * 0.4, headY - headR * 0.18);
    ctx.stroke();

    // 鼻子
    ctx.fillStyle = '#1a6b1a';
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.12, headY + headR * 0.05);
    ctx.lineTo(x, headY + headR * 0.18);
    ctx.lineTo(x + headR * 0.12, headY + headR * 0.05);
    ctx.closePath();
    ctx.fill();

    // 愤怒的嘴巴
    ctx.strokeStyle = '#1a6b1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.25, headY + headR * 0.25);
    ctx.lineTo(x - headR * 0.15, headY + headR * 0.35);
    ctx.lineTo(x, headY + headR * 0.32);
    ctx.lineTo(x + headR * 0.15, headY + headR * 0.35);
    ctx.lineTo(x + headR * 0.25, headY + headR * 0.25);
    ctx.stroke();

    // 牙齿
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.rect(x - headR * 0.08, headY + headR * 0.3, headR * 0.06, headR * 0.1);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(x + headR * 0.02, headY + headR * 0.3, headR * 0.06, headR * 0.1);
    ctx.fill();

    // 等级特效
    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = '#228b22';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(34,139,34,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.5, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = '#228b22';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(34,139,34,0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ================================================================
  // 默认塔渲染
  // ================================================================
  _drawDefaultTower(x, y, type, cell, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#8a8a8a';
    ctx.beginPath();
    ctx.arc(x, y - cell * 0.05, cell * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawSnowflake(cx, cy, size, color, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.5);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.5, -size * 0.866 * 0.5);
      ctx.lineTo(size * 0.5, size * 0.866 * 0.5);
      ctx.stroke();
      ctx.rotate(Math.PI / 3);
    }
    ctx.restore();
  }

  _drawSynergyLinks(time, links) {
    const ctx = this.ctx;
    links.forEach(link => {
      if (!link || !link.from || !link.to) return;
      ctx.save();
      ctx.strokeStyle = `rgba(168,204,85,${0.3 + Math.sin(time * 3) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#a8cc55';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(link.from.x, link.from.y);
      ctx.lineTo(link.to.x, link.to.y);
      ctx.stroke();
      ctx.restore();
    });
  }

  // ================================================================
  // 6. Shield（护盾发生器）- 美国队长 Captain America
  // 标志性特征：蓝白制服、星星标志、圆形振金盾牌、头盔A字
  // ================================================================
  _drawShieldCaptain(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob, tower) {
    const ctx = this.ctx;
    const turretAngle = tower ? tower.turretAngle : -Math.PI / 2;

    // 护盾平台
    this._drawGroundGlow(x, platY, platR, '#4a88cc', time);
    this._drawCirclePlatform(x, platY, platR, '#0a1a2a', '#4a88cc', 0.7);

    // 平台星纹（等级越高越多）
    const starCount = 4 + level * 2;
    for (let i = 0; i < starCount; i++) {
      const a = (Math.PI * 2 / starCount) * i + time * 0.3;
      const fx = x + Math.cos(a) * platR * 0.7;
      const fy = platY + Math.sin(a) * platR * 0.35;
      ctx.save();
      ctx.shadowColor = '#4a88cc';
      ctx.shadowBlur = 6 + level;
      ctx.fillStyle = `rgba(74,136,204,${0.4 + Math.sin(time * 2 + i) * 0.3})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3级特效：圣骑士光环
    if (level >= 3) {
      this._drawMagicCircle(ctx, x, bodyY - bodyH * 0.1, platR * 0.85, '#88ccff', time * -0.5, 8);
    }

    // 腿部 - 蓝色战术裤
    ctx.fillStyle = '#2a4a7a';
    ctx.fillRect(x - 7, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    ctx.fillRect(x + 3, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    // 红色靴子
    ctx.fillStyle = '#cc3322';
    ctx.fillRect(x - 8, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 8, 5);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 8, 5);

    // 身体 - 蓝白制服
    const uniformGrad = ctx.createLinearGradient(x, bodyY - bodyH * 0.4, x, bodyY + bodyH * 0.5);
    uniformGrad.addColorStop(0, '#3a68aa');
    uniformGrad.addColorStop(1, '#2a4a7a');
    ctx.fillStyle = uniformGrad;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.lineTo(x - bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.closePath();
    ctx.fill();

    // 白色条纹（腹部）
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.5, bodyY + bodyH * 0.1);
    ctx.lineTo(x - bodyW * 0.55, bodyY + bodyH * 0.4);
    ctx.lineTo(x, bodyY + bodyH * 0.5);
    ctx.lineTo(x + bodyW * 0.55, bodyY + bodyH * 0.4);
    ctx.lineTo(x + bodyW * 0.5, bodyY + bodyH * 0.1);
    ctx.closePath();
    ctx.fill();

    // 红白条纹（腰带）
    ctx.fillStyle = '#cc3322';
    ctx.fillRect(x - bodyW * 0.55, bodyY + bodyH * 0.05, bodyW * 1.1, 4);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(x - bodyW * 0.55, bodyY + bodyH * 0.09, bodyW * 1.1, 3);

    // 胸前星星标志
    ctx.save();
    ctx.shadowColor = '#ffdd44';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffdd44';
    this._drawStarShape(x, bodyY - bodyH * 0.1, bodyW * 0.22);
    ctx.restore();

    // 左臂
    ctx.strokeStyle = '#3a68aa';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const leftArmEndX = x - bodyW / 2 + Math.cos(Math.PI * 0.6) * bodyH * 0.55;
    const leftArmEndY = bodyY - bodyH * 0.1 + Math.sin(Math.PI * 0.6) * bodyH * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(leftArmEndX, leftArmEndY);
    ctx.stroke();
    // 红色手套
    ctx.fillStyle = '#cc3322';
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 右臂 - 持盾
    const rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.5) * bodyH * 0.5;
    const rightArmEndY = bodyY - bodyH * 0.1 + Math.sin(-Math.PI * 0.5) * bodyH * 0.5;
    ctx.strokeStyle = '#3a68aa';
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#cc3322';
    ctx.beginPath();
    ctx.arc(rightArmEndX, rightArmEndY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 圆形振金盾牌 - 美国队长标志性武器
    const shieldX = rightArmEndX + bodyH * 0.35;
    const shieldY = rightArmEndY;
    const shieldR = bodyH * 0.45;
    const shieldPulse = Math.sin(time * 2) * 0.05 + 1;
    ctx.save();
    ctx.translate(shieldX, shieldY);
    ctx.scale(shieldPulse, shieldPulse);
    ctx.shadowColor = '#4a88cc';
    ctx.shadowBlur = 15;

    // 盾牌外圈 - 红色
    ctx.fillStyle = '#cc3322';
    ctx.beginPath();
    ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
    ctx.fill();
    // 白色环
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(0, 0, shieldR * 0.78, 0, Math.PI * 2);
    ctx.fill();
    // 红色环
    ctx.fillStyle = '#cc3322';
    ctx.beginPath();
    ctx.arc(0, 0, shieldR * 0.56, 0, Math.PI * 2);
    ctx.fill();
    // 蓝色中心
    ctx.fillStyle = '#3a68aa';
    ctx.beginPath();
    ctx.arc(0, 0, shieldR * 0.34, 0, Math.PI * 2);
    ctx.fill();
    // 中心星星
    ctx.fillStyle = '#ffdd44';
    ctx.shadowColor = '#ffdd44';
    ctx.shadowBlur = 8;
    this._drawStarShape(0, 0, shieldR * 0.22);
    // 盾牌高光
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(-shieldR * 0.3, -shieldR * 0.3, shieldR * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 头部
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // 蓝色头盔
    ctx.fillStyle = '#3a68aa';
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.25, headR * 0.95, -Math.PI * 0.95, -Math.PI * 0.05);
    ctx.fill();

    // 头盔两侧翅膀（美国队长标志）
    const wingFlap = Math.sin(time * 2) * 0.05;
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.7, headY - headR * 0.35);
    ctx.quadraticCurveTo(x - headR * 1.3 + wingFlap * 10, headY - headR * 0.55, x - headR * 1.4, headY - headR * 0.2);
    ctx.quadraticCurveTo(x - headR * 1.1, headY - headR * 0.15, x - headR * 0.7, headY - headR * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.7, headY - headR * 0.35);
    ctx.quadraticCurveTo(x + headR * 1.3 - wingFlap * 10, headY - headR * 0.55, x + headR * 1.4, headY - headR * 0.2);
    ctx.quadraticCurveTo(x + headR * 1.1, headY - headR * 0.15, x + headR * 0.7, headY - headR * 0.2);
    ctx.closePath();
    ctx.fill();

    // 头盔金色边框
    ctx.save();
    ctx.shadowColor = '#ffdd44';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = '#ffdd44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.25, headR * 0.95, -Math.PI * 0.95, -Math.PI * 0.05);
    ctx.stroke();
    ctx.restore();

    // 头盔A字标志
    ctx.fillStyle = '#f0f0f0';
    ctx.font = `bold ${Math.max(8, headR * 0.5)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', x, headY - headR * 0.55);

    // 面罩下眼睛
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x - headR * 0.25, headY + headR * 0.05, headR * 0.12, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + headR * 0.25, headY + headR * 0.05, headR * 0.12, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a385a';
    ctx.beginPath();
    ctx.arc(x - headR * 0.25, headY + headR * 0.05, headR * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + headR * 0.25, headY + headR * 0.05, headR * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 护盾光环
    const auraPulse = Math.sin(time * 3) * 0.15 + 0.85;
    ctx.save();
    ctx.strokeStyle = `rgba(74,136,204,${auraPulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#4a88cc';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, bodyY, platR * 1.3 * auraPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 等级特效
    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = '#4a88cc';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(74,136,204,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.6, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = '#4a88cc';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(74,136,204,0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 绘制五角星辅助方法
  _drawStarShape(cx, cy, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerA = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const innerA = outerA + Math.PI / 5;
      ctx.lineTo(cx + Math.cos(outerA) * r, cy + Math.sin(outerA) * r);
      ctx.lineTo(cx + Math.cos(innerA) * r * 0.5, cy + Math.sin(innerA) * r * 0.5);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ================================================================
  // 7. Collector（能量采集器）- 黑豹 Black Panther
  // 标志性特征：振金战衣、紫色发光纹路、黑豹面具、能量球
  // ================================================================
  _drawCollectorPanther(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob) {
    const ctx = this.ctx;

    // 振金平台
    this._drawGroundGlow(x, platY, platR, '#9a4dcc', time);
    this._drawCirclePlatform(x, platY, platR, '#0a0512', '#9a4dcc', 0.7);

    // 平台紫色能量纹
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i + time * 0.5;
      const fx = x + Math.cos(a) * platR * 0.7;
      const fy = platY + Math.sin(a) * platR * 0.35;
      ctx.save();
      ctx.shadowColor = '#9a4dcc';
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(154,77,204,${0.4 + Math.sin(time * 3 + i) * 0.3})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 腿部 - 黑色振金战衣
    ctx.fillStyle = '#1a0a2a';
    ctx.fillRect(x - 7, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    ctx.fillRect(x + 3, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    // 紫色靴纹
    ctx.fillStyle = '#9a4dcc';
    ctx.fillRect(x - 7, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 6, 3);
    ctx.fillRect(x + 3, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 6, 3);

    // 身体 - 振金战衣（黑色带紫色纹路）
    const suitGrad = ctx.createRadialGradient(x, bodyY, 0, x, bodyY, bodyW * 0.8);
    suitGrad.addColorStop(0, '#2a1a3a');
    suitGrad.addColorStop(1, '#0a0512');
    ctx.fillStyle = suitGrad;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.lineTo(x - bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.closePath();
    ctx.fill();

    // 紫色能量纹路（振金战衣特征）
    const veinPulse = Math.sin(time * 3) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = '#9a4dcc';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(154,77,204,${veinPulse})`;
    ctx.lineWidth = 1.5;
    // 胸前V形纹路
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.3, bodyY - bodyH * 0.2);
    ctx.lineTo(x, bodyY + bodyH * 0.1);
    ctx.lineTo(x + bodyW * 0.3, bodyY - bodyH * 0.2);
    ctx.stroke();
    // 侧纹
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.4, bodyY);
    ctx.lineTo(x - bodyW * 0.35, bodyY + bodyH * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + bodyW * 0.4, bodyY);
    ctx.lineTo(x + bodyW * 0.35, bodyY + bodyH * 0.3);
    ctx.stroke();
    ctx.restore();

    // 银色项链装饰
    ctx.fillStyle = '#c0c0d0';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.3, bodyY - bodyH * 0.25);
    ctx.lineTo(x, bodyY - bodyH * 0.15);
    ctx.lineTo(x + bodyW * 0.3, bodyY - bodyH * 0.25);
    ctx.lineTo(x + bodyW * 0.25, bodyY - bodyH * 0.2);
    ctx.lineTo(x, bodyY - bodyH * 0.1);
    ctx.lineTo(x - bodyW * 0.25, bodyY - bodyH * 0.2);
    ctx.closePath();
    ctx.fill();

    // 左臂
    ctx.strokeStyle = '#1a0a2a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const leftArmEndX = x - bodyW / 2 + Math.cos(Math.PI * 0.6) * bodyH * 0.55;
    const leftArmEndY = bodyY - bodyH * 0.1 + Math.sin(Math.PI * 0.6) * bodyH * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(leftArmEndX, leftArmEndY);
    ctx.stroke();
    // 振金爪手套
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY, 5, 0, Math.PI * 2);
    ctx.fill();
    // 紫色爪
    ctx.strokeStyle = `rgba(154,77,204,${veinPulse})`;
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(leftArmEndX + i * 2, leftArmEndY);
      ctx.lineTo(leftArmEndX + i * 3, leftArmEndY + 5);
      ctx.stroke();
    }

    // 右臂 - 能量采集
    const rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.5) * bodyH * 0.5;
    const rightArmEndY = bodyY - bodyH * 0.1 + Math.sin(-Math.PI * 0.5) * bodyH * 0.5;
    ctx.strokeStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.arc(rightArmEndX, rightArmEndY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 能量球 - 黑豹振金能量
    const energyPulse = Math.sin(time * 4) * 0.3 + 0.7;
    ctx.save();
    ctx.translate(rightArmEndX + 12, rightArmEndY);
    ctx.shadowColor = '#9a4dcc';
    ctx.shadowBlur = 20 * energyPulse;
    // 外层光晕
    ctx.fillStyle = `rgba(154,77,204,${energyPulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + energyPulse * 4, 0, Math.PI * 2);
    ctx.fill();
    // 中层
    ctx.fillStyle = `rgba(180,100,230,${energyPulse * 0.6})`;
    ctx.beginPath();
    ctx.arc(0, 0, 9 + energyPulse * 2, 0, Math.PI * 2);
    ctx.fill();
    // 核心
    ctx.fillStyle = `rgba(220,160,255,${energyPulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 5 + energyPulse, 0, Math.PI * 2);
    ctx.fill();
    // 旋转能量粒子
    for (let i = 0; i < 5; i++) {
      const pa = (Math.PI * 2 / 5) * i + time * 3;
      const pr = 12 + Math.sin(time * 5 + i) * 3;
      ctx.fillStyle = `rgba(200,140,255,${energyPulse * 0.7})`;
      ctx.beginPath();
      ctx.arc(Math.cos(pa) * pr, Math.sin(pa) * pr, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 头部 - 黑豹面具
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.arc(x, headY, headR * 1.05, 0, Math.PI * 2);
    ctx.fill();

    // 黑豹耳朵
    ctx.fillStyle = '#0a0512';
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.6, headY - headR * 0.4);
    ctx.lineTo(x - headR * 0.9, headY - headR * 1.0);
    ctx.lineTo(x - headR * 0.35, headY - headR * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.6, headY - headR * 0.4);
    ctx.lineTo(x + headR * 0.9, headY - headR * 1.0);
    ctx.lineTo(x + headR * 0.35, headY - headR * 0.55);
    ctx.closePath();
    ctx.fill();

    // 面具银色纹路
    ctx.strokeStyle = '#c0c0d0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.5, headY - headR * 0.3);
    ctx.lineTo(x - headR * 0.3, headY + headR * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.5, headY - headR * 0.3);
    ctx.lineTo(x + headR * 0.3, headY + headR * 0.2);
    ctx.stroke();

    // 发光的紫色眼睛（黑豹标志特征）
    const eyeGlow = Math.sin(time * 4) * 0.2 + 0.8;
    ctx.save();
    ctx.shadowColor = '#cc66ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = `rgba(204,102,255,${eyeGlow})`;
    ctx.beginPath();
    ctx.ellipse(x - headR * 0.28, headY - headR * 0.05, headR * 0.14, headR * 0.08, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + headR * 0.28, headY - headR * 0.05, headR * 0.14, headR * 0.08, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 鼻子
    ctx.fillStyle = '#0a0512';
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.08, headY + headR * 0.1);
    ctx.lineTo(x, headY + headR * 0.22);
    ctx.lineTo(x + headR * 0.08, headY + headR * 0.1);
    ctx.closePath();
    ctx.fill();

    // 等级特效
    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = '#9a4dcc';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(154,77,204,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.6, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = '#9a4dcc';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(154,77,204,0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ================================================================
  // 8. Plasma（等离子炮）- 惊奇队长 Captain Marvel
  // 标志性特征：红蓝战衣、金色星星、能量光环、发光拳头
  // ================================================================
  _drawPlasmaCaptain(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob) {
    const ctx = this.ctx;

    // 能量平台
    this._drawGroundGlow(x, platY, platR, '#ff66aa', time);
    this._drawCirclePlatform(x, platY, platR, '#1a0512', '#ff66aa', 0.7);

    // 平台能量粒子
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i + time * 0.4;
      const fx = x + Math.cos(a) * platR * 0.7;
      const fy = platY + Math.sin(a) * platR * 0.35;
      ctx.save();
      ctx.shadowColor = '#ff66aa';
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(255,102,170,${0.4 + Math.sin(time * 3 + i) * 0.3})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 腿部 - 蓝色战衣裤
    ctx.fillStyle = '#1a3a8a';
    ctx.fillRect(x - 7, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    ctx.fillRect(x + 3, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    // 红色靴子
    ctx.fillStyle = '#cc2244';
    ctx.fillRect(x - 8, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 8, 5);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 8, 5);

    // 身体 - 红蓝战衣
    const suitGrad = ctx.createLinearGradient(x, bodyY - bodyH * 0.4, x, bodyY + bodyH * 0.5);
    suitGrad.addColorStop(0, '#cc2244');
    suitGrad.addColorStop(0.5, '#cc2244');
    suitGrad.addColorStop(0.5, '#1a3a8a');
    suitGrad.addColorStop(1, '#1a3a8a');
    ctx.fillStyle = '#cc2244';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.lineTo(x - bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.closePath();
    ctx.fill();

    // 蓝色下半身
    ctx.fillStyle = '#1a3a8a';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.6, bodyY + bodyH * 0.1);
    ctx.lineTo(x - bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.1);
    ctx.closePath();
    ctx.fill();

    // 金色腰带条纹
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(x - bodyW * 0.6, bodyY + bodyH * 0.08, bodyW * 1.2, 3);
    ctx.shadowColor = '#ffdd44';
    ctx.shadowBlur = 6;
    ctx.fillRect(x - bodyW * 0.6, bodyY + bodyH * 0.08, bodyW * 1.2, 3);
    ctx.shadowBlur = 0;

    // 胸前金色星星（惊奇队长标志）
    ctx.save();
    ctx.shadowColor = '#ffdd44';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffdd44';
    this._drawStarShape(x, bodyY - bodyH * 0.1, bodyW * 0.25);
    ctx.restore();

    // 左臂
    ctx.strokeStyle = '#cc2244';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const leftArmEndX = x - bodyW / 2 + Math.cos(Math.PI * 0.6) * bodyH * 0.55;
    const leftArmEndY = bodyY - bodyH * 0.1 + Math.sin(Math.PI * 0.6) * bodyH * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(leftArmEndX, leftArmEndY);
    ctx.stroke();
    // 金色护腕
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(leftArmEndX - 4, leftArmEndY - 2, 8, 4);

    // 右臂 - 能量拳
    const rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.5) * bodyH * 0.5;
    const rightArmEndY = bodyY - bodyH * 0.1 + Math.sin(-Math.PI * 0.5) * bodyH * 0.5;
    ctx.strokeStyle = '#cc2244';
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();

    // 发光能量拳（惊奇队长标志）
    const fistPulse = Math.sin(time * 5) * 0.3 + 0.7;
    ctx.save();
    ctx.translate(rightArmEndX + 8, rightArmEndY);
    ctx.shadowColor = '#ff66aa';
    ctx.shadowBlur = 20 * fistPulse;
    // 外层光晕
    ctx.fillStyle = `rgba(255,102,170,${fistPulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + fistPulse * 4, 0, Math.PI * 2);
    ctx.fill();
    // 能量核心
    ctx.fillStyle = `rgba(255,180,220,${fistPulse * 0.7})`;
    ctx.beginPath();
    ctx.arc(0, 0, 9 + fistPulse * 2, 0, Math.PI * 2);
    ctx.fill();
    // 中心
    ctx.fillStyle = `rgba(255,240,250,${fistPulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 5 + fistPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 头部
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // 头发（金色短发）
    ctx.fillStyle = '#ddaa44';
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.2, headR * 0.95, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.fill();

    // 头盔（红色）
    ctx.fillStyle = '#cc2244';
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.25, headR * 0.9, -Math.PI * 0.9, -Math.PI * 0.1);
    ctx.fill();

    // 头盔金色边框
    ctx.save();
    ctx.shadowColor = '#ffdd44';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = '#ffdd44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.25, headR * 0.9, -Math.PI * 0.9, -Math.PI * 0.1);
    ctx.stroke();
    ctx.restore();

    // 面罩眼罩
    ctx.fillStyle = '#1a0512';
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.55, headY - headR * 0.1);
    ctx.lineTo(x - headR * 0.55, headY + headR * 0.15);
    ctx.lineTo(x - headR * 0.15, headY + headR * 0.05);
    ctx.lineTo(x - headR * 0.15, headY - headR * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + headR * 0.55, headY - headR * 0.1);
    ctx.lineTo(x + headR * 0.55, headY + headR * 0.15);
    ctx.lineTo(x + headR * 0.15, headY + headR * 0.05);
    ctx.lineTo(x + headR * 0.15, headY - headR * 0.1);
    ctx.closePath();
    ctx.fill();

    // 发光眼睛
    const eyeGlow = Math.sin(time * 4) * 0.2 + 0.8;
    ctx.save();
    ctx.shadowColor = '#ff88cc';
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(255,170,238,${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(x - headR * 0.32, headY + headR * 0.02, headR * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + headR * 0.32, headY + headR * 0.02, headR * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 能量光环（惊奇队长标志特征）
    const auraPulse = Math.sin(time * 3) * 0.15 + 0.85;
    ctx.save();
    ctx.translate(x, bodyY);
    ctx.shadowColor = '#ff66aa';
    ctx.shadowBlur = 18;
    // 外光环
    ctx.strokeStyle = `rgba(255,102,170,${auraPulse * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, platR * 1.3 * auraPulse, 0, Math.PI * 2);
    ctx.stroke();
    // 内光环
    ctx.strokeStyle = `rgba(255,180,220,${auraPulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, platR * 1.1 * auraPulse, 0, Math.PI * 2);
    ctx.stroke();
    // 旋转能量粒子
    for (let i = 0; i < 8; i++) {
      const pa = (Math.PI * 2 / 8) * i + time * 2;
      const pr = platR * 1.3;
      ctx.fillStyle = `rgba(255,150,200,${auraPulse * 0.6})`;
      ctx.beginPath();
      ctx.arc(Math.cos(pa) * pr, Math.sin(pa) * pr, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 等级特效
    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = '#ff66aa';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(255,102,170,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.6, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = '#ff66aa';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(255,102,170,0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ================================================================
  // 9. Repair（修复站）- 蜘蛛侠 Spider-Man
  // 标志性特征：红蓝战衣、白色大眼罩、蜘蛛图案、蛛网发射器
  // ================================================================
  _drawRepairSpider(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob) {
    const ctx = this.ctx;

    // 蛛网平台
    this._drawGroundGlow(x, platY, platR, '#cc2233', time);
    this._drawCirclePlatform(x, platY, platR, '#1a0a0a', '#cc2233', 0.7);

    // 平台蛛网纹
    ctx.save();
    ctx.strokeStyle = `rgba(204,34,51,${0.3 + Math.sin(time * 2) * 0.2})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, platY);
      ctx.lineTo(x + Math.cos(a) * platR * 0.75, platY + Math.sin(a) * platR * 0.3);
      ctx.stroke();
    }
    // 蛛网环
    for (let r = 0.3; r <= 0.7; r += 0.2) {
      ctx.beginPath();
      ctx.ellipse(x, platY, platR * r, platR * r * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 腿部 - 蓝色战衣裤
    ctx.fillStyle = '#1a3a8a';
    ctx.fillRect(x - 7, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    ctx.fillRect(x + 3, bodyY + bodyH / 2 - 5, 6, bodyH * 0.45);
    // 红色靴子
    ctx.fillStyle = '#cc2233';
    ctx.fillRect(x - 8, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 8, 5);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 + bodyH * 0.45 - 5, 8, 5);

    // 身体 - 红蓝战衣
    ctx.fillStyle = '#cc2233';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.lineTo(x - bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.55, bodyY - bodyH * 0.35);
    ctx.closePath();
    ctx.fill();

    // 蓝色下半身
    ctx.fillStyle = '#1a3a8a';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.6, bodyY + bodyH * 0.1);
    ctx.lineTo(x - bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.6, bodyY + bodyH * 0.1);
    ctx.closePath();
    ctx.fill();

    // 蜘蛛图案（蜘蛛侠标志）- 黑色蜘蛛
    ctx.fillStyle = '#1a1a1a';
    // 蜘蛛身体
    ctx.beginPath();
    ctx.ellipse(x, bodyY - bodyH * 0.05, bodyW * 0.08, bodyH * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // 蜘蛛头
    ctx.beginPath();
    ctx.arc(x, bodyY - bodyH * 0.18, bodyW * 0.06, 0, Math.PI * 2);
    ctx.fill();
    // 蜘蛛腿（上）
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * bodyW * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, bodyY - bodyH * 0.12);
      ctx.quadraticCurveTo(x - bodyW * 0.2 + offset, bodyY - bodyH * 0.22, x - bodyW * 0.3 + offset, bodyY - bodyH * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, bodyY - bodyH * 0.12);
      ctx.quadraticCurveTo(x + bodyW * 0.2 - offset, bodyY - bodyH * 0.22, x + bodyW * 0.3 - offset, bodyY - bodyH * 0.15);
      ctx.stroke();
    }
    // 蜘蛛腿（下）
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * bodyW * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, bodyY);
      ctx.quadraticCurveTo(x - bodyW * 0.2 + offset, bodyY + bodyH * 0.1, x - bodyW * 0.3 + offset, bodyY + bodyH * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, bodyY);
      ctx.quadraticCurveTo(x + bodyW * 0.2 - offset, bodyY + bodyH * 0.1, x + bodyW * 0.3 - offset, bodyY + bodyH * 0.05);
      ctx.stroke();
    }

    // 左臂
    ctx.strokeStyle = '#cc2233';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const leftArmEndX = x - bodyW / 2 + Math.cos(Math.PI * 0.6) * bodyH * 0.55;
    const leftArmEndY = bodyY - bodyH * 0.1 + Math.sin(Math.PI * 0.6) * bodyH * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(leftArmEndX, leftArmEndY);
    ctx.stroke();
    // 蓝色手套
    ctx.fillStyle = '#1a3a8a';
    ctx.beginPath();
    ctx.arc(leftArmEndX, leftArmEndY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 右臂 - 蛛网发射
    const rightArmEndX = x + bodyW / 2 + Math.cos(-Math.PI * 0.5) * bodyH * 0.5;
    const rightArmEndY = bodyY - bodyH * 0.1 + Math.sin(-Math.PI * 0.5) * bodyH * 0.5;
    ctx.strokeStyle = '#cc2233';
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.1);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();
    ctx.fillStyle = '#1a3a8a';
    ctx.beginPath();
    ctx.arc(rightArmEndX, rightArmEndY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 蛛网发射器/修复工具
    const webPulse = Math.sin(time * 4) * 0.3 + 0.7;
    ctx.save();
    ctx.translate(rightArmEndX + 8, rightArmEndY);
    ctx.shadowColor = '#66aacc';
    ctx.shadowBlur = 10 * webPulse;
    // 工具主体
    ctx.fillStyle = '#666666';
    ctx.fillRect(-3, -5, 6, 10);
    // 发光核心
    ctx.fillStyle = `rgba(100,200,255,${webPulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    // 蛛网射线
    ctx.strokeStyle = `rgba(200,230,255,${webPulse * 0.6})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const wa = (Math.PI / 4) * i - Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(wa) * 10, Math.sin(wa) * 10);
      ctx.stroke();
    }
    ctx.restore();

    // 头部 - 红色面具
    ctx.fillStyle = '#cc2233';
    ctx.beginPath();
    ctx.arc(x, headY, headR * 1.05, 0, Math.PI * 2);
    ctx.fill();

    // 面具蛛网纹路
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.8;
    // 放射线
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, headY);
      ctx.lineTo(x + Math.cos(a) * headR * 0.9, headY + Math.sin(a) * headR * 0.9);
      ctx.stroke();
    }
    // 蛛网弧线
    for (let r = 0.3; r <= 0.8; r += 0.25) {
      ctx.beginPath();
      ctx.arc(x, headY, headR * r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 白色大眼罩（蜘蛛侠标志特征）
    const eyeShine = Math.sin(time * 3) * 0.1 + 0.9;
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.fillStyle = `rgba(255,255,255,${eyeShine})`;
    // 左眼（倾斜的椭圆）
    ctx.beginPath();
    ctx.ellipse(x - headR * 0.32, headY - headR * 0.05, headR * 0.22, headR * 0.32, 0.25, 0, Math.PI * 2);
    ctx.fill();
    // 右眼
    ctx.beginPath();
    ctx.ellipse(x + headR * 0.32, headY - headR * 0.05, headR * 0.22, headR * 0.32, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 眼罩黑色边框
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x - headR * 0.32, headY - headR * 0.05, headR * 0.22, headR * 0.32, 0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + headR * 0.32, headY - headR * 0.05, headR * 0.22, headR * 0.32, -0.25, 0, Math.PI * 2);
    ctx.stroke();

    // 眼罩反光
    ctx.fillStyle = 'rgba(150,200,230,0.6)';
    ctx.beginPath();
    ctx.arc(x - headR * 0.38, headY - headR * 0.15, headR * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + headR * 0.26, headY - headR * 0.15, headR * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // 修复光环
    const healPulse = Math.sin(time * 3) * 0.15 + 0.85;
    ctx.save();
    ctx.strokeStyle = `rgba(102,170,204,${healPulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#66aacc';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, bodyY, platR * 1.3 * healPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 等级特效
    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = '#cc2233';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(204,34,51,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.6, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = '#cc2233';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(204,34,51,0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ================================================================
  // P4-2 10. 召唤塔 - 暗影萨满（粉色魔法阵 + 骷髅法杖 + 召唤光门）
  // 标志性特征：法阵、骷髅杖、漩涡传送门
  // ================================================================
  _drawSummonerShaman(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob) {
    const ctx = this.ctx;
    // P4-8：取皮肤色（用于平台 glow / 符文色）
    const skin = this._resolveSkinColors({ type, skin: `${type.id}_default` });
    const baseColor = (skin && skin.color) || '#ff88cc';
    const glowColor = (skin && skin.glowColor) || 'rgba(255,136,204,0.4)';

    // 魔法阵平台（六芒星）
    this._drawGroundGlow(x, platY, platR, baseColor, time);
    this._drawPolyPlatform(x, platY, platR, 6, Math.PI / 6, '#1a0512', baseColor, 0.7);

    // 旋转符文
    ctx.save();
    ctx.translate(x, platY);
    ctx.rotate(time * 0.6);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      const fx = Math.cos(a) * platR * 0.7;
      const fy = Math.sin(a) * platR * 0.35;
      ctx.moveTo(0, 0);
      ctx.lineTo(fx, fy);
    }
    ctx.stroke();
    ctx.restore();

    // 腿部
    ctx.fillStyle = '#3a0a2a';
    ctx.fillRect(x - 6, bodyY + bodyH / 2 - 5, 5, bodyH * 0.45);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 - 5, 5, bodyH * 0.45);
    ctx.fillStyle = baseColor;
    ctx.fillRect(x - 6, bodyY + bodyH / 2 - 5, 5, 3);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 - 5, 5, 3);

    // 长袍
    ctx.fillStyle = '#1a0512';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.6, bodyY - bodyH * 0.3);
    ctx.lineTo(x - bodyW * 0.75, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.75, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.6, bodyY - bodyH * 0.3);
    ctx.closePath();
    ctx.fill();

    // 长袍纹路
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, bodyY - bodyH * 0.2);
    ctx.lineTo(x, bodyY + bodyH * 0.4);
    ctx.stroke();

    // 头部（苍白脸）
    ctx.fillStyle = '#d8c8d8';
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // 兜帽
    ctx.fillStyle = '#1a0512';
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.3, headR * 0.95, -Math.PI * 0.95, -Math.PI * 0.05);
    ctx.fill();

    // 兜帽尖角
    ctx.beginPath();
    ctx.moveTo(x, headY - headR * 0.3);
    ctx.lineTo(x - headR * 0.15, headY - headR * 1.5);
    ctx.lineTo(x + headR * 0.15, headY - headR * 1.5);
    ctx.closePath();
    ctx.fill();

    // 眼睛（发光的紫红）
    const eyeGlow = Math.sin(time * 4) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = `rgba(255, 100, 200, ${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(x - headR * 0.28, headY - headR * 0.05, headR * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + headR * 0.28, headY - headR * 0.05, headR * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 骷髅法杖
    const staffEndX = x + bodyW / 2 + 12;
    const staffEndY = bodyY - bodyH * 0.25;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + bodyW / 2, bodyY - bodyH * 0.15);
    ctx.lineTo(staffEndX, staffEndY);
    ctx.stroke();

    // 骷髅头
    ctx.fillStyle = '#eee';
    ctx.beginPath();
    ctx.arc(staffEndX + 6, staffEndY - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    // 骷髅眼睛
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(staffEndX + 4, staffEndY - 7, 1.5, 0, Math.PI * 2);
    ctx.arc(staffEndX + 8, staffEndY - 7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 召唤漩涡（脚下法阵上方）
    const portalPulse = Math.sin(time * 3) * 0.3 + 0.7;
    ctx.save();
    ctx.translate(x, bodyY + bodyH * 0.3);
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 15 * portalPulse;
    ctx.strokeStyle = `rgba(255, 136, 204, ${portalPulse * 0.8})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + i * 5, time * 2 + i, time * 2 + i + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.restore();

    // 等级特效
    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.6, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = glowColor.replace('0.4', '0.25');
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ================================================================
  // P4-2 11. 诅咒塔 - 死灵法师（紫色邪眼 + 骷髅头 + 紫色火焰）
  // 标志性特征：紫色长袍、骷髅肩甲、诅咒符文
  // ================================================================
  _drawCurserNecro(x, platY, bodyY, headY, platR, bodyW, bodyH, headR, type, level, time, bob) {
    const ctx = this.ctx;
    const skin = this._resolveSkinColors({ type, skin: `${type.id}_default` });
    const baseColor = (skin && skin.color) || '#aa44ff';
    const glowColor = (skin && skin.glowColor) || 'rgba(170,68,255,0.4)';

    // 诅咒平台
    this._drawGroundGlow(x, platY, platR, baseColor, time);
    this._drawCirclePlatform(x, platY, platR, '#0a0014', baseColor, 0.7);

    // 紫色火焰地面
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i + time * 0.3;
      const fx = x + Math.cos(a) * platR * 0.7;
      const fy = platY + Math.sin(a) * platR * 0.35;
      const flamePulse = Math.sin(time * 4 + i) * 0.3 + 0.7;
      ctx.save();
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = `rgba(170, 68, 255, ${flamePulse * 0.8})`;
      ctx.beginPath();
      ctx.moveTo(fx, fy + 5);
      ctx.quadraticCurveTo(fx - 2, fy, fx, fy - 4 - flamePulse * 3);
      ctx.quadraticCurveTo(fx + 2, fy, fx, fy + 5);
      ctx.fill();
      ctx.restore();
    }

    // 腿部（黑色）
    ctx.fillStyle = '#0a0014';
    ctx.fillRect(x - 6, bodyY + bodyH / 2 - 5, 5, bodyH * 0.45);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 - 5, 5, bodyH * 0.45);
    // 紫色靴纹
    ctx.fillStyle = baseColor;
    ctx.fillRect(x - 6, bodyY + bodyH / 2 - 5, 5, 3);
    ctx.fillRect(x + 2, bodyY + bodyH / 2 - 5, 5, 3);

    // 黑色长袍
    ctx.fillStyle = '#0a0014';
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.6, bodyY - bodyH * 0.3);
    ctx.lineTo(x - bodyW * 0.75, bodyY + bodyH * 0.45);
    ctx.lineTo(x, bodyY + bodyH * 0.55);
    ctx.lineTo(x + bodyW * 0.75, bodyY + bodyH * 0.45);
    ctx.lineTo(x + bodyW * 0.6, bodyY - bodyH * 0.3);
    ctx.closePath();
    ctx.fill();

    // 紫色长袍纹路
    ctx.save();
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - bodyW * 0.4, bodyY - bodyH * 0.1);
    ctx.lineTo(x, bodyY + bodyH * 0.35);
    ctx.lineTo(x + bodyW * 0.4, bodyY - bodyH * 0.1);
    ctx.stroke();
    ctx.restore();

    // 骷髅肩甲
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.arc(x - bodyW * 0.5, bodyY - bodyH * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + bodyW * 0.5, bodyY - bodyH * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(x - bodyW * 0.5, bodyY - bodyH * 0.2, 1.5, 0, Math.PI * 2);
    ctx.arc(x + bodyW * 0.5, bodyY - bodyH * 0.2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 头部（骷髅脸）
    ctx.fillStyle = '#eee';
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // 兜帽
    ctx.fillStyle = '#0a0014';
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.25, headR * 0.95, -Math.PI * 0.95, -Math.PI * 0.05);
    ctx.fill();

    // 骷髅眼窝（发紫光）
    const eyeGlow = Math.sin(time * 3) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(170, 68, 255, ${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(x - headR * 0.3, headY - headR * 0.05, headR * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + headR * 0.3, headY - headR * 0.05, headR * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 嘴（牙齿）
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - headR * 0.25 + i * headR * 0.17, headY + headR * 0.2);
      ctx.lineTo(x - headR * 0.25 + i * headR * 0.17, headY + headR * 0.35);
      ctx.stroke();
    }

    // 法杖
    const staffEndX = x - bodyW / 2 - 8;
    const staffEndY = bodyY - bodyH * 0.4;
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - bodyW / 2, bodyY - bodyH * 0.2);
    ctx.lineTo(staffEndX, staffEndY);
    ctx.stroke();

    // 紫水晶
    ctx.save();
    ctx.translate(staffEndX - 6, staffEndY);
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(220, 150, 255, ${eyeGlow})`;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 诅咒光环
    const auraPulse = Math.sin(time * 3) * 0.15 + 0.85;
    ctx.save();
    ctx.strokeStyle = `rgba(170, 68, 255, ${auraPulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, bodyY, platR * 1.3 * auraPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 等级特效
    if (level >= 2) {
      ctx.save();
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 1.6, time * 2, time * 2 + Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    if (level >= 3) {
      ctx.save();
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = glowColor.replace('0.4', '0.25');
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, bodyY, platR * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}