// render.js —— 全部绘制：场景 / 玩家 / 障碍 / 特效 / 雪崩（含遮挡排序）+ HUD 节流
import { ctx } from './canvas.js';
let G = ctx; // 可切换绘制上下文：默认真实 ctx，背景缓存时切到离屏 bctx
import * as C from './config.js';
import {
  game, player, world, W, H, proj, worldSize, laneWorldX, horizonY, elevOffset, trackSlope, roadScale, baseHorizonY,
} from './state.js';
import { getEquipColors, getMode, paintPattern, drawStarPath } from './skins.js';
import * as vfx from './vfx.js';
import * as snowfight from './snowfight.js';

// ---- 颜色明暗工具（hex × k，k>1 提亮 / k<1 压暗）----
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.max(0, Math.round(r * k)));
  g = Math.min(255, Math.max(0, Math.round(g * k)));
  b = Math.min(255, Math.max(0, Math.round(b * k)));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// ---- 障碍/道具通用视觉语言：与玩家/场景一致的精致度 ----
// 统一：左/上受光渐变、圆角立体、描边轮廓、上缘高光、地面投影
function entityShadow(x, y, rx, ry) {
  G.fillStyle = 'rgba(80,120,150,0.2)';
  G.beginPath(); G.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); G.fill();
}
// 垂直光照渐变：顶部受光提亮 → 中部本色 → 底部背光压暗
function vGrad(x0, y0, x1, y1, col) {
  const g = G.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(col, 1.2));
  g.addColorStop(0.45, col);
  g.addColorStop(1, shade(col, 0.6));
  return g;
}
// 圆角矩形描边（统一轮廓线）
function strokeRound(x, y, w, h, r, lw) {
  G.strokeStyle = 'rgba(0,0,0,0.22)';
  G.lineWidth = lw || Math.max(1, (w + h) * 0.012);
  G.beginPath(); G.roundRect(x, y, w, h, r); G.stroke();
}
// 上缘高光带（立体感关键细节）
function topHi(x, y, w, h) {
  G.fillStyle = 'rgba(255,255,255,0.5)';
  G.fillRect(x, y, w, Math.max(1, h));
}
// 廉价 1D 噪声（多频正弦叠加，范围约 [-1,1]，用于雪面大尺度缓坡起伏）
function n1(x) {
  return Math.sin(x) * 0.5 + Math.sin(x * 2.3 + 1.7) * 0.3 + Math.sin(x * 5.1 + 0.3) * 0.2;
}
// 雪面颗粒/结晶纹理 pattern（缓存），极低对比，消除"白漆平面"感
export function ensureGroundPattern() {
  if (world.groundPattern) return;
  const t = document.createElement('canvas');
  t.width = 180; t.height = 180;
  const tc = t.getContext('2d');
  tc.clearRect(0, 0, 180, 180);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 180, y = Math.random() * 180, r = Math.random() * 1.1 + 0.2;
    tc.fillStyle = Math.random() < 0.7
      ? 'rgba(255,255,255,' + (Math.random() * 0.5).toFixed(3) + ')'
      : 'rgba(150,182,214,' + (Math.random() * 0.22).toFixed(3) + ')';
    tc.beginPath(); tc.arc(x, y, r, 0, Math.PI * 2); tc.fill();
  }
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * 180, y = Math.random() * 180, r = Math.random() * 9 + 4;
    const rg = tc.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.10)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    tc.fillStyle = rg; tc.beginPath(); tc.arc(x, y, r, 0, Math.PI * 2); tc.fill();
  }
  world.groundPattern = tc.createPattern(t, 'repeat');
}

// ---- 静态天空缓存 ----
let skyCache = null;
export function rebuildSkyCache() {
  skyCache = document.createElement('canvas');
  skyCache.width = W; skyCache.height = H;
  const c = skyCache.getContext('2d');
  paintSky(c);
}

// ---- 世界背景：地面 + 两侧景物每帧连续重绘（平滑滚动，无整段缓存跳变）----
// 说明：早期为压 CPU 把(天空+地面+景物)整段按 4 单位分桶缓存，绘制时固定贴
// (0,0) → 背景在两次重建间冻住、每 ~0.6–1.2s 突跳 4 单位，景物越密/越不规则
// 越显卡顿。天空仍走 skyCache（静态、零成本），地面+景物改为每帧随 game.distance
// 重绘，滚动连续；shadowBlur 滥用与菜单态全量重绘等真·风扇根因此前已修，
// 本处去掉缓存不会复燃。
function drawWorld() {
  drawSky();
  drawDistantTrees();
  drawGround();
  drawScenery();
}

function paintSky(c) {
  // 用固定基准地平线绘制天空缓存：避免运行时 horizonY 随坡度动态变化导致缓存错位/抖动
  const hz = baseHorizonY();
  // 下方兜底填色（雾色，与天空底色一致）：运行时 horizonY 下压时地面起点低于天空底部，此处兜底防露 body 背景色
  c.fillStyle = '#eef8fd';
  c.fillRect(0, hz, W, H - hz);
  // 浅蓝晴空（治愈系柔和渐变）
  const g = c.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, '#a9def2');
  g.addColorStop(0.55, '#cdeefb');
  g.addColorStop(1, '#eef8fd');
  c.fillStyle = g;
  c.fillRect(0, 0, W, hz);
  // 冬日柔和太阳光（右上，淡暖光晕）
  const sx = W * 0.78, sy = hz * 0.26;
  const sg = c.createRadialGradient(sx, sy, 0, sx, sy, hz * 0.9);
  sg.addColorStop(0, 'rgba(255,252,235,0.85)');
  sg.addColorStop(0.18, 'rgba(255,248,220,0.4)');
  sg.addColorStop(1, 'rgba(255,248,220,0)');
  c.fillStyle = sg;
  c.fillRect(0, 0, W, hz);
  // 朦胧远山（柔和曲线 + 雪顶，远景淡）
  paintMountains(c, hz, 0.55, '#c6dcef', '#eaf5fc', 0.5, 1.6, 0.0);
  // 远处淡淡薄雾（盖在山脚，朦胧感）
  const mg = c.createLinearGradient(0, hz * 0.6, 0, hz);
  mg.addColorStop(0, 'rgba(238,248,255,0)');
  mg.addColorStop(1, 'rgba(238,248,255,0.8)');
  c.fillStyle = mg;
  c.fillRect(0, hz * 0.6, W, hz * 0.4);
  // 近处雪山（稍深，柔和曲线）
  paintMountains(c, hz, 0.72, '#a7c8e6', '#dcebf8', 0.72, 2.3, 1.3);
  // 柔和椭圆云
  c.fillStyle = 'rgba(255,255,255,0.7)';
  const clouds = [
    { x: 0.28, y: 0.24, rx: 0.13, ry: 0.05 },
    { x: 0.60, y: 0.16, rx: 0.17, ry: 0.06 },
    { x: 0.82, y: 0.30, rx: 0.10, ry: 0.04 },
  ];
  for (const cl of clouds) {
    c.beginPath();
    c.ellipse(cl.x * W, cl.y * hz, cl.rx * W, cl.ry * hz, 0, 0, Math.PI * 2);
    c.fill();
  }
}
// 柔和远山：平滑曲线 + 顶部雪冠渐变（低多边形之前的高质量版）
function paintMountains(c, hz, baseFrac, body, cap, amp, freq, phase) {
  const baseY = hz;
  c.beginPath();
  c.moveTo(0, baseY);
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const x = W * i / steps;
    const t = i / steps * Math.PI * 2 * freq + phase;
    const h = 0.10 + 0.16 * Math.sin(t) + 0.09 * Math.sin(t * 2.1 + 1) + 0.05 * Math.sin(t * 3.7 + 2);
    c.lineTo(x, baseY - h * hz * amp * baseFrac);
  }
  c.lineTo(W, baseY);
  c.closePath();
  const top = baseY - hz * amp * baseFrac * 0.4;
  const g = c.createLinearGradient(0, top, 0, baseY);
  g.addColorStop(0, cap);
  g.addColorStop(1, body);
  c.fillStyle = g;
  c.fill();
}
function drawSky() {
  if (skyCache) G.drawImage(skyCache, 0, 0, W, H);
  else { paintSky(G); }
}
// 远端松林剪影：落在地平线上、远山之前，两排由远及近逐渐变深变高，
// 补足"身处雪山森林"的环境纵深感（每帧随 horizonY 微动，自然视差）
function drawDistantTrees() {
  const baseY = horizonY();
  const rows = [
    { step: 30, minH: 9, maxH: 20, color: 'rgba(86,104,120,0.32)', yoff: 3 },
    { step: 23, minH: 15, maxH: 32, color: 'rgba(58,76,90,0.5)', yoff: 0 },
  ];
  for (const r of rows) {
    G.fillStyle = r.color;
    for (let x = -12; x <= W + 12; x += r.step) {
      const seed = Math.abs(Math.sin(x * 12.9898) * 43758.5453);
      const f = seed - Math.floor(seed);
      const h = r.minH + f * (r.maxH - r.minH);
      const w = h * 0.42;
      const px = x + (f - 0.5) * r.step * 0.5;
      const by = baseY + r.yoff;
      G.beginPath();
      G.moveTo(px - w / 2, by);
      G.lineTo(px, by - h);
      G.lineTo(px + w / 2, by);
      G.closePath();
      G.fill();
    }
  }
}

// ---- 雪地 ----
// 飘雪 3 层视差：far(远小慢直) / mid(中) / near(近大快斜) —— 近大远小纵深 + 高速近层增量
// layer: 0=far 1=mid 2=near；alpha/blur 按 layer 区分（drawSnow 中应用）
export function initSnow() {
  world.snow.length = 0;
  // far：多、小、慢、横向几乎不漂（远景静态感）
  for (let i = 0; i < 50; i++) {
    world.snow.push({ layer: 0, x: Math.random() * W, y: Math.random() * H,
      r: 0.6 + Math.random() * 0.9, sp: 14 + Math.random() * 16, drift: 3, alpha: 0.45 });
  }
  // mid：中
  for (let i = 0; i < 30; i++) {
    world.snow.push({ layer: 1, x: Math.random() * W, y: Math.random() * H,
      r: 1.3 + Math.random() * 1.1, sp: 32 + Math.random() * 22, drift: 9, alpha: 0.7 });
  }
  // near：少、大、快、斜飞（迎面风雪感）
  for (let i = 0; i < 16; i++) {
    world.snow.push({ layer: 2, x: Math.random() * W, y: Math.random() * H,
      r: 2.4 + Math.random() * 1.8, sp: 60 + Math.random() * 40, drift: 22, alpha: 0.95 });
  }
}
export function ensureSnowPattern() {
  if (world.snowPattern) return;
  const t = document.createElement('canvas');
  t.width = 220; t.height = 220;
  const tc = t.getContext('2d');
  tc.clearRect(0, 0, 220, 220);
  for (let i = 0; i < 2800; i++) {
    const x = Math.random() * 220, y = Math.random() * 220;
    const r = Math.random() * 1.5 + 0.3;
    tc.fillStyle = Math.random() < 0.76
      ? 'rgba(255,255,255,' + (Math.random() * 0.5).toFixed(3) + ')'
      : 'rgba(150,182,214,' + (Math.random() * 0.28).toFixed(3) + ')';
    tc.beginPath(); tc.arc(x, y, r, 0, Math.PI * 2); tc.fill();
  }
  for (let i = 0; i < 36; i++) {
    const x = Math.random() * 220, y = Math.random() * 220, r = Math.random() * 11 + 6;
    const rg = tc.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(205,224,242,0.10)');
    rg.addColorStop(1, 'rgba(205,224,242,0)');
    tc.fillStyle = rg; tc.beginPath(); tc.arc(x, y, r, 0, Math.PI * 2); tc.fill();
  }
  world.snowPattern = tc.createPattern(t, 'repeat');
}

