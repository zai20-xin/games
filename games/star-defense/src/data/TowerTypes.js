// ================================================================
// 塔类型定义 - 11种防御塔（9 原始 + 2 新增召唤/诅咒）
// 包含：awakening（P2-1）、specializations（P2-8，原 upgradeBranches 升级版）
//       skin（P4-8 默认皮肤标识）
// ================================================================

/**
 * 塔类型数据
 * id: 唯一标识
 * name: 显示名称
 * cost: 基础费用
 * damage: 基础伤害
 * range: 基础射程（格子数）
 * fireRate: 基础攻击间隔（秒）
 * color: 主颜色
 * glowColor: 发光颜色
 * type: 'attack' | 'support'
 * attackType: 攻击方式（仅攻击塔）
 * supportType: 辅助类型（仅辅助塔）
 * desc: 描述
 * icon: 图标字符
 *
 * awakening（P2-1）: { name, tiers: [{tier:4, cost, name, effect}, {tier:5, ...}] }
 * specializations（P2-8）: { A: {name, desc, icon, maxLvl:5, effect}, B: {...} }
 * skin（P4-8）: 该塔默认皮肤 key
 */
export const TOWER_TYPES = [
  {
    id: 'laser',
    name: '激光炮台',
    cost: 20,
    damage: 11,
    range: 3,
    fireRate: 1.0,
    color: '#ff6b6b',
    glowColor: 'rgba(255,107,107,0.4)',
    type: 'attack',
    attackType: 'laser',
    desc: '发射红色激光束攻击单个敌人',
    icon: '⊕',
    // R 键主动技能
    ability: {
      id: 'laser_pierce',
      name: '穿透射线',
      desc: '对一条线上的所有敌人造成 200 伤害',
      icon: '🔴',
      cooldown: 30,
      color: '#ff5544',
    },
    // P2-8 专精（升 3 级后二选一，可升到 5 级）
    specializations: {
      A: { name: '奥术宗师', desc: '伤害+18%/级（最多5级）', icon: '🔮', maxLvl: 5, effect: { damageMult: 1.18 } },
      B: { name: '战斗专家', desc: '攻速-10%/级（最多5级）', icon: '⚔️', maxLvl: 5, effect: { fireRateMult: 0.9 } }
    },
    // P2-1 觉醒（升 3 级后消耗星尘突破）
    awakening: {
      name: '维度觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '维度穿透', effect: { pierce: 1, damageMult: 1.3 } },
        { tier: 5, cost: 1500, name: '时之宝石', effect: { executeThreshold: 0.15, dmgCap: true } }
      ]
    },
    // P4-8 默认皮肤 key
    skin: 'laser_default'
  },
  {
    id: 'tesla',
    name: '电磁塔',
    cost: 35,
    damage: 10,
    range: 2.5,
    fireRate: 0.6,
    color: '#ffbb77',
    glowColor: 'rgba(255,187,119,0.4)',
    type: 'attack',
    attackType: 'tesla',
    desc: '电弧链式攻击，可跳到附近敌人',
    icon: '⚡',
    // R 键主动技能
    ability: {
      id: 'overload',
      name: '过载模式',
      desc: '自身 5s 攻速 ×3',
      icon: '⚡',
      cooldown: 30,
      color: '#ffdd55',
    },
    specializations: {
      A: { name: '链式宗师', desc: '链式跳跃+1/级（最多5级）', icon: '⛓️', maxLvl: 5, effect: { chainBonus: 1 } },
      B: { name: '风暴专家', desc: '伤害+18%/级（最多5级）', icon: '🌩️', maxLvl: 5, effect: { damageMult: 1.18 } }
    },
    awakening: {
      name: '风暴觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '雷神降临', effect: { chainBonus: 2, damageMult: 1.25 } },
        { tier: 5, cost: 1500, name: '天罚', effect: { executeThreshold: 0.2, dmgCap: true } }
      ]
    },
    skin: 'tesla_default'
  },
  {
    id: 'missile',
    name: '导弹塔',
    cost: 65,
    damage: 55,
    range: 4.5,
    fireRate: 2.0,
    color: '#ff9955',
    glowColor: 'rgba(255,153,85,0.4)',
    type: 'attack',
    attackType: 'missile',
    desc: '发射追踪导弹，范围伤害',
    icon: '▲',
    // R 键主动技能
    ability: {
      id: 'cluster_missile',
      name: '集束导弹',
      desc: '同时发射 5 枚导弹到随机敌人',
      icon: '🚀',
      cooldown: 30,
      color: '#ffaa33',
    },
    specializations: {
      A: { name: '爆破宗师', desc: '溅射+22%/级（最多5级）', icon: '💥', maxLvl: 5, effect: { splashMult: 1.22 } },
      B: { name: '战术专家', desc: '攻速-10%/级（最多5级）', icon: '🎯', maxLvl: 5, effect: { fireRateMult: 0.9 } }
    },
    awakening: {
      name: '战争觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '陨石坠落', effect: { splashMult: 1.5, damageMult: 1.25 } },
        { tier: 5, cost: 1500, name: '末日审判', effect: { executeThreshold: 0.2, dmgCap: true } }
      ]
    },
    skin: 'missile_default'
  },
  {
    id: 'shield',
    name: '护盾发生器',
    cost: 30,
    damage: 0,
    range: 1,
    fireRate: 0,
    color: '#a8cc55',
    glowColor: 'rgba(168,204,85,0.4)',
    type: 'support',
    supportType: 'shield',
    desc: '给周围防御塔提供护盾（减伤50%）',
    icon: '◈',
    // R 键主动技能
    ability: {
      id: 'energy_shield',
      name: '能量护盾',
      desc: '基地免疫下一次伤害',
      icon: '🛡️',
      cooldown: 30,
      color: '#88dd66',
    },
    specializations: {
      A: { name: '守护宗师', desc: '护盾范围+0.4/级（最多5级）', icon: '🛡️', maxLvl: 5, effect: { shieldRangeMult: 1.15 } },
      B: { name: '护盾专家', desc: '减伤+5%/级（最多5级）', icon: '🔰', maxLvl: 5, effect: { shieldReduction: 0.05 } }
    },
    awakening: {
      name: '堡垒觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '绝对领域', effect: { shieldReduction: 0.15, shieldRangeMult: 1.3 } },
        { tier: 5, cost: 1500, name: '永恒壁垒', effect: { shieldReduction: 0.25, dmgCap: true } }
      ]
    },
    skin: 'shield_default'
  },
  {
    id: 'collector',
    name: '能量采集器',
    cost: 20,
    damage: 0,
    range: 0,
    fireRate: 0,
    color: '#ffcc55',
    glowColor: 'rgba(255,204,85,0.4)',
    type: 'support',
    supportType: 'energy',
    desc: '每5秒产生额外3点能量',
    icon: '✦',
    // R 键主动技能
    ability: {
      id: 'energy_infusion',
      name: '能量灌注',
      desc: '立即获得 50 能量',
      icon: '⚡',
      cooldown: 30,
      color: '#ffdd44',
    },
    specializations: {
      A: { name: '富饶宗师', desc: '能量产出+22%/级（最多5级）', icon: '💰', maxLvl: 5, effect: { energyMult: 1.22 } },
      B: { name: '范围专家', desc: '影响范围+0.4/级（最多5级）', icon: '🌐', maxLvl: 5, effect: { rangeMult: 1.15 } }
    },
    awakening: {
      name: '聚能觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '能量虹吸', effect: { energyMult: 1.5, rangeMult: 1.5 } },
        { tier: 5, cost: 1500, name: '无限能源', effect: { energyMult: 2.0, dmgCap: true } }
      ]
    },
    skin: 'collector_default'
  },
  {
    id: 'cryo',
    name: '冷冻塔',
    cost: 30,
    damage: 10,
    range: 2.5,
    fireRate: 0.8,
    color: '#77ccdd',
    glowColor: 'rgba(119,204,221,0.4)',
    type: 'attack',
    attackType: 'cryo',
    desc: '发射冰冻射线，减速敌人55%持续2.5秒',
    icon: '❄',
    // R 键主动技能
    ability: {
      id: 'absolute_zero',
      name: '绝对零度',
      desc: '全场敌人减速 80%（3秒）',
      icon: '❄️',
      cooldown: 30,
      color: '#aaddff',
    },
    specializations: {
      A: { name: '极寒宗师', desc: '减速效果+12%/级（最多5级）', icon: '🥶', maxLvl: 5, effect: { slowMult: 1.12 } },
      B: { name: '范围专家', desc: '射程+12%/级（最多5级）', icon: '🧊', maxLvl: 5, effect: { rangeMult: 1.12 } }
    },
    awakening: {
      name: '凛冬觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '冰封世界', effect: { slowMult: 1.4, freezeChance: 0.3 } },
        { tier: 5, cost: 1500, name: '永冻领域', effect: { executeThreshold: 0.1, dmgCap: true } }
      ]
    },
    skin: 'cryo_default'
  },
  {
    id: 'plasma',
    name: '等离子炮',
    cost: 55,
    damage: 35,
    range: 3.5,
    fireRate: 1.2,
    color: '#ff88aa',
    glowColor: 'rgba(255,136,170,0.4)',
    type: 'attack',
    attackType: 'plasma',
    desc: '发射等离子束，无视部分护甲',
    icon: '◆',
    // R 键主动技能
    ability: {
      id: 'plasma_storm',
      name: '等离子风暴',
      desc: '全场敌人 80 伤害 + 减速 30%（3秒）',
      icon: '💜',
      cooldown: 30,
      color: '#ff88ff',
    },
    specializations: {
      A: { name: '奥术宗师', desc: '伤害+18%/级（最多5级）', icon: '✨', maxLvl: 5, effect: { damageMult: 1.18 } },
      B: { name: '穿甲专家', desc: '无视护甲+10%/级（最多5级）', icon: '🛡️', maxLvl: 5, effect: { armorPen: 0.1 } }
    },
    awakening: {
      name: '湮灭觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '能量洪流', effect: { damageMult: 1.4, splashRadius: 0.8 } },
        { tier: 5, cost: 1500, name: '星核爆裂', effect: { executeThreshold: 0.18, dmgCap: true } }
      ]
    },
    skin: 'plasma_default'
  },
  {
    id: 'gravity',
    name: '重力场',
    cost: 45,
    damage: 0,
    range: 2,
    fireRate: 0,
    color: '#cc8866',
    glowColor: 'rgba(204,136,102,0.4)',
    type: 'support',
    supportType: 'gravity',
    desc: '产生重力场，减速范围内敌人25%',
    icon: '◎',
    // R 键主动技能
    ability: {
      id: 'shock_wave',
      name: '震荡波',
      desc: '全场敌人眩晕 1.5 秒（停止移动）',
      icon: '💫',
      cooldown: 30,
      color: '#ffaa66',
    },
    specializations: {
      A: { name: '引力宗师', desc: '减速+10%/级（最多5级）', icon: '🪐', maxLvl: 5, effect: { slowMult: 1.1 } },
      B: { name: '范围专家', desc: '范围+15%/级（最多5级）', icon: '🌌', maxLvl: 5, effect: { rangeMult: 1.15 } }
    },
    awakening: {
      name: '虚空觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '黑洞引力', effect: { slowMult: 1.5, pullChance: 0.3 } },
        { tier: 5, cost: 1500, name: '时空扭曲', effect: { slowMult: 2.0, dmgCap: true } }
      ]
    },
    skin: 'gravity_default'
  },
  {
    id: 'repair',
    name: '修复站',
    cost: 40,
    damage: 0,
    range: 0,
    fireRate: 0,
    color: '#77ddaa',
    glowColor: 'rgba(119,221,170,0.4)',
    type: 'support',
    supportType: 'repair',
    desc: '每10秒恢复基地1点生命',
    icon: '✚',
    // R 键主动技能
    ability: {
      id: 'emergency_repair',
      name: '紧急修复',
      desc: '修复基地 15 HP',
      icon: '🔧',
      cooldown: 30,
      color: '#66ddaa',
    },
    specializations: {
      A: { name: '医疗宗师', desc: '修复量+25%/级（最多5级）', icon: '💊', maxLvl: 5, effect: { healMult: 1.25 } },
      B: { name: '范围专家', desc: '影响范围+0.4/级（最多5级）', icon: '🏥', maxLvl: 5, effect: { rangeMult: 1.15 } }
    },
    awakening: {
      name: '生命觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '生命洪流', effect: { healMult: 1.6, rangeMult: 1.5 } },
        { tier: 5, cost: 1500, name: '不死之身', effect: { healMult: 2.5, dmgCap: true } }
      ]
    },
    skin: 'repair_default'
  },
  // ================================================================
  // P4-2：新增 2 个塔（召唤塔 / 诅咒塔）
  // ================================================================
  {
    id: 'summoner',
    name: '召唤塔',
    cost: 60,
    damage: 0,
    range: 0,
    fireRate: 5,
    color: '#ff88cc',
    glowColor: 'rgba(255,136,204,0.4)',
    type: 'support',
    supportType: 'summon',
    desc: '周期性召唤小兵挡路',
    icon: '◉',
    summonInterval: 5,
    summonCount: 2,
    summonHp: 50,
    // R 键主动技能
    ability: {
      id: 'swarm_call',
      name: '虫群召唤',
      desc: '立即召唤 5 只小虫',
      icon: '🌀',
      cooldown: 30,
      color: '#ff88cc',
    },
    specializations: {
      A: { name: '虫群宗师', desc: '召唤数+1/级（最多5级）', icon: '🕷️', maxLvl: 5, effect: { summonCount: 1 } },
      B: { name: '生命专家', desc: '小虫HP+30%/级（最多5级）', icon: '❤️', maxLvl: 5, effect: { summonHp: 1.3 } }
    },
    awakening: {
      name: '深渊觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '恶魔召唤', effect: { summonCount: 2, summonHp: 1.5 } },
        { tier: 5, cost: 1500, name: '异界军团', effect: { summonCount: 4, summonHp: 2.0, dmgCap: true } }
      ]
    },
    skin: 'summoner_default'
  },
  {
    id: 'curser',
    name: '诅咒塔',
    cost: 45,
    damage: 0,
    range: 3,
    fireRate: 0.5,
    color: '#aa44ff',
    glowColor: 'rgba(170,68,255,0.4)',
    type: 'support',
    supportType: 'curse',
    desc: '让范围内敌人持续掉血',
    icon: '☠',
    curseDps: 5,
    curseDuration: 3,
    // R 键主动技能
    ability: {
      id: 'death_curse',
      name: '死亡诅咒',
      desc: '范围内敌人 3s 内死亡',
      icon: '💀',
      cooldown: 30,
      color: '#aa44ff',
    },
    specializations: {
      A: { name: '痛苦宗师', desc: '诅咒DPS+25%/级（最多5级）', icon: '☠️', maxLvl: 5, effect: { curseDpsMult: 1.25 } },
      B: { name: '范围专家', desc: '诅咒范围+15%/级（最多5级）', icon: '🕸️', maxLvl: 5, effect: { rangeMult: 1.15 } }
    },
    awakening: {
      name: '死灵觉醒',
      costBase: 500,
      tiers: [
        { tier: 4, cost: 500,  name: '瘟疫蔓延', effect: { curseDpsMult: 1.6, rangeMult: 1.4 } },
        { tier: 5, cost: 1500, name: '死亡一指', effect: { curseDpsMult: 2.5, executeThreshold: 0.1, dmgCap: true } }
      ]
    },
    skin: 'curser_default'
  }
];

/**
 * 根据ID获取塔类型
 */
export function getTowerTypeById(id) {
  return TOWER_TYPES.find(t => t.id === id);
}

/**
 * 获取塔图标
 */
export function getTowerIcon(id) {
  const t = getTowerTypeById(id);
  return t ? t.icon : '●';
}
