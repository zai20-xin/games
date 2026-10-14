// ================================================================
// 敌人渲染 - Q版太空小怪兽风格（全Canvas绘制，暖色调可爱风格）
// ================================================================
import { CELL } from '../core/Constants.js';

/** 颜色工具：把 #rrggbb 转成 rgba 字符串（本地副本，避免依赖外部） */
function hexToAlphaLocal(hex, alpha) {
  const h = (hex || '#ff5533').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 255;
  const g = parseInt(h.substring(2, 4), 16) || 85;
  const b = parseInt(h.substring(4, 6), 16) || 51;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class EnemyRenderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * 渲染所有敌人
   */
  render(time, enemies) {
    const ctx = this.ctx;

    enemies.forEach(enemy => {
      // 死亡动画处理
      if (!enemy.alive) {
        if (enemy.deathAnim === undefined || enemy.deathAnim <= 0) return;
        const deathDuration = 0.4;
        const deathProgress = 1 - enemy.deathAnim / deathDuration;
        const cell = enemy.cellSize || CELL;
        const s = cell * 0.42 * enemy.size;

        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        this._drawDeathEffect(ctx, enemy, s, time, deathProgress);
        ctx.restore();

        // 死亡闪白
        this._drawHitFlash(ctx, enemy, s);
        return;
      }

      const cell = enemy.cellSize || CELL;
      const s = cell * 0.42 * enemy.size;
      const flash = enemy.hitFlash > 0;
      const isSlowed = enemy.slowTimer > 0;
      const isBurning = enemy.burnTimer > 0;
      const isPoisoned = enemy.poisonTimer > 0;

      // 地面阴影（所有敌人）- 受击缩放时阴影也变化
      const shadowScale = enemy.hitScale || 1.0;
      ctx.fillStyle = 'rgba(40,20,20,0.3)';
      ctx.beginPath();
      ctx.ellipse(enemy.x, enemy.y + s * 0.7, s * 0.7 * shadowScale, s * 0.25 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // === Boss 红色发光光环 ===
      if (enemy.isBoss) {
        this._drawBossAura(ctx, enemy, s, time);
      }

      // === 护盾/治疗光环 ===
      if (enemy.isShielded) {
        this._drawShieldAura(ctx, enemy, s, time);
      } else if (enemy.shieldWarningActive) {
        this._drawShieldWarning(ctx, enemy, s, time);
      }
      if (enemy.type === 'healer') {
        this._drawHealRange(ctx, enemy, s, time);
      }

      ctx.save();
      const yOffset = enemy.flying ? -5 : 0;
      // 行走身体上下浮动
      const walkBob = Math.sin((enemy.walkPhase || time * 4)) * s * 0.06;
      // 击退偏移
      const kbX = enemy.knockbackDx || 0;
      const kbY = enemy.knockbackDy || 0;
      ctx.translate(enemy.x + kbX, enemy.y + yOffset + walkBob + kbY);
      // 受击缩放
      const hitS = enemy.hitScale || 1.0;
      ctx.scale(hitS, hitS);

      // 警告期 alpha 闪烁
      if (enemy.shieldWarningActive) {
        const flick = 0.5 + Math.sin(time * 14) * 0.5;
        ctx.globalAlpha = 0.55 + flick * 0.45;
      }

      // 状态效果光环（在本体下面）
      if (isSlowed) {
        this._drawSlowAura(ctx, s, time);
      }
      if (isBurning) {
        this._drawBurnAura(ctx, s, time);
      }
      if (isPoisoned) {
        this._drawPoisonAura(ctx, s, time);
      }

      this._drawEnemySprite(ctx, enemy, s, flash, isSlowed, time);

      // 状态效果粒子（在本体上面）
      if (isBurning) {
        this._drawBurnParticles(ctx, s, time, enemy);
      }
      if (isPoisoned) {
        this._drawPoisonParticles(ctx, s, time, enemy);
      }

      ctx.restore();

      // 警告期结束后恢复 alpha
      if (enemy.shieldWarningActive) {
        ctx.globalAlpha = 1;
      }

      // 受击闪白
      this._drawHitFlash(ctx, enemy, s);

      // 血条
      const barOffsetY = enemy.flying
        ? yOffset - s * 1.15 - 4
        : -s * 1.15 - 4;
      this._drawHealthBar(ctx, enemy, cell, barOffsetY);

      // BOSS 标签
      if (enemy.isBoss) {
        this._drawBossLabel(ctx, enemy, cell, barOffsetY);
      }
    });
  }

  // ================================================================
  // Agent C: Boss 视觉专用
  // ================================================================

  /** Boss 红色发光光环（半透明圆 + 3px stroke + glow） */
  _drawBossAura(ctx, enemy, s, time) {
    const auraColor = enemy.auraColor || '#ff5533';
    const phase = enemy.phase || 1;
    // 阶段2时更暗、更红
    const pulse = phase === 2
      ? (0.55 + Math.sin(time * 6) * 0.25)  // 阶段2：更强烈、更快闪烁
      : (0.7 + Math.sin(time * 2) * 0.15);   // 阶段1：缓慢呼吸
    const auraR = s * 1.25;

    ctx.save();
    // 外层光晕（大圆，低透明度）
    const grd = ctx.createRadialGradient(enemy.x, enemy.y, s * 0.5, enemy.x, enemy.y, auraR);
    grd.addColorStop(0, hexToAlphaLocal(auraColor, 0.35 * pulse));
    grd.addColorStop(0.6, hexToAlphaLocal(auraColor, 0.15 * pulse));
    grd.addColorStop(1, hexToAlphaLocal(auraColor, 0));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, auraR, 0, Math.PI * 2);
    ctx.fill();

    // 中等光环（虚线环 + 旋转）
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(time * 0.6);
    ctx.strokeStyle = hexToAlphaLocal(auraColor, 0.7 * pulse);
    ctx.lineWidth = 2;
    ctx.setLineDash([s * 0.18, s * 0.12]);
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 内层粗 stroke 环（脉冲呼吸）
    ctx.strokeStyle = hexToAlphaLocal(auraColor, 0.85 * pulse);
    ctx.lineWidth = phase === 2 ? 4 : 3;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85 + Math.sin(time * 3) * s * 0.03, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 阶段2 闪烁 alpha（红光更狂躁）
    if (phase === 2) {
      const flicker = 0.4 + Math.sin(time * 18) * 0.3;
      ctx.globalAlpha = flicker * 0.3;
      ctx.fillStyle = '#ff2200';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, s * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /** BOSS 文字标签（HP条上方，红/橙） */
  _drawBossLabel(ctx, enemy, cell, barOffsetY) {
    const phase = enemy.phase || 1;
    const labelText = phase === 2 ? '⚠ BOSS ⚠' : '★ BOSS ★';
    const color = phase === 2 ? '#ff3322' : '#ff7733';
    const fontSize = 12;

    ctx.save();
    ctx.font = `900 ${fontSize}px 'Orbitron', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 暗色描边
    ctx.strokeStyle = 'rgba(20, 5, 5, 0.9)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    const labelY = enemy.y + barOffsetY - 12;
    ctx.strokeText(labelText, enemy.x, labelY);
    // 主色填充
    ctx.fillStyle = color;
    ctx.fillText(labelText, enemy.x, labelY);
    // 高光
    ctx.fillStyle = 'rgba(255, 230, 200, 0.6)';
    ctx.font = `900 ${fontSize * 0.55}px 'Orbitron', sans-serif`;
    ctx.fillText(labelText, enemy.x, labelY - fontSize * 0.2);
    ctx.restore();
  }

  // ================================================================
  // 通用绘制工具
  // ================================================================

  /** 颜色加深 */
  _darken(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
  }

  /** 颜色变浅/变亮 */
  _lighten(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, Math.floor(r + (255 - r) * factor))},${Math.min(255, Math.floor(g + (255 - g) * factor))},${Math.min(255, Math.floor(b + (255 - b) * factor))})`;
  }

  /** 绘制可爱的眼睛（大白眼+深色瞳孔+高光点） */
  _drawCuteEye(ctx, x, y, r, lookDir = 0) {
    // 眼白
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    // 瞳孔
    const px = x + lookDir * r * 0.15;
    ctx.fillStyle = '#332222';
    ctx.beginPath(); ctx.arc(px, y + r * 0.05, r * 0.55, 0, Math.PI * 2); ctx.fill();
    // 大高光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.3, 0, Math.PI * 2); ctx.fill();
    // 小高光
    ctx.beginPath(); ctx.arc(x + r * 0.2, y + r * 0.15, r * 0.12, 0, Math.PI * 2); ctx.fill();
  }

  /** 绘制腮红 */
  _drawBlush(ctx, x, y, rx, ry) {
    ctx.fillStyle = 'rgba(255,150,130,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  /** 绘制微笑嘴巴 */
  _drawSmile(ctx, x, y, w, type = 'smile') {
    ctx.strokeStyle = '#553333';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (type === 'smile') {
      ctx.arc(x, y - w * 0.3, w, 0.2, Math.PI - 0.2);
    } else if (type === 'open') {
      ctx.ellipse(x, y, w * 0.6, w * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#553333';
      ctx.fill();
    } else if (type === 'cat') {
      // 猫嘴：两个小弧
      ctx.moveTo(x - w * 0.6, y);
      ctx.quadraticCurveTo(x, y + w * 0.5, x, y);
      ctx.quadraticCurveTo(x, y + w * 0.5, x + w * 0.6, y);
    } else if (type === 'angry') {
      ctx.moveTo(x - w * 0.5, y + w * 0.2);
      ctx.lineTo(x, y - w * 0.1);
      ctx.lineTo(x + w * 0.5, y + w * 0.2);
    } else if (type === 'fangs') {
      ctx.arc(x, y - w * 0.3, w, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // 小尖牙
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.4, y);
      ctx.lineTo(x - w * 0.25, y + w * 0.5);
      ctx.lineTo(x - w * 0.1, y);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.4, y);
      ctx.lineTo(x + w * 0.25, y + w * 0.5);
      ctx.lineTo(x + w * 0.1, y);
      ctx.fill();
      return;
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  /** 绘制可爱的小短腿 */
  _drawStubbyLeg(ctx, x, y, w, h, color, time, phase) {
    const swing = Math.sin(time * 4 + phase) * 0.15;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + swing * w, y + h * 0.5, w, h, swing * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 绘制可爱圆体（带高光） */
  _drawRoundBody(ctx, cx, cy, rx, ry, bodyColor, darkColor) {
    // 主体
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    // 底部阴影
    ctx.fillStyle = darkColor;
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.2, rx * 0.9, ry * 0.6, 0, 0.3, Math.PI - 0.3); ctx.fill();
    ctx.globalAlpha = 1;
    // 顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.ellipse(cx - rx * 0.15, cy - ry * 0.3, rx * 0.5, ry * 0.3, -0.3, 0, Math.PI * 2); ctx.fill();
  }

  /** 发光效果 */
  _softGlow(ctx, x, y, r, color, alpha) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.08;
    ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha * 0.15;
    ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** 绘制正多边形路径 */
  _poly(ctx, cx, cy, r, sides, rot = 0) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (Math.PI * 2 / sides) * i + rot - Math.PI / 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /** 绘制星星/火花 */
  _drawSparkle(ctx, x, y, r, color, alpha) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** 绘制六角雪花 */
  _drawSnowflake(ctx, x, y, r) {
    ctx.strokeStyle = 'rgba(200,240,255,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.stroke();
    }
  }

  // ================================================================
  // 效果绘制
  // ================================================================

  /** 减速光环（蓝色冰霜） */
  _drawSlowAura(ctx, s, time) {
    // 冰霜光环
    ctx.save();
    const pulse = 0.85 + Math.sin(time * 3) * 0.15;
    ctx.strokeStyle = `rgba(119,204,221,${0.4 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    // 内层淡蓝色填充
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.1);
    grd.addColorStop(0, 'rgba(119,204,221,0.05)');
    grd.addColorStop(1, 'rgba(119,204,221,0.15)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.1, 0, Math.PI * 2);
    ctx.fill();
    // 轨道雪花
    for (let i = 0; i < 4; i++) {
      const a = time * 2 + (Math.PI / 2) * i;
      const pr = s * 1.1 + Math.sin(time * 3 + i) * 2;
      const px = Math.cos(a) * pr;
      const py = Math.sin(a) * pr;
      this._drawSnowflake(ctx, px, py, 3);
    }
    ctx.restore();
  }

  /** 燃烧光环（红色火焰） */
  _drawBurnAura(ctx, s, time) {
    ctx.save();
    const pulse = 0.8 + Math.sin(time * 6) * 0.2;
    // 外层红色光晕
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.15);
    grd.addColorStop(0, `rgba(255,80,20,${0.12 * pulse})`);
    grd.addColorStop(0.5, `rgba(255,120,30,${0.08 * pulse})`);
    grd.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.15, 0, Math.PI * 2);
    ctx.fill();
    // 火焰描边环
    ctx.strokeStyle = `rgba(255,100,30,${0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = -time * 20;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** 中毒光环（绿色毒雾） */
  _drawPoisonAura(ctx, s, time) {
    ctx.save();
    const pulse = 0.85 + Math.sin(time * 2.5) * 0.15;
    // 绿色雾气
    const grd = ctx.createRadialGradient(0, -s * 0.1, 0, 0, 0, s * 1.2);
    grd.addColorStop(0, `rgba(80,200,60,${0.1 * pulse})`);
    grd.addColorStop(0.6, `rgba(60,180,40,${0.08 * pulse})`);
    grd.addColorStop(1, 'rgba(40,150,20,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.2, 0, Math.PI * 2);
    ctx.fill();
    // 绿色气泡环
    ctx.strokeStyle = `rgba(100,220,80,${0.35 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** 燃烧粒子（向上飘动的火星） */
  _drawBurnParticles(ctx, s, time, enemy) {
    ctx.save();
    const seed = (enemy.animTime || 0);
    for (let i = 0; i < 5; i++) {
      const phase = (seed * 3 + i * 1.3) % 1;
      const a = (Math.PI * 2 / 5) * i + seed;
      const px = Math.cos(a) * s * 0.4 * (1 - phase * 0.5);
      const py = s * 0.3 - phase * s * 1.2;
      const pr = s * 0.06 * (1 - phase * 0.7);
      const alpha = (1 - phase) * 0.8;
      const hue = 20 + Math.sin(seed * 5 + i) * 20;
      ctx.fillStyle = `rgba(${255},${100 + hue * 3},${20},${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 中毒粒子（上浮的绿色气泡） */
  _drawPoisonParticles(ctx, s, time, enemy) {
    ctx.save();
    const seed = (enemy.animTime || 0);
    for (let i = 0; i < 4; i++) {
      const phase = (seed * 2 + i * 1.5) % 1;
      const a = (Math.PI * 2 / 4) * i + seed * 0.5;
      const px = Math.cos(a) * s * 0.5 * (1 - phase * 0.3);
      const py = s * 0.2 - phase * s * 1.0;
      const pr = s * 0.05 + Math.sin(seed * 4 + i) * s * 0.02;
      const alpha = (1 - phase) * 0.6;
      ctx.fillStyle = `rgba(80,${180 + Math.floor(phase * 50)},60,${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      // 气泡高光
      ctx.fillStyle = `rgba(200,255,180,${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ================================================================
  // Agent A2 P1-4: 受击闪白（Hit Flash）通用组件
  // 致命伤害时整体闪白 80ms，死亡瞬间 150ms
  // 使用 source-atop 复合模式，让白色仅覆盖已绘制的敌人像素
  // ================================================================
  /**
   * 绘制受击闪白（在敌人本体绘制完成后调用）
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} enemy - 敌人对象（需含 hitFlashTimer、x、y）
   * @param {number} s - 敌人绘制尺寸（cell * 0.42 * size）
   */
  _drawHitFlash(ctx, enemy, s) {
    if (!enemy || enemy.hitFlashTimer === undefined || enemy.hitFlashTimer <= 0) return;
    // 闪白 alpha：80ms 区间内 [0, 0.7]，0~150ms 区间内 [0, 0.85]（死亡时更亮）
    // 统一按 0.15s 计算强度，死亡瞬间的"超亮"通过 a 系数自然实现
    const a = Math.min(1, enemy.hitFlashTimer / 0.15);
    const alpha = a * 0.7;

    ctx.save();
    // 用 source-atop 限定白色只覆盖已绘制的敌人像素
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    // 在敌人包围盒上画白色矩形（x,y 为敌人中心，s 为半径系数）
    const r = s * 1.1;
    ctx.fillRect(enemy.x - r, enemy.y - r, r * 2, r * 2);
    // 恢复默认混合模式
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /** 血条绘制（升级版：渐变 + 边框 + 高光 + 受击闪烁 + 延迟条） */
  _drawHealthBar(ctx, enemy, cell, barOffsetY) {
    const barW = cell * 0.7;
    const barH = 5;
    const barX = enemy.x - barW / 2;
    const barY = enemy.y + barOffsetY;
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);

    // Boss 血条更大
    const scale = enemy.isBoss ? 1.5 : 1.0;
    const w = barW * scale;
    const h = barH * scale;
    const x = enemy.x - w / 2;

    ctx.save();

    // 1) 外框（深色描边 + 发光）
    ctx.fillStyle = 'rgba(20,10,15,0.85)';
    ctx.strokeStyle = 'rgba(255,200,150,0.35)';
    ctx.lineWidth = 1;
    const radius = h / 2 + 1;
    this._roundRect(ctx, x - 1.5, barY - 1.5, w + 3, h + 3, radius);
    ctx.fill();
    ctx.stroke();

    // 2) 血槽背景
    ctx.fillStyle = 'rgba(60,25,30,0.9)';
    this._roundRect(ctx, x, barY, w, h, h / 2);
    ctx.fill();

    // 3) 受击延迟条（白色残影，显示刚失去的血量）
    if (enemy.hitFlash > 0 && enemy.hitFlashTimer > 0) {
      const lastRatio = Math.min(1, hpRatio + enemy.hitFlashTimer * 3);
      if (lastRatio > hpRatio) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        this._roundRect(ctx, x + w * hpRatio, barY, w * (lastRatio - hpRatio), h, h / 2);
        ctx.fill();
      }
    }

    // 4) 当前血量（渐变色，按血量比例变化）
    if (hpRatio > 0) {
      const fillW = w * hpRatio;
      let fillColor;
      if (hpRatio > 0.6) fillColor = '#66dd44';
      else if (hpRatio > 0.3) fillColor = '#ffcc44';
      else fillColor = '#ff4433';

      // 渐变填充
      const grd = ctx.createLinearGradient(x, barY, x, barY + h);
      grd.addColorStop(0, this._lighten(fillColor, 0.3));
      grd.addColorStop(0.5, fillColor);
      grd.addColorStop(1, this._darken(fillColor, 0.7));
      ctx.fillStyle = grd;
      this._roundRect(ctx, x, barY, fillW, h, h / 2);
      ctx.fill();

      // 顶部高光条
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      this._roundRect(ctx, x + 1, barY + 1, Math.max(0, fillW - 2), h * 0.35, h / 4);
      ctx.fill();
    }

    // 5) Boss 血条添加分段刻度
    if (enemy.isBoss) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const sx = x + w * i / 4;
        ctx.beginPath();
        ctx.moveTo(sx, barY);
        ctx.lineTo(sx, barY + h);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /** 圆角矩形路径（供血条使用） */
  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
   * 死亡效果分发器 - 根据 deathType 显示不同死亡动画
   */
  _drawDeathEffect(ctx, enemy, s, time, progress) {
    const deathType = enemy.deathType || 'dissolve';
    ctx.save();
    switch (deathType) {
      case 'shatter':
        this._drawDeathShatter(ctx, enemy, s, time, progress);
        break;
      case 'explode':
        this._drawDeathExplode(ctx, enemy, s, time, progress);
        break;
      case 'dissolve':
      default:
        this._drawDeathDissolve(ctx, enemy, s, time, progress);
        break;
    }
    ctx.restore();
  }

  /** 消散死亡（幽灵/刺客）- 淡出 + 上浮 + 透明度降低 */
  _drawDeathDissolve(ctx, enemy, s, time, progress) {
    ctx.globalAlpha = 1 - progress;
    ctx.translate(0, -progress * s * 0.8);
    // 身体扩散
    const expandScale = 1 + progress * 0.3;
    ctx.scale(expandScale, expandScale);
    this._drawEnemySprite(ctx, enemy, s, false, false, time);
    // 消散粒子
    const count = 10;
    const pColor = enemy.color;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 / count) * i + time * 0.5;
      const dist = s * (0.3 + progress * s * 0.04);
      const px = Math.cos(a) * dist;
      const py = Math.sin(a) * dist * 0.6;
      const pSize = s * 0.08 * (1 - progress);
      ctx.fillStyle = pColor;
      ctx.globalAlpha = (1 - progress) * 0.6;
      ctx.beginPath(); ctx.arc(px, py, pSize, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 碎裂死亡（甲虫/机甲/坦克）- 碎片飞散 */
  _drawDeathShatter(ctx, enemy, s, time, progress) {
    // 本体闪白后碎裂
    if (progress < 0.3) {
      ctx.globalAlpha = 1 - progress / 0.3;
      this._drawEnemySprite(ctx, enemy, s, true, false, time);
    }
    ctx.globalAlpha = 1 - progress;
    // 碎片飞散（多边形碎片）
    const shardCount = 12;
    const darkColor = this._darken(enemy.color, 0.5);
    for (let i = 0; i < shardCount; i++) {
      const a = (Math.PI * 2 / shardCount) * i;
      const dist = s * (0.2 + progress * 1.8);
      const px = Math.cos(a) * dist;
      const py = Math.sin(a) * dist - progress * s * 0.3;
      const shardSize = s * 0.15 * (1 - progress * 0.8);
      const rot = time * 3 + i;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.fillStyle = i % 2 === 0 ? enemy.color : darkColor;
      ctx.beginPath();
      ctx.moveTo(0, -shardSize);
      ctx.lineTo(shardSize * 0.7, shardSize * 0.5);
      ctx.lineTo(-shardSize * 0.5, shardSize * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // 中心闪光
    if (progress < 0.4) {
      const flashAlpha = (1 - progress / 0.4) * 0.6;
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5 * (1 - progress), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 爆炸死亡（轰炸机/BOSS/卡车）- 大爆炸 + 冲击波 */
  _drawDeathExplode(ctx, enemy, s, time, progress) {
    const isBoss = enemy.isBoss;
    const scale = isBoss ? 1.5 : 1.0;
    // 冲击波
    if (progress < 0.5) {
      const waveP = progress / 0.5;
      ctx.strokeStyle = `rgba(255,200,80,${(1 - waveP) * 0.8})`;
      ctx.lineWidth = 3 * (1 - waveP);
      ctx.beginPath();
      ctx.arc(0, 0, s * (0.3 + waveP * 2.5) * scale, 0, Math.PI * 2);
      ctx.stroke();
      // 内层火球
      const fireAlpha = 1 - waveP * 1.2;
      if (fireAlpha > 0) {
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, s * (0.5 + waveP) * scale);
        grd.addColorStop(0, `rgba(255,255,200,${fireAlpha})`);
        grd.addColorStop(0.3, `rgba(255,160,40,${fireAlpha * 0.8})`);
        grd.addColorStop(0.7, `rgba(255,60,10,${fireAlpha * 0.5})`);
        grd.addColorStop(1, 'rgba(100,20,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, s * (0.5 + waveP) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 爆炸粒子
    const particleCount = isBoss ? 20 : 12;
    for (let i = 0; i < particleCount; i++) {
      const a = (Math.PI * 2 / particleCount) * i + Math.sin(time + i);
      const dist = s * (0.2 + progress * 2.2) * scale;
      const px = Math.cos(a) * dist;
      const py = Math.sin(a) * dist - progress * progress * s * 0.5;
      const pSize = s * 0.1 * (1 - progress) * scale;
      const colors = ['#ffcc44', '#ff6622', '#ff3311', '#ffaa33'];
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath(); ctx.arc(px, py, pSize, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 死亡粒子效果（兼容旧代码，保留为碎片效果） */
  _drawDeathParticles(ctx, enemy, s, time, progress) {
    this._drawDeathShatter(ctx, enemy, s, time, progress);
  }

  // ================================================================
  // 敌人精灵调度
  // ================================================================

  _drawEnemySprite(ctx, enemy, s, flash, isSlowed, time) {
    const bodyColor = isSlowed ? '#88bbcc' : enemy.color;
    const darkColor = isSlowed ? '#556677' : this._darken(bodyColor, 0.5);

    switch (enemy.type) {
      case 'bug': this._drawBug(ctx, s, bodyColor, darkColor, time); break;
      case 'drone': this._drawDrone(ctx, s, bodyColor, darkColor, time); break;
      case 'mech': this._drawMech(ctx, s, bodyColor, darkColor, time, enemy); break;
      case 'boss': this._drawBoss(ctx, s, bodyColor, darkColor, time); break;
      case 'bomber': this._drawBomber(ctx, s, bodyColor, darkColor, time); break;
      case 'healer': this._drawHealer(ctx, s, bodyColor, darkColor, time); break;
      case 'stealth': this._drawStealth(ctx, s, bodyColor, darkColor, time, enemy); break;
      case 'tank': this._drawTank(ctx, s, bodyColor, darkColor, time, enemy); break;
      case 'splitter': this._drawSplitter(ctx, s, bodyColor, darkColor, time); break;
      case 'minibug': this._drawMinibug(ctx, s, bodyColor, darkColor, time); break;
      case 'virusking': this._drawVirusKing(ctx, s, bodyColor, darkColor, time); break;
      case 'ogre': this._drawOgre(ctx, s, bodyColor, darkColor, time); break;
      case 'assassin': this._drawAssassin(ctx, s, bodyColor, darkColor, time); break;
      case 'beetle': this._drawBeetle(ctx, s, bodyColor, darkColor, time, enemy); break;
      case 'ice_golem': this._drawIceGolem(ctx, s, bodyColor, darkColor, time); break;
      case 'werewolf': this._drawWerewolf(ctx, s, bodyColor, darkColor, time); break;
      case 'boss_brute': this._drawBossBrute(ctx, s, bodyColor, darkColor, time, enemy); break;
      case 'shield': this._drawShield(ctx, s, bodyColor, darkColor, time, enemy); break;
      case 'swarm': this._drawSwarm(ctx, s, bodyColor, darkColor, time, enemy); break;
      // === Agent A9 P4-1: 5 个新敌人绘制分发 ===
      case 'ghost': this._drawGhost(ctx, s, bodyColor, darkColor, time, enemy); break;
      case 'truck': this._drawTruck(ctx, s, bodyColor, darkColor, time, enemy); break;
      case 'timeWarp': this._drawTimeWarp(ctx, s, bodyColor, darkColor, time); break;
      case 'infected': this._drawInfected(ctx, s, bodyColor, darkColor, time); break;
      case 'summoner': this._drawSummoner(ctx, s, bodyColor, darkColor, time, enemy); break;
      default:
        // 默认可爱圆形
        this._drawRoundBody(ctx, 0, 0, s, s, bodyColor, darkColor);
        this._drawCuteEye(ctx, -s * 0.25, -s * 0.1, s * 0.18);
        this._drawCuteEye(ctx, s * 0.25, -s * 0.1, s * 0.18);
        this._drawBlush(ctx, -s * 0.4, s * 0.15, s * 0.12, s * 0.08);
        this._drawBlush(ctx, s * 0.4, s * 0.15, s * 0.12, s * 0.08);
        this._drawSmile(ctx, 0, s * 0.2, s * 0.15);
    }

    // 受击闪白
    if (flash) {
      ctx.globalAlpha = Math.min(1, enemy.hitFlash * 5) * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, s * 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ================================================================
  // 1. 外星虫族 - 可爱毛毛虫
  // ================================================================
  _drawBug(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const wiggle = Math.sin(time * 4) * s * 0.05;

    // 6条可爱小短腿
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const idx = i % 3;
      const lx = side * s * 0.45;
      const ly = -s * 0.15 + idx * s * 0.25;
      const swing = Math.sin(time * 5 + i * 0.8) * s * 0.05;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(lx + swing, ly + s * 0.15, s * 0.08, s * 0.12, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 身体分段（3段圆）
    ctx.translate(wiggle, 0);
    this._drawRoundBody(ctx, 0, s * 0.15, s * 0.35, s * 0.3, bodyColor, darkColor);
    this._drawRoundBody(ctx, 0, -s * 0.1, s * 0.4, s * 0.35, bodyColor, darkColor);
    this._drawRoundBody(ctx, 0, -s * 0.35, s * 0.35, s * 0.3, bodyColor, darkColor);

    // 身体纹理线
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.moveTo(-s * 0.3, 0.0); ctx.lineTo(s * 0.3, 0.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.28, -s * 0.22); ctx.lineTo(s * 0.28, -s * 0.22); ctx.stroke();
    ctx.globalAlpha = 1;

    // 大可爱眼睛
    this._drawCuteEye(ctx, -s * 0.15, -s * 0.38, s * 0.13);
    this._drawCuteEye(ctx, s * 0.15, -s * 0.38, s * 0.13);

    // 腮红
    this._drawBlush(ctx, -s * 0.3, -s * 0.25, s * 0.08, s * 0.05);
    this._drawBlush(ctx, s * 0.3, -s * 0.25, s * 0.08, s * 0.05);

    // 微笑
    this._drawSmile(ctx, 0, -s * 0.28, s * 0.08);

    // 两根摇摆触角
    for (let side = -1; side <= 1; side += 2) {
      const antennaSwing = Math.sin(time * 3 + side) * 0.3;
      const bx = side * s * 0.12;
      const by = -s * 0.6;
      const tx = bx + side * s * 0.2 + Math.sin(time * 3 + side) * s * 0.1;
      const ty = by - s * 0.35;
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + side * s * 0.15, by - s * 0.15, tx, ty);
      ctx.stroke();
      // 触角发光小球
      this._softGlow(ctx, tx, ty, s * 0.06, '#ffee88', 0.6 + Math.sin(time * 5 + side) * 0.3);
    }
    ctx.lineCap = 'butt';

    ctx.restore();
  }

  // ================================================================
  // 2. 无人机群 - 可爱飞碟
  // ================================================================
  _drawDrone(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const bob = Math.sin(time * 3) * s * 0.08;
    const spin = time * 0.5;
    ctx.translate(0, bob);

    // 牵引光束
    const beamAlpha = 0.15 + Math.sin(time * 4) * 0.08;
    ctx.fillStyle = `rgba(255,221,136,${beamAlpha})`;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, s * 0.15);
    ctx.lineTo(s * 0.25, s * 0.15);
    ctx.lineTo(s * 0.4, s * 0.7);
    ctx.lineTo(-s * 0.4, s * 0.7);
    ctx.closePath();
    ctx.fill();

    // 飞碟碟体
    ctx.fillStyle = darkColor;
    ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.65, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();

    // 飞碟边缘小灯
    for (let i = 0; i < 6; i++) {
      const a = spin + (Math.PI * 2 / 6) * i;
      const lx = Math.cos(a) * s * 0.55;
      const ly = Math.sin(a) * s * 0.16;
      const blink = (Math.sin(time * 6 + i * 1.2) > 0) ? 1 : 0.3;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,170,85,${blink})` : `rgba(221,85,68,${blink})`;
      ctx.beginPath(); ctx.arc(lx, ly, s * 0.04, 0, Math.PI * 2); ctx.fill();
    }

    // 玻璃圆顶
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.12, s * 0.35, s * 0.28, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -s * 0.12, s * 0.35, s * 0.28, 0, Math.PI, 0); ctx.stroke();

    // 圆顶内的可爱大眼
    this._drawCuteEye(ctx, 0, -s * 0.2, s * 0.15);

    // 腮红
    this._drawBlush(ctx, -s * 0.18, -s * 0.08, s * 0.06, s * 0.04);
    this._drawBlush(ctx, s * 0.18, -s * 0.08, s * 0.06, s * 0.04);

    ctx.restore();
  }

  // ================================================================
  // 3. 机甲战士 - 胖嘟嘟装甲骑士
  // ================================================================
  _drawMech(ctx, s, bodyColor, darkColor, time, enemy) {
    ctx.save();
    const stomp = Math.abs(Math.sin(time * 3)) * s * 0.04;
    ctx.translate(0, -stomp);

    // 短粗小腿 + 大靴子
    for (let side = -1; side <= 1; side += 2) {
      const legSwing = Math.sin(time * 3 + (side > 0 ? Math.PI : 0)) * s * 0.03;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.25 + legSwing, s * 0.5, s * 0.15, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // 靴子
      ctx.fillStyle = this._darken(bodyColor, 0.6);
      ctx.beginPath();
      ctx.ellipse(side * s * 0.25 + legSwing, s * 0.65, s * 0.18, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 胖圆身体
    this._drawRoundBody(ctx, 0, 0, s * 0.6, s * 0.55, bodyColor, darkColor);

    // 装甲板线条（可爱版）
    ctx.strokeStyle = this._lighten(bodyColor, 0.3);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.45, -0.8, 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.45, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke();
    ctx.globalAlpha = 1;

    // 短粗手臂 + 大手甲
    for (let side = -1; side <= 1; side += 2) {
      const armSwing = Math.sin(time * 2 + (side > 0 ? 0 : Math.PI)) * 0.15;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.65, s * 0.05 + armSwing * s, s * 0.12, s * 0.15, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
      // 大手甲
      ctx.fillStyle = this._darken(bodyColor, 0.65);
      ctx.beginPath();
      ctx.arc(side * s * 0.72, s * 0.15 + armSwing * s, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    // 骑士头盔
    ctx.fillStyle = this._darken(bodyColor, 0.65);
    ctx.beginPath(); ctx.arc(0, -s * 0.45, s * 0.38, Math.PI, 0); ctx.fill();
    // 面罩（掀起来露出脸）
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(0, -s * 0.35, s * 0.35, -0.5, Math.PI + 0.5, true); ctx.fill();

    // 可爱脸部
    this._drawCuteEye(ctx, -s * 0.15, -s * 0.4, s * 0.11);
    this._drawCuteEye(ctx, s * 0.15, -s * 0.4, s * 0.11);
    this._drawBlush(ctx, -s * 0.28, -s * 0.3, s * 0.07, s * 0.05);
    this._drawBlush(ctx, s * 0.28, -s * 0.3, s * 0.07, s * 0.05);
    this._drawSmile(ctx, 0, -s * 0.28, s * 0.08);

    // 关节蒸汽
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const puffY = -s * 0.05 - Math.abs(Math.sin(time * 2 + i)) * s * 0.15;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(side * s * 0.55, puffY, s * 0.06, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  // ================================================================
  // 4. 巨型母舰(BOSS) - 太空鲸鱼
  // ================================================================
  _drawBoss(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const undulate = Math.sin(time * 1.5) * s * 0.05;

    // 卫星小鱼
    for (let i = 0; i < 4; i++) {
      const a = time * 1.2 + (Math.PI / 2) * i;
      const orbitR = s * 1.1 + Math.sin(time * 2 + i) * s * 0.1;
      const fx = Math.cos(a) * orbitR;
      const fy = Math.sin(a) * orbitR * 0.6;
      // 小鱼身体
      const fishColors = ['#ffaa66', '#ffcc77', '#ff9977', '#ffbb88'];
      ctx.fillStyle = fishColors[i];
      ctx.beginPath(); ctx.ellipse(fx, fy, s * 0.1, s * 0.06, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
      // 小鱼尾巴
      ctx.beginPath();
      ctx.moveTo(fx - Math.sin(a) * s * 0.1, fy + Math.cos(a) * s * 0.1);
      ctx.lineTo(fx - Math.sin(a) * s * 0.18 + Math.sin(time * 8 + i) * s * 0.03, fy + Math.cos(a) * s * 0.18);
      ctx.lineTo(fx - Math.sin(a) * s * 0.06, fy + Math.cos(a) * s * 0.06);
      ctx.fill();
      // 小鱼眼睛
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(fx + Math.cos(a) * s * 0.04, fy - Math.sin(a) * s * 0.02, s * 0.025, 0, Math.PI * 2); ctx.fill();
    }

    ctx.translate(0, undulate);

    // 大尾巴
    ctx.fillStyle = this._lighten(bodyColor, 0.2);
    ctx.beginPath();
    ctx.moveTo(s * 0.1, s * 0.4);
    ctx.quadraticCurveTo(s * 0.3, s * 0.8, s * 0.1 + Math.sin(time * 2) * s * 0.15, s * 1.1);
    ctx.quadraticCurveTo(0, s * 0.9, -s * 0.1 - Math.sin(time * 2) * s * 0.1, s * 1.1);
    ctx.quadraticCurveTo(-s * 0.3, s * 0.8, -s * 0.1, s * 0.4);
    ctx.closePath();
    ctx.fill();

    // 能量尾迹
    for (let i = 0; i < 3; i++) {
      const ty = s * 0.9 + i * s * 0.1;
      const tw = Math.sin(time * 3 + i * 0.5) * s * 0.08;
      ctx.fillStyle = `rgba(255,200,150,${0.2 - i * 0.05})`;
      ctx.beginPath(); ctx.arc(tw, ty, s * 0.05 - i * s * 0.01, 0, Math.PI * 2); ctx.fill();
    }

    // 巨型椭圆身体
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.75, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    // 底部阴影
    ctx.fillStyle = darkColor;
    ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.7, s * 0.45, 0, 0.2, Math.PI - 0.2); ctx.fill();
    ctx.globalAlpha = 1;
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.2, s * 0.4, s * 0.2, -0.3, 0, Math.PI * 2); ctx.fill();

    // 发光肚子
    ctx.fillStyle = 'rgba(255,204,136,0.25)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.35, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();

    // 多只可爱眼睛（3-4只不同大小）
    this._drawCuteEye(ctx, -s * 0.25, -s * 0.2, s * 0.12);
    this._drawCuteEye(ctx, s * 0.1, -s * 0.25, s * 0.15);
    this._drawCuteEye(ctx, s * 0.4, -s * 0.1, s * 0.08);
    // 腮红
    this._drawBlush(ctx, -s * 0.4, -s * 0.05, s * 0.08, s * 0.05);
    this._drawBlush(ctx, s * 0.25, -s * 0.05, s * 0.06, s * 0.04);
    // 微笑
    this._drawSmile(ctx, s * 0.05, -s * 0.08, s * 0.1);

    ctx.restore();
  }

  // ================================================================
  // 5. 自爆虫 - 行走的小炸弹
  // ================================================================
  _drawBomber(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const bounce = Math.abs(Math.sin(time * 5)) * s * 0.1;
    ctx.translate(0, -bounce);

    // 脉冲光晕（越来越亮）
    const pulse = 0.15 + Math.sin(time * 6) * 0.1;
    ctx.fillStyle = `rgba(255,200,80,${pulse})`;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2); ctx.fill();

    // 小手小脚
    for (let side = -1; side <= 1; side += 2) {
      // 小手
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.5, s * 0.05, s * 0.08, s * 0.1, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // 小脚
      ctx.beginPath();
      ctx.ellipse(side * s * 0.2, s * 0.5, s * 0.1, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 圆形炸弹身体
    this._drawRoundBody(ctx, 0, 0, s * 0.5, s * 0.5, bodyColor, darkColor);

    // 生气的可爱脸
    // 眉毛
    ctx.strokeStyle = '#553333';
    ctx.lineWidth = 1.5;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.05, -s * 0.25);
      ctx.lineTo(side * s * 0.25, -s * 0.32);
      ctx.stroke();
    }
    this._drawCuteEye(ctx, -s * 0.15, -s * 0.12, s * 0.11);
    this._drawCuteEye(ctx, s * 0.15, -s * 0.12, s * 0.11);
    // 鼓起的腮帮子
    this._drawBlush(ctx, -s * 0.3, s * 0.05, s * 0.1, s * 0.07);
    this._drawBlush(ctx, s * 0.3, s * 0.05, s * 0.1, s * 0.07);
    // 坚定嘴
    this._drawSmile(ctx, 0, s * 0.15, s * 0.08, 'angry');

    // 顶部引信
    ctx.strokeStyle = '#886644';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.quadraticCurveTo(s * 0.1, -s * 0.7, Math.sin(time * 8) * s * 0.05, -s * 0.85);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 引信火花
    const sparkX = Math.sin(time * 8) * s * 0.05;
    const sparkY = -s * 0.85;
    for (let i = 0; i < 4; i++) {
      const sa = time * 12 + (Math.PI / 2) * i;
      const sr = s * 0.08 + Math.sin(time * 10 + i) * s * 0.03;
      ctx.fillStyle = i % 2 === 0 ? '#ffdd44' : '#ffaa33';
      ctx.globalAlpha = 0.7 + Math.sin(time * 15 + i) * 0.3;
      ctx.beginPath(); ctx.arc(sparkX + Math.cos(sa) * sr, sparkY + Math.sin(sa) * sr, s * 0.03, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    this._softGlow(ctx, sparkX, sparkY, s * 0.06, '#ffdd44', 0.8);

    ctx.restore();
  }

  // ================================================================
  // 6. 治疗虫 - 史莱姆医生
  // ================================================================
  _drawHealer(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const jiggle = Math.sin(time * 3) * s * 0.04;
    const squash = 1 + Math.sin(time * 3) * 0.06;

    ctx.scale(1 / squash, squash);

    // 治疗粒子上浮
    for (let i = 0; i < 5; i++) {
      const py = -s * 0.5 - ((time * 0.5 + i * 0.2) % 1) * s * 0.8;
      const px = Math.sin(time * 2 + i * 1.5) * s * 0.3;
      const alpha = 1 - ((time * 0.5 + i * 0.2) % 1);
      ctx.fillStyle = `rgba(170,255,170,${alpha * 0.4})`;
      ctx.beginPath(); ctx.arc(px, py, s * 0.04, 0, Math.PI * 2); ctx.fill();
      // 小十字
      ctx.strokeStyle = `rgba(170,255,170,${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - s * 0.03, py); ctx.lineTo(px + s * 0.03, py);
      ctx.moveTo(px, py - s * 0.03); ctx.lineTo(px, py + s * 0.03);
      ctx.stroke();
    }

    // 半透明史莱姆身体
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.3);
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.1, -s * 0.3, -s * 0.4);
    ctx.quadraticCurveTo(0, -s * 0.65, s * 0.3, -s * 0.4);
    ctx.quadraticCurveTo(s * 0.6, -s * 0.1, s * 0.55, s * 0.3);
    ctx.quadraticCurveTo(s * 0.3, s * 0.45, 0, s * 0.4);
    ctx.quadraticCurveTo(-s * 0.3, s * 0.45, -s * 0.55, s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // 身体高光
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.2, s * 0.25, s * 0.15, -0.3, 0, Math.PI * 2); ctx.fill();

    // 护士帽
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.5);
    ctx.lineTo(-s * 0.15, -s * 0.75);
    ctx.lineTo(s * 0.15, -s * 0.75);
    ctx.lineTo(s * 0.2, -s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 帽子上的红十字
    ctx.fillStyle = '#dd5544';
    ctx.fillRect(-s * 0.04, -s * 0.72, s * 0.08, s * 0.18);
    ctx.fillRect(-s * 0.09, -s * 0.67, s * 0.18, s * 0.08);

    // 身体上的发光十字
    this._softGlow(ctx, 0, s * 0.05, s * 0.08, '#aaffaa', 0.5 + Math.sin(time * 3) * 0.2);
    ctx.fillStyle = 'rgba(255,255,240,0.6)';
    ctx.fillRect(-s * 0.03, s * 0.05 - s * 0.1, s * 0.06, s * 0.2);
    ctx.fillRect(-s * 0.1, s * 0.05 - s * 0.03, s * 0.2, s * 0.06);

    // 可爱的大眼睛
    this._drawCuteEye(ctx, -s * 0.15 + jiggle, -s * 0.15, s * 0.13);
    this._drawCuteEye(ctx, s * 0.15 + jiggle, -s * 0.15, s * 0.13);
    // 腮红
    this._drawBlush(ctx, -s * 0.3, -s * 0.02, s * 0.08, s * 0.05);
    this._drawBlush(ctx, s * 0.3, -s * 0.02, s * 0.08, s * 0.05);
    // 关心微笑
    this._drawSmile(ctx, 0, s * 0.15, s * 0.08);

    ctx.restore();
  }

  // ================================================================
  // 7. 隐形刺客 - 忍者暗影猫
  // ================================================================
  _drawStealth(ctx, s, bodyColor, darkColor, time, enemy) {
    const stealthAlpha = enemy.stealthed ? 0.15 : 0.9;
    ctx.save();

    // 快速移动动画
    const dart = Math.sin(time * 6) * s * 0.03;
    ctx.translate(dart, 0);

    // 猫尾巴
    ctx.globalAlpha = stealthAlpha;
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = s * 0.08;
    ctx.lineCap = 'round';
    const tailSwing = Math.sin(time * 4) * 0.4;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * 0.3);
    ctx.quadraticCurveTo(s * 0.5, s * 0.2 + tailSwing * s * 0.2, s * 0.6, -s * 0.1 + tailSwing * s * 0.15);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 流线型猫身体
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.4, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.ellipse(-s * 0.08, -s * 0.12, s * 0.2, s * 0.12, -0.3, 0, Math.PI * 2); ctx.fill();

    // 小爪子
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.3, s * 0.35, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 忍者头巾
    ctx.fillStyle = this._darken(bodyColor, 0.6);
    ctx.beginPath();
    ctx.arc(0, -s * 0.2, s * 0.3, Math.PI + 0.3, -0.3);
    ctx.fill();
    // 头巾飘带
    ctx.strokeStyle = this._darken(bodyColor, 0.6);
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = 'round';
    const ribbonSwing = Math.sin(time * 3) * 0.2;
    ctx.beginPath();
    ctx.moveTo(s * 0.25, -s * 0.25);
    ctx.quadraticCurveTo(s * 0.45, -s * 0.3 + ribbonSwing * s, s * 0.55, -s * 0.4 + ribbonSwing * s * 0.2);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 忍者眼（只有眼睛可见的面具风格）
    if (enemy.stealthed) {
      // 隐形时只有眼睛
      ctx.globalAlpha = 0.6;
    }
    this._drawCuteEye(ctx, -s * 0.12, -s * 0.18, s * 0.1);
    this._drawCuteEye(ctx, s * 0.12, -s * 0.18, s * 0.1);

    // 小手里剑装饰
    ctx.globalAlpha = stealthAlpha * 0.6;
    ctx.fillStyle = '#aaaaaa';
    const shurikenAngle = time * 4;
    for (let i = 0; i < 4; i++) {
      const a = shurikenAngle + (Math.PI / 2) * i;
      const sx = -s * 0.35 + Math.cos(a) * s * 0.06;
      const sy = s * 0.1 + Math.sin(a) * s * 0.06;
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, s * 0.1);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }

    // 隐形时虚线轮廓
    if (enemy.stealthed) {
      ctx.globalAlpha = 0.2;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.45, s * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ================================================================
  // 8. 电磁坦克 - 装甲乌龟
  // ================================================================
  _drawTank(ctx, s, bodyColor, darkColor, time, enemy) {
    ctx.save();
    const shellBob = Math.sin(time * 2) * s * 0.03;

    // 四条粗短腿
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1;
      const front = i % 2 === 0 ? -1 : 1;
      const lx = side * s * 0.4;
      const ly = front * s * 0.2 + s * 0.15;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(lx, ly, s * 0.12, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 乌龟壳（大圆顶）
    ctx.translate(0, shellBob);
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.7, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    // 壳底阴影
    ctx.fillStyle = darkColor;
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.65, s * 0.45, 0, 0.2, Math.PI - 0.2); ctx.fill();
    ctx.globalAlpha = 1;
    // 壳高光
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.25, s * 0.35, s * 0.2, -0.3, 0, Math.PI * 2); ctx.fill();

    // 壳边缘装甲
    ctx.strokeStyle = this._lighten(bodyColor, 0.2);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.7, s * 0.55, 0, 0, Math.PI * 2); ctx.stroke();

    // 壳上的可爱小炮
    ctx.fillStyle = this._darken(bodyColor, 0.6);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.45, s * 0.1, s * 0.12, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-s * 0.04, -s * 0.65, s * 0.08, s * 0.2);
    // 炮口（不可爱的圆球）
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(0, -s * 0.65, s * 0.06, 0, Math.PI * 2); ctx.fill();

    // 护甲光环
    if (enemy.armor > 0) {
      ctx.strokeStyle = '#ddaa44';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.2 + Math.sin(time * 3) * 0.1;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 可爱脸从壳下面探出来
    ctx.translate(0, -shellBob);
    const headY = -s * 0.05;
    // 小脑袋
    ctx.fillStyle = this._lighten(bodyColor, 0.15);
    ctx.beginPath(); ctx.ellipse(0, headY, s * 0.25, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();

    this._drawCuteEye(ctx, -s * 0.1, headY - s * 0.03, s * 0.08);
    this._drawCuteEye(ctx, s * 0.1, headY - s * 0.03, s * 0.08);
    this._drawBlush(ctx, -s * 0.18, headY + s * 0.05, s * 0.06, s * 0.04);
    this._drawBlush(ctx, s * 0.18, headY + s * 0.05, s * 0.06, s * 0.04);
    this._drawSmile(ctx, 0, headY + s * 0.08, s * 0.06);

    ctx.restore();
  }

  // ================================================================
  // 9. 分裂虫 - 双头史莱姆
  // ================================================================
  _drawSplitter(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const squish = Math.sin(time * 3) * s * 0.06;

    // 左半身体
    ctx.save();
    ctx.translate(-s * 0.25 - squish, Math.sin(time * 3) * s * 0.02);
    this._drawRoundBody(ctx, 0, 0, s * 0.35, s * 0.32, bodyColor, darkColor);
    // 左半眼
    this._drawCuteEye(ctx, -s * 0.05, -s * 0.08, s * 0.1);
    // 左半嘴
    ctx.strokeStyle = '#553333';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(s * 0.05, s * 0.1, s * 0.06, 0, Math.PI * 0.6);
    ctx.stroke();
    this._drawBlush(ctx, -s * 0.18, s * 0.05, s * 0.06, s * 0.04);
    ctx.restore();

    // 右半身体
    ctx.save();
    ctx.translate(s * 0.25 + squish, -Math.sin(time * 3) * s * 0.02);
    this._drawRoundBody(ctx, 0, 0, s * 0.35, s * 0.32, bodyColor, darkColor);
    // 右半眼
    this._drawCuteEye(ctx, s * 0.05, -s * 0.08, s * 0.1);
    // 右半嘴
    ctx.strokeStyle = '#553333';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-s * 0.05, s * 0.1, s * 0.06, Math.PI * 0.4, Math.PI);
    ctx.stroke();
    this._drawBlush(ctx, s * 0.18, s * 0.05, s * 0.06, s * 0.04);
    ctx.restore();

    // 中间能量连接桥
    const bridgePulse = 0.5 + Math.sin(time * 5) * 0.3;
    ctx.fillStyle = `rgba(255,204,100,${bridgePulse * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.2 + squish, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    // 连接光点
    for (let i = 0; i < 3; i++) {
      const px = -s * 0.15 + i * s * 0.15;
      const py = Math.sin(time * 4 + i) * s * 0.03;
      ctx.fillStyle = `rgba(255,221,136,${bridgePulse})`;
      ctx.beginPath(); ctx.arc(px, py, s * 0.03, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  // ================================================================
  // 10. 幼虫 - 迷你毛毛虫宝宝
  // ================================================================
  _drawMinibug(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const excitedBounce = Math.abs(Math.sin(time * 6)) * s * 0.12;
    ctx.translate(0, -excitedBounce);

    // 4条小短腿
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1;
      const idx = i % 2;
      const lx = side * s * 0.3;
      const ly = idx * s * 0.2 - s * 0.05;
      const swing = Math.sin(time * 7 + i * 1.2) * s * 0.04;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(lx + swing, ly + s * 0.1, s * 0.06, s * 0.08, side * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 超圆小身体
    this._drawRoundBody(ctx, 0, 0, s * 0.4, s * 0.38, bodyColor, darkColor);

    // 超大眼睛（比身体比例还大）
    this._drawCuteEye(ctx, -s * 0.14, -s * 0.1, s * 0.16);
    this._drawCuteEye(ctx, s * 0.14, -s * 0.1, s * 0.16);

    // 腮红
    this._drawBlush(ctx, -s * 0.28, s * 0.05, s * 0.07, s * 0.04);
    this._drawBlush(ctx, s * 0.28, s * 0.05, s * 0.07, s * 0.04);

    // 开心小嘴
    this._drawSmile(ctx, 0, s * 0.12, s * 0.06, 'open');

    // 两根小触角
    for (let side = -1; side <= 1; side += 2) {
      const swing = Math.sin(time * 5 + side * 1.5) * 0.3;
      const tx = side * s * 0.15 + Math.sin(time * 5 + side) * s * 0.05;
      const ty = -s * 0.55;
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(side * s * 0.08, -s * 0.35);
      ctx.quadraticCurveTo(side * s * 0.12, -s * 0.45, tx, ty);
      ctx.stroke();
      // 触角小球
      ctx.fillStyle = bodyColor;
      ctx.beginPath(); ctx.arc(tx, ty, s * 0.04, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineCap = 'butt';

    ctx.restore();
  }

  // ================================================================
  // 11. 病毒国王(BOSS) - 国王怪兽
  // ================================================================
  _drawVirusKing(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const regal = Math.sin(time * 1.5) * s * 0.02;
    ctx.translate(0, regal);

    // 威严光环
    const kingPulse = 0.9 + Math.sin(time * 2) * 0.1;
    ctx.strokeStyle = `rgba(221,68,85,${kingPulse * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, s * 1.3 * kingPulse, 0, Math.PI * 2); ctx.stroke();

    // 轨道小随从
    for (let i = 0; i < 3; i++) {
      const a = time * 1.5 + (Math.PI * 2 / 3) * i;
      const ox = Math.cos(a) * s * 1.0;
      const oy = Math.sin(a) * s * 1.0;
      const minionColors = ['#ffaa66', '#ff8877', '#ffcc77'];
      ctx.fillStyle = minionColors[i];
      ctx.beginPath(); ctx.arc(ox, oy, s * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ox, oy - s * 0.02, s * 0.025, 0, Math.PI * 2); ctx.fill();
    }

    // 皇家披风
    ctx.fillStyle = 'rgba(150,30,30,0.7)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.2);
    ctx.quadraticCurveTo(-s * 0.7, s * 0.3, -s * 0.4 + Math.sin(time * 2) * s * 0.05, s * 0.7);
    ctx.lineTo(s * 0.4 - Math.sin(time * 2) * s * 0.05, s * 0.7);
    ctx.quadraticCurveTo(s * 0.7, s * 0.3, s * 0.5, -s * 0.2);
    ctx.closePath();
    ctx.fill();

    // 大圆身体
    this._drawRoundBody(ctx, 0, 0, s * 0.6, s * 0.55, bodyColor, darkColor);

    // 严厉但可爱的脸
    // 粗眉毛
    ctx.strokeStyle = '#442222';
    ctx.lineWidth = 2.5;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.05, -s * 0.28);
      ctx.lineTo(side * s * 0.25, -s * 0.35);
      ctx.stroke();
    }
    this._drawCuteEye(ctx, -s * 0.18, -s * 0.15, s * 0.13);
    this._drawCuteEye(ctx, s * 0.18, -s * 0.15, s * 0.13);
    // 小尖牙嘴
    this._drawSmile(ctx, 0, s * 0.12, s * 0.12, 'fangs');

    // 金色王冠
    ctx.fillStyle = '#ddaa44';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.45);
    ctx.lineTo(-s * 0.3, -s * 0.75);
    ctx.lineTo(-s * 0.12, -s * 0.55);
    ctx.lineTo(0, -s * 0.85);
    ctx.lineTo(s * 0.12, -s * 0.55);
    ctx.lineTo(s * 0.3, -s * 0.75);
    ctx.lineTo(s * 0.35, -s * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#cc9933';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 王冠宝石
    ctx.fillStyle = '#dd4455';
    ctx.beginPath(); ctx.arc(0, -s * 0.62, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#44aadd';
    ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.55, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.55, s * 0.04, 0, Math.PI * 2); ctx.fill();

    // 王冠闪电
    if (Math.sin(time * 8) > 0.5) {
      ctx.strokeStyle = '#ffdd88';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(s * 0.05, -s * 0.95);
      ctx.lineTo(-s * 0.02, -s * 0.92);
      ctx.lineTo(s * 0.03, -s * 1.05);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ================================================================
  // 12. 食人魔 - 大肚皮食人魔
  // ================================================================
  _drawOgre(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const waddle = Math.sin(time * 2.5) * s * 0.04;
    const bellyJiggle = Math.sin(time * 5) * s * 0.03;
    ctx.translate(waddle, 0);

    // 短粗腿
    for (let side = -1; side <= 1; side += 2) {
      const legSwing = Math.sin(time * 2.5 + (side > 0 ? Math.PI : 0)) * s * 0.04;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.25, s * 0.55, s * 0.18, s * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 超圆大肚子身体
    this._drawRoundBody(ctx, 0, bellyJiggle * 0.5, s * 0.65, s * 0.6, bodyColor, darkColor);

    // 肚子高光（大肚皮效果）
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.1 + bellyJiggle, s * 0.3, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();

    // 小短手
    for (let side = -1; side <= 1; side += 2) {
      const armSwing = Math.sin(time * 2 + (side > 0 ? 0 : Math.PI)) * 0.2;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.6, s * 0.0, s * 0.1, s * 0.15, side * 0.5 + armSwing, 0, Math.PI * 2);
      ctx.fill();
    }

    // 生气的小眼睛（距离很近）
    this._drawCuteEye(ctx, -s * 0.12, -s * 0.25, s * 0.09);
    this._drawCuteEye(ctx, s * 0.12, -s * 0.25, s * 0.09);

    // 生气眉毛
    ctx.strokeStyle = '#442222';
    ctx.lineWidth = 2;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.02, -s * 0.35);
      ctx.lineTo(side * s * 0.22, -s * 0.42);
      ctx.stroke();
    }

    // 大龅牙/獠牙
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.05);
    ctx.lineTo(-s * 0.08, s * 0.1);
    ctx.lineTo(-s * 0.04, -s * 0.05);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.12, -s * 0.05);
    ctx.lineTo(s * 0.08, s * 0.1);
    ctx.lineTo(s * 0.04, -s * 0.05);
    ctx.fill();
    // 嘴巴
    ctx.strokeStyle = '#553333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.05);
    ctx.lineTo(s * 0.2, -s * 0.05);
    ctx.stroke();

    ctx.restore();
  }

  // ================================================================
  // 13. 暗影刺客 - 速度狐狸
  // ================================================================
  _drawAssassin(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const graceful = Math.sin(time * 4) * s * 0.03;
    ctx.translate(0, graceful);

    // 速度线
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 3; i++) {
      const ly = -s * 0.3 + i * s * 0.3;
      ctx.beginPath();
      ctx.moveTo(-s * 1.1, ly);
      ctx.lineTo(-s * 0.5, ly);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 双尾巴（能量飘带）
    for (let side = -1; side <= 1; side += 2) {
      const tailSwing = Math.sin(time * 3 + side * 0.5) * 0.3;
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = s * 0.06;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(side * s * 0.15, s * 0.3);
      ctx.quadraticCurveTo(
        side * s * 0.4 + tailSwing * s * 0.2,
        s * 0.5,
        side * s * 0.5 + tailSwing * s * 0.3,
        s * 0.8
      );
      ctx.stroke();
      // 尾巴能量光点
      ctx.fillStyle = bodyColor;
      ctx.globalAlpha = 0.4;
      const tpx = side * s * 0.5 + tailSwing * s * 0.3;
      const tpy = s * 0.8;
      ctx.beginPath(); ctx.arc(tpx, tpy, s * 0.04, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';

    // 流线型狐狸身体
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.4, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.ellipse(-s * 0.08, -s * 0.15, s * 0.2, s * 0.15, -0.2, 0, Math.PI * 2); ctx.fill();

    // 刀刃耳朵（发光边缘）
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(side * s * 0.15, -s * 0.35);
      ctx.lineTo(side * s * 0.3, -s * 0.75);
      ctx.lineTo(side * s * 0.35, -s * 0.3);
      ctx.closePath();
      ctx.fill();
      // 耳朵发光边
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(side * s * 0.15, -s * 0.35);
      ctx.lineTo(side * s * 0.3, -s * 0.75);
      ctx.stroke();
    }

    // 自信的眼睛
    this._drawCuteEye(ctx, -s * 0.13, -s * 0.15, s * 0.11);
    this._drawCuteEye(ctx, s * 0.13, -s * 0.15, s * 0.11);

    // 小嘴
    this._drawSmile(ctx, 0, s * 0.05, s * 0.06, 'cat');

    // 腮红
    this._drawBlush(ctx, -s * 0.25, s * 0.0, s * 0.06, s * 0.04);
    this._drawBlush(ctx, s * 0.25, s * 0.0, s * 0.06, s * 0.04);

    ctx.restore();
  }

  // ================================================================
  // 14. 尖刺甲虫 - 圆刺甲虫
  // ================================================================
  _drawBeetle(ctx, s, bodyColor, darkColor, time, enemy) {
    ctx.save();
    const march = Math.sin(time * 3) * s * 0.02;
    const shellWobble = Math.sin(time * 2.5) * 0.03;
    ctx.translate(0, march);
    ctx.rotate(shellWobble);

    // 小短腿
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const idx = i % 3;
      const lx = side * s * 0.45;
      const ly = -s * 0.2 + idx * s * 0.2;
      const swing = Math.sin(time * 4 + i * 0.9) * s * 0.04;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(lx + swing, ly + s * 0.1, s * 0.06, s * 0.09, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 圆形甲虫壳
    this._drawRoundBody(ctx, 0, 0, s * 0.6, s * 0.55, bodyColor, darkColor);

    // 壳花纹
    ctx.strokeStyle = this._lighten(bodyColor, 0.25);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, s * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;

    // 6个圆刺（不尖锐，可爱圆润）
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const sx = Math.cos(a) * s * 0.6;
      const sy = Math.sin(a) * s * 0.55;
      const spikeBob = Math.sin(time * 3 + i * 0.8) * s * 0.02;
      ctx.fillStyle = this._lighten(bodyColor, 0.15);
      ctx.beginPath();
      ctx.arc(sx, sy + spikeBob, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      // 刺高光
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(sx - s * 0.02, sy + spikeBob - s * 0.03, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    // 护甲光环
    if (enemy.armor > 0) {
      ctx.strokeStyle = '#ddaa44';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 从壳前面露出的可爱脸
    this._drawCuteEye(ctx, -s * 0.15, -s * 0.12, s * 0.11);
    this._drawCuteEye(ctx, s * 0.15, -s * 0.12, s * 0.11);
    this._drawBlush(ctx, -s * 0.28, s * 0.0, s * 0.07, s * 0.04);
    this._drawBlush(ctx, s * 0.28, s * 0.0, s * 0.07, s * 0.04);
    this._drawSmile(ctx, 0, s * 0.08, s * 0.07);

    ctx.restore();
  }

  // ================================================================
  // 15. 冰霜魔像 - 雪人魔像
  // ================================================================
  _drawIceGolem(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const icyShudder = Math.sin(time * 4) * s * 0.015;
    ctx.translate(icyShudder, 0);

    // 冰霜光环
    const auraR = s * 1.2 + Math.sin(time * 2) * s * 0.08;
    ctx.strokeStyle = `rgba(136,187,204,${0.12 + Math.sin(time * 2) * 0.05})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.stroke();

    // 漂浮的雪花粒子
    for (let i = 0; i < 5; i++) {
      const a = time * 1.2 + (Math.PI * 2 / 5) * i;
      const pr = s * 1.0 + Math.sin(time * 2 + i * 1.3) * s * 0.1;
      const px = Math.cos(a) * pr;
      const py = Math.sin(a) * pr;
      this._drawSnowflake(ctx, px, py, s * 0.06);
    }

    // 三段雪人身体
    // 底部（最大）
    ctx.fillStyle = '#ddeeff';
    ctx.beginPath(); ctx.arc(0, s * 0.4, s * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bodyColor;
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(0, s * 0.4, s * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 雪高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(-s * 0.1, s * 0.25, s * 0.2, s * 0.12, -0.3, 0, Math.PI * 2); ctx.fill();

    // 中间段
    ctx.fillStyle = '#ddeeff';
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bodyColor;
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(-s * 0.08, -s * 0.15, s * 0.15, s * 0.1, -0.3, 0, Math.PI * 2); ctx.fill();

    // 头部段
    ctx.fillStyle = '#ddeeff';
    ctx.beginPath(); ctx.arc(0, -s * 0.4, s * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bodyColor;
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(0, -s * 0.4, s * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(-s * 0.06, -s * 0.5, s * 0.12, s * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();

    // 冰晶手臂
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = 'rgba(200,230,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(side * s * 0.3, -s * 0.1);
      ctx.lineTo(side * s * 0.65, -s * 0.2);
      ctx.lineTo(side * s * 0.7, -s * 0.1);
      ctx.lineTo(side * s * 0.6, 0);
      ctx.lineTo(side * s * 0.3, s * 0.05);
      ctx.closePath();
      ctx.fill();
      // 冰晶尖
      ctx.fillStyle = 'rgba(200,230,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(side * s * 0.7, -s * 0.1);
      ctx.lineTo(side * s * 0.85, -s * 0.15);
      ctx.lineTo(side * s * 0.8, -s * 0.05);
      ctx.closePath();
      ctx.fill();
    }

    // 雪人可爱脸
    // 煤球眼睛
    ctx.fillStyle = '#333333';
    ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.42, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.1, -s * 0.42, s * 0.05, 0, Math.PI * 2); ctx.fill();
    // 眼睛高光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.12, -s * 0.44, s * 0.02, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.08, -s * 0.44, s * 0.02, 0, Math.PI * 2); ctx.fill();
    // 胡萝卜鼻子
    ctx.fillStyle = '#ff9944';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.38);
    ctx.lineTo(s * 0.2, -s * 0.36);
    ctx.lineTo(0, -s * 0.34);
    ctx.closePath();
    ctx.fill();
    // 微笑
    this._drawSmile(ctx, 0, -s * 0.3, s * 0.07);
    // 腮红
    this._drawBlush(ctx, -s * 0.18, -s * 0.34, s * 0.06, s * 0.04);
    this._drawBlush(ctx, s * 0.18, -s * 0.34, s * 0.06, s * 0.04);

    // 身体上的雪花图案
    ctx.strokeStyle = 'rgba(200,240,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const sy = i === 0 ? -s * 0.05 : s * 0.35;
      const sr = s * 0.08;
      for (let j = 0; j < 6; j++) {
        const a = (Math.PI / 3) * j;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(Math.cos(a) * sr, sy + Math.sin(a) * sr);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ================================================================
  // 16. 狼人狂战士 - 小狗狂战士
  // ================================================================
  _drawWerewolf(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const excitedBounce = Math.abs(Math.sin(time * 4)) * s * 0.06;
    const tailWag = Math.sin(time * 6) * 0.5;
    ctx.translate(0, -excitedBounce);

    // 蓬松大尾巴
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * 0.1);
    ctx.quadraticCurveTo(
      s * 0.6 + tailWag * s * 0.2,
      -s * 0.1,
      s * 0.5 + tailWag * s * 0.3,
      -s * 0.3
    );
    ctx.quadraticCurveTo(
      s * 0.7 + tailWag * s * 0.15,
      -s * 0.5,
      s * 0.4 + tailWag * s * 0.2,
      -s * 0.5
    );
    ctx.quadraticCurveTo(
      s * 0.3,
      -s * 0.2,
      s * 0.15,
      s * 0.15
    );
    ctx.closePath();
    ctx.fill();
    // 尾巴高光
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.ellipse(s * 0.45 + tailWag * s * 0.15, -s * 0.25, s * 0.1, s * 0.06, tailWag * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 小爪子脚
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.25, s * 0.5, s * 0.12, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // 小爪子
      for (let j = -1; j <= 1; j++) {
        ctx.fillStyle = this._darken(bodyColor, 0.7);
        ctx.beginPath();
        ctx.ellipse(side * s * 0.25 + j * s * 0.05, s * 0.58, s * 0.025, s * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 毛茸茸圆身体
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.48, 0, 0, Math.PI * 2); ctx.fill();
    // 身体高光
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.15, s * 0.25, s * 0.18, -0.2, 0, Math.PI * 2); ctx.fill();
    // 毛发质感
    ctx.strokeStyle = this._lighten(bodyColor, 0.15);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 5; i++) {
      const fa = (Math.PI * 2 / 5) * i - Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(fa) * s * 0.4, Math.sin(fa) * s * 0.38);
      ctx.lineTo(Math.cos(fa) * s * 0.52, Math.sin(fa) * s * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 胸部能量爪痕
    ctx.strokeStyle = 'rgba(255,170,80,0.5)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const cx = -s * 0.1 + i * s * 0.1;
      ctx.beginPath();
      ctx.moveTo(cx, -s * 0.05);
      ctx.lineTo(cx + s * 0.03, s * 0.15);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // 小手臂
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.48, s * 0.05, s * 0.09, s * 0.13, side * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 毛茸茸耳朵
    for (let side = -1; side <= 1; side += 2) {
      const earWiggle = Math.sin(time * 3 + side) * 0.1;
      ctx.save();
      ctx.translate(side * s * 0.25, -s * 0.45);
      ctx.rotate(side * 0.3 + earWiggle);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, 0);
      ctx.lineTo(0, -s * 0.3);
      ctx.lineTo(s * 0.08, 0);
      ctx.closePath();
      ctx.fill();
      // 耳朵内部
      ctx.fillStyle = 'rgba(255,180,160,0.4)';
      ctx.beginPath();
      ctx.moveTo(-s * 0.04, -s * 0.05);
      ctx.lineTo(0, -s * 0.22);
      ctx.lineTo(s * 0.04, -s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 可爱狼脸（装凶但其实很萌）
    this._drawCuteEye(ctx, -s * 0.15, -s * 0.22, s * 0.11);
    this._drawCuteEye(ctx, s * 0.15, -s * 0.22, s * 0.11);
    // 小鼻子
    ctx.fillStyle = '#553333';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.1, s * 0.05, s * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    // 腮红
    this._drawBlush(ctx, -s * 0.28, -s * 0.1, s * 0.07, s * 0.04);
    this._drawBlush(ctx, s * 0.28, -s * 0.1, s * 0.07, s * 0.04);
    // 小尖牙嘴
    this._drawSmile(ctx, 0, s * 0.0, s * 0.08, 'fangs');

    ctx.restore();
  }

  // ================================================================
  // 17. 外星母舰 (BOSS_BRUTE) - 霸气机械母舰，阶段2变色
  // ================================================================
  _drawBossBrute(ctx, s, bodyColor, darkColor, time, enemy) {
    ctx.save();
    const phase = (enemy && enemy.phase) || 1;
    // 阶段2：颜色加深（更深红），alpha 闪烁
    const phaseColor = phase === 2 ? '#aa2211' : bodyColor;
    const phaseDark = phase === 2 ? '#441111' : darkColor;
    const flicker = phase === 2 ? (0.85 + Math.sin(time * 15) * 0.15) : 1;

    // 整体浮动（轻微下沉，呈现"重"感）
    const hover = Math.sin(time * 1.2) * s * 0.03;
    ctx.translate(0, hover);

    // === 大型装甲底座（八边形） ===
    ctx.fillStyle = phaseDark;
    ctx.beginPath();
    const baseR = s * 0.85;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i - Math.PI / 8;
      const px = Math.cos(a) * baseR;
      const py = Math.sin(a) * baseR * 0.55;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // 底座装甲高光
    ctx.fillStyle = hexToAlphaLocal(phaseColor, 0.3);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i - Math.PI / 8;
      const px = Math.cos(a) * baseR * 0.85;
      const py = Math.sin(a) * baseR * 0.85 * 0.55 - s * 0.05;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // === 巨型椭圆主体（带 1.5x 视觉，已经由 enemy.size 乘了）===
    ctx.fillStyle = phaseColor;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.1, s * 0.75, s * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 主体阴影
    ctx.fillStyle = phaseDark;
    ctx.globalAlpha = 0.3 * flicker;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.1, s * 0.7, s * 0.4, 0, 0.2, Math.PI - 0.2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, -s * 0.35, s * 0.4, s * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // === 母舰前部驾驶舱（暖橙色发光） ===
    const cockpitGlow = phase === 2
      ? (0.6 + Math.sin(time * 4) * 0.3)
      : (0.5 + Math.sin(time * 2) * 0.15);
    ctx.fillStyle = `rgba(255,170,68,${cockpitGlow})`;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.15, s * 0.45, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // 驾驶舱边框
    ctx.strokeStyle = '#ffaa44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.15, s * 0.45, s * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();

    // === 4 个大眼（机械眼罩） ===
    // 左大眼
    ctx.fillStyle = '#1a0a0a';
    ctx.beginPath();
    ctx.ellipse(-s * 0.28, -s * 0.2, s * 0.12, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = phase === 2 ? '#ff2200' : '#ffaa44';
    ctx.beginPath();
    ctx.arc(-s * 0.28, -s * 0.2, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-s * 0.3, -s * 0.22, s * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // 中大眼
    ctx.fillStyle = '#1a0a0a';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.22, s * 0.13, s * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = phase === 2 ? '#ff2200' : '#ffaa44';
    ctx.beginPath();
    ctx.arc(0, -s * 0.22, s * 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-s * 0.02, -s * 0.24, s * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // 右大眼
    ctx.fillStyle = '#1a0a0a';
    ctx.beginPath();
    ctx.ellipse(s * 0.28, -s * 0.2, s * 0.12, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = phase === 2 ? '#ff2200' : '#ffaa44';
    ctx.beginPath();
    ctx.arc(s * 0.28, -s * 0.2, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s * 0.26, -s * 0.22, s * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // 第四只小眼（中心下方）
    ctx.fillStyle = phase === 2 ? '#ff4444' : '#ffcc66';
    ctx.beginPath();
    ctx.arc(0, s * 0.05, s * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // === 武器炮管（左右两门） ===
    for (let side = -1; side <= 1; side += 2) {
      // 炮塔
      ctx.fillStyle = phaseDark;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.55, s * 0.0, s * 0.12, s * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      // 炮管
      ctx.fillStyle = phaseColor;
      ctx.fillRect(side * s * 0.6, -s * 0.1, s * 0.2, s * 0.18);
      // 炮口
      ctx.fillStyle = '#1a0a0a';
      ctx.beginPath();
      ctx.arc(side * s * 0.8, -s * 0.01, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      // 炮口光（脉冲）
      const muzzleGlow = 0.5 + Math.sin(time * 8 + side) * 0.3;
      ctx.fillStyle = `rgba(255,200,100,${muzzleGlow * (phase === 2 ? 0.8 : 0.5)})`;
      ctx.beginPath();
      ctx.arc(side * s * 0.8, -s * 0.01, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    // === 顶部天线（雷达）===
    ctx.strokeStyle = phaseColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.6);
    ctx.lineTo(0, -s * 0.85);
    ctx.stroke();
    // 天线尖发光球
    const antennaPulse = 0.7 + Math.sin(time * 3) * 0.3;
    ctx.fillStyle = phase === 2
      ? `rgba(255,40,40,${antennaPulse})`
      : `rgba(255,180,80,${antennaPulse})`;
    ctx.beginPath();
    ctx.arc(0, -s * 0.88, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'butt';

    // === 底部推进器（喷火） ===
    for (let i = -1; i <= 1; i++) {
      const px = i * s * 0.3;
      // 喷口
      ctx.fillStyle = phaseDark;
      ctx.beginPath();
      ctx.ellipse(px, s * 0.4, s * 0.1, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      // 火焰粒子（3 段）
      for (let f = 0; f < 3; f++) {
        const flameH = s * (0.15 + f * 0.08);
        const flameAlpha = (0.7 - f * 0.2) * (0.7 + Math.sin(time * 12 + i + f) * 0.3);
        ctx.fillStyle = f === 0
          ? `rgba(255,255,200,${flameAlpha})`
          : f === 1
          ? `rgba(255,170,80,${flameAlpha})`
          : `rgba(255,80,40,${flameAlpha * 0.8})`;
        ctx.beginPath();
        ctx.ellipse(px, s * 0.45 + flameH * 0.5, s * 0.06 - f * 0.01, flameH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === 阶段2：狂暴红光闪烁（覆盖在本体上） ===
    if (phase === 2) {
      ctx.globalAlpha = (0.3 + Math.sin(time * 20) * 0.25) * 0.4;
      ctx.fillStyle = '#ff1100';
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.7, s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ================================================================
  // 18. Agent F: 护盾兵 (shield) - 蓝色能量甲 + 周期激活大气泡
  // ================================================================

  /** 护盾兵 无敌期 大气泡（外发光 + 双层环 + 六边形） */
  _drawShieldAura(ctx, enemy, s, time) {
    const auraR = s * 1.6;
    const pulse = 0.85 + Math.sin(time * 6) * 0.15;
    const cyan = '#66ddff';

    ctx.save();
    // 外层径向渐变
    const grd = ctx.createRadialGradient(enemy.x, enemy.y, s * 0.4, enemy.x, enemy.y, auraR);
    grd.addColorStop(0, hexToAlphaLocal(cyan, 0.45 * pulse));
    grd.addColorStop(0.55, hexToAlphaLocal(cyan, 0.2 * pulse));
    grd.addColorStop(1, hexToAlphaLocal(cyan, 0));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, auraR, 0, Math.PI * 2);
    ctx.fill();

    // 内层气泡（半透明实心）
    ctx.fillStyle = hexToAlphaLocal(cyan, 0.18 * pulse);
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, s * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hexToAlphaLocal(cyan, 0.9 * pulse);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, s * 1.1, 0, Math.PI * 2);
    ctx.stroke();

    // 旋转六边形能量环
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(time * 1.5);
    ctx.strokeStyle = hexToAlphaLocal(cyan, 0.7 * pulse);
    ctx.lineWidth = 1.5;
    this._poly(ctx, 0, 0, s * 1.3, 6, 0);
    ctx.stroke();
    ctx.rotate(-time * 3);
    ctx.strokeStyle = hexToAlphaLocal(cyan, 0.4 * pulse);
    ctx.lineWidth = 1;
    this._poly(ctx, 0, 0, s * 1.45, 6, Math.PI / 6);
    ctx.stroke();
    ctx.restore();

    // 顶部小光点提示
    ctx.fillStyle = hexToAlphaLocal(cyan, 0.9);
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y - s * 1.15, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y - s * 1.15, s * 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** 护盾兵 警告期：地面脉冲光圈（提示即将激活） */
  _drawShieldWarning(ctx, enemy, s, time) {
    const pulse = (Math.sin(time * 12) + 1) * 0.5; // 0..1
    ctx.save();
    ctx.strokeStyle = `rgba(102,221,255,${0.35 + pulse * 0.35})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, s * 1.0 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(102,221,255,${0.15 + pulse * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, s * 1.15 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** 治疗虫：地面治疗范围圈（脉冲绿色虚线） */
  _drawHealRange(ctx, enemy, s, time) {
    const radius = enemy.healRadius || 60;
    const pulse = 0.5 + Math.sin(time * 2) * 0.25;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    // 外圈（虚线）
    ctx.strokeStyle = `rgba(102,255,136,${0.25 + pulse * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // 内圈（实线更亮）
    ctx.strokeStyle = `rgba(170,255,170,${0.4 * pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    // 上浮的绿色十字粒子（强化治疗感）
    for (let i = 0; i < 3; i++) {
      const a = time * 1.2 + (Math.PI * 2 / 3) * i;
      const px = Math.cos(a) * radius * 0.7;
      const py = Math.sin(a) * radius * 0.7;
      const alph = 0.5 + Math.sin(time * 3 + i) * 0.3;
      ctx.fillStyle = `rgba(170,255,170,${alph})`;
      ctx.fillRect(px - 1.5, py - 4, 3, 8);
      ctx.fillRect(px - 4, py - 1.5, 8, 3);
    }
    ctx.restore();
  }

  /** 护盾兵 本体 - 圆胖蓝盾机器人 */
  _drawShield(ctx, s, bodyColor, darkColor, time, enemy) {
    ctx.save();
    const bob = Math.sin(time * 2) * s * 0.02;
    ctx.translate(0, bob);

    // 短腿
    for (let side = -1; side <= 1; side += 2) {
      const legSwing = Math.sin(time * 2 + (side > 0 ? Math.PI : 0)) * s * 0.04;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.22, s * 0.5 + legSwing, s * 0.12, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 圆胖身体
    this._drawRoundBody(ctx, 0, 0, s * 0.55, s * 0.5, bodyColor, darkColor);

    // 胸前盾形护甲片
    ctx.fillStyle = this._lighten(bodyColor, 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 0.18);
    ctx.lineTo(0, -s * 0.32);
    ctx.lineTo(s * 0.25, -s * 0.18);
    ctx.lineTo(s * 0.18, s * 0.18);
    ctx.lineTo(0, s * 0.28);
    ctx.lineTo(-s * 0.18, s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 盾面十字标记
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-s * 0.03, -s * 0.05, s * 0.06, s * 0.2);
    ctx.fillRect(-s * 0.1, -s * 0.0, s * 0.2, s * 0.06);

    // 短粗手臂（手持一面小盾）
    for (let side = -1; side <= 1; side += 2) {
      const armSwing = Math.sin(time * 1.5 + (side > 0 ? 0 : Math.PI)) * 0.1;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.55, s * 0.05 + armSwing * s, s * 0.1, s * 0.14, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
      // 小盾
      ctx.fillStyle = this._lighten(bodyColor, 0.2);
      ctx.beginPath();
      ctx.arc(side * s * 0.65, s * 0.15 + armSwing * s, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(side * s * 0.65, s * 0.15 + armSwing * s, s * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 可爱脸
    this._drawCuteEye(ctx, -s * 0.15, -s * 0.18, s * 0.11);
    this._drawCuteEye(ctx, s * 0.15, -s * 0.18, s * 0.11);
    this._drawBlush(ctx, -s * 0.28, -s * 0.05, s * 0.07, s * 0.04);
    this._drawBlush(ctx, s * 0.28, -s * 0.05, s * 0.07, s * 0.04);
    this._drawSmile(ctx, 0, s * 0.02, s * 0.08);

    // 头顶蓝色尖刺（战盔）
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.lineTo(-s * 0.12, -s * 0.78);
    ctx.lineTo(s * 0.12, -s * 0.78);
    ctx.closePath();
    ctx.fill();
    // 战盔宝石
    const gemPulse = 0.7 + Math.sin(time * 4) * 0.3;
    ctx.fillStyle = `rgba(102,221,255,${gemPulse})`;
    ctx.beginPath();
    ctx.arc(0, -s * 0.62, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    this._softGlow(ctx, 0, -s * 0.62, s * 0.05, '#66ddff', gemPulse);

    ctx.restore();
  }

  // ================================================================
  // 19. Agent F: 爆裂虫 (swarm) - 小型快速不稳定的橙红虫
  // ================================================================

  /** 爆裂虫 本体 - 不稳定的橙红小虫（带警告抖动） */
  _drawSwarm(ctx, s, bodyColor, darkColor, time, enemy) {
    ctx.save();
    // 不稳定抖动
    const jitterX = Math.sin(time * 22) * s * 0.03;
    const jitterY = Math.cos(time * 18) * s * 0.03;
    ctx.translate(jitterX, jitterY);

    // 6条小短腿（快速抖动）
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const idx = i % 3;
      const lx = side * s * 0.4;
      const ly = -s * 0.1 + idx * s * 0.18;
      const swing = Math.sin(time * 9 + i * 0.8) * s * 0.05;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(lx + swing, ly + s * 0.12, s * 0.06, s * 0.1, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 椭圆身体（略带尖刺的爆裂感）
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.42, s * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    // 身体纹理
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.3); ctx.lineTo(0, s * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, 0); ctx.lineTo(s * 0.3, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 身体高光
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, -s * 0.12, s * 0.22, s * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // 警告脉动红光
    const warningPulse = 0.35 + Math.sin(time * 6) * 0.2;
    ctx.fillStyle = `rgba(255,80,40,${warningPulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 大小不一的不稳定小眼
    this._drawCuteEye(ctx, -s * 0.14, -s * 0.08, s * 0.12);
    this._drawCuteEye(ctx, s * 0.14, -s * 0.08, s * 0.1);
    // 腮红
    this._drawBlush(ctx, -s * 0.25, s * 0.08, s * 0.07, s * 0.05);
    this._drawBlush(ctx, s * 0.25, s * 0.08, s * 0.07, s * 0.05);
    // 疯狂尖牙嘴
    this._drawSmile(ctx, 0, s * 0.12, s * 0.1, 'fangs');

    // 触角（快速抖动）
    for (let side = -1; side <= 1; side += 2) {
      const ax = side * s * 0.12 + Math.sin(time * 12 + side) * s * 0.05;
      const ay = -s * 0.5;
      const tx = side * s * 0.22 + Math.sin(time * 14 + side) * s * 0.12;
      const ty = -s * 0.7;
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax + side * s * 0.18, ay - s * 0.1, tx, ty);
      ctx.stroke();
      this._softGlow(ctx, tx, ty, s * 0.05, '#ffdd44', 0.6 + Math.sin(time * 8 + side) * 0.3);
    }
    ctx.lineCap = 'butt';

    ctx.restore();
  }

  // ================================================================
  // 20. Agent A9 P4-1: 幽灵 (ghost) - 半透明蓝色漂浮小幽灵
  // ================================================================

  /** 幽灵 - 半透明蓝色小幽灵，周期性隐身 */
  _drawGhost(ctx, s, bodyColor, darkColor, time, enemy) {
    ctx.save();
    // 周期隐身：根据敌人 stealth 标记（EnemySystem 周期切换）
    const stealth = enemy.stealthed;
    const baseAlpha = stealth ? 0.15 : 0.85;
    const float = Math.sin(time * 2.5) * s * 0.05;
    ctx.translate(0, float);

    // 整体 alpha
    ctx.globalAlpha = baseAlpha;

    // 外发光（淡蓝色）
    const auraPulse = 0.3 + Math.sin(time * 3) * 0.15;
    const grd = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 0.9);
    grd.addColorStop(0, `rgba(170,204,255,${auraPulse})`);
    grd.addColorStop(1, 'rgba(170,204,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2); ctx.fill();

    // 幽灵身体（圆顶 + 波浪下摆）
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.1);
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.5, -s * 0.25, -s * 0.65);
    ctx.quadraticCurveTo(0, -s * 0.85, s * 0.25, -s * 0.65);
    ctx.quadraticCurveTo(s * 0.6, -s * 0.5, s * 0.55, s * 0.1);
    // 波浪下摆
    const tailWave = Math.sin(time * 4) * s * 0.08;
    ctx.quadraticCurveTo(s * 0.4, s * 0.35, s * 0.25, s * 0.15 + tailWave * 0.5);
    ctx.quadraticCurveTo(s * 0.1, s * 0.3, 0, s * 0.15);
    ctx.quadraticCurveTo(-s * 0.1, s * 0.3, -s * 0.25, s * 0.15 + tailWave * 0.5);
    ctx.quadraticCurveTo(-s * 0.4, s * 0.35, -s * 0.55, s * 0.1);
    ctx.closePath();
    ctx.fill();

    // 身体高光
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.4, s * 0.22, s * 0.15, -0.3, 0, Math.PI * 2); ctx.fill();

    // 阴影底
    ctx.fillStyle = darkColor;
    ctx.globalAlpha = baseAlpha * 0.2;
    ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.45, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();

    // 大眼（黑色椭圆 + 蓝光高光）
    ctx.globalAlpha = baseAlpha;
    ctx.fillStyle = '#1a0a1a';
    ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.2, s * 0.12, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.2, s * 0.12, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    // 眼内蓝色高光
    ctx.fillStyle = '#88aaff';
    ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.24, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.24, s * 0.05, 0, Math.PI * 2); ctx.fill();
    // 白色高光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.26, s * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.26, s * 0.025, 0, Math.PI * 2); ctx.fill();

    // 小嘴
    ctx.fillStyle = '#1a0a1a';
    ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.08, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();

    // 隐形时虚线轮廓
    if (stealth) {
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.1, s * 0.6, s * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ================================================================
  // 21. Agent A9 P4-1: 自爆卡车 (truck) - 笨重卡车 + 警示灯
  // ================================================================

  /** 自爆卡车 - 大块头卡车 + 闪烁警示灯 + 履带 */
  _drawTruck(ctx, s, bodyColor, darkColor, time, enemy) {
    ctx.save();
    const rumble = Math.sin(time * 8) * s * 0.02;
    ctx.translate(rumble, 0);

    // 底部阴影
    ctx.fillStyle = 'rgba(40,20,20,0.3)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.7, s * 0.85, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();

    // 4 个轮子（履带式）
    for (let i = 0; i < 4; i++) {
      const wx = (i < 2 ? -1 : 1) * s * 0.6;
      const wy = (i % 2 === 0 ? -1 : 1) * s * 0.15 + s * 0.55;
      ctx.fillStyle = '#1a0a0a';
      ctx.beginPath(); ctx.arc(wx, wy, s * 0.15, 0, Math.PI * 2); ctx.fill();
      // 轮毂
      ctx.fillStyle = '#554444';
      ctx.beginPath(); ctx.arc(wx, wy, s * 0.07, 0, Math.PI * 2); ctx.fill();
    }

    // 履带条
    ctx.fillStyle = darkColor;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-s * 0.75, s * 0.4, s * 1.5, s * 0.12);
    ctx.globalAlpha = 1;

    // 卡车车斗（大矩形 + 圆角）
    ctx.fillStyle = bodyColor;
    this._roundRect(ctx, -s * 0.7, -s * 0.1, s * 1.4, s * 0.55, 6);
    ctx.fill();
    // 边框
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    this._roundRect(ctx, -s * 0.7, -s * 0.1, s * 1.4, s * 0.55, 6);
    ctx.stroke();

    // 驾驶舱（小方块）
    ctx.fillStyle = this._darken(bodyColor, 0.7);
    this._roundRect(ctx, s * 0.3, -s * 0.45, s * 0.4, s * 0.45, 4);
    ctx.fill();
    // 车窗
    ctx.fillStyle = '#aaddff';
    this._roundRect(ctx, s * 0.35, -s * 0.4, s * 0.3, s * 0.22, 3);
    ctx.fill();
    // 窗高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(s * 0.4, -s * 0.38);
    ctx.lineTo(s * 0.55, -s * 0.38);
    ctx.lineTo(s * 0.45, -s * 0.2);
    ctx.lineTo(s * 0.4, -s * 0.2);
    ctx.closePath();
    ctx.fill();

    // 货箱上的危险标记（黄色三角警告 + 爆炸图案）
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.1);
    ctx.lineTo(-s * 0.15, -s * 0.05);
    ctx.lineTo(-s * 0.55, -s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a0a0a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 标记内的爆炸线
    ctx.strokeStyle = '#1a0a0a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.02);
    ctx.lineTo(-s * 0.35, -s * 0.0);
    ctx.stroke();

    // 危险品标识（Hazard）
    ctx.fillStyle = this._darken(bodyColor, 0.5);
    this._roundRect(ctx, s * 0.05, -s * 0.0, s * 0.18, s * 0.18, 2);
    ctx.fill();
    ctx.fillStyle = '#ffdd44';
    ctx.font = `${s * 0.18}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', s * 0.14, s * 0.09);

    // 顶部警示灯（红蓝交替闪烁）
    const warnOn = Math.sin(time * 6) > 0;
    ctx.fillStyle = warnOn ? '#ff3322' : '#3322ff';
    ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.18, s * 0.06, 0, Math.PI * 2); ctx.fill();
    this._softGlow(ctx, -s * 0.3, -s * 0.18, s * 0.08, warnOn ? '#ff3322' : '#3322ff', warnOn ? 0.8 : 0.2);

    // 引爆器（闪烁的红色大按钮）
    const boomPulse = 0.6 + Math.sin(time * 5) * 0.4;
    ctx.fillStyle = `rgba(255,68,34,${boomPulse})`;
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0a0a';
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.04, 0, Math.PI * 2); ctx.fill();
    // "爆炸"文字
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${s * 0.08}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💥', 0, -s * 0.05);

    // 排气黑烟
    for (let i = 0; i < 3; i++) {
      const px = s * 0.55 + i * s * 0.1;
      const py = s * 0.0 - Math.abs(Math.sin(time * 3 + i)) * s * 0.2;
      ctx.fillStyle = `rgba(80,80,80,${0.3 - i * 0.08})`;
      ctx.beginPath(); ctx.arc(px, py, s * 0.06 + i * 0.01, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  // ================================================================
  // 22. Agent A9 P4-1: 时间扭曲者 (timeWarp) - 紫色沙漏 + 时间光环
  // ================================================================

  /** 时间扭曲者 - 紫色法师 + 沙漏 + 时间光环 */
  _drawTimeWarp(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const sway = Math.sin(time * 1.5) * s * 0.03;
    ctx.translate(sway, 0);

    // 时间光环（旋转的齿轮/符文环）
    ctx.save();
    ctx.rotate(time * 0.4);
    ctx.strokeStyle = hexToAlphaLocal(bodyColor, 0.5);
    ctx.lineWidth = 1.5;
    this._poly(ctx, 0, 0, s * 0.9, 12, 0);
    ctx.stroke();
    // 12 颗光点（时钟刻度）
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 / 12) * i;
      const px = Math.cos(a) * s * 0.9;
      const py = Math.sin(a) * s * 0.9;
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : bodyColor;
      ctx.beginPath(); ctx.arc(px, py, i % 3 === 0 ? s * 0.05 : s * 0.03, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // 反向旋转的小光环
    ctx.save();
    ctx.rotate(-time * 0.7);
    ctx.strokeStyle = hexToAlphaLocal('#aa66ff', 0.4);
    ctx.lineWidth = 1;
    this._poly(ctx, 0, 0, s * 0.7, 6, Math.PI / 6);
    ctx.stroke();
    ctx.restore();

    // 飘浮感（半透明拖影）
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.15 - i * 0.04;
      ctx.fillStyle = bodyColor;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.05 - i * 4, s * 0.45 - i * 0.02, s * 0.4 - i * 0.02, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 主体：宽大长袍形身体
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, s * 0.55);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.1, -s * 0.3, -s * 0.4);
    ctx.quadraticCurveTo(0, -s * 0.55, s * 0.3, -s * 0.4);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.1, s * 0.5, s * 0.55);
    ctx.quadraticCurveTo(0, s * 0.5, -s * 0.5, s * 0.55);
    ctx.closePath();
    ctx.fill();

    // 长袍竖纹
    ctx.strokeStyle = this._darken(bodyColor, 0.6);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    for (let i = -2; i <= 2; i++) {
      const x0 = i * s * 0.15;
      ctx.beginPath();
      ctx.moveTo(x0, -s * 0.3);
      ctx.lineTo(x0 * 0.8, s * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 大沙漏（胸前）
    const hourglassX = 0;
    const hourglassY = s * 0.05;
    // 沙漏框
    ctx.fillStyle = '#332244';
    ctx.beginPath();
    ctx.moveTo(hourglassX - s * 0.2, hourglassY - s * 0.18);
    ctx.lineTo(hourglassX + s * 0.2, hourglassY - s * 0.18);
    ctx.lineTo(hourglassX + s * 0.2, hourglassY - s * 0.1);
    ctx.lineTo(hourglassX, hourglassY + s * 0.1);
    ctx.lineTo(hourglassX - s * 0.2, hourglassY - s * 0.1);
    ctx.closePath();
    ctx.fill();
    // 沙漏下半
    ctx.beginPath();
    ctx.moveTo(hourglassX - s * 0.2, hourglassY + s * 0.18);
    ctx.lineTo(hourglassX + s * 0.2, hourglassY + s * 0.18);
    ctx.lineTo(hourglassX + s * 0.2, hourglassY + s * 0.1);
    ctx.lineTo(hourglassX, hourglassY - s * 0.1);
    ctx.lineTo(hourglassX - s * 0.2, hourglassY + s * 0.1);
    ctx.closePath();
    ctx.fill();
    // 沙子（流动）
    const sandProgress = (time % 2) / 2; // 0~1
    ctx.fillStyle = '#ffddaa';
    // 上半沙子
    ctx.beginPath();
    ctx.moveTo(hourglassX - s * 0.16, hourglassY - s * 0.18);
    ctx.lineTo(hourglassX + s * 0.16, hourglassY - s * 0.18);
    ctx.lineTo(hourglassX + s * 0.16, hourglassY - s * 0.18 + sandProgress * 0.08);
    ctx.lineTo(hourglassX, hourglassY - s * 0.1 + sandProgress * 0.05);
    ctx.lineTo(hourglassX - s * 0.16, hourglassY - s * 0.18 + sandProgress * 0.08);
    ctx.closePath();
    ctx.fill();
    // 下半沙子堆
    const lowerLevel = sandProgress * s * 0.14;
    ctx.beginPath();
    ctx.moveTo(hourglassX - s * 0.18, hourglassY + s * 0.18);
    ctx.lineTo(hourglassX + s * 0.18, hourglassY + s * 0.18);
    ctx.lineTo(hourglassX + s * 0.15, hourglassY + s * 0.18 - lowerLevel);
    ctx.lineTo(hourglassX, hourglassY + s * 0.1);
    ctx.lineTo(hourglassX - s * 0.15, hourglassY + s * 0.18 - lowerLevel);
    ctx.closePath();
    ctx.fill();
    // 沙漏高光
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hourglassX - s * 0.2, hourglassY - s * 0.18);
    ctx.lineTo(hourglassX, hourglassY - s * 0.05);
    ctx.lineTo(hourglassX - s * 0.2, hourglassY - s * 0.1);
    ctx.stroke();

    // 兜帽
    ctx.fillStyle = this._darken(bodyColor, 0.4);
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.35);
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.65, 0, -s * 0.7);
    ctx.quadraticCurveTo(s * 0.45, -s * 0.65, s * 0.4, -s * 0.35);
    ctx.lineTo(s * 0.3, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.25, -s * 0.5, 0, -s * 0.55);
    ctx.quadraticCurveTo(-s * 0.25, -s * 0.5, -s * 0.3, -s * 0.3);
    ctx.closePath();
    ctx.fill();

    // 兜帽内的两团紫光（眼睛）
    const eyePulse = 0.7 + Math.sin(time * 4) * 0.3;
    ctx.fillStyle = `rgba(170,102,255,${eyePulse})`;
    ctx.beginPath(); ctx.arc(-s * 0.13, -s * 0.4, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.13, -s * 0.4, s * 0.05, 0, Math.PI * 2); ctx.fill();

    // 时空裂缝（周围小光点）
    for (let i = 0; i < 4; i++) {
      const a = time * 1.5 + (Math.PI / 2) * i;
      const pr = s * 0.8 + Math.sin(time * 2 + i) * s * 0.1;
      const px = Math.cos(a) * pr;
      const py = Math.sin(a) * pr;
      this._drawSparkle(ctx, px, py, s * 0.04, '#ffccff', 0.7);
    }

    ctx.restore();
  }

  // ================================================================
  // 23. Agent A9 P4-1: 感染体 (infected) - 绿色变异僵尸
  // ================================================================

  /** 感染体 - 绿色变异僵尸 + 黏液滴落 */
  _drawInfected(ctx, s, bodyColor, darkColor, time) {
    ctx.save();
    const lurch = Math.sin(time * 2) * s * 0.04;
    ctx.translate(lurch, 0);

    // 黏液拖尾（脚下）
    for (let i = 0; i < 3; i++) {
      const px = (i - 1) * s * 0.25;
      const py = s * 0.55 + i * s * 0.05;
      ctx.fillStyle = `rgba(136,255,102,${0.4 - i * 0.1})`;
      ctx.beginPath(); ctx.ellipse(px, py, s * 0.12, s * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    }

    // 短腿
    for (let side = -1; side <= 1; side += 2) {
      const legSwing = Math.sin(time * 2 + (side > 0 ? Math.PI : 0)) * s * 0.03;
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.2, s * 0.5, s * 0.12, s * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 不规则变形身体（黏液感）
    const wobble = Math.sin(time * 3) * 0.05;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55 + wobble * s * 0.05, s * 0.5 + wobble * s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();

    // 身体上绿色斑点（感染迹象）
    ctx.fillStyle = this._darken(bodyColor, 0.6);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.7 + time * 0.3;
      const d = s * 0.25;
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d * 0.8;
      ctx.beginPath(); ctx.arc(dx, dy, s * 0.04, 0, Math.PI * 2); ctx.fill();
    }
    // 身体上隆起的脓包
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 1.2;
      const d = s * 0.32;
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;
      ctx.fillStyle = `rgba(180,255,150,0.6)`;
      ctx.beginPath(); ctx.arc(dx, dy, s * 0.05, 0, Math.PI * 2); ctx.fill();
    }

    // 身体高光
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.15, s * 0.2, s * 0.13, -0.3, 0, Math.PI * 2); ctx.fill();

    // 短小手臂（一前一后）
    for (let side = -1; side <= 1; side += 2) {
      const armSwing = Math.sin(time * 2.5 + (side > 0 ? 0 : Math.PI)) * 0.4;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.55, s * 0.0 + armSwing * s * 0.3, s * 0.1, s * 0.15, side * 0.3 + armSwing * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 头部（略椭圆）
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(0, -s * 0.4, s * 0.3, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();

    // 头上一撮乱发
    ctx.strokeStyle = this._darken(bodyColor, 0.7);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const hx = i * s * 0.08;
      ctx.beginPath();
      ctx.moveTo(hx, -s * 0.6);
      ctx.lineTo(hx + Math.sin(time * 4 + i) * s * 0.02, -s * 0.75);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // 不对称的吓人眼（一个大一个小，红色）
    ctx.fillStyle = '#ff3322';
    ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.38, s * 0.07, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.12, -s * 0.4, s * 0.05, 0, Math.PI * 2); ctx.fill();
    // 眼内瞳孔
    ctx.fillStyle = '#1a0a0a';
    ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.38, s * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.12, -s * 0.4, s * 0.02, 0, Math.PI * 2); ctx.fill();

    // 嘴：烂牙的龅牙
    ctx.fillStyle = '#332222';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.22, s * 0.12, s * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    // 烂牙
    ctx.fillStyle = '#ffeecc';
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.24);
    ctx.lineTo(-s * 0.04, -s * 0.17);
    ctx.lineTo(-s * 0.02, -s * 0.24);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.04, -s * 0.24);
    ctx.lineTo(s * 0.05, -s * 0.16);
    ctx.lineTo(s * 0.07, -s * 0.24);
    ctx.fill();

    // 滴落的黏液
    const dropPhase = (time * 0.7) % 1;
    ctx.fillStyle = `rgba(136,255,102,${1 - dropPhase})`;
    ctx.beginPath(); ctx.ellipse(0, s * 0.4 + dropPhase * s * 0.3, s * 0.03, s * 0.04 + dropPhase * s * 0.02, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  // ================================================================
  // 24. Agent A9 P4-1: 召唤师 (summoner) - 粉色法师 + 召唤阵
  // ================================================================

  /** 召唤师 - 粉色法师 + 旋转召唤阵 + 法杖 */
  _drawSummoner(ctx, s, bodyColor, darkColor, time, enemy) {
    ctx.save();
    const float = Math.sin(time * 2) * s * 0.04;
    ctx.translate(0, float);

    // 地面召唤阵（旋转的法阵）
    ctx.save();
    ctx.translate(0, s * 0.55);
    ctx.rotate(time * 0.5);
    // 外环
    ctx.strokeStyle = hexToAlphaLocal(bodyColor, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.stroke();
    // 内环
    ctx.strokeStyle = hexToAlphaLocal('#aa3366', 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.stroke();
    // 五芒星（召唤符号）
    ctx.strokeStyle = hexToAlphaLocal('#ffaadd', 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const px = Math.cos(a) * s * 0.4;
      const py = Math.sin(a) * s * 0.4;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // 6 个小型能量点
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      const px = Math.cos(a) * s * 0.55;
      const py = Math.sin(a) * s * 0.55;
      ctx.fillStyle = '#ffaadd';
      ctx.beginPath(); ctx.arc(px, py, s * 0.04, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // 长袍身体
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, s * 0.5);
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.05, -s * 0.3, -s * 0.3);
    ctx.quadraticCurveTo(0, -s * 0.45, s * 0.3, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.05, s * 0.45, s * 0.5);
    ctx.quadraticCurveTo(0, s * 0.45, -s * 0.45, s * 0.5);
    ctx.closePath();
    ctx.fill();

    // 长袍装饰条
    ctx.strokeStyle = this._darken(bodyColor, 0.5);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.4);
    ctx.lineTo(0, s * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.2);
    ctx.lineTo(-s * 0.25, s * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.2, -s * 0.2);
    ctx.lineTo(s * 0.25, s * 0.4);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 兜帽
    ctx.fillStyle = this._darken(bodyColor, 0.4);
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.4, -s * 0.6, 0, -s * 0.65);
    ctx.quadraticCurveTo(s * 0.4, -s * 0.6, s * 0.35, -s * 0.3);
    ctx.closePath();
    ctx.fill();

    // 兜帽尖尖
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.65);
    ctx.lineTo(0, -s * 0.78);
    ctx.lineTo(s * 0.05, -s * 0.65);
    ctx.closePath();
    ctx.fill();

    // 兜帽内粉色发光眼
    const eyeGlow = 0.6 + Math.sin(time * 3) * 0.4;
    ctx.fillStyle = `rgba(255,170,221,${eyeGlow})`;
    ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.42, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.1, -s * 0.42, s * 0.04, 0, Math.PI * 2); ctx.fill();
    this._softGlow(ctx, 0, -s * 0.42, s * 0.06, '#ffaadd', eyeGlow);

    // 法杖（伸到右边）
    ctx.strokeStyle = this._darken(bodyColor, 0.6);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.4, -s * 0.1);
    ctx.lineTo(s * 0.7, -s * 0.45);
    ctx.stroke();

    // 法杖顶端的法球（旋转的六芒星）
    const orbPulse = 0.7 + Math.sin(time * 4) * 0.3;
    ctx.save();
    ctx.translate(s * 0.7, -s * 0.5);
    ctx.rotate(time * 2);
    // 法球主体
    ctx.fillStyle = `rgba(255,170,221,${orbPulse})`;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
    // 六芒星
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI / 3) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.12, Math.sin(a) * s * 0.12);
      ctx.lineTo(Math.cos(a + Math.PI) * s * 0.12, Math.sin(a + Math.PI) * s * 0.12);
      ctx.stroke();
    }
    ctx.restore();
    this._softGlow(ctx, s * 0.7, -s * 0.5, s * 0.15, '#ffaadd', orbPulse);

    // 召唤粒子（身体周围浮动的小光点）
    for (let i = 0; i < 4; i++) {
      const a = time * 1.5 + (Math.PI / 2) * i;
      const pr = s * 0.5 + Math.sin(time * 2 + i) * s * 0.1;
      const px = Math.cos(a) * pr;
      const py = Math.sin(a) * pr - s * 0.2;
      this._drawSparkle(ctx, px, py, s * 0.04, '#ffaadd', 0.7);
    }

    // 召唤中提示（如果 enemy 处于召唤冷却）
    if (enemy.summonCooldown > 0) {
      const cdAlpha = Math.min(1, enemy.summonCooldown);
      ctx.fillStyle = `rgba(255,170,221,${cdAlpha * 0.5})`;
      ctx.beginPath(); ctx.arc(0, s * 0.55, s * 0.7, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }
}
