// entities.js —— 实体生成 + 碰撞/收集/连击/Fever/雪崩/摔倒 更新（核心玩法逻辑）
import * as C from './config.js';
import * as state from './state.js';
import {
  game, player, world, W, H, laneWorldX, popupAt, randLane,
  gameOver, fallStart, holdCrouch, clearTrainCoins,
} from './state.js';
import * as audio from './audio.js';
import * as meta from './meta.js';
import { held } from './input.js';
import * as vfx from './vfx.js';
import { questEvent } from './quests.js';
import { updatePhase } from './state.js';
import * as snowfight from './snowfight.js';

let trainIdSeq = 0;

function isObstacle(t) {
  return t === 'fence' || t === 'bar' || t === 'bomb' || t === 'train' || t === 'gap';
}
function entityLen(e) {
  return (e.type === 'train') ? C.TRAIN_LEN : (e.type === 'gap' ? C.GAP_LEN : 0);
}

// ---- 生成 ----
function laneOccupiedAtSpawn(lane, margin) {
  for (const e of world.entities) {
    if (!isObstacle(e.type)) continue;
    if (e.lane !== lane) continue;
    const len = entityLen(e);
    if (len > 0) {
      if (e.z - margin <= C.Z_FAR && e.z + len + margin >= C.Z_FAR) return true;
    } else if (Math.abs(e.z - C.Z_FAR) < margin) return true;
  }
  return false;
}
function freeLanes(margin) {
  const a = [];
  for (let l = 0; l < 3; l++) if (!laneOccupiedAtSpawn(l, margin)) a.push(l);
  return a;
}

function spawnTrain(fl) {
  const lane = fl[Math.floor(Math.random() * fl.length)];
  const trainId = ++trainIdSeq;
  world.entities.push({ z: C.Z_FAR, lane, type: 'train', got: false, avoided: false, missed: false, trainId });
  // 车顶金币（骑乘时可收集，普通玩家被车头挡在道外）
  for (let k = 0; k < 4; k++) {
    world.entities.push({ z: C.Z_FAR + 0.3 + k * 0.35, lane, type: 'coin', got: false, onTrain: true, trainId });
  }
}

function spawnTutorial() {
  const step = game.tutStep++;
  if (step === 0 || step === 2) {
    for (let i = 0; i < 3; i++) world.entities.push({ z: C.Z_FAR - i * 1.4, lane: 1, type: 'coin', got: false });
  } else if (step === 1) {
    world.entities.push({ z: C.Z_FAR, lane: 1, type: 'fence', got: false, avoided: false, missed: false });
  } else if (step === 3) {
    world.entities.push({ z: C.Z_FAR, lane: 1, type: 'bar', got: false, avoided: false, missed: false });
  }
}

function spawn() {
  // 首局教学：前 4 次受控生成
  if (game.tutorial && game.tutStep < C.TUTORIAL_SPAWNS) { spawnTutorial(); return; }
  const r = Math.random();
  if (r < 0.42) {
    const lane = randLane();
    const n = 3 + (Math.random() < 0.5 ? 2 : 0) + (Math.random() < 0.3 ? 2 : 0);
    for (let i = 0; i < n; i++) world.entities.push({ z: C.Z_FAR - i * 1.4, lane, type: 'coin', got: false });
  } else if (r < 0.84) {
    const fl = freeLanes(2.5);
    if (fl.length) {
      const t = Math.random();
      if (t < 0.32) {
        const lane = fl[Math.floor(Math.random() * fl.length)];
        world.entities.push({ z: C.Z_FAR, lane, type: 'fence', got: false, avoided: false, missed: false });
      } else if (t < 0.50) {
        const lane = fl[Math.floor(Math.random() * fl.length)];
        world.entities.push({ z: C.Z_FAR, lane, type: 'bomb', got: false, avoided: false, missed: false });
      } else if (t < 0.66) {
        const lane = fl[Math.floor(Math.random() * fl.length)];
        world.entities.push({ z: C.Z_FAR, lane, type: 'bar', got: false, avoided: false, missed: false });
      } else if (t < 0.82) {
        spawnTrain(fl);
      } else {
        // 冰裂缝：必须换道（跳跃无效），距离足够才出现
        if (game.distance >= C.GAP_MIN_DISTANCE) {
          const lane = fl[Math.floor(Math.random() * fl.length)];
          world.entities.push({ z: C.Z_FAR, lane, type: 'gap', got: false, avoided: false, missed: false });
        } else {
          spawnTrain(fl);
        }
      }
    }
  } else if (r < 0.89) {
    world.entities.push({ z: C.Z_FAR, lane: randLane(), type: 'boost', got: false });
  } else if (r < 0.95) {
    world.entities.push({ z: C.Z_FAR, lane: randLane(), type: 'star', got: false });
  } else {
    const kinds = ['magnet', 'shield', 'double', 'rocket'];
    world.entities.push({ z: C.Z_FAR, lane: randLane(), type: kinds[Math.floor(Math.random() * kinds.length)], got: false });
  }
}

