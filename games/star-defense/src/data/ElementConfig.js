// ================================================================
// 元素克制系统 - 四元素属性与克制关系
// ================================================================

/**
 * 四元素属性定义
 */
export const ELEMENTS = {
  fire: {
    name: '火',
    color: '#ff4422',
    bgTint: 'rgba(255,68,34,0.1)',
    towers: ['laser', 'missile']
  },
  earth: {
    name: '土',
    color: '#44aa44',
    bgTint: 'rgba(68,170,68,0.1)',
    towers: ['shield', 'collector', 'gravity', 'repair']
  },
  wind: {
    name: '风',
    color: '#aa88ff',
    bgTint: 'rgba(170,136,255,0.1)',
    towers: ['tesla', 'plasma']
  },
  water: {
    name: '水',
    color: '#4488cc',
    bgTint: 'rgba(68,136,204,0.1)',
    towers: ['cryo']
  }
};

/**
 * 元素克制关系（攻击方 → 防御方 = 效果倍率）
 * 火 > 土 > 风 > 水 > 火
 */
export const ELEMENT_ADVANTAGE = {
  fire:  { earth: 1.3, water: 0.7 },   // 火克土，被水克
  earth: { wind: 1.3,  fire: 0.7 },    // 土克风，被火克
  wind:  { water: 1.3, earth: 0.7 },   // 风克水，被土克
  water: { fire: 1.3,  wind: 0.7 }     // 水克火，被风克
};

/**
 * 每种塔的元素属性
 */
export const TOWER_ELEMENTS = {
  laser: 'fire',
  missile: 'fire',
  shield: 'earth',
  collector: 'earth',
  tesla: 'wind',
  cryo: 'water',
  plasma: 'wind',
  gravity: 'earth',
  repair: 'earth'
};

/**
 * 获取元素加成倍率
 * @param {string} towerType - 塔类型ID
 * @param {string} levelElement - 关卡元素属性
 * @returns {number} 伤害倍率（默认1.0）
 */
export function getElementBonus(towerType, levelElement) {
  if (!towerType || !levelElement) return 1.0;
  const towerElement = TOWER_ELEMENTS[towerType];
  if (!towerElement) return 1.0;
  const advantage = ELEMENT_ADVANTAGE[towerElement];
  if (advantage && advantage[levelElement]) {
    return advantage[levelElement];
  }
  return 1.0;
}

/**
 * 获取元素克制描述文字
 * @param {string} towerType - 塔类型ID
 * @param {string} levelElement - 关卡元素属性
 * @returns {string|null} 克制描述（null表示无克制）
 */
export function getElementBonusText(towerType, levelElement) {
  if (!towerType || !levelElement) return null;
  const bonus = getElementBonus(towerType, levelElement);
  const towerElement = TOWER_ELEMENTS[towerType];
  if (!towerElement) return null;

  if (bonus > 1.0) {
    return `${ELEMENTS[towerElement].name}克${ELEMENTS[levelElement].name} +${Math.round((bonus - 1) * 100)}%`;
  } else if (bonus < 1.0) {
    return `${ELEMENTS[towerElement].name}被${ELEMENTS[levelElement].name}克 -${Math.round((1 - bonus) * 100)}%`;
  }
  return null;
}
