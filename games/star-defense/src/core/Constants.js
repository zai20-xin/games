// ================================================================
// 游戏常量定义
// ================================================================

// 网格配置（默认值，会被关卡配置覆盖）
export const COLS = 16;
export const ROWS = 9;
export const CELL = 56;
export const GRID_W = COLS * CELL;
export const GRID_H = ROWS * CELL;

// 游戏状态枚举
export const GAME_STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  VICTORY: 'victory',
  DEFEAT: 'defeat'
};

// 游戏速度
export const SPEED = {
  PAUSE: 0,
  NORMAL: 1,
  FAST: 2,
  ULTRA: 3
};

// 经济系统常量
//   P5-2 经济数值优化：让"自由部署"成为可选策略
//   - BASE_ENERGY_REGEN: 1  → 1.5（每 1.5s 产 1.5 能量）
//   - REGEN_INTERVAL:    2  → 1.5
//   - INTEREST_RATE:     0.06 → 0.05（配合 eco_interest 升级上限更高）
export const ECONOMY = {
  BASE_ENERGY_REGEN: 1.5,      // 每1.5秒自动产出1.5能量（P5-2: 1→1.5）
  REGEN_INTERVAL: 1.5,         // 能量产出间隔（秒）（P5-2: 2→1.5）
  INTEREST_RATE: 0.05,         // 利息率5%（P5-2: 0.06→0.05）
  SELL_REFUND_RATE: 0.60,     // 出售回收率60%
  MAX_ENERGY: 500,            // 最大能量
  ENERGY_ORB_AUTO_COLLECT_RADIUS: 80, // 能量宝珠自动吸附半径（像素）
  // === 能量宝珠（原散落在 EnemySystem 的魔法数字） ===
  ENERGY_ORB_DROP_CHANCE: 0.08,       // 击杀掉落概率
  ENERGY_ORB_LIFETIME: 10,            // 存在时长（秒）（与 BATTLE 同名常量同值，以此为准）
  ENERGY_ORB_VALUE: 10,               // 收集获得能量
  ENERGY_ORB_CAP: 999,                // 宝珠能量收益的能量上限（历史值，高于 MAX_ENERGY）
  ENERGY_ORB_CLICK_RADIUS: 20,        // 点击收集判定半径（像素）
  ENERGY_ORB_JITTER: 10,              // 掉落位置随机偏移半径（像素）
};

// 升级费用系数（提高升级成本增加决策权重）
export const UPGRADE_COST_MULT = [0, 0.7, 0.9]; // index = currentLevel（原0.6/0.8）

// 难度配置
export const DIFFICULTY = {
  easy:     { hpMult: 0.6,  initEnergy: 80, initHP: 30, label: '简单' },
  hard:     { hpMult: 1.0,  initEnergy: 50, initHP: 20, label: '困难' },
  ultimate: { hpMult: 1.8,  initEnergy: 30, initHP: 10, label: '终极' }
};

// 连击系统
export const COMBO = {
  TIMEOUT: 3,           // 连击超时（秒）——延长以降低断裂感
  DISPLAY_THRESHOLD: 3, // 显示连击的最小击杀数
  BONUS_THRESHOLD: 3,   // 额外能量奖励的连击数
  BONUS_ENERGY: 5,      // 连击额外能量（基础）
  // 阶梯奖励：连击越高奖励越多
  TIER_BONUS: [
    { count: 5,  energy: 8,  label: '连击×5' },
    { count: 10, energy: 15, label: '连击×10' },
    { count: 20, energy: 30, label: '连击×20' },
  ],
};

