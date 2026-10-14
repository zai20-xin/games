// ================================================================
// 波次配置 - 每关5波，公式驱动的关卡设计（支持1-17关）
// ================================================================
import { WAVE_CONFIG, LEVEL_CONFIG, DIFFICULTY_CURVE } from '../core/Constants.js';
import { ENEMY_BASE } from './EnemyTypes.js';
import { ALL_LEVELS } from './LevelConfig.js';

// === Agent A2 P5-1: 难度曲线参数从 Constants.DIFFICULTY_CURVE 读取 ===
// HP 增长基数（1.0 + DIFFICULTY_CURVE.HP_GROWTH）
// 速度增长基数（1.0 + DIFFICULTY_CURVE.SPEED_GROWTH）
const HP_GROWTH_BASE = 1 + DIFFICULTY_CURVE.HP_GROWTH;       // 1.12
const SPEED_GROWTH_BASE = 1 + DIFFICULTY_CURVE.SPEED_GROWTH; // 1.03

/**
 * 生成指定关卡的5波波次配置
 * @param {number} levelId - 关卡编号（1-17）
 * @param {string} difficulty - 难度: 'easy' | 'normal' | 'hard'
 * @returns {Array} 波次配置数组（5波）
 */
export function generateWaves(levelId, difficulty = 'normal') {
  const waves = [];

  // 难度系数映射
  const hpMultMap = { easy: 0.6, hard: 1.0, ultimate: 1.8 };
  let hpMult = hpMultMap[difficulty] || 1.0;

  // 获取关卡配置（用于特殊机制调整）
  const levelConfig = ALL_LEVELS.find(l => l.id === levelId);

  // 星座关卡(6-17)根据关卡难度标签叠加额外系数
  if (levelConfig && levelConfig.difficulty === 'ultimate') {
    hpMult *= 1.5; // 终极关卡额外×1.5
  } else if (levelConfig && levelConfig.difficulty === 'hard') {
    hpMult *= 1.2; // 困难关卡额外×1.2
  }

  // 关卡加成：关卡越高，基础难度越高
  const levelBonus = (levelId - 1) * 3;

  for (let w = 1; w <= LEVEL_CONFIG.WAVES_PER_LEVEL; w++) {
    const enemies = [];
    const waveNum = levelBonus + w; // 全局波次编号

    // === 每关5波的敌人设计 ===
    // 第1波：纯虫族（数量少）
    // 第2波：虫族+少量无人机
    // 第3波：虫族+无人机+少量机甲
    // 第4波：大量混合编队
    // 第5波：BOSS波

    // 虫族数量：基础 + 随波次增长
    const bugCount = Math.max(2, Math.floor(2 + waveNum * 0.6));

    // 无人机从第2波开始
    const droneCount = w >= 2 ? Math.max(0, Math.floor((waveNum - 1) * 0.5)) : 0;

    // 机甲从第3波开始
    const mechCount = w >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.4)) : 0;

    // BOSS波（第5波）
    const hasBoss = w === LEVEL_CONFIG.WAVES_PER_LEVEL;

    // 填充敌人列表
    for (let i = 0; i < bugCount; i++) enemies.push('bug');
    for (let i = 0; i < droneCount; i++) enemies.push('drone');
    for (let i = 0; i < mechCount; i++) enemies.push('mech');

    // 自爆虫从第2波开始
    const bomberCount = w >= 2 ? Math.max(0, Math.floor((waveNum - 1) * 0.3)) : 0;
    for (let i = 0; i < bomberCount; i++) enemies.push('bomber');

    // 治疗虫从第3波开始
    const healerCount = w >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.2)) : 0;
    for (let i = 0; i < healerCount; i++) enemies.push('healer');

    // 电磁坦克从第3波开始（少量）
    const tankCount = w >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.15)) : 0;
    for (let i = 0; i < tankCount; i++) enemies.push('tank');

    // 隐形刺客从第4波开始
    const stealthCount = w >= 4 ? Math.max(0, Math.floor((waveNum - 3) * 0.2)) : 0;
    for (let i = 0; i < stealthCount; i++) enemies.push('stealth');

    // 分裂虫从第4波开始
    const splitterCount = w >= 4 ? Math.max(0, Math.floor((waveNum - 3) * 0.25)) : 0;
    for (let i = 0; i < splitterCount; i++) enemies.push('splitter');

    // 食人魔从第3波开始（少量）
    const ogreCount = w >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.15)) : 0;
    for (let i = 0; i < ogreCount; i++) enemies.push('ogre');

    // 暗影刺客从第4波开始
    const assassinCount = w >= 4 ? Math.max(0, Math.floor((waveNum - 3) * 0.2)) : 0;
    for (let i = 0; i < assassinCount; i++) enemies.push('assassin');

    // 尖刺甲虫从第3波开始
    const beetleCount = w >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.18)) : 0;
    for (let i = 0; i < beetleCount; i++) enemies.push('beetle');

    // 冰霜魔像：第4波及以后有5%概率出现
    if (w >= 4 && Math.random() < 0.05) {
      enemies.push('ice_golem');
    }

    // 狼人狂战士：第3波及以后有8%概率出现
    if (w >= 3 && Math.random() < 0.08) {
      enemies.push('werewolf');
    }

    // 病毒国王：每关最后一波（第5波）必定出现1只
    if (w === LEVEL_CONFIG.WAVES_PER_LEVEL) {
      enemies.push('virusking');
    }

    if (hasBoss) {
      // BOSS波
      enemies.push('boss');
      // 高关卡BOSS波额外护卫
      if (levelId >= 3) {
        enemies.push('mech');
        enemies.push('mech');
      }
      if (levelId >= 5) {
        enemies.push('drone');
        enemies.push('drone');
        enemies.push('drone');
      }
      // 星座关卡额外护卫
      if (levelId >= 10) {
        enemies.push('mech');
        enemies.push('drone');
      }
      if (levelId >= 14) {
        enemies.push('mech');
        enemies.push('mech');
        enemies.push('drone');
        enemies.push('drone');
      }
      // 新敌人BOSS波护卫
      if (levelId >= 4) {
        enemies.push('bomber');
        enemies.push('bomber');
      }
      if (levelId >= 6) {
        enemies.push('healer');
        enemies.push('tank');
      }
      if (levelId >= 8) {
        enemies.push('stealth');
        enemies.push('splitter');
      }
    }

    // 生成间隔：随波次缩短，但有下限
    const spawnInterval = Math.max(WAVE_CONFIG.MIN_SPAWN_INTERVAL, 1.2 - waveNum * 0.03);

    // 预计算敌人属性（应用公式）
    const enemyStats = calculateWaveEnemyStats(waveNum, hpMult, levelConfig);

    waves.push({
      waveNum: w,
      enemies,
      spawnInterval,
      enemyStats
    });
  }

  return waves;
}