// ---- 收集 ----
function collect(e) {
  e.got = true;
  if (e.type === 'coin') {
    const base = game.doubleT > 0 ? 2 : 1;
    const n = Math.max(1, Math.round(base * game.equipStats.coinX));
    game.coins += n;
    game.score += C.SCORE_COIN * n;
    game.feverGauge = Math.min(C.FEVER_MAX, game.feverGauge + 2);
    questEvent('coins', n);
    // 金币连击：2 秒内连续收集，音调递增 + 每 10 连弹字
    game.coinCombo++;
    game.coinComboT = 2;
    audio.sfxCoin(game.coinCombo);
    if (game.coinCombo % 10 === 0) {
      popupAt('金币连击 ×' + game.coinCombo + '!', player.x, C.PLAYER_Z, 80, 1.0);
      game.score += 50 * (game.coinCombo / 10);   // 连击奖励分
    }
    vfx.burstCoin(e.lane, e.z);
  } else if (e.type === 'star') {
    game.invincT = C.STAR_INVINC; game.feverGauge = Math.min(C.FEVER_MAX, game.feverGauge + 15); audio.sfxStar();
    vfx.burstStar(e.lane, e.z);
  } else if (e.type === 'boost') {
    game.boostT = 2.5; audio.sfxBoost();
    vfx.burstSparkle(e.lane, e.z, '#1fb6c9');
  } else if (e.type === 'magnet') {
    game.magnetT = C.MAGNET_DUR; audio.sfxPower(); popupAt('磁铁!', laneWorldX(e.lane), e.z);
    vfx.burstSparkle(e.lane, e.z, '#e74c3c');
  } else if (e.type === 'shield') {
    game.shield = 1; audio.sfxPower(); popupAt('护盾!', laneWorldX(e.lane), e.z);
    vfx.burstSparkle(e.lane, e.z, '#3498db');
  } else if (e.type === 'double') {
    game.doubleT = C.DOUBLE_DUR; audio.sfxPower(); popupAt('双倍金币!', laneWorldX(e.lane), e.z);
    vfx.burstSparkle(e.lane, e.z, '#f1c40f');
  } else if (e.type === 'rocket') {
    game.rocketT = C.ROCKET_DUR; game.invincT = Math.max(game.invincT, C.ROCKET_INVINC_GRACE); audio.sfxPower(); popupAt('火箭!', laneWorldX(e.lane), e.z);
    vfx.burstSparkle(e.lane, e.z, '#95a5a6');
  }
}

// ---- 连击奖励（擦身 / 极限换道）----
function awardNearMiss(label) {
  game.combo++;
  game.comboT = C.COMBO_TTL;
  game.shake = Math.max(game.shake, 0.18);   // 惊险反馈：轻微屏幕震动
  questEvent('nearmiss', 1);
  // 成瘾：擦身有概率掉结晶（可变奖励）
  const dc = meta.dropCrystal();
  if (dc) popupAt('💎 ' + dc.rar + (dc.skin ? ' ' + meta.skinName(dc.skin) : ' +' + dc.amt), player.x, C.PLAYER_Z, 56, 0.9);
  game.feverGauge = Math.min(C.FEVER_MAX, game.feverGauge + 8);
  game.score += C.SCORE_NEAR_MISS * game.combo;
  if (game.combo % C.COMBO_SHAKE_GAP === 0) {
    game.avaGap = Math.min(C.AVALANCHE_MAX_GAP, game.avaGap + C.COMBO_GAP_BONUS);
    popupAt('甩开雪崩! +' + C.COMBO_GAP_BONUS, player.x, C.PLAYER_Z, 90, 1.3);
  }
  audio.sfxNearMiss();
  popupAt(label + ' ×' + game.combo, player.x, C.PLAYER_Z, 60, 0.9);
}