// 难度曲线参数
// === Agent A2 P5-1: 数值微调 ===
// - GROWTH_RATE 0.18 → 0.15：降低总难度增长，延缓"指数爆炸"感
// - HP_GROWTH 0.15 → 0.12：降低敌人血量增长，使后期不至于断崖式"打不动"
// - SPEED_GROWTH 维持 0.03：速度增长体感合适，不需要调
// 调整理由：根据后续 17 关整体推演，HP_GROWTH 0.15 + 1.12^wave 双重叠加下
//  后期 (wave 20) 敌人 HP 约为 1 波的 9.6 倍，曲线过陡；0.12 后约 8 倍，平滑
export const DIFFICULTY_CURVE = {
  BASE_DIFFICULTY: 1.0,
  GROWTH_RATE: 0.15,
  HP_GROWTH: 0.12,
  SPEED_GROWTH: 0.03
};

// 波次配置
export const WAVE_CONFIG = {
  TOTAL_WAVES: 20,
  BOSS_INTERVAL: 5,       // 每5波一个BOSS
  MIN_SPAWN_INTERVAL: 0.4, // 最小生成间隔
  WAVE_INTERVAL: 5,        // 波间等待时间（秒）
  // 自动波次：开局倒计时（原散落在 Game._gameLoop 的 3/4 秒魔法数字）
  COUNTDOWN_SECONDS: 3,    // 开局 3 秒倒计时
  COUNTDOWN_TOTAL: 4       // 倒计时 + 1 秒"战斗！"横幅后开波
};

// 关卡系统配置
export const LEVEL_CONFIG = {
  WAVES_PER_LEVEL: 5,     // 每关5波
  TOTAL_LEVELS: 17,       // 总共17关（5基础 + 12星座）
  STORAGE_KEY: 'star-defense-progress',  // localStorage存储键（解锁进度）
  STARS_KEY: 'star-defense-stars'        // localStorage存储键（每关最佳星级）
};

// 屏幕震动（按事件类型差异化强度）
// - 强度 0 即"无震动"（保留字段以便调用方统一调用 shakePreset）
// - 数值参考：普通命中 0~2，重击 3~5，Boss/大招 5~8
export const SHAKE = {
  // 原有字段（保留，避免破坏现有调用）
  BOSS_DEATH:      { intensity: 6, timer: 0.4 },
  MISSILE_EXPLODE: { intensity: 3, timer: 0.2 },

  // === Agent A2 P1-3: 8 个新增 preset ===
  BOSS_PHASE:      { intensity: 5, timer: 0.3  }, // Boss 阶段切换
  BASE_DAMAGE:     { intensity: 6, timer: 0.4  }, // 敌人到达基地
  BIG_HIT:         { intensity: 2, timer: 0.08 }, // 大怪死亡（血量 > 100）
  NORMAL_HIT:      { intensity: 0, timer: 0    }, // 普通命中（关闭）
  TOWER_PLACE:     { intensity: 2, timer: 0.1  }, // 塔放置
  TOWER_UPGRADE:   { intensity: 3, timer: 0.2  }, // 塔升满级
};

// 塔等级上限
export const MAX_TOWER_LEVEL = 3;

// 塔属性增长公式（提升升级收益以匹配后期敌人血量增长）
export const TOWER_LEVEL_MULT = {
  DAMAGE: (level) => 1 + (level - 1) * 0.6,      // 1.0/1.6/2.2（原0.4→1.0/1.4/1.8）
  RANGE: (level) => 1 + (level - 1) * 0.12,       // 射程小幅增长
  FIRE_RATE: (level) => Math.pow(0.82, level - 1), // 1.0/0.82/0.67（原0.85，攻速提升更明显）
  SHIELD_RANGE: (level) => 1 + (level - 1) * 0.3,
  ENERGY_OUTPUT: (level) => 3 + (level - 1) * 2, // 3/5/7（原2+1*lvl，采集器升级更有价值）
  SIZE_SCALE: (level) => 1 + (level - 1) * 0.12
};

