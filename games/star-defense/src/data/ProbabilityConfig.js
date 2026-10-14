// ================================================================
// 概率公示配置（Phase 5 #7 - 国内合规要求）
//
// 用途：所有"随机奖励"必须事先公开概率。本配置覆盖 3 大类物品 × 3 档。
// 重要约束：每个类目的 tiers 权重之和必须等于 100（由 validateProbabilities 校验）。
//
// 概率分类说明：
//   - towerRefresh: 通关后/选卡前随机塔刷新（仅 9 基础塔 + 觉醒加成，无"传说"）
//   - chestDrop:    通关宝箱（5/4/3 档奖励）
//   - dailyReward:  每日挑战奖励池（首通 / 高分 / 参与）
// ================================================================

/**
 * @typedef {Object} ProbabilityTier
 * @property {string} label    - 稀有度名（传说 / 史诗 / 普通）
 * @property {number} weight   - 权重百分比（所有 tier 之和 = 100）
 * @property {string} color    - 颜色（用于 UI 标识）
 * @property {string} example  - 实际奖励示例说明
 *
 * @typedef {Object} ProbabilityCategory
 * @property {string} title    - 类目标题
 * @property {string} icon     - emoji 图标
 * @property {string} desc     - 类目描述
 * @property {ProbabilityTier[]} tiers - 3 档稀有度（从高到低）
 */

/** @type {Record<string, ProbabilityCategory>} */
export const PROBABILITY = {
  // ─────────────────────────────────────────────
  // 1) 随机塔刷新：每场战斗前 / 选卡界面刷新时使用
  // ─────────────────────────────────────────────
  towerRefresh: {
    title: '随机塔刷新',
    icon: '🎰',
    desc: '每场战斗前随机抽取起始塔池时使用，觉醒 4-5 阶后刷新概率会上调。',
    tiers: [
      {
        label: '传说塔',
        weight: 5,
        color: '#ff5577',
        example: '觉醒至 4-5 阶的塔（需先解锁觉醒）',
      },
      {
        label: '史诗塔',
        weight: 15,
        color: '#cc44ff',
        example: '基础 9 塔中的高级类型（导弹/引力/特斯拉）',
      },
      {
        label: '普通塔',
        weight: 80,
        color: '#44ddff',
        example: '基础 9 种塔（激光/电浆/护盾/采集/修复/冰冻等）',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2) 通关宝箱：每关胜利后开启的随机奖励
  // ─────────────────────────────────────────────
  chestDrop: {
    title: '通关宝箱',
    icon: '🎁',
    desc: '胜利后开启的随机奖励（与"幸运值"科技挂钩，可上浮传说概率）。',
    tiers: [
      {
        label: '传说级',
        weight: 10,
        color: '#ff5577',
        example: '5 星奖励：80 星尘结晶 或 限定星际涂装',
      },
      {
        label: '史诗级',
        weight: 30,
        color: '#cc44ff',
        example: '4 星奖励：40 星尘 或 下局起始能量+30',
      },
      {
        label: '普通级',
        weight: 60,
        color: '#44ddff',
        example: '3 星奖励：15 星尘 或 基地生命上限+1',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3) 每日挑战奖励：每日种子挑战通关后固定奖励池
  // ─────────────────────────────────────────────
  dailyReward: {
    title: '每日挑战奖励',
    icon: '📅',
    desc: '每日种子挑战通关后的固定奖励池（按当日表现分档）。',
    tiers: [
      {
        label: '首通大奖',
        weight: 5,
        color: '#ff5577',
        example: '100 星尘结晶 + 限定"指挥官"称号',
      },
      {
        label: '高分奖励',
        weight: 25,
        color: '#cc44ff',
        example: '50 星尘结晶（剩余 HP >= 10 时获得）',
      },
      {
        label: '参与奖励',
        weight: 70,
        color: '#44ddff',
        example: '20 星尘结晶（通关即得）',
      },
    ],
  },
};

/**
 * 校验所有类目的 tier 权重之和是否严格等于 100。
 * 部署前调用；抛出则说明配置错误（合规风险）。
 * @returns {boolean} 校验通过
 * @throws {Error} 权重和不等于 100 时
 */
export function validateProbabilities() {
  for (const [key, cat] of Object.entries(PROBABILITY)) {
    const total = cat.tiers.reduce((sum, t) => sum + t.weight, 0);
    if (total !== 100) {
      throw new Error(
        `[ProbabilityConfig] "${key}" 权重总和不等于 100（实际 ${total}）`
      );
    }
    if (cat.tiers.length !== 3) {
      throw new Error(
        `[ProbabilityConfig] "${key}" 必须恰好 3 档（实际 ${cat.tiers.length}）`
      );
    }
  }
  return true;
}

/**
 * 工具函数：根据类目 key 和权重数组抽取 1 个 tier（用于其他模块调用验证）。
 * @param {string} key
 * @returns {ProbabilityTier}
 */
export function getRandomTier(key) {
  const cat = PROBABILITY[key];
  if (!cat) throw new Error(`[ProbabilityConfig] 未知类目: ${key}`);
  const roll = Math.random() * 100;
  let acc = 0;
  for (const tier of cat.tiers) {
    acc += tier.weight;
    if (roll < acc) return tier;
  }
  return cat.tiers[cat.tiers.length - 1];
}