function drawGround() {
  const hz = horizonY();

  // 1) 雪面基色：随坡度明暗 + 大尺度缓坡起伏（天然雪面光影，非公路平面）
  const bands = 56;
  const halfEdge = C.TRACK_EDGE * 1.35; // 雪面横向铺到边线外侧一点
  for (let i = bands; i >= 1; i--) {
    const z0 = C.Z_FAR * (i - 1) / bands;
    const z1 = C.Z_FAR * i / bands;
    const s0 = proj(z0, 0).scale, s1 = proj(z1, 0).scale;
    if (s0 < 0.001) continue;
    // 取中段坡度（世界坐标）决定明暗
    const wMid = game.distance + (z0 + z1) / 2;
    const slope = trackSlope(wMid);            // 正=上坡 负=下坡
    const kSlope = 1 + Math.max(-0.22, Math.min(0.22, -slope * 0.9));
    // 大尺度缓坡起伏（沿赛道长度的柔和亮暗漂移，打破"平面白漆"感）
    const drift = n1(wMid * 0.16) * 0.05 + n1(wMid * 0.06 + 4.0) * 0.035;
    const k = kSlope * (1 + drift);
    // 边缘 x（铺满较宽雪面）
    const pL0 = proj(z0, -halfEdge), pR0 = proj(z0, halfEdge);
    const pL1 = proj(z1, -halfEdge), pR1 = proj(z1, halfEdge);
    G.beginPath();
    G.moveTo(pL0.x, pL0.y);
    G.lineTo(pR0.x, pR0.y);
    G.lineTo(pR1.x, pR1.y);
    G.lineTo(pL1.x, pL1.y);
    G.closePath();
    // 基础雪色按远近微变 + 坡度明暗
    const near = Math.min(1, s0 * 1.6);
    const baseR = Math.round(214 + 41 * near);
    const baseG = Math.round(232 + 23 * near);
    const baseB = Math.round(248 + 7 * near);
    G.fillStyle = 'rgb(' + Math.min(255, baseR * k) + ',' + Math.min(255, baseG * k) + ',' + Math.min(255, baseB * k) + ')';
    G.fill();
  }

  // 2) 雪面大尺度光影漂移斑（柔和亮斑/暗斑，锚定世界坐标滚动，营造自然起伏）
  const driftStep = 3.2;
  const dStart = Math.floor(game.distance / driftStep) * driftStep;
  for (let az = dStart; az < game.distance + C.Z_FAR; az += driftStep) {
    const z = az - game.distance;
    if (z < 0.5) continue;
    const lateral = (hash(az * 2.31 + 1.7) - 0.5) * halfEdge * 1.5;
    const p = proj(z, lateral);
    if (p.scale < 0.004) continue;
    const radius = worldSize(2.6, p.scale);
    const light = hash(az * 3.11) > 0.5;
    const a = 0.05 + hash(az * 4.27) * 0.05;
    const col = light ? '255,255,255' : '140,175,210';
    const rg = G.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    rg.addColorStop(0, 'rgba(' + col + ',' + a.toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(' + col + ',0)');
    G.fillStyle = rg;
    G.beginPath(); G.ellipse(p.x, p.y, radius, radius * 0.5, 0, 0, Math.PI * 2); G.fill();
  }

  // 3) 雪面颗粒/结晶纹理（缓存 pattern，极低对比，消除"沥青平面"感）
  ensureGroundPattern();
  G.save();
  G.globalAlpha = 0.5;
  G.fillStyle = world.groundPattern;
  G.fillRect(0, hz, W, H - hz);
  G.restore();

  // 4) 横向雪浪纹（corduroy / 压雪机痕迹）：极淡 + 轻微起伏，读作"整理过的雪"而非尺规线
  const rippleN = 78;
  const rippleStep = C.Z_FAR / rippleN;
  const scroll = (game.distance) % rippleStep;
  for (let i = 1; i <= rippleN; i++) {
    const z = i * rippleStep - scroll;
    if (z < 0.5) continue;
    const p = proj(z, 0);
    if (p.scale < 0.004) continue;
    const pL = proj(z, -halfEdge), pR = proj(z, halfEdge);
    const t = i / rippleN;            // 0 远 1 近
    const a = (1 - t) * 0.16 * Math.min(1, p.scale * 1.5);
    const midX = (pL.x + pR.x) / 2;
    const midY = (pL.y + pR.y) / 2 + Math.sin(z * 1.3 + 0.5) * (1 - t) * 1.6;
    // 亮暗交替：压雪机沟槽的受光脊/背光沟（真实 corduroy 反光）
    const light = i % 2 === 0;
    G.strokeStyle = light
      ? 'rgba(255,255,255,' + (a * 0.8).toFixed(3) + ')'
      : 'rgba(140,172,205,' + a.toFixed(3) + ')';
    G.lineWidth = Math.max(1, (1 - t) * 1.5);
    G.beginPath();
    G.moveTo(pL.x, pL.y);
    G.quadraticCurveTo(midX, midY, pR.x, pR.y);
    G.stroke();
  }

  // 5) （车道走廊线已移除：连续雪坡 + 旗门才是滑雪，分道线是公路概念）
  const segN = 60;

  // 5b) 自然雪板凹槽（断续、低对比，读作滑雪者轨迹而非车道线）
  const grooveN = 9;
  for (let ti = -grooveN; ti <= grooveN; ti++) {
    const m = ti / (grooveN + 1);
    const wx = m * halfEdge * 0.92;
    const dark = hash(Math.abs(ti) * 3.7 + 0.8) > 0.5;
    const baseA = dark ? 0.10 : 0.13;
    G.strokeStyle = dark ? 'rgba(120,155,190,' + baseA + ')' : 'rgba(255,255,255,' + (baseA + 0.05) + ')';
    G.lineWidth = Math.max(1, W * 0.0016 * (1 - Math.abs(m) * 0.35));
    let started = false;
    for (let i = 0; i <= segN; i++) {
      const z = C.Z_FAR * i / segN;
      const segOn = hash(ti * 7.1 + i * 0.37) > 0.4;   // 断续：像真实雪板痕
      const bend = Math.sin(z * 0.5 + ti * 1.3) * 0.018;
      const p = proj(z, wx + bend);
      if (!segOn) { started = false; continue; }
      if (!started) { G.beginPath(); G.moveTo(p.x, p.y); started = true; }
      else G.lineTo(p.x, p.y);
    }
    if (started) G.stroke();
  }

  // 6) 雪堤：外侧堆起的雪垄 + 内侧阴影带 + 边线
  const leftEdge = [], rightEdge = [];
  for (let i = 0; i <= segN; i++) {
    const z = C.Z_FAR * i / segN;
    const pl = proj(z, -C.TRACK_EDGE);
    const pr = proj(z, C.TRACK_EDGE);
    leftEdge.push({ x: pl.x, y: pl.y });
    rightEdge.push({ x: pr.x, y: pr.y });
  }
  // 雪堤外侧雪垄（在边线更外侧堆一道亮雪脊）
  for (const side of [-1, 1]) {
    const arr = side > 0 ? rightEdge : leftEdge;
    G.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const px = arr[i].x + side * Math.max(1.5, arr[i].y * 0.01);
      if (i === 0) G.moveTo(px, arr[i].y - 2); else G.lineTo(px, arr[i].y - 2);
    }
    for (let i = arr.length - 1; i >= 0; i--) {
      G.lineTo(arr[i].x, arr[i].y);
    }
    G.closePath();
    G.fillStyle = 'rgba(255,255,255,0.9)';
    G.fill();
  }
  // 内侧阴影带（只在边线内侧加窄边，体现雪堤高度）
  for (const side of [-1, 1]) {
    const arr = side > 0 ? rightEdge : leftEdge;
    G.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const px = arr[i].x - side * Math.max(1.5, arr[i].y * 0.006);
      if (i === 0) G.moveTo(px, arr[i].y); else G.lineTo(px, arr[i].y);
    }
    for (let i = arr.length - 1; i >= 0; i--) {
      G.lineTo(arr[i].x, arr[i].y);
    }
    G.closePath();
    G.fillStyle = 'rgba(150,190,220,0.25)';
    G.fill();
    // 边线
    G.beginPath();
    for (let i = 0; i < arr.length; i++) {
      if (i === 0) G.moveTo(arr[i].x, arr[i].y); else G.lineTo(arr[i].x, arr[i].y);
    }
    G.strokeStyle = 'rgba(120,160,195,0.65)';
    G.lineWidth = 2;
    G.stroke();
  }

  // 6b) 赛道两侧橙色安全网（护栏立柱 + 斜拉网，真实滑雪赛道感；降低交叉线透明度去"公路护栏"感）
  const fenceSpacing = 1.35;
  const fenceScroll = (game.distance / C.DIST_SCALE) % fenceSpacing;
  const fenceCount = Math.ceil(C.Z_FAR / fenceSpacing) + 1;
  for (const side of [-1, 1]) {
    for (let k = 0; k < fenceCount; k++) {
      const z = C.Z_FAR - fenceScroll - k * fenceSpacing;
      if (z < 1 || z > C.Z_FAR) continue;
      const fenceX = side * (C.TRACK_EDGE + 0.36);
      const pBase = proj(z, fenceX);
      const scale = pBase.scale;
      if (scale < 0.003) continue;
      const h = worldSize(0.36, scale);
      const w = worldSize(0.05, scale);
      // 立柱
      G.fillStyle = '#d8432b';
      G.fillRect(pBase.x - w / 2, pBase.y - h - elevOffset(z), w, h);
      // 顶球
      G.fillStyle = '#ff6b55';
      G.beginPath(); G.arc(pBase.x, pBase.y - h - elevOffset(z), w * 0.55, 0, Math.PI * 2); G.fill();
      // 与上一根立柱拉网（横向 + 斜交叉）
      const zPrev = z + fenceSpacing;
      const pPrev = proj(zPrev, fenceX);
      const hPrev = worldSize(0.36, pPrev.scale);
      const topY = pBase.y - h - elevOffset(z);
      const topYp = pPrev.y - hPrev - elevOffset(zPrev);
      const botY = pBase.y - h * 0.08 - elevOffset(z);
      const botYp = pPrev.y - hPrev * 0.08 - elevOffset(zPrev);
      G.strokeStyle = 'rgba(240,100,60,0.55)';
      G.lineWidth = Math.max(1, scale * 1.0);
      // 上下横线
      G.beginPath(); G.moveTo(pBase.x, topY); G.lineTo(pPrev.x, topYp); G.stroke();
      G.beginPath(); G.moveTo(pBase.x, botY); G.lineTo(pPrev.x, botYp); G.stroke();
      // 交叉斜线（更淡，弱化护栏感）
      G.strokeStyle = 'rgba(240,100,60,0.38)';
      G.lineWidth = Math.max(0.8, scale * 0.8);
      G.beginPath(); G.moveTo(pBase.x, topY); G.lineTo(pPrev.x, botYp); G.stroke();
      G.beginPath(); G.moveTo(pPrev.x, topYp); G.lineTo(pBase.x, botY); G.stroke();
    }
  }

  // 7) 地平线处雪面雾化收口（让远处与天柔和衔接）
  const fg = G.createLinearGradient(0, hz - 10, 0, hz + 60);
  fg.addColorStop(0, 'rgba(220,239,251,0.9)');
  fg.addColorStop(0.5, 'rgba(234,246,255,0.5)');
  fg.addColorStop(1, 'rgba(238,247,255,0)');
  G.fillStyle = fg;
  G.fillRect(0, hz - 10, W, 70);
}

// ---- 两侧纵深参照物（松树，强化透视与速度感）----
function hash(n) { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); }

function drawPine(x, groundY, s) {
  // 影子
  G.fillStyle = 'rgba(80,120,150,0.18)';
  G.beginPath(); G.ellipse(x, groundY, Math.max(0.01, s * 0.42), Math.max(0.01, s * 0.12), 0, 0, Math.PI * 2); G.fill();
  // 树干（渐变）
  const tg = G.createLinearGradient(x - s * 0.06, 0, x + s * 0.06, 0);
  tg.addColorStop(0, '#8a6238');
  tg.addColorStop(1, '#6b4a28');
  G.fillStyle = tg;
  G.fillRect(x - s * 0.06, groundY - s * 0.26, s * 0.12, s * 0.26);
  // 三层树冠（左受光右背光）
  for (let i = 0; i < 3; i++) {
    const cy = groundY - s * (0.24 + i * 0.26);
    const hw = s * (0.52 - i * 0.13);
    const h = s * 0.5;
    const g = G.createLinearGradient(x - hw, cy - h, x + hw, cy);
    g.addColorStop(0, '#43926a');
    g.addColorStop(1, '#245941');
    G.fillStyle = g;
    G.beginPath();
    G.moveTo(x - hw, cy);
    G.lineTo(x, cy - h);
    G.lineTo(x + hw, cy);
    G.closePath();
    G.fill();
    // 斜坡挂雪
    if (i > 0) {
      G.strokeStyle = 'rgba(255,255,255,0.75)';
      G.lineWidth = Math.max(1.2, s * 0.05);
      G.lineCap = 'round';
      G.beginPath();
      G.moveTo(x - hw * 0.88, cy - h * 0.1);
      G.lineTo(x, cy - h * 0.62);
      G.lineTo(x + hw * 0.88, cy - h * 0.1);
      G.stroke();
    }
  }
  // 顶部雪帽（加厚）
  G.fillStyle = 'rgba(255,255,255,0.95)';
  G.beginPath();
  G.moveTo(x - s * 0.2, groundY - s * 0.8);
  G.lineTo(x, groundY - s * 1.06);
  G.lineTo(x + s * 0.2, groundY - s * 0.8);
  G.closePath();
  G.fill();
}

function drawScenery() {
  // 远处林线（depth layer）：更密、更小、偏蓝雾化，形成自然森林纵深
  drawFarForest();
  // 近景独立散布：左右两侧各自按绝对世界 z 随机疏密，避免左右同步的机械节奏
  const U = 2.6;
  const startAz = Math.floor(game.distance / U) * U;
  for (let az = startAz; az < game.distance + C.Z_FAR; az += U) {
    for (const side of [-1, 1]) {
      const baseSeed = hash(az * 0.137 + (side > 0 ? 41.7 : 0));
      if (baseSeed < 0.42) continue;            // 部分槽位留空 → 不规则疏密
      const z = az - game.distance + (hash(az * 0.91 + side * 5.3) - 0.5) * U; // 槽位内 z 抖动
      if (z < 0.5 || z > C.Z_FAR) continue;
      const r1 = hash(az * 1.37 + side * 3.1);
      const r2 = hash(az * 2.11 + side * 5.3);
      const r3 = hash(az * 3.77 + side * 7.9);
      const lateral = C.TRACK_EDGE + 0.4 + r1 * 1.6;   // 距边 0.4~2.0
      const pp = proj(z, side * lateral);
      if (pp.x < -20 || pp.x > W + 20) continue;
      const s = worldSize(0.9, pp.scale) * (0.7 + r2 * 0.7);  // 个体大小差异
      G.globalAlpha = Math.min(1, pp.scale * 2.6);
      const gy = pp.y - elevOffset(z);
      if (r3 < 0.16) drawRock(pp.x, gy, s * 0.85);     // 偶发雪石
      else drawPine(pp.x, gy, s);
    }
  }
  G.globalAlpha = 1;
}

// 远处雾化林线：密集小松剪影，偏蓝融入雪雾，营造森林纵深（不抢近景）
function drawFarForest() {
  const U = 1.6;
  const startAz = Math.floor(game.distance / U) * U;
  for (let az = startAz; az < game.distance + C.Z_FAR; az += U) {
    for (const side of [-1, 1]) {
      const z = az - game.distance + (hash(az * 0.53 + side * 2.2) - 0.5) * U;
      if (z < 1 || z > C.Z_FAR) continue;
      const r = hash(az * 1.9 + side * 4.4);
      const lateral = C.TRACK_EDGE + 2.6 + r * 3.2;   // 远在雪堤之外
      const pp = proj(z, side * lateral);
      if (pp.x < -20 || pp.x > W + 20) continue;
      const s = worldSize(1.05, pp.scale) * (0.5 + hash(az * 3.3 + side) * 0.5);
      G.globalAlpha = Math.min(0.82, pp.scale * 2.2);
      drawFarPine(pp.x, pp.y - elevOffset(z), s);
    }
  }
  G.globalAlpha = 1;
}
// 雾化远松：偏蓝灰剪影，无雪帽，融入地平线雪雾
function drawFarPine(x, groundY, s) {
  G.fillStyle = 'rgba(150,176,192,0.95)';
  G.fillRect(x - s * 0.03, groundY - s * 0.2, s * 0.06, s * 0.2);
  for (let i = 0; i < 3; i++) {
    const cy = groundY - s * (0.18 + i * 0.22);
    const hw = s * (0.4 - i * 0.1);
    const h = s * 0.4;
    G.beginPath();
    G.moveTo(x - hw, cy);
    G.lineTo(x, cy - h);
    G.lineTo(x + hw, cy);
    G.closePath();
    G.fill();
  }
}
// 雪石：灰岩本体 + 顶部积雪，丰富近景植被之外的地貌
function drawRock(x, groundY, s) {
  G.fillStyle = 'rgba(80,120,150,0.2)';
  G.beginPath(); G.ellipse(x, groundY, s * 0.5, s * 0.14, 0, 0, Math.PI * 2); G.fill();
  const g = G.createLinearGradient(x - s * 0.4, 0, x + s * 0.4, 0);
  g.addColorStop(0, '#7c828a');
  g.addColorStop(1, '#565c63');
  G.fillStyle = g;
  G.beginPath();
  G.moveTo(x - s * 0.42, groundY);
  G.lineTo(x - s * 0.34, groundY - s * 0.42);
  G.lineTo(x - s * 0.08, groundY - s * 0.62);
  G.lineTo(x + s * 0.2, groundY - s * 0.5);
  G.lineTo(x + s * 0.4, groundY - s * 0.18);
  G.lineTo(x + s * 0.4, groundY);
  G.closePath();
  G.fill();
  // 顶部积雪
  G.fillStyle = 'rgba(255,255,255,0.92)';
  G.beginPath();
  G.moveTo(x - s * 0.34, groundY - s * 0.42);
  G.lineTo(x - s * 0.08, groundY - s * 0.62);
  G.lineTo(x + s * 0.2, groundY - s * 0.5);
  G.lineTo(x + s * 0.08, groundY - s * 0.36);
  G.lineTo(x - s * 0.14, groundY - s * 0.4);
  G.closePath();
  G.fill();
}

