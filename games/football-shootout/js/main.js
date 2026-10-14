// =====================================================================
//  热血足球 · 定位球射门挑战（主模块）
//  单人玩法：我方控制 1 名射手踢定位球，对方 1 名电脑守门员
//  逐球加难：每进一球 → 守门员更快、扑救更准、球门缩小
//  保留 13 队专属必杀射门 + 特效
// =====================================================================
import { VW, VH, FW, FH, RIGHT_GOAL_X, GOAL_CY, KICK_SPOT_X,
         TEAMS, TEAM_KEYS, CFG } from './config.js';
import * as fx from './fx.js';
import { loadBest, saveBest, loadSettings, saveSettings } from './save.js';

// ---------- 画布 / 像素渲染 ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VW; canvas.height = VH;
ctx.imageSmoothingEnabled = false;

// ---------- 全局状态 ----------
let gameState = 'menu';   // menu | playing | goal | paused | over
let teamKey = 'brazil';
let userColor, userDark, cpuColor = '#DC2626', cpuDark = '#7F1D1D';
let shooter = null, gk = null, ball = null;
let streak = 0;                 // 连续进球数
let level = 1;                  // 难度等级
let goalHalf = CFG.GOAL_HALF_BASE;
let scrollX = 0;
let charging = false, charge = 0;
let lastTime = 0;
let keys = {};
let ballPuff = 0;

function shakeIt(v) { /* 屏震由 fx 持有，此处仅取最大值 */ fx.addShake(v); }
function spawnShock(x, y, ang, n, color) { fx.spawnShock(x, y, ang, n, color); }
function spawnDust(x, y) { fx.spawnDust(x, y); }

// =====================================================================
//  球员
// =====================================================================
class Player {
  constructor(team, role, x, y) {
    this.team = team; this.role = role;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.hasBall = false; this.kickCD = 0; this.downTimer = 0;
    this.kickAnim = 0;
    this.crouch = 0;
    this.facing = 1;
    this.runPhase = Math.random() * 6;
    this.isUser = false;
  }
  get color() { return this.team === 'A' ? userColor : cpuColor; }
  get dark()  { return this.team === 'A' ? userDark  : cpuDark;  }

  update(dt) {
    const f = dt * 60;
    if (this.kickCD > 0) this.kickCD -= f;
    if (this.downTimer > 0) { this.downTimer -= f; this.vx = this.vy = 0; return; }
    if (this.kickAnim > 0) this.kickAnim = Math.max(0, this.kickAnim - f * 0.04);

    if (this.isUser) this.handleUserInput(dt);
    else this.handleAI(dt);

    this.x += this.vx * f;
    this.y += this.vy * f;
    this.runPhase += Math.hypot(this.vx, this.vy) * 0.4;
    this.x = Math.max(8, Math.min(FW - 8, this.x));
    this.y = Math.max(6, Math.min(FH - 6, this.y));

    // 持球跟随（球在身前）
    if (this.hasBall && ball) {
      ball.x = this.x + this.facing * 6;
      ball.y = this.y;
      ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
      ball.holder = this;
    }
  }

  handleUserInput(dt) {
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    // 定位球：射手只在罚球点附近小范围移动
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      if (dx > 0.3) this.facing = 1; else if (dx < -0.3) this.facing = -1;
    }
    this.vx = dx * CFG.PLAYER_SPEED;
    this.vy = dy * CFG.PLAYER_SPEED;
    // 锁定在罚球区（x 100~190，y 上下限）
    this.vx *= 0.6; this.vy *= 0.6;
    if (this.x < 90 || this.x > 210) this.vx *= -0.5;   // 柔和回弹

