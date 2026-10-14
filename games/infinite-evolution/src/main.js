// ============================================
//  无限进化 V1.2 — 主循环胶水层（美术全面升级）
//  协调所有模块，状态机，触摸路由
// ============================================

// ==================== 加载所有模块 ====================
import * as config from './config.js';
import * as utils from './utils.js';
import * as entities from './entities.js';
import * as systems from './systems.js';
import * as renderer from './renderer.js';
import { setupScreen } from './screen.js';

// ==================== 游戏对象（依赖注入） ====================
const game = {
  config,
  utils,
  entities,
  systems,
  renderer,

  // 玩家状态
  player: {
    hp: 100, maxHp: 100,
    shield: 100, maxShield: 100, shieldRegen: 6,
    weapons: ['stone'], maxSlots: 1, attackTimers: { stone: 0 },
    fruit: null, fruitEnergy: 0, fruitMaxEnergy: 100,
    form: 'primitive',
  },

  // 游戏状态
  state: {
    state: 'MENU', // MENU | PLAYING | DEAD | WEAPON_SELECT | FRUIT_SELECT | PAUSED | LEVEL_UP
    kills: 0,
    survivalTime: 0,
    damageFlash: 0,
    ultimateFlash: 0,
    ultimateFlashColor: '#fff',
    evolveFlash: 0,
    screenShake: 0,
    screenShakeX: 0,
    screenShakeY: 0,
    pendingWeapon: null,
    pendingFruit: null,
    hasPendingSelect: false,
    comboCount: 0,
    comboTimer: 0,
    comboMultiplier: 1.0,
    nextMilestone: 0,
    levelUpTimer: 0,
    levelCount: 0,
    pendingTalents: [],
    bossDeadTimer: 0,
    bossDeadCount: 0,
    isNewRecord: false,

    // 天赋加成
    talentBonuses: {
      dmgMult: 1.0,
      intervalMult: 1.0,
      energyGain: 1.0,
      pierce: false,
      explosionMult: 1.0,
      killHeal: 0,
      multiShot: false,
      ghostBlade: false,
    },
    acquiredTalents: [],

    // 难度
    spawnTimer: 0,
    spawnInterval: 1.2,
    difficultyTimer: 0,
    difficultyMult: 1.0,
    eliteTimer: 0,
    bossTimer: 0,

    // P0新增：新手引导
    tutorialActive: false,
    tutorialTimer: 0,

    // P1新增：BOSS战背景
    bossBgActive: false,
    bossBgTimer: 0,
  },

  // 实体集合
  objs: {
    bullets: [],
    monsters: [],
    particles: [],
    floatingTexts: [],
    lightnings: [],
    ghostBlades: [],
    bgStars: [],
    bgLayers: [],
    shockwaves: [],  // V1.2新增：冲击波
    nebula: [],      // V1.2新增：星云
    meteors: [],     // V1.2新增：流星
  },
};

// ==================== V1.2：初始化所有新特效系统 ====================
systems.initBgLayers(game);
systems.initBgStars(game);
systems.initNebula(game);
systems.initMeteors(game);

// ==================== 加载本地最高分与设置 ====================
utils.loadSettings();
utils.loadBestRecord();

// ==================== P0优化：主循环使用 requestAnimationFrame ====================
let lastTime = 0;

function gameLoop(timestamp) {
  // P0优化: RAF + 精确deltaTime
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // 上限50ms防止跳帧
  lastTime = timestamp;

  // 更新
  systems.update(game, dt);

  // 渲染
  renderer.draw(game);

  // 继续RAF
  requestAnimationFrame(gameLoop);
}

