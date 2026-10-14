// snowfight.js —— 「欢乐打雪仗」小游戏（完全自包含）
// 状态：game.state === 'snowfight' 时主循环路由到此。
// 玩法：小人站底部中央手持雪球，空格/点屏投雪球；怪兽从上方逼近，击杀得金币，
//       按 U/按钮消费金币升级雪球（伤害/体积/射速/穿透），才能清掉越来越硬的怪。
import { game, W, H, toMenu } from './state.js';
import { canvas } from './canvas.js';
import * as audio from './audio.js';
import * as storage from './storage.js';
import * as achv from './achievements.js';
import * as meta from './meta.js';
import * as C from './config.js';
const G = canvas.getContext('2d');

// ---- 可调参数 ----
const PLAYER_Y_OFF = 86;        // 玩家距底高度
const PLAYER_SPEED = 330;       // 左右移动速度 px/s
const SHIFT_MARGIN = 70;        // 玩家左右活动边界
const BALL_SPEED = 600;         // 雪球初速 px/s
const MAX_LV = 8;
const PLAYER_MAX_HP = 100;
const HIT_DMG = 10;             // 怪兽/弹幕撞击玩家伤害
const WAVE_KILLS = 6;           // 每累计多少击杀升一波
const BOSS_EVERY = 5;           // 每 N 波出 1 个首领

const lvDamage = (lv) => 1 + (lv - 1) * 0.9;
const lvRadius = (lv) => 6 + lv * 1.3;
const lvCd = (lv) => Math.max(0.12, 0.30 - lv * 0.022);
const lvPierce = (lv) => lv >= 6 ? 2 : lv >= 4 ? 1 : 0;     // 穿透层数
const upCost = (lv) => lv * 15;                              // 升级花费（前期降门槛）

// 怪兽模板（基础值，随波次放大；k 封顶防无限膨胀）
const MOB = {
  normal:  { hp: 3, speed: 72, r: 18, reward: 4, color: '#5b8def', name: '雪怪' },
  fast:    { hp: 2, speed: 138, r: 14, reward: 3, color: '#3fc97a', name: '疾雪' },
  armor:   { hp: 7, speed: 46, r: 23, reward: 9, color: '#8a93a6', name: '铁甲' },
  shooter: { hp: 5, speed: 64, r: 19, reward: 8, color: '#c065d6', name: '投弹手' },
  boss:    { hp: 70, speed: 40, r: 40, reward: 60, color: '#9b59b6', name: '雪怪首领' },
};

let sf = null;

export function startSnowFight() {
  game.state = 'snowfight';
  meta.beginRun();
  meta.registerStreak();
  sf = {
    shift: 0, left: false, right: false,
    hp: PLAYER_MAX_HP, coins: 0, lv: 1, kills: 0, wave: 1,
    cd: 0, balls: [], mobs: [], pops: [], projs: [],
    spawnCd: 0.8, spawnBossCd: BOSS_EVERY,
    over: false, paused: false, deposited: false,
    bossKills: 0, flash: 0, t: 0,
  };
}

function playerPos() { return { x: W / 2 + sf.shift, y: H - PLAYER_Y_OFF }; }

export function throwBall() {
  if (game.state !== 'snowfight' || !sf) return;
  if (sf.over) { toMenu(); return; }
  if (sf.paused) return;
  if (sf.cd > 0) return;
  const p = playerPos();
  const sx = p.x, sy = p.y - 48;
  const angles = sf.lv >= 6 ? [-0.2, 0, 0.2] : [0];    // Lv6+ 三向散射
  for (const a of angles) {
    sf.balls.push({
      x: sx, y: sy, vx: Math.sin(a) * BALL_SPEED, vy: -Math.cos(a) * BALL_SPEED,
      r: lvRadius(sf.lv), dmg: lvDamage(sf.lv), pierce: lvPierce(sf.lv), hit: new Set(),
    });
  }
  sf.cd = lvCd(sf.lv);
  audio.sfxThrow();
}

export function upgrade() {
  if (game.state !== 'snowfight' || !sf || sf.over || sf.paused) return;
  if (sf.lv >= MAX_LV) return;
  const cost = upCost(sf.lv);
  if (sf.coins < cost) return;
  sf.coins -= cost;
  sf.lv++;
  audio.sfxUpgrade();
}

