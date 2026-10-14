// state.js —— 全局状态机 + 几何投影 + 玩家动作
// 导出 game / player / world 三个可变单例，以及状态转换函数。
// 注意：本模块与 ui/entities 存在运行时互调，所有跨模块函数均为 function 声明（hoisted），
//       且任何模块的顶层代码都不得在求值期调用对方函数（引导统一在 main.js）。

import * as C from './config.js';
import * as storage from './storage.js';
import * as audio from './audio.js';
import * as ui from './ui.js';
import * as skins from './skins.js';
import { initQuests, questReward } from './quests.js';
import * as meta from './meta.js';

// ---- 视口 ----
export let W = 0, H = 0;
export function setViewport(w, h) { W = w; H = h; }

// ---- 游戏状态 ----
export const game = {
  state: 'menu',
  speed: C.SPEED_START,
  distance: 0,
  score: 0,                     // 分数（与距离分离）
  coins: 0,
  best: storage.getBest(),
  bestScore: storage.getBestScore(),
  spawnTimer: 0,
  spawnGap: C.SPAWN_GAP_START,
  invincT: 0,
  boostT: 0,
  stunCount: 0,
  slowT: 0,
  dizzyT: 0,
  ridingTrain: null,
  rideT: 0,
  // 雪崩 v2（节日式周期事件）
  avalancheZ: C.PLAYER_Z + C.AVALANCHE_MAX_GAP,
  avaGap: C.AVALANCHE_MAX_GAP,
  avalancheWarn: 0,
  avaDanger: 0,
  miniSurgeT: 0,
  nextMini: 28,
  carveTipT: 0,
  carveTipShown: false,
  surgeClean: true,
  nextSurge: C.SURGE_MIN + Math.random() * (C.SURGE_MAX - C.SURGE_MIN),
  surgeT: 0,
  // 连击 / Fever
  combo: 0,
  comboT: 0,
  feverGauge: 0,
  feverT: 0,
  lastLane: 1,
  laneSwitchT: 0,
  // 摔倒起身
  fallT: 0,
  fallTaps: 0,
  // 局内道具
  magnetT: 0,
  shield: 0,
  doubleT: 0,
  rocketT: 0,
  // 倒计时 / 教学
  countT: 0,
  goT: 0,
  jumpBufferT: 0,      // 跳跃缓冲（落地前提前按也能触发）
  tutorial: storage.isFirstRun(),
  tutStep: 0,
  // 金币连击 / 里程碑 / 屏幕震动
  coinCombo: 0,
  coinComboT: 0,
  lastMilestone: 0,
  shake: 0,
  camDNow: C.CAM_D,       // 当前相机距离（动态：加速态拉近，平滑过渡）—— C2
  camRollNow: 0,          // 当前相机 roll 角（弧度，过弯随曲率倾斜）—— C3
  // 旗门（滑雪竞速）
  gateN: 0,
  gateCombo: 0,
  lastGateDist: 0,
  // 装备属性（开局从 skins 读取，玩法中引用）
  equipStats: { magnet: C.EQUIP.baseMagnet, coinX: 1, glide: 0, dodge: 0 },
  landGrace: 0,
  // 难度段落化
  phase: 'normal',
  phaseDist: 0,
  phaseLen: 0,
  lastHit: null,        // 最近撞击物类型（失败归因用）
  deathTip: '',         // 失败改进建议（结算展示）
  deathDetail: '',      // 失败死因细节（结算展示）
};

export const player = {
  lane: 1, x: 0, targetX: 0, tilt: 0,
  jump: 0, jumpDur: C.JUMP_DUR, jumps: 0, jumpStartH: 0, curH: 0, crouch: 0,
  // 空中特技
  airSpin: 0,        // 本次腾空累计旋转（弧度，正=前空翻 负=后空翻）
  spinDir: 0,        // 当前旋转方向（视觉）
  jumpHeld: false,   // 跳跃键是否按住（可变跳跃高度）
};

export const world = {
  entities: [],
  popups: [],
  snow: [],
  snowPattern: null,
  trail: [],        // 玩家滑行轨迹（雪痕）：{s, x, w} 点 + {brk} 断点哨兵
};

