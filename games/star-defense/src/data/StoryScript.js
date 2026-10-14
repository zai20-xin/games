// ================================================================
// 剧情对话脚本 - 每个关卡的开场/结束剧情
// ================================================================

export const STORY = {
  1: {
    intro: [
      { speaker: '指挥中心', text: '指挥官，外星舰队从第七象限突破防线。' },
      { speaker: 'AI 艾娃', text: '已为你部署 9 座防御塔。守住基地！' },
    ],
    outro: '第一道防线守住。',
  },
  2: {
    intro: [
      { speaker: 'AI 艾娃', text: '敌人在山谷集结，预计 5 分钟内抵达。' },
      { speaker: '指挥中心', text: '在峡谷两侧部署火力，迟滞它们。' },
    ],
    outro: '峡谷通道已被我方控制。',
  },
  3: {
    intro: [
      { speaker: '侦察兵', text: '前方侦测到母舰螺旋阵，密集到无法绕行。' },
      { speaker: 'AI 艾娃', text: '敌人会绕圈，但每绕一圈就会变弱。' },
    ],
    outro: '母舰撤退，但留下了探测器。',
  },
  4: {
    intro: [
      { speaker: 'AI 艾娃', text: '警告：敌人分两路包抄，基地在中间。' },
      { speaker: '指挥中心', text: '必须同时防守两路，否则基地必失。' },
    ],
    outro: '双线夹击被成功化解。',
  },
  5: {
    intro: [
      { speaker: '指挥中心', text: '指挥官，这是最后一道防线。' },
      { speaker: 'AI 艾娃', text: '敌人倾巢而出，请部署所有火力。' },
      { speaker: '指挥中心', text: '为了人类文明的延续 —— 战斗！' },
    ],
    outro: '终极防线守住。人类……还有明天。',
  },
  // 12 星座关卡使用通用剧情
  6: {
    intro: [
      { speaker: 'AI 艾娃', text: '检测到白羊座能量波动。' },
      { speaker: '指挥中心', text: '敌人更加凶猛，但缺乏持久力。速战速决。' },
    ],
    outro: '白羊座能量已被中和。',
  },
  7: {
    intro: [
      { speaker: 'AI 艾娃', text: '金牛座空间站已沦陷。' },
      { speaker: '指挥中心', text: '敌人防御坚固，需要持续火力覆盖。' },
    ],
    outro: '金牛座前哨已被我军占领。',
  },
  8: {
    intro: [
      { speaker: 'AI 艾娃', text: '双子座：分形路径，敌人会突然变向。' },
      { speaker: '指挥中心', text: '部署覆盖范围更广的塔。' },
    ],
    outro: '双子迷宫被破解。',
  },
  9: {
    intro: [
      { speaker: 'AI 艾娃', text: '巨蟹座水域，敌人会自我修复。' },
      { speaker: '指挥中心', text: '单次高伤害比持续伤害更有效。' },
    ],
    outro: '巨蟹外壳被击碎。',
  },
  10: {
    intro: [
      { speaker: 'AI 艾娃', text: '狮子座王座：精英怪密集。' },
      { speaker: '指挥中心', text: '优先升级你的核心塔。' },
    ],
    outro: '狮子王冠被夺下。',
  },
  11: {
    intro: [
      { speaker: 'AI 艾娃', text: '处女座：完美主义者，敌人精准。' },
      { speaker: '指挥中心', text: '需要更精确的瞄准。' },
    ],
    outro: '处女座星门关闭。',
  },
  12: {
    intro: [
      { speaker: 'AI 艾娃', text: '天秤座：平衡被打破，敌人数量倍增。' },
      { speaker: '指挥中心', text: 'AOE 火力是唯一的答案。' },
    ],
    outro: '天秤倾覆，秩序恢复。',
  },
  13: {
    intro: [
      { speaker: 'AI 艾娃', text: '天蝎座：剧毒污染，敌人会施毒。' },
      { speaker: '指挥中心', text: '部署医疗塔保持持久作战。' },
    ],
    outro: '天蝎毒液被中和。',
  },
  14: {
    intro: [
      { speaker: 'AI 艾娃', text: '射手座：箭雨流星，敌人速度极快。' },
      { speaker: '指挥中心', text: '冻结与减速是你的朋友。' },
    ],
    outro: '射手之箭被折断。',
  },
  15: {
    intro: [
      { speaker: 'AI 艾娃', text: '摩羯座：时间扭曲，敌人时快时慢。' },
      { speaker: '指挥中心', text: '稳住节奏，不要被带乱。' },
    ],
    outro: '摩羯时间之塔被摧毁。',
  },
  16: {
    intro: [
      { speaker: 'AI 艾娃', text: '水瓶座：寒冰风暴，敌人冻结一切。' },
      { speaker: '指挥中心', text: '提高火系塔的比例。' },
    ],
    outro: '水瓶寒流被蒸发。',
  },
  17: {
    intro: [
      { speaker: 'AI 艾娃', text: '双鱼座：镜像空间，敌人分身上阵。' },
      { speaker: '指挥中心', text: '最后一战。指挥官，相信你的直觉。' },
    ],
    outro: '双鱼星海归于平静。人类文明，由你守护。',
  },
};

/**
 * 获取关卡剧情（找不到则返回 null）
 * @param {number} levelId
 * @returns {{intro: Array, outro: string} | null}
 */
export function getStory(levelId) {
  return STORY[levelId] || null;
}