export function moveLeft(on) { if (sf) sf.left = on; }
export function moveRight(on) { if (sf) sf.right = on; }
export function togglePauseFight() { if (sf && !sf.over) sf.paused = !sf.paused; }

export function updateSnowFight(dt) {
  if (game.state !== 'snowfight' || !sf) return;
  if (sf.over || sf.paused) return;
  sf.t += dt;

  // 玩家移动
  const lim = W / 2 - SHIFT_MARGIN;
  if (sf.left) sf.shift -= PLAYER_SPEED * dt;
  if (sf.right) sf.shift += PLAYER_SPEED * dt;
  sf.shift = Math.max(-lim, Math.min(lim, sf.shift));
  if (sf.cd > 0) sf.cd -= dt;
  if (sf.flash > 0) sf.flash = Math.max(0, sf.flash - dt * 2);
  const p = playerPos();

  // 生成怪兽
  sf.spawnCd -= dt;
  if (sf.spawnCd <= 0) {
    spawnMob(p);
    sf.spawnCd = Math.max(0.45, 1.1 - sf.wave * 0.05);
  }
  // 首领波
  if (sf.wave >= sf.spawnBossCd) {
    spawnBoss(p);
    sf.spawnBossCd += BOSS_EVERY;
  }

  // 雪球运动 + 碰撞（支持穿透）
  for (let i = sf.balls.length - 1; i >= 0; i--) {
    const b = sf.balls[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -20 || b.x < -20 || b.x > W + 20) { sf.balls.splice(i, 1); continue; }
    let removed = false;
    for (let j = sf.mobs.length - 1; j >= 0; j--) {
      const m = sf.mobs[j];
      if (b.hit.has(m)) continue;
      const dx = b.x - m.x, dy = b.y - m.y;
      if (dx * dx + dy * dy <= (b.r + m.r) * (b.r + m.r)) {
        b.hit.add(m);
        m.hp -= b.dmg;
        audio.sfxHit();
        if (m.hp <= 0) killMob(j);
        if (b.pierce > 0) b.pierce--;
        else { sf.balls.splice(i, 1); removed = true; break; }
      }
    }
    if (removed) continue;
  }

  // 怪兽运动 + 撞击玩家 + 投弹手攻击
  for (let j = sf.mobs.length - 1; j >= 0; j--) {
    const m = sf.mobs[j];
    if (m.type === 'boss' || m.type === 'shooter') {
      // 下降到指定高度后悬停，周期性攻击
      const targetY = m.type === 'boss' ? H * 0.20 : H * 0.30;
      if (m.y < targetY) m.y += m.speed * dt;
      else {
        m.fireT = (m.fireT || 0) - dt;
        if (m.fireT <= 0) {
          m.fireT = m.type === 'boss' ? 1.1 : 1.5;
          const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
          const sp = 240;
          sf.projs.push({ x: m.x, y: m.y + m.r, vx: dx / d * sp, vy: dy / d * sp, r: 8 });
          audio.sfxShoot();
        }
      }
    } else {
      m.y += m.speed * dt;
    }
    m.x += (p.x - m.x) * 0.35 * dt;   // 轻微追踪玩家
    const dx = m.x - p.x, dy = m.y - p.y;
    if (dx * dx + dy * dy <= (m.r + 26) * (m.r + 26)) {
      sf.hp -= HIT_DMG; sf.flash = 1;
      audio.sfxHurt();
      sf.mobs.splice(j, 1);
      if (sf.hp <= 0) { sf.hp = 0; gameOver(); }
    }
  }

  // 敌方弹幕
  for (let i = sf.projs.length - 1; i >= 0; i--) {
    const q = sf.projs[i];
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.y > H + 20 || q.x < -20 || q.x > W + 20) { sf.projs.splice(i, 1); continue; }
    const dx = q.x - p.x, dy = q.y - p.y;
    if (dx * dx + dy * dy <= (q.r + 24) * (q.r + 24)) {
      sf.hp -= HIT_DMG; sf.flash = 1; audio.sfxHurt();
      sf.projs.splice(i, 1);
      if (sf.hp <= 0) { sf.hp = 0; gameOver(); }
    }
  }

  // 死亡爆点 / 文字弹窗
  for (let i = sf.pops.length - 1; i >= 0; i--) {
    const q = sf.pops[i];
    if (q.vx !== undefined) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 200 * dt; }
    q.life -= dt;
    if (q.life <= 0) sf.pops.splice(i, 1);
  }

  // 升波
  if (sf.kills >= sf.wave * WAVE_KILLS) {
    sf.wave++;
    audio.sfxWave();
  }
}