// 雪痕轨迹记录（由 entities.update 每帧调用；贴地滑行才留痕，腾空/摔倒/下车留断点）
export function recordTrail() {
  const tr = world.trail;
  const onGround = player.jump <= 0 && !game.ridingTrain && game.fallT <= 0;
  if (!onGround) {
    if (tr.length && !tr[tr.length - 1].brk) tr.push({ brk: true });
    return;
  }
  const last = tr[tr.length - 1];
  if (last && !last.brk && game.distance - last.s < 0.08) return;   // 距离太近不重复采样
  tr.push({ s: game.distance, x: player.x, w: Math.min(1, Math.abs(player.tilt)) });
  if (tr.length > C.TRAIL_MAX) tr.shift();
}

// ---- 几何（视角升级：地平线抬高 + 滑道收窄 + 近大远小更夸张 → 强纵深俯冲感）----
// 固定基准地平线：天空缓存/远山等静态背景用，避免随坡度抖动
export function baseHorizonY() { return H * 0.26; }  // 相机高度/俯角基准：越小=相机越高俯，天空压缩、前方地面看得更远更开阔
// 运行时地平线：随当前坡度动态偏移（上坡 slope>0 → 地平线上抬 y 减小；下坡 → 下压 y 增大）
// 天空缓存按 baseHorizonY 绘制且下方兜底填色，故动态偏移不会露白
export function horizonY() { return baseHorizonY() - trackSlope(game.distance) * C.HORIZON_SLOPE_K; }
export function laneWorldX(lane) { return (lane - 1) * C.LANE_SPACING; }
export function randLane() { return Math.floor(Math.random() * 3); }
export function roadScale() { return W * 0.145; }  // 世界整体缩放基准：越小→全场景等比缩小、观感拉开（横向车道也随之收窄）

// ---- 滑道地形（重构：蜿蜒弯道 + 真实坡度 + 起伏跳台 + 相机跟随转向）----
// 赛道中心线横向位置（相对直线基准）：多频正弦叠加 → 平滑蜿蜒
export function trackCenterX(worldS) {
  const amp = C.CURVE_AMP * (0.55 + 0.45 * Math.sin(worldS * 0.006));
  return Math.sin(worldS * C.CURVE_FREQ1) * amp
    + Math.sin(worldS * C.CURVE_FREQ2 + 1.7) * amp * 0.6
    + Math.sin(worldS * C.CURVE_FREQ3 + 0.5) * amp * 0.35;
}
export function trackCenterDX(worldS) {
  const amp = C.CURVE_AMP * (0.55 + 0.45 * Math.sin(worldS * 0.006));
  return Math.cos(worldS * C.CURVE_FREQ1) * amp * C.CURVE_FREQ1
    + Math.cos(worldS * C.CURVE_FREQ2 + 1.7) * amp * 0.6 * C.CURVE_FREQ2
    + Math.cos(worldS * C.CURVE_FREQ3 + 0.5) * amp * 0.35 * C.CURVE_FREQ3;
}
// 真实纵坡（正=上坡，负=下坡）：缓坡主导 + 局部跳台隆起
export function trackSlope(worldS) {
  const base = Math.sin(worldS * C.SLOPE_FREQ1) * C.SLOPE_AMP
    + Math.sin(worldS * C.SLOPE_FREQ2 + 2.1) * C.SLOPE_AMP * 0.5;
  const bumpPhase = (worldS * 0.013) % 1;
  const bumpEnv = Math.sin(worldS * 0.004) * 0.5 + 0.5;
  const bump = Math.max(0, Math.sin(bumpPhase * Math.PI * 2)) * C.BUMP_AMP * bumpEnv;
  return base + bump;
}
// 视觉抬升量（沿坡累积，纯函数）
export function trackElev(worldS) {
  const v = Math.sin(worldS * C.SLOPE_FREQ1) * C.SLOPE_AMP * 6
    + Math.sin(worldS * C.SLOPE_FREQ2 + 2.1) * C.SLOPE_AMP * 3;
  const bumpPhase = (worldS * 0.013) % 1;
  const bumpEnv = Math.sin(worldS * 0.004) * 0.5 + 0.5;
  const bump = Math.max(0, Math.sin(bumpPhase * Math.PI * 2)) * C.BUMP_AMP * 8 * bumpEnv;
  return v + bump;
}
export function elevOffset(z) {
  // 高度偏移已统一在 proj() 中处理；保留函数以便旧代码兼容
  return 0;
}