// ---- 飞鸟（天空点缀，缓慢横移 + 振翅）----
const birds = [
  { x: 0.12, y: 0.18, sp: 0.014, s: 1.6 },
  { x: 0.55, y: 0.10, sp: 0.009, s: 1.2 },
  { x: 0.78, y: 0.22, sp: 0.018, s: 1.4 },
  { x: 0.35, y: 0.30, sp: 0.012, s: 0.9 },
];
function drawBirds() {
  const hz = horizonY();
  const t = performance.now();
  G.strokeStyle = 'rgba(40,60,90,0.85)';
  G.lineWidth = 2.6;
  G.lineCap = 'round';
  for (const b of birds) {
    const bx = (((b.x + t * 0.000001 * b.sp * 1000) % 1.25) - 0.12) * W;
    const by = b.y * hz + Math.sin(t / 700 + b.x * 30) * 4;
    const flap = Math.sin(t / 170 + b.x * 20);
    const w = 12 * b.s;
    const hh = (3.5 + flap * 5) * b.s;
    G.beginPath();
    G.moveTo(bx - w, by);
    G.quadraticCurveTo(bx - w * 0.35, by - hh, bx, by);
    G.quadraticCurveTo(bx + w * 0.35, by - hh, bx + w, by);
    G.stroke();
  }
}

// ---- 玩家身后雪板滑痕（双板两条 / 单板一条，透视收向地平线）----
// ---- 玩家雪痕：真实滑行轨迹（身后跟随，转弯弯曲，压弯加深，腾空断开）----
function drawPlayerSkiTracks() {
  if (game.state !== 'playing') return;
  const tr = world.trail;
  if (tr.length < 2) return;
  const skiMode = (getMode() === 'ski');

  // 收集有效投影点（z>0 的历史点可见；z≤-0.9 越过相机丢弃）
  const pts = [];
  for (let i = 0; i < tr.length; i++) {
    const t = tr[i];
    if (t.brk) { pts.push(null); continue; }
    const z = C.PLAYER_Z - (game.distance - t.s);
    if (z < -0.9 || z > C.PLAYER_Z) { pts.push(null); continue; }
    pts.push({ z, w: t.w, x: t.x });
  }

  // 逐段画（支持断点 + 近深远浅 + 压弯加宽加深）
  G.lineCap = 'round';
  const lanes = skiMode ? [-C.TRAIL_SKI_OFF, C.TRAIL_SKI_OFF] : [0];
  for (const laneOff of lanes) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (!a || !b) continue;
      const pa = proj(a.z, a.x + laneOff);
      const pb = proj(b.z, b.x + laneOff);
      const sc = (pa.scale + pb.scale) * 0.5;
      const fresh = b.z / C.PLAYER_Z;                      // 越接近玩家越新鲜
      const carve = Math.max(a.w, b.w);                    // 压弯强度
      const alpha = (0.14 + 0.34 * fresh) * (1 + carve * 0.5);
      const wWorld = (skiMode ? C.TRAIL_SKI_W : C.TRAIL_BOARD_W) * (1 + carve * 0.8);
      G.strokeStyle = 'rgba(148,168,190,' + Math.min(0.7, alpha).toFixed(3) + ')';
      G.lineWidth = Math.max(1.5, worldSize(wWorld, sc));
      G.beginPath();
      G.moveTo(pa.x, pa.y);
      G.lineTo(pb.x, pb.y);
      G.stroke();
    }
  }
  // 玩家脚下最新鲜一截（从最新点到当前脚下）
  const lastT = tr[tr.length - 1];
  if (lastT && !lastT.brk) {
    const base = proj(C.PLAYER_Z, player.x);
    const lastZ = C.PLAYER_Z - (game.distance - lastT.s);
    if (lastZ < C.PLAYER_Z - 0.05 && lastZ > -0.9) {
      const pl = proj(lastZ, lastT.x);
      for (const laneOff of lanes) {
        const p2 = proj(lastZ, lastT.x + laneOff);
        G.strokeStyle = 'rgba(148,168,190,0.62)';
        G.lineWidth = Math.max(1.5, worldSize(skiMode ? C.TRAIL_SKI_W : C.TRAIL_BOARD_W, (pl.scale + base.scale) * 0.5));
        G.beginPath();
        G.moveTo(p2.x, p2.y);
        G.lineTo(base.x + laneOff * roadScale() * base.scale, base.y);
        G.stroke();
      }
    }
  }
}

