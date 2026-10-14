// vfx.js —— 粒子特效系统
// 雪雾尾迹 / 收集爆闪 / 落地雪溅 / 换道侧喷 / 皮肤拖尾（彩虹·火焰·星辰）/ Fever 彩粒 / 雪崩雪块
// 固定粒子池（320）复用，池满丢弃（纯视觉冗余，不影响逻辑）。
import { ctx } from './canvas.js';
import * as C from './config.js';
import { game, player, proj, worldSize, elevOffset, laneWorldX, W, H } from './state.js';
import { getEquipColors, drawStarPath } from './skins.js';
import * as audio from './audio.js';

const MAX = 320;
const pool = [];
for (let i = 0; i < MAX; i++) {
  pool.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, r: 2, t: 0, dur: 0.6,
              color: '#fff', kind: 'puff', rot: 0, vr: 0 });
}
let cursor = 0;

function take() {
  for (let n = 0; n < MAX; n++) {
    const p = pool[cursor];
    cursor = (cursor + 1) % MAX;
    if (!p.on) { p.on = true; return p; }
  }
  return null;
}

function emit(kind, x, y, vx, vy, g, r, dur, color) {
  const p = take();
  if (!p) return;
  p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.g = g;
  p.r = r; p.dur = dur; p.t = dur; p.color = color;
  p.rot = Math.random() * Math.PI * 2;
  p.vr = (Math.random() - 0.5) * 7;
}

// ---- 拖尾/粒子颜色解析（支持特殊标记 rainbow / fire / star）----
function resolveColor(c, life) {
  if (c === 'rainbow') return 'hsl(' + ((performance.now() * 0.22 + life * 320) % 360) + ',95%,62%)';
  if (c === 'fire') return life > 0.66 ? '#fff3c4' : life > 0.33 ? '#ff9f43' : '#e74c3c';
  if (c === 'star') return life > 0.5 ? '#ffe066' : '#ffcf33';
  return c || '#ffffff';
}

// ---- 对外：世界坐标爆闪（收集物 / 护盾等，由 entities.js 调用）----
export function burstCoin(lane, z) {
  const p = proj(z, laneWorldX(lane));
  const s = worldSize(0.32, p.scale);
  const y = p.y - elevOffset(z) - s * 1.6;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 2 * i / 9 + Math.random() * 0.5;
    const sp = 60 + Math.random() * 90;
    emit(i % 3 === 0 ? 'star' : 'spark', p.x, y,
      Math.cos(a) * sp, Math.sin(a) * sp - 60, 240,
      s * (0.2 + Math.random() * 0.18), 0.45 + Math.random() * 0.25,
      i % 2 ? '#ffd34d' : '#fff3c4');
  }
  emit('flash', p.x, y, 0, 0, 0, s * 1.6, 0.22, '#fff3c4');
}

export function burstStar(lane, z) {
  const p = proj(z, laneWorldX(lane));
  const s = worldSize(0.4, p.scale);
  const y = p.y - elevOffset(z) - s * 1.8;
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const sp = 90 + Math.random() * 130;
    emit(i % 2 ? 'star' : 'spark', p.x, y,
      Math.cos(a) * sp, Math.sin(a) * sp, 300,
      s * (0.22 + Math.random() * 0.2), 0.55 + Math.random() * 0.3,
      i % 3 ? '#ffd34d' : '#ffffff');
  }
  emit('flash', p.x, y, 0, 0, 0, s * 2.2, 0.28, '#ffe066');
}

export function burstSparkle(lane, z, color) {
  const p = proj(z, laneWorldX(lane));
  const s = worldSize(0.5, p.scale);
  const y = p.y - elevOffset(z) - s;
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * 2 * i / 10;
    const sp = 70 + Math.random() * 80;
    emit('spark', p.x, y,
      Math.cos(a) * sp, Math.sin(a) * sp - 40, 200,
      s * (0.18 + Math.random() * 0.14), 0.45 + Math.random() * 0.25, color);
  }
  emit('flash', p.x, y, 0, 0, 0, s * 1.8, 0.22, color);
}

// ---- 对外：屏幕坐标雪雾（render / 其他模块可调）----
export function puffScreen(x, y, n, spread, up) {
  for (let i = 0; i < n; i++) {
    emit('puff', x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 90, -(up || 50) * (0.5 + Math.random()), -60,
      3 + Math.random() * 5, 0.4 + Math.random() * 0.3, '#ffffff');
  }
}

// ---- 每帧更新（含自动触发的行为特效）----
let prevJump = 0, prevFall = 0;