// ==================== 输入处理（参数已是游戏坐标） ====================
function handleInput(gx, gy) {
  if (!utils.isAudioInited()) {
    utils.initAudio();
  }

  const { state } = game.state;
  const { player } = game;

  // 菜单/死亡状态：触摸开始游戏
  if (state === 'MENU') {
    game.state.state = 'PLAYING';
    systems.resetGame(game);
    return;
  }
  if (state === 'DEAD') {
    game.state.state = 'PLAYING';
    systems.resetGame(game);
    return;
  }
  if (state === 'PAUSED') {
    game.state.state = 'PLAYING';
    return;
  }

  // P0新增：新手引导期触摸跳过
  if (game.state.tutorialActive) {
    game.state.tutorialActive = false;
    game.state.tutorialTimer = config.TUTORIAL_DURATION; // 直接设为结束
    entities.addFloatingText(game, config.CX, config.CY - 80, '💪 跳过引导，战斗开始!', '#2ecc71', 2.5);
  }

  // 天赋选择
  if (state === 'LEVEL_UP') {
    const cardW = 210, cardH = 95, gap = 18;
    const totalW = game.state.pendingTalents.length * cardW + (game.state.pendingTalents.length - 1) * gap;
    const startX = config.CX - totalW / 2;

    for (let i = 0; i < game.state.pendingTalents.length; i++) {
      const cx = startX + i * (cardW + gap);
      const cy = config.CY - 55;
      if (gx >= cx && gx <= cx + cardW && gy >= cy && gy <= cy + cardH) {
        systems.selectTalent(game, i);
        return;
      }
    }
    return;
  }

  // 游戏状态
  if (state === 'PLAYING') {
    // 大招按钮（更大更易按）
    if (player.fruit) {
      const ux = config.W - 65, uy = config.H - 65, ur = 50; // 增大热区
      if (Math.hypot(gx - ux, gy - uy) <= ur + 12) {
        entities.releaseUltimate(game);
        return;
      }
    }

    // 暂停按钮
    const px = config.W - 32, py = 45;
    if (gx >= px - 22 && gx <= px + 22 && gy >= py - 20 && gy <= py + 20) {
      game.state.state = 'PAUSED';
      return;
    }
  }

  // 武器选择
  if (state === 'WEAPON_SELECT') {
    const cbx = config.W - 32, cby = 15, cbs = 24;
    if (gx >= cbx - cbs / 2 && gx <= cbx + cbs / 2 && gy >= cby && gy <= cby + cbs) {
      game.state.pendingWeapon = null;
      game.state.hasPendingSelect = false;
      game.state.state = 'PLAYING';
      return;
    }
    for (let i = 0; i < player.weapons.length; i++) {
      const y = config.CY - 12 + i * 32;
      if (gx >= config.CX - 180 && gx <= config.CX + 180 && gy >= y - 13 && gy <= y + 15) {
        const old = player.weapons[i];
        player.weapons[i] = game.state.pendingWeapon;
        delete player.attackTimers[old];
        player.attackTimers[game.state.pendingWeapon] = 0;
        entities.addFloatingText(game, config.CX, config.CY - 40, `${config.WEAPON_DEFS[old].name} → ${config.WEAPON_DEFS[game.state.pendingWeapon].name}`, '#f1c40f', 2.0);
        utils.playSound('pickup');
        systems.checkForm(game);
        game.state.pendingWeapon = null;
        game.state.hasPendingSelect = false;
        game.state.state = 'PLAYING';
        return;
      }
    }
    const escY = config.CY - 12 + player.weapons.length * 32 + 8;
    if (gx >= config.CX - 48 && gx <= config.CX + 48 && gy >= escY - 12 && gy <= escY + 16) {
      game.state.pendingWeapon = null;
      game.state.hasPendingSelect = false;
      game.state.state = 'PLAYING';
      return;
    }
  }

  // 果实选择
  if (state === 'FRUIT_SELECT') {
    const cbx = config.W - 32, cby = 15, cbs = 24;
    if (gx >= cbx - cbs / 2 && gx <= cbx + cbs / 2 && gy >= cby && gy <= cby + cbs) {
      game.state.pendingFruit = null;
      game.state.hasPendingSelect = false;
      game.state.state = 'PLAYING';
      return;
    }
    if (gx >= config.CX - 115 && gx <= config.CX - 10 && gy >= config.CY + 65 && gy <= config.CY + 99) {
      player.fruit = game.state.pendingFruit;
      player.fruitEnergy = 0;
      entities.addFloatingText(game, config.CX, config.CY - 40, `${config.FRUIT_DEFS[game.state.pendingFruit].icon} ${config.FRUIT_DEFS[game.state.pendingFruit].name}!`, config.FRUIT_DEFS[game.state.pendingFruit].color, 2.5);
      utils.playSound('pickup');
      game.state.pendingFruit = null;
      game.state.hasPendingSelect = false;
      game.state.state = 'PLAYING';
      return;
    }
    if (gx >= config.CX + 10 && gx <= config.CX + 115 && gy >= config.CY + 65 && gy <= config.CY + 99) {
      game.state.pendingFruit = null;
      game.state.hasPendingSelect = false;
      game.state.state = 'PLAYING';
      return;
    }
  }
}