function gameOver() {
  sf.over = true;
  audio.sfxLose();
  // 资产互通：打雪仗金币并入钱包
  if (!sf.deposited) {
    sf.deposited = true;
    storage.addCoins(sf.coins);
    achv.checkSnowfight(sf);
    // 成瘾：本局保底宝箱 + 段位累计 + 每日榜/目标
    const boxesGained = C.BOX_GAIN_PER_RUN;
    meta.grantBox(boxesGained);
    meta.recordRun(0, 0, sf.kills);
    meta.recordDaily(sf.kills * 10, sf.kills);
    meta.checkDailyObjective({ kills: sf.kills });
    sf.boxGain = boxesGained;
    sf.crystalGained = meta.sessionCrystal();
  }
}

function spawnMob(p) {
  const r = Math.random();
  let type = 'normal';
  if (sf.wave >= 3 && r > 0.72) type = 'shooter';
  else if (sf.wave >= 2 && r > 0.55) type = 'armor';
  else if (r > 0.4) type = 'fast';
  const t = MOB[type];
  const k = 1 + Math.min(sf.wave, 14) * 0.22;     // 难度 plateau：wave14 后血量不再增长
  sf.mobs.push({
    type, x: 40 + Math.random() * (W - 80), y: -30,
    r: t.r, color: t.color, speed: t.speed + sf.wave * 4,
    hp: t.hp * k, maxHp: t.hp * k, reward: t.reward,
  });
}

function spawnBoss(p) {
  const k = 1 + Math.min(sf.wave, 14) * 0.22;
  sf.mobs.push({
    type: 'boss', x: W / 2 + (Math.random() - 0.5) * 120, y: -60,
    r: MOB.boss.r, color: MOB.boss.color, speed: MOB.boss.speed,
    hp: MOB.boss.hp * k, maxHp: MOB.boss.hp * k, reward: MOB.boss.reward, fireT: 1.2,
  });
  audio.sfxBoss();
}

function killMob(j) {
  const m = sf.mobs[j];
  sf.coins += m.reward;
  sf.kills++;
  // 成瘾：击杀有概率掉结晶（可变奖励）
  const dc = meta.dropCrystal();
  if (dc) sf.pops.push({ x: m.x, y: m.y, text: '💎' + (dc.skin ? meta.skinName(dc.skin) : '+' + dc.amt), life: 0.9, big: true });
  if (m.type === 'boss') sf.bossKills++;
  audio.sfxKill();
  for (let n = 0; n < (m.type === 'boss' ? 16 : 7); n++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 120;
    sf.pops.push({ x: m.x, y: m.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 });
  }
  sf.mobs.splice(j, 1);
}