// 相机跟随：以玩家为中心，兼顾前方赛道切线，保持人物在视觉中心
export function camTargetX() {
  const playerWorldX = player.x + trackCenterX(game.distance);
  const lookWorldX = trackCenterX(game.distance + C.CAM_LOOK_AHEAD);
  return playerWorldX * 0.6 + lookWorldX * 0.4;
}

// proj 结果槽位池：消除每帧数百次对象分配（GC 抖动主源）。
// 调用方最多可同时持有 PROJ_SLOTS 个返回值；当前最多同时持有 4 个
// （drawDangerBands 的 pA/pB/pC/pD），8 槽留足余量。新增调用方若需
// 同时持有更多结果，须同步调大 PROJ_SLOTS。
const PROJ_SLOTS = 8;
const projSlots = [];
for (let i = 0; i < PROJ_SLOTS; i++) projSlots.push({ x: 0, y: 0, scale: 0 });
let projCursor = 0;

export function proj(z, worldX) {
  const out = projSlots[projCursor];
  projCursor = (projCursor + 1) % PROJ_SLOTS;
  const cd = game.camDNow || C.CAM_D;           // C2: 动态相机距离（加速态拉近）
  const scale = cd / (cd + z);
  // 垂直方向：玩家所在 z 处固定屏幕高度，远处点按相对玩家脚的高度差起伏
  const playerElev = trackElev(game.distance + C.PLAYER_Z) * C.ELEV_PX;
  const pointElev = trackElev(game.distance + z) * C.ELEV_PX;
  out.y = horizonY() + (H - horizonY()) * scale + (pointElev - playerElev) * scale;
  // 水平方向：相对相机中心
  const relX = trackCenterX(game.distance + z) + worldX - camTargetX();
  out.x = W / 2 + relX * scale * roadScale();
  out.scale = scale;
  return out;
}
export function worldSize(s, scale) { return s * scale * roadScale(); }

// ---- 飘字 ----
export function popupAt(text, worldX, worldZ, dy, t) {
  const p = proj(worldZ, worldX);
  world.popups.push({ x: p.x, y: p.y - (dy || 30), text, t: (t == null ? 1.1 : t) });
}

// ---- 重置 / 状态转换 ----
export function resetRun() {
  game.speed = C.SPEED_START;
  game.distance = 0;
  game.score = 0;
  game.coins = 0;
  game.spawnTimer = 0;
  game.spawnGap = C.SPAWN_GAP_START;
  game.invincT = 0;
  game.boostT = 0;
  game.stunCount = 0;
  game.slowT = 0;
  game.dizzyT = 0;
  game.ridingTrain = null; game.rideT = 0;
  game.avalancheZ = C.PLAYER_Z + C.AVALANCHE_MAX_GAP;
  game.avaGap = C.AVALANCHE_MAX_GAP;
  game.avalancheWarn = 0;
  game.avaDanger = 0;                 // 雪崩危险度 0~1（驱动红色边缘渐变）
  game.miniSurgeT = 0;
  game.nextMini = C.MINI_SURGE_MIN + Math.random() * (C.MINI_SURGE_MAX - C.MINI_SURGE_MIN);
  game.carveTipT = 0;                 // 压弯教学提示剩余秒数
  game.carveTipShown = false;
  game.surgeClean = true;
  game.nextSurge = C.SURGE_MIN + Math.random() * (C.SURGE_MAX - C.SURGE_MIN);
  game.surgeT = 0;
  game.combo = 0; game.comboT = 0; game.feverGauge = 0; game.feverT = 0;
  game.lastLane = 1; game.laneSwitchT = 0;
  game.fallT = 0; game.fallTaps = 0;
  game.magnetT = 0; game.shield = 0; game.doubleT = 0; game.rocketT = 0;
  game.countT = 0; game.goT = 0;
  game.tutorial = storage.isFirstRun();
  game.tutStep = 0;
  game.coinCombo = 0; game.coinComboT = 0; game.lastMilestone = 0; game.shake = 0;
  game.camDNow = C.CAM_D; game.camRollNow = 0;
  game.gateN = 0; game.gateCombo = 0; game.lastGateDist = 0;
  player.lane = 1; player.x = 0; player.targetX = 0; player.tilt = 0;
  player.jump = 0; player.jumpDur = C.JUMP_DUR; player.jumps = 0; player.jumpStartH = 0; player.curH = 0; player.crouch = 0;
  player.airSpin = 0; player.spinDir = 0; player.jumpHeld = false;
  world.entities.length = 0;
  world.popups.length = 0;
  world.trail.length = 0;
  // 刷新装备属性 + 初始化单局任务
  game.equipStats = skins.getEquippedStats();
  game.landGrace = 0;
  game.phase = 'normal'; game.phaseDist = 0; game.phaseLen = 0;
  game.lastHit = null; game.deathTip = ''; game.deathDetail = '';
  initQuests();
}

