// ================================================================
// 塔的"角色档案" - 每个塔的背景故事
// ================================================================

export const TOWER_LORE = {
  laser: {
    name: '星耀法师',
    title: '维度行者',
    story: '来自平行宇宙 X-42 的法师，擅长大范围元素魔法。',
    quote: '"维度之门，为你而开。"',
    color: '#aa66ff',
  },
  tesla: {
    name: '雷神',
    title: '风暴之主',
    story: '阿斯加德最后一位雷神，挥舞雷神之锤掌控雷电。',
    quote: '"风暴，听我号令！"',
    color: '#ffdd55',
  },
  missile: {
    name: '钢铁侠',
    title: '亿万科技',
    story: '军火商人改邪归正，以方舟反应堆驱动钢铁战衣。',
    quote: '"我即是钢铁。"',
    color: '#ff6644',
  },
  cryo: {
    name: '冰雪女王',
    title: '冬之低语',
    story: '北境的冰与雪之女王，能瞬间冰封一切敌人。',
    quote: '"寒冰加冕。"',
    color: '#74b9ff',
  },
  gravity: {
    name: '绿巨人',
    title: '愤怒之拳',
    story: '被伽马射线辐射的科学家，越愤怒越强大。',
    quote: '"HULK SMASH!"',
    color: '#27ae60',
  },
  shield: {
    name: '美国队长',
    title: '自由先锋',
    story: '超级士兵血清强化后的战士，振金盾牌坚不可摧。',
    quote: '"我可以这样打一整天。"',
    color: '#3a68aa',
  },
  collector: {
    name: '黑豹',
    title: '瓦坎达之心',
    story: '瓦坎达国王，振金科技与古老仪式的结合。',
    quote: '"瓦坎达万岁。"',
    color: '#6a288a',
  },
  plasma: {
    name: '惊奇队长',
    title: '双星之力',
    story: '被克里族能量灌注的飞行员，光子冲击波横扫一切。',
    quote: '"我无需向你证明任何事。"',
    color: '#ff2244',
  },
  repair: {
    name: '蜘蛛侠',
    title: '友好邻居',
    story: '被变异蜘蛛咬伤的少年，蛛丝黏弹与超级感官。',
    quote: '"能力越大，责任越大。"',
    color: '#cc2233',
  },
};

/**
 * 获取塔的角色档案
 * @param {string} towerId
 * @returns {object|null}
 */
export function getTowerLore(towerId) {
  return TOWER_LORE[towerId] || null;
}
