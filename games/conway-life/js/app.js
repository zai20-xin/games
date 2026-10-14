(function () {
  'use strict';

  var E = LifeEngine;
  var $ = function (id) { return document.getElementById(id); };

  var stage = $('stage'), board = $('board');
  var ctx = board.getContext('2d', { alpha: false });
  var small = document.createElement('canvas');
  var smallCtx = small.getContext('2d');
  var imgData = null;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var filterOK = typeof ctx.filter === 'string';

  var S = {
    cols: 0, rows: 0,
    cur: null, next: null, age: null, alpha: null,
    gen: 0, live: 0, peak: 0,
    running: true, speed: 12, wrap: true,
    // 默认视角拉到宇宙尺度：格子小 → 网格大（同屏几万个细胞）。
    // 小网格几代就冻成静物/振荡，整屏一重复就弹「进入循环」；大网格要演化几千代才可能安定，
    // 更接近「微小扰动在时间长河里一直演化」的真实感。cell<8 时网格线自动隐藏，干净如星空。
    cell: 5,
    gridOn: true, glow: !reduceMotion && filterOK,
    theme: 'starfield', placing: null, hover: null,
    keys: [], calloutKind: null,
    w: 0, h: 0, dpr: 1,
    autoSeed: true, lowRun: 0,
    reseedChecked: -1, lastReseedGen: 0,
    found: {}, counts: {}, lastIdentGen: -1, lastIdentAt: 0, lastPopGen: -1,
    freezeId: null, freezeUntil: 0,
    popHist: [], particles: [], meteors: [], rings: [],
    crystal: null, pinned: {}, crystalMark: [], nextCrystalIn: 12, lastSurpriseId: null,
    // v5.0 许愿仪式
    ritual: false, ritualPhase: '', ritualT: 0, ritualEvolveDur: 10, ritualTarget: null,
    ritualWish: '', ritualBday: '', ritualRng: null, ritualSeed: 0, ritualFortune: '',
    ritualLetter: '', ritualHold: false, ritualEnergy: 0,
    wishTheme: null,   // v5.0.2 心愿主题（贯穿整局：惊喜池加权 + 卡面色系）
    best: { gen: 0, live: 0 }
  };

  var COL = { a: [94, 243, 200], b: [168, 85, 247], glow: [55, 230, 176] };
  var BG = '#05070c', GRID = 'rgba(255,255,255,.05)';

  /* ---------------- 主题 ---------------- */
  function hexToRgb(s) {
    s = (s || '').trim().replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var v = parseInt(s, 16);
    if (isNaN(v)) return [128, 128, 128];
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    COL.a = hexToRgb(cs.getPropertyValue('--cell-a'));
    COL.b = hexToRgb(cs.getPropertyValue('--cell-b'));
    COL.glow = hexToRgb(cs.getPropertyValue('--glow'));
    BG = cs.getPropertyValue('--bg').trim() || '#05070c';
    GRID = cs.getPropertyValue('--grid').trim() || 'rgba(255,255,255,.05)';
    ctx.fillStyle = BG;
  }
  function applyTheme(t) {
    S.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    readTheme();
    if (dexReady) buildDex();
    try { localStorage.setItem('life.theme', t); } catch (e) {}
  }

  /* ---------------- 网格布局 ---------------- */
  function alloc() {
    S.cur = E.createGrid(S.cols, S.rows);
    S.next = E.createGrid(S.cols, S.rows);
    S.age = new Uint8Array(S.cols * S.rows);
    S.alpha = new Float32Array(S.cols * S.rows);
    imgData = null;
  }

  function layout(preserve) {
    var W = Math.max(1, stage.clientWidth), H = Math.max(1, stage.clientHeight);
    var ncols = Math.max(12, Math.floor(W / S.cell));
    var nrows = Math.max(12, Math.floor(H / S.cell));

    if (!preserve || !S.cur) {
      S.cols = ncols; S.rows = nrows; alloc();
      return;
    }
    var oc = S.cols, or_ = S.rows, ocur = S.cur, oage = S.age, oalpha = S.alpha;
    S.cols = ncols; S.rows = nrows;
    var nc = E.createGrid(S.cols, S.rows), na = new Uint8Array(S.cols * S.rows), nal = new Float32Array(S.cols * S.rows);
    var dx = Math.floor((S.cols - oc) / 2), dy = Math.floor((S.rows - or_) / 2);
    for (var y = 0; y < or_; y++) {
      var ny = y + dy;
      if (ny < 0 || ny >= S.rows) continue;
      for (var x = 0; x < oc; x++) {
        var nx = x + dx;
        if (nx < 0 || nx >= S.cols) continue;
        nc[ny * S.cols + nx] = ocur[y * oc + x];
        na[ny * S.cols + nx] = oage[y * oc + x];
        nal[ny * S.cols + nx] = oalpha[y * oc + x];
      }
    }
    S.cur = nc; S.next = E.createGrid(S.cols, S.rows); S.age = na; S.alpha = nal;
    imgData = null;
    S.live = E.countLive(S.cur);
  }

  function resize() {
    S.dpr = Math.min(window.devicePixelRatio || 1, 2);
    S.w = stage.clientWidth; S.h = stage.clientHeight;
    board.width = Math.round(S.w * S.dpr);
    board.height = Math.round(S.h * S.dpr);
    layout(true);
  }

  /* ---------------- 仿真 ---------------- */
  function doStep() {
    var live = E.step(S.cur, S.next, S.cols, S.rows, S.wrap);
    for (var i = 0; i < S.next.length; i++) {
      if (S.next[i]) S.age[i] = S.cur[i] ? Math.min(255, S.age[i] + 1) : 1;
    }
    var t = S.cur; S.cur = S.next; S.next = t;
    S.gen++; S.live = live;
    reassertPinned();
    if (live > S.peak) S.peak = live;
    trackStructure();
  }

  function trackStructure() {
    var key = E.gridKey(S.cur);
    var r = E.detectCycle(S.keys, key);
    S.keys.unshift(key);
    if (S.keys.length > 14) S.keys.pop();
    if (!r.kind) { S.calloutKind = null; return; }
    S.calloutKind = r.kind;
    // 整屏进入循环/静止 → 直接投流星炸开重燃：不播报「停下来了」、不冷却停顿，
    // 让宇宙无缝继续演化，绝不给用户「停住了」的感觉。
    if (!S.autoSeed) return;
    if (S.meteors.length) return;   // 已有流星在飞，等它落地注入新生命后再判断
    spawnMeteorShower();
  }

  function clearGrid() {
    S.cur.fill(0); S.age.fill(0); S.alpha.fill(0);
    S.gen = 0; S.live = 0; S.peak = 0; S.keys.length = 0; S.calloutKind = null;
    S.counts = {}; S.popHist.length = 0;
    S.meteors.length = 0;
    S.crystal = null; S.pinned = {}; S.crystalMark = [];
  }

  function randomize(density, rng) {
    clearGrid();
    S.live = E.randomFill(S.cur, S.cols, S.rows, density, rng);
    S.peak = S.live;
    // alpha 从 0 开始 → 由主循环淡入，避免"啪"地整片跳出
    for (var i = 0; i < S.cur.length; i++) S.alpha[i] = 0;
  }

  /* ---------------- 渲染 ---------------- */
  var lastFrame = performance.now(), fpsAcc = 0, fpsN = 0, fpsShown = 60;
  var acc = 0, lowFpsFrames = 0;

  function buildImage() {
    if (!imgData || imgData.width !== S.cols || imgData.height !== S.rows) {
      small.width = S.cols; small.height = S.rows;
      imgData = smallCtx.createImageData(S.cols, S.rows);
    }
    var d = imgData.data, A = COL.a, B = COL.b;
    for (var i = 0, p = 0; i < S.alpha.length; i++, p += 4) {
      var al = S.alpha[i];
      if (al <= 0.02) { d[p + 3] = 0; continue; }
      var t = S.age[i] / 48; if (t > 1) t = 1;
      d[p] = A[0] + (B[0] - A[0]) * t;
      d[p + 1] = A[1] + (B[1] - A[1]) * t;
      d[p + 2] = A[2] + (B[2] - A[2]) * t;
      d[p + 3] = al * 255;
    }
    smallCtx.putImageData(imgData, 0, 0);
  }

  // 星尘粒子层：星野主题专属背景（缓慢上浮 + 闪烁），reduced-motion 下不画
  var stardust = null, stardustW = 0, stardustH = 0;
  function ensureStardust() {
    if (stardust && stardustW === S.w && stardustH === S.h) return;
    stardustW = S.w; stardustH = S.h;
    var n = Math.min(140, Math.round(S.w * S.h / 9000));
    stardust = [];
    for (var i = 0; i < n; i++) {
      stardust.push({ x: Math.random() * S.w, y: Math.random() * S.h,
        r: 0.4 + Math.random() * 1.3, ph: Math.random() * 6.283,
        sp: 0.4 + Math.random() * 0.9, vy: 2 + Math.random() * 5 });
    }
  }
  function drawStardust(t) {
    ensureStardust();
    for (var i = 0; i < stardust.length; i++) {
      var st = stardust[i];
      var y = (st.y - t * st.vy) % (S.h + 20); if (y < 0) y += S.h + 20;
      var a = 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 3 === 0 ? '#e8a0bf' : '#ffffff';
      ctx.beginPath(); ctx.arc(st.x, y - 10, st.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    var cell = S.cell, bw = S.cols * cell, bh = S.rows * cell;
    var ox = Math.round((S.w - bw) / 2), oy = Math.round((S.h - bh) / 2);

    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, S.w, S.h);
    if (S.theme === 'starfield' && !reduceMotion) drawStardust(performance.now() / 1000);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.imageSmoothingEnabled = false;

    if (S.glow && filterOK) {
      ctx.save();
      ctx.filter = 'blur(' + Math.max(3, cell * 0.85) + 'px)';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(small, 0, 0, bw, bh);
      ctx.restore();
    }

    if (S.gridOn && cell >= 8) {
      ctx.save();
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= S.cols; x++) { ctx.moveTo(x * cell + .5, 0); ctx.lineTo(x * cell + .5, bh); }
      for (var y = 0; y <= S.rows; y++) { ctx.moveTo(0, y * cell + .5); ctx.lineTo(bw, y * cell + .5); }
      ctx.stroke();
      ctx.restore();
    }

    ctx.drawImage(small, 0, 0, bw, bh);

    if (S.placing && S.hover) {
      var p = S.placing.parsed, hx = S.hover.x, hy = S.hover.y;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'rgb(' + COL.a[0] + ',' + COL.a[1] + ',' + COL.a[2] + ')';
      for (var i = 0; i < p.cells.length; i++) {
        ctx.fillRect((hx + p.cells[i][0]) * cell, (hy + p.cells[i][1]) * cell, cell, cell);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    drawParticles();
  }

  /* ---------------- 完成庆祝粒子 ---------------- */
  function burst() {
    if (reduceMotion) return;
    for (var i = 0; i < 90; i++) {
      var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 260;
      S.particles.push({ x: S.w / 2, y: S.h / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
  }

  /* ---------------- 凝形光爆（v5.4：截图欲来自这一帧，不来自方块本身） ---------------- */
  // 粒子从符号中心炸开（主题色）+ 双重扩散光环 + 全屏闪光。reduceMotion 降级为无动画。
  function crystalBurst(cx, cy) {
    if (reduceMotion) return;
    var col = cardColors();
    for (var i = 0; i < 110; i++) {
      var a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 340;
      S.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1,
        col: Math.random() < 0.5 ? col.c1 : col.c2, noGrav: true });
    }
    S.rings.push({ x: cx, y: cy, t: 0, col: col.c1 });
    S.rings.push({ x: cx, y: cy, t: -0.12, col: col.c2 });
    var fl = $('flash');
    if (fl) {
      fl.style.background = 'radial-gradient(circle at ' + (cx / S.w * 100).toFixed(1) + '% ' +
        (cy / S.h * 100).toFixed(1) + '%, ' + col.c1 + 'b3, transparent 62%)';
      fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    }
    if (navigator.vibrate) navigator.vibrate([18, 40, 18]);
  }
  // 格坐标 → 屏幕坐标（与 render 的居中偏移一致）
  function cellToScreen(gx, gy) {
    var bw = S.cols * S.cell, bh = S.rows * S.cell;
    return { x: Math.round((S.w - bw) / 2) + (gx + 0.5) * S.cell, y: Math.round((S.h - bh) / 2) + (gy + 0.5) * S.cell };
  }

  function stepParticles(dt) {
    for (var i = S.particles.length - 1; i >= 0; i--) {
      var p = S.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.meteor && !p.noGrav) p.vy += 220 * dt;   // 流星碎片/光爆粒子不加下坠重力，像火花四散
      p.vx *= 0.985; p.vy *= 0.985;
      p.life -= dt * 1.4;
      if (p.life <= 0) S.particles.splice(i, 1);
    }
    for (var j = S.rings.length - 1; j >= 0; j--) {
      S.rings[j].t += dt;
      if (S.rings[j].t > 0.7) S.rings.splice(j, 1);
    }
  }
  function drawParticles() {
    if (!S.particles.length && !S.rings.length) return;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgb(' + COL.a[0] + ',' + COL.a[1] + ',' + COL.a[2] + ')';
    for (var i = 0; i < S.particles.length; i++) {
      var p = S.particles[i];
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      if (p.col) ctx.fillStyle = p.col; else ctx.fillStyle = 'rgb(' + COL.a[0] + ',' + COL.a[1] + ',' + COL.a[2] + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + 3 * p.life, 0, 6.2832);
      ctx.fill();
    }
    // 扩散光环：半径加速外扩、透明度衰减
    for (var k = 0; k < S.rings.length; k++) {
      var r = S.rings[k];
      if (r.t <= 0) continue;
      var rad = 10 + r.t * r.t * 900;
      ctx.globalAlpha = Math.max(0, 1 - r.t / 0.7) * 0.8;
      ctx.strokeStyle = r.col;
      ctx.lineWidth = 3 * (1 - r.t / 0.7) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, 6.2832);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- 流星激活（整屏进入循环/静止时投放） ---------------- */
  // 设计：检测到整屏安定（周期/静止）→ 从画布外抛出 2~3 颗流星划过星空，
  // 落点随机 → 撞击瞬间炸开一小簇生命并重置结构识别，让宇宙重新演化。
  function spawnMeteorShower() {
    if (reduceMotion) { meteorImpact(null); return; }   // 降级：直接投放，不画飞行
    var n = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (var i = 0; i < n; i++) {
      var edge = Math.floor(Math.random() * 3);         // 0 上 / 1 左 / 2 右
      var sx, sy;
      var gx = Math.floor(Math.random() * S.cols), gy = Math.floor(Math.random() * S.rows);
      var cell = S.cell, bw = S.cols * cell, bh = S.rows * cell;
      var ox = Math.round((S.w - bw) / 2), oy = Math.round((S.h - bh) / 2);
      var tx = ox + (gx + 0.5) * cell, ty = oy + (gy + 0.5) * cell;   // 落点（屏幕坐标）
      if (edge === 0) { sx = tx + (Math.random() - 0.5) * S.w * 0.5; sy = -30; }
      else if (edge === 1) { sx = -30; sy = ty - S.h * (0.3 + Math.random() * 0.5); }
      else { sx = S.w + 30; sy = ty - S.h * (0.3 + Math.random() * 0.5); }
      var ang = Math.atan2(ty - sy, tx - sx);
      var sp = 220 + Math.random() * 160;               // px/s
      S.meteors.push({
        x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        tx: tx, ty: ty, gx: gx, gy: gy, life: 1, trail: []
      });
    }
  }

  // 直接在 (gx,gy) 附近炸开一小簇生命；m=null 时随机落点（降级路径）
  function meteorImpact(m) {
    var gx, gy;
    if (m) { gx = m.gx; gy = m.gy; }
    else { gx = Math.floor(Math.random() * S.cols); gy = Math.floor(Math.random() * S.rows); }
    var r = 1, n = 6 + Math.floor(Math.random() * 7);   // 6~12 个细胞，一小簇
    for (var i = 0; i < n; i++) {
      var x = gx + Math.round((Math.random() - 0.5) * 2 * r * 2);
      var y = gy + Math.round((Math.random() - 0.5) * 2 * r * 2);
      if (x < 0 || y < 0 || x >= S.cols || y >= S.rows) continue;
      var idx = y * S.cols + x;
      S.cur[idx] = 1; S.age[idx] = 0;
      if (S.alpha[idx] < 0.3) S.alpha[idx] = 0.3;       // 略带淡入，不“啪”地跳出
    }
    S.live = E.countLive(S.cur);
    S.keys.length = 0; S.calloutKind = null;            // 重置结构识别，让宇宙重新演化
    burstAt(m ? m.x : S.w / 2, m ? m.y : S.h / 2);
  }

  function stepMeteors(dt) {
    for (var i = S.meteors.length - 1; i >= 0; i--) {
      var m = S.meteors[i];
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.trail.push(m.x, m.y);
      if (m.trail.length > 18) m.trail.splice(0, 2);
      // 撞击判定：速度投影在目标处过零且随时间单调递增，
      // 离散步长会跳过「8px 窗口」，故只用 proj>0（已抵达/飞过落点）判定，稳健不漏判。
      var dx = m.x - m.tx, dy = m.y - m.ty;
      if (dx * m.vx + dy * m.vy > 0) {
        meteorImpact(m);
        S.meteors.splice(i, 1);
      }
    }
  }

  function drawMeteors() {
    if (!S.meteors.length) return;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var A = COL.a;
    for (var i = 0; i < S.meteors.length; i++) {
      var m = S.meteors[i], t = m.trail;
      // 拖尾
      for (var j = 2; j < t.length; j += 2) {
        var a = j / t.length;
        ctx.strokeStyle = 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + (a * 0.6) + ')';
        ctx.lineWidth = 1 + a * 2.2;
        ctx.beginPath();
        ctx.moveTo(t[j - 2], t[j - 1]);
        ctx.lineTo(t[j], t[j + 1]);
        ctx.stroke();
      }
      // 流星头
      ctx.fillStyle = 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',1)';
      ctx.beginPath(); ctx.arc(m.x, m.y, 2.6, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(m.x, m.y, 1.2, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  // 撞击白闪 + 粒子（复用庆祝粒子系统，但不加下坠重力）
  function burstAt(x, y) {
    if (reduceMotion) return;
    for (var i = 0; i < 18; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 130;
      S.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, meteor: true });
    }
  }

  /* ----------------混沌凝形（随机里凝出可辨识符号 → 首次发现定格庆祝） ---------------- */
  // 惊喜来自「失控」：符号不是用户放的，而是从随机汤里自己凝出来的。
  // 纯随机长不出干净形状（Life 汤几代就塌成噪点/闪影），故用「引导凝形」：
  // 悄悄把目标形状的细胞分批钉进汤里，用户看到的是噪声逐渐锁定成形——魔术的手法。
  // 惊喜池 = 30 个符号按权重随机（情感符号权重高），连续两次不重复；
  // 首次凝出 → 定格庆祝 + 点亮符号盒；重复凝出 → 轻提示不打断演化。
  var SURPRISE_WEIGHTS = {
    heart: 6, star: 6, clover: 5, moon: 4, sun: 4, flower: 4, diamond: 3, smiley: 3,
    check: 2, bolt: 2, d7: 3, d8: 3, d9: 2, d0: 1, d1: 1, d2: 1, d3: 1, d4: 1, d5: 1, d6: 1,
    // v5.3 新符号：情感/节日向权重高，冷符号低
    crown: 3, key: 3, note: 3, cat: 3, butterfly: 3, balloon: 2, snow: 3, rainbow: 3, bell: 2, firework: 3
  };
  // 按心愿主题构建加权池：主题内符号权重 ×3 → 宇宙「记住」你的愿望基调，后续更常凝出同主题符号
  function surprisePool(theme) {
    var pool = [];
    var boost = (theme && E.WISH_THEMES[theme]) ? E.WISH_THEMES[theme].symbols : null;
    for (var i = 0; i < E.PATTERNS.length; i++) {
      var p = E.PATTERNS[i], w = SURPRISE_WEIGHTS[p.id] || 1;
      if (boost && boost.indexOf(p.id) >= 0) w *= 3;
      for (var k = 0; k < w; k++) pool.push(p);
    }
    return pool;
  }
  function pickSurpriseShape(excludeId, theme) {
    var pool = surprisePool(theme);
    // 连续不重复：抽到和上一个相同就重抽（最多 8 次，兜底直接返回）
    for (var t = 0; t < 8; t++) {
      var p = pool[(Math.random() * pool.length) | 0];
      if (!excludeId || p.id !== excludeId) return p;
    }
    return pool[(Math.random() * pool.length) | 0];
  }

  // 开始凝形：在屏幕中偏随机的位置放目标形状，细胞打乱顺序待命
  // rng 默认 Math.random；许愿仪式传入种子 rng → 同生日凝在同一位置
  function startCrystallize(shape, rng, dur) {
    var r = rng || Math.random;
    var parsed = E.parsePattern(shape.rows);   // 兼容 '#' 与 'O' 两种字符
    var h = parsed.h, w = parsed.w;
    var maxR = S.rows - h, maxC = S.cols - w;
    if (maxR < 1 || maxC < 1) return;   // 网格太小放不下
    dissolvePrevCrystal();   // 一次只留一个发现：上一颗溶回汤里，注意力集中在当前
    var r0 = 1 + ((maxR * (0.25 + r() * 0.5)) | 0);
    var c0 = 1 + ((maxC * (0.25 + r() * 0.5)) | 0);
    var cells = [], mark = [];
    for (var i = 0; i < parsed.cells.length; i++) {
      var cx = c0 + parsed.cells[i][0], cy = r0 + parsed.cells[i][1];
      cells.push([cy, cx]); mark.push(cy * S.cols + cx);
    }
    for (var k = cells.length - 1; k > 0; k--) {   // 打乱：像噪声随机落定成形，而非从上往下扫
      var j = (r() * (k + 1)) | 0, tmp = cells[k]; cells[k] = cells[j]; cells[j] = tmp;
      var tm = mark[k]; mark[k] = mark[j]; mark[j] = tm;
    }
    S.crystalMark = mark;
    S.crystal = { id: shape.id, name: shape.name, cells: cells, idx: 0, t: 0, dur: dur || 5.0,
      cx: c0 + (w / 2), cy: r0 + (h / 2) };   // 中心格坐标：光爆粒子从这里炸开
  }

  // 溶掉上一个凝出的符号：解除钉活，让它退回普通 Life、被演化自然啃食消散
  function dissolvePrevCrystal() {
    for (var n = 0; n < S.crystalMark.length; n++) delete S.pinned[S.crystalMark[n]];
    S.crystalMark = [];
  }

  // 每帧推进：按墙钟时间分批揭示细胞（与速度档解耦，凝形始终约 5 秒）
  function stepCrystal(dt) {
    var cr = S.crystal;
    if (!cr) return;
    cr.t += dt * (1 + (S.ritual ? S.ritualEnergy * 1.5 : 0));   // 仪式长按：成形也加速
    var want = Math.min(cr.cells.length, ((cr.t / cr.dur) * cr.cells.length) | 0);
    while (cr.idx < want) {
      var cell = cr.cells[cr.idx++];
      var i = cell[0] * S.cols + cell[1];
      S.pinned[i] = true;
      if (!S.cur[i]) { S.cur[i] = 1; S.alpha[i] = 0; }   // 死细胞淡入，像「析出」
      S.age[i] = 255;
    }
    if (cr.idx >= cr.cells.length) finishCrystallize();
  }

  function finishCrystallize() {
    var cr = S.crystal;
    if (!cr) return;
    S.crystal = null;   // 形成完毕；细胞留在 pinned 里作为「发现的稳定符号」
    // 许愿仪式：凝形瞬间光爆 → 弹宇宙之卡（走专属庆祝，不占普通定格冷却）
    if (S.ritual && S.ritualPhase === 'crystal') {
      var sc = cellToScreen(cr.cx || S.cols / 2, cr.cy || S.rows / 2);
      crystalBurst(sc.x, sc.y);
      setTimeout(endRitualToCard, reduceMotion ? 0 : 700);   // 让光爆演完再出卡
      return;
    }
    S.lastSurpriseId = cr.id;
    // 自由模式凝形：首次发现 → 点亮符号盒 + 定格庆祝；重复凝出 → 轻提示不打断演化
    var pat = E.PATTERN_INDEX[cr.id];
    if (pat && !S.found[cr.id]) {
      collectSymbol(pat);
      maybeFreeze(cr.id, 'rare', cr.name);
    } else {
      toast('宇宙又凝出了「' + cr.name + '」✦');
    }
  }

  // 每代把已揭示的细胞重新钉活：Life 会啃边缘，钉住保证凝出的形状稳定不塌
  function reassertPinned() {
    var forced = 0;
    for (var k in S.pinned) {
      var i = +k;
      if (!S.cur[i]) { S.cur[i] = 1; S.age[i] = 255; forced++; }
    }
    if (forced) S.live += forced;
  }

  // 定时触发：让宇宙自己「长出」惊喜（仪式/暂停/已在凝形/已定格时不触发新凝形）
  function tickCrystal(dt) {
    if (S.crystal) { stepCrystal(dt); return; }   // 凝形推进（含仪式凝形）
    if (S.ritual) return;
    if (!S.running || S.freezeId) return;
    S.nextCrystalIn -= dt;
    if (S.nextCrystalIn > 0) return;
    startCrystallize(pickSurpriseShape(S.lastSurpriseId, S.wishTheme));   // 30 符号加权随机（按心愿主题偏移），连续不重复
    S.nextCrystalIn = 30 + Math.random() * 15;   // 下一次约 30–45 秒后
  }

  /* ---------------- 许愿仪式（v5.4：短节奏 + 长按注入能量 + 凝形光爆 + 卡面海报） ---------------- */
  // 阶段：'' 空闲 → 'evolve' 演化（4–6s，长按加速）→ 'crystal' 凝形（2.5s + 光爆）→ 'card' 宇宙之卡
  // letter（v5.4 降级）：首字母不再作为凝形目标（等半天只看个字母没有情绪回报），只作卡角落的签名印章
  function startRitual(text, bday, letter) {
    text = (text || '').trim();
    var wasRitual = S.ritual;   // 嵌套再许愿时不覆写已保存的原 autoSeed
    // 种子：生日优先（同生日→同宇宙），否则随机；无生日也能玩（降级纯随机）
    var seed = bday ? E.hashSeed(bday) : ((Math.random() * 0xffffffff) >>> 0);
    var rng = E.mulberry32(seed);
    S.ritual = true; S.ritualPhase = 'evolve'; S.ritualT = 0;
    S.ritualSeed = seed; S.ritualRng = rng;
    S.ritualWish = text || '愿一切安好';
    S.ritualBday = bday || '';
    S.ritualLetter = letter ? letter.trim().toUpperCase() : '';   // 只印卡，不凝形
    S.ritualTarget = E.pickWishSymbol(text, bday, rng);           // 心愿→情感符号（仪式结果恒为符号）
    S.wishTheme = E.wishThemeOf(text, bday, rng);         // 心愿→主题（贯穿整局：惊喜池加权 + 卡面色系）
    S.ritualEvolveDur = 4 + rng() * 2;                     // 演化 4–6s（v5.4：砍半，等待是成本不是仪式）
    S.ritualEnergy = 0;                                    // 长按注入能量（0=松手 1=按住，平滑过渡）
    // 关掉自动冷场补种/流星，仪式期间只按剧本走
    if (!wasRitual) S._ritualAutoSeed = S.autoSeed;
    S.autoSeed = false;
    S.wrap = true;
    setCellSize(window.innerWidth < 640 ? 6 : 7);
    randomize(0.24, rng);            // 种子汤：同生日 → 同一片混沌
    setRunning(true);
    setSpeedSlider(14);
    $('wishLayer').hidden = true;
    $('ritualHint').hidden = false;
    $('ritualHint').textContent = '按住屏幕，为宇宙注入能量 ✦';
  }

  function tickRitual(dt) {
    if (!S.ritual) return;
    // 能量平滑：按住趋近 1、松手趋近 0（指数逼近，避免跳变）
    var want = S.ritualHold ? 1 : 0;
    S.ritualEnergy += (want - S.ritualEnergy) * Math.min(1, dt * 6);
    $('ritualHint').classList.toggle('energy', S.ritualEnergy > 0.5);
    if (S.ritualPhase === 'evolve') {
      // 长按注入能量：演化进度 ×2.5 加速——等待变成"你在亲手养一个宇宙"
      S.ritualT += dt * (1 + S.ritualEnergy * 1.5);
      // 汤塌了兜底：仪式不能冷场，用同一种子续一片新汤（保持"同生日同宇宙"的确定性）
      if (S.live < Math.max(12, S.cols * S.rows * 0.004)) {
        var g2 = E.createGrid(S.cols, S.rows);
        E.randomFill(g2, S.cols, S.rows, 0.2, S.ritualRng);
        for (var i = 0; i < g2.length; i++) {
          if (g2[i]) { S.cur[i] = 1; S.age[i] = 1; if (S.alpha[i] < 0.3) S.alpha[i] = 0.3; }
        }
        S.live = E.countLive(S.cur);
        S.keys.length = 0;
      }
      if (S.ritualT >= S.ritualEvolveDur) {
        S.ritualPhase = 'crystal'; S.ritualT = 0;
        $('ritualHint').textContent = '混沌里正在凝出你的符号 ✦';
        startCrystallize(S.ritualTarget, S.ritualRng, 2.5);   // 凝形 2.5s：成形要快，高潮不拖
      }
    }
    // 'crystal' 阶段由 tickCrystal → stepCrystal 推进，完成时 finishCrystallize 调 endRitualToCard
  }

  function endRitualToCard() {
    S.ritualPhase = 'card';
    setRunning(false);
    $('ritualHint').hidden = true;
    // 记录为上一个惊喜，退出仪式后不重复凝它；仪式目标恒为情感符号 → 点亮图鉴
    S.lastSurpriseId = S.ritualTarget.id;
    collectSymbol(S.ritualTarget);
    showCosmosCard();
  }

  function exitRitual() {
    // 结束仪式回到自由沙盒：恢复自动冷场
    S.ritual = false; S.ritualPhase = '';
    S.ritualHold = false; S.ritualEnergy = 0;
    $('ritualHint').classList.remove('energy');
    $('cosmosLayer').hidden = true;
    if (S._ritualAutoSeed !== undefined) { S.autoSeed = S._ritualAutoSeed; delete S._ritualAutoSeed; }
    setRunning(true);
  }

  /* ---------------- 宇宙之卡（v5.0 分享产物） ---------------- */
  // 当前心愿主题色系（无主题 → 星野默认金粉）；驱动符号/卡面/粒子三处配色
  function cardColors() {
    var t = S.wishTheme && E.WISH_THEMES[S.wishTheme];
    return { c1: t ? t.c1 : '#f7c873', c2: t ? t.c2 : '#e8a0bf', dust: t ? t.dust : '#efeaff' };
  }

  // 把符号画进 canvas（v5.4 海报化：圆角块 + 主题渐变 + 大光晕，弱化"方块点阵"感）
  function drawSymbolToCanvas(cv, pat, glow) {
    var col = cardColors();
    var parsed = E.parsePattern(pat.rows);
    var ctx2 = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    ctx2.clearRect(0, 0, W, H);
    var pad = Math.floor(Math.min(W, H) * 0.06);
    var scale = Math.min((W - pad * 2) / parsed.w, (H - pad * 2) / parsed.h);
    var ox = (W - parsed.w * scale) / 2, oy = (H - parsed.h * scale) / 2;
    var grad = ctx2.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, col.c1); grad.addColorStop(1, col.c2);
    if (glow) { ctx2.shadowBlur = scale * 2.2; ctx2.shadowColor = col.c1; }
    ctx2.fillStyle = grad;
    var r = Math.max(1.5, scale * 0.34);   // 圆角：块与块视觉融合成"发光体"而非像素格
    for (var i = 0; i < parsed.cells.length; i++) {
      var c = parsed.cells[i];
      var x = ox + c[0] * scale, y = oy + c[1] * scale, s = scale - 0.6;
      ctx2.beginPath();
      if (ctx2.roundRect) ctx2.roundRect(x, y, s, s, r);
      else ctx2.rect(x, y, s, s);
      ctx2.fill();
    }
    ctx2.shadowBlur = 0;
  }

  // 点阵退居背景纹理：符号放大铺满整卡、极低透明度（JS 侧控制 alpha）
  function drawTexture(cv, pat) {
    var parsed = E.parsePattern(pat.rows);
    var ctx2 = cv.getContext('2d');
    ctx2.clearRect(0, 0, cv.width, cv.height);
    var scale = Math.max(cv.width / parsed.w, cv.height / parsed.h) * 1.4;   // 溢出裁切，像星图底纹
    var ox = (cv.width - parsed.w * scale) / 2, oy = (cv.height - parsed.h * scale) / 2;
    ctx2.fillStyle = '#ffffff';
    ctx2.globalAlpha = 0.5;   // CSS 再压到 .07，两层相乘
    for (var i = 0; i < parsed.cells.length; i++) {
      var c = parsed.cells[i];
      ctx2.fillRect(ox + c[0] * scale, oy + c[1] * scale, scale * 0.5, scale * 0.5);
    }
    ctx2.globalAlpha = 1;
  }

  function universeCode() {
    // 宇宙编号：生日优先显示生日，否则用种子十六进制码
    if (S.ritualBday) return 'NO.' + S.ritualBday.replace(/-/g, '');
    return 'NO.' + (S.ritualSeed >>> 0).toString(36).toUpperCase().slice(0, 6);
  }

  function showCosmosCard() {
    var pat = S.ritualTarget;
    // 卡面文案拼入心愿原话（独一无二）：心愿 × 签文 × 句式，rng 保证同种子同文案
    S.ritualFortune = E.buildFortune(pat.id, S.ritualWish, S.ritualRng);
    var col = cardColors();
    drawTexture($('cosmosTexture'), pat);
    drawSymbolToCanvas($('cosmosSymbol'), pat, !reduceMotion);
    // 卡面渐变与符号发光随心愿主题变化
    $('cosmosCard').style.background =
      'linear-gradient(180deg,' + col.c1 + '22 0%, #1c1440 45%, ' + col.c2 + '22 100%)';
    $('cosmosSymbol').style.filter = 'drop-shadow(0 0 14px ' + col.c1 + '99)';
    $('cosmosWish').textContent = '「' + S.ritualWish + '」';
    $('cosmosFortune').textContent = S.ritualFortune;
    // 首字母 = 卡角落的签名印章（v5.4 降级：不再是凝形目标，只是"这宇宙盖了你的章"）
    var stamp = $('cosmosStamp');
    if (S.ritualLetter) { stamp.hidden = false; stamp.textContent = S.ritualLetter; }
    else stamp.hidden = true;
    var d = new Date();
    var dateStr = d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
    $('cosmosMeta').textContent = '宇宙编号 ' + universeCode() + ' · ' + dateStr + ' · 由 ' + pat.name + ' 显形';
    $('cosmosLayer').hidden = false;
  }

  // 离屏绘制整张卡 → 导出 PNG dataURL（不污染可见 DOM）
  function renderCardToCanvas() {
    var W = 720, H = 960;   // 3:4 竖版，2× 于卡片尺寸
    var col = cardColors();
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    // 背景渐变（随心愿主题色系）
    var bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#12102e'); bg.addColorStop(0.6, '#1c1440'); bg.addColorStop(1, '#241a4a');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    // 主题色氛围光（顶部/底部各一团，让不同愿望的卡一眼可辨）
    var halo1 = c.createRadialGradient(W / 2, 60, 0, W / 2, 60, W * 0.8);
    halo1.addColorStop(0, col.c1 + '33'); halo1.addColorStop(1, 'transparent');
    c.fillStyle = halo1; c.fillRect(0, 0, W, H);
    var halo2 = c.createRadialGradient(W / 2, H - 60, 0, W / 2, H - 60, W * 0.8);
    halo2.addColorStop(0, col.c2 + '33'); halo2.addColorStop(1, 'transparent');
    c.fillStyle = halo2; c.fillRect(0, 0, W, H);
    // 星点（主题尘埃色）
    var srng = E.mulberry32(S.ritualSeed ^ 0x9e3779b9);
    c.fillStyle = col.dust;
    for (var i = 0; i < 90; i++) {
      var x = srng() * W, y = srng() * H, r = srng() * 1.6 + 0.4;
      c.globalAlpha = 0.3 + srng() * 0.7;
      c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
    }
    c.globalAlpha = 1;
    // eyebrow
    c.fillStyle = col.c1; c.font = '600 22px sans-serif'; c.textAlign = 'center';
    c.fillText('M Y   U N I V E R S E', W / 2, 70);
    // 背景纹理（点阵放大铺满，隐约可见——v5.4：点阵退居幕后）
    var texCv = document.createElement('canvas');
    texCv.width = W; texCv.height = H;
    drawTexture(texCv, S.ritualTarget);
    c.save(); c.globalAlpha = 0.07; c.drawImage(texCv, 0, 0); c.restore();
    // 符号（居中偏上，主题色渐变 + 圆角发光）
    var symCv = document.createElement('canvas');
    symCv.width = 400; symCv.height = 400;
    drawSymbolToCanvas(symCv, S.ritualTarget, true);
    c.drawImage(symCv, (W - 400) / 2, 120, 400, 400);
    // 首字母印章（右上角金色圆章）
    if (S.ritualLetter) {
      var sx0 = W - 86, sy0 = 86;
      var sg = c.createLinearGradient(sx0 - 36, sy0 - 36, sx0 + 36, sy0 + 36);
      sg.addColorStop(0, col.c1); sg.addColorStop(1, col.c2);
      c.save(); c.translate(sx0, sy0); c.rotate(0.14);
      c.shadowBlur = 22; c.shadowColor = col.c1;
      c.fillStyle = sg; c.beginPath(); c.arc(0, 0, 36, 0, 6.283); c.fill();
      c.shadowBlur = 0;
      c.fillStyle = '#241a05'; c.font = 'italic 800 40px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(S.ritualLetter, 0, 2);
      c.restore(); c.textBaseline = 'alphabetic'; c.textAlign = 'center';
    }
    // 心愿
    c.fillStyle = '#cfc7ea'; c.font = 'italic 26px sans-serif';
    c.fillText('「' + S.ritualWish + '」', W / 2, 580);
    // 签文（自动换行）
    c.fillStyle = '#ffffff'; c.font = '700 34px sans-serif';
    wrapText(c, S.ritualFortune || E.buildFortune(S.ritualTarget.id, S.ritualWish, E.mulberry32(S.ritualSeed)), W / 2, 650, W - 120, 46);
    // meta
    c.fillStyle = '#8f88b0'; c.font = '20px sans-serif';
    var d = new Date();
    c.fillText('宇宙编号 ' + universeCode() + ' · ' + d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(), W / 2, H - 60);
    return cv;
  }
  function wrapText(c, text, x, y, maxW, lh) {
    var line = '', yy = y;
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (c.measureText(test).width > maxW && line) { c.fillText(line, x, yy); line = text[i]; yy += lh; }
      else line = test;
    }
    if (line) c.fillText(line, x, yy);
  }
  function saveCosmosImage() {
    try {
      var url = renderCardToCanvas().toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url; a.download = '我的宇宙_' + universeCode() + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('已保存图片 ✦');
    } catch (e) { toast('保存失败 · 可直接截图这张卡'); }
  }

  /* ---------------- 人口曲线 ---------------- */
  var sparkEl = $('spark'), sparkCtx = sparkEl.getContext('2d');
  function drawSpark() {
    var W = sparkEl.width, H = sparkEl.height, h = S.popHist;
    sparkCtx.clearRect(0, 0, W, H);
    if (h.length < 2) return;
    var max = 1;
    for (var i = 0; i < h.length; i++) if (h[i] > max) max = h[i];
    sparkCtx.strokeStyle = 'rgb(' + COL.a[0] + ',' + COL.a[1] + ',' + COL.a[2] + ')';
    sparkCtx.lineWidth = 3;
    sparkCtx.lineJoin = 'round';
    sparkCtx.beginPath();
    for (var j = 0; j < h.length; j++) {
      var x = 2 + (j / (h.length - 1)) * (W - 4);
      var y = H - 4 - (h[j] / max) * (H - 10);
      if (j === 0) sparkCtx.moveTo(x, y); else sparkCtx.lineTo(x, y);
    }
    sparkCtx.stroke();
  }

  /* ---------------- 永不冷场（S4） ---------------- */
  function maybeReseed() {
    if (!S.autoSeed) return;
    if (S.gen === S.reseedChecked) return;
    S.reseedChecked = S.gen;
    var thr = Math.max(8, Math.round(S.cols * S.rows * 0.015));
    if (S.live > thr) { S.lowRun = 0; return; }
    S.lowRun++;
    if (S.lowRun < 45) return;
    if (S.gen - S.lastReseedGen < 80) return;
    S.lowRun = 0; S.lastReseedGen = S.gen;
    seedCluster();
    toast('生态太安静了，补种一小片 ✦');
  }

  // 补种一小片随机汤（不再依赖已删的天然图案），让安静的生态重新热闹起来
  function seedCluster() {
    var w = Math.min(S.cols, 26), h = Math.min(S.rows, 18);
    var x0 = Math.floor(Math.random() * Math.max(1, S.cols - w));
    var y0 = Math.floor(Math.random() * Math.max(1, S.rows - h));
    for (var y = y0; y < y0 + h; y++) {
      for (var x = x0; x < x0 + w; x++) {
        if (Math.random() < 0.42) {
          var idx = y * S.cols + x;
          S.cur[idx] = 1;
          if (S.alpha[idx] < 0.3) S.alpha[idx] = 0.3;
        }
      }
    }
    S.live = E.countLive(S.cur);
    S.keys.length = 0; S.calloutKind = null;
  }

  /* ---------------- 最佳纪录（符号盒底部一行；v5.0 任务/连胜已移除） ---------------- */
  function updateBest() {
    var n = 0;
    for (var i = 0; i < E.PATTERNS.length; i++) if (S.found[E.PATTERNS[i].id]) n++;
    $('bestRec').textContent = '最佳：活过 ' + S.best.gen + ' 代 · 人口峰值 ' + S.best.live
      + ' · 已收集 ' + n + '/' + E.PATTERNS.length + ' 个符号';
  }
  function saveBest() { try { localStorage.setItem('life.best', JSON.stringify(S.best)); } catch (e) {} }
  function loadBest() {
    try {
      var s = localStorage.getItem('life.best');
      if (s) {
        var b = JSON.parse(s);
        if (b && typeof b.gen === 'number') S.best = { gen: b.gen | 0, live: b.live | 0 };
      }
    } catch (e) {}
  }

  /* ---------------- 图鉴收集（S6；v3.3 成为抽屉唯一内容，兼作图案库） ---------------- */
  var dexReady = false;
  var TIER_ORDER = ['common', 'rare', 'epic', 'myth', 'symbol'];
  var TIER_INFO = {
    common: { name: '普通', cls: 't-common' },
    rare: { name: '稀有', cls: 't-rare' },
    epic: { name: '传说', cls: 't-epic' },
    myth: { name: '创世', cls: 't-myth' },
    symbol: { name: '符号', cls: 't-symbol' }
  };
  function tierOf(pat) { return TIER_INFO[pat.tier] ? pat.tier : 'common'; }

  function buildDex() {
    var list = $('dexList');
    list.innerHTML = '';
    TIER_ORDER.forEach(function (tk) {
      var pats = E.PATTERNS.filter(function (p) { return tierOf(p) === tk; });
      if (!pats.length) return;

      var head = document.createElement('div');
      head.className = 'tier-head ' + TIER_INFO[tk].cls;
      head.setAttribute('data-tier-got', tk);
      var dot = document.createElement('i'), nm = document.createElement('b'), got = document.createElement('span');
      nm.textContent = TIER_INFO[tk].name; got.className = 't-got';
      head.appendChild(dot); head.appendChild(nm); head.appendChild(got);
      list.appendChild(head);

      var grid = document.createElement('div');
      grid.className = 'dex-grid';
      pats.forEach(function (pat) {
        var parsed = E.parsePattern(pat.rows);
        var slot = document.createElement('div');
        slot.className = 'slot ' + TIER_INFO[tk].cls + (S.found[pat.id] ? ' on' : '');
        slot.setAttribute('data-id', pat.id);
        var cv = document.createElement('canvas');
        var scale = 3, pad = 1;
        cv.width = (parsed.w + pad * 2) * scale;
        cv.height = (parsed.h + pad * 2) * scale;
        var c = cv.getContext('2d');
        c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--cell-a').trim();
        parsed.cells.forEach(function (cell) {
          c.fillRect((cell[0] + pad) * scale, (cell[1] + pad) * scale, scale - 0.5, scale - 0.5);
        });
        var nm2 = document.createElement('span'); nm2.className = 'n'; nm2.textContent = pat.name;
        slot.appendChild(cv); slot.appendChild(nm2);
        slot.addEventListener('mouseenter', function () { showDexDetail(pat); });   // 悬停即看大白话介绍
        slot.addEventListener('click', function () { pickPattern(pat, parsed, slot); });
        grid.appendChild(slot);
      });
      list.appendChild(grid);
    });
    updateDexCount();
    dexReady = true;
  }

  /* 图鉴条目兼作图案库：点一下进入放置模式，再点取消 */
  function pickPattern(pat, parsed, slot) {
    showDexDetail(pat);
    var wasSel = slot.classList.contains('sel');
    clearPick();
    if (wasSel) { S.hover = null; toast('已取消放置'); return; }
    slot.classList.add('sel');
    S.placing = { pattern: pat, parsed: parsed };
    stage.classList.add('placing');
    openDrawer(false);
    toast('点画布放置「' + pat.name + '」，按 Esc 取消');
  }
  function clearPick() {
    S.placing = null;
    stage.classList.remove('placing');
    Array.prototype.forEach.call($('dexList').querySelectorAll('.slot.sel'), function (n) { n.classList.remove('sel'); });
  }

  function updateDexCount() {
    var n = 0, got = {};
    for (var i = 0; i < E.PATTERNS.length; i++) {
      var p = E.PATTERNS[i];
      if (S.found[p.id]) { n++; var tk = tierOf(p); got[tk] = (got[tk] || 0) + 1; }
    }
    $('dexCount').textContent = n + '/' + E.PATTERNS.length;
    Array.prototype.forEach.call($('dexList').querySelectorAll('[data-tier-got]'), function (h) {
      var t = h.getAttribute('data-tier-got');
      var total = E.PATTERNS.filter(function (p) { return tierOf(p) === t; }).length;
      h.querySelector('.t-got').textContent = (got[t] || 0) + '/' + total;
    });
  }

  var TIER_RANK = { common: 0, rare: 1, epic: 2, myth: 3 };

  /* ---------------- 图鉴详情区（把术语翻成大白话） ---------------- */
  function showDexDetail(pat) {
    var box = $('dexDetail');
    if (!pat) { box.hidden = true; return; }
    box.hidden = false;
    var tk = tierOf(pat);
    $('dxName').textContent = pat.name;
    var badge = $('dxBadge');
    badge.textContent = TIER_INFO[tk].name;
    badge.className = 'dx-badge ' + TIER_INFO[tk].cls;
    $('dxType').textContent = E.typeLabel(pat.type);
    $('dxDesc').textContent = E.plainDesc(pat);
    $('dxBest').textContent = '';
  }

  function onDiscover(id) {
    var slot = $('dexList').querySelector('[data-id="' + id + '"]');
    if (slot) {
      slot.classList.add('on');
      slot.classList.remove('pulse');
      void slot.offsetWidth;
      slot.classList.add('pulse');
    }
    updateDexCount();
    var tier = tierOf(E.PATTERN_INDEX[id] || {});
    // 普通档只在首次发现时给一条轻提示；稀有及以上交给「定格」提示条
    if (tier === 'common') toast('符号盒 +1 ✦ 「' + (E.NAMES[id] || id) + '」');
    return tier;
  }

  /* ---------------- 自动定格（稀有及以上出现即暂停） ---------------- */
  var FREEZE_COOLDOWN = 30000;   // 30s 内最多定格一次，避免连续打断
  function showFreeze(id, tier, name) {
    var bar = $('freezeBar');
    var badge = $('freezeBadge');
    badge.className = 'fz-badge ' + TIER_INFO[tier].cls;
    badge.textContent = TIER_INFO[tier].name;
    $('freezeName').textContent = name || E.NAMES[id] || id;
    bar.classList.add('show');
    setRunning(false);
  }
  function dismissFreeze() {
    var bar = $('freezeBar');
    if (!bar.classList.contains('show')) return;
    bar.classList.remove('show');
    S.freezeId = null;
    setRunning(true);
  }
  // 首次发现「稀有/传说/创世」时定格：已手动暂停不触发、30s 冷却
  function maybeFreeze(id, tier, name) {
    if (S.freezeId) return;
    if (!S.running) return;
    var now = performance.now();
    if (now < S.freezeUntil) return;
    S.freezeUntil = now + FREEZE_COOLDOWN;
    S.freezeId = id;
    showFreeze(id, tier, name);
  }

  function saveFound() { try { localStorage.setItem('life.found', JSON.stringify(S.found)); } catch (e) {} }
  function loadFound() {
    try {
      var s = localStorage.getItem('life.found');
      var o = s ? JSON.parse(s) : null;
      S.found = (o && typeof o === 'object') ? o : {};
    } catch (e) { S.found = {}; }
  }

  function applyCounts(counts) {
    var got = false, bestId = null, bestTier = null;
    for (var id in counts) {
      if (!S.found[id]) {
        S.found[id] = true;
        var tier = onDiscover(id);
        got = true;
        if (tier !== 'common' && (bestId === null || TIER_RANK[tier] > TIER_RANK[bestTier])) { bestId = id; bestTier = tier; }
      }
    }
    if (got) saveFound();
    // 同一帧可能解锁多条：定格最高档的那一条
    if (bestId) maybeFreeze(bestId, bestTier);
  }

  // 符号图案「放置即收集」：它们不在识别注册表里（见 registry()），靠识别永远发现不了，
  // 故放置的瞬间按 id 直接入账。主动放置不打断演化（不触发定格），只点亮槽位 + toast。
  function collectSymbol(pat) {
    if (S.found[pat.id]) return;
    S.found[pat.id] = true;
    saveFound();
    onDiscover(pat.id);
    toast('已收入符号盒：「' + pat.name + '」');
  }

  // 落子后立刻按"刚放下去的那一坨"识别：画布上有邻居时会被 radius-2 分量粘连、
  // 或整体超过 RECOG_MAX 而认不出来（v3.6：放置即识别，不再等 200ms 节流的整屏扫描）
  function identifyPlaced(parsed) {
    var w = parsed.w + 8, h = parsed.h + 8;
    var g = E.createGrid(w, h);
    E.placePattern(g, w, h, parsed, 4, 4, false);
    return E.identify(g, w, h);
  }

  function runIdentify() {
    var now = performance.now();
    if (now - S.lastIdentAt < 200) return;
    S.lastIdentAt = now;
    var counts = E.identify(S.cur, S.cols, S.rows);
    S.counts = counts;
    applyCounts(counts);
  }

  function frame(now) {
    var dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;

    tickRitual(dt);

    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) {
      fpsShown = Math.round(fpsN / fpsAcc);
      fpsAcc = 0; fpsN = 0;
      drawSpark();
      if (S.glow && fpsShown < 45) {
        if (++lowFpsFrames >= 4) { setGlow(false); toast('已自动关闭发光，保持流畅'); }
      } else { lowFpsFrames = 0; }
    }

    var k = reduceMotion ? 1 : Math.min(1, dt * 11);
    var target, al;
    for (var i = 0; i < S.alpha.length; i++) {
      target = S.cur[i] ? 1 : 0;
      al = S.alpha[i];
      if (target === 1) {
        al += (1 - al) * k;
        if (al > 0.995) al = 1;
      } else if (al > 0) {
        al -= al * k;
        if (al < 0.004) { al = 0; S.age[i] = 0; }
      }
      S.alpha[i] = al;
    }

    if (S.running) {
      acc += dt;
      // 高速档（可达 1000×）不能靠固定 guard=8：interval 会小到 1ms，一帧 16ms 想追 16+ 代。
      // 改成「时间预算 + 步数上限」双保险：本帧最多花 ~14ms 追速度，留时间给渲染；
      // 追不上就丢弃积压（acc 清零），避免死亡螺旋。宇宙尺度单代 ~2.7ms，自然封顶在硬件能跑的代数。
      // 仪式长按能量：有效速度 ×(1+2×energy)，细胞 visibly 加速涌动（v5.4）
      var speedEff = S.speed * (1 + (S.ritual ? S.ritualEnergy * 2 : 0));
      var interval = 1 / speedEff;
      var t0 = performance.now();
      var budgetMs = Math.min(14, dt * 1000 * 0.85);
      var guard = 0, maxGuard = Math.max(16, Math.ceil(speedEff / 15));
      while (acc >= interval && guard++ < maxGuard && performance.now() - t0 < budgetMs) { acc -= interval; doStep(); }
      if (acc > Math.max(interval * 4, 0.25)) acc = 0;
      maybeReseed();
      if (S.gen !== S.lastPopGen) {
        S.lastPopGen = S.gen;
        S.popHist.push(S.live);
        if (S.popHist.length > 120) S.popHist.shift();
      }
    } else {
      acc = 0;
    }

    // 结构识别每帧至多一次（节流），卡顿时跳过以免拖慢主循环
    if (dt < 0.05) runIdentify();
    stepMeteors(dt);
    tickCrystal(dt);
    stepParticles(dt);

    buildImage();
    render();
    drawMeteors();
    updateStats();
    requestAnimationFrame(frame);
  }

  var lastStat = '';
  function updateStats() {
    var sig = S.gen + '|' + S.live + '|' + S.peak;
    if (sig === lastStat) return;
    lastStat = sig;
    $('statGen').textContent = S.gen;
    $('statLive').textContent = S.live;
    $('statPeak').textContent = S.peak;
  }

  /* ---------------- 提示 ---------------- */
  var toastEl = $('toast'), toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  // U3 空状态引导：只有「用户主动清空」(C 键) 才触发，randomize/演示不弹
  function emptyHint() {
    toast('网格空了 · 在格子上画几笔，或按 R 随机来一片 ✦');
  }

  /* ---------------- 交互 ---------------- */
  var painting = 0, lastCell = null, longPressTimer = 0, pointers = {}, pinchDist = 0, pinchCell = 0;

  function cellAt(clientX, clientY) {
    var r = board.getBoundingClientRect();
    var bw = S.cols * S.cell, bh = S.rows * S.cell;
    var ox = Math.round((r.width - bw) / 2), oy = Math.round((r.height - bh) / 2);
    var x = Math.floor((clientX - r.left - ox) / S.cell);
    var y = Math.floor((clientY - r.top - oy) / S.cell);
    return { x: x, y: y };
  }

  function inBounds(c) { return c.x >= 0 && c.y >= 0 && c.x < S.cols && c.y < S.rows; }

  function paintLine(from, to, value) {
    var dx = to.x - from.x, dy = to.y - from.y;
    var steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (var i = 0; i <= steps; i++) {
      var x = from.x + Math.round(dx * (steps ? i / steps : 0));
      var y = from.y + Math.round(dy * (steps ? i / steps : 0));
      if (x < 0 || y < 0 || x >= S.cols || y >= S.rows) continue;
      var idx = y * S.cols + x;
      S.cur[idx] = value;
      S.age[idx] = value ? 1 : S.age[idx];
      if (value) S.alpha[idx] = Math.max(S.alpha[idx], 0.35);
    }
    S.live = E.countLive(S.cur);
  }

  function pointerPos(e) { return cellAt(e.clientX, e.clientY); }

  board.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  board.addEventListener('pointerdown', function (e) {
    if (S.ritual) {   // 仪式期画布不接受涂画，但按住 = 为宇宙注入能量（v5.4）
      S.ritualHold = true;
      if (navigator.vibrate) navigator.vibrate(8);
      return;
    }
    board.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

    if (Object.keys(pointers).length === 2) {
      var p = Object.keys(pointers).map(function (k) { return pointers[k]; });
      pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      pinchCell = S.cell;
      painting = 0;
      return;
    }

    var c = pointerPos(e);
    if (S.placing) {
      if (inBounds(c)) {
        E.placePattern(S.cur, S.cols, S.rows, S.placing.parsed, c.x, c.y, S.wrap);
        S.live = E.countLive(S.cur);
        for (var i = 0; i < S.cur.length; i++) if (S.cur[i] && S.alpha[i] < 0.4) S.alpha[i] = 0.4;
        S.keys.length = 0; S.calloutKind = null;
        // 放下去的瞬间就认一次，并清掉节流窗口让整屏扫描下帧立即跟上
        applyCounts(identifyPlaced(S.placing.parsed));   // 自然识别（symbol 不在注册表，不会误入账）
        if (S.placing.pattern.tier === 'symbol') collectSymbol(S.placing.pattern);  // 放置即收集
        S.lastIdentAt = 0;
      }
      return;
    }

    painting = (e.button === 2 || e.shiftKey) ? -1 : 1;
    lastCell = c;
    if (inBounds(c)) paintLine(c, c, painting === 1 ? 1 : 0);

    if (e.pointerType === 'touch') {
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(function () {
        painting = -1;
        if (navigator.vibrate) navigator.vibrate(12);
        toast('擦除模式');
      }, 420);
    }
  });

  board.addEventListener('pointermove', function (e) {
    if (pointers[e.pointerId]) { pointers[e.pointerId].x = e.clientX; pointers[e.pointerId].y = e.clientY; }

    var ids = Object.keys(pointers);
    if (ids.length === 2 && pinchDist > 0) {
      var p = ids.map(function (k) { return pointers[k]; });
      var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      var next = Math.round(pinchCell * (d / pinchDist));
      setCellSize(next);
      return;
    }

    var c = pointerPos(e);
    if (S.placing) { S.hover = c; return; }

    if (painting) {
      clearTimeout(longPressTimer);
      if (lastCell) paintLine(lastCell, c, painting === 1 ? 1 : 0);
      lastCell = c;
    }
  });

  function endPointer(e) {
    delete pointers[e.pointerId];
    clearTimeout(longPressTimer);
    if (Object.keys(pointers).length < 2) pinchDist = 0;
    painting = 0; lastCell = null;
    S.ritualHold = false;
  }
  board.addEventListener('pointerup', endPointer);
  board.addEventListener('pointercancel', endPointer);
  board.addEventListener('pointerleave', function (e) {
    if (S.placing) S.hover = null;
    if (e.pointerType === 'mouse') endPointer(e);
  });

  board.addEventListener('wheel', function (e) {
    e.preventDefault();
    setCellSize(S.cell + (e.deltaY < 0 ? 2 : -2));
  }, { passive: false });

  function setCellSize(v) {
    var c = Math.max(4, Math.min(24, Math.round(v)));
    if (c === S.cell) return;
    S.cell = c;
    layout(true);
  }

  /* ---------------- 控件 ---------------- */
  function setRunning(on) {
    S.running = on;
    // SVG 子元素没有 HTML 的 .hidden 属性，必须走 setAttribute 才能触发 [hidden]{display:none}
    // 语义：播放中显示「暂停」图标（提示可暂停），暂停时显示「播放」三角（提示可开始）
    var play = $('icoPlay'), pause = $('icoPause');
    if (on) { play.setAttribute('hidden', ''); pause.removeAttribute('hidden'); }
    else { play.removeAttribute('hidden'); pause.setAttribute('hidden', ''); }
    $('btnPlay').setAttribute('aria-label', on ? '暂停' : '开始');
    // 用户主动恢复运行时，顺手收起「定格」提示条
    if (on && S.freezeId) { S.freezeId = null; $('freezeBar').classList.remove('show'); }
  }

  function setGlow(on) { S.glow = on && filterOK && !reduceMotion; }

  $('btnPlay').onclick = function () { setRunning(!S.running); };
  $('btnFreezeGo').onclick = dismissFreeze;

  // 速度条用指数映射：滑块 0–100 → 速度 1–1000×。
  // 线性 1–1000 会把常用的 1–60 挤进 6% 行程没法精调；指数映射让低速段留足行程、高速段照样够到 1000×。
  function speedFromSlider(pos) { return Math.max(1, Math.round(Math.pow(10, pos * 3 / 100))); }
  function sliderFromSpeed(v) { return Math.round(100 * Math.log(Math.max(1, v)) / Math.log(1000)); }

  $('speed').addEventListener('input', function () {
    S.speed = speedFromSlider(+this.value);
    $('speedVal').textContent = S.speed;
  });

  /* 设置面板已移除（v3.3）：边界=环面、网格线=自适应、发光=自动降级、缩放=双指/滚轮 */
  /* 任务条已移除（v5.0）：主流程改为许愿仪式，收集进度并入符号盒 */

  var THEMES = ['starfield', 'neon', 'retro', 'paper'];
  var THEME_NAMES = { starfield: '星野', neon: '深色霓虹', retro: '手绘复古', paper: '极简白' };
  $('btnTheme').onclick = function () {
    var i = (THEMES.indexOf(S.theme) + 1) % THEMES.length;
    applyTheme(THEMES[i]);
    toast('主题：' + THEME_NAMES[THEMES[i]]);
  };

  /* ---------------- 抽屉与图案 ---------------- */
  var drawer = $('drawer'), scrim = $('scrim');
  function openDrawer(on) {
    drawer.classList.toggle('open', on);
    drawer.setAttribute('aria-hidden', String(!on));
    scrim.hidden = !on;
    requestAnimationFrame(function () { scrim.classList.toggle('show', on); });
  }
  $('btnPatterns').onclick = function () { openDrawer(true); };
  $('btnCloseDrawer').onclick = function () { openDrawer(false); };
  scrim.onclick = function () { openDrawer(false); };

  /* ---------------- 速度 ---------------- */
  function setSpeedSlider(v) {
    S.speed = v;
    $('speed').value = sliderFromSpeed(v);
    $('speedVal').textContent = v;
  }

  /* ---------------- 快捷键 ---------------- */
  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (S.ritual) {
      // 仪式期间只保留一个出口：宇宙之卡弹出时 Esc 关闭回到沙盒
      if (e.key === 'Escape' && S.ritualPhase === 'card') exitRitual();
      return;
    }
    if (e.key === 'Escape') {
      if (!$('modal').hidden) closeModal();
      else if (drawer.classList.contains('open')) openDrawer(false);
      clearPick();
      return;
    }
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); setRunning(!S.running); }
    else if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') { setRunning(false); doStep(); }
    else if (e.key === 'r' || e.key === 'R') { randomize(0.28); }
    else if (e.key === 'c' || e.key === 'C') { clearPick(); clearGrid(); emptyHint(); }
    else if (e.key === '=' || e.key === '+') { setCellSize(S.cell + 2); }
    else if (e.key === '-' || e.key === '_') { setCellSize(S.cell - 2); }
  });

  /* ---------------- 规则弹层 ---------------- */
  var SCENES = [
    { neighbors: [[0, 1], [0, -1]], center: 1, text: '周围有 <b>2 个</b>活邻居 → 它<b>继续活着</b>' },
    { neighbors: [[-1, 0], [0, -1], [1, 1]], center: 0, text: '空格周围正好 <b>3 个</b>活邻居 → <b>诞生新生命</b>' },
    { neighbors: [[-1, -1], [0, -1], [1, -1], [1, 0]], center: 1, text: '邻居 <b>4 个以上</b>太拥挤 → <b>死亡</b>' }
  ];
  var sceneIdx = 0, sceneTimer = 0;
  var demo = $('ruleDemo'), dctx = demo.getContext('2d');

  function drawScene(i) {
    var s = SCENES[i], cs = getComputedStyle(document.documentElement);
    var N = 5, cell = demo.width / N, c0 = (N - 1) / 2;
    dctx.clearRect(0, 0, demo.width, demo.height);

    dctx.strokeStyle = cs.getPropertyValue('--grid').trim();
    dctx.lineWidth = 1;
    for (var k = 0; k <= N; k++) {
      dctx.beginPath(); dctx.moveTo(k * cell + .5, 0); dctx.lineTo(k * cell + .5, demo.height); dctx.stroke();
      dctx.beginPath(); dctx.moveTo(0, k * cell + .5); dctx.lineTo(demo.width, k * cell + .5); dctx.stroke();
    }
    dctx.fillStyle = cs.getPropertyValue('--cell-b').trim();
    s.neighbors.forEach(function (d) {
      dctx.fillRect((c0 + d[0]) * cell + 1, (c0 + d[1]) * cell + 1, cell - 2, cell - 2);
    });
    dctx.fillStyle = cs.getPropertyValue('--cell-a').trim();
    if (s.center) {
      dctx.fillRect(c0 * cell + 1, c0 * cell + 1, cell - 2, cell - 2);
    } else {
      dctx.setLineDash([4, 3]);
      dctx.strokeStyle = cs.getPropertyValue('--cell-a').trim();
      dctx.lineWidth = 2;
      dctx.strokeRect(c0 * cell + 2, c0 * cell + 2, cell - 4, cell - 4);
      dctx.setLineDash([]);
    }
    $('ruleDemoText').innerHTML = s.text;
  }

  function startDemo() {
    stopDemo();
    drawScene(sceneIdx);
    if (reduceMotion) return;
    sceneTimer = setInterval(function () {
      sceneIdx = (sceneIdx + 1) % SCENES.length;
      drawScene(sceneIdx);
    }, 2600);
  }
  function stopDemo() { clearInterval(sceneTimer); }
  function closeModal() { $('modal').hidden = true; stopDemo(); }

  $('btnWhat').onclick = function () { $('modal').hidden = false; startDemo(); };
  $('btnCloseModal').onclick = closeModal;
  $('modal').onclick = function (e) { if (e.target === this) closeModal(); };

  /* ---------------- 首屏推近 ---------------- */
  function introPushIn() {
    if (reduceMotion) return;
    board.style.transformOrigin = '50% 50%';
    board.style.animation = 'pushin 2s cubic-bezier(.22,.9,.28,1) both';
    board.style.pointerEvents = 'none';   // 动画期间关闭指针，避免命中判定偏移
    setTimeout(function () {
      board.style.animation = '';
      board.style.pointerEvents = '';
    }, 2050);
  }

  /* ---------------- 许愿仪式 UI 绑定（v5.0） ---------------- */
  function bindRitualUI() {
    // chips：点击填入心愿输入框（不覆盖已输入的自定义文本时追加）
    var chips = $('wishChips');
    if (chips && chips.children) {
      Array.prototype.forEach.call(chips.children, function (btn) {
        btn.onclick = function () {
          var inp = $('wishInput');
          inp.value = btn.getAttribute('data-wish') || btn.textContent;
          inp.focus();
        };
      });
    }
    $('btnWishGo').onclick = function () {
      var text = $('wishInput').value || '';
      var bday = $('wishBday').value || '';
      var letter = ($('wishLetter').value || '').trim();   // 大写归一化由 letterPattern 内部完成
      if (letter && !E.letterPattern(letter)) { $('wishLetter').focus(); toast('首字母填 A–Z 就好 ✦'); return; }
      if (!text.trim() && !bday && !letter) { $('wishInput').focus(); toast('先写一个心愿，或点一个 ✦'); return; }
      startRitual(text, bday, letter);
    };
    $('btnWishSkip').onclick = function () {
      // 不填 → 随机降级：给一个随机心愿，直接开宇宙
      var pool = ['愿一切安好', '想要一点点好运', '今天也要开心'];
      startRitual(pool[(Math.random() * pool.length) | 0], '');
    };
    $('btnCosmosSave').onclick = saveCosmosImage;
    $('btnCosmosAgain').onclick = function () {
      $('cosmosLayer').hidden = true;
      // 回到许愿卡重新许一愿；先恢复自由模式状态（autoSeed 等），否则下次 startRitual 会把 false 当原值存下去
      exitRitual();
      setRunning(false);
      $('wishLayer').hidden = false;
    };
    $('btnCosmosClose').onclick = exitRitual;
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    var saved = null;
    try { saved = localStorage.getItem('life.theme'); } catch (e) {}
    applyTheme(saved && THEMES.indexOf(saved) >= 0 ? saved : 'starfield');
    loadFound(); loadBest(); updateBest();

    buildDex();
    resize();
    setGlow(!reduceMotion && filterOK);
    bindRitualUI();

    // v5.0：首屏直接进许愿卡（不再自动高光演示）。底层宇宙先静置，等用户许愿再启动仪式。
    randomize(0.2);
    setRunning(false);
    setSpeedSlider(12);

    requestAnimationFrame(function (t) { lastFrame = t; frame(t); });
    introPushIn();
  }

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); }, 140);
  });
  window.addEventListener('orientationchange', function () { setTimeout(resize, 260); });

  boot();

  // 测试钩子：单机游戏无安全顾虑，暴露内部状态便于自动化验证（不参与任何逻辑）
  window.__life = { S: S, E: E, spawnMeteorShower: spawnMeteorShower, meteorImpact: meteorImpact,
    stepMeteors: stepMeteors, trackStructure: trackStructure, clearGrid: clearGrid,
    startCrystallize: startCrystallize, stepCrystal: stepCrystal, finishCrystallize: finishCrystallize,
    reassertPinned: reassertPinned, tickCrystal: tickCrystal, pickSurpriseShape: pickSurpriseShape,
    startRitual: startRitual, tickRitual: tickRitual, exitRitual: exitRitual,
    showCosmosCard: showCosmosCard, renderCardToCanvas: renderCardToCanvas,
    drawSymbolToCanvas: drawSymbolToCanvas, universeCode: universeCode };
})();