/**
 * 计算指定波次各类型敌人的实际属性
 * @param {number} waveNum - 全局波次编号
 * @param {number} hpMult - 难度血量系数
 * @param {Object|null} levelConfig - 关卡配置（用于特殊机制）
 * @returns {Object} 各类型敌人的实际属性
 */
export function calculateWaveEnemyStats(waveNum, hpMult, levelConfig = null) {
  const stats = {};
  for (const [type, base] of Object.entries(ENEMY_BASE)) {
    // === Agent A2 P5-1: HP/Speed 增长改用 DIFFICULTY_CURVE 参数化（从 Constants 读取）===
    let hp = Math.floor(base.hp * hpMult * Math.pow(HP_GROWTH_BASE, waveNum - 1));
    let speed = Math.min(base.speed * 2, base.speed * Math.pow(SPEED_GROWTH_BASE, waveNum - 1));
    let reward = base.reward + Math.floor((waveNum - 1) * 0.3);

    stats[type] = {
      ...base,
      hp,
      speed,
      reward
    };
  }
  return stats;
}

/**
 * 根据波次编号构建敌人列表（关卡模式与无尽模式共享）
 * @param {number} waveNum - 全局波次编号
 * @param {Object} [opts] - 选项
 * @param {number} [opts.levelId] - 关卡ID（关卡模式用于BOSS波护卫）
 * @param {boolean} [opts.isBossWave] - 是否为BOSS波
 * @param {boolean} [opts.isEndless] - 是否为无尽模式
 * @returns {Array<string>} 敌人类型ID数组
 */
