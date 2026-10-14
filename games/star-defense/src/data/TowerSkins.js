// ================================================================
// 塔皮肤系统（P4-8）
// 每个塔 3 个皮肤：default（默认解锁）/ advanced（成就解锁）/ legendary（活动解锁）
// 皮肤不影响数值，只改 color / glowColor。
// ================================================================

/**
 * 皮肤数据
 * 字段：id（与 tower.skin 对应）/ name（显示名）/ color / glowColor / desc / unlock（解锁条件描述）
 */
export const TOWER_SKINS = {
  // ---------------- 激光炮台 ----------------
  laser_default:   { id: 'laser_default',   name: '标准红',     color: '#ff6b6b', glowColor: 'rgba(255,107,107,0.4)', desc: '默认外观', unlock: 'default' },
  laser_arcane:    { id: 'laser_arcane',    name: '奥术蓝',     color: '#6688ff', glowColor: 'rgba(102,136,255,0.4)', desc: '奥术能量铭刻', unlock: 'complete_level_3' },
  laser_void:      { id: 'laser_void',      name: '虚空紫',     color: '#aa44ff', glowColor: 'rgba(170,68,255,0.4)',  desc: '来自虚空的回响', unlock: 'kill_5000' },

  // ---------------- 电磁塔 ----------------
  tesla_default:   { id: 'tesla_default',   name: '标准橙',     color: '#ffbb77', glowColor: 'rgba(255,187,119,0.4)', desc: '默认外观', unlock: 'default' },
  tesla_amber:     { id: 'tesla_amber',     name: '琥珀金',     color: '#ffaa33', glowColor: 'rgba(255,170,51,0.4)',  desc: '雷神之锤碎屑', unlock: 'complete_level_3' },
  tesla_galaxy:    { id: 'tesla_galaxy',    name: '银河白',     color: '#ccddff', glowColor: 'rgba(204,221,255,0.4)', desc: '星云离子',     unlock: 'kill_5000' },

  // ---------------- 导弹塔 ----------------
  missile_default: { id: 'missile_default', name: '标准红',     color: '#ff9955', glowColor: 'rgba(255,153,85,0.4)',  desc: '默认外观', unlock: 'default' },
  missile_steel:   { id: 'missile_steel',   name: '钢铁灰',     color: '#aaaaaa', glowColor: 'rgba(170,170,170,0.4)', desc: '钛合金装甲',   unlock: 'complete_level_3' },
  missile_phoenix: { id: 'missile_phoenix', name: '凤凰金',     color: '#ffdd66', glowColor: 'rgba(255,221,102,0.4)', desc: '烈焰再临',     unlock: 'kill_5000' },

  // ---------------- 护盾发生器 ----------------
  shield_default:  { id: 'shield_default',  name: '标准绿',     color: '#a8cc55', glowColor: 'rgba(168,204,85,0.4)',  desc: '默认外观', unlock: 'default' },
  shield_aegis:    { id: 'shield_aegis',    name: '神盾蓝',     color: '#5599ff', glowColor: 'rgba(85,153,255,0.4)',  desc: '圣盾纹章',     unlock: 'complete_level_3' },
  shield_mithril:  { id: 'shield_mithril',  name: '秘银白',     color: '#e0eaff', glowColor: 'rgba(224,234,255,0.4)', desc: '秘银之盾',     unlock: 'kill_5000' },

  // ---------------- 能量采集器 ----------------
  collector_default: { id: 'collector_default', name: '标准金',  color: '#ffcc55', glowColor: 'rgba(255,204,85,0.4)',  desc: '默认外观', unlock: 'default' },
  collector_crystal: { id: 'collector_crystal', name: '水晶紫',  color: '#cc88ff', glowColor: 'rgba(204,136,255,0.4)', desc: '能量水晶',     unlock: 'complete_level_3' },
  collector_aurora:  { id: 'collector_aurora',  name: '极光绿',  color: '#88ffcc', glowColor: 'rgba(136,255,204,0.4)', desc: '极光能量',     unlock: 'kill_5000' },

  // ---------------- 冷冻塔 ----------------
  cryo_default:    { id: 'cryo_default',    name: '标准冰蓝',   color: '#77ccdd', glowColor: 'rgba(119,204,221,0.4)', desc: '默认外观', unlock: 'default' },
  cryo_glacier:    { id: 'cryo_glacier',    name: '冰川白',     color: '#aaddff', glowColor: 'rgba(170,221,255,0.4)', desc: '万年寒冰',     unlock: 'complete_level_3' },
  cryo_abyss:      { id: 'cryo_abyss',      name: '深渊蓝',     color: '#3366ff', glowColor: 'rgba(51,102,255,0.4)',  desc: '深寒领域',     unlock: 'kill_5000' },

  // ---------------- 等离子炮 ----------------
  plasma_default:  { id: 'plasma_default',  name: '标准粉',     color: '#ff88aa', glowColor: 'rgba(255,136,170,0.4)', desc: '默认外观', unlock: 'default' },
  plasma_nebula:   { id: 'plasma_nebula',   name: '星云紫',     color: '#cc44ff', glowColor: 'rgba(204,68,255,0.4)',  desc: '星云爆发',     unlock: 'complete_level_3' },
  plasma_sun:      { id: 'plasma_sun',      name: '日轮金',     color: '#ffcc44', glowColor: 'rgba(255,204,68,0.4)',  desc: '恒星燃烧',     unlock: 'kill_5000' },

  // ---------------- 重力场 ----------------
  gravity_default: { id: 'gravity_default', name: '标准棕',     color: '#cc8866', glowColor: 'rgba(204,136,102,0.4)', desc: '默认外观', unlock: 'default' },
  gravity_obsidian: { id: 'gravity_obsidian', name: '黑曜黑',   color: '#555566', glowColor: 'rgba(85,85,102,0.4)',  desc: '黑曜之握',     unlock: 'complete_level_3' },
  gravity_singularity: { id: 'gravity_singularity', name: '奇点紫', color: '#aa55ff', glowColor: 'rgba(170,85,255,0.4)', desc: '黑洞奇点',  unlock: 'kill_5000' },

  // ---------------- 修复站 ----------------
  repair_default:  { id: 'repair_default',  name: '标准青',     color: '#77ddaa', glowColor: 'rgba(119,221,170,0.4)', desc: '默认外观', unlock: 'default' },
  repair_healer:   { id: 'repair_healer',   name: '治愈白',     color: '#eeffdd', glowColor: 'rgba(238,255,221,0.4)', desc: '圣光治愈',     unlock: 'complete_level_3' },
  repair_nano:     { id: 'repair_nano',     name: '纳米蓝',     color: '#88ccff', glowColor: 'rgba(136,204,255,0.4)', desc: '纳米修复',     unlock: 'kill_5000' },

  // ---------------- P4-2 召唤塔 ----------------
  summoner_default: { id: 'summoner_default', name: '标准粉紫', color: '#ff88cc', glowColor: 'rgba(255,136,204,0.4)', desc: '默认外观', unlock: 'default' },
  summoner_demon:   { id: 'summoner_demon',   name: '恶魔红',   color: '#ff3344', glowColor: 'rgba(255,51,68,0.4)',   desc: '恶魔之眼',     unlock: 'complete_level_3' },
  summoner_void:    { id: 'summoner_void',    name: '虚空紫',   color: '#8833ff', glowColor: 'rgba(136,51,255,0.4)',  desc: '虚空裂隙',     unlock: 'kill_5000' },

  // ---------------- P4-2 诅咒塔 ----------------
  curser_default:   { id: 'curser_default',   name: '标准紫',   color: '#aa44ff', glowColor: 'rgba(170,68,255,0.4)',  desc: '默认外观', unlock: 'default' },
  curser_blood:     { id: 'curser_blood',     name: '血红',     color: '#cc0033', glowColor: 'rgba(204,0,51,0.4)',   desc: '血色诅咒',     unlock: 'complete_level_3' },
  curser_necro:     { id: 'curser_necro',     name: '死灵绿',   color: '#66ff66', glowColor: 'rgba(102,255,102,0.4)', desc: '死灵法师',     unlock: 'kill_5000' },
};

/**
 * 根据 towerId 获取该塔所有可用皮肤
 * @param {string} towerId
 * @returns {Object[]} 皮肤列表
 */
export function getSkinsForTower(towerId) {
  return Object.values(TOWER_SKINS).filter(s => s.id.startsWith(towerId + '_'));
}

/**
 * 根据 skinId 获取皮肤配置
 */
export function getSkinById(skinId) {
  return TOWER_SKINS[skinId] || null;
}

/**
 * 判断某皮肤是否解锁
 * @param {string} skinId
 * @param {Object} profile - 玩家档案
 * @returns {boolean}
 */
export function isSkinUnlocked(skinId, profile) {
  const skin = TOWER_SKINS[skinId];
  if (!skin) return false;
  if (skin.unlock === 'default') return true;
  const list = (profile && profile.unlockedSkins) || [];
  return list.includes(skinId);
}