export function update(dt) {
  // 1) 粒子物理
  for (const p of pool) {
    if (!p.on) continue;
    p.t -= dt;
    if (p.t <= 0) { p.on = false; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    p.rot += p.vr * dt;
  }

  if (game.state !== 'playing' || game.countT > 0) { prevJump = player.jump; return; }

  const eq = getEquipColors();
  const base = proj(C.PLAYER_Z, player.x);
  const s = worldSize(1, base.scale);
  const groundY = base.y - elevOffset(C.PLAYER_Z);
  const speedK = 0.5 + Math.min(1.5, game.speed / C.SPEED_MAX);
  const air = player.jump > 0 || game.rocketT > 0;

  // 2) 滑行尾迹（贴地时；皮肤拖尾色；高速时更浓）
  if (!air && !game.ridingTrain) {
    const rate = 0.5 + speedK * 0.5;
    if (Math.random() < 0.8 * rate) {
      const special = (eq.trail === 'rainbow' || eq.trail === 'fire' || eq.trail === 'star');
      emit(special ? (eq.trail === 'star' ? 'star' : 'spark') : 'puff',
        base.x + (Math.random() - 0.5) * s * 0.55, groundY - Math.random() * s * 0.08,
        (Math.random() - 0.5) * 26 * (0.6 + speedK), -(26 + Math.random() * 42) * speedK, -40,
        s * (special ? 0.085 : 0.09 + Math.random() * 0.13) * (0.7 + speedK * 0.5),
        0.4 + Math.random() * 0.3, eq.trail || '#ffffff');
    }
  }

  // 3) 落地雪溅（jump 由正转零）：更强雪溅 + 落地音效
  if (prevJump > 0 && player.jump <= 0 && !game.ridingTrain) {
    const power = Math.min(1, prevJump / Math.max(0.3, player.jumpDur));
    puffScreen(base.x, groundY, 10 + Math.round(power * 10), s * (0.9 + power * 0.5), 70 + power * 50);
    audio.sfxLand(power);
  }
  prevJump = player.jump;

  // 3.5) 摔倒扑雪（fallT 由零转正）
  if (prevFall <= 0 && game.fallT > 0) {
    puffScreen(base.x, groundY, 16, s * 1.3, 80);
  }
  prevFall = game.fallT;

  // 4) 换道侧喷 + 高速压弯连续扬雪（倾斜期板尾方向喷雪，压弯越深越浓）
  if (Math.abs(player.tilt) > 0.35 && !air && !game.ridingTrain) {
    const dir = Math.sign(player.tilt);
    const carveK = Math.min(1, (Math.abs(player.tilt) - 0.35) / 0.5) * speedK;
    const n = 1 + Math.round(carveK * 2);
    for (let i = 0; i < n; i++) {
      emit('puff', base.x - dir * s * 0.5, groundY - s * 0.04,
        -dir * (60 + Math.random() * 60), -(30 + Math.random() * 50), -50,
        s * (0.1 + Math.random() * 0.12), 0.35 + Math.random() * 0.2, '#ffffff');
    }
  }

  // 5) Fever 彩粒环绕
  if (game.feverT > 0 && Math.random() < 0.7) {
    const hues = ['#ffd34d', '#ff9f43', '#55efc4', '#74b9ff', '#fd79a8'];
    emit('spark', base.x + (Math.random() - 0.5) * s * 1.3,
      groundY - Math.random() * s * 1.2,
      (Math.random() - 0.5) * 40, -(50 + Math.random() * 70), -30,
      s * 0.08, 0.5 + Math.random() * 0.3,
      hues[Math.floor(Math.random() * hues.length)]);
  }

  // 6) 传说角色 aura 微光
  if (eq.charRarity === 2 && Math.random() < 0.35) {
    emit('spark', base.x + (Math.random() - 0.5) * s * 1.1,
      groundY - s * (0.2 + Math.random() * 1.0),
      (Math.random() - 0.5) * 24, -(26 + Math.random() * 34), -24,
      s * 0.07, 0.5 + Math.random() * 0.3, 'rainbow');
  }

  // 7) 雪崩已移除，保留结构空位
}

// ---- 绘制 ----
export function draw() {
  ctx.save();
  for (const p of pool) {
    if (!p.on) continue;
    const life = p.t / p.dur;
    if (p.kind === 'puff') {
      ctx.globalAlpha = life * 0.8;
      ctx.fillStyle = resolveColor(p.color, life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1.7 - life * 0.7), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.globalAlpha = Math.min(1, life * 1.5);
      ctx.strokeStyle = resolveColor(p.color, life);
      ctx.lineWidth = Math.max(1, p.r * 0.9);
      ctx.lineCap = 'round';
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const len = sp * 0.035 + p.r;
      const nx = p.vx / sp, ny = p.vy / sp;
      ctx.beginPath();
      ctx.moveTo(p.x - nx * len * 0.5, p.y - ny * len * 0.5);
      ctx.lineTo(p.x + nx * len * 0.5, p.y + ny * len * 0.5);
      ctx.stroke();
    } else if (p.kind === 'star') {
      ctx.globalAlpha = Math.min(1, life * 1.5);
      ctx.fillStyle = resolveColor(p.color, life);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      drawStarPath(0, 0, p.r * (0.9 + life * 0.5), p.r * 0.42);
      ctx.restore();
    } else if (p.kind === 'chunk') {
      ctx.globalAlpha = Math.min(1, life * 1.6);
      ctx.fillStyle = '#ffffff';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'flash') {
      ctx.globalAlpha = life * 0.9;
      const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      rg.addColorStop(0, resolveColor(p.color, 1));
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
