// ================================================================
// 胜利评语配置 — 通关后根据表现匹配一条评语
// ================================================================

/**
 * 6 条评语配置
 * id:        评语唯一 ID
 * text:      评语文案
 * icon:      评语图标
 * predicate: (data, ctx) => boolean 匹配判定函数
 *   - data: showVictory 传入的 data
 *   - ctx:  运行时上下文（maxHp / starCount / levelId / difficulty / elapsed）
 */
export const VICTORY_FLAVOR = {
  perfectHp: {
    id: 'perfectHp',
    text: '完美防御！基地未受一点伤害。',
    icon: '🛡️',
    predicate: (data, ctx) => ctx.maxHp > 0 && ctx.remainingHp === ctx.maxHp,
  },
  fullStars: {
    id: 'fullStars',
    text: '三星通关，传奇指挥官！',
    icon: '👑',
    predicate: (data, ctx) => ctx.starCount === 3,
  },
  lowHp: {
    id: 'lowHp',
    text: '惨胜……下次要更稳。',
    icon: '😅',
    predicate: (data, ctx) => ctx.maxHp > 0 && ctx.remainingHp > 0 && ctx.remainingHp <= Math.max(1, Math.floor(ctx.maxHp * 0.15)),
  },
  speedClear: {
    id: 'speedClear',
    text: '闪电战！90s 内结束。',
    icon: '⚡',
    predicate: (data, ctx) => ctx.elapsed > 0 && ctx.elapsed <= 90,
  },
  firstClear: {
    id: 'firstClear',
    text: '首次通关，载入史册。',
    icon: '🏆',
    predicate: (data, ctx) => ctx.isFirstClear === true,
  },
  noMissile: {
    id: 'noMissile',
    text: '无伤通关，技术流。',
    icon: '🎯',
    /**
     * 注：data 中需要 `usedTowerTypes` 数组（string[]），且 'missile' 不在列表内
     * 且本局未受过伤害（remainingHp == maxHp）。如果 data 没传 usedTowerTypes，
     * 默认不命中（避免误报）。
     */
    predicate: (data, ctx) => {
      if (!Array.isArray(data.usedTowerTypes)) return false;
      if (data.usedTowerTypes.includes('missile')) return false;
      return ctx.maxHp > 0 && ctx.remainingHp === ctx.maxHp;
    },
  },
};

/**
 * 评语匹配优先级（按数组顺序匹配，第一个命中的胜出）
 * "完美"类评语优先，其次"水平"类，最后"戏剧"类
 */
const PRIORITY = ['perfectHp', 'fullStars', 'speedClear', 'firstClear', 'noMissile', 'lowHp'];

/**
 * 根据本局数据匹配最合适的一条评语
 * @param {Object} data showVictory 传入的 data
 * @param {Object} ctx  运行时上下文
 * @returns {{id:string,text:string,icon:string}} 评语对象（始终返回一条）
 */
export function matchVictoryFlavor(data = {}, ctx = {}) {
  for (const id of PRIORITY) {
    const flavor = VICTORY_FLAVOR[id];
    if (!flavor) continue;
    try {
      if (flavor.predicate(data, ctx)) {
        return flavor;
      }
    } catch (e) {
      // predicate 抛错时跳过，避免阻塞 UI
      continue;
    }
  }
  // 兜底：返回 PRIORITY 第一项文案
  return VICTORY_FLAVOR[PRIORITY[0]];
}