// ---- 雪面车速流线（速度感：纵向径向放射 —— 消失点在地平线，线条向脚下/两侧甩，匹配滑雪纵深运动）----
function drawSpeedFlowLines() {
  if (game.state !== 'playing' || game.countT > 0) return;
  const speedK = Math.min(1, game.speed / Math.min(C.SPEED_MAX_CAP, C.SPEED_MAX + (game.distance / 100) * C.SPEED_RAMP_PER_100M));
  if (speedK < 0.22) return;
  const base = proj(C.PLAYER_Z, player.x);
  const s = worldSize(1, base.scale);
  const off = ((game.distance * 0.55) % 1.5) / 1.5;
  // 消失点：地平线中心略下（玩家前方赛道消失处），线条从此处向屏幕底部+两侧放射
  const vpX = base.x;
  const vpY = horizonY() + (H - horizonY()) * 0.06;
  const maxLen = (H - vpY) * 1.05;
  G.strokeStyle = 'rgba(255,255,255,0.9)';
  G.lineCap = 'round';
  // 线条数量随速度增加（动量感：越快掠过的雪面流纹越多）
  const n = 9 + Math.round(speedK * 9);
  // 下半圆扇形角度（从右下经正下到左下）：运动方向是往前/往下扎，不盖天空
  const ang0 = Math.PI * 0.18, ang1 = Math.PI * 0.82;
  for (let i = 0; i < n; i++) {
    const t = (off + i / n) % 1;
    // 角度均匀分布 + 微抖动，避免完全对称显机械
    const ang = ang0 + (ang1 - ang0) * (i / Math.max(1, n - 1)) + (Math.sin(i * 12.9) * 0.04);
    // 线条从 vp 出发往外延伸：t 越大越近越粗越亮（迎面而来感）
    const len = maxLen * (0.18 + t * 0.95) * (0.7 + 0.3 * speedK);
    const ex = vpX + Math.cos(ang) * len;
    const ey = vpY + Math.sin(ang) * len;
    // 中段最亮（刚出现淡→中段亮→末段淡出），近处更粗
    const fade = 1 - Math.abs(t - 0.55) * 1.8;
    G.globalAlpha = Math.max(0, fade) * 0.8 * speedK;
    G.lineWidth = Math.max(1.2, s * 0.03 * (0.5 + t * 0.9));
    G.beginPath();
    G.moveTo(vpX + Math.cos(ang) * len * 0.15, vpY + Math.sin(ang) * len * 0.15);
    G.lineTo(ex, ey);
    G.stroke();
  }
  G.globalAlpha = 1;

  // 高速速度感：屏幕边缘径向流光（视觉替代音效，越接近速度上限越明显）
  if (speedK > 0.6) {
    const v = (speedK - 0.6) / 0.4;
    const g = G.createRadialGradient(W / 2, H * 0.62, H * 0.25, W / 2, H * 0.62, H * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(200,230,255,' + (0.18 * v).toFixed(3) + ')');
    G.fillStyle = g;
    G.fillRect(0, 0, W, H);
  }
}

function drawSnow() {
  for (const p of world.snow) {
    G.globalAlpha = p.alpha != null ? p.alpha : 0.85;
    G.fillStyle = '#ffffff';
    G.beginPath();
    G.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    G.fill();
  }
  G.globalAlpha = 1;
}

// ---- 雪崩 v2（节日式：半透明雪雾墙从屏幕底部涌起，最高 30% 屏高，绝不遮挡前方赛道）----
function drawAvalanche() {
  if (game.avaGap >= 14) return;                          // 平时隐身（gap=18 画面外）
  const nearness = Math.min(1, (14 - game.avaGap) / 10);  // 0..1 越近越凶
  const wallH = H * (0.10 + 0.20 * nearness);             // 最高 30% 屏高
  const topY = H - wallH;
  const t = performance.now();
  const seg = 14;

  // 深层阴影（厚度感）
  G.fillStyle = 'rgba(160,190,220,0.30)';
  G.beginPath();
  G.moveTo(0, H); G.lineTo(0, topY + 42);
  for (let i = 0; i <= seg; i++) {
    const wx = W * i / seg;
    const wy = topY + 42 + Math.sin(i * 0.9 + t / 300) * 8;
    G.lineTo(wx, wy);
  }
  G.lineTo(W, H); G.closePath(); G.fill();

  // 主体雪雾（半透明渐变，波浪顶缘）
  const g = G.createLinearGradient(0, topY - 30, 0, H);
  g.addColorStop(0, 'rgba(240,248,255,0)');
  g.addColorStop(0.3, 'rgba(240,248,255,' + (0.4 + 0.3 * nearness).toFixed(2) + ')');
  g.addColorStop(1, 'rgba(228,240,251,' + (0.85 + 0.15 * nearness).toFixed(2) + ')');
  G.fillStyle = g;
  G.beginPath();
  G.moveTo(0, H); G.lineTo(0, topY + 24);
  for (let i = 0; i <= seg; i++) {
    const wx = W * i / seg;
    const wy = topY + Math.sin(i * 1.1 + t / 260) * 10 + Math.sin(i * 2.3 - t / 170) * 6;
    G.lineTo(wx, wy);
  }
  G.lineTo(W, H); G.closePath(); G.fill();

  // 前沿翻滚雪球
  for (let i = 0; i < 9; i++) {
    const wx = (i + 0.5) * W / 9 + Math.sin(t / 300 + i * 2.2) * 18;
    const wy = topY + 16 + Math.sin(t / 210 + i * 1.7) * 12;
    G.fillStyle = i % 2 ? 'rgba(255,255,255,0.95)' : 'rgba(230,241,251,0.9)';
    G.beginPath(); G.arc(wx, wy, 13 + 20 * nearness, 0, Math.PI * 2); G.fill();
  }

  // 冲击波期间：顶部警告横幅
  if (game.surgeT > 0) {
    G.save();
    G.font = 'bold 28px sans-serif';
    G.textAlign = 'center';
    G.fillStyle = 'rgba(255,70,70,0.92)';
    G.shadowColor = 'rgba(120,0,0,0.5)'; G.shadowBlur = 10;
    G.fillText('雪崩来了，别停！', W / 2, H * 0.16);
    G.restore();
  }
  // 危险红框（gap 极小才闪，平时不吵）
  if (game.avaGap < C.AVALANCHE_WARN_GAP + 1.5) {
    const a = 0.3 + 0.25 * Math.sin(performance.now() / 90);
    G.strokeStyle = 'rgba(255,60,60,' + a.toFixed(2) + ')';
    G.lineWidth = 6;
    G.strokeRect(3, 3, W - 6, H - 6);
  }
}

// ---- 玩家 ----
function drawSkier() {
  const col = getEquipColors();
  const mode = getMode();
  const base = proj(C.PLAYER_Z, player.x);
  const s = worldSize(C.PLAYER_SCALE, base.scale);
  let lift = 0;
  let spin = 0;                                    // 空中用真实旋转角，地面用压弯倾斜
  const jd = player.jumpDur || C.JUMP_DUR;
  if (player.jump > 0) {
    const prog = 1 - player.jump / jd;
    const arc = C.JUMP_ARCS[Math.min(player.jumps - 1, C.JUMP_ARCS.length - 1)];
    lift = s * (player.jumpStartH + Math.sin(prog * Math.PI) * arc);
  } else {
    player.jumpStartH = 0;
  }
  player.curH = lift / s;
  const crouching = player.crouch > 0;
  const tilt = player.tilt * 0.25;
  const groundY = base.y - elevOffset(C.PLAYER_Z);
  const x = base.x;
  if (game.rocketT > 0) lift += s * 0.6;
  let feetY = groundY - lift;
  if (game.ridingTrain) {
    const tp = proj(C.PLAYER_Z, player.x);
    const ts = worldSize(0.9, tp.scale);
    const tGround = tp.y - elevOffset(C.PLAYER_Z);
    feetY = tGround - ts * 1.15;
    lift = 0; spin = 0;
  }
  player.curH = lift / s;

  if (game.invincT > 0) {
    G.save();
    G.globalAlpha = 0.35 + 0.25 * Math.sin(performance.now() / 120);
    G.fillStyle = '#ffd34d';
    G.beginPath();
    G.ellipse(x, groundY - s * 0.5, s * 0.95, s * 1.1, 0, 0, Math.PI * 2);
    G.fill();
    G.restore();
  }
  // Fever 金色光环（呼吸）
  if (game.feverT > 0) {
    const fa = 0.28 + 0.14 * Math.sin(performance.now() / 100);
    const rg = G.createRadialGradient(x, feetY - s * 0.45, 0, x, feetY - s * 0.45, s * 1.15);
    rg.addColorStop(0, 'rgba(255,211,77,' + fa + ')');
    rg.addColorStop(1, 'rgba(255,211,77,0)');
    G.fillStyle = rg;
    G.beginPath();
    G.arc(x, feetY - s * 0.45, s * 1.15, 0, Math.PI * 2);
    G.fill();
  }
  G.fillStyle = 'rgba(80,120,150,' + (0.25 * (1 - Math.min(1, lift / (s * 0.95)) * 0.7)) + ')';
  G.beginPath();
  G.ellipse(x, groundY, Math.max(0.01, s * 0.55 * (1 - lift / (s * 2))), Math.max(0.01, s * 0.18), 0, 0, Math.PI * 2);
  G.fill();

  spin = 0;
  if (player.jump > 0) spin = player.airSpin;        // 空中：真实翻转角

  G.save();
  G.translate(x, feetY);
  if (game.fallT > 0) G.rotate(Math.PI / 2);
  else if (spin) G.rotate(spin);                   // 前/后空翻（整体旋转）
  else if (tilt) G.rotate(tilt);                   // 地面：压弯侧倾

  const bob = Math.sin(performance.now() / 130) * s * 0.03;
  G.translate(0, bob);
  const air = player.jump > 0 || game.rocketT > 0;
  // 整体重心前倾：滑雪姿态核心标志（背视下前倾 = 身体向下俯，明显压低）
  // 滑行时持续前倾，跳跃/火箭时拉平，蹲伏时更大幅前压
  const lean = air ? 0 : (crouching ? 0.22 : 0.13);
  G.rotate(lean);
  G.translate(0, -s * 0.04);

  const skiMode = (mode === 'ski');
  const t = performance.now();
  const spd = Math.min(1, game.speed / C.SPEED_MAX);
  const wind = Math.sin(t / 90) * (0.6 + spd * 0.8);
  const skiOff = s * 0.34, skiW = s * 0.40, skiLen = s * 1.35;
  const bodyBot = crouching ? -s * 0.34 : -s * 0.45;
  const bodyTopY = crouching ? -s * 0.62 : -s * 0.88;
  const headCY = bodyTopY - s * 0.18;          // 头压低贴近肩（前倾感）
  const hx = tilt * s * 0.2 + lean * s * 0.3;  // 头随前压前移

  // ---- 雪板 / 双板（薄荷青底色 + 紫色尾翼 + 几何暗纹 + 磨砂 + 固定器）----
  if (skiMode) {
    const wig = Math.sin(t / 110) * 0.12;
    const mint = col.board;
    const purple = col.boardPat2 || '#8A5CF6';
    for (const off of [-skiOff, skiOff]) {
      G.save();
      G.translate(off, -s * 0.16 + skiW * 0.5);
      G.rotate(wig);
      // 底部厚度阴影
      G.fillStyle = shade(mint, 0.5);
      G.beginPath();
      G.roundRect(-skiLen / 2 + 1, -skiW / 2 + skiW * 0.16, skiLen - 2, skiW, skiW * 0.5);
      G.fill();
      // 板体渐变
      const bg = G.createLinearGradient(0, -skiW / 2, 0, skiW / 2);
      bg.addColorStop(0, shade(mint, 1.2));
      bg.addColorStop(0.45, mint);
      bg.addColorStop(1, shade(mint, 0.68));
      G.beginPath();
      G.roundRect(-skiLen / 2, -skiW / 2, skiLen, skiW, skiW * 0.5);
      G.fillStyle = bg; G.fill();
      // 磨砂质感：规则微光点阵
      G.save(); G.clip();
      G.fillStyle = 'rgba(255,255,255,0.11)';
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 18; c++) {
          if ((r + c) % 3 !== 0) continue;
          const px = -skiLen / 2 + skiLen * (c + 0.5) / 18;
          const py = -skiW / 2 + skiW * (r + 0.5) / 6;
          G.fillRect(px, py, Math.max(1, s * 0.012), Math.max(1, s * 0.008));
        }
      }
      G.restore();
      // 几何暗纹：紫色三角 + 细折线
      G.save(); G.clip();
      G.strokeStyle = purple; G.lineWidth = Math.max(1, s * 0.018); G.globalAlpha = 0.42;
      for (let i = 0; i < 4; i++) {
        const tx = -skiLen * 0.35 + i * skiLen * 0.22;
        G.beginPath();
        G.moveTo(tx, -skiW * 0.15);
        G.lineTo(tx + skiW * 0.26, skiW * 0.04);
        G.lineTo(tx - skiW * 0.08, skiW * 0.16);
        G.closePath(); G.stroke();
        G.beginPath();
        G.moveTo(tx + skiLen * 0.05, -skiW * 0.24);
        G.lineTo(tx + skiLen * 0.13, -skiW * 0.08);
        G.stroke();
      }
      G.globalAlpha = 1;
      G.restore();
      // 轮廓描边
      G.strokeStyle = 'rgba(0,0,0,0.20)'; G.lineWidth = Math.max(1, s * 0.01); G.stroke();
      // 板刃上缘高光
      G.fillStyle = 'rgba(255,255,255,0.52)';
      G.fillRect(-skiLen / 2 + skiW * 0.15, -skiW / 2 + 1, skiLen - skiW * 0.3, Math.max(1, skiW * 0.13));
      // 紫色描边尾翼（板尾翘起）
      G.fillStyle = purple;
      G.strokeStyle = shade(purple, 0.72); G.lineWidth = Math.max(1, s * 0.015);
      G.beginPath();
      G.moveTo(skiLen / 2, -skiW / 2);
      G.quadraticCurveTo(skiLen / 2 + s * 0.18, -skiW / 2 - s * 0.14, skiLen / 2 + s * 0.06, -skiW / 2 + s * 0.03);
      G.lineTo(skiLen / 2, skiW / 2);
      G.closePath(); G.fill(); G.stroke();
      // 固定器：深色底座 + 紫色卡扣
      const bx = -skiW * 0.55, by = -skiW * 0.42, bw = skiW * 0.3, bh = skiW * 0.84;
      G.fillStyle = 'rgba(30,30,40,0.78)';
      G.fillRect(bx, by, bw, bh);
      G.fillStyle = purple;
      G.fillRect(bx + bw * 0.15, by + bh * 0.12, bw * 0.7, bh * 0.16);
      G.fillRect(bx + bw * 0.15, by + bh * 0.72, bw * 0.7, bh * 0.16);
      G.fillStyle = 'rgba(255,255,255,0.35)';
      G.fillRect(bx + bw * 0.2, by + bh * 0.38, bw * 0.6, bh * 0.24);
      G.restore();
    }
  } else {
    const boardX = -s * 0.55;
    const boardW = s * 1.1 + tilt * s * 0.3;
    const boardY = -s * 0.16;
    const boardH = s * 0.16;
    if (col.boardStyle === 'art') {
      // ---- 薄荷青·紫尾 单板（程序化高清绘制）----
      const mint = col.board;
      const purple = col.boardPat2 || '#8A5CF6';
      // 投影
      G.save();
      G.shadowColor = 'rgba(0,0,0,0.28)';
      G.shadowBlur = s * 0.08;
      G.shadowOffsetY = s * 0.02;
      // 底部厚度
      G.fillStyle = shade(mint, 0.5);
      G.beginPath();
      G.roundRect(boardX + 1, boardY + boardH * 0.16, boardW - 2, boardH, boardH * 0.5);
      G.fill();
      // 板体渐变
      const bg = G.createLinearGradient(0, boardY, 0, boardY + boardH);
      bg.addColorStop(0, shade(mint, 1.2));
      bg.addColorStop(0.45, mint);
      bg.addColorStop(1, shade(mint, 0.68));
      G.beginPath();
      G.roundRect(boardX, boardY, boardW, boardH, boardH * 0.5);
      G.fillStyle = bg; G.fill();
      G.restore();
      // 磨砂质感：规则微光点阵
      G.save();
      G.beginPath(); G.roundRect(boardX, boardY, boardW, boardH, boardH * 0.5); G.clip();
      G.fillStyle = 'rgba(255,255,255,0.12)';
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 22; c++) {
          if ((r + c) % 3 !== 0) continue;
          const px = boardX + boardW * (c + 0.5) / 22;
          const py = boardY + boardH * (r + 0.5) / 4;
          G.fillRect(px, py, Math.max(1, s * 0.012), Math.max(1, s * 0.008));
        }
      }
      // 几何暗纹：紫色三角 + 细折线
      G.strokeStyle = purple; G.lineWidth = Math.max(1, s * 0.018); G.globalAlpha = 0.4;
      for (let i = 0; i < 5; i++) {
        const tx = boardX + boardW * 0.12 + i * boardW * 0.18;
        G.beginPath();
        G.moveTo(tx, boardY + boardH * 0.32);
        G.lineTo(tx + boardH * 0.5, boardY + boardH * 0.55);
        G.lineTo(tx - boardH * 0.18, boardY + boardH * 0.7);
        G.closePath(); G.stroke();
        G.beginPath();
        G.moveTo(tx + boardW * 0.05, boardY + boardH * 0.2);
        G.lineTo(tx + boardW * 0.1, boardY + boardH * 0.36);
        G.stroke();
      }
      G.globalAlpha = 1;
      G.restore();
      // 轮廓描边
      G.strokeStyle = 'rgba(0,0,0,0.2)'; G.lineWidth = 1;
      G.beginPath(); G.roundRect(boardX, boardY, boardW, boardH, boardH * 0.5); G.stroke();
      // 板面上缘高光
      G.fillStyle = 'rgba(255,255,255,0.5)';
      G.fillRect(boardX + boardH * 0.5, boardY + 1, boardW - boardH, Math.max(1, boardH * 0.22));
      // 紫色描边尾翼（板尾翘起）
      G.fillStyle = purple;
      G.strokeStyle = shade(purple, 0.72); G.lineWidth = Math.max(1, s * 0.015);
      G.beginPath();
      G.moveTo(boardX + boardW, boardY);
      G.quadraticCurveTo(boardX + boardW + s * 0.18, boardY - s * 0.14, boardX + boardW + s * 0.06, boardY + s * 0.03);
      G.lineTo(boardX + boardW, boardY + boardH);
      G.closePath(); G.fill(); G.stroke();
      // 固定器：深色底座 + 紫色卡扣
      const bx = boardX + boardW * 0.22, by = boardY - s * 0.015, bw = s * 0.09, bh = boardH * 0.8;
      G.fillStyle = 'rgba(30,30,40,0.78)';
      G.fillRect(bx, by, bw, bh);
      G.fillStyle = purple;
      G.fillRect(bx + bw * 0.15, by + bh * 0.12, bw * 0.7, bh * 0.16);
      G.fillRect(bx + bw * 0.15, by + bh * 0.72, bw * 0.7, bh * 0.16);
      G.fillStyle = 'rgba(255,255,255,0.35)';
      G.fillRect(bx + bw * 0.2, by + bh * 0.38, bw * 0.6, bh * 0.24);
    } else if (col.boardStyle === 'tech') {
      // ---- 科技滑板：悬浮发光 + 金属装甲 + 能量脊 + 推进喷口 ----
      // 悬浮底光
      const glow = G.createRadialGradient(boardX + boardW / 2, boardY + boardH, 0, boardX + boardW / 2, boardY + boardH, boardW * 0.6);
      glow.addColorStop(0, 'rgba(120,200,255,0.5)');
      glow.addColorStop(1, 'rgba(120,200,255,0)');
      G.fillStyle = glow;
      G.beginPath(); G.ellipse(boardX + boardW / 2, boardY + boardH * 1.4, boardW * 0.55, boardH * 1.6, 0, 0, Math.PI * 2); G.fill();
      // 钛灰金属板体
      const bg = G.createLinearGradient(0, boardY, 0, boardY + boardH);
      bg.addColorStop(0, '#aeb8c2');
      bg.addColorStop(0.45, '#5a6470');
      bg.addColorStop(1, '#2b323b');
      G.beginPath();
      G.roundRect(boardX, boardY, boardW, boardH, boardH * 0.35);
      G.fillStyle = bg; G.fill();
      // 能量涂层（board 色）
      G.save(); G.clip();
      const eg = G.createLinearGradient(boardX, 0, boardX + boardW, 0);
      eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(0.5, col.board); eg.addColorStop(1, 'rgba(0,0,0,0)');
      G.globalAlpha = 0.55; G.fillStyle = eg;
      G.fillRect(boardX, boardY, boardW, boardH); G.globalAlpha = 1;
      if (col.boardPat && col.boardPat !== 'none') paintPattern(col.boardPat, col.boardPat2, boardX, boardY, boardW, boardH);
      G.restore();
      // 霓虹边描边（board 色发光，仅游戏内启用，菜单态关阴影省 CPU）
      G.strokeStyle = col.board; G.lineWidth = Math.max(1.5, boardH * 0.22);
      if (game.state === 'playing') { G.shadowColor = col.board; G.shadowBlur = s * 0.18; }
      G.beginPath(); G.roundRect(boardX, boardY, boardW, boardH, boardH * 0.35); G.stroke();
      G.shadowBlur = 0;
      // 能量脊（中央发光条）
      G.strokeStyle = '#eaffff'; G.lineWidth = Math.max(1, boardH * 0.12);
      G.beginPath(); G.moveTo(boardX + boardW * 0.1, boardY + boardH * 0.5); G.lineTo(boardX + boardW * 0.9, boardY + boardH * 0.5); G.stroke();
      // 机械固定器（块状卡扣）
      G.fillStyle = '#1b2026';
      for (const fx of [boardX + boardW * 0.22, boardX + boardW * 0.7]) {
        G.fillRect(fx, boardY - s * 0.02, s * 0.12, boardH * 0.9);
        G.fillStyle = col.board;
        G.fillRect(fx + s * 0.02, boardY + boardH * 0.1, s * 0.08, Math.max(1, boardH * 0.18));
        G.fillStyle = '#1b2026';
      }
      // 尾部推进喷口 + 动态蓝焰
      const tn = (performance.now() / 90) % 1;
      for (const px of [boardX + boardW - s * 0.04, boardX + boardW - s * 0.16]) {
        G.fillStyle = '#2b323b';
        G.fillRect(px, boardY + boardH * 0.2, s * 0.05, boardH * 0.6);
        const fl = (1 - tn) * s * 0.5;
        const fg = G.createLinearGradient(px, boardY + boardH * 0.5, px + fl, boardY + boardH * 0.5);
        fg.addColorStop(0, 'rgba(150,220,255,0.9)'); fg.addColorStop(1, 'rgba(150,220,255,0)');
        G.fillStyle = fg;
        G.beginPath();
        G.moveTo(px + s * 0.05, boardY + boardH * 0.3);
        G.lineTo(px + s * 0.05 + fl, boardY + boardH * 0.5);
        G.lineTo(px + s * 0.05, boardY + boardH * 0.7);
        G.closePath(); G.fill();
      }
    } else {
      // ---- 普通单板 ----
      const bg = G.createLinearGradient(0, boardY, 0, boardY + boardH);
      bg.addColorStop(0, shade(col.board, 1.35));
      bg.addColorStop(0.45, col.board);
      bg.addColorStop(1, shade(col.board, 0.6));
      G.beginPath();
      G.roundRect(boardX, boardY, boardW, boardH, boardH * 0.5);
      G.fillStyle = bg; G.fill();
      if (col.boardPat && col.boardPat !== 'none') {
        G.save(); G.clip();
        paintPattern(col.boardPat, col.boardPat2, boardX, boardY, boardW, boardH);
        G.restore();
      }
      G.strokeStyle = 'rgba(0,0,0,0.18)'; G.lineWidth = 1; G.stroke();
      // 板面上缘高光 + 固定器 + 两端尾翘
      G.fillStyle = 'rgba(255,255,255,0.5)';
      G.fillRect(boardX + boardH * 0.5, boardY + 1, boardW - boardH, Math.max(1, boardH * 0.22));
      G.fillStyle = 'rgba(0,0,0,0.35)';
      G.fillRect(boardX + boardW * 0.2, boardY - s * 0.015, s * 0.09, boardH * 0.8);
      G.fillRect(boardX + boardW * 0.68, boardY - s * 0.015, s * 0.09, boardH * 0.8);
      G.fillStyle = shade(col.board, 1.15);
      for (const ex of [boardX + s * 0.03, boardX + boardW - s * 0.03]) {
        G.beginPath();
        G.ellipse(ex, boardY + boardH * 0.5, s * 0.05, boardH * 0.72, 0, 0, Math.PI * 2);
        G.fill();
      }
    }
  }

  // ---- 腿部（屈膝剪影：大腿粗、膝前顶、小腿回收落板）----
  const legShade = shade(col.body, 0.62);
  const kneeBend = crouching ? s * 0.18 : s * 0.08;   // 蹲伏时膝更屈
  const sway = Math.sin(t / 130) * s * 0.04;
  function drawLeg(hipX, hipY, kneeX, kneeY, footX, footY) {
    G.strokeStyle = legShade;
    G.lineWidth = s * 0.18;
    G.lineCap = 'round'; G.lineJoin = 'round';
    G.beginPath();
    G.moveTo(hipX, hipY);
    G.lineTo(kneeX, kneeY);
    G.lineTo(footX, footY);
    G.stroke();
    G.strokeStyle = shade(col.body, 0.88);     // 受光侧高光
    G.lineWidth = s * 0.07;
    G.beginPath();
    G.moveTo(hipX, hipY);
    G.lineTo(kneeX, kneeY);
    G.stroke();
  }
  if (skiMode) {
    // 双板：两膝外撑（A 字），大腿外张、膝明显前顶、小腿回收落板
    const hipY = bodyBot + s * 0.02;
    const kneeY = hipY + s * 0.05 + kneeBend;
    for (const [hxo, kxo, fxo] of [[-s * 0.06, -s * 0.2, -skiOff], [s * 0.06, s * 0.2, skiOff]]) {
      const kxx = kxo + tilt * s * 0.05;
      const fxx = fxo + sway;
      drawLeg(hxo, hipY, kxx, kneeY, fxx, -s * 0.13);
      G.fillStyle = '#34495e';                  // 靴
      G.beginPath(); G.arc(fxx, -s * 0.12, s * 0.07, 0, Math.PI * 2); G.fill();
    }
  } else {
    // 单板：前后分脚，膝前顶屈膝（前脚略前、后脚略后）
    const hipY = bodyBot + s * 0.02;
    const kneeY = hipY + s * 0.06 + kneeBend;
    const fK = tilt * 0.5;
    const footY = -s * 0.07 + sway;
    // 后脚（远）
    drawLeg(s * 0.06 + fK * s, hipY, s * 0.14 + fK * s, kneeY, s * 0.22 + fK * s, -s * 0.08 + sway);
    // 前脚（近）
    drawLeg(-s * 0.04 + fK * s, hipY, -s * 0.16 + fK * s, kneeY, -s * 0.24 + fK * s, -s * 0.05 + sway);
    G.fillStyle = '#34495e';
    G.beginPath(); G.arc(-s * 0.24 + fK * s, -s * 0.05 + sway, s * 0.065, 0, Math.PI * 2); G.fill();
    G.beginPath(); G.arc(s * 0.22 + fK * s, -s * 0.08 + sway, s * 0.065, 0, Math.PI * 2); G.fill();
  }

  // ---- 躯干（屈髋前压弓背：肩后收、胯前送，胸口压向膝盖）----
  const bodyX = -s * 0.16 + tilt * s * 0.2;
  const bodyW = s * 0.34;
  const bodyH = bodyBot - bodyTopY;
  const bodyTopW = bodyW * 0.7;             // 肩更窄（流线）
  const press = lean * s * 0.55;            // 前压偏移量
  const topCx = bodyX + (bodyW - bodyTopW) / 2 - press;     // 肩后收
  const botCx = bodyX + bodyW / 2 + press * 0.55;           // 胯前送
  const tg = G.createLinearGradient(bodyX, 0, bodyX + bodyW, 0);
  tg.addColorStop(0, shade(col.body, 1.18));
  tg.addColorStop(0.55, col.body);
  tg.addColorStop(1, shade(col.body, 0.8));
  G.beginPath();
  G.moveTo(topCx, bodyTopY);
  G.lineTo(topCx + bodyTopW, bodyTopY);
  G.quadraticCurveTo(bodyX + bodyW + s * 0.02 - press * 0.3, bodyTopY + bodyH * 0.5,
                       botCx + bodyW / 2, bodyBot);
  G.lineTo(botCx - bodyW / 2, bodyBot);
  G.quadraticCurveTo(bodyX - s * 0.02 - press * 0.3, bodyTopY + bodyH * 0.5,
                       topCx, bodyTopY);
  G.closePath();
  G.fillStyle = tg; G.fill();
  if (col.charPat && col.charPat !== 'none') {
    G.save(); G.clip();
    paintPattern(col.charPat, col.charPat2, bodyX, bodyTopY, bodyW, bodyH);
    G.restore();
  }
  G.strokeStyle = 'rgba(0,0,0,0.14)'; G.lineWidth = 1; G.stroke();
  G.fillStyle = 'rgba(255,255,255,0.3)';
  G.fillRect(bodyX + bodyW * 0.14, bodyTopY + s * 0.06, Math.max(1.5, bodyW * 0.1), bodyH - s * 0.12);
  G.fillStyle = 'rgba(0,0,0,0.28)';
  G.fillRect(bodyX + s * 0.02, bodyTopY + bodyH * 0.74, bodyW - s * 0.04, Math.max(1.5, s * 0.05));
  G.fillStyle = shade(col.scarf, 1.1);
  G.fillRect(bodyX + bodyW * 0.42, bodyTopY + bodyH * 0.72, s * 0.07, s * 0.08);

  // ---- 机甲装甲（charStyle=mecha：肩甲 + 胸甲 + 能量核心 + 分缝）----
  if (col.charStyle === 'mecha') {
    // 装甲金属渐变
    const ag = G.createLinearGradient(bodyX, 0, bodyX + bodyW, 0);
    ag.addColorStop(0, shade(col.body, 1.4));
    ag.addColorStop(0.5, shade(col.body, 1.0));
    ag.addColorStop(1, shade(col.body, 0.55));
    // 肩甲（两侧梯形装甲块）
    G.fillStyle = ag;
    for (const sx of [bodyX - s * 0.04, bodyX + bodyW - s * 0.12]) {
      G.beginPath();
      G.moveTo(sx, bodyTopY + s * 0.04);
      G.lineTo(sx + s * 0.16, bodyTopY - s * 0.02);
      G.lineTo(sx + s * 0.2, bodyTopY + s * 0.18);
      G.lineTo(sx + s * 0.02, bodyTopY + s * 0.2);
      G.closePath(); G.fill();
      G.strokeStyle = shade(col.body, 0.4); G.lineWidth = 1; G.stroke();
      G.fillStyle = 'rgba(255,255,255,0.35)';
      G.fillRect(sx + s * 0.03, bodyTopY + s * 0.02, s * 0.03, s * 0.12);
      G.fillStyle = ag;
    }
    // 胸甲（中央六边形装甲）
    const cxm = bodyX + bodyW * 0.5, cym = bodyTopY + bodyH * 0.42;
    const cr = bodyW * 0.22;
    G.fillStyle = ag;
    G.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      const x = cxm + Math.cos(a) * cr, y = cym + Math.sin(a) * cr * 0.9;
      if (i === 0) G.moveTo(x, y); else G.lineTo(x, y);
    }
    G.closePath(); G.fill();
    G.strokeStyle = shade(col.body, 0.4); G.lineWidth = 1; G.stroke();
    // 能量核心（发光，用 hat 色，仅游戏内启用阴影）
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 220);
    if (game.state === 'playing') { G.shadowColor = col.hat; G.shadowBlur = s * 0.18 * pulse; }
    G.fillStyle = col.hat;
    G.beginPath(); G.arc(cxm, cym, cr * 0.42, 0, Math.PI * 2); G.fill();
    G.shadowBlur = 0;
    G.fillStyle = '#ffffff';
    G.beginPath(); G.arc(cxm, cym, cr * 0.16, 0, Math.PI * 2); G.fill();
    // 装甲分缝线
    G.strokeStyle = shade(col.body, 0.35); G.lineWidth = Math.max(1, s * 0.02);
    for (const fy of [bodyTopY + bodyH * 0.3, bodyTopY + bodyH * 0.62]) {
      G.beginPath(); G.moveTo(bodyX + s * 0.02, fy); G.lineTo(bodyX + bodyW - s * 0.02, fy); G.stroke();
    }
  }

  // ---- 手臂（背视：双板持杖向后撑；单板空手平衡）----
  if (skiMode) {
    for (const off of [-s * 0.18, s * 0.18]) {
      const px = off + tilt * s * 0.1;
      const py = bodyTopY + (crouching ? s * 0.28 : s * 0.42);
      G.strokeStyle = shade(col.body, 0.92); G.lineWidth = s * 0.1; G.lineCap = 'round';
      G.beginPath(); G.moveTo(off, bodyTopY + s * 0.05); G.lineTo(px, py); G.stroke();
      G.fillStyle = col.scarf;
      G.beginPath(); G.arc(px, py, s * 0.085, 0, Math.PI * 2); G.fill();
      // 雪杖向后撑（杖尖朝身后下方、离雪面）
      G.strokeStyle = '#cfd8dc'; G.lineWidth = Math.max(1.5, s * 0.045);
      G.beginPath(); G.moveTo(px, py); G.lineTo(px - s * 0.18, py + s * 0.04); G.stroke();
      G.fillStyle = '#7f8c8d';
      G.beginPath(); G.arc(px - s * 0.18, py + s * 0.04, s * 0.038, 0, Math.PI * 2); G.fill();
    }
  } else {
    // 单板模式：不持杖（真实单板无滑雪杖），手臂自然张开保持平衡
    G.lineCap = 'round';
    if (air) {
      // 空中：双臂张开保持平衡
      G.strokeStyle = shade(col.body, 0.92); G.lineWidth = s * 0.1;
      for (const dir of [-1, 1]) {
        const ax = dir * s * 0.26, ay = bodyTopY + s * 0.18;
        G.beginPath(); G.moveTo(dir * s * 0.15, bodyTopY + s * 0.08); G.lineTo(ax, ay); G.stroke();
        G.fillStyle = col.scarf;
        G.beginPath(); G.arc(ax, ay, s * 0.08, 0, Math.PI * 2); G.fill();
      }
    } else if (crouching) {
      // 蹲伏：双手前伸保持平衡（空手）
      G.strokeStyle = shade(col.body, 0.92); G.lineWidth = s * 0.1;
      for (const dir of [-1, 1]) {
        const ax = dir * s * 0.3, ay = bodyTopY - s * 0.06;
        G.beginPath(); G.moveTo(dir * s * 0.15, bodyTopY + s * 0.05); G.lineTo(ax, ay); G.stroke();
        G.fillStyle = col.scarf;
        G.beginPath(); G.arc(ax, ay, s * 0.08, 0, Math.PI * 2); G.fill();
      }
    } else {
      // 滑行：双臂自然张开平衡（无杖）
      const sw = Math.sin(t / 130) * s * 0.035;
      // 前手（左前）：自然前伸
      const fpx = -s * 0.3 + sw, fpy = bodyTopY - s * 0.02;
      G.strokeStyle = shade(col.body, 0.92); G.lineWidth = s * 0.1;
      G.beginPath(); G.moveTo(-s * 0.15, bodyTopY + s * 0.05); G.lineTo(fpx, fpy); G.stroke();
      G.fillStyle = col.scarf;
      G.beginPath(); G.arc(fpx, fpy, s * 0.08, 0, Math.PI * 2); G.fill();
      // 后手（右后）：略后张开
      G.strokeStyle = shade(col.body, 0.92); G.lineWidth = s * 0.1;
      const rpx = s * 0.3 + sw, rpy = bodyTopY + s * 0.22;
      G.beginPath(); G.moveTo(s * 0.15, bodyTopY + s * 0.05); G.lineTo(rpx, rpy); G.stroke();
      G.fillStyle = col.scarf;
      G.beginPath(); G.arc(rpx, rpy, s * 0.08, 0, Math.PI * 2); G.fill();
    }
  }

  // ---- 围巾（脖子一圈 + 迎风飘带，速度越快越舒展）----
  const neckY = headCY + s * 0.16;
  G.fillStyle = col.scarf;
  G.beginPath();
  G.roundRect(hx - s * 0.18, neckY, s * 0.36, s * 0.09, s * 0.045);
  G.fill();
  G.strokeStyle = shade(col.scarf, 0.85);
  G.lineWidth = s * 0.085;
  G.lineCap = 'round';
  const fl = s * (0.3 + spd * 0.28);
  G.beginPath();
  G.moveTo(hx + s * 0.07, neckY + s * 0.04);
  G.quadraticCurveTo(hx + s * 0.13 + wind * s * 0.04, neckY + fl * 0.55,
                       hx + s * 0.05 + wind * s * 0.09, neckY + fl);
  G.stroke();
  G.lineWidth = s * 0.06;
  G.beginPath();
  G.moveTo(hx + s * 0.04 + wind * s * 0.05, neckY + fl * 0.8);
  G.quadraticCurveTo(hx + s * 0.1 + wind * s * 0.1, neckY + fl * 1.15,
                       hx + s * 0.12 + wind * s * 0.16, neckY + fl * 1.4);
  G.stroke();

  // ---- 头部（后脑 + 光照渐变 + 雪镜带 + 雪帽 + 随风绒球）----
  G.fillStyle = col.head;
  G.beginPath();
  G.arc(hx, headCY, s * 0.2, 0, Math.PI * 2);
  G.fill();
  G.save();
  G.beginPath();
  G.arc(hx, headCY, s * 0.2, 0, Math.PI * 2);
  G.clip();
  const hgd = G.createLinearGradient(hx - s * 0.2, headCY - s * 0.2, hx + s * 0.2, headCY + s * 0.2);
  hgd.addColorStop(0, 'rgba(255,255,255,0.22)');
  hgd.addColorStop(1, 'rgba(0,0,0,0.14)');
  G.fillStyle = hgd;
  G.fillRect(hx - s * 0.2, headCY - s * 0.2, s * 0.4, s * 0.4);
  G.restore();
  // 雪镜带（脑后横带 + 反光扣）
  G.fillStyle = shade(col.hat, 0.55);
  G.beginPath();
  G.roundRect(hx - s * 0.2, headCY - s * 0.05, s * 0.4, s * 0.1, s * 0.04);
  G.fill();
  G.fillStyle = 'rgba(255,255,255,0.4)';
  G.fillRect(hx - s * 0.05, headCY - s * 0.025, s * 0.1, s * 0.035);
  // 雪帽（帽体 + 帽口沿）
  G.fillStyle = col.hat;
  G.beginPath();
  G.arc(hx, headCY - s * 0.05, s * 0.205, Math.PI, Math.PI * 2);
  G.fill();
  G.fillStyle = shade(col.hat, 0.72);
  G.beginPath();
  G.ellipse(hx, headCY - s * 0.045, s * 0.205, s * 0.055, 0, 0, Math.PI * 2);
  G.fill();
  // 绒球（随风摆 + 高光点）
  G.fillStyle = shade(col.hat, 1.32);
  G.beginPath();
  G.arc(hx + wind * s * 0.03, headCY - s * 0.27, s * 0.058, 0, Math.PI * 2);
  G.fill();
  G.fillStyle = 'rgba(255,255,255,0.55)';
  G.beginPath();
  G.arc(hx + wind * s * 0.03 - s * 0.02, headCY - s * 0.29, s * 0.02, 0, Math.PI * 2);
  G.fill();

  G.restore();

  if (game.dizzyT > 0) {
    const t = performance.now() / 160;
    for (let i = 0; i < 3; i++) {
      const ang = t + i * (Math.PI * 2 / 3);
      const sx = x + Math.cos(ang) * s * 0.4;
      const sy = (groundY - s * 0.95) - s * 0.45 + Math.sin(ang) * s * 0.2;
      G.fillStyle = '#ffe066';
      G.beginPath();
      G.arc(sx, sy, s * 0.09, 0, Math.PI * 2);
      G.fill();
    }
  }
}

