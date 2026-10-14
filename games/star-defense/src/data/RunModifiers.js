// ================================================================
// Roguelike 局内词条 - 每日挑战升级版（P2-3）
// 设计目标：每天 seed 选 3 个 modifier 供玩家选 1
// 字段说明：
//   id          唯一标识
//   name        中文名
//   desc        描述
//   effect      数值效果（dmgMult、hpMult、fireRateMult、initEnergyMult、regenMult、initHpMult、
//               enemySpeedMult、chainExtra、rewardMult、lifesteal、freezeChance）
//   icon        emoji 图标
//   rarity      'common' | 'rare' | 'epic'
//   tags        用于事件触发识别
// ================================================================

export const MODIFIERS = [
  {
    id: 'glass_cannon',
    name: '玻璃大炮',
    desc: '塔伤害+50%，基地HP-30%',
    effect: { dmgMult: 1.5, hpMult: 0.7 },
    icon: '💥',
    rarity: 'rare',
    tags: ['attack', 'risk'],
  },
  {
    id: 'rich_start',
    name: '富饶开局',
    desc: '起始能量×2，能量恢复+50%',
    effect: { initEnergyMult: 2, regenMult: 0.67 },
    icon: '💰',
    rarity: 'common',
    tags: ['economy'],
  },
  {
    id: 'iron_wall',
    name: '钢铁壁垒',
    desc: '基地HP+50%，敌人速度-20%',
    effect: { initHpMult: 1.5, enemySpeedMult: 0.8 },
    icon: '🛡️',
    rarity: 'common',
    tags: ['defense'],
  },
  {
    id: 'rapid_fire',
    name: '急速火力',
    desc: '塔攻速+30%，敌人HP+20%',
    effect: { fireRateMult: 0.77, hpMult: 1.2 },
    icon: '⚡',
    rarity: 'rare',
    tags: ['attack', 'risk'],
  },
  {
    id: 'chain_react',
    name: '连锁反应',
    desc: '电磁塔跳跃+2',
    effect: { chainExtra: 2 },
    icon: '🔗',
    rarity: 'rare',
    tags: ['attack', 'tesla'],
  },
  {
    id: 'golden_age',
    name: '黄金时代',
    desc: '击杀奖励×2',
    effect: { rewardMult: 2 },
    icon: '✨',
    rarity: 'common',
    tags: ['economy'],
  },
  {
    id: 'blood_moon',
    name: '血月',
    desc: '敌人移速+30%，击杀回 5HP',
    effect: { enemySpeedMult: 1.3, lifesteal: 5 },
    icon: '🌙',
    rarity: 'epic',
    tags: ['risk', 'attack'],
  },
  {
    id: 'frostbite',
    name: '霜冻蔓延',
    desc: '所有塔 20% 概率冻结敌人',
    effect: { freezeChance: 0.2 },
    icon: '❄️',
    rarity: 'epic',
    tags: ['control'],
  },
];

/**
 * 通过 ID 查找 modifier 配置
 * @param {string} id
 * @returns {Object|null}
 */
export function getModifier(id) {
  return MODIFIERS.find(m => m.id === id) || null;
}

/**
 * 把 modifier 的 effect 应用到数值对象上，返回叠加后的结果
 * 注：原对象不会被修改，浅拷贝后修改
 * @param {Object} base 基础数值 { dmgMult, fireRateMult, ... }
 * @param {Object} effect modifier.effect
 * @returns {Object} 合并后的数值
 */
export function applyModifierEffect(base, effect) {
  const out = { ...base };
  for (const [k, v] of Object.entries(effect || {})) {
    if (k === 'initEnergyMult' || k === 'initHpMult' || k === 'dmgMult') {
      // 乘算类
      out[k] = (out[k] === undefined ? 1 : out[k]) * v;
    } else if (k === 'fireRateMult' || k === 'regenMult' || k === 'enemySpeedMult') {
      // 越小越好的乘算类（fireRate/regen/speed 倍率）
      out[k] = (out[k] === undefined ? 1 : out[k]) * v;
    } else if (k === 'rewardMult' || k === 'hpMult') {
      // 乘算类
      out[k] = (out[k] === undefined ? 1 : out[k]) * v;
    } else {
      // 加算类：chainExtra、lifesteal、freezeChance
      out[k] = (out[k] || 0) + v;
    }
  }
  return out;
}

/**
 * 基于种子从 MODIFIERS 中随机抽取 n 个（不重复）
 * @param {number} seed
 * @param {number} n
 * @returns {Array}
 */
export function pickRandomModifiers(seed, n = 3) {
  const list = [...MODIFIERS];
  // Fisher-Yates 洗牌（基于种子的简易 LCG）
  let s = (seed | 0) || 1;
  const next = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, n);
}