// ==================== 输入事件绑定（Pointer Events） ====================
config.canvas.addEventListener('pointerdown', function (e) {
  e.preventDefault();
  try { config.canvas.setPointerCapture(e.pointerId); } catch (err) {}

  // 首次交互初始化音频（浏览器自动播放策略要求）
  if (!utils.isAudioInited()) {
    utils.initAudio();
  }

  // 触摸反馈
  config.touchFeedback.active = true;
  config.touchFeedback.x = e.clientX;
  config.touchFeedback.y = e.clientY;
  config.touchFeedback.timer = 0.3;

  // 转换为游戏逻辑坐标
  const gp = config.screenToGame(e.clientX, e.clientY);
  handleInput(gp.x, gp.y);
});

// 兜底：iOS Safari 13 之前可能不支持 pointerdown
config.canvas.addEventListener('touchstart', function (e) {
  if (e.touches && e.touches.length > 0) {
    e.preventDefault();
    if (!utils.isAudioInited()) utils.initAudio();
    const touch = e.touches[0];
    const gp = config.screenToGame(touch.clientX, touch.clientY);
    handleInput(gp.x, gp.y);
  }
}, { passive: false });

// ==================== 键盘层（P暂停 / R重开 / M静音） ====================
window.addEventListener('keydown', function (e) {
  const k = typeof e.key === 'string' ? e.key.toLowerCase() : '';

  if (k === 'm') {
    if (!utils.isAudioInited()) utils.initAudio();
    const nowMuted = utils.toggleMute();
    entities.addFloatingText(game, config.CX, config.CY - 30, nowMuted ? '🔇 已静音' : '🔊 音效开启', '#ccc', 1.2);
    e.preventDefault();
    return;
  }

  if (k === 'p' || k === 'escape') {
    const st = game.state;
    if (st.state === 'PLAYING') {
      st.state = 'PAUSED';
      e.preventDefault();
    } else if (st.state === 'PAUSED') {
      st.state = 'PLAYING';
      lastTime = performance.now();
      e.preventDefault();
    }
    return;
  }

  if (k === 'r') {
    const st = game.state;
    if (st.state === 'DEAD' || st.state === 'PLAYING' || st.state === 'PAUSED') {
      st.state = 'PLAYING';
      systems.resetGame(game);
      lastTime = performance.now();
      e.preventDefault();
    }
  }
});

// ==================== 页面可见性（替代 onShow/onHide） ====================
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    // 切到后台：暂停游戏
    if (game.state.state === 'PLAYING') {
      game.state.state = 'PAUSED';
    }
  } else {
    // 回到前台：重置时间戳防止 dt 跳变
    lastTime = performance.now();
  }
});

// ==================== 全局错误处理 ====================
window.addEventListener('error', function (ev) {
  console.error('[Game Error]', ev.error || ev.message);
});

window.addEventListener('unhandledrejection', function (ev) {
  console.error('[Game Promise Error]', ev.reason);
});

// ==================== 启动 ====================
setupScreen();
lastTime = performance.now();
requestAnimationFrame(gameLoop);
