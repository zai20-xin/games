// ================================================================
// 组合效果配置 - 不同类型塔相邻放置时产生特殊效果
// ================================================================

/**
 * 组合效果定义
 * key格式: '塔类型A+塔类型B'（按字母排序，无方向性）
 * name: 组合名称
 * desc: 组合描述
 * effect: 效果标识
 * color: 组合连接线颜色
 */
export const SYNERGIES = {
  'laser+tesla':    { name: '电磁激光', desc: '激光附带电击，命中敌人减速30%持续1秒', effect: 'slow_on_hit', color: '#6644ff' },
  'laser+cryo':     { name: '冰冻射线', desc: '激光伤害+20%，命中敌人冻结0.5秒', effect: 'freeze_boost', color: '#ff44aa' },
  'laser+missile':  { name: '制导激光', desc: '激光射程+1格', effect: 'range_boost', color: '#ff6644' },
  'tesla+missile':  { name: '电磁导弹', desc: '导弹爆炸范围+30%', effect: 'aoe_boost', color: '#ffbb77' },
  'tesla+cryo':     { name: '超导冷冻', desc: '电磁塔攻击速度+20%', effect: 'speed_boost', color: '#99ccbb' },
  'cryo+missile':   { name: '冰爆弹', desc: '导弹命中敌人冻结1秒', effect: 'freeze_missile', color: '#aaddbb' },
  'shield+laser':   { name: '能量护盾', desc: '护盾范围内塔伤害+10%', effect: 'shield_damage', color: '#44ff88' },
  'shield+tesla':   { name: '电磁护盾', desc: '护盾范围内塔伤害+25%', effect: 'shield_damage', color: '#bbcc66' },
  'shield+missile': { name: '护盾导弹', desc: '护盾范围内导弹射程+0.5格', effect: 'shield_range', color: '#ccbb66' },
  'shield+cryo':    { name: '冰霜护盾', desc: '护盾范围内敌人减速20%', effect: 'shield_slow', color: '#44ddaa' },
  'shield+collector': { name: '能量壁垒', desc: '护盾范围内采集器产出+30%', effect: 'energy_boost', color: '#aaff44' },
  'collector+laser': { name: '能量聚焦', desc: '采集器产出+50%', effect: 'energy_boost', color: '#ffdd44' },
  'collector+tesla': { name: '能量充能', desc: '电磁塔伤害+20%', effect: 'damage_boost', color: '#ffcc88' },
  'collector+cryo':  { name: '冰能采集', desc: '采集器产出+30%，附近敌人减速15%', effect: 'collector_slow', color: '#aaccbb' },
  'collector+missile': { name: '弹药补给', desc: '导弹塔攻击速度+15%', effect: 'missile_speed', color: '#ffaa44' },
  'plasma+tesla':     { name: '电磁等离子', desc: '等离子伤害+25%', effect: 'damage_boost', color: '#cc44ff' },
  'plasma+gravity':   { name: '重力等离子', desc: '重力场减速效果+15%', effect: 'shield_slow', color: '#ff44aa' },
  'gravity+shield':   { name: '重力护盾', desc: '护盾范围内减速效果翻倍', effect: 'shield_slow', color: '#aa44ff' },
  'repair+shield':    { name: '修复护盾', desc: '修复站恢复速度+50%', effect: 'energy_boost', color: '#99cc88' },
  'plasma+missile':   { name: '等离子导弹', desc: '导弹伤害+15%', effect: 'damage_boost', color: '#ff88ff' },
  'gravity+cryo':     { name: '冰冻重力', desc: '重力场内敌人冻结时间+0.5秒', effect: 'freeze_missile', color: '#ccaa88' },
};

/**
 * 三塔组合效果（任务 P2-2 扩展）
 * key格式: '塔A+塔B+塔C'（按字母排序，保证无方向性）
 * 检测规则: 在 1 格半径（Chebyshev 距离 ≤ 1）内同时存在这 3 种塔，且每种至少 1 座
 * name: 组合名称
 * desc: 组合描述（5~40 字）
 * color: 组合连接线颜色
 * effect: 效果标识
 */
export const TRIPLE_SYNERGIES = {
  'cryo+laser+tesla':       { name: '量子冻结',   desc: '三塔范围敌人攻速-50%',          effect: 'quantum_freeze',  color: '#aaddff' },
  'missile+plasma+gravity': { name: '轨道轰炸',   desc: '三塔全屏溅射100伤害，每10秒一次', effect: 'orbital_strike', color: '#ff8866' },
  'shield+repair+collector':{ name: '堡垒协议',   desc: '修复+50%，免费部署+2',           effect: 'fortress_protocol',color: '#88ffaa' },
  'cryo+gravity+tesla':     { name: '极寒漩涡',   desc: '冻结后被引力拉扯，碎冰额外伤害',  effect: 'frost_vortex',    color: '#88aaff' },
};

/**
 * 小队羁绊奖励（同种塔 ≥3 座上下左右相邻成片时触发）
 * count3: 3 座相邻 → 小队默契
 * count4: 4 座相邻 → 战术阵列
 * count5+: 5 座及以上相邻 → 王牌战队
 * mult: 触发塔伤害倍率（叠加上限取最高档）
 */
export const SQUAD_BONUS = {
  count3: { name: '小队默契', mult: 1.10 },
  count4: { name: '战术阵列', mult: 1.25 },
  count5: { name: '王牌战队', mult: 1.50 },
};

/**
 * 获取两个塔类型的组合key（按字母排序保证无方向性）
 * @param {string} typeA - 塔类型A的id
 * @param {string} typeB - 塔类型B的id
 * @returns {string} 组合key
 */
export function getSynergyKey(typeA, typeB) {
  if (typeA === typeB) return null;
  const sorted = [typeA, typeB].sort();
  return sorted[0] + '+' + sorted[1];
}

/**
 * 获取三塔组合的规范化 key（按字母排序后拼接）
 * @param {string} a
 * @param {string} b
 * @param {string} c
 * @returns {string|null} 排序后的 key；若包含重复塔种则返回 null
 */
export function getTripleSynergyKey(a, b, c) {
  if (!a || !b || !c) return null;
  const sorted = [a, b, c].sort();
  if (new Set(sorted).size !== 3) return null;
  return sorted.join('+');
}

/**
 * 根据小队同种塔相邻数量，返回对应的奖励配置
 * @param {number} count - 同种塔相邻成片的最大簇大小
 * @returns {{name: string, mult: number}|null}
 */
export function getSquadBonus(count) {
  if (count >= 5) return SQUAD_BONUS.count5;
  if (count === 4) return SQUAD_BONUS.count4;
  if (count >= 3) return SQUAD_BONUS.count3;
  return null;
}

/**
 * 获取两个塔类型的组合效果
 * @param {string} typeA - 塔类型A的id
 * @param {string} typeB - 塔类型B的id
 * @returns {Object|null} 组合效果配置
 */
export function getSynergy(typeA, typeB) {
  const key = getSynergyKey(typeA, typeB);
  if (!key) return null;
  return SYNERGIES[key] || null;
}
