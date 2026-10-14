// ================================================================
// 大招全屏特效渲染器 - 9 个塔 R 键专属电影级动画
// 仅在 AbilitySystem 触发后短期显示 (duration ≈ 1.5s)，progress 从 0 → 1
// 设计原则：每个大招颜色 / 形状 / 节奏差异化，强化"专属感"
// ================================================================

/** 缓动函数：开始慢、中间快、结束慢（用于进度映射） */
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class AbilityRenderer {
  /**
   * 入口：根据 abilityId 分发到具体效果
   * @param {string} abilityId
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} progress  0~1 动画进度
   * @param {number} w 屏幕逻辑宽度
   * @param {number} h 屏幕逻辑高度
   * @param {number} [time] 可选全局时间（秒），用于呼吸/闪烁
   */
  static draw(abilityId, ctx, progress, w, h, time = 0) {
    // 防御性：progress 可能在 0~1 外，统一夹紧
    const p = Math.max(0, Math.min(1, progress));
    switch (abilityId) {
      case 'laser_pierce':   return AbilityRenderer._thorBeam(ctx, p, w, h, time);
      case 'overload':       return AbilityRenderer._thunderStorm(ctx, p, w, h, time);
      case 'cluster_missile': return AbilityRenderer._missileBarrage(ctx, p, w, h, time);
      case 'energy_shield':  return AbilityRenderer._shieldWall(ctx, p, w, h, time);
      case 'energy_infusion': return AbilityRenderer._energyRain(ctx, p, w, h, time);
      case 'shock_wave':     return AbilityRenderer._hulkSmash(ctx, p, w, h, time);
      case 'absolute_zero':  return AbilityRenderer._iceNova(ctx, p, w, h, time);
      case 'plasma_storm':   return AbilityRenderer._plasmaRain(ctx, p, w, h, time);
      case 'emergency_repair': return AbilityRenderer._nanoSwarm(ctx, p, w, h, time);
      default:
        // 未知 abilityId：静默处理（避免崩溃）
        return;
    }
  }

  // ================================================================
  // 1) 激光炮台 - 雷神之锤：贯穿天地的紫色光柱
  // （来自 plan 原版，完整实现）
  // ================================================================
  static _thorBeam(ctx, p, w, h, time) {
    // 全屏白闪（按 sin 曲线淡入淡出）
    const intensity = Math.sin(p * Math.PI);
    ctx.fillStyle = `rgba(255,255,255,${intensity * 0.4})`;
    ctx.fillRect(0, 0, w, h);

    // 主光柱（progress 0.3~0.5 之间最亮）
    if (p > 0.3 && p < 0.5) {
      const beamW = w * 0.15;
      const grad = ctx.createLinearGradient(w / 2 - beamW, 0, w / 2 + beamW, 0);
      grad.addColorStop(0, 'rgba(180,100,255,0)');
      grad.addColorStop(0.5, 'rgba(255,200,255,1)');
      grad.addColorStop(1, 'rgba(180,100,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(w / 2 - beamW, 0, beamW * 2, h);
    }

    // 紫色光圈扩散（progress 0.2~0.8）
    if (p > 0.2 && p < 0.8) {
      const ringP = (p - 0.2) / 0.6;
      const ringR = Math.max(w, h) * ringP;
      ctx.strokeStyle = `rgba(180,100,255,${(1 - ringP) * 0.6})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ================================================================
  // 2) 电磁塔 - 雷神雷电风暴：金黄闪电全屏刷屏
  // ================================================================
  static _thunderStorm(ctx, p, w, h, time) {
    // 背景金黄渐变闪
    const intensity = Math.sin(p * Math.PI);
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, `rgba(255,220,80,${intensity * 0.25})`);
    grd.addColorStop(0.5, `rgba(255,180,40,${intensity * 0.35})`);
    grd.addColorStop(1, `rgba(255,140,0,${intensity * 0.25})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // 多道随机闪电（确定性伪随机）
    if (p > 0.1 && p < 0.9) {
      const segs = 6;
      for (let i = 0; i < segs; i++) {
        const t = p * 5 + i;
        const seed = Math.sin(t * 13.37) * 0.5 + 0.5;
        const x = seed * w;
        const ySeed = Math.cos(t * 7.91) * 0.5 + 0.5;
        const alpha = (1 - p) * 0.8;
        ctx.strokeStyle = `rgba(255,255,200,${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let j = 1; j <= 5; j++) {
          const ny = (j / 5) * h;
          const offset = Math.sin(t * 20 + j * 3) * 30;
          ctx.lineTo(x + offset, ny);
        }
        ctx.stroke();
        // 外层光晕
        ctx.strokeStyle = `rgba(255,200,80,${alpha * 0.4})`;
        ctx.lineWidth = 8;
        ctx.stroke();
      }
    }
  }

  // ================================================================
  // 3) 导弹塔 - 钢铁侠导弹齐射：橙红导弹从屏幕外射入 + 中心爆炸
  // ================================================================
  static _missileBarrage(ctx, p, w, h, time) {
    // 暖色全屏闪光
    const intensity = Math.sin(p * Math.PI);
    ctx.fillStyle = `rgba(255,140,60,${intensity * 0.3})`;
    ctx.fillRect(0, 0, w, h);

    // 5 枚导弹从屏幕外飞入中心
    if (p < 0.7) {
      const count = 5;
      const centerX = w / 2;
      const centerY = h / 2;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2;
        const startX = centerX + Math.cos(angle) * w * 1.2;
        const startY = centerY + Math.sin(angle) * h * 1.2;
        const flyP = p / 0.7;
        const x = startX + (centerX - startX) * flyP;
        const y = startY + (centerY - startY) * flyP;
        // 拖尾
        const tailLen = 30;
        const tailX = x - Math.cos(angle) * tailLen;
        const tailY = y - Math.sin(angle) * tailLen;
        const tailGrd = ctx.createLinearGradient(x, y, tailX, tailY);
        tailGrd.addColorStop(0, `rgba(255,200,80,${0.9})`);
        tailGrd.addColorStop(1, 'rgba(255,100,40,0)');
        ctx.strokeStyle = tailGrd;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        // 弹头
        ctx.fillStyle = '#ff8855';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 中心爆炸（p > 0.5）
    if (p > 0.5) {
      const expP = (p - 0.5) / 0.5;
      const expR = 80 * expP;
      const expGrd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, expR);
      expGrd.addColorStop(0, `rgba(255,255,200,${(1 - expP) * 0.9})`);
      expGrd.addColorStop(0.4, `rgba(255,180,60,${(1 - expP) * 0.7})`);
      expGrd.addColorStop(1, 'rgba(255,60,30,0)');
      ctx.fillStyle = expGrd;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, expR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ================================================================
  // 4) 护盾发生器 - 美队护盾：全屏绿色护盾波纹
  // ================================================================
  static _shieldWall(ctx, p, w, h, time) {
    // 绿色全屏底光
    const intensity = Math.sin(p * Math.PI);
    ctx.fillStyle = `rgba(120,220,120,${intensity * 0.15})`;
    ctx.fillRect(0, 0, w, h);

    // 三道同心圆波纹（从中心向外）
    for (let k = 0; k < 3; k++) {
      const offset = k * 0.15;
      const ringP = Math.max(0, p - offset) / (1 - offset);
      if (ringP <= 0 || ringP >= 1) continue;
      const ringR = Math.hypot(w, h) * 0.6 * ringP;
      const ringAlpha = (1 - ringP) * 0.6;
      ctx.strokeStyle = `rgba(120,255,140,${ringAlpha})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();
      // 内层亮线
      ctx.strokeStyle = `rgba(220,255,200,${ringAlpha * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ================================================================
  // 5) 能量采集器 - 能量灌注：金色能量从顶部倾泻而下
  // ================================================================
  static _energyRain(ctx, p, w, h, time) {
    // 顶部到底部的暖金渐变
    const intensity = Math.sin(p * Math.PI);
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, `rgba(255,210,80,${intensity * 0.5})`);
    grd.addColorStop(0.5, `rgba(255,180,60,${intensity * 0.3})`);
    grd.addColorStop(1, `rgba(255,150,40,0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // 30 颗能量珠从顶部下落
    if (p < 0.9) {
      const dropP = p / 0.9;
      for (let i = 0; i < 30; i++) {
        const seed = i * 13.37;
        const x = (Math.sin(seed) * 0.5 + 0.5) * w;
        const delay = (Math.sin(seed * 1.3) * 0.5 + 0.5) * 0.3;
        const localP = Math.max(0, dropP - delay) / (1 - delay);
        if (localP <= 0) continue;
        const y = localP * h;
        const alpha = Math.sin(localP * Math.PI) * 0.8;
        const r = 3 + Math.sin(seed) * 1.5;
        // 外光晕
        const orbGrd = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        orbGrd.addColorStop(0, `rgba(255,230,150,${alpha})`);
        orbGrd.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = orbGrd;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
        // 核心亮点
        ctx.fillStyle = `rgba(255,255,220,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ================================================================
  // 6) 重力场 - 浩克碎地：屏幕中心向外碎裂 + 黄色震荡
  // ================================================================
  static _hulkSmash(ctx, p, w, h, time) {
    // 暖橙全屏闪（前 30% 强闪）
    const flashAlpha = p < 0.3 ? (p / 0.3) * 0.35 : 0;
    ctx.fillStyle = `rgba(255,160,60,${flashAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // 黄色震荡环（中心扩散）
    if (p < 0.8) {
      const ringP = p / 0.8;
      const ringR = Math.hypot(w, h) * 0.7 * ringP;
      const ringAlpha = (1 - ringP) * 0.7;
      // 外层厚环
      ctx.strokeStyle = `rgba(255,200,80,${ringAlpha})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();
      // 内层亮线
      ctx.strokeStyle = `rgba(255,255,200,${ringAlpha * 0.9})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 碎裂线（裂纹从中心放射）
    if (p > 0.2 && p < 0.7) {
      const crackP = (p - 0.2) / 0.5;
      const lines = 12;
      for (let i = 0; i < lines; i++) {
        const angle = (Math.PI * 2 / lines) * i;
        const len = 100 + (i % 3) * 60;
        const lx = w / 2 + Math.cos(angle) * len * crackP;
        const ly = h / 2 + Math.sin(angle) * len * crackP;
        ctx.strokeStyle = `rgba(255,230,120,${(1 - crackP) * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(lx, ly);
        ctx.stroke();
      }
    }
  }

  // ================================================================
  // 7) 冷冻塔 - 冰霜新星：全屏冰晶六角 + 蓝白闪
  // ================================================================
  static _iceNova(ctx, p, w, h, time) {
    // 蓝白底光
    const intensity = Math.sin(p * Math.PI);
    ctx.fillStyle = `rgba(180,230,255,${intensity * 0.3})`;
    ctx.fillRect(0, 0, w, h);

    // 冰晶六角从中心向外飞散
    if (p < 0.8) {
      const crystalP = p / 0.8;
      const count = 18;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const dist = Math.hypot(w, h) * 0.6 * crystalP;
        const x = w / 2 + Math.cos(angle) * dist;
        const y = h / 2 + Math.sin(angle) * dist;
        const size = 6 + crystalP * 4;
        const alpha = (1 - crystalP) * 0.9;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(crystalP * Math.PI * 2 + i);
        ctx.strokeStyle = `rgba(220,245,255,${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI * 2 / 6) * k;
          const px = Math.cos(a) * size;
          const py = Math.sin(a) * size;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        // 中心点
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    // 冰霜环扩散
    if (p > 0.1 && p < 0.7) {
      const ringP = (p - 0.1) / 0.6;
      const ringR = Math.hypot(w, h) * 0.5 * ringP;
      ctx.strokeStyle = `rgba(150,220,255,${(1 - ringP) * 0.5})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ================================================================
  // 8) 等离子炮 - 等离子风暴：紫红能量漩涡 + 辐射线
  // ================================================================
  static _plasmaRain(ctx, p, w, h, time) {
    // 紫红底光
    const intensity = Math.sin(p * Math.PI);
    ctx.fillStyle = `rgba(255,100,200,${intensity * 0.25})`;
    ctx.fillRect(0, 0, w, h);

    // 漩涡环（3 圈不同方向）
    for (let k = 0; k < 3; k++) {
      const dir = k % 2 === 0 ? 1 : -1;
      const ringP = (p + k * 0.1) % 1;
      const ringR = Math.hypot(w, h) * 0.5 * ringP;
      const ringAlpha = (1 - ringP) * 0.4;
      ctx.strokeStyle = `rgba(255,140,255,${ringAlpha})`;
      ctx.lineWidth = 4 + k;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 辐射线
    if (p > 0.1 && p < 0.9) {
      const lineP = (p - 0.1) / 0.8;
      const rays = 16;
      for (let i = 0; i < rays; i++) {
        const angle = (Math.PI * 2 / rays) * i + time * 2;
        const len = Math.hypot(w, h) * 0.5 * lineP;
        const sx = w / 2 + Math.cos(angle) * 20;
        const sy = h / 2 + Math.sin(angle) * 20;
        const ex = w / 2 + Math.cos(angle) * len;
        const ey = h / 2 + Math.sin(angle) * len;
        ctx.strokeStyle = `rgba(255,180,255,${(1 - lineP) * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }
  }

  // ================================================================
  // 9) 修复站 - 纳米修复：绿色治愈粒子从四周向中心汇聚
  // ================================================================
  static _nanoSwarm(ctx, p, w, h, time) {
    // 淡绿底光
    const intensity = Math.sin(p * Math.PI);
    ctx.fillStyle = `rgba(120,240,160,${intensity * 0.2})`;
    ctx.fillRect(0, 0, w, h);

    // 40 颗绿色粒子从四周向中心汇聚
    if (p < 0.85) {
      const moveP = p / 0.85;
      const easeP = easeInOut(moveP);
      const count = 40;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const startR = Math.hypot(w, h) * 0.7;
        const sx = w / 2 + Math.cos(angle) * startR;
        const sy = h / 2 + Math.sin(angle) * startR;
        const x = sx + (w / 2 - sx) * easeP;
        const y = sy + (h / 2 - sy) * easeP;
        const r = 3 + Math.sin(i * 1.7) * 1.2;
        const alpha = Math.sin(moveP * Math.PI) * 0.9;
        // 拖尾
        const tailLen = 15 * (1 - moveP);
        const tx = x - (x - w / 2) * 0.05 - Math.cos(angle) * tailLen;
        const ty = y - (y - h / 2) * 0.05 - Math.sin(angle) * tailLen;
        const tailGrd = ctx.createLinearGradient(x, y, tx, ty);
        tailGrd.addColorStop(0, `rgba(150,255,180,${alpha})`);
        tailGrd.addColorStop(1, 'rgba(100,200,140,0)');
        ctx.strokeStyle = tailGrd;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        // 核心
        ctx.fillStyle = `rgba(200,255,210,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 中心治愈光球（progress 0.5 后）
    if (p > 0.5) {
      const coreP = (p - 0.5) / 0.5;
      const coreR = 30 + coreP * 60;
      const coreGrd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, coreR);
      coreGrd.addColorStop(0, `rgba(220,255,220,${(1 - coreP) * 0.9})`);
      coreGrd.addColorStop(0.5, `rgba(150,255,180,${(1 - coreP) * 0.6})`);
      coreGrd.addColorStop(1, 'rgba(100,200,140,0)');
      ctx.fillStyle = coreGrd;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, coreR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