// ---- 过障专属反馈（跳过栅栏/炸弹、钻过横杆）：强化"我漂亮地越过了"的代入感 ----
function clearPass(e, kind) {
  game.combo++;
  game.comboT = C.COMBO_TTL;
  game.shake = Math.max(game.shake, 0.12);   // 轻微镜头冲击：过障爽感
  game.feverGauge = Math.min(C.FEVER_MAX, game.feverGauge + 5);
  const bonus = C.SCORE_CLEAR * game.combo;
  game.score += bonus;
  questEvent('nearmiss', 1);                 // 计入"擦身障碍"任务（过障=极限操作）
  // 视觉：障碍在脚下炸开火花（从你身下掠过的 whoosh 感）
  const col = kind === 'duck' ? '#74b9ff' : '#ffd34d';
  vfx.burstSparkle(e.lane, e.z, col);
  popupAt(kind === 'duck' ? '钻过! +' + bonus : '跳过! +' + bonus, laneWorldX(e.lane), e.z, 58, 0.85);
  audio.sfxClear();
}
export function update(dt) {
  // 欢乐打雪仗：状态路由到独立模块，跳过滑雪逻辑
  if (game.state === 'snowfight') { snowfight.updateSnowFight(dt); return; }
  // 环境粒子（菜单也动）—— 3 层视差：按 layer 区分下落速度/横向漂移；高速时近层加速+斜飞增强
  const playing = game.state === 'playing';
  const speedK = playing ? Math.min(1.5, game.speed / C.SPEED_MAX) : 0;
  const nearBoost = 1 + speedK * 0.8;   // 近层在高速时显著加速（迎面风雪感）
  for (const p of world.snow) {
    const sp = p.sp * (p.layer === 2 ? nearBoost : (p.layer === 1 ? 1 + speedK * 0.25 : 1));
    p.y += sp * dt;
    // 横向漂移：近层斜飞（高速时风斜更大），远层几乎直落
    const wind = p.drift * (1 + speedK * (p.layer === 2 ? 1.2 : 0.3));
    p.x += Math.sin((p.y + p.r) * 0.02) * wind * dt + (p.layer === 2 ? speedK * 14 * dt : 0);
    if (p.y > H) { p.y = -5; p.x = Math.random() * W; }
    if (p.x < -10) p.x = W + 5; else if (p.x > W + 10) p.x = -5;
  }
  for (let i = world.popups.length - 1; i >= 0; i--) {
    world.popups[i].t -= dt; world.popups[i].y -= 40 * dt;
    if (world.popups[i].t <= 0) world.popups.splice(i, 1);
  }
  if (game.state !== 'playing') return;

  // 倒计时：世界静止
  if (game.countT > 0) {
    game.countT = Math.max(0, game.countT - dt);
    if (game.countT <= 0) game.goT = C.GO_FLASH;
    return;
  }
  if (game.goT > 0) game.goT = Math.max(0, game.goT - dt);

  // 摔倒：世界静止、连点起身；雪崩趁机猛追（磨蹭不起身才危险，归因清晰）
  if (game.fallT > 0) {
    game.fallT = Math.max(0, game.fallT - dt);
    game.avaGap -= dt * C.FALL_CATCH_RATE;
    game.surgeClean = false;
    game.avalancheZ = C.PLAYER_Z + game.avaGap;
    game.avalancheWarn = (game.avaGap < C.AVALANCHE_WARN_GAP) ? 1 : 0;
    if (game.avaGap <= 0.3) { gameOver('雪崩'); return; }
    if (game.fallT <= 0) { gameOver('摔倒'); return; }
    return;
  }

  // 计时器递减
  if (game.invincT > 0) game.invincT = Math.max(0, game.invincT - dt);
  if (game.boostT > 0) game.boostT = Math.max(0, game.boostT - dt);
  if (game.slowT > 0) game.slowT = Math.max(0, game.slowT - dt);
  if (game.dizzyT > 0) game.dizzyT = Math.max(0, game.dizzyT - dt);
  if (game.magnetT > 0) game.magnetT = Math.max(0, game.magnetT - dt);
  if (game.doubleT > 0) game.doubleT = Math.max(0, game.doubleT - dt);
  if (game.rocketT > 0) game.rocketT = Math.max(0, game.rocketT - dt);
  if (game.laneSwitchT > 0) game.laneSwitchT = Math.max(0, game.laneSwitchT - dt);

  // Fever：结束奖励（甩开雪崩）
  if (game.feverT > 0) {
    game.feverT = Math.max(0, game.feverT - dt);
    if (game.feverT <= 0) {
      game.avaGap = Math.min(C.AVALANCHE_MAX_GAP, game.avaGap + C.FEVER_END_GAP_BONUS);
      popupAt('雪崩被甩开! +' + C.FEVER_END_GAP_BONUS, player.x, C.PLAYER_Z, 80, 1.2);
    }
  } else if (game.feverGauge >= C.FEVER_MAX) {
    game.feverT = C.FEVER_DUR;
    game.feverGauge = 0;
    audio.sfxFever();   // Fever = 双倍分 + 速度高潮（不再给无敌，避免"无敌太容易获得"）
  }
  if (game.comboT > 0) { game.comboT = Math.max(0, game.comboT - dt); if (game.comboT <= 0) game.combo = 0; }
  if (game.coinComboT > 0) { game.coinComboT = Math.max(0, game.coinComboT - dt); if (game.coinComboT <= 0) game.coinCombo = 0; }
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);

  // C2: 加速态相机拉近（Boost/Rocket → 透视增强；Fever 不再拉镜，避免 8s 持续眩晕）
  {
    const tgtCamD = (game.boostT > 0 || game.rocketT > 0) ? C.CAM_D_BOOST : C.CAM_D;
    game.camDNow += (tgtCamD - game.camDNow) * Math.min(1, dt * C.CAM_D_LERP);
  }
  // C3: 过弯相机 roll（随弯道曲率倾斜，与玩家压弯同向，平滑过渡）
  {
    const curv = state.trackCenterDX(game.distance);
    const tgtRoll = Math.max(-C.CAM_ROLL_MAX, Math.min(C.CAM_ROLL_MAX, curv * C.CAM_ROLL_GAIN));
    game.camRollNow += (tgtRoll - game.camRollNow) * Math.min(1, dt * C.CAM_ROLL_LERP);
  }

  // 蹲下长按
  if (held.down) holdCrouch(true);

  // 跳跃缓冲：落地前提前按，落地瞬间自动触发
  if (game.jumpBufferT > 0) {
    game.jumpBufferT = Math.max(0, game.jumpBufferT - dt);
    if (game.jumpBufferT > 0 && player.jump <= 0 && player.jumps === 0) {
      state.doJump();
    }
  }

  // 空中：特技旋转（方向键/触摸滑动持续累加）+ 可变跳跃高度（松手提前落）
  const wasAir = player.jump > 0;
  if (player.jump > 0) {
    if (held.left && !held.right) { player.spinDir = -1; player.airSpin -= C.AIR_SPIN_RATE * dt; }
    else if (held.right && !held.left) { player.spinDir = 1; player.airSpin += C.AIR_SPIN_RATE * dt; }
    // 上升期松开跳跃键 → 提前落地（Early Fall），更可控的落点
    if (!player.jumpHeld && player.jump > player.jumpDur * 0.32) {
      player.jump = Math.max(player.jumpDur * 0.16, player.jump - dt * C.AIR_CUT_RATE);
    }
    player.jump = Math.max(0, player.jump - dt);
  }
  // 落地：结算空中特技（整圈翻转计入连击）
  if (wasAir && player.jump <= 0) {
    const rot = Math.round(player.airSpin / (Math.PI * 2));
    if (rot !== 0) {
      const n = Math.abs(rot);
      game.combo += n;
      game.comboT = C.COMBO_TTL;
      game.feverGauge = Math.min(C.FEVER_MAX, game.feverGauge + 6 * n);
      game.score += C.SCORE_TRICK * n * Math.max(1, game.combo);
      const label = (rot > 0 ? '前空翻 ×' : '后空翻 ×') + n;
      popupAt(label + '  连击×' + game.combo, player.x, C.PLAYER_Z, 70, 1.0);
      vfx.burstSparkle(player.lane, C.PLAYER_Z, rot > 0 ? '#ffd34d' : '#74b9ff');
    }
    player.airSpin = 0; player.spinDir = 0; player.jumps = 0;
    // glide 属性：落地瞬间的平稳缓冲（短时无敌，避免落地即撞）
    if (game.equipStats.glide > 0) game.landGrace = 0.18;
  }
  if (player.crouch > 0) player.crouch = Math.max(0, player.crouch - dt);

  // 速度 / 距离 / 分数（分离）+ 真实坡度影响 + 难度渐进（随距离抬升速度上限）
  const slope = state.trackSlope(game.distance);   // 正=上坡(减速) 负=下坡(加速)
  const speedCap = Math.min(C.SPEED_MAX_CAP, C.SPEED_MAX + (game.distance / 100) * C.SPEED_RAMP_PER_100M);
  game.speed = Math.min(speedCap, game.speed + dt * C.SPEED_ACCEL - slope * C.SLOPE_SPEED_GAIN * dt);
  if (game.speed < C.SPEED_START * 0.6) game.speed = C.SPEED_START * 0.6;
  const effSpeed = game.speed * (game.boostT > 0 ? C.BOOST_MULT : 1) * (game.slowT > 0 ? C.SLOW_MULT : 1) * (game.rocketT > 0 ? C.ROCKET_MULT : 1);
  game.distance += effSpeed * dt * C.DIST_SCALE;
  game.score += effSpeed * dt * C.SCORE_PER_M * (game.feverT > 0 ? 2 : 1);

  // 里程碑：每 250m 弹成就 + 音效（即时小目标反馈）
  const ms = Math.floor(game.distance / C.MILESTONE_STEP);
  if (ms > game.lastMilestone) {
    game.lastMilestone = ms;
    popupAt(ms * C.MILESTONE_STEP + 'm 达成!', 0, C.PLAYER_Z + 3, 70, 1.4);
    audio.sfxMilestone();
  }

  // 难度段落化（张弛节奏推进）
  updatePhase(dt);

  // 雪崩 v2：节日式周期事件——平时隐身（gap=18 画面外），周期冲击波逼近制造心跳
  // 安全地板 gap=4：正常滑行物理上不可能被吞；唯一真危险 = 摔倒后磨蹭不起身
  game.nextSurge -= dt;
  if (game.nextSurge <= 0 && game.surgeT <= 0) {
    game.surgeT = C.SURGE_DUR;
    game.surgeClean = true;              // 本次冲击波是否零摔倒（扛过给大奖励）
    game.nextSurge = C.SURGE_MIN + Math.random() * (C.SURGE_MAX - C.SURGE_MIN);
    audio.sfxAvalancheWarn();
  }
  if (game.surgeT > 0) {
    game.surgeT = Math.max(0, game.surgeT - dt);
    // 逼近到安全地板（不更低）；高潮段逼近更猛
    if (game.avaGap > C.AVALANCHE_SURGE_MIN_GAP) {
      const avaIn = game.phase === 'surge' ? C.PHASE.surgeAvaIn : C.AVALANCHE_SURGE_IN;
      game.avaGap = Math.max(C.AVALANCHE_SURGE_MIN_GAP, game.avaGap - dt * avaIn);
    }
    // 冲击波扛过：零摔倒 → 甩开大奖励（高光时刻）
    if (game.surgeT <= 0 && game.surgeClean) {
      game.score += C.AVALANCHE_SURGE_SCORE;
      popupAt('甩开雪崩! +' + C.AVALANCHE_SURGE_SCORE, player.x, C.PLAYER_Z, 90, 1.4);
      audio.sfxAvalancheEscape();
      vfx.burstSparkle(player.lane, C.PLAYER_Z, '#ffd34d');
    }
  } else if (game.avaGap < C.AVALANCHE_MAX_GAP && game.miniSurgeT <= 0) {
    // 平时退场回满（隐身）
    game.avaGap = Math.min(C.AVALANCHE_MAX_GAP, game.avaGap + dt * C.AVALANCHE_SURGE_OUT);
  }
  // 偶发小雪崩：在冲击波之外间歇逼近到 MINI_SURGE_GAP（>安全地板），制造"真会被追"的紧张
  if (game.surgeT <= 0) {
    if (game.miniSurgeT > 0) {
      game.miniSurgeT = Math.max(0, game.miniSurgeT - dt);
      if (game.avaGap > C.MINI_SURGE_GAP) game.avaGap = Math.max(C.MINI_SURGE_GAP, game.avaGap - dt * 2.0);
    } else {
      game.nextMini -= dt;
      if (game.nextMini <= 0) {
        game.miniSurgeT = 3.2;
        game.nextMini = C.MINI_SURGE_MIN + Math.random() * (C.MINI_SURGE_MAX - C.MINI_SURGE_MIN);
        audio.sfxAvalancheWarn();
      }
    }
  }
  game.avalancheZ = C.PLAYER_Z + game.avaGap;
  game.avalancheWarn = (game.avaGap < C.AVALANCHE_WARN_GAP) ? 1 : 0;

  // C4: 雪崩渐进震屏 + 危险度——冲击波/小雪崩逼近时持续低频微震，幅度随 nearness 增长
  // （非仅擦边离散触发；维持型：每帧拉回 target，离开逼近区后由上方衰减自然归零）
  {
    const avThreshold = C.AVALANCHE_WARN_GAP + 2.5;        // 逼近感知半径（gap 单位）
    let danger = 0;
    if (game.avaGap < avThreshold) {
      danger = Math.min(1, (avThreshold - game.avaGap) / avThreshold);
      const targetShake = danger * 0.16;                  // 渐进微震上限（略低于擦边 0.18）
      if (targetShake > game.shake) game.shake = targetShake;
    }
    game.avaDanger = danger;                               // 驱动红色边缘渐变（render 绘制）
  }

  // 车道平滑 + 压弯物理（弯道离心力把玩家甩向外侧，需主动朝弯内换道抵消）
  // dodge 属性：换道更灵敏（横向移动更快 → 更高容错）
  const k = Math.min(1, dt * (11 + game.equipStats.dodge * 22));
  player.x += (player.targetX - player.x) * k;
  player.tilt += (0 - player.tilt) * Math.min(1, dt * 8);
  if (game.state === 'playing' && player.jump <= 0) {
    const curv = state.trackCenterDX(game.distance);          // 弯道曲率：>0 右弯, <0 左弯
    // 压弯教学引导：首次遇到明显弯道时弹出提示（仅一次）
    if (!game.carveTipShown && Math.abs(curv) > 0.4) {
      game.carveTipShown = true; game.carveTipT = 3.4;
    }
    if (game.carveTipT > 0) game.carveTipT = Math.max(0, game.carveTipT - dt);
    const drift = -curv * C.CARVE_DRIFT;                       // 离心力：把玩家甩向弯道外侧
    // 玩家主动压弯量 = 当前横向速度方向
    const carveInput = (player.targetX - player.x);
    const residual = drift - carveInput * 0.8;                 // 未被压弯抵消的部分
    if (Math.abs(curv) > 0.0008) {
      player.x += drift * dt;                                  // 离心力横向甩出
      if (Math.abs(residual) > 0.04) {
        // 压弯不足：减速 + 车身侧倾抖动反馈
        game.speed -= C.CARVE_PENALTY * Math.abs(residual) * dt;
        player.tilt += Math.sign(residual) * dt * 2.4;
      } else {
        player.tilt += Math.sign(curv) * dt * 1.6;             // 成功压弯：漂亮的车身倾角
      }
    }
    // 限制玩家不要被甩出雪道
    const limit = C.LANE_SPACING + 0.2;
    if (player.x > limit) { player.x = limit; player.targetX = Math.min(player.targetX, limit); }
    if (player.x < -limit) { player.x = -limit; player.targetX = Math.max(player.targetX, -limit); }
  }

  // 记录雪痕轨迹（贴地时）
  state.recordTrail();

  // 生成（障碍密度随距离渐进加密：难度曲线）+ 段落乘数（喘息稀疏/高潮密集）
  game.spawnTimer += dt;
  const phaseMul = game.phase === 'calm' ? C.PHASE.calmSpawnMul : game.phase === 'surge' ? C.PHASE.surgeSpawnMul : 1;
  game.spawnGap = Math.max(C.SPAWN_GAP_MIN, (C.SPAWN_GAP_START - game.distance * C.SPAWN_GAP_PER_M - (game.distance / 100) * C.SPAWN_GAP_PER_100M) / phaseMul);
  if (game.spawnTimer >= game.spawnGap) {
    game.spawnTimer = 0;
    spawn();
  }

  // 旗门生成：按距离间隔，红蓝交替，选无障碍车道（穿门得分，滑雪竞速感）
  if (game.distance - game.lastGateDist >= C.GATE_DIST) {
    game.lastGateDist = game.distance;
    const fl = freeLanes(2.2);
    if (fl.length) {
      const lane = fl[Math.floor(Math.random() * fl.length)];
      world.entities.push({ z: C.Z_FAR, lane, type: 'gate', color: (game.gateN % 2 === 0) ? 'red' : 'blue', passed: false, got: false });
      game.gateN++;
    }
  }

  // 实体处理
  for (let i = world.entities.length - 1; i >= 0; i--) {
    const e = world.entities[i];
    e.z -= effSpeed * dt;
    if (e.z + entityLen(e) < -1) { world.entities.splice(i, 1); continue; }

    // 磁铁：跨道吸附金币（道具磁铁强力吸附）
    if (game.magnetT > 0 && e.type === 'coin' && !e.got && Math.abs(e.z - C.PLAYER_Z) < C.MAGNET_RANGE) {
      e.z += (C.PLAYER_Z - e.z) * Math.min(1, dt * 10);
      e.lane += (player.lane - e.lane) * Math.min(1, dt * 8);
      if (Math.abs(player.lane - e.lane) < C.MAGNET_SNAP) e.lane = player.lane;
      if (Math.abs(e.z - C.PLAYER_Z) < C.COLLIDE_Z) { collect(e); continue; }
    } else if (e.type === 'coin' && !e.got && Math.abs(e.z - C.PLAYER_Z) < game.equipStats.magnet * 0.012) {
      // 装备磁吸：在装备半径内轻微吸向玩家（不跨道，仅缩短 z 距离）
      e.z += (C.PLAYER_Z - e.z) * Math.min(1, dt * 5);
    }

    // 旗门：门线经过玩家时结算（穿对门得分+连门递增，漏门断连）
    if (e.type === 'gate' && !e.passed && e.z < C.PLAYER_Z) {
      e.passed = true;
      if (e.lane === player.lane) {
        game.gateCombo++;
        const bonus = C.GATE_SCORE + (game.gateCombo - 1) * C.GATE_COMBO_BONUS;
        game.score += bonus;
        game.feverGauge = Math.min(C.FEVER_MAX, game.feverGauge + 4);
        questEvent('gates', 1);
        popupAt('过门 +' + bonus, laneWorldX(e.lane), e.z, 55, 0.8);
        // 成瘾：过门有概率掉结晶（可变奖励）
        const dc = meta.dropCrystal();
        if (dc) popupAt('💎 ' + dc.rar + (dc.skin ? ' ' + meta.skinName(dc.skin) : ' +' + dc.amt), laneWorldX(e.lane), e.z, 56, 0.9);
        audio.sfxGate();
      } else {
        game.gateCombo = 0;
      }
    }

    // Near Miss / 过障反馈：同道障碍掠过玩家身后时结算
    if (isObstacle(e.type) && !e.missed && e.z < C.PLAYER_Z - C.COLLIDE_Z) {
      if (e.lane === player.lane) {
        if (e.cleared) { e.missed = true; clearPass(e, e.cleared); }   // 跳过/钻过：专属爽感反馈
        else if (e.avoided) { e.missed = true; }                       // 护盾挡下：已弹字，不再计连击
      }
    }
    // Near Miss：换道极限闪避（障碍在你刚离开的车道贴身通过）
    if (isObstacle(e.type) && !e.missed && game.laneSwitchT > 0 &&
        e.lane === game.lastLane && e.lane !== player.lane &&
        Math.abs(e.z - C.PLAYER_Z) < C.LANE_SWITCH_NEAR_RANGE) {
      e.missed = true;
      awardNearMiss('极限换道');
    }

    // 骑乘：只收集车顶金币，其余忽略
    if (game.ridingTrain) {
      if (e.type === 'coin' && e.onTrain && !e.got && Math.abs(e.z - C.PLAYER_Z) < C.COLLIDE_Z) collect(e);
      continue;
    }
    if (e.got) continue;

    const inZ = (e.type === 'train' || e.type === 'gap')
      ? (C.PLAYER_Z >= e.z - C.COLLIDE_Z && C.PLAYER_Z <= e.z + entityLen(e) + C.COLLIDE_Z)
      : (Math.abs(e.z - C.PLAYER_Z) < C.COLLIDE_Z);
    const inLane = (e.lane === player.lane);
    if (inZ && inLane) {
      // glide 落地缓冲：落地瞬间免疫一次撞击（仅对障碍/火车生效，非道具）
      if (game.landGrace > 0 && (e.type !== 'coin' && e.type !== 'star' && e.type !== 'boost' &&
          e.type !== 'magnet' && e.type !== 'shield' && e.type !== 'double' && e.type !== 'rocket')) {
        game.landGrace = 0;
        e.avoided = true;
        popupAt('平稳落地!', laneWorldX(e.lane), e.z, 50, 0.7);
        continue;
      }
      if (e.type === 'coin' || e.type === 'star' || e.type === 'boost' ||
          e.type === 'magnet' || e.type === 'shield' || e.type === 'double' || e.type === 'rocket') {
        collect(e);
      } else if (e.type === 'fence') {
        if (player.jump > 0) { e.avoided = true; e.cleared = 'jump'; }   // 跳过：专属反馈
        if (!e.avoided && game.invincT <= 0) {
          if (game.shield > 0) { game.shield--; e.avoided = true; audio.sfxShield(); popupAt('护盾挡下!', laneWorldX(e.lane), e.z); vfx.burstSparkle(e.lane, e.z, '#74b9ff'); }
          else { game.lastHit = 'fence'; fallStart(); return; }
        }
      } else if (e.type === 'bar') {
        if (player.crouch > 0) { e.avoided = true; e.cleared = 'duck'; }   // 蹲过：专属反馈
        else if (player.jump > 0) { e.avoided = true; e.cleared = 'jump'; } // 也可跳过
        if (!e.avoided && game.invincT <= 0) {
          if (game.shield > 0) { game.shield--; e.avoided = true; audio.sfxShield(); popupAt('护盾挡下!', laneWorldX(e.lane), e.z); vfx.burstSparkle(e.lane, e.z, '#74b9ff'); }
          else { game.lastHit = 'bar'; fallStart(); return; }
        }
      } else if (e.type === 'bomb') {
        if (player.jump > 0) { e.avoided = true; e.cleared = 'jump'; }      // 跳过：专属反馈
        if (!e.avoided && game.invincT <= 0) {
          e.got = true;
          game.stunCount++;
          game.slowT = 2.6; game.dizzyT = 2.6;
          audio.sfxStun();
          if (game.stunCount >= 3) { game.lastHit = 'bomb'; gameOver('炸弹'); return; }
        }
      } else if (e.type === 'train') {
        if (player.jump > 0) {
          e.avoided = true;
          if (!game.ridingTrain) { game.ridingTrain = e; game.rideT = 1.8; }
        }
        if (!e.avoided && game.invincT <= 0) {
          if (game.shield > 0) { game.shield--; e.avoided = true; audio.sfxShield(); popupAt('护盾挡下!', laneWorldX(e.lane), e.z); vfx.burstSparkle(e.lane, e.z, '#74b9ff'); }
          else { game.lastHit = 'train'; fallStart(); return; }
        }
      } else if (e.type === 'gap') {
        // 冰裂缝：不可跳过，必须换道 / 护盾 / 无敌
        if (game.invincT <= 0) {
          if (game.shield > 0) { game.shield--; e.avoided = true; audio.sfxShield(); popupAt('护盾挡下!', laneWorldX(e.lane), e.z); vfx.burstSparkle(e.lane, e.z, '#74b9ff'); }
          else { game.lastHit = 'gap'; fallStart(); return; }
        }
      }
  }
  }  // 关闭实体 for 循环

  // 骑火车：火车停在原地，世界从脚下流过
  if (game.ridingTrain) {
    const tr = game.ridingTrain;
    tr.z = C.PLAYER_Z;
    game.rideT -= dt;
    if (game.rideT <= 0) {
      game.ridingTrain = null;
      clearTrainCoins(tr.trainId);
      tr.z = -20;
    }
  }
}