// ---- 渲染 ----
export function renderSnowFight() {
  if (!sf) return;
  // 背景（雪地场景，区别于滑雪天空）
  const sky = G.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#9fd8f0');
  sky.addColorStop(0.5, '#dff3fb');
  sky.addColorStop(0.52, '#f4fbff');
  sky.addColorStop(1, '#e7f4ff');
  G.fillStyle = sky;
  G.fillRect(0, 0, W, H);

  // 远处松树剪影点缀
  G.fillStyle = 'rgba(150,200,170,0.5)';
  for (let i = 0; i < 7; i++) {
    const tx = (i + 0.5) * (W / 7), ty = H * 0.5;
    G.beginPath();
    G.moveTo(tx, ty - 36); G.lineTo(tx - 14, ty); G.lineTo(tx + 14, ty);
    G.closePath(); G.fill();
  }

  const p = playerPos();
  for (const m of sf.mobs) drawMob(m);
  for (const q of sf.projs) {
    G.fillStyle = '#c065d6';
    G.beginPath(); G.arc(q.x, q.y, q.r, 0, Math.PI * 2); G.fill();
    G.fillStyle = 'rgba(192,101,214,0.4)';
    G.beginPath(); G.arc(q.x, q.y, q.r + 3, 0, Math.PI * 2); G.fill();
  }
  for (const q of sf.pops) {
    G.globalAlpha = Math.max(0, q.life / (q.big ? 0.9 : 0.5));
    if (q.text) {
      G.fillStyle = '#3b6fd4';
      G.font = 'bold 16px sans-serif';
      G.textAlign = 'center';
      G.fillText(q.text, q.x, q.y - 30);
      G.textAlign = 'left';
    } else {
      G.fillStyle = '#fff';
      G.beginPath(); G.arc(q.x, q.y, 3, 0, Math.PI * 2); G.fill();
    }
  }
  G.globalAlpha = 1;
  for (const b of sf.balls) {
    G.fillStyle = '#ffffff';
    G.strokeStyle = 'rgba(120,160,200,0.6)';
    G.lineWidth = 1.5;
    G.beginPath(); G.arc(b.x, b.y, b.r, 0, Math.PI * 2); G.fill(); G.stroke();
  }
  drawPlayer(p);

  if (sf.flash > 0) {
    G.fillStyle = 'rgba(255,60,60,' + (sf.flash * 0.28).toFixed(3) + ')';
    G.fillRect(0, 0, W, H);
  }

  drawHud();
  if (sf.paused) drawPause();
  if (sf.over) drawOver();
}

function drawPlayer(p) {
  G.fillStyle = '#2b6cb0';
  G.beginPath(); G.roundRect(p.x - 14, p.y - 18, 28, 40, 10); G.fill();
  G.fillStyle = '#ffd9b3';
  G.beginPath(); G.arc(p.x, p.y - 30, 13, 0, Math.PI * 2); G.fill();
  G.fillStyle = '#e74c3c';
  G.beginPath(); G.arc(p.x, p.y - 34, 13, Math.PI, 0); G.fill();
  G.fillRect(p.x - 13, p.y - 36, 26, 5);
  G.strokeStyle = '#ffd9b3'; G.lineWidth = 6; G.lineCap = 'round';
  G.beginPath(); G.moveTo(p.x + 10, p.y - 10); G.lineTo(p.x + 22, p.y - 40); G.stroke();
  G.fillStyle = '#fff';
  G.beginPath(); G.arc(p.x + 24, p.y - 46, 8, 0, Math.PI * 2); G.fill();
}

function drawMob(m) {
  G.fillStyle = m.color;
  if (m.type === 'fast') {
    G.beginPath();
    G.moveTo(m.x, m.y - m.r); G.lineTo(m.x + m.r, m.y + m.r); G.lineTo(m.x - m.r, m.y + m.r);
    G.closePath(); G.fill();
  } else if (m.type === 'armor' || m.type === 'boss') {
    G.beginPath(); G.roundRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2, 6); G.fill();
  } else {
    G.beginPath(); G.arc(m.x, m.y, m.r, 0, Math.PI * 2); G.fill();
  }
  // 眼睛
  G.fillStyle = '#fff';
  G.beginPath(); G.arc(m.x - m.r * 0.35, m.y - m.r * 0.2, m.r * 0.22, 0, Math.PI * 2); G.fill();
  G.beginPath(); G.arc(m.x + m.r * 0.35, m.y - m.r * 0.2, m.r * 0.22, 0, Math.PI * 2); G.fill();
  G.fillStyle = '#222';
  G.beginPath(); G.arc(m.x - m.r * 0.35, m.y - m.r * 0.2, m.r * 0.1, 0, Math.PI * 2); G.fill();
  G.beginPath(); G.arc(m.x + m.r * 0.35, m.y - m.r * 0.2, m.r * 0.1, 0, Math.PI * 2); G.fill();
  // 血条
  const w = m.r * 2, hp = Math.max(0, m.hp / m.maxHp);
  G.fillStyle = 'rgba(0,0,0,0.35)'; G.fillRect(m.x - w / 2, m.y - m.r - 10, w, 4);
  G.fillStyle = hp > 0.5 ? '#5fd36a' : hp > 0.25 ? '#ffcf33' : '#ff6b6b';
  G.fillRect(m.x - w / 2, m.y - m.r - 10, w * hp, 4);
  if (m.type === 'boss') {
    G.fillStyle = '#fff'; G.font = 'bold 13px sans-serif'; G.textAlign = 'center';
    G.fillText('❄ 雪怪首领', m.x, m.y - m.r - 16);
  }
}

