// ============================================
//  无限进化 V1.1 — 模块化配置层
//  纯数据定义，无任何逻辑
// ============================================

// ==================== 游戏维度 ====================
const W = 1280, H = 720;
const CX = W / 2, CY = H / 2;

// ==================== 屏幕适配 ====================
// ==================== 画布与上下文 ====================
const canvas = document.getElementById('game');
if (!canvas) {
  throw new Error('[config] canvas#game not found in DOM');
}
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ==================== 触摸反馈 ====================
let touchFeedback = { active: false, x: 0, y: 0, timer: 0 };

// ==================== 屏幕适配辅助 ====================
function screenToGame(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

// ==================== 形态定义 ====================
const FORM_DEFS = {
  primitive: { name: '原始人', tier: 0, color: '#8B6914', desc: '扔石块的原始人', glowColor: 'rgba(139,105,20,0.4)' },
  warrior:   { name: '战士',   tier: 1, color: '#c0392b', desc: '持剑的勇敢战士', glowColor: 'rgba(192,57,43,0.4)' },
  gunner:    { name: '枪手',   tier: 2, color: '#2980b9', desc: '装备枪械的神枪手', glowColor: 'rgba(41,128,185,0.4)' },
  mech:      { name: '机甲',   tier: 3, color: '#7f8c8d', desc: '重型武装机甲', glowColor: 'rgba(127,140,141,0.4)' },
  vehicle:   { name: '载具',   tier: 4, color: '#27ae60', desc: '坦克装甲车', glowColor: 'rgba(39,174,96,0.4)' },
  aircraft:  { name: '飞行器', tier: 5, color: '#8e44ad', desc: '空中打击力量', glowColor: 'rgba(142,68,173,0.4)' },
};
const WEAPON_FORM_MAP = { stone: 'primitive', pistol: 'gunner', shotgun: 'gunner', machinegun: 'gunner', rocket: 'mech', laser: 'mech' };

// ==================== 武器定义 ====================
const WEAPON_DEFS = {
  stone:      { name: '石块',   dmg: 12, interval: 0.45, speed: 6,  color: '#aaa', size: 3, type: 'single',    icon: '🪨', desc: '原始的石块', rarity: 0 },
  pistol:     { name: '手枪',   dmg: 18, interval: 0.28, speed: 8,  color: '#ccc', size: 3, type: 'single',    icon: '🔫', desc: '可靠的手枪', rarity: 1 },
  shotgun:    { name: '霰弹枪', dmg: 10, interval: 0.7,  speed: 7,  color: '#a0522d', size: 2, type: 'spread', icon: '💥', desc: '扇形3发散射', rarity: 1 },
  machinegun: { name: '机枪',   dmg: 6,  interval: 0.09, speed: 9,  color: '#555', size: 2, type: 'single',    icon: '⚡', desc: '超高速连射', rarity: 2 },
  rocket:     { name: '火箭筒', dmg: 60, interval: 1.3,  speed: 4,  color: '#e74c3c', size: 5, type: 'explosive', icon: '🚀', desc: '爆炸范围伤害', rarity: 2 },
  laser:      { name: '激光炮', dmg: 35, interval: 0.45, speed: 12, color: '#00bfff', size: 2, type: 'pierce',  icon: '🔵', desc: '穿透所有敌人', rarity: 3 },
};
const RARITY_NAMES = ['普通', '精良', '稀有', '传说'];
const RARITY_COLORS = ['#aaa', '#4fc3f7', '#ab47bc', '#ffd740'];
const WEAPON_DROP_TABLE = [
  { id: 'pistol', weight: 30 }, { id: 'shotgun', weight: 20 },
  { id: 'machinegun', weight: 15 }, { id: 'rocket', weight: 5 }, { id: 'laser', weight: 3 },
];

// ==================== 恶魔果实 ====================
const FRUIT_DEFS = {
  fire:    { name: '烧烧果实', icon: '🔥', color: '#e74c3c', colorLight: '#f39c12', desc: '灼烧(每秒4伤害,3秒)', passive: 'burn', burnDmg: 4, burnDur: 3, ultName: '终焉火海', ultDmg: 80, ultColor: '#e74c3c' },
  ice:     { name: '冰冰果实', icon: '❄️', color: '#3498db', colorLight: '#85c1e9', desc: '冰冻(减速50%,2秒)',  passive: 'slow', slowDur: 2, ultName: '极寒冰暴', ultFreezeDur: 3.5, ultColor: '#3498db' },
  thunder: { name: '雷雷果实', icon: '⚡', color: '#f1c40f', colorLight: '#f9e154', desc: '连锁闪电(跳3敌人)', passive: 'chain', chainCount: 3, chainDmg: 10, chainRange: 70, ultName: '天降雷霆', ultTargets: 12, ultDmg: 90, ultColor: '#f1c40f' },
};
const FRUIT_DROP_TABLE = [{ id: 'fire', weight: 35 }, { id: 'ice', weight: 35 }, { id: 'thunder', weight: 30 }];

// ==================== 天赋系统 ====================
const TALENT_POOL = [
  { id: 'dmg_up',       name: '⚔️ 武器强化',    desc: '所有武器伤害 +20%',     color: '#e74c3c', apply: (G) => { G.state.talentBonuses.dmgMult *= 1.2; } },
  { id: 'speed_up',     name: '💨 急速射击',    desc: '攻击间隔缩短 15%',       color: '#3498db', apply: (G) => { G.state.talentBonuses.intervalMult *= 0.85; } },
  { id: 'hp_up',        name: '❤️ 强化血肉',    desc: '最大HP +40，回复30HP',   color: '#e74c3c', apply: (G) => { G.player.maxHp += 40; G.player.hp = Math.min(G.player.hp + 30, G.player.maxHp); } },
  { id: 'shield_up',    name: '🛡️ 护盾增强',    desc: '最大护盾 +50，回复速度×2', color: '#3498db', apply: (G) => { G.player.maxShield += 50; G.player.shieldRegen *= 2; } },
  { id: 'energy_up',   name: '⚡ 能量爆发',    desc: '果实能量获取 +100%',     color: '#f1c40f', apply: (G) => { G.state.talentBonuses.energyGain *= 2.0; } },
  { id: 'bullet_up',   name: '🎯 穿甲弹头',    desc: '所有子弹穿透一个敌人',   color: '#9b59b6', apply: (G) => { G.state.talentBonuses.pierce = true; } },
  { id: 'explosion_up',name: '💥 连环爆炸',    desc: '火箭爆炸范围 +50%',      color: '#f39c12', apply: (G) => { G.state.talentBonuses.explosionMult *= 1.5; } },
  { id: 'regen_up',    name: '🌿 生命汲取',    desc: '每次击杀回复2HP',         color: '#2ecc71', apply: (G) => { G.state.talentBonuses.killHeal += 2; } },
  { id: 'multi_shot',   name: '🌀 多重射击',    desc: '单发武器额外射出1颗子弹', color: '#8e44ad', apply: (G) => { G.state.talentBonuses.multiShot = true; } },
  { id: 'ghost_blade',  name: '👻 幽灵剑气',    desc: '每5连击发射剑气',         color: '#1abc9c', apply: (G) => { G.state.talentBonuses.ghostBlade = true; } },
];

// ==================== 怪物类型 ====================
const MONSTER_TYPES = {
  // 普通怪物
  red:    { hp: 25,  dmg: 5,  speed: 1.0, size: 8,  color: '#e74c3c', name: '近战兵', dropRate: 0.35 },
  green:  { hp: 12,  dmg: 3,  speed: 2.0, size: 6,  color: '#2ecc71', name: '速攻兵', dropRate: 0.35 },
  purple: { hp: 18,  dmg: 8,  speed: 0.8, size: 7,  color: '#9b59b6', name: '法师兵', dropRate: 0.35, ranged: true },
  // P0新增：冲锋型怪物
  orange: { hp: 15,  dmg: 10, speed: 2.5, size: 7,  color: '#e67e22', name: '冲锋兵', dropRate: 0.30, dash: true },
  // P0新增：爆炸型怪物
  yellow: { hp: 20,  dmg: 0,  speed: 0.8, size: 9,  color: '#f1c40f', name: '自爆兵', dropRate: 0.25, explosive: true, explosiveDmg: 25, explosiveRadius: 50 },
  // 精英与Boss
  elite:  { hp: 180, dmg: 12, speed: 0.7, size: 14, color: '#f1c40f', name: '精英',   dropRate: 1.0, elite: true },
  boss:   { hp: 800, dmg: 25, speed: 0.35,size: 20, color: '#c0392b', name: 'BOSS',   dropRate: 1.0, boss: true, ranged: true },
};

// ==================== 游戏常量 ====================
const MAX_PARTICLES = 400;
const MAX_BULLETS = 500;
const MAX_FLOATING = 40;
const COMBO_TIMEOUT = 2.5;
const MILESTONES = [10, 25, 50, 100, 200, 500, 1000];
const LEVEL_UP_INTERVAL = 30; // 天赋升级间隔(秒)
const SLOT_UNLOCKS = [0, 8, 20, 40, 80, 150];

// ==================== P0优化：新手引导配置 ====================
const TUTORIAL_DURATION = 0; // 引导期0秒（取消前10秒保护）
const TUTORIAL_SPAWN_MULT = 0.3; // 引导期怪物生成速度
const TUTORIAL_MONSTER_SPEED_MULT = 0.5; // 引导期怪物速度

// ==================== P1优化：视差背景层配置 ====================
const BG_LAYERS = [
  { speed: 0.1, alpha: 0.15, size: 1, color: '#ffffff', count: 80 },   // 最远层
  { speed: 0.25, alpha: 0.25, size: 1.5, color: '#ffffff', count: 50 }, // 中间层
  { speed: 0.4, alpha: 0.35, size: 2, color: '#aaccff', count: 30 },   // 近处层
];

// ==================== P1优化：震动分级配置 ====================
const SHAKE_LEVELS = [
  { minCombo: 5,  intensity: 0.15, duration: 0.1 },
  { minCombo: 10, intensity: 0.25, duration: 0.15 },
  { minCombo: 25, intensity: 0.4,  duration: 0.2 },
  { minCombo: 50, intensity: 0.6,  duration: 0.3 },
];

// ==================== P1优化：BOSS战背景变色 ====================
const BOSS_BG_COLORS = {
  normal:  { top: '#0a0e1a', mid: '#0d1f2d', bottom: '#0a1a0e' },
  boss:    { top: '#1a0a0a', mid: '#2d0d0d', bottom: '#1a0e0a' },
};

// ==================== HUD字号配置 ====================
const HUD_FONT_SIZES = {
  tiny: 9,
  small: 11,
  normal: 13,
  large: 15,
  huge: 17,
};
const HUD_SCALE = 1.0; // 手机适配放大系数

// ==================== 导出 ====================
export {
  // 画布
  canvas, ctx, W, H, CX, CY, touchFeedback, screenToGame,
  // 形态
  FORM_DEFS, WEAPON_FORM_MAP,
  // 武器
  WEAPON_DEFS, RARITY_NAMES, RARITY_COLORS, WEAPON_DROP_TABLE,
  // 果实
  FRUIT_DEFS, FRUIT_DROP_TABLE,
  // 天赋
  TALENT_POOL,
  // 怪物
  MONSTER_TYPES,
  // 常量
  MAX_PARTICLES, MAX_BULLETS, MAX_FLOATING,
  COMBO_TIMEOUT, MILESTONES, LEVEL_UP_INTERVAL, SLOT_UNLOCKS,
  // P0优化
  TUTORIAL_DURATION, TUTORIAL_SPAWN_MULT, TUTORIAL_MONSTER_SPEED_MULT,
  // P1优化
  BG_LAYERS, SHAKE_LEVELS, BOSS_BG_COLORS,
  // HUD
  HUD_FONT_SIZES, HUD_SCALE,
};