// ---- 障碍 / 道具绘制 ----
function drawFence(e) {
  const p = proj(e.z, laneWorldX(e.lane));
  const s = worldSize(1.15, p.scale);
  const x = p.x, y = p.y - elevOffset(e.z);
  // 地面投影
  entityShadow(x, y, s * 0.72, s * 0.2);
  // 立柱（橙红警示桩，左亮右暗渐变 + 高光 + 圆角帽，呼应赛道护栏网配色）
  const postW = s * 0.14, postH = s * 0.75;
  for (const px of [x - s * 0.48, x + s * 0.34]) {
    G.fillStyle = vGrad(px, y - postH, px, y, '#e8693f');
    G.beginPath(); G.roundRect(px - postW / 2, y - postH, postW, postH, postW * 0.4); G.fill();
    strokeRound(px - postW / 2, y - postH, postW, postH, postW * 0.4, Math.max(1, s * 0.03));
    G.fillStyle = 'rgba(255,255,255,0.35)';
    G.fillRect(px - postW / 2 + postW * 0.16, y - postH + postH * 0.08, postW * 0.22, postH * 0.84);
    G.fillStyle = '#ff7a4d';
    G.beginPath(); G.arc(px, y - postH, postW * 0.6, 0, Math.PI * 2); G.fill();
  }
  // 横档：橙黄警示 + 斜向反光条纹（雪地高辨识，不再用隐形白条）
  for (let i = 0; i < 2; i++) {
    const ry = y - s * 0.62 + i * s * 0.28;
    const rw = s * 1.15, rh = s * 0.17, rx = x - rw / 2;
    G.fillStyle = vGrad(rx, ry, rx, ry + rh, '#f4a23b');
    G.beginPath(); G.roundRect(rx, ry, rw, rh, rh * 0.4); G.fill();
    strokeRound(rx, ry, rw, rh, rh * 0.4, Math.max(1, s * 0.03));
    G.save();
    G.beginPath(); G.roundRect(rx, ry, rw, rh, rh * 0.4); G.clip();
    G.strokeStyle = 'rgba(255,255,255,0.55)'; G.lineWidth = Math.max(1, s * 0.05);
    for (let k = -2; k < 10; k++) {
      const sx = rx + k * s * 0.18;
      G.beginPath(); G.moveTo(sx, ry + rh); G.lineTo(sx + s * 0.1, ry); G.stroke();
    }
    G.restore();
    topHi(rx + rh * 0.4, ry + 1, rw - rh * 0.8, Math.max(1, rh * 0.18));
  }
}

