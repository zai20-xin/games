// =====================================================================
//  热血足球 · 特效系统（粒子 / 轨迹 / 屏震 / 屏闪 / 提示），状态自持
//  行为与拆分前逐帧等价：调用点保持原 updateParticles / 计时器递减节奏
// =====================================================================

// ---------- 自持状态 ----------
let particles = [];
let trail = [];
let shake = 0;
let flashTimer = 0, flashColor = '#fff';
let superCallout = { timer: 0, text: '', color: '#fff' };
let shotMsgTimer = 0, shotMsg = '', shotMsgColor = '#fff';

export function flash(color, t) { flashColor = color; flashTimer = t; }
export function showSuperCallout(text, color, t) { superCallout = { text, color, timer: t }; }
export function showShotMsg(text, color, t) { shotMsg = text; shotMsgColor = color; shotMsgTimer = t; }
export function addShake(v) { shake = Math.max(shake, v); }

export function spawnDust(x, y) {
  for (let i = 0; i < 6; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, life: 14, color: '#ccc' });
}
export function spawnShock(x, y, ang, n, color) {
  color = color || '#fff';
  for (let i = 0; i < n; i++) {
    const spread = ang + (Math.random() - 0.5) * 0.7;
    const spd = 1.5 + Math.random() * 2.5;
    particles.push({ x, y, vx: Math.cos(spread) * spd, vy: Math.sin(spread) * spd, life: 10 + Math.random() * 6, color, line: true });
  }
}
// 进球爆炸（原 onGoal 内联循环）
export function burst(x, y, extraColor, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 20, color: Math.random() < 0.5 ? '#FFE000' : extraColor });
  }
}

// ---------- 必杀特效：轨迹差异化 ----------
export function applyFxLaunch(b) {
  switch (b.fx) {
    case 'fire':     b.vx *= 1.05; b.vz *= 1.1; break;                    // 火球：高速高飘
    case 'tornado':  b.vx *= 1.02; b.curve += (Math.random() - 0.5) * 0.05; break;  // 龙卷风：大摆动
    case 'thunder':  b.vx *= 1.35; b.vz *= 0.7; break;                    // 闪电：极速低平
    case 'iron':     b.vx *= 0.85; b.vz *= 0.4; b.curve = 0; break;       // 铁球：沉重低平直飞
    case 'typhoon':  b.curve += (Math.random() - 0.5) * 0.07; break;      // 台风：剧烈弧线
    case 'phantom':  b.vx *= 1.1; break;                                  // 幻影：高速微摆
    case 'gold':     b.vz *= 1.15; break;                                 // 黄金：高弧
    case 'ice':      b.vx *= 0.92; b.vz *= 0.6; break;                    // 冰封：慢速低平
    case 'demon':    b.curve += (Math.random() - 0.5) * 0.06; b.vx *= 1.08; break;  // 恶魔：诡异弧线
    case 'bull':     b.vx *= 1.25; b.vz *= 0.85; break;                   // 斗牛：直线猛冲
    case 'tiger':    b.vz *= 1.3; break;                                  // 白虎：高弧扑击
    case 'jungle':   b.curve += (Math.random() - 0.5) * 0.05; break;      // 丛林：蛇形摆动
    case 'sun':      b.vx *= 1.05; b.vz *= 1.2; break;                    // 烈日：高弧
  }
}

// 飞行中轨迹修正：弧线类必杀持续摆动
export function updateFxTrail(b) {
  const p = b.fxPhase;
  switch (b.fx) {
    case 'tornado':  b.vy += Math.sin(p) * 0.5; break;
    case 'typhoon':  b.vy += Math.sin(p * 1.4) * 0.7; break;
    case 'phantom':  b.vy += Math.sin(p * 0.8) * 0.3; break;
    case 'jungle':   b.vy += Math.sin(p * 1.1) * 0.45; break;
    case 'demon':    b.vy += Math.sin(p * 1.6) * 0.6; break;
  }
}