// 难度段落化：基于距离推进 喘息(calm) → 普通(normal) → 高潮(surge) 循环，制造张弛节奏
export function updatePhase(dt) {
  if (game.distance < C.PHASE.startDist) { game.phase = 'normal'; return; }
  game.phaseDist += effSpeedApprox() * dt;
  if (game.phaseDist >= game.phaseLen) {
    // 切到下一段
    const order = ['calm', 'normal', 'surge'];
    const cur = order.indexOf(game.phase);
    const next = order[(cur + 1) % order.length] || 'normal';
    game.phase = next;
    game.phaseDist = 0;
    game.phaseLen = next === 'calm' ? C.PHASE.calmLen : next === 'surge' ? C.PHASE.surgeLen : C.PHASE.normalLen;
    if (next === 'surge') {
      // 高潮段：加速带 + 雪崩逼近提示
      game.boostT = Math.max(game.boostT, C.PHASE.surgeBoostDur);
      popupAt('加速带!', 0, C.PLAYER_Z, 80, 1.2);
      audio.sfxBoost();
    } else if (next === 'calm') {
      popupAt('喘息段', 0, C.PLAYER_Z, 60, 1.0);
    }
  }
}
// 段落推进用近似速度（避免与 entities 的 effSpeed 耦合），用 game.speed 即可
function effSpeedApprox() { return game.speed || C.SPEED_START; }

export function clearTrainCoins(trainId) {
  for (const e of world.entities) {
    if (e.onTrain && e.trainId === trainId && !e.got) e.got = true;
  }
}

export function startGame() {
  resetRun();
  game.state = 'playing';
  game.countT = C.COUNTDOWN_TOTAL;
  game.goT = 0;
  // 成瘾：连胜登记（每天首次游玩计一次，断签清零）+ 本局结晶清零
  meta.registerStreak();
  meta.beginRun();
  ui.hideAllPanels();
  ui.setPowerBadges('');
}

export function toMenu() {
  resetRun();
  game.state = 'menu';
  ui.refreshMenu();
  ui.showMenu();
}

export function moveLane(dir) {
  if (game.state !== 'playing') return;
  if (game.ridingTrain) game.ridingTrain = null;   // 离开火车道即下车
  const nl = Math.max(0, Math.min(2, player.lane + dir));
  if (nl !== player.lane) {
    game.lastLane = player.lane;
    game.laneSwitchT = C.LANE_SWITCH_NEAR_WINDOW;
    player.lane = nl;
    player.targetX = laneWorldX(nl);
    player.tilt = dir;
    audio.sfxLane();
  }
}

export function doJump() {
  if (game.state !== 'playing' || game.countT > 0) return;
  if (game.ridingTrain) {          // 从火车上飞身下车（奖励）
    const tr = game.ridingTrain;
    game.ridingTrain = null;
    const bonus = C.SCORE_TRAIN_JUMP * (game.feverT > 0 ? 2 : 1);
    game.score += bonus;
    game.feverGauge = Math.min(C.FEVER_MAX, game.feverGauge + 10);
    popupAt('飞身下车 +' + bonus, player.x, C.PLAYER_Z, 70, 1.0);
    clearTrainCoins(tr.trainId);
    if (tr) tr.z = -20;            // 整列车移出场景
    player.jumps = 1; player.jumpDur = C.JUMP_DUR; player.jumpStartH = 0; player.jump = C.JUMP_DUR;
    audio.sfxJump();
    return;
  }
  if (player.jumps < C.MAX_JUMPS) {
    player.jumps++;
    const idx = Math.min(player.jumps - 1, C.JUMP_DURS.length - 1);
    player.jumpDur = C.JUMP_DURS[idx];
    if (player.jumps > 1) player.jumpStartH = player.curH || 0;
    player.jump = player.jumpDur;
    player.jumpHeld = true;                          // 可变跳跃高度：按住更高
    game.feverGauge = Math.min(C.FEVER_MAX, game.feverGauge + 1);   // 跳跃微充能
    audio.sfxJump();
  } else {
    // 已在空中且无法再跳：记录跳跃缓冲，落地瞬间自动触发下一跳
    game.jumpBufferT = C.JUMP_BUFFER;
  }
}