function drawBar(e) {
  const p = proj(e.z, laneWorldX(e.lane));
  const s = worldSize(1.31, p.scale);
  const x = p.x, y = p.y - elevOffset(e.z);
  entityShadow(x, y, s * 0.82, s * 0.22);
  const postH = s * 1.9, postW = s * 0.16;
  // 立柱（金属灰渐变 + 受光高光）
  for (const px of [x - s * 0.78, x + s * 0.62]) {
    G.fillStyle = vGrad(px, y - postH, px, y, '#7f8c8d');
    G.beginPath(); G.roundRect(px - postW / 2, y - postH, postW, postH, postW * 0.3); G.fill();
    strokeRound(px - postW / 2, y - postH, postW, postH, postW * 0.3, Math.max(1, s * 0.03));
    G.fillStyle = 'rgba(255,255,255,0.4)';
    G.fillRect(px - postW / 2 + postW * 0.18, y - postH + postH * 0.06, postW * 0.2, postH * 0.88);
  }
  // 横杆：深色 + 顶部黄色警示带 + 上缘高光
  const barH = s * 0.42, barBottom = y - s * 1.15, bw = s * 1.64, bx = x - bw / 2;
  G.fillStyle = vGrad(bx, barBottom - barH, bx, barBottom, '#34495e');
  G.beginPath(); G.roundRect(bx, barBottom - barH, bw, barH, barH * 0.3); G.fill();
  strokeRound(bx, barBottom - barH, bw, barH, barH * 0.3, Math.max(1, s * 0.03));
  G.fillStyle = '#f1c40f';
  G.beginPath(); G.roundRect(bx, barBottom - barH, bw, s * 0.13, s * 0.05); G.fill();
  topHi(bx + s * 0.1, barBottom - barH + 1, bw - s * 0.2, Math.max(1, barH * 0.16));
}

function drawBomb(e) {
  const p = proj(e.z, laneWorldX(e.lane));
  const s = worldSize(0.8, p.scale);
  const groundY = p.y - elevOffset(e.z);
  const x = p.x, y = groundY - s * 0.55;
  // 危险光晕（呼吸，不闪烁）
  const pulse = 0.22 + 0.12 * Math.sin(performance.now() / 300);
  G.save();
  G.globalAlpha = pulse;
  G.fillStyle = '#e74c3c';
  G.beginPath(); G.arc(x, y, s * 0.82, 0, Math.PI * 2); G.fill();
  G.restore();
  // 地面投影
  entityShadow(p.x, groundY, s * 0.6, s * 0.18);
  // 立体球（径向渐变，高光偏左上）
  const rg = G.createRadialGradient(x - s * 0.18, y - s * 0.18, s * 0.05, x, y, s * 0.55);
  rg.addColorStop(0, '#4a5a6e');
  rg.addColorStop(0.5, '#2c3e50');
  rg.addColorStop(1, '#161e28');
  G.fillStyle = rg;
  G.beginPath(); G.arc(x, y, s * 0.5, 0, Math.PI * 2); G.fill();
  G.strokeStyle = 'rgba(0,0,0,0.4)'; G.lineWidth = Math.max(1, s * 0.03);
  G.beginPath(); G.arc(x, y, s * 0.5, 0, Math.PI * 2); G.stroke();
  // 高光点
  G.fillStyle = 'rgba(255,255,255,0.4)';
  G.beginPath(); G.arc(x - s * 0.16, y - s * 0.16, s * 0.14, 0, Math.PI * 2); G.fill();
  // 引信
  G.strokeStyle = '#8a6d3b'; G.lineWidth = Math.max(1, s * 0.07);
  G.beginPath();
  G.moveTo(x, y - s * 0.5);
  G.quadraticCurveTo(x + s * 0.16, y - s * 0.66, x + s * 0.24, y - s * 0.78);
  G.stroke();
  // 火花（呼吸渐变，替代每帧随机闪烁）
  const spark = 0.7 + 0.3 * Math.sin(performance.now() / 160);
  const sg = G.createRadialGradient(x + s * 0.24, y - s * 0.8, 0, x + s * 0.24, y - s * 0.8, s * 0.22);
  sg.addColorStop(0, 'rgba(255,230,120,' + spark.toFixed(2) + ')');
  sg.addColorStop(1, 'rgba(255,120,40,0)');
  G.fillStyle = sg;
  G.beginPath(); G.arc(x + s * 0.24, y - s * 0.8, s * 0.22, 0, Math.PI * 2); G.fill();
}

function drawCoin(e) {
  const p = proj(e.z, laneWorldX(e.lane));
  const s = worldSize(0.38, p.scale);
  const gy = p.y - elevOffset(e.z);
  const lift = e.onTrain ? worldSize(0.9, p.scale) * 1.35 : s * 1.0;
  const x = p.x, y = gy - lift;
  G.fillStyle = 'rgba(80,120,150,0.18)';
  G.beginPath();
  G.ellipse(p.x, gy, s * 0.5, s * 0.18, 0, 0, Math.PI * 2);
  G.fill();
  const spin = Math.abs(Math.cos(performance.now() / 300 + e.z));
  G.save();
  G.shadowColor = 'rgba(255,200,60,0.85)';
  G.shadowBlur = s * 0.9;
  G.fillStyle = '#ffcf33';
  G.beginPath();
  G.ellipse(x, y, s * (0.3 + 0.7 * spin), s, 0, 0, Math.PI * 2);
  G.fill();
  G.restore();
  G.strokeStyle = '#d98324';
  G.lineWidth = Math.max(1, s * 0.12);
  G.stroke();
  G.fillStyle = '#fff3c4';
  G.beginPath();
  G.ellipse(x - s * 0.15, y - s * 0.2, s * 0.18, s * 0.28, 0, 0, Math.PI * 2);
  G.fill();
}

function drawStar(e) {
  const p = proj(e.z, laneWorldX(e.lane));
  const s = worldSize(0.69, p.scale);
  const cx = p.x, cy = p.y - elevOffset(e.z) - s * 1.8;
  const t = performance.now() / 200;
  G.save();
  G.translate(cx, cy);
  G.rotate(t * 0.5);
  G.shadowColor = '#ffd34d';
  G.shadowBlur = s * 0.8;
  G.fillStyle = '#ffd34d';
  G.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI / 5 * i - Math.PI / 2;
    const rad = (i % 2 === 0) ? s : s * 0.45;
    G.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  G.closePath();
  G.fill();
  G.restore();
}

function drawBoost(e) {
  const p = proj(e.z, laneWorldX(e.lane));
  const s = worldSize(1.06, p.scale);
  const x = p.x, y = p.y - elevOffset(e.z);
  entityShadow(x, y, s * 0.6, s * 0.16);
  const w = s * 1.1, h = s * 0.5;
  G.save();
  G.fillStyle = vGrad(x - w / 2, y - h, x - w / 2, y, '#22c3d6');
  G.beginPath(); G.roundRect(x - w / 2, y - h, w, h, h * 0.4); G.fill();
  strokeRound(x - w / 2, y - h, w, h, h * 0.4, Math.max(1, s * 0.04));
  G.strokeStyle = '#1fb6c9'; G.lineWidth = Math.max(1, s * 0.08);
  G.lineCap = 'round';
  const off = (performance.now() / 200) % (h * 0.6);
  for (let k = -1; k <= 1; k++) {
    const ax = x + k * w * 0.28;
    const ay = y - h * 0.5 + off - h * 0.3;
    G.beginPath();
    G.moveTo(ax - s * 0.18, ay + s * 0.18);
    G.lineTo(ax, ay - s * 0.05);
    G.lineTo(ax + s * 0.18, ay + s * 0.18);
    G.stroke();
  }
  G.restore();
}

