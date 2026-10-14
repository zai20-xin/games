// ================================================================
// 每日关卡（Daily Seed 挑战）— P4-5
// 流程：
//   1) 用 dailySeed（YYYYMMDD）生成程序化地图（路径+波次）
//   2) 复用 Game 的 _enterLevel 流程，但传入自定义 map / waves
//   3) 通关后给"首通"奖励 50 星尘（每日一次）
//   4) 排行榜用 localStorage 模拟（按"通关时间"排名）
// 设计：薄包装层，配置生成后委托给 Game 处理战斗逻辑
// ================================================================
import { ENEMY_BASE } from '../data/EnemyTypes.js';

const FIRST_CLEAR_REWARD = 50;
const LEADERBOARD_KEY = 'star-defense-daily-leaderboard';
const FIRST_CLEAR_KEY = 'star-defense-daily-first-clear';

export function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function createRng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function generateDailyMap(seed) {
  const rand = createRng(seed);
  const rows = 9;
  const cols = 16;
  const style = Math.floor(rand() * 3);
  const path = [];
  path.push({ r: 0, c: cols - 1 });

  if (style === 0) {
    for (let c = cols - 2; c >= 8; c--) path.push({ r: 0, c });
    path.push({ r: 1, c: 8 });
    for (let c = 7; c >= 3; c--) path.push({ r: 1, c });
    path.push({ r: 2, c: 3 });
    for (let c = 4; c <= 11; c++) path.push({ r: 2, c });
    path.push({ r: 3, c: 11 });
    for (let c = 10; c >= 2; c--) path.push({ r: 3, c });
    path.push({ r: 4, c: 2 });
    for (let c = 3; c <= 13; c++) path.push({ r: 4, c });
    path.push({ r: 5, c: 13 });
    for (let c = 12; c >= 0; c--) path.push({ r: 5, c });
  } else if (style === 1) {
    for (let c = cols - 2; c >= 4; c--) path.push({ r: 0, c });
    path.push({ r: 1, c: 4 }, { r: 2, c: 4 }, { r: 3, c: 4 }, { r: 4, c: 4 });
    for (let c = 5; c <= 12; c++) path.push({ r: 4, c });
    for (let r = 5; r <= 7; r++) path.push({ r, c: 12 });
    for (let c = 11; c >= 0; c--) path.push({ r: 7, c });
  } else {
    for (let c = cols - 2; c >= 0; c--) path.push({ r: 0, c });
    path.push({ r: 1, c: 0 }, { r: 2, c: 0 });
    for (let c = 1; c <= cols - 1; c++) path.push({ r: 2, c });
    for (let r = 3; r <= 5; r++) path.push({ r, c: cols - 1 });
    for (let c = cols - 2; c >= 2; c--) path.push({ r: 5, c });
    path.push({ r: 6, c: 2 }, { r: 7, c: 2 }, { r: 8, c: 2 });
    for (let c = 1; c >= 0; c--) path.push({ r: 8, c });
  }

  const difficulty = ['easy', 'normal', 'hard'][Math.floor(rand() * 3)];
  const difficultyStars = difficulty === 'easy' ? 2 : difficulty === 'normal' ? 3 : 4;

  return {
    id: -1,
    name: `每日挑战 · ${seed}`,
    desc: `全球同种 · 今日 seed ${seed}`,
    cols,
    rows,
    cell: 56,
    path,
    difficulty,
    initEnergy: 50,
    initHP: 20,
    bgGradient: ['#1a0f1e', '#1f1228', '#180f1f'],
    starThresholds: [15, 10, 5],
    difficultyStars,
    _isDaily: true,
  };
}

export function generateDailyWaves(seed, hpMultFn) {
  const rand = createRng(seed + 1);
  const waves = [];
  for (let w = 1; w <= 5; w++) {
    const enemies = [];
    const baseCount = 3 + w * 2;
    for (let i = 0; i < baseCount; i++) {
      const r = rand();
      let pool;
      if (w < 5 || r > 0.92) {
        pool = ['bug', 'drone', 'mech', 'bomber', 'beetle'];
      } else {
        pool = ['bug', 'drone', 'mech', 'bomber', 'beetle', 'boss', 'virusking'];
      }
      enemies.push(pool[Math.floor(rand() * pool.length)]);
    }
    if (w === 5) enemies.push('boss');
    const spawnInterval = Math.max(0.4, 1.2 - w * 0.1);
    const hpMult = hpMultFn ? hpMultFn(w) : 1;
    const enemyStats = {};
    for (const [type, base] of Object.entries(ENEMY_BASE)) {
      enemyStats[type] = {
        ...base,
        hp: Math.floor(base.hp * hpMult * Math.pow(1.12, w - 1)),
        speed: Math.min(base.speed * 2, base.speed * (1 + 0.03 * (w - 1))),
        reward: base.reward + Math.floor((w - 1) * 0.3),
      };
    }
    waves.push({ waveNum: w, enemies, spawnInterval, enemyStats });
  }
  return waves;
}

export class DailySeedMode {
  constructor(game) {
    this.game = game;
    this.seed = getDailySeed();
    this.dailyMap = null;
    this.dailyWaves = null;
    this.startedAt = 0;
    this.completed = false;
  }

  start() {
    this.dailyMap = generateDailyMap(this.seed);
    this.dailyWaves = generateDailyWaves(this.seed, () => 1.0);
    this.startedAt = Date.now();
    this.completed = false;

    if (this.game && typeof this.game._loadLevel === 'function') {
      this.game._loadLevel(this.dailyMap);
    }
    if (this.game && typeof this.game.waveSystem?.setWaves === 'function') {
      this.game.waveSystem.setWaves(this.dailyWaves);
    }
    if (this.game) {
      this.game.isDailySeedMode = true;
      this.game.energy = this.dailyMap.initEnergy;
      this.game.hp = this.dailyMap.initHP;
      this.game.maxHp = this.dailyMap.initHP;
      this.game.kills = 0;
      this.game.currentWave = 0;
      this.game.waveActive = false;
      this.game.dailyChallengeRestriction = { type: 'daily_seed', seed: this.seed };
    }
  }

  markCompleted() {
    if (this.completed) return { firstClear: false, reward: 0, elapsedMs: 0 };
    this.completed = true;
    const elapsedMs = Date.now() - this.startedAt;

    const firstClear = this._isFirstClearToday();
    let reward = 0;
    if (firstClear) {
      reward = FIRST_CLEAR_REWARD;
      this._setFirstClearToday();
      if (this.game?.meta?.addStardust) {
        this.game.meta.addStardust(reward);
      }
    }

    this._recordLeaderboard(elapsedMs);

    return { firstClear, reward, elapsedMs };
  }

  _isFirstClearToday() {
    try {
      const data = JSON.parse(localStorage.getItem(FIRST_CLEAR_KEY) || '{}');
      return data[this.seed] !== true;
    } catch {
      return true;
    }
  }

  _setFirstClearToday() {
    try {
      const data = JSON.parse(localStorage.getItem(FIRST_CLEAR_KEY) || '{}');
      data[this.seed] = true;
      localStorage.setItem(FIRST_CLEAR_KEY, JSON.stringify(data));
    } catch {
      // 忽略
    }
  }

  _recordLeaderboard(elapsedMs) {
    try {
      const board = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '{}');
      const prev = board[this.seed];
      if (!prev || elapsedMs < prev) {
        board[this.seed] = elapsedMs;
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
      }
    } catch {
      // 忽略
    }
  }

  getLeaderboard() {
    try {
      const board = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '{}');
      return board[this.seed] || null;
    } catch {
      return null;
    }
  }
}
