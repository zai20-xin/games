'use strict';
/* ============ 粒子特效系统（升级版：拖尾/星芒/碎片/尘土/硝烟/火星/火球/马影冲锋） ============ */
const FX = (function () {
  let canvas = null, ctx = null;
  let W = 0, H = 0, dpr = 1;
  let parts = [], rings = [], rects = [], flashes = [], ghosts = [];
  let rafId = 0, running = false, lastT = 0;

  function init(el) {
    canvas = el;
    ctx = el.getContext('2d');
    resize();
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loop(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    ctx.clearRect(0, 0, W, H);
    drawGhosts(dt);
    drawFlashes(dt);
    drawRings(dt);
    drawParts(dt);
    drawRects(dt);
    rafId = requestAnimationFrame(loop);
  }

  // ---------- 全屏闪光 ----------
  function flashCanvas(alpha = 0.8) {
    flashes.push({ life: 1, max: alpha });
  }
  function drawFlashes(dt) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= dt * 3;
      if (f.life <= 0) { flashes.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, f.life) * f.max;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 马影冲锋（万马奔腾） ----------
  // x0,y0 -> x1,y1 之间一列马影依次冲过
  function ghostRun(x0, y0, x1, y1, text, color, count = 6) {
    for (let i = 0; i < count; i++) {
      ghosts.push({
        x0, y0, x1, y1, text, color,
        delay: i * 0.09,          // 依次延迟出发
        t: 0, dur: 0.9,
        alpha: 0.4 + Math.random() * 0.25,
        size: 26 + Math.random() * 8,
      });
    }
  }

  function drawGhosts(dt) {
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i];
      g.t += dt;
      const local = g.t - g.delay;
      if (local < 0) continue;
      if (local > g.dur) { ghosts.splice(i, 1); continue; }
      const p = local / g.dur;                    // 0->1
      const a = Math.sin(Math.PI * p) * g.alpha;  // 出现->渐隐
      if (a <= 0.02) continue;
      const x = g.x0 + (g.x1 - g.x0) * p;
      const y = g.y0 + (g.y1 - g.y0) * p;
      const sz = g.size * (1 - p * 0.45);          // 越冲越远越小
      ctx.globalAlpha = a;
      ctx.fillStyle = g.color;
      ctx.font = '900 ' + sz.toFixed(0) + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 爆发粒子（带拖尾 & 星形） ----------
  function burst(x, y, opts = {}) {
    const {
      count = 24, colors = ['#ffd23f', '#ff7847', '#ffb347', '#ffffff'],
      speed = 6, gravity = 0.12, size = 6, trail = true,
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.9);
      const isStar = Math.random() < 0.18;
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 2.2,
        g: gravity,
        size: size * (0.6 + Math.random() * 0.9),
        color: colors[i % colors.length],
        life: 1,
        decay: 0.01 + Math.random() * 0.02,
        shape: isStar ? 'star' : (Math.random() < 0.4 ? 'rect' : 'circle'),
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        trail: trail,
        tx: x, ty: y,
      });
    }
  }

  // ---------- 尘土（慢速上扬，扩散） ----------
  function dust(x, y, opts = {}) {
    const { count = 16, colors = ['#c9a86a', '#b3935c', '#a0814d', '#d9bd82'], speed = 2.5, size = 9 } = opts;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;  // 主要向上散开
      const v = speed * (0.5 + Math.random());
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 0.6,
        g: -0.015,                 // 轻微上浮
        size: size * (0.7 + Math.random() * 0.7),
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        shape: 'smoke',
        trail: false, tx: x, ty: y,
      });
    }
  }

  // ---------- 硝烟（浓烟上涌，用于爆炸） ----------
  function smoke(x, y, opts = {}) {
    const { count = 12, colors = ['#55565a', '#6b6c70', '#3f4043', '#7e7f84'], speed = 3.2, size = 18 } = opts;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const v = speed * (0.5 + Math.random() * 1.1);
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 1,
        g: -0.05,                  // 明显上浮
        size: size * (0.6 + Math.random() * 1.2),
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.012 + Math.random() * 0.015,
        shape: 'smoke',
        trail: false, tx: x, ty: y,
      });
    }
  }

  // ---------- 火星（小亮粒子快速飞溅带拖尾） ----------
  function spark(x, y, opts = {}) {
    const { count = 20, colors = ['#ffe29a', '#ffd23f', '#fff3c4', '#ffb347'], speed = 8, size = 4 } = opts;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.6 + Math.random() * 0.9);
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        g: 0.22,                   // 重力下落
        size: size * (0.6 + Math.random() * 0.8),
        color: colors[i % colors.length],
        life: 1,
        decay: 0.025 + Math.random() * 0.03,
        shape: 'spark',
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.5,
        trail: true, tx: x, ty: y,
      });
    }
  }

  // ---------- 火球（爆炸中心的火焰团） ----------
  function fireball(x, y, r = 26) {
    // 用多层同心圆实现火球，形状为 'fire'
    for (let i = 0; i < 3; i++) {
      parts.push({
        x, y, vx: 0, vy: 0, g: 0,
        size: r * (1.3 - i * 0.28),
        color: ['#ff5e2a', '#ff9a1f', '#ffe36e'][i],
        life: 1, decay: 0.02 + i * 0.008,
        shape: 'fire', trail: false, tx: x, ty: y,
      });
    }
  }

  function drawParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.trail) {
        ctx.globalAlpha = Math.max(0, p.life) * 0.35;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size / 3);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.tx, p.ty);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      p.vy += p.g * 60 * dt;
      p.tx = p.x; p.ty = p.y;
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      p.rot += p.vr;
      p.life -= p.decay;
      if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
      const alpha = Math.max(0, p.life);

      if (p.shape === 'smoke') {
        // 软烟：径向渐变
        ctx.globalAlpha = alpha * 0.4;
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grd.addColorStop(0, p.color);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'fire') {
        // 火球：中心亮，外圈暗
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#fff6c8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.9, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        drawStar(p.x, p.y, p.size * 0.9);
      } else if (p.shape === 'rect') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStar(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const rr = i % 2 === 0 ? r : r * 0.35;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- 冲击波（多层） ----------
  function ring(x, y, color = '#ffffff', max = 60, lineW = 3, count = 1) {
    for (let i = 0; i < count; i++) {
      rings.push({ x, y, r: 6, max: max * (1 + i * 0.3), color, life: 1, lineW });
    }
  }
  function drawRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const rg = rings[i];
      rg.r += (rg.max - rg.r) * 0.2 + 1.4;
      rg.life -= dt * 3.2;
      if (rg.life <= 0) { rings.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, rg.life);
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = rg.lineW * rg.life + 0.5;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 被吃棋子的碎片 ----------
  function shards(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 4 + Math.random() * 7;
      const sz = 4 + Math.random() * 7;
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 3,
        g: 0.16,
        size: sz,
        color,
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        shape: 'rect',
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.6,
        trail: false, tx: x, ty: y,
      });
    }
  }

  // ---------- 胜利彩带 ----------
  function confetti() {
    const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f45', '#fff'];
    for (let i = 0; i < 130; i++) {
      rects.push({
        x: Math.random() * W,
        y: -12 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 2.6,
        vy: 1.6 + Math.random() * 3.2,
        g: 0.06,
        size: 5 + Math.random() * 8,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.5,
        life: 1,
        decay: 0.002 + Math.random() * 0.0025,
      });
    }
  }

  function drawRects(dt) {
    for (let i = rects.length - 1; i >= 0; i--) {
      const p = rects[i];
      p.vy += p.g * 60 * dt;
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      p.rot += p.vr;
      p.life -= p.decay;
      if (p.life <= 0 || p.y > H + 30) { rects.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // 文字泡泡（DOM，挂在 promo-layer 上）
  function pop(x, y, text, cls = '') {
    const layer = document.getElementById('promo-layer');
    if (!layer) return;
    const d = document.createElement('div');
    d.className = 'pop ' + cls;
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    layer.appendChild(d);
    d.addEventListener('animationend', () => d.remove());
  }

  function clear() { parts = []; rings = []; rects = []; flashes = []; ghosts = []; }

  return { init, resize, burst, ring, pop, confetti, clear, shards, flashCanvas, dust, smoke, spark, fireball, ghostRun };
})();