function drawTrain(e) {
  const laneX = laneWorldX(e.lane);
  // 地面投影阴影 + 钢轨 + 枕木（沿整列火车下方）
  const pHead = proj(e.z, laneX);
  const pTail = proj(e.z + (C.TRAIN_CARS - 1) * C.TRAIN_CAR_SPACING, laneX);
  if (pHead.scale < 0.001) return;
  const s0 = worldSize(1.0, pHead.scale);
  const railY = pHead.y, railYt = pTail.y;
  // 雪地压痕阴影
  G.fillStyle = 'rgba(40,60,90,0.22)';
  G.beginPath();
  G.ellipse((pHead.x + pTail.x) / 2, (railY + railYt) / 2, (Math.abs(pHead.x - pTail.x) + s0 * 1.2) / 2, s0 * 0.22, 0, 0, Math.PI * 2);
  G.fill();
  // 钢轨（两条）+ 枕木
  const railColor = '#6b7785', tieColor = '#5a4632';
  for (const off of [-s0 * 0.42, s0 * 0.42]) {
    G.strokeStyle = railColor; G.lineWidth = Math.max(1, s0 * 0.05);
    G.beginPath(); G.moveTo(pHead.x + off, railY); G.lineTo(pTail.x + off * (pTail.scale / pHead.scale), railYt); G.stroke();
  }
  const tieN = C.TRAIN_CARS * 3;
  for (let i = 0; i <= tieN; i++) {
    const f = i / tieN;
    const zz = e.z + f * (C.TRAIN_CARS - 1) * C.TRAIN_CAR_SPACING;
    const pp = proj(zz, laneX);
    if (pp.scale < 0.001) continue;
    const ss = worldSize(1.0, pp.scale);
    G.strokeStyle = tieColor; G.lineWidth = Math.max(1, ss * 0.08);
    G.beginPath(); G.moveTo(pp.x - ss * 0.6, pp.y); G.lineTo(pp.x + ss * 0.6, pp.y); G.stroke();
  }

  const now = performance.now();
  const wheelPhase = (now / 220) % 1;            // 动轮相位（连杆动画）
  for (let c = 0; c < C.TRAIN_CARS; c++) {
    const zz = e.z + c * C.TRAIN_CAR_SPACING;
    const p = proj(zz, laneX);
    if (p.scale < 0.001) continue;
    const s = worldSize(1.0, p.scale);
    const x = p.x, groundY = p.y;
    const bw = s * 1.08, bh = s * 1.42;
    const bx = x - bw / 2, by = groundY - bh;
    const isHead = (c === 0);
    const bodyTop = isHead ? shade('#3a3f47', 1.25) : shade('#2f3540', 1.18);
    const bodyMid = isHead ? '#3a3f47' : '#2f3540';
    const bodyBot = isHead ? shade('#3a3f47', 0.55) : shade('#2f3540', 0.5);

    // 车体金属竖向渐变（圆柱感）
    const bodyGrad = G.createLinearGradient(0, by, 0, groundY);
    bodyGrad.addColorStop(0, bodyTop);
    bodyGrad.addColorStop(0.18, shade(bodyMid, 1.25));
    bodyGrad.addColorStop(0.5, bodyMid);
    bodyGrad.addColorStop(1, bodyBot);
    G.fillStyle = bodyGrad;
    G.beginPath(); G.roundRect(bx, by, bw, bh, s * 0.1); G.fill();
    // 高光带
    G.fillStyle = 'rgba(255,255,255,0.16)';
    G.fillRect(bx + bw * 0.12, by + bh * 0.12, bw * 0.1, bh * 0.6);
    // 描边
    G.strokeStyle = 'rgba(0,0,0,0.45)'; G.lineWidth = Math.max(1, s * 0.03);
    G.beginPath(); G.roundRect(bx, by, bw, bh, s * 0.1); G.stroke();

    // 车厢：侧窗（玻璃高光）
    if (!isHead) {
      const winN = 3;
      for (let w = 0; w < winN; w++) {
        const wx = bx + bw * (0.16 + w * 0.27);
        const wy = by + bh * 0.3, ww = bw * 0.18, wh = bh * 0.3;
        G.fillStyle = '#8fb8d6';
        G.beginPath(); G.roundRect(wx, wy, ww, wh, s * 0.04); G.fill();
        G.fillStyle = 'rgba(255,255,255,0.5)';
        G.beginPath(); G.roundRect(wx, wy, ww * 0.4, wh * 0.4, s * 0.03); G.fill();
        G.strokeStyle = 'rgba(0,0,0,0.3)'; G.lineWidth = 1;
        G.beginPath(); G.roundRect(wx, wy, ww, wh, s * 0.04); G.stroke();
      }
    }

    // 动轮 + 连杆（蒸汽机标志）
    const wheelR = s * 0.22;
    const wheelY = groundY - wheelR * 0.2;
    const wheelXs = [bx + bw * 0.22, bx + bw * 0.5, bx + bw * 0.78];
    // 连杆（随相位上下摆动）
    const linkY = wheelY + Math.sin(wheelPhase * Math.PI * 2) * wheelR * 0.5;
    G.strokeStyle = '#1c1f24'; G.lineWidth = Math.max(1, s * 0.05);
    G.beginPath(); G.moveTo(wheelXs[0], linkY); G.lineTo(wheelXs[2], linkY); G.stroke();
    for (const wx of wheelXs) {
      // 轮辋
      G.fillStyle = '#15171b';
      G.beginPath(); G.arc(wx, wheelY, wheelR, 0, Math.PI * 2); G.fill();
      // 轮毂
      G.fillStyle = '#54585f';
      G.beginPath(); G.arc(wx, wheelY, wheelR * 0.45, 0, Math.PI * 2); G.fill();
      // 辐条（随相位旋转）
      G.strokeStyle = '#2b2e33'; G.lineWidth = Math.max(1, s * 0.03);
      for (let k = 0; k < 4; k++) {
        const a = wheelPhase * Math.PI * 2 + k * Math.PI / 2;
        G.beginPath(); G.moveTo(wx, wheelY);
        G.lineTo(wx + Math.cos(a) * wheelR * 0.85, wheelY + Math.sin(a) * wheelR * 0.85); G.stroke();
      }
      // 中心销
      G.fillStyle = '#1c1f24';
      G.beginPath(); G.arc(wx, wheelY, wheelR * 0.12, 0, Math.PI * 2); G.fill();
    }

    // 车厢连接处（车钩 + 缓冲器）
    if (c < C.TRAIN_CARS - 1) {
      const nx = x + bw / 2;
      G.fillStyle = '#15171b';
      G.fillRect(nx - s * 0.04, wheelY - s * 0.05, s * 0.08, s * 0.1);
      G.fillStyle = '#54585f';
      G.beginPath(); G.arc(nx, wheelY, s * 0.05, 0, Math.PI * 2); G.fill();
    }

    // ---- 车头细节 ----
    if (isHead) {
      // 锅炉穹顶（砂箱）
      G.fillStyle = shade('#3a3f47', 1.35);
      G.beginPath(); G.ellipse(x - s * 0.05, by + s * 0.12, s * 0.26, s * 0.16, 0, Math.PI, 0); G.fill();
      // 蒸汽穹顶
      G.fillStyle = shade('#3a3f47', 1.2);
      G.beginPath(); G.arc(x + s * 0.28, by + s * 0.05, s * 0.14, Math.PI, 0); G.fill();
      // 驾驶室（后端，带窗）
      G.fillStyle = shade('#2c3038', 1.1);
      G.beginPath(); G.roundRect(x + bw * 0.18, by - s * 0.28, bw * 0.32, bh + s * 0.28, s * 0.06); G.fill();
      G.fillStyle = '#8fb8d6';
      G.beginPath(); G.roundRect(x + bw * 0.24, by - s * 0.18, bw * 0.2, s * 0.3, s * 0.04); G.fill();
      G.fillStyle = 'rgba(255,255,255,0.45)';
      G.fillRect(x + bw * 0.26, by - s * 0.16, bw * 0.06, s * 0.12);
      // 大烟囱
      const stackX = x - s * 0.42, stackBaseY = by + s * 0.1, stackTopY = by - s * 0.34;
      G.fillStyle = '#1f2228';
      G.beginPath();
      G.moveTo(stackX - s * 0.12, stackBaseY);
      G.lineTo(stackX - s * 0.09, stackTopY);
      G.lineTo(stackX + s * 0.09, stackTopY);
      G.lineTo(stackX + s * 0.12, stackBaseY);
      G.closePath(); G.fill();
      G.fillStyle = '#3a3f47';
      G.fillRect(stackX - s * 0.13, stackTopY - s * 0.04, s * 0.26, s * 0.04);
      // 多层动态烟羽（蒸汽机标志性）
      for (let i = 0; i < 5; i++) {
        const t = ((now / 600) + i * 0.2) % 1;
        const py = stackTopY - t * s * 1.4;
        const pr = s * (0.12 + t * 0.42);
        const alpha = (1 - t) * 0.4;
        G.fillStyle = 'rgba(225,228,232,' + alpha.toFixed(3) + ')';
        G.beginPath(); G.arc(stackX + Math.sin(t * 6.28 + i) * s * 0.1, py, pr, 0, Math.PI * 2); G.fill();
      }
      // 排障器（牛栏，车头最前）
      const pX = bx;
      G.strokeStyle = '#15171b'; G.lineWidth = Math.max(1, s * 0.04);
      G.beginPath();
      G.moveTo(pX, by + bh * 0.7);
      G.lineTo(pX - s * 0.18, groundY);
      G.stroke();
      for (let i = 0; i <= 4; i++) {
        const yy = by + bh * 0.7 + (groundY - (by + bh * 0.7)) * (i / 4);
        const xx1 = pX - s * 0.18 * (i / 4), xx2 = pX + s * 0.05;
        G.beginPath(); G.moveTo(xx1, yy); G.lineTo(xx2, yy); G.stroke();
      }
      // 大灯 + 光晕
      const lampX = bx + s * 0.06, lampY = by + bh * 0.45;
      const lg = G.createRadialGradient(lampX, lampY, 0, lampX, lampY, s * 0.5);
      lg.addColorStop(0, 'rgba(255,247,200,0.55)');
      lg.addColorStop(1, 'rgba(255,247,200,0)');
      G.fillStyle = lg;
      G.beginPath(); G.arc(lampX, lampY, s * 0.5, 0, Math.PI * 2); G.fill();
      G.fillStyle = '#fff7a8';
      G.beginPath(); G.arc(lampX, lampY, s * 0.1, 0, Math.PI * 2); G.fill();
      G.strokeStyle = '#1f2228'; G.lineWidth = Math.max(1, s * 0.03);
      G.beginPath(); G.arc(lampX, lampY, s * 0.1, 0, Math.PI * 2); G.stroke();
    }
  }
}

function drawGap(e) {
  const pNear = proj(e.z, laneWorldX(e.lane));
  const pFar = proj(e.z + C.GAP_LEN, laneWorldX(e.lane));
  if (pNear.scale < 0.05) return;   // 防负 scale（过相机后）
  const wNear = worldSize(1.06, pNear.scale);
  const wFar = worldSize(1.06, pFar.scale);
  const yNear = pNear.y - elevOffset(e.z);
  const yFar = pFar.y - elevOffset(e.z + C.GAP_LEN);
  // 冰裂缝主体（深蓝，近亮远暗渐变，随纵深收窄）
  const g = G.createLinearGradient(0, yNear, 0, yFar);
  g.addColorStop(0, '#2b4a6b'); g.addColorStop(1, '#162f47');
  G.fillStyle = g;
  G.beginPath();
  G.moveTo(pNear.x - wNear, yNear);
  G.lineTo(pNear.x + wNear, yNear);
  G.lineTo(pFar.x + wFar, yFar);
  G.lineTo(pFar.x - wFar, yFar);
  G.closePath();
  G.fill();
  // 内芯更深
  G.fillStyle = '#0f2238';
  G.beginPath();
  G.moveTo(pNear.x - wNear * 0.45, yNear);
  G.lineTo(pNear.x + wNear * 0.45, yNear);
  G.lineTo(pFar.x + wFar * 0.45, yFar);
  G.lineTo(pFar.x - wFar * 0.45, yFar);
  G.closePath();
  G.fill();
  // 边缘冰蓝反光（双层，更立体）
  G.strokeStyle = 'rgba(150,210,255,0.85)'; G.lineWidth = 2.5;
  G.beginPath(); G.moveTo(pNear.x - wNear, yNear); G.lineTo(pFar.x - wFar, yFar); G.stroke();
  G.beginPath(); G.moveTo(pNear.x + wNear, yNear); G.lineTo(pFar.x + wFar, yFar); G.stroke();
  G.strokeStyle = 'rgba(255,255,255,0.5)'; G.lineWidth = 1;
  G.beginPath(); G.moveTo(pNear.x - wNear * 0.9, yNear); G.lineTo(pFar.x - wFar * 0.9, yFar); G.stroke();
  G.beginPath(); G.moveTo(pNear.x + wNear * 0.9, yNear); G.lineTo(pFar.x + wFar * 0.9, yFar); G.stroke();
}

function drawPower(e) {
  const p = proj(e.z, laneWorldX(e.lane));
  const s = worldSize(0.78, p.scale);
  const x = p.x, y = p.y - elevOffset(e.z) - s;
  entityShadow(x, p.y - elevOffset(e.z), s * 0.5, s * 0.14);
  G.save();
  G.globalAlpha = 0.92 + 0.08 * Math.sin(performance.now() / 200);
  if (e.type === 'magnet') {
    const w = s * 1.1, h = s * 0.6, bx = x - w / 2, by = y - h / 2;
    G.fillStyle = vGrad(bx, by, bx, by + h, '#e74c3c');
    G.beginPath(); G.roundRect(bx, by, w, h, h * 0.35); G.fill();
    strokeRound(bx, by, w, h, h * 0.35, Math.max(1, s * 0.04));
    G.fillStyle = '#ecf0f1';
    G.fillRect(x - w * 0.5, y - h * 0.45, s * 0.28, h * 0.9);
    G.fillRect(x + w * 0.22, y - h * 0.45, s * 0.28, h * 0.9);
  } else if (e.type === 'shield') {
    const r = s * 0.6;
    G.fillStyle = vGrad(x - r, y - r, x - r, y + r, '#3498db');
    G.beginPath(); G.arc(x, y, r, Math.PI, 0); G.fill();
    G.fillRect(x - r, y - r * 0.16, 2 * r, r * 1.16);
    G.beginPath(); G.arc(x, y + r, r, 0, Math.PI); G.fill();
    G.strokeStyle = 'rgba(0,0,0,0.22)'; G.lineWidth = Math.max(1, s * 0.04);
    G.beginPath(); G.arc(x, y, r, Math.PI, 0); G.stroke();
    G.fillStyle = 'rgba(255,255,255,0.85)';
    G.beginPath(); G.arc(x, y - r * 0.25, r * 0.28, 0, Math.PI * 2); G.fill();
  } else if (e.type === 'double') {
    const r = s * 0.55, bx = x - r, by = y - r;
    G.fillStyle = vGrad(bx, by, bx, by + 2 * r, '#f1c40f');
    G.beginPath(); G.arc(x, y, r, 0, Math.PI * 2); G.fill();
    strokeRound(bx, by, 2 * r, 2 * r, r, Math.max(1, s * 0.04));
    G.fillStyle = '#2c3e50';
    G.font = 'bold ' + Math.max(12, s * 0.6) + 'px sans-serif';
    G.textAlign = 'center'; G.textBaseline = 'middle';
    G.fillText('×2', x, y);
  } else if (e.type === 'rocket') {
    const w = s * 0.9, h = s * 1.3;
    G.fillStyle = vGrad(x - w / 2, y - h * 0.55, x - w / 2, y + h * 0.4, '#95a5a6');
    G.beginPath(); G.moveTo(x, y - h * 0.55); G.lineTo(x + w / 2, y); G.lineTo(x, y + h * 0.4); G.lineTo(x - w / 2, y); G.closePath(); G.fill();
    G.strokeStyle = 'rgba(0,0,0,0.22)'; G.lineWidth = Math.max(1, s * 0.04);
    G.beginPath(); G.moveTo(x, y - h * 0.55); G.lineTo(x + w / 2, y); G.lineTo(x, y + h * 0.4); G.lineTo(x - w / 2, y); G.closePath(); G.stroke();
    G.fillStyle = '#e74c3c';
    G.beginPath(); G.moveTo(x - s * 0.2, y + h * 0.4); G.lineTo(x, y + h * 0.95); G.lineTo(x + s * 0.2, y + h * 0.4); G.closePath(); G.fill();
    G.fillStyle = '#34495e';
    G.beginPath(); G.arc(x, y - s * 0.15, s * 0.18, 0, Math.PI * 2); G.fill();
  }
  G.restore();
}