// 战斗系统魔法数字（提取自 CombatSystem.js）
export const BATTLE = {
  BASE_CRIT_CHANCE: 0.05,        // 基础暴击率
  CRIT_MULTIPLIER: 2.0,          // 暴击伤害倍率
  SLOW_FACTOR_ICE: 0.45,          // 冰霜塔减速因子（55%减速）
  SLOW_DURATION_ICE: 2.5,         // 冰霜塔减速持续时间（秒）
  ELEMENTAL_BONUS: 1.5,          // 元素克制伤害加成
  AOE_BONUS: 1.2,                // 范围伤害加成
  SHIELD_REGEN_INTERVAL: 5,      // 护盾恢复间隔（秒）
  SHIELD_REGEN_AMOUNT: 10,       // 护盾每次恢复量
  ENERGY_ORB_LIFETIME: 10,       // 能量宝珠存在时间（秒）
  ENERGY_ORB_VALUE: 10,           // 能量宝珠基础能量值
  BOSS_ENERGY_BONUS: 2,           // BOSS能量奖励倍率
  KNOCKBACK_THRESHOLD: 0.3,      // 击退触发阈值（敌人最大HP比例）
  KNOCKBACK_DISTANCE: 5,          // 击退距离（像素）
  FREEZE_BOOST_SLOW: 0.1,         // 冰冻射线减速因子
  FREEZE_BOOST_DURATION: 0.5,     // 冰冻射线持续时间
  SLOW_ON_HIT_FACTOR: 0.7,       // 电磁激光减速因子
  SLOW_ON_HIT_DURATION: 1,        // 电磁激光减速持续时间
  CHAIN_DAMAGE_MULT: 0.7,         // 电磁链伤害衰减
  LASER_DAMAGE_BOOST: 1.2,        // 冰冻射线伤害加成
  TESLA_CHAIN_COUNT: 2,            // 电磁塔链式攻击次数
  SPLASH_FALLOFF: 0.5,              // 范围伤害衰减因子
  FREEZE_MISSILE_SLOW: 0.2,        // 冰爆弹减速因子
  FREEZE_MISSILE_DURATION: 1,       // 冰爆弹持续时间
  MISSILE_AOE_BOOST: 1.3,          // 导弹爆炸范围加成
  SHIELD_DAMAGE_BOOST: 1.25,       // 电磁护盾内塔伤害加成
  TESLA_DAMAGE_BOOST: 1.2,         // 电磁塔伤害加成
  DAMAGE_THRESHOLD_RED: 30,        // 伤害数字变红阈值
  // 护盾兵破解：单次伤害超过敌人maxHp的此比例时，缩短护盾冷却
  SHIELD_BREAK_RATIO: 0.25,        // 单次伤害 > maxHp*25% 时，护盾冷却重置+50%
  SHIELD_BREAK_REWARD: 0.5,        // 破解时护盾剩余冷却时间比例（0.5=减半）
  // === 等离子炮（原散落在 CombatSystem._firePlasma） ===
  PLASMA_ARMOR_PIERCE: 0.5,        // 无视 50% 护甲
  PLASMA_SPLASH_DAMAGE_MULT: 0.6,  // 溅射伤害倍率
  PLASMA_SPLASH_ARMOR_MULT: 0.5,   // 溅射对护甲减半
  // === 激光穿透（原散落在 CombatSystem._fireLaser） ===
  PIERCE_RANGE_CELLS: 2,           // 穿透查询范围（格）
  PIERCE_DAMAGE_MULT: 0.7,         // 穿透伤害倍率
  // === 冰冻概率触发（原散落多处） ===
  FREEZE_CHANCE_SLOW: 0.05,        // 冻结触发时的减速因子
  FREEZE_CHANCE_DURATION: 2,       // 冻结减速持续（秒）（弹道冰爆路径）
  FREEZE_CHANCE_DURATION_CRYO: 1.5, // 冻结减速持续（秒）（冷冻塔主攻击路径）
};

// 元游戏进展常量（原散落在 Game.js）
export const PROGRESSION = {
  BOSS_KILL_STARDUST: 5,           // Boss 击杀额外星尘
  TECH_INTEREST_INTERVAL: 10,      // 星尘利息科技：触发间隔（秒）
  TECH_SLOW_START_DURATION: 10,    // 冰封开局科技：减速持续（秒）
};

// 工具函数：十六进制颜色转RGB字符串
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
    : '255,255,255';
}
