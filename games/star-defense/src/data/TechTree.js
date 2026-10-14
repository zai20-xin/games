// ================================================================
// 星际图谱 — 全局科技树（持久化被动 buff）
// 解锁后对所有关卡生效，使用 星尘（stardust）购买
// ================================================================

/**
 * 科技定义列表
 * id: 唯一标识
 * name: 显示名
 * label: 备用显示名（特殊分支使用）
 * desc: 描述
 * cost: 解锁消耗（星尘）
 * icon: emoji 图标
 * tier: 层级（1/2/3），用于 UI 分组
 * maxLvl: 最大可购买等级（默认 1，可重复购买累加效果）
 * effect: 解锁后注入的 buff 字段
 *   - startEnergy: number   → 每关开始额外能量
 *   - energyRegen: number   → 每 10 秒获得的能量
 *   - towerDamage: number   → 塔伤害加成（0.1 = +10%）
 *   - towerRange:  number   → 塔射程加成（0.15 = +15%）
 *   - towerSpeed:  number   → 塔攻速加成（0.15 = +15%）
 *   - killEnergy:  number   → 击杀敌人获得的能量
 *   - slowStart:   number   → 开局前 N 秒全场敌人减速
 *   - baseHp:      number   → 基地生命上限加成
 *   - critChance:  number   → 暴击率加成
 *   - comboBoost:  number   → 组合效果加成（特殊分支 P2-10）
 *   - chestLuckBonus: number → 宝箱稀有度加成（特殊分支 P2-10）
 *   - autoRevive:  number   → 基地 HP 归零时自动回血（特殊分支 P2-10）
 *   - autoEmp:     number   → 每 5 波自动触发全屏眩晕（特殊分支 P2-10）
 *   - autoMeteor:  number   → 每 10 波对最高 HP 敌人造成伤害（特殊分支 P2-10）
 */
export const TECH_TREE = [
  {
    id: 'start_energy',
    name: '能量储备',
    desc: '每关开始 +20 能量',
    cost: 30,
    icon: '⚡',
    tier: 1,
    effect: { startEnergy: 20 },
  },
  {
    id: 'interest',
    name: '星尘利息',
    desc: '每 10 秒获得 +1 能量',
    cost: 50,
    icon: '💰',
    tier: 1,
    effect: { energyRegen: 1 },
  },
  {
    id: 'base_hp',
    name: '加固基地',
    desc: '基地生命 +20',
    cost: 60,
    icon: '🛡️',
    tier: 1,
    effect: { baseHp: 20 },
  },
  {
    id: 'slow_start',
    name: '冰封开局',
    desc: '前 10 秒全场敌人减速 30%',
    cost: 80,
    icon: '❄️',
    tier: 1,
    effect: { slowStart: 0.3 },
  },
  {
    id: 'tower_damage',
    name: '塔强化',
    desc: '所有塔伤害 +10%',
    cost: 80,
    icon: '⚔️',
    tier: 2,
    effect: { towerDamage: 0.1 },
  },
  {
    id: 'tower_range',
    name: '瞄准镜',
    desc: '所有塔射程 +15%',
    cost: 100,
    icon: '🔭',
    tier: 2,
    effect: { towerRange: 0.15 },
  },
  {
    id: 'tower_speed',
    name: '连发',
    desc: '所有塔攻速 +15%',
    cost: 120,
    icon: '🔥',
    tier: 2,
    effect: { towerSpeed: 0.15 },
  },
  {
    id: 'kill_energy',
    name: '吸能',
    desc: '击杀敌人 +2 能量',
    cost: 150,
    icon: '✨',
    tier: 3,
    effect: { killEnergy: 2 },
  },
  {
    id: 'crit_chance',
    name: '暴击',
    desc: '所有塔 +10% 暴击率',
    cost: 200,
    icon: '💥',
    tier: 3,
    effect: { critChance: 0.1 },
  },
  // ============================================================
  // 特殊型分支（P2-10：5 个新科技）
  //   - comboBoost:    组合效果加成（0.25 = +25%）
  //   - chestLuckBonus:宝箱稀有度加成（0.2 = +20%）
  //   - autoRevive:    基地 HP 归零时自动回血（次数）
  //   - autoEmp:       每 5 波自动触发全屏眩晕
  //   - autoMeteor:    每 10 波对最高 HP 敌人造成伤害
  // ============================================================
  {
    id: 'spec_combo',
    label: '组合大师',
    name: '组合大师',
    desc: '组合效果+25%',
    cost: 250,
    icon: '🔗',
    tier: 3,
    effect: { comboBoost: 0.25 },
    maxLvl: 3,
  },
  {
    id: 'spec_luck',
    label: '幸运之手',
    name: '幸运之手',
    desc: '宝箱稀有度+20%',
    cost: 200,
    icon: '🍀',
    tier: 3,
    effect: { chestLuckBonus: 0.2 },
    maxLvl: 3,
  },
  {
    id: 'spec_revive',
    label: '凤凰协议',
    name: '凤凰协议',
    desc: '基地 HP 归零时自动回 5HP（每局 1 次）',
    cost: 400,
    icon: '🔥',
    tier: 3,
    effect: { autoRevive: 1 },
    maxLvl: 2,
  },
  {
    id: 'spec_emp',
    label: '战术 EMP',
    name: '战术 EMP',
    desc: '每 5 波自动触发一次全屏眩晕',
    cost: 500,
    icon: '⚡',
    tier: 3,
    effect: { autoEmp: 1 },
    maxLvl: 1,
  },
  {
    id: 'spec_meteor',
    label: '陨石召唤',
    name: '陨石召唤',
    desc: '每 10 波对生命值最高的敌人造成 500 伤害',
    cost: 600,
    icon: '☄️',
    tier: 3,
    effect: { autoMeteor: 1 },
    maxLvl: 1,
  },
];

export const STORAGE_KEY = 'star-defense-techs';

/** 特殊型分支 id 集合（P2-10 新增） */
export const SPECIAL_TECH_IDS = new Set([
  'spec_combo',
  'spec_luck',
  'spec_revive',
  'spec_emp',
  'spec_meteor',
]);

/** 判断某科技是否属于"特殊"分支 */
export function isSpecialTech(id) {
  return SPECIAL_TECH_IDS.has(id);
}

/** 按 id 查找科技 */
export function findTech(id) {
  return TECH_TREE.find(t => t.id === id) || null;
}

/** 按 tier 分组（用于 UI 分层显示） */
export function groupByTier() {
  const groups = { 1: [], 2: [], 3: [] };
  for (const t of TECH_TREE) {
    if (!groups[t.tier]) groups[t.tier] = [];
    groups[t.tier].push(t);
  }
  return groups;
}
