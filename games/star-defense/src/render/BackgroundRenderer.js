// ================================================================
// BackgroundRenderer - 主菜单背景画布：多层视差星空 + 星云 + 行星
// ================================================================

/**
 * 视差背景渲染器
 * - 3 层星星（远/中/近），不同大小 + 不同漂移速度
 * - 2 朵星云（径向渐变 + 缓慢漂移）
 * - 1 颗行星剪影（右下角，缓慢自转）
 * - 偶尔划过的流星
 *
 * 性能策略：仅在 overlay 可见时渲染（requestAnimationFrame 按需启停）
 */
export class BackgroundRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    this.running = false;
    this.time = 0;
    this.lastFrame = 0;
    this._raf = null;

    // 视差星层
    this.starLayers = [];
    // 星云云团
    this.nebulae = [];
    // 行星
    this.planet = null;
    // 流星
    this.shootingStars = [];
    this._nextShooting = 0;

    this._resize();
    this._init();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.W = rect.width;
    this.H = rect.height;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _init() {
    // 3 层星星
    const layerConfigs = [
      // 远层：密集小点
      { count: 140, sizeMin: 0.4, sizeMax: 1.1, drift: 0.02, alpha: 0.5, color: '#ffd9c8' },
      // 中层：中等
      { count: 90,  sizeMin: 0.8, sizeMax: 1.8, drift: 0.06, alpha: 0.8, color: '#fff0e0' },
      // 近层：稀疏亮点 + 偶尔闪烁
      { count: 35,  sizeMin: 1.5, sizeMax: 2.6, drift: 0.18, alpha: 1.0, color: '#fff5e6' }
    ];

    for (const cfg of layerConfigs) {
      const stars = [];
      for (let i = 0; i < cfg.count; i++) {
        stars.push({
          x: Math.random() * this.W,
          y: Math.random() * this.H,
          r: cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin),
          baseAlpha: cfg.alpha * (0.5 + Math.random() * 0.5),
          twinkleSpeed: 0.5 + Math.random() * 1.5,
          twinklePhase: Math.random() * Math.PI * 2,
          color: cfg.color
        });
      }
      this.starLayers.push({ stars, drift: cfg.drift, alpha: cfg.alpha });
    }

    // 星云云团（暖色 + 紫色，呼应游戏主题）
    this.nebulae = [
      {
        x: this.W * 0.25, y: this.H * 0.30,
        rx: this.W * 0.45, ry: this.H * 0.35,
        color: 'rgba(255, 130, 90, 0.10)',
        inner: 'rgba(255, 170, 100, 0.18)',
        vx: 0.015, vy: 0.008, phase: 0
      },
      {
        x: this.W * 0.78, y: this.H * 0.65,
        rx: this.W * 0.40, ry: this.H * 0.30,
        color: 'rgba(200, 100, 160, 0.08)',
        inner: 'rgba(220, 130, 180, 0.14)',
        vx: -0.012, vy: 0.010, phase: Math.PI
      },
      {
        x: this.W * 0.55, y: this.H * 0.85,
        rx: this.W * 0.50, ry: this.H * 0.20,
        color: 'rgba(255, 180, 120, 0.06)',
        inner: 'rgba(255, 200, 140, 0.10)',
        vx: 0.008, vy: -0.006, phase: Math.PI / 2
      }
    ];

    // 行星剪影：右下角
    const planetR = Math.max(80, Math.min(this.W, this.H) * 0.18);
    this.planet = {
      x: this.W + planetR * 0.4,
      y: this.H + planetR * 0.6,
      r: planetR,
      rotation: 0,
      // 大气层颜色（暖橙）
      atmColor: 'rgba(255, 140, 80, 0.18)',
      // 表面色（深紫红）
      surfaceColor1: '#3a1828',
      surfaceColor2: '#5a2030',
      // 高光色
      highlight: 'rgba(255, 180, 120, 0.35)'
    };

    // 初始时刻让流星稍后出现
    this._nextShooting = 2 + Math.random() * 3;
  }

  _spawnShootingStar() {
    const fromTop = Math.random() < 0.5;
    this.shootingStars.push({
      x: fromTop ? Math.random() * this.W * 0.5 : -20,
      y: fromTop ? -10 : Math.random() * this.H * 0.4,
      vx: 6 + Math.random() * 4,
      vy: 3 + Math.random() * 2,
      life: 0,
      maxLife: 1.2 + Math.random() * 0.6,
      len: 60 + Math.random() * 50
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this._loop();
  }

  stop() {
    this.running = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  _loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;
    this._update(dt);
    this._render();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _update(dt) {
    // 星星漂移（向右慢飘 + 越界回到左边）
    for (const layer of this.starLayers) {
      for (const s of layer.stars) {
        s.x += layer.drift * dt * 60;
        if (s.x > this.W + 4) {
          s.x = -4;
          s.y = Math.random() * this.H;
        }
      }
    }

    // 星云漂移
    for (const n of this.nebulae) {
      n.x += n.vx * dt * 60;
      n.y += n.vy * dt * 60;
      n.phase += dt * 0.3;
      // 简单环绕：超出范围就回弹
      if (n.x < -n.rx || n.x > this.W + n.rx) n.vx *= -1;
      if (n.y < -n.ry || n.y > this.H + n.ry) n.vy *= -1;
    }

    // 行星自转
    this.planet.rotation += dt * 0.05;

    // 流星
    this._nextShooting -= dt;
    if (this._nextShooting <= 0) {
      this._spawnShootingStar();
      this._nextShooting = 4 + Math.random() * 6;
    }
    for (const ss of this.shootingStars) {
      ss.x += ss.vx * dt * 60;
      ss.y += ss.vy * dt * 60;
      ss.life += dt;
    }
    this.shootingStars = this.shootingStars.filter(
      ss => ss.life < ss.maxLife && ss.x < this.W + 80 && ss.y < this.H + 80
    );
  }

  _render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // 底色（深空紫红渐变）
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a0a18');
    grad.addColorStop(0.5, '#2a1020');
    grad.addColorStop(1, '#0f0612');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 星云（径向渐变 + 中心稍亮）
    for (const n of this.nebulae) {
      const pulse = 0.85 + 0.15 * Math.sin(n.phase);
      // 外层光晕
      const g1 = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, Math.max(n.rx, n.ry));
      g1.addColorStop(0, n.inner);
      g1.addColorStop(0.5, n.color);
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.ellipse(n.x, n.y, n.rx, n.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 行星剪影
    this._drawPlanet(this.planet);

    // 流星（在星层之上）
    this._drawShootingStars();

    // 星星（3 层）
    for (const layer of this.starLayers) {
      for (const s of layer.stars) {
        const tw = 0.6 + 0.4 * Math.sin(this.time * s.twinkleSpeed + s.twinklePhase);
        const a = s.baseAlpha * tw;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        // 亮点加十字光芒
        if (s.r > 1.8) {
          ctx.globalAlpha = a * 0.4;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 2.5, s.y);
          ctx.lineTo(s.x + s.r * 2.5, s.y);
          ctx.moveTo(s.x, s.y - s.r * 2.5);
          ctx.lineTo(s.x, s.y + s.r * 2.5);
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawPlanet(p) {
    const ctx = this.ctx;
    ctx.save();

    // 大气光晕
    const atmR = p.r * 1.4;
    const atm = ctx.createRadialGradient(p.x, p.y, p.r * 0.9, p.x, p.y, atmR);
    atm.addColorStop(0, p.atmColor);
    atm.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = atm;
    ctx.beginPath();
    ctx.arc(p.x, p.y, atmR, 0, Math.PI * 2);
    ctx.fill();

    // 行星主体（双色径向渐变）
    const body = ctx.createRadialGradient(
      p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.1,
      p.x, p.y, p.r
    );
    body.addColorStop(0, p.surfaceColor2);
    body.addColorStop(1, p.surfaceColor1);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    // 行星表面环带（模拟自转的纹理）
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    for (let i = 0; i < 4; i++) {
      const yy = -p.r + (i + 0.5) * (p.r * 2 / 4);
      const w = p.r * Math.cos(Math.asin(yy / p.r)) * 1.2;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.18 + i * 0.04})`;
      ctx.fillRect(-w, yy, w * 2, p.r * 0.18);
    }
    // 一个小陨石坑作点缀
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(p.r * 0.2, -p.r * 0.3, p.r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 高光弧（右上）
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.clip();
    const hl = ctx.createLinearGradient(
      p.x - p.r, p.y - p.r, p.x + p.r * 0.3, p.y + p.r * 0.3
    );
    hl.addColorStop(0, p.highlight);
    hl.addColorStop(0.5, 'rgba(255,180,120,0)');
    hl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    ctx.restore();

    // 行星边缘光
    ctx.strokeStyle = 'rgba(255, 150, 100, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  _drawShootingStars() {
    const ctx = this.ctx;
    for (const ss of this.shootingStars) {
      const t = ss.life / ss.maxLife;
      const alpha = 1 - t;
      // 拖尾
      const tx = ss.x - ss.vx * ss.len / 8;
      const ty = ss.y - ss.vy * ss.len / 8;
      const grad = ctx.createLinearGradient(ss.x, ss.y, tx, ty);
      grad.addColorStop(0, `rgba(255, 240, 220, ${alpha})`);
      grad.addColorStop(1, 'rgba(255, 240, 220, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // 头部亮点
      ctx.fillStyle = `rgba(255, 250, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
