// ================================================================
// 失败/重试 续命配置（P2-12）
// 提供给 BattleMode 在玩家失败时弹"续命（200 星尘）/ 放弃"两按钮
// 续命后按 ReviveConfig 恢复状态：保留部分塔、部分能量、部分 HP
// ================================================================

export const REVIVE_CONFIG = {
  /** 续命一次消耗的星尘结晶 */
  stardustCost: 200,
  /** 单关最多续命次数（防刷） */
  maxRevivesPerLevel: 2,
  /** 重试时是否保留已放置的塔 */
  retainTowers: true,
  /** 保留多少比例的能量（0~1） */
  retainMoneyPercent: 0.5,
  /** 保留多少比例的基地 HP（0~1） */
  retainHpPercent: 0.3,
  /** 是否从失败那波开始（true）还是从第 1 波重新开始（false） */
  retainWave: true,
};

/**
 * 续命后的状态计算工具
 * @param {Object} snapshot 失败时的状态 { energy, hp, maxHp, wave, towers }
 * @param {number} usedRevives 本关已续命次数
 * @returns {{success: boolean, reason?: string, retain?: {energy, hp, wave, towers}}}
 */
export function computeReviveRetain(snapshot, usedRevives = 0) {
  if (usedRevives >= REVIVE_CONFIG.maxRevivesPerLevel) {
    return { success: false, reason: 'max_revives' };
  }
  const energy = Math.max(0, Math.floor((snapshot.energy || 0) * REVIVE_CONFIG.retainMoneyPercent));
  const hp = Math.max(1, Math.ceil((snapshot.hp || 0) * REVIVE_CONFIG.retainHpPercent));
  const wave = REVIVE_CONFIG.retainWave ? (snapshot.wave || 0) : 0;
  const towers = REVIVE_CONFIG.retainTowers ? (snapshot.towers || []) : [];
  return {
    success: true,
    retain: { energy, hp, wave, towers },
    usedRevives: usedRevives + 1,
  };
}

/**
 * 判断当前是否还能续命（星尘够 + 次数未满）
 * @param {Object} profile 玩家档案，需有 stardust 字段（或 spendStardust 方法）
 * @param {number} usedRevives 本关已续命次数
 * @returns {boolean}
 */
export function canRevive(profile, usedRevives = 0) {
  if (usedRevives >= REVIVE_CONFIG.maxRevivesPerLevel) return false;
  if (!profile) return false;
  // 优先读 stardust 字段（部分 profile 把 stardust 包在 getStardust() 中）
  const stardust = typeof profile.getStardust === 'function'
    ? profile.getStardust()
    : (profile.stardust || 0);
  return stardust >= REVIVE_CONFIG.stardustCost;
}