    // 蓄力
    if (charging && this.hasBall) {
      charge = Math.min(1, charge + CFG.CHARGE_RATE * dt);
      this.crouch = Math.min(3, this.crouch + dt * 6);
    } else {
      this.crouch = Math.max(0, this.crouch - dt * 10);
    }
  }

  handleAI(dt) {
    const f = dt * 60;
    // 守门员：站在球门线，球接近时 y 快速跟球（反应随难度）
    const baseX = RIGHT_GOAL_X - 8;
    if (ball && !ball.holder && ball.x > KICK_SPOT_X) {
      // 球已踢出且朝门飞来：y 追踪球，反应速度随难度提升
      const react = CFG.GK_REACT_BASE + level * 0.012;
      this.y += (ball.y - this.y) * Math.min(1, react * f * 0.5);
      this.x = baseX;
    } else {
      // 未射门：门线中央左右小碎步
      this.y = GOAL_CY + Math.sin(performance.now() / 400) * 4;
      this.x = baseX;
    }
    this.vy = 0;
  }

  shoot(power, isSuper, aimY, aimZ) {
    if (!this.hasBall) return;
    const ang = 0;   // 定位球恒朝右（球门方向）
    ball.holder = null; this.hasBall = false; this.kickCD = 18;
    this.kickAnim = 1;
    ball.x = this.x + 8; ball.y = this.y;
    // 方向：基准朝球门中心 + 玩家瞄准修正（A/D 左右、W/S 高低）
    ball.vx = Math.cos(ang) * power;
    ball.vy = Math.sin(ang) * power + aimY;
    ball.z = 0;
    ball.super = isSuper;
    ball.fxColor = userColor;
    ball.fx = isSuper ? TEAMS[teamKey].fx : null;   // 必杀特效类型
    ball.shooterTeam = 'A';
    if (isSuper) {
      // 必杀：朝球门中心修正 + 随机摆动 + 高飘（轨迹随 fx 差异化）
      const toCenter = GOAL_CY - ball.y;
      const bias = Math.sign(toCenter || 1) * 0.02;
      ball.curve = (Math.random() - 0.5) * 0.03 + bias;
      ball.vz = CFG.SUPER_HEIGHT;
      ball.vx = CFG.SUPER_POWER;
      ball.vy = aimY * 0.5;
      fx.applyFxLaunch(ball);   // 按特效调整初始轨迹
    } else {
      // 普通射门：轻微自然弧线，主要靠玩家瞄准（A/D 修正），不再强收门框
      const toCenter = GOAL_CY - ball.y;
      const bias = Math.sign(toCenter || 1) * 0.003;
      ball.curve = (Math.random() - 0.5) * 0.012 + bias;
      ball.vz = CFG.KICK_HEIGHT * (0.8 + Math.random() * 0.3) + aimZ;
    }
    ball.bounces = 0; ball.rot = 0;
    ball.fired = true;
    spawnShock(ball.x, ball.y, ang, isSuper ? 10 : 5);
    shakeIt(isSuper ? 6 : 2.5);
  }

  draw() {
    const x = Math.round(this.x), y = Math.round(this.y) + ((this.isUser && charging) ? 2 : 0);
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 5, y + 9, 10, 2);

    if (this.downTimer > 0) {
      // 倒地 + 星星（守门员被必杀轰飞）
      ctx.fillStyle = this.dark; ctx.fillRect(x - 8, y - 2, 16, 5);
      ctx.fillStyle = this.color; ctx.fillRect(x - 8, y - 2, 16, 2);
      ctx.fillStyle = '#F2C28A'; ctx.fillRect(x + (this.facing > 0 ? 6 : -9), y - 4, 5, 4);
      ctx.fillStyle = '#FFE000';
      for (let i = 0; i < 3; i++) {
        const a = (performance.now() / 200 + i * 2.1);
        const sx = x + Math.cos(a) * 7, sy = y - 10 + Math.sin(a) * 3;
        ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
      }
      return;
    }

    const col = this.color, dark = this.dark;
    const lp = Math.sin(this.runPhase) * 2;
    const crouchY = Math.round(this.crouch);
    const kickLeg = Math.round(Math.sin(Math.min(1, this.kickAnim) * Math.PI) * 7);
    // 腿
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 4, y + 4 + lp + crouchY, 3, 6);
    ctx.fillRect(x + 1, y + 4 - lp + crouchY, 3, 6);
    if (this.kickAnim > 0.1) {
      ctx.fillRect(x + this.facing * 3, y + 4 + crouchY - kickLeg, 3, 7);
    }
    // 守门员手套（黄色）
    if (this.role === 'GK') {
      ctx.fillStyle = '#FFE000';
      ctx.fillRect(x + 4, y + 3, 3, 3);
    }
    // 短裤
    ctx.fillStyle = dark; ctx.fillRect(x - 5, y + 1 + crouchY, 10, 5);
    // 球衣
    ctx.fillStyle = col; ctx.fillRect(x - 5, y - 7 + crouchY, 10, 9);
    // 头
    ctx.fillStyle = '#F2C28A'; ctx.fillRect(x - 4, y - 13 + crouchY, 8, 7);
    // 头发
    ctx.fillStyle = '#2a1c10'; ctx.fillRect(x - 4, y - 13 + crouchY, 8, 2);
    // 眼睛（朝向）
    ctx.fillStyle = '#000';
    ctx.fillRect(x + (this.facing > 0 ? 1 : -3), y - 10 + crouchY, 2, 2);
    // 号码
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 5 + crouchY, 2, 4);
    // 蓄力能量环
    if (this.isUser && charging) {
      const pr = 5 + Math.round(charge * 5);
      ctx.strokeStyle = charge >= CFG.SUPER_THRESHOLD ? '#FF5A00' : '#39FF14';
      ctx.globalAlpha = 0.6 + charge * 0.4;
      ctx.beginPath(); ctx.arc(x, y + 10 + crouchY, pr, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// =====================================================================
//  足球
// =====================================================================
function makeBall() {
  return { x: KICK_SPOT_X, y: GOAL_CY, z: 0, vx: 0, vy: 0, vz: 0, holder: null, bounces: 0,
           super: false, fx: null, fxColor: '#fff', shooterTeam: null, curve: 0, passTarget: null, fired: false, fxPhase: 0 };
}

function updateBall(dt) {
  const f = dt * 60;
  if (ball.holder) return;

  if (ball.z > 0 || ball.vz !== 0) {
    ball.z += ball.vz * f; ball.vz -= CFG.GRAVITY * f;
    if (ball.z <= 0) {
      if (ball.vz < -1.2 && ball.bounces < 2) {
        ball.vz = -ball.vz * CFG.BALL_BOUNCE;
        ball.bounces++;
        spawnDust(ball.x, ball.y);
      } else {
        ball.z = 0; ball.vz = 0; ball.bounces = 0;
      }
    }
  }
  const drag = (ball.z > 0) ? 0.998 : CFG.BALL_FRICTION;
  ball.x += ball.vx * f; ball.y += ball.vy * f;
  ball.vx *= Math.pow(drag, f);
  ball.vy *= Math.pow(drag, f);
  if (Math.abs(ball.vx) < 0.02) ball.vx = 0;
  if (Math.abs(ball.vy) < 0.02) ball.vy = 0;
  if (ball.curve) { ball.vy += ball.curve * f; if (ball.z <= 0) ball.curve *= Math.pow(0.92, f); }
  ballPuff += Math.hypot(ball.vx, ball.vy) * 0.25 * f + (ball.z > 0 ? 1.5 : 0);

  // 边界（球门口区域不反弹，让球能进门）
  const inMouthY = Math.abs(ball.y - GOAL_CY) < goalHalf;
  if (ball.x < 6 && !inMouthY) { ball.x = 6; ball.vx = Math.abs(ball.vx) * 0.6; }
  if (ball.x > FW - 6 && !inMouthY) { ball.x = FW - 6; ball.vx = -Math.abs(ball.vx) * 0.6; }
  if (ball.y < 4) { ball.y = 4; ball.vy = Math.abs(ball.vy) * 0.6; }
  if (ball.y > FH - 4) { ball.y = FH - 4; ball.vy = -Math.abs(ball.vy) * 0.6; }

  // 必杀：尝试扑救（高难度能扑出），扑不出则轰飞门将
  if (ball.super && gk && gk.downTimer <= 0) {
    if (Math.abs(ball.x - RIGHT_GOAL_X) < 26 && Math.abs(ball.y - GOAL_CY) < goalHalf + 16) {
      // 守门员必须够到球（追球），且按难度概率扑出
      const reach = CFG.GK_REACH_BASE + 2 + level * 1.2;
      const saveChance = Math.min(0.55, CFG.SUPER_SAVE_BASE + level * CFG.SUPER_SAVE_PER_LV);
      if (Math.abs(gk.y - ball.y) < reach && Math.random() < saveChance) {
        // 扑出必杀！（不被轰飞，挡出球）
        ball.vx = -2.6; ball.vy = (ball.y > GOAL_CY ? 1 : -1) * 1.6; ball.vz = 2.4;
        ball.curve = 0; ball.super = false; ball.fx = null;
        gk.kickCD = 12;
        spawnShock(ball.x, ball.y, Math.PI, 10, '#fff');
        shakeIt(5);
        fx.flash('#fff', 0.3);
        onFail('SUPERSAVE');
        return;
      }
      // 没扑住 → 轰飞门将（必杀命中）
      gk.downTimer = 70;
      spawnDust(ball.x, ball.y);
    }
  }

  // 必杀特效：轨迹差异化（每帧按 fx 类型摆动/抖动）+ 粒子
  if (ball.super && ball.fx) {
    ball.fxPhase += f * 0.06;
    fx.updateFxTrail(ball);
    fx.updateFxParticles(ball);
  }

  // 守门员扑救（普通球）
  if (!ball.super && gk && gk.downTimer <= 0) {
    if (Math.abs(ball.x - RIGHT_GOAL_X) < 30 && Math.abs(ball.y - GOAL_CY) < goalHalf + 20) {
      const reach = CFG.GK_REACH_BASE + level * 1.5;          // 伸手范围随难度
      const saveChance = Math.min(0.85, CFG.SAVE_CHANCE_BASE + level * 0.05);
      if (Math.abs(gk.y - ball.y) < reach && Math.random() < saveChance) {
        // 扑出！球被拍回，立即判射失
        ball.vx = -2.2; ball.vy = (ball.y > GOAL_CY ? 1 : -1) * 1.4; ball.vz = 2.2;
        ball.curve = 0;
        gk.kickCD = 10;
        spawnShock(ball.x, ball.y, Math.PI, 6, '#fff');
        shakeIt(4);
        fx.flash('#fff', 0.25);
        onFail('SAVE');
      }
    }
  }

  // 进球检测
  checkGoal();
  // 射失检测（球已射出，未进即结束）
  checkMiss();

  // 轨迹
  fx.recordTrail(ball);
}

function checkGoal() {
  const inMouth = (ball.y > GOAL_CY - goalHalf && ball.y < GOAL_CY + goalHalf);
  if (inMouth && ball.x > RIGHT_GOAL_X - 4) onGoal();
}

function checkMiss() {
  // 球已射出（fired），未进门即结束本回合
  if (!ball.fired || gameState !== 'playing') return;
  const inMouth = (ball.y > GOAL_CY - goalHalf && ball.y < GOAL_CY + goalHalf);
  // 越过门线但不在门框内 → 射偏
  if (ball.x > RIGHT_GOAL_X - 4 && !inMouth) { onFail('MISS'); return; }
  // 球停住（被扑回/被挡/无力）→ 射失
  if (Math.abs(ball.vx) < 0.2 && Math.abs(ball.vy) < 0.2 && ball.z <= 0) {
    onFail('SAVE');
  }
}

function onGoal() {
  if (gameState !== 'playing') return;
  streak++;
  fx.flash('#fff', 0.5);
  shakeIt(5);
  // 爆炸粒子
  fx.burst(RIGHT_GOAL_X, GOAL_CY, userColor, 40);
  showShotMsg(`GOAL! 第${streak}球`, userColor, 1.6);
  // 难度提升
  level = Math.min(9, level + 1);
  goalHalf = Math.max(CFG.GOAL_HALF_MIN, CFG.GOAL_HALF_BASE - (level - 1) * 2);
  gameState = 'goal';
  updateBestLine();
}

function showShotMsg(text, color, t) { fx.showShotMsg(text, color, t); }

function onFail(reason) {
  if (gameState !== 'playing') return;
  gameState = 'over';
  const msg = reason === 'MISS' ? '射偏了…' : reason === 'SUPERSAVE' ? '必杀被扑出!' : '被扑出!';
  showShotMsg(msg, reason === 'SUPERSAVE' ? '#39FF14' : '#FF5A00', 1.8);
  // 延迟弹出结算
  setTimeout(() => {
    saveBest(streak, level);
    const best = loadBest();
    const el = document.getElementById('final-score');
    el.textContent = `连续进球 ${streak} 球 · 难度 Lv.${level}`;
    document.getElementById('final-result').textContent =
      `${rankFor(streak)} · 历史最佳 ${best.bestStreak} 球`;
    document.getElementById('gameover').classList.add('show');
  }, 1600);
}

function rankFor(n) {
  if (n >= 10) return '传奇射手 ★★★★★';
  if (n >= 8) return '世界级神射手 ★★★★';
  if (n >= 6) return '国家希望 ★★★';
  if (n >= 4) return '金牌射手 ★★';
  if (n >= 3) return '队内射手王';
  if (n >= 2) return '靠谱射手';
  if (n >= 1) return '初出茅庐';
  return '新手出发';
}

// =====================================================================
//  拾取 / 重置
// =====================================================================
function updatePickup() {
  if (ball.holder) return;
  if (ball.z > 10) return;
  // 球已射出后不再接回（一球定胜负）
  if (ball.fired) return;
  // 球滚回罚球区 → 射手接住
  if (ball.x < KICK_SPOT_X + 45) {
    const d = Math.hypot(shooter.x - ball.x, shooter.y - ball.y);
    if (d < CFG.BALL_CONTROL_DIST + 4) {
      ball.holder = shooter; shooter.hasBall = true;
      ball.vx = ball.vy = ball.vz = 0;
    }
  }
}

function resetRound() {
  // 射手回罚球点，持球
  shooter.x = KICK_SPOT_X; shooter.y = GOAL_CY;
  shooter.hasBall = false; shooter.kickCD = 0; shooter.downTimer = 0; shooter.kickAnim = 0;
  // 守门员回门线
  gk.x = RIGHT_GOAL_X - 8; gk.y = GOAL_CY;
  gk.downTimer = 0; gk.kickCD = 0;
  ball = makeBall();
  ball.x = KICK_SPOT_X + 6; ball.y = GOAL_CY;
  ball.holder = shooter; shooter.hasBall = true;
  charging = false; charge = 0;
  scrollX = 0;
  gameState = 'playing';
}

// =====================================================================
//  相机
// =====================================================================
function updateCamera() {
  // 固定全场视野（罚球点 + 球门一屏可见），让玩家始终看到门将
  const s = FW - VW;
  scrollX += (s - scrollX) * 0.12;
}

// =====================================================================
//  主循环
// =====================================================================
function update(dt) {
  if (gameState === 'playing') {
    shooter.update(dt);
    gk.update(dt);
    updateBall(dt);
    updatePickup();
    updateCamera();
  } else if (gameState === 'goal') {
    // 进球庆祝后自动下一球
    gk.update(dt);
    if (gk.downTimer > 0) gk.downTimer -= dt * 60;
    fx.tickParticles();
    if (fx.getShotMsg().timer <= 0) resetRound();
  }
  fx.tickFX(dt);
}

// =====================================================================
//  渲染
// =====================================================================
function render() {
  ctx.fillStyle = '#0A0A0B';
  ctx.fillRect(0, 0, VW, VH);

  ctx.save();
  const shake = fx.getShake();
  if (shake > 0.1) {
    ctx.translate(Math.round((Math.random() - 0.5) * shake), Math.round((Math.random() - 0.5) * shake));
  }
  ctx.translate(-Math.round(scrollX), 0);
  drawField();
  fx.drawTrail(ctx, ball ? ball.fxColor : '#fff');
  if (shooter) shooter.draw();
  if (gk) gk.draw();
  if (ball) drawBall();
  fx.drawParticles(ctx);
  ctx.restore();

  // 屏闪
  fx.drawFlash(ctx, VW, VH);
}

function drawField() {
  // 草地（割草条纹）
  for (let x = 0; x < FW; x += 24) {
    ctx.fillStyle = (Math.floor(x / 24) % 2 === 0) ? '#1E7A3A' : '#1A6E34';
    ctx.fillRect(x, 0, 24, FH);
  }
  // 边线
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, FW - 8, FH - 8);
  // 中线
  ctx.beginPath(); ctx.moveTo(FW / 2, 4); ctx.lineTo(FW / 2, FH - 4); ctx.stroke();
  // 中圈
  ctx.beginPath(); ctx.arc(FW / 2, GOAL_CY, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(FW / 2 - 1, GOAL_CY - 1, 4, 2);
  // 禁区（右侧，进攻方向）
  ctx.strokeRect(FW - 60, GOAL_CY - 56, 56, 112);
  // 罚球点标记
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(KICK_SPOT_X - 2, GOAL_CY - 2, 4, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(KICK_SPOT_X - 14, GOAL_CY - 60, 28, 120);
  // 球门（大小随难度）
  drawGoal(RIGHT_GOAL_X);
}
function drawGoal(gx) {
  const x = gx;
  ctx.fillStyle = '#E8E8E8';
  ctx.fillRect(x, GOAL_CY - goalHalf, 4, goalHalf * 2);
  // 网
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = -goalHalf; i < goalHalf; i += 6) ctx.fillRect(x + 1, GOAL_CY + i, 3, 1);
  // 难度标记（门柱外小点，球门越小难度越高）
  for (let i = 0; i < level - 1; i++) {
    ctx.fillStyle = '#FF5A00';
    ctx.fillRect(x - 10 - i * 5, GOAL_CY + goalHalf + 3, 3, 3);
  }
}

function drawBall() {
  const x = Math.round(ball.x), gy = Math.round(ball.y), y = gy - Math.round(ball.z);
  const h = Math.min(1, ball.z / 24);
  const shS = Math.max(2, Math.round(6 * (1 - h * 0.4)));
  ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - h * 0.5)})`;
  ctx.fillRect(x - shS / 2, gy + 2, shS, 2);
  const sz = Math.max(2, Math.round(3 * (1 - h * 0.25)));
  if (ball.super) {
    drawFxBall(x, y, sz, ball.fx, ball.fxColor);
  } else {
    ctx.fillStyle = '#fff'; ctx.fillRect(x - sz, y - sz, sz * 2, sz * 2);
    const rot = ballPuff;
    const rx = Math.round(Math.cos(rot) * sz * 0.7), ry = Math.round(Math.sin(rot) * sz * 0.7);
    ctx.fillStyle = '#111';
    ctx.fillRect(x + rx - 1, y + ry - 1, 2, 2);
    ctx.fillRect(x - rx - 1, y - ry - 1, 2, 2);
    ctx.fillRect(x - sz, y - sz, 2, 2);
  }
  // 蓄力瞄准（用户持球）
  if (shooter && shooter.hasBall && charging) {
    ctx.strokeStyle = charge >= CFG.SUPER_THRESHOLD ? '#FF5A00' : '#39FF14';
    ctx.setLineDash([2, 2]);
    // 瞄准线：朝球门方向 + W/S 高低、A/D 左右修正
    const aimY = ((keys['d'] || keys['arrowright']) ? 1 : 0) - ((keys['a'] || keys['arrowleft']) ? 1 : 0);
    const aimZ = ((keys['w'] || keys['arrowup']) ? 1 : 0) - ((keys['s'] || keys['arrowdown']) ? 1 : 0);
    const ex = x + 42;
    const ey = y + aimY * 16 - aimZ * 8;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// 13 种必杀球体渲染
function drawFxBall(x, y, sz, fxType, c) {
  const t = performance.now() / 100;
  const s = sz;
  switch (fxType) {
    case 'fire': {   // 火球：橙红火焰核心 + 焰尾
      ctx.fillStyle = '#FF4500'; ctx.fillRect(x - s - 2, y - s - 2, (s + 2) * 2, (s + 2) * 2);
      ctx.fillStyle = '#FFB300'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#FFF5CC'; ctx.fillRect(x - 1, y - 1, 2, 2);
      // 焰尾（左侧）
      const fl = Math.round(Math.sin(t * 3) * 2);
      ctx.fillStyle = '#FF6600';
      ctx.fillRect(x - s - 3, y - 2 + fl, 3, 3);
      ctx.fillRect(x - s - 5, y - 1 - fl, 2, 3);
      break;
    }
    case 'tornado': {  // 龙卷风：绿色风球 + 旋转线
      ctx.fillStyle = '#1E8E3E'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#7CFC00'; ctx.fillRect(x - s, y - s, s * 2, s * 2 - 2);
      ctx.fillStyle = '#E8FFE8'; ctx.fillRect(x - 1, y - 1, 2, 2);
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1;
        ctx.fillStyle = '#39FF14';
        ctx.fillRect(x + Math.round(Math.cos(a) * (s + 2)) - 1, y + Math.round(Math.sin(a) * (s + 2)) - 1, 2, 2);
      }
      break;
    }
    case 'thunder': {  // 闪电：亮黄球 + 闪电锯齿
      ctx.fillStyle = '#B8860B'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#FFF200'; ctx.fillRect(x - s, y - s, s * 2, s * 2 - 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1, y - 1, 2, 2);
      // 锯齿闪电
      ctx.fillStyle = '#FFF200';
      ctx.fillRect(x + 3, y - s - 3, 1, 4); ctx.fillRect(x + 4, y - s - 2, 1, 4);
      ctx.fillRect(x + 2, y + s + 1, 1, 4); ctx.fillRect(x + 3, y + s + 2, 1, 4);
      break;
    }
    case 'iron': {    // 铁球：金属灰 + 高光
      ctx.fillStyle = '#3A3F44'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#6E757C'; ctx.fillRect(x - s, y - s, s * 2, s * 2 - 3);
      ctx.fillStyle = '#B8BEC4'; ctx.fillRect(x - s + 1, y - s + 1, 2, 2);
      ctx.fillStyle = '#1A1D20'; ctx.fillRect(x + s - 2, y + s - 2, 2, 2);
      break;
    }
    case 'typhoon': {  // 台风：青色大旋涡
      ctx.fillStyle = '#0077AA'; ctx.fillRect(x - s - 1, y - s - 1, (s + 1) * 2, (s + 1) * 2);
      ctx.fillStyle = '#35C8FF'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#E0F7FF'; ctx.fillRect(x - 1, y - 1, 2, 2);
      for (let i = 0; i < 4; i++) {
        const a = t * 2.5 + i * 1.57;
        ctx.fillStyle = '#7CE3FF';
        ctx.fillRect(x + Math.round(Math.cos(a) * (s + 3)) - 1, y + Math.round(Math.sin(a) * (s + 3)) - 1, 2, 2);
      }
      break;
    }
    case 'phantom': {  // 幻影：白色残影 + 虚影
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#B0C4DE'; ctx.fillRect(x - s - 3, y - s - 3, s * 2, s * 2);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#E0EEFF'; ctx.fillRect(x - s - 1, y - s - 1, s * 2, s * 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#B0C4DE'; ctx.fillRect(x - 1, y - 1, 2, 2);
      break;
    }
    case 'gold': {    // 黄金：金色球 + 星芒
      ctx.fillStyle = '#B8860B'; ctx.fillRect(x - s - 1, y - s - 1, (s + 1) * 2, (s + 1) * 2);
      ctx.fillStyle = '#FFD700'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#FFF8DC'; ctx.fillRect(x - 1, y - 1, 2, 2);
      for (let i = 0; i < 4; i++) {
        const a = t * 1.5 + i * 1.57;
        ctx.fillStyle = '#FFE000';
        ctx.fillRect(x + Math.round(Math.cos(a) * (s + 3)) - 1, y + Math.round(Math.sin(a) * (s + 3)) - 1, 2, 2);
      }
      break;
    }
    case 'ice': {     // 冰封：冰蓝方块
      ctx.fillStyle = '#7FD4FF'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#D6F5FF'; ctx.fillRect(x - s, y - s, s * 2, s * 2 - 3);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillStyle = '#A8E4FF';
      ctx.fillRect(x - s - 1, y - 1, 1, 3); ctx.fillRect(x + s, y - 1, 1, 3);
      break;
    }
    case 'demon': {   // 恶魔：暗紫球 + 魔眼
      ctx.fillStyle = '#2B0A3D'; ctx.fillRect(x - s - 1, y - s - 1, (s + 1) * 2, (s + 1) * 2);
      ctx.fillStyle = '#6A0DAD'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#B026FF'; ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillStyle = '#FF00FF'; ctx.fillRect(x - 2, y - 2, 2, 2);
      // 魔焰环绕
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1;
        ctx.fillStyle = '#8A2BE2';
        ctx.fillRect(x + Math.round(Math.cos(a) * (s + 2)) - 1, y + Math.round(Math.sin(a) * (s + 2)) - 1, 2, 2);
      }
      break;
    }
    case 'bull': {    // 斗牛：红球 + 牛角
      ctx.fillStyle = '#8B0000'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#FF3333'; ctx.fillRect(x - s, y - s, s * 2, s * 2 - 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillStyle = '#FFD700';   // 牛角
      ctx.fillRect(x - 1, y - s - 3, 2, 3);
      ctx.fillRect(x - 3, y - s - 2, 2, 2);
      ctx.fillRect(x + 1, y - s - 2, 2, 2);
      break;
    }
    case 'tiger': {   // 白虎：白球 + 虎纹
      ctx.fillStyle = '#D8D8D8'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - s + 1, y - s + 1, s * 2 - 2, s * 2 - 2);
      ctx.fillStyle = '#111'; ctx.fillRect(x - 1, y - s, 2, 2); ctx.fillRect(x - 1, y + s - 2, 2, 2);
      ctx.fillStyle = '#FFB300';
      for (let i = 0; i < 3; i++) {
        const a = t + i * 2.1;
        ctx.fillRect(x + Math.round(Math.cos(a) * (s + 2)) - 1, y + Math.round(Math.sin(a) * (s + 2)) - 1, 2, 2);
      }
      break;
    }
    case 'jungle': {  // 丛林：绿球 + 藤蔓
      ctx.fillStyle = '#1B5E20'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#2ECC40'; ctx.fillRect(x - s, y - s, s * 2, s * 2 - 2);
      ctx.fillStyle = '#DFFFE0'; ctx.fillRect(x - 1, y - 1, 2, 2);
      // 藤蔓
      ctx.fillStyle = '#0E8A2E';
      ctx.fillRect(x - s - 2, y - s + 1, 2, 3); ctx.fillRect(x + s, y + s - 3, 2, 3);
      break;
    }
    case 'sun': {     // 烈日：橙色球 + 光芒
      ctx.fillStyle = '#CC5500'; ctx.fillRect(x - s - 1, y - s - 1, (s + 1) * 2, (s + 1) * 2);
      ctx.fillStyle = '#FF8C00'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#FFF5CC'; ctx.fillRect(x - 1, y - 1, 2, 2);
      for (let i = 0; i < 6; i++) {
        const a = t * 1.2 + i * 1.05;
        ctx.fillStyle = '#FFB300';
        ctx.fillRect(x + Math.round(Math.cos(a) * (s + 3)) - 1, y + Math.round(Math.sin(a) * (s + 3)) - 1, 2, 2);
      }
      break;
    }
    default: {        // 兜底：光球
      ctx.globalAlpha = 0.5; ctx.fillStyle = c; ctx.fillRect(x - s - 3, y - s - 3, (s + 3) * 2, (s + 3) * 2);
      ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
}

// =====================================================================
//  HUD
// =====================================================================
function updateHUD() {
  document.getElementById('streak-a').textContent = streak;
  document.getElementById('score-b').textContent = `难度 Lv.${level}`;
  document.getElementById('team-a-name').textContent = TEAMS[teamKey].name;
  document.getElementById('team-a-shot').textContent = TEAMS[teamKey].shot;
  // 球门大小提示
  const gs = document.getElementById('goal-size');
  if (gs) gs.textContent = `球门 ${goalHalf * 2}px`;
}

// 菜单/结算处的历史最佳展示
function updateBestLine() {
  const best = loadBest();
  const el = document.getElementById('best-streak');
  if (el) el.textContent = best.bestStreak > 0 ? `历史最佳：连续 ${best.bestStreak} 球（Lv.${best.bestLevel}）` : '暂无纪录，来开第一脚！';
}

// =====================================================================
//  初始化 / 开始
// =====================================================================
function startMatch() {
  teamKey = document.getElementById('team-user').value;
  userColor = TEAMS[teamKey].color; userDark = TEAMS[teamKey].dark;
  window.userFx = TEAMS[teamKey].fx;
  streak = 0; level = 1;
  goalHalf = CFG.GOAL_HALF_BASE;
  shooter = new Player('A', 'FWD', KICK_SPOT_X, GOAL_CY); shooter.isUser = true;
  gk = new Player('B', 'GK', RIGHT_GOAL_X - 8, GOAL_CY);
  resetRound();
  gameState = 'playing';
  document.getElementById('menu').classList.remove('show');
  document.getElementById('gameover').classList.remove('show');
  document.getElementById('pause').classList.remove('show');
  updateHUD();
}

// 局内切换必杀技（循环 13 队）
function cycleShot() {
  const idx = TEAM_KEYS.indexOf(teamKey);
  teamKey = TEAM_KEYS[(idx + 1) % TEAM_KEYS.length];
  userColor = TEAMS[teamKey].color; userDark = TEAMS[teamKey].dark;
  window.userFx = TEAMS[teamKey].fx;
  fx.showSuperCallout(`必杀·${TEAMS[teamKey].shot}!`, userColor, 1.2);
  spawnDust(shooter.x, shooter.y);
  updateHUD();
}

// 必杀射门释放
function releaseShot() {
  if (!charging) return;
  charging = false;
  const isSuper = charge >= CFG.SUPER_THRESHOLD;
  charge = 0;
  if (!shooter || !shooter.hasBall) return;
  // 瞄准修正：A/D 左右（vy），W/S 高低（vz）
  const aimY = ((keys['d'] || keys['arrowright']) ? 1 : 0) - ((keys['a'] || keys['arrowleft']) ? 1 : 0);
  const aimZ = ((keys['w'] || keys['arrowup']) ? 1 : 0) - ((keys['s'] || keys['arrowdown']) ? 1 : 0);
  if (isSuper) {
    fx.flash('#FF5A00', 0.4);
    fx.showSuperCallout(`必杀·${TEAMS[teamKey].shot}!`, userColor, 1.4);
    spawnDust(shooter.x, shooter.y);
    shakeIt(6);
  }
  shooter.shoot(isSuper ? CFG.SUPER_POWER : CFG.KICK_POWER, isSuper, aimY * 0.9, aimZ * 0.5);
}

// =====================================================================
//  输入
// =====================================================================
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  if (gameState === 'menu' || gameState === 'over') { if (k === 'enter') startMatch(); return; }
  if (k === 'p') { togglePause(); return; }
  if (k === 'r') { startMatch(); return; }   // R 快速重开
  if (gameState !== 'playing') return;
  if (k === ' ') { if (shooter && shooter.hasBall && !charging) { charging = true; charge = 0; } }
  // 局内切换必杀技（C / Tab 循环 13 队）
  if (k === 'c' || k === 'tab') { cycleShot(); }
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  keys[k] = false;
  if (k === ' ') { if (gameState === 'playing') releaseShot(); }
});
function togglePause() {
  if (gameState === 'playing') { gameState = 'paused'; document.getElementById('pause').classList.add('show'); }
  else if (gameState === 'paused') { gameState = 'playing'; document.getElementById('pause').classList.remove('show'); }
}

// 菜单按钮
document.getElementById('btn-start').addEventListener('click', startMatch);
document.getElementById('btn-restart').addEventListener('click', startMatch);
document.getElementById('btn-resume').addEventListener('click', togglePause);
// 填充队选（记忆上次选择）
(function fillTeams() {
  const u = document.getElementById('team-user');
  TEAM_KEYS.forEach(k => {
    u.add(new Option(`${TEAMS[k].name}（${TEAMS[k].shot}）`, k));
  });
  const saved = loadSettings().team;
  u.value = TEAMS[saved] ? saved : 'brazil';
  u.addEventListener('change', () => saveSettings({ ...loadSettings(), team: u.value }));
})();
updateBestLine();

// 调试钩子（自测用）
window.__game = () => ({
  state: gameState, streak, level,
  px: shooter ? Math.round(shooter.x) : null,
  gx: gk ? Math.round(gk.x) : null, gy: gk ? Math.round(gk.y) : null,
  bx: ball ? Math.round(ball.x) : null, by: ball ? Math.round(ball.y) : null,
  bz: ball ? Math.round(ball.z * 10) / 10 : null,
  bvx: ball ? Math.round(ball.vx * 100) / 100 : null, bvy: ball ? Math.round(ball.vy * 100) / 100 : null,
  holder: ball && ball.holder ? (ball.holder.team + '-' + ball.holder.role) : null,
  super_: ball ? !!ball.super : false,
  goalHalf,
  hasBall: shooter ? shooter.hasBall : false,
  shake: Math.round(fx.getShake() * 10) / 10
});
// 调试 setter（测试用）
window.__setLevel = (l) => { level = Math.min(9, Math.max(1, l)); goalHalf = Math.max(CFG.GOAL_HALF_MIN, CFG.GOAL_HALF_BASE - (level - 1) * 2); };
window.__team = () => ({ key: teamKey, name: TEAMS[teamKey].name, shot: TEAMS[teamKey].shot });

// =====================================================================
//  循环驱动
// =====================================================================
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0);
  lastTime = ts;
  if (gameState !== 'menu') update(dt);
  render();
  if (gameState === 'playing' || gameState === 'goal') updateHUD();
  // 蓄力条
  const cw = document.getElementById('charge-wrap');
  const cb = document.getElementById('charge-bar');
  if (charging && (!shooter || !shooter.hasBall)) { charging = false; charge = 0; }
  if (charging && shooter && shooter.hasBall) {
    cw.classList.add('show');
    cb.style.width = `${Math.round(charge * 100)}%`;
    cb.classList.toggle('super', charge >= CFG.SUPER_THRESHOLD);
  } else cw.classList.remove('show');
  // 必杀名特写
  const sc = document.getElementById('super-callout');
  const callout = fx.getCallout();
  if (callout.timer > 0) {
    sc.textContent = callout.text;
    sc.style.color = callout.color;
    sc.classList.add('show');
  } else sc.classList.remove('show');
  // 射门结果提示
  const sm = document.getElementById('shot-msg');
  const msg = fx.getShotMsg();
  if (msg.timer > 0) {
    sm.textContent = msg.text;
    sm.style.color = msg.color;
    sm.classList.add('show');
  } else sm.classList.remove('show');
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);