export function updateFxParticles(b) {
  const x = b.x, y = b.y - b.z, t = b.fxPhase;
  switch (b.fx) {
    case 'fire':     // 火焰上飘
      particles.push({ x: x - 3 + Math.random() * 6, y: y + 2, vx: (Math.random() - 0.5) * 0.8, vy: -1.2 - Math.random(), life: 12 + Math.random() * 6, color: Math.random() < 0.5 ? '#FF6600' : '#FFD400', up: true });
      break;
    case 'tornado':  // 绿色旋风点
      particles.push({ x: x - 4 + Math.random() * 8, y: y - 4 + Math.random() * 8, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 10, color: '#39FF14' });
      break;
    case 'thunder':  // 闪电火花
      particles.push({ x: x - 2, y: y - 3 + Math.random() * 6, vx: -1 - Math.random() * 2, vy: (Math.random() - 0.5) * 1.5, life: 6, color: '#FFF200' });
      break;
    case 'iron':     // 铁屑
      particles.push({ x: x - 3 + Math.random() * 6, y: y - 2, vx: (Math.random() - 0.5) * 1, vy: (Math.random() - 0.5) * 1, life: 8, color: '#9AA0A6' });
      break;
    case 'typhoon':  // 青色风暴
      particles.push({ x: x - 5 + Math.random() * 10, y: y - 5 + Math.random() * 10, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 8, color: '#35C8FF' });
      break;
    case 'phantom':  // 白色残影
      particles.push({ x: x - 2, y: y - 2 + Math.random() * 4, vx: -0.5, vy: (Math.random() - 0.5) * 0.5, life: 9, color: '#FFFFFF' });
      break;
    case 'gold':     // 金色星星
      particles.push({ x: x - 4 + Math.random() * 8, y: y - 4 + Math.random() * 8, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 - 0.3, life: 14, color: '#FFE000', up: true });
      break;
    case 'ice':      // 冰晶
      particles.push({ x: x - 3 + Math.random() * 6, y: y - 3 + Math.random() * 6, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, life: 10, color: '#A8E4FF' });
      break;
    case 'demon':    // 暗紫魔焰
      particles.push({ x: x - 3 + Math.random() * 6, y: y + 1, vx: (Math.random() - 0.5) * 0.7, vy: -0.8 - Math.random() * 0.6, life: 11, color: '#B026FF', up: true });
      break;
    case 'bull':     // 红色冲击线
      particles.push({ x: x - 3, y: y - 4 + Math.random() * 8, vx: -1.5 - Math.random(), vy: (Math.random() - 0.5) * 1.2, life: 7, color: '#FF3333', line: true });
      break;
    case 'tiger':    // 虎纹白光
      particles.push({ x: x - 3 + Math.random() * 6, y: y - 3 + Math.random() * 6, vx: (Math.random() - 0.5) * 1, vy: (Math.random() - 0.5) * 1, life: 9, color: Math.random() < 0.5 ? '#FFFFFF' : '#FFB300' });
      break;
    case 'jungle':   // 绿叶
      particles.push({ x: x - 3 + Math.random() * 6, y: y - 2 + Math.random() * 4, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2, life: 9, color: '#2ECC40' });
      break;
    case 'sun':      // 橙色光芒
      particles.push({ x: x - 5 + Math.random() * 10, y: y - 5 + Math.random() * 10, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2, life: 10, color: '#FF8C00' });
      break;
  }
}

function pushTrail(b) {
  trail.push({ x: b.x, y: b.y, life: 12 });
  if (trail.length > 14) trail.shift();
}

// ---------- 每帧推进 ----------
// 粒子 + 轨迹 + 屏震衰减（原 updateParticles）
export function tickParticles() {
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    if (p.up) p.vy -= 0.05;      // 上飘粒子（火焰/魔焰）
    else p.vy += 0.06;
    p.life--;
  }
  particles = particles.filter(p => p.life > 0);
  for (const t of trail) t.life--;
  trail = trail.filter(t => t.life > 0);
  if (shake > 0) shake = Math.max(0, shake - 0.35);
}

// 原主循环 update(dt) 末尾的无条件块：计时器递减 + tickParticles
export function tickFX(dt) {
  if (flashTimer > 0) flashTimer -= dt;
  if (superCallout.timer > 0) superCallout.timer -= dt;
  if (shotMsgTimer > 0) shotMsgTimer -= dt;
  tickParticles();
}

// 必杀飞行轨迹记录（原 updateBall 末尾）
export function recordTrail(b) {
  if (!b.super) return;
  pushTrail(b);
}

// ---------- 渲染 ----------
export function getShake() { return shake; }

export function drawTrail(ctx, fxColor) {
  for (const t of trail) {
    ctx.fillStyle = t.life > 6 ? fxColor : 'rgba(255,255,255,0.3)';
    ctx.globalAlpha = t.life / 14;
    ctx.fillRect(Math.round(t.x) - 2, Math.round(t.y) - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

export function drawParticles(ctx) {
  for (const p of particles) {
    ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life / 40);
    if (p.line) {
      const len = Math.min(5, Math.hypot(p.vx, p.vy) * 1.5);
      const nx = p.vx / (Math.hypot(p.vx, p.vy) || 1), ny = p.vy / (Math.hypot(p.vx, p.vy) || 1);
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.round(nx * len) + 1, Math.round(ny * len) + 1);
    } else {
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

// 屏闪（原 render 尾部块）
export function drawFlash(ctx, vw, vh) {
  if (flashTimer <= 0) return;
  ctx.globalAlpha = Math.min(0.7, flashTimer * 1.4);
  ctx.fillStyle = flashColor; ctx.fillRect(0, 0, vw, vh);
  ctx.globalAlpha = 1;
}

// ---------- HUD 读取 ----------
export function getCallout() { return superCallout; }
export function getShotMsg() { return { text: shotMsg, color: shotMsgColor, timer: shotMsgTimer }; }
