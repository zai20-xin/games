// ================================================================
// 波次间"事件"系统（P2-7）
// 6 个事件，每波结束 30% 概率触发
// 每个事件有 accept/decline 两个分支；事件 effect 由调用方注入到 game
// ================================================================

/**
 * 事件配置
 * id:          唯一标识
 * name:        中文名
 * desc:        描述（接受时生效）
 * declineDesc: 拒绝时的可选备注（一般 = "无")
 * weight:      随机权重（默认 1，等概率）
 * icon:        emoji 图标
 * type:        'positive' | 'negative' | 'neutral'
 * effect:      接受时生效的 effect 字段（注入到 game.activeWaveEvent）
 *   scope:    'permanent'（剩余局内永久生效）| 'next_wave'（仅下一波）
 */
export const WAVE_EVENTS = {
  merchant: {
    id: 'merchant',
    name: '神秘商人',
    desc: '全塔半价出售一次（剩余局内生效）',
    declineDesc: '放弃折扣',
    weight: 1,
    icon: '🛒',
    type: 'positive',
    effect: {
      scope: 'permanent',
      towerCostMult: 0.5,
    },
  },
  energy_rain: {
    id: 'energy_rain',
    name: '能量宝雨',
    desc: '立即获得 50 能量',
    declineDesc: '放弃能量',
    weight: 1,
    icon: '💎',
    type: 'positive',
    effect: {
      scope: 'instant',
      energyBonus: 50,
    },
  },
  ambush: {
    id: 'ambush',
    name: '敌人伏击',
    desc: '下一波敌人提前 5s 出现且 HP+50%',
    declineDesc: '正面迎战',
    weight: 1,
    icon: '⚠️',
    type: 'negative',
    effect: {
      scope: 'next_wave',
      enemyHpMult: 1.5,
      enemySpawnTimeShift: -5, // 负数 = 提前
    },
  },
  blessing: {
    id: 'blessing',
    name: '星辉祝福',
    desc: '下一波所有塔伤害+30%',
    declineDesc: '放弃祝福',
    weight: 1,
    icon: '✨',
    type: 'positive',
    effect: {
      scope: 'next_wave',
      dmgMult: 1.3,
    },
  },
  scout: {
    id: 'scout',
    name: '斥候情报',
    desc: '显示下一波敌人组成（reward 额外 +10 能量）',
    declineDesc: '不看了',
    weight: 1,
    icon: '👁️',
    type: 'neutral',
    effect: {
      scope: 'instant',
      energyBonus: 10,
      revealNextWave: true,
    },
  },
  scavenger: {
    id: 'scavenger',
    name: '清道夫',
    desc: '下一波击杀额外掉落 1 个能量宝珠',
    declineDesc: '不要了',
    weight: 1,
    icon: '🧲',
    type: 'positive',
    effect: {
      scope: 'next_wave',
      extraOrbPerKill: 1,
    },
  },
};

/**
 * 事件 ID 列表
 */
export const WAVE_EVENT_IDS = Object.keys(WAVE_EVENTS);

/**
 * 基于权重抽取一个事件
 * @param {Function} rng 0~1 的随机数函数（可注入种子 LCG）
 * @returns {string|null} 事件 id，没抽到返回 null
 */
export function pickRandomEvent(rng = Math.random) {
  let total = 0;
  for (const e of Object.values(WAVE_EVENTS)) {
    total += e.weight || 1;
  }
  let r = rng() * total;
  for (const e of Object.values(WAVE_EVENTS)) {
    r -= e.weight || 1;
    if (r <= 0) return e.id;
  }
  return WAVE_EVENT_IDS[0];
}

/**
 * 获取事件完整配置
 * @param {string} id
 * @returns {Object|null}
 */
export function getWaveEvent(id) {
  return WAVE_EVENTS[id] || null;
}