export function buildEnemyListForWave(waveNum, opts = {}) {
  const { levelId = 1, isBossWave = false, isEndless = false } = opts;
  const enemies = [];

  // 基础虫族
  const bugCount = Math.max(2, Math.floor(2 + waveNum * 0.6));
  for (let i = 0; i < bugCount; i++) enemies.push('bug');

  // 无人机从第2波开始
  const droneCount = waveNum >= 2 ? Math.max(0, Math.floor((waveNum - 1) * 0.5)) : 0;
  for (let i = 0; i < droneCount; i++) enemies.push('drone');

  // 机甲从第3波开始
  const mechCount = waveNum >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.4)) : 0;
  for (let i = 0; i < mechCount; i++) enemies.push('mech');

  // 自爆虫从第2波开始
  const bomberCount = waveNum >= 2 ? Math.max(0, Math.floor((waveNum - 1) * 0.3)) : 0;
  for (let i = 0; i < bomberCount; i++) enemies.push('bomber');

  // 治疗虫从第3波开始
  const healerCount = waveNum >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.2)) : 0;
  for (let i = 0; i < healerCount; i++) enemies.push('healer');

  // 电磁坦克从第3波开始
  const tankCount = waveNum >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.15)) : 0;
  for (let i = 0; i < tankCount; i++) enemies.push('tank');

  // 隐形刺客从第4波开始
  const stealthCount = waveNum >= 4 ? Math.max(0, Math.floor((waveNum - 3) * 0.2)) : 0;
  for (let i = 0; i < stealthCount; i++) enemies.push('stealth');

  // 分裂虫从第4波开始
  const splitterCount = waveNum >= 4 ? Math.max(0, Math.floor((waveNum - 3) * 0.25)) : 0;
  for (let i = 0; i < splitterCount; i++) enemies.push('splitter');

  // 食人魔从第3波开始
  const ogreCount = waveNum >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.15)) : 0;
  for (let i = 0; i < ogreCount; i++) enemies.push('ogre');

  // 暗影刺客从第4波开始
  const assassinCount = waveNum >= 4 ? Math.max(0, Math.floor((waveNum - 3) * 0.2)) : 0;
  for (let i = 0; i < assassinCount; i++) enemies.push('assassin');

  // 尖刺甲虫从第3波开始
  const beetleCount = waveNum >= 3 ? Math.max(0, Math.floor((waveNum - 2) * 0.18)) : 0;
  for (let i = 0; i < beetleCount; i++) enemies.push('beetle');

  // 冰霜魔像：第4波及以后有5%概率出现
  if (waveNum >= 4 && Math.random() < 0.05) {
    enemies.push('ice_golem');
  }

  // 狼人狂战士：第3波及以后有8%概率出现
  if (waveNum >= 3 && Math.random() < 0.08) {
    enemies.push('werewolf');
  }

  // BOSS波处理
  if (isBossWave) {
    enemies.push('boss');
    // 关卡模式：根据关卡ID添加护卫
    if (!isEndless && levelId >= 3) {
      enemies.push('mech'); enemies.push('mech');
    }
    if (!isEndless && levelId >= 5) {
      enemies.push('drone'); enemies.push('drone'); enemies.push('drone');
    }
    if (!isEndless && levelId >= 10) {
      enemies.push('mech'); enemies.push('drone');
    }
    if (!isEndless && levelId >= 14) {
      enemies.push('mech'); enemies.push('mech');
      enemies.push('drone'); enemies.push('drone');
    }
    if (!isEndless && levelId >= 4) {
      enemies.push('bomber'); enemies.push('bomber');
    }
    if (!isEndless && levelId >= 6) {
      enemies.push('healer'); enemies.push('tank');
    }
    if (!isEndless && levelId >= 8) {
      enemies.push('stealth'); enemies.push('splitter');
    }
    // 无尽模式：BOSS护卫随波次增长
    if (isEndless) {
      const guardPairs = Math.floor(waveNum / 10);
      for (let i = 0; i < guardPairs; i++) {
        enemies.push('mech'); enemies.push('drone');
      }
    }
  }

  // 病毒国王：关卡模式最后一波必定出现；无尽模式第10波及以后每波出现
  if (!isEndless) {
    // 由调用方在 isBossWave 时添加
  } else if (waveNum >= 10) {
    enemies.push('virusking');
  }

  return enemies;
}

/**
 * 获取波次描述（用于波次预览）
 * @param {Object} wave - 波次配置
 * @returns {Array<{type: string, count: number, icon: string, name: string, color: string}>}
 */
export function getWavePreviewData(wave) {
  const counts = {};
  wave.enemies.forEach(e => {
    counts[e] = (counts[e] || 0) + 1;
  });
  return Object.entries(counts).map(([type, count]) => ({
    type,
    count,
    icon: ENEMY_BASE[type].icon,
    name: ENEMY_BASE[type].name,
    color: ENEMY_BASE[type].color
  }));
}