export function doCrouch() {
  if (game.state === 'playing') player.crouch = C.CROUCH_DUR;
}
// 长按蹲下（由 input 每帧驱动）
export function holdCrouch(on) {
  if (on) player.crouch = Math.max(player.crouch, 0.12);
}

export function fallStart() {
  game.fallT = 1.2;
  game.fallTaps = 0;
  game.combo = 0; game.comboT = 0;
  audio.sfxFall();
}
export function addFallTap() {
  if (game.fallT <= 0) return;
  game.fallTaps++;
  if (game.fallTaps >= 3) {
    game.fallT = 0;
    game.invincT = Math.max(game.invincT, 1.2);   // 起身缓冲
    game.avaGap = Math.max(game.avaGap, C.FALL_RECOVER_GAP);   // 起身保底
    audio.sfxLane();
  }
}

export function gameOver(reason) {
  if (game.state === 'over') return;
  game.state = 'over';
  game.fallT = 0; game.fallTaps = 0;
  game.ridingTrain = null;
  const d = Math.floor(game.distance);
  const sc = Math.floor(game.score);
  const newBestDist = d > game.best;
  const newBestScore = sc > game.bestScore;
  if (newBestDist) { game.best = d; storage.setBest(d); }
  if (newBestScore) { game.bestScore = sc; storage.setBestScore(sc); }
  storage.addCoins(game.coins);
  const qReward = questReward();
  if (qReward > 0) storage.addCoins(qReward);
  // 成瘾：段位累计 + 保底宝箱（含里程奖励）+ 每日榜 + 每日目标
  const tierGained = meta.recordRun(d, sc, 0);
  const boxesGained = C.BOX_GAIN_PER_RUN + Math.floor(d / 500) * C.BOX_GAIN_PER_500M;
  meta.grantBox(boxesGained);
  const dailyRank = meta.recordDaily(sc, d).rank;
  const stats = {};
  if (game.quests) for (const q of game.quests) stats[q.stat] = q.progress;
  const daily = meta.checkDailyObjective(stats);
  game.runMeta = { crystal: meta.sessionCrystal(), boxes: boxesGained, tierGained, dailyRank, daily };
  if (game.tutorial) storage.markTutorialDone();
  audio.sfxCrash();
  if (newBestDist || newBestScore) audio.sfxNewBest();
  // 失败归因：细化死因 + 改进建议
  const HIT_NAME = { fence: '雪堆栅栏', bar: '低悬横杆', bomb: '雪球炸弹', train: '铲雪火车', gap: '冰裂缝' };
  const HIT_TIP = {
    fence: '遇到栅栏要跳过去',
    bar: '横杆要下蹲或跳跃躲避',
    bomb: '雪球炸弹会连晕三次，注意跳跃避开',
    train: '火车很长，跳上顶部可白赚金币',
    gap: '冰裂缝跳不过，提前换道',
  };
  let detail = '';
  if (reason === '摔倒' && game.lastHit && HIT_NAME[game.lastHit]) {
    detail = '撞到' + HIT_NAME[game.lastHit] + '摔倒了';
    game.deathTip = HIT_TIP[game.lastHit];
  } else if (reason === '雪崩') {
    detail = game.fallT > 0 ? '摔倒后没及时起身，被雪崩吞没' : '被雪崩追上';
    game.deathTip = '雪崩逼近时保持滑行别摔倒';
  } else if (reason === '炸弹') {
    detail = '连续被雪球炸弹眩晕三次';
    game.deathTip = '看到炸弹就跳跃避开';
  } else {
    detail = reason || '游戏结束';
  }
  game.deathDetail = detail;
  ui.showOverlay(reason, { dist: d, score: sc, coins: game.coins, newBestDist, newBestScore, detail, runMeta: game.runMeta });
}

// ---- 暂停 ----
export function togglePause() {
  if (game.state === 'playing' && game.countT <= 0) {
    game.state = 'paused';
    audio.stopBgm();
    ui.showPause(true);
  } else if (game.state === 'paused') {
    game.state = 'playing';
    audio.ensureBgm();
    ui.showPause(false);
  }
}
export function autoPause() {
  if (game.state === 'playing' && game.countT <= 0) {
    game.state = 'paused';
    audio.stopBgm();
    ui.showPause(true);
  }
}
