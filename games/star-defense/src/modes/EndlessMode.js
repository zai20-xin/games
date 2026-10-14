// =================================
// EndlessMode (P4-4)
// =================================

/**
 * 无尽模式难度递增倍率（每 10 波 ×1.3）
 * @type {number}
 */
export const ENDLESS_DIFFICULTY_MULT = 1.3;

/**
 * 无尽模式 Boss 出现间隔（每 50 波一次）
 * @type {number}
 */
export const ENDLESS_BOSS_INTERVAL = 50;

/**
 * 无尽模式最高波次存档键
 * @type {string}
 */
export const ENDLESS_BEST_STORAGE_KEY = 'star-defense-endless-best';

/**
 * 无尽 Boss 类型池（从现有 5 种 Boss 中随机抽取）
 * @type {string[]}
 */
export const ENDLESS_BOSS_POOL = [
  'bug_boss',         // 母虫
  'mech_boss',        // 机甲巨兽
  'drone_boss',       // 无人机航母
  'virusking',        // 病毒国王
  'boss_brute',       // 巨型暴君
];

/**
 * 根据当前波次计算无尽模式难度倍率
 * 第 1~10 波：1.0；第 11~20 波：×1.3；第 21~30 波：×1.3^2；以此类推
 * @param {number} waveNum - 当前无尽模式波次（1-based）
 * @returns {number} 难度倍率
 */
export function getEndlessDifficultyMult(waveNum) {
  if (!Number.isFinite(waveNum) || waveNum <= 0) return 1;
  const tier = Math.floor((waveNum - 1) / 10);
  return Math.pow(ENDLESS_DIFFICULTY_MULT, tier);
}

/**
 * 判断当前波次是否为"无尽 Boss 波"（每 50 波一次）
 * @param {number} waveNum - 当前无尽模式波次（1-based）
 * @returns {boolean}
 */
export function isEndlessBossWave(waveNum) {
  return Number.isFinite(waveNum) && waveNum > 0 && waveNum % ENDLESS_BOSS_INTERVAL === 0;
}

/**
 * 获取当前无尽 Boss 类型（从 5 种 Boss 中随机）
 * @param {() => number} [rng=Math.random] - 可注入的随机数函数（便于测试）
 * @returns {string} Boss 类型 ID
 */
export function pickEndlessBossType(rng = Math.random) {
  const pool = ENDLESS_BOSS_POOL;
  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(Math.max(idx, 0), pool.length - 1)];
}

/**
 * 读取历史最高波数
 * @returns {number}
 */
export function getEndlessBestWave() {
  try {
    const raw = localStorage.getItem(ENDLESS_BEST_STORAGE_KEY);
    if (raw !== null && raw !== undefined) {
      const v = parseInt(raw, 10);
      if (Number.isFinite(v) && v > 0) {
        _endlessMemBest = Math.max(_endlessMemBest, v);
        return v;
      }
    }
  } catch (e) { /* localStorage unavailable */ }
  return _endlessMemBest;
}

/**
 * 记录最高波数（仅在新值大于历史最佳时更新）
 * @param {number} wave - 本次坚持到的波数
 * @returns {{ best: number, isNewRecord: boolean }}
 */
export function recordEndlessBest(wave) {
  const prev = getEndlessBestWave();
  const cur = Math.max(prev, Math.floor(wave || 0));
  if (cur > prev) {
    _endlessMemBest = cur;
    try {
      localStorage.setItem(ENDLESS_BEST_STORAGE_KEY, String(cur));
    } catch (e) { /* quota or privacy mode */ }
    return { best: cur, isNewRecord: cur > 0 };
  }
  return { best: prev, isNewRecord: false };
}

/**
 * 测试用：重置内存中的最佳波数缓存（不影响 localStorage）
 */
export function _resetEndlessMemBest() {
  _endlessMemBest = 0;
}

/** 内存中的最佳波数（localStorage 不可用时的 fallback） */
let _endlessMemBest = 0;

/**
 * 描述无尽模式当前波段的显示文案（用于 UI 难度提示）
 * @param {number} waveNum
 * @returns {string}
 */
export function describeEndlessTier(waveNum) {
  const tier = Math.floor(((waveNum || 1) - 1) / 10) + 1;
  return `第 ${tier} 段（${(tier - 1) * 10 + 1}-${tier * 10} 波）`;
}

/**
 * 无尽模式主类（轻量配置 + 状态）
 *
 * 复用 Game 的塔防核心玩法（与关卡模式共用一套 system），
 * 这里只负责无尽模式专属的状态、规则、统计与持久化。
 *
 * 使用方式：
 *   const endless = new EndlessMode({ game });
 *   endless.start();              // 启动并初始化
 *   endless.onWaveStart(n);       // 每波开始时调用（应用 ×1.3 难度）
 *   endless.recordFinal(wave);    // 死亡 / 退出时调用（写入最佳记录）
 */
export class EndlessMode {
  /**
   * @param {Object} [opts]
   * @param {Object} [opts.game] - 主 Game 实例（用于事件广播等，可选）
   * @param {number} [opts.startEnergy=80] - 无尽模式起始能量
   * @param {number} [opts.startHp=20] - 起始基地 HP
   * @param {string} [opts.mapLevelId=3] - 复用的关卡地图
   */
  constructor(opts = {}) {
    this.game = opts.game || null;
    this.startEnergy = opts.startEnergy || 80;
    this.startHp = opts.startHp || 20;
    this.mapLevelId = opts.mapLevelId || 3;

    /** 当前波数（1-based） */
    this.waveNum = 0;
    /** 是否激活 */
    this.active = false;
    /** 已触发过的 Boss 波集合（防止重复触发） */
    this._triggeredBossWaves = new Set();
    /** 本局累计击杀 */
    this.totalKills = 0;
    /** 本局历史最高难度倍率 */
    this.peakDifficultyMult = 1;
  }

  /** 启动无尽模式（不直接进入战斗，由调用方完成进入流程） */
  start() {
    this.active = true;
    this.waveNum = 0;
    this._triggeredBossWaves = new Set();
    this.totalKills = 0;
    this.peakDifficultyMult = 1;
  }

  /** 结束无尽模式并落盘最佳记录 */
  stop() {
    this.active = false;
    return recordEndlessBest(this.waveNum);
  }

  /**
   * 标记新一波开始，返回该波的配置覆盖
   * @param {number} waveNum - 新波次（1-based）
   * @returns {{
   *   difficultyMult: number,
   *   isBossWave: boolean,
   *   bossType: string|null,
   *   tierLabel: string,
   * }}
   */
  onWaveStart(waveNum) {
    this.waveNum = waveNum;
    const difficultyMult = getEndlessDifficultyMult(waveNum);
    this.peakDifficultyMult = Math.max(this.peakDifficultyMult, difficultyMult);

    let isBossWave = isEndlessBossWave(waveNum);
    let bossType = null;
    if (isBossWave && !this._triggeredBossWaves.has(waveNum)) {
      this._triggeredBossWaves.add(waveNum);
      bossType = pickEndlessBossType();
    }

    return {
      difficultyMult,
      isBossWave,
      bossType,
      tierLabel: describeEndlessTier(waveNum),
    };
  }

  /** 累计击杀 */
  recordKill(n = 1) {
    this.totalKills += n;
  }

  /** 便捷：返回当前最佳波数（从 localStorage 读） */
  getBestWave() {
    return getEndlessBestWave();
  }
}