function drawHud() {
  G.fillStyle = 'rgba(0,0,0,0.35)';
  G.fillRect(14, 14, 180, 18);
  G.fillStyle = sf.hp > 30 ? '#5fd36a' : '#ff6b6b';
  G.fillRect(14, 14, 180 * (sf.hp / PLAYER_MAX_HP), 18);
  G.fillStyle = '#fff'; G.font = 'bold 13px sans-serif'; G.textAlign = 'left';
  G.fillText('❤ ' + Math.ceil(sf.hp) + '/' + PLAYER_MAX_HP, 20, 28);

  G.textAlign = 'right';
  G.fillStyle = '#d98324'; G.font = 'bold 16px sans-serif';
  G.fillText('💰 ' + sf.coins, W - 14, 28);
  G.fillStyle = '#1b3a4b'; G.font = 'bold 14px sans-serif';
  G.fillText('波次 ' + sf.wave + ' · 击杀 ' + sf.kills, W - 14, 50);

  G.textAlign = 'left';
  const canUp = sf.coins >= upCost(sf.lv) && sf.lv < MAX_LV;
  G.fillStyle = '#1b3a4b'; G.font = 'bold 15px sans-serif';
  G.fillText('雪球 Lv.' + sf.lv + '  伤害 ' + lvDamage(sf.lv).toFixed(1) + (sf.lv >= 4 ? '  穿透' + lvPierce(sf.lv) : '') + (sf.lv >= 6 ? '  三向' : ''), 14, H - 46);
  G.fillStyle = sf.lv >= MAX_LV ? '#888' : (canUp ? '#27ae60' : '#e67e22');
  G.fillText(sf.lv >= MAX_LV ? '已满级' : 'U/按钮 升级 (花费 ' + upCost(sf.lv) + ' 金币)' + (canUp ? ' ✓' : ''), 14, H - 26);

  G.textAlign = 'center';
  G.fillStyle = 'rgba(27,58,75,0.7)'; G.font = '13px sans-serif';
  G.fillText('空格/点屏 投雪球  ·  ←/→ 移动  ·  U 升级  ·  Esc 暂停', W / 2, H - 12);
}

function drawPause() {
  G.fillStyle = 'rgba(20,40,60,0.55)';
  G.fillRect(0, 0, W, H);
  G.textAlign = 'center';
  G.fillStyle = '#fff'; G.font = 'bold 36px sans-serif';
  G.fillText('⏸ 已暂停', W / 2, H / 2 - 10);
  G.font = '16px sans-serif';
  G.fillText('按 Esc / 暂停按钮 继续', W / 2, H / 2 + 30);
}

function drawOver() {
  G.fillStyle = 'rgba(20,40,60,0.6)';
  G.fillRect(0, 0, W, H);
  G.textAlign = 'center';
  G.fillStyle = '#fff'; G.font = 'bold 34px sans-serif';
  G.fillText('❄️ 被怪兽击溃！', W / 2, H / 2 - 40);
  G.font = '18px sans-serif';
  G.fillStyle = '#ffd34d';
  G.fillText('击杀 ' + sf.kills + ' · 波次 ' + sf.wave + ' · 金币 +' + sf.coins + '(已入账)', W / 2, H / 2);
  G.fillStyle = '#7fe3d4'; G.font = '16px sans-serif';
  G.fillText('💎 结晶 +' + (sf.crystalGained || 0) + '  ·  🎁 宝箱 +' + (sf.boxGain || 0), W / 2, H / 2 + 26);
  G.fillStyle = '#fff'; G.font = '16px sans-serif';
  G.fillText('按 空格 / 点击 返回主菜单', W / 2, H / 2 + 56);
}