// 危险车道预告带：致命障碍所在车道在地面画半透明红色拖尾（朝玩家方向），
// 障碍在远端时就能量出「哪条道被占」，提前决策 —— 解决远小近大看不清的问题。
function drawDangerBands() {
  const halfW = C.LANE_SPACING * 0.42;     // 车道内带宽（略窄于整道，留出道缝）
  for (const e of world.entities) {
    if (e.got) continue;
    const t = e.type;
    if (t !== 'fence' && t !== 'bar' && t !== 'bomb' && t !== 'train' && t !== 'gap') continue;
    if (e.z <= C.PLAYER_Z - 0.5 || e.z > C.Z_FAR) continue;
    const laneX = laneWorldX(e.lane);
    const z0 = e.z;                                   // 障碍处（亮端）
    const z1 = Math.max(C.PLAYER_Z - 0.3, e.z - 4.2); // 朝玩家拖尾（淡端）
    const pA = proj(z0, laneX - halfW);
    const pB = proj(z0, laneX + halfW);
    const pC = proj(z1, laneX + halfW);
    const pD = proj(z1, laneX - halfW);
    const g = G.createLinearGradient(0, pA.y, 0, pD.y);
    g.addColorStop(0, 'rgba(231,76,60,0.20)');
    g.addColorStop(1, 'rgba(231,76,60,0.02)');
    G.fillStyle = g;
    G.beginPath();
    G.moveTo(pA.x, pA.y); G.lineTo(pB.x, pB.y); G.lineTo(pC.x, pC.y); G.lineTo(pD.x, pD.y);
    G.closePath(); G.fill();
  }
}

function drawEntity(e) {
  if (e.type === 'fence') drawFence(e);
  else if (e.type === 'bar') drawBar(e);
  else if (e.type === 'bomb') drawBomb(e);
  else if (e.type === 'coin') drawCoin(e);
  else if (e.type === 'star') drawStar(e);
  else if (e.type === 'boost') drawBoost(e);
  else if (e.type === 'train') drawTrain(e);
  else if (e.type === 'gap') drawGap(e);
  else if (e.type === 'gate') drawGate(e);
  else if (e.type === 'magnet' || e.type === 'shield' || e.type === 'double' || e.type === 'rocket') drawPower(e);
}

// ---- 旗门（滑雪竞速：红/蓝交替旗杆对，穿过得分）----
function drawGate(e) {
  const cx = laneWorldX(e.lane);
  const pL = proj(e.z, cx - C.GATE_HALF_W);
  const pR = proj(e.z, cx + C.GATE_HALF_W);
  const sc = pL.scale;
  const y = pL.y - elevOffset(e.z);
  const h = worldSize(0.95, sc);
  const color = e.color === 'red' ? '#e74c3c' : '#3498db';
  const wob = Math.sin(performance.now() / 240 + e.z * 3) * worldSize(0.03, sc);
  // 已过的门淡出一点（反馈感）
  G.globalAlpha = e.passed ? 0.55 : 1;
  for (const [px, dir] of [[pL.x, -1], [pR.x, 1]]) {
    // 杆
    G.strokeStyle = '#f5f6fa';
    G.lineWidth = Math.max(1.5, worldSize(0.05, sc));
    G.beginPath();
    G.moveTo(px, y);
    G.lineTo(px, y - h);
    G.stroke();
    // 矩形布旗（随风微摆）
    G.fillStyle = color;
    G.beginPath();
    G.moveTo(px, y - h);
    G.lineTo(px + dir * worldSize(0.3, sc), y - h + worldSize(0.06, sc) + wob);
    G.lineTo(px + dir * worldSize(0.3, sc), y - h + worldSize(0.3, sc) + wob);
    G.lineTo(px, y - h + worldSize(0.34, sc));
    G.closePath();
    G.fill();
    // 杆底雪窝
    G.fillStyle = 'rgba(100,140,175,0.3)';
    G.beginPath(); G.ellipse(px, y, worldSize(0.09, sc), worldSize(0.03, sc), 0, 0, Math.PI * 2); G.fill();
  }
  G.globalAlpha = 1;
}

function drawSpeedLines() {
  if (game.boostT <= 0 && game.rocketT <= 0 && game.feverT <= 0) return;
  G.save();
  G.strokeStyle = 'rgba(255,255,255,0.5)';
  G.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * W;
    const y = horizonY() + Math.random() * (H - horizonY());
    const len = 30 + Math.random() * 50;
    G.beginPath();
    G.moveTo(x, y);
    G.lineTo(x, y + len);
    G.stroke();
  }
  G.restore();
}

function drawCountdown() {
  if (game.state !== 'playing') return;
  if (game.countT > 0) {
    const n = Math.ceil(game.countT / C.COUNTDOWN_STEP);
    G.save();
    G.textAlign = 'center'; G.textBaseline = 'middle';
    G.font = 'bold 92px sans-serif';
    G.fillStyle = 'rgba(255,255,255,0.94)';
    G.shadowColor = 'rgba(20,60,90,0.55)';
    G.shadowBlur = 22;
    G.fillText(String(n), W / 2, H * 0.4);
    G.restore();
  } else if (game.goT > 0) {
    G.save();
    G.textAlign = 'center'; G.textBaseline = 'middle';
    G.font = 'bold 72px sans-serif';
    G.fillStyle = 'rgba(255,211,77,' + (game.goT / C.GO_FLASH) + ')';
    G.shadowColor = '#ffd34d'; G.shadowBlur = 18;
    G.fillText('GO!', W / 2, H * 0.4);
    G.restore();
  }
}

function drawTutorialHint() {
  if (!game.tutorial || game.state !== 'playing') return;
  let label = null;
  for (const e of world.entities) {
    if (e.lane !== player.lane) continue;
    if (e.type === 'fence' && e.z < 9 && e.z > C.PLAYER_Z - 1) { label = '按 ↑ / 上滑 跳跃!'; break; }
    if (e.type === 'bar' && e.z < 9 && e.z > C.PLAYER_Z - 1) { label = '按 ↓ / 下滑 蹲下!'; break; }
    if (e.type === 'gap' && e.z < 9 && e.z > C.PLAYER_Z - 1) { label = '按 ←→ 换道 绕开冰裂缝!'; break; }
  }
  if (label) {
    G.save();
    G.textAlign = 'center'; G.textBaseline = 'middle';
    G.font = 'bold 26px sans-serif';
    G.fillStyle = 'rgba(255,255,255,0.96)';
    G.shadowColor = 'rgba(20,40,60,0.6)'; G.shadowBlur = 8;
    G.fillText(label, W / 2, H * 0.62);
    G.restore();
  }
}

function drawFallPrompt() {
  if (game.fallT <= 0) return;
  G.save();
  G.fillStyle = 'rgba(20,30,50,0.55)';
  G.fillRect(0, H * 0.4, W, 64);
  G.fillStyle = '#fff';
  G.font = 'bold 24px sans-serif';
  G.textAlign = 'center';
  G.fillText('摔倒了！快速连点 起身！(' + game.fallTaps + '/3)', W / 2, H * 0.4 + 40);
  G.restore();
}

// ---- HUD（节流更新）----
const hudEls = {
  dist: document.getElementById('dist'),
  score: document.getElementById('score'),
  coins: document.getElementById('coins'),
  best: document.getElementById('best'),
  combo: document.getElementById('comboShow'),
  feverFill: document.getElementById('feverFill'),
  power: document.getElementById('power'),
  questPanel: document.getElementById('questPanel'),
};
let lastHud = { dist: -1, score: -1, coins: -1, best: -1, combo: -1, feverPct: -1, badges: '', quests: '' };

function updateHud() {
  const d = Math.floor(game.distance);
  const sc = Math.floor(game.score);
  if (d !== lastHud.dist) { hudEls.dist.textContent = d; lastHud.dist = d; }
  if (sc !== lastHud.score) { hudEls.score.textContent = sc; lastHud.score = sc; }
  if (game.coins !== lastHud.coins) { hudEls.coins.textContent = game.coins; lastHud.coins = game.coins; }
  if (game.best !== lastHud.best) { hudEls.best.textContent = game.best; lastHud.best = game.best; }
  const comboText = game.combo > 1 ? '连击 ×' + game.combo : '';
  if (comboText !== lastHud.combo) { hudEls.combo.textContent = comboText; lastHud.combo = comboText; }

  const feverPct = game.feverT > 0 ? 100 : Math.floor(game.feverGauge);
  if (feverPct !== lastHud.feverPct) {
    hudEls.feverFill.style.width = feverPct + '%';
    lastHud.feverPct = feverPct;
  }
  hudEls.feverFill.classList.toggle('on', game.feverT > 0);

  let badge = '';
  if (game.feverT > 0) badge += '<span class="badge fever">🔥Fever ' + Math.ceil(game.feverT) + 's</span>';
  if (game.dizzyT > 0) badge += '<span class="badge stun">晕 ' + game.stunCount + '/3</span>';
  if (game.invincT > 0) badge += '<span class="badge star">无敌 ' + Math.ceil(game.invincT) + 's</span>';
  if (game.boostT > 0) badge += '<span class="badge boost">加速 ' + Math.ceil(game.boostT) + 's</span>';
  if (game.magnetT > 0) badge += '<span class="badge magnet">磁铁 ' + Math.ceil(game.magnetT) + 's</span>';
  if (game.shield > 0) badge += '<span class="badge shield">🛡护盾</span>';
  if (game.doubleT > 0) badge += '<span class="badge double">双倍 ' + Math.ceil(game.doubleT) + 's</span>';
  if (game.rocketT > 0) badge += '<span class="badge rocket">🚀火箭 ' + Math.ceil(game.rocketT) + 's</span>';
  if (game.distance >= C.PHASE.startDist) {
    const pl = game.phase === 'calm' ? '🌿喘息' : game.phase === 'surge' ? '⚡高潮' : '常规';
    badge += '<span class="badge phase ' + game.phase + '">' + pl + '</span>';
  }
  if (badge !== lastHud.badges) {
    hudEls.power.innerHTML = badge;
    lastHud.badges = badge;
  }

  // 单局任务面板
  if (game.quests) {
    let html = '';
    for (const q of game.quests) {
      const p = Math.min(q.progress, q.target);
      html += '<div class="q' + (q.done ? ' done' : '') + '"><span class="qt">' + q.text +
        '</span><span class="qp">' + p + '/' + q.target + '</span></div>';
    }
    if (html !== lastHud.quests) { hudEls.questPanel.innerHTML = html; lastHud.quests = html; }
  }
}

// ---- 主渲染 ----
export function render() {
  // 欢乐打雪仗：状态路由到独立模块
  if (game.state === 'snowfight') { snowfight.renderSnowFight(); return; }
  // 打雪仗屏幕控制条随状态显隐（每帧校正，离开即隐藏）
  const fc = document.getElementById('fightControls');
  if (fc) fc.classList.toggle('show', game.state === 'snowfight');
  const playing = game.state === 'playing';
  // C2/C3/C4: 相机变换（震屏 + 过弯 roll）统一在外层 save
  const camTransform = (game.shake > 0) || (Math.abs(game.camRollNow) > 0.001);
  if (camTransform) G.save();
  G.clearRect(-120, -120, W + 240, H + 240);   // 扩大清除，防 roll 后四角残留上帧
  if (game.shake > 0) {
    const amp = game.shake * 14;
    G.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
  }
  if (Math.abs(game.camRollNow) > 0.001) {
    // C3: 过弯相机 roll——绕屏幕中上方旋转，地平线随弯倾斜（电影感入弯，与玩家压弯同向）
    G.translate(W / 2, H * 0.42);
    G.rotate(game.camRollNow);
    G.translate(-W / 2, -H * 0.42);
  }

  // 静态世界背景（天空+地面+松树）走离屏缓存，菜单/暂停态 distance 不变→零重算
  drawWorld();
  drawBirds();

  if (playing) {
    drawDangerBands();          // 危险车道预告带（地面，实体之下）
    drawSpeedFlowLines();
    drawPlayerSkiTracks();

    // 按 z 排序（far→near），雪崩墙按遮挡关系插入绘制
    const sorted = world.entities;
    sorted.sort((a, b) => b.z - a.z);
    for (const e of sorted) { if (e.got) continue; if (e.z > game.avalancheZ) drawEntity(e); }
    drawAvalanche();
    for (const e of sorted) { if (e.got) continue; if (e.z <= game.avalancheZ) drawEntity(e); }

    drawSpeedLines();
    vfx.draw();

    // V5: Fever 蒙层改边缘渐变（中心留清、边缘暖色脉动，不糊焦点，避免长期眩晕）
    if (game.feverT > 0) {
      const pulse = 0.10 + 0.07 * (0.5 + 0.5 * Math.sin(performance.now() / 140));
      const fg = G.createRadialGradient(W / 2, H * 0.55, H * 0.20, W / 2, H * 0.55, H * 0.72);
      fg.addColorStop(0, 'rgba(255,211,77,0)');
      fg.addColorStop(0.7, 'rgba(255,211,77,' + (pulse * 0.5).toFixed(3) + ')');
      fg.addColorStop(1, 'rgba(255,180,40,' + pulse.toFixed(3) + ')');
      G.fillStyle = fg;
      G.fillRect(0, 0, W, H);
    }

    // 雪崩真实威胁：红色边缘压迫渐变（avaDanger 0~1 驱动，冲击波/小雪崩逼近越近越红）
    if (game.avaDanger > 0.01) {
      const d = game.avaDanger;
      const rg = G.createRadialGradient(W / 2, H * 0.5, H * 0.30, W / 2, H * 0.5, H * 0.78);
      rg.addColorStop(0, 'rgba(255,45,45,0)');
      rg.addColorStop(1, 'rgba(255,45,45,' + (0.55 * d).toFixed(3) + ')');
      G.fillStyle = rg;
      G.fillRect(0, 0, W, H);
    }

    for (const p of world.popups) {
      G.save();
      G.globalAlpha = Math.min(1, p.t);
      G.fillStyle = p.text.indexOf('擦身') >= 0 || p.text.indexOf('换道') >= 0 ? '#ffd34d' : '#5eead4';
      G.font = 'bold 22px sans-serif';
      G.textAlign = 'center';
      G.fillText(p.text, p.x, p.y);
      G.restore();
    }
  }

  drawSkier();
  drawFallPrompt();
  drawSnow();
  drawCountdown();
  drawTutorialHint();
  updateHud();

  // 相机变换恢复（震屏 + 过弯 roll 统一在外层 save）
  if (camTransform) G.restore();

  drawCarveTip();   // 压弯教学提示（不随相机旋转，稳定显示）
}

// 压弯教学提示：首次明显入弯时引导玩家朝弯内压弯（carve 是隐藏高分技巧）
function drawCarveTip() {
  if (game.carveTipT <= 0) return;
  const a = Math.min(1, game.carveTipT);
  G.save();
  G.globalAlpha = a;
  const w = 340, h = 56, x = W / 2 - w / 2, y = H * 0.15;
  G.fillStyle = 'rgba(18,38,58,0.72)';
  G.beginPath(); G.roundRect(x, y, w, h, 12); G.fill();
  G.textAlign = 'center';
  G.fillStyle = '#fff'; G.font = 'bold 16px sans-serif';
  G.fillText('↪ 入弯！按 ←/→ 朝弯内压，抵消离心力', W / 2, y + 23);
  G.fillStyle = '#ffd34d'; G.font = '13px sans-serif';
  G.fillText('压弯侧倾会喷出雪雾，是高分技巧', W / 2, y + 44);
  G.restore();
}
