// ================================================================
// 敌人类型定义 - 9种敌人
// ================================================================

/**
 * 敌人基础属性
 * hp: 基础血量
 * speed: 基础速度（格子/秒）
 * reward: 击杀奖励
 * armor: 护甲（0-1，减免对应比例伤害）
 * flying: 是否飞行
 * size: 大小系数
 * color: 颜色
 * icon: 图标
 */
export const ENEMY_BASE = {
  bug: {
    name: '外星虫族',
    hp: 80,
    speed: 0.25,
    reward: 4,
    armor: 0,
    flying: false,
    size: 0.7,
    color: '#88cc66',
    icon: '🐛'
  },
  drone: {
    name: '无人机群',
    hp: 40,
    speed: 0.50,
    reward: 3,
    armor: 0,
    flying: true,
    size: 0.45,
    color: '#ccbb99',
    icon: '🚁'
  },
  mech: {
    name: '机甲战士',
    hp: 280,
    speed: 0.35,
    reward: 12,
    armor: 0.5,
    flying: false,
    size: 0.9,
    color: '#dd6655',
    icon: '🤖'
  },
  boss: {
    name: '巨型母舰',
    hp: 1200,
    speed: 0.15,
    reward: 45,
    armor: 0.3,
    flying: false,
    size: 1.2,
    color: '#cc66aa',
    icon: '👾'
  },
  bomber: {
    name: '自爆虫',
    hp: 50,
    speed: 0.45,
    reward: 6,
    armor: 0,
    flying: false,
    size: 0.6,
    color: '#ffaa55',
    icon: '💣'
  },
  // === Agent F: 治疗虫 (healer) - 周期性给周围友军回血 ===
  healer: {
    name: '治疗虫',
    hp: 80,
    speed: 0.6,
    reward: 12,
    armor: 0,
    flying: false,
    size: 0.65,
    color: '#66ff88',
    icon: '💊',
    // 自定义行为字段
    healRadius: 60,    // 治疗范围（像素）
    healPct: 0.05,     // 每次恢复最大 HP 的 5%
    healInterval: 1.0, // 治疗周期（秒）
  },
  // === Agent F: 护盾兵 (shield) - 周期性进入 0.8s 无敌 ===
  shield: {
    name: '护盾兵',
    hp: 150,
    speed: 0.5,
    reward: 18,
    armor: 0.2,
    flying: false,
    size: 0.8,
    color: '#66ddff',
    icon: '🛡️',
    // 自定义行为字段
    shieldDuration: 0.8,  // 无敌持续时间（秒）——原1.0降低
    shieldCooldown: 5.0,  // 冷却时间（秒）——原4.0增加，无敌占比16%
    shieldWarning: 0.5,   // 警告闪烁期（秒）
  },
  // === Agent F: 爆裂虫 (swarm) - 死亡分裂成 2 个小型爆裂虫 ===
  swarm: {
    name: '爆裂虫',
    hp: 60,
    speed: 1.0,
    reward: 8,
    armor: 0,
    flying: false,
    size: 0.6,
    color: '#ff8866',
    icon: '💥',
    // 自定义行为字段
    splitCount: 2,    // 分裂数量
    splitHpPct: 0.5,  // 分裂后 HP 比例
    splitMax: 1,      // 最多分裂次数
  },
  stealth: {
    name: '隐形刺客',
    hp: 70,
    speed: 0.60,
    reward: 10,
    armor: 0,
    flying: false,
    size: 0.5,
    color: '#aa9988',
    icon: '👤'
  },
  tank: {
    name: '电磁坦克',
    hp: 650,
    speed: 0.15,
    reward: 20,
    armor: 0.7,
    flying: false,
    size: 1.1,
    color: '#887788',
    icon: '🛡️'
  },
  splitter: {
    name: '分裂虫',
    hp: 130,
    speed: 0.30,
    reward: 6,
    armor: 0.1,
    flying: false,
    size: 0.8,
    color: '#ddaa44',
    icon: '🦠'
  },
  minibug: {
    name: '幼虫',
    hp: 35,
    speed: 0.50,
    reward: 2,
    armor: 0,
    flying: false,
    size: 0.4,
    color: '#ccbb55',
    icon: '🐛'
  },
  virusking: {
    name: '病毒国王',
    hp: 800,
    speed: 0.6,
    reward: 80,
    armor: 0.4,
    flying: false,
    size: 1.5,
    color: '#dd4455',
    icon: '👑'
  },
  ogre: {
    name: '食人魔',
    hp: 450,
    speed: 0.18,
    reward: 16,
    armor: 0.3,
    flying: false,
    size: 1.3,
    color: '#ff9933',
    icon: '👹',
    sprite: true
  },
  assassin: {
    name: '暗影刺客',
    hp: 100,
    speed: 0.65,
    reward: 12,
    armor: 0,
    flying: false,
    size: 0.8,
    color: '#66aaaa',
    icon: '🗡️',
    sprite: true
  },
  beetle: {
    name: '尖刺甲虫',
    hp: 260,
    speed: 0.30,
    reward: 10,
    armor: 0.5,
    flying: false,
    size: 1.1,
    color: '#bb8844',
    icon: '🪲',
    sprite: true
  },
  ice_golem: {
    name: '冰霜魔像',
    hp: 800,
    speed: 0.12,
    reward: 28,
    armor: 0.2,
    flying: false,
    size: 1.4,
    color: '#88bbcc',
    icon: '🧊',
    sprite: true,
    special: 'slow_aura'
  },
  werewolf: {
    name: '狼人狂战士',
    hp: 320,
    speed: 0.55,
    reward: 20,
    armor: 0.1,
    flying: false,
    size: 1.0,
    color: '#cc9966',
    icon: '🐺',
    sprite: true
  },
  // === Agent C: 外星母舰 Boss ===
  boss_brute: {
    name: '外星母舰',
    hp: 1500,
    speed: 0.4,
    reward: 80,
    armor: 0.3,
    flying: false,
    size: 1.5,
    color: '#ff5544',
    icon: '👾',
    isBoss: true,
    phases: [0.5],  // 血量 < 50% 时切换到 phase 2（speed * 1.5）
    auraColor: '#ff5533',
    accentColor: '#ffaa44',
  },
  // === Agent A9 P4-1: 5 个新敌人 ===
  // 幽灵：周期性隐身 2s
  ghost: {
    name: '幽灵',
    hp: 90,
    speed: 0.7,
    reward: 8,
    armor: 0,
    flying: true,
    size: 0.7,
    color: '#aaccff',
    icon: '👻',
    stealth: true,
    desc: '周期性隐身 2s'
  },
  // 自爆卡车：死亡时大范围爆炸
  truck: {
    name: '自爆卡车',
    hp: 400,
    speed: 0.5,
    reward: 25,
    armor: 0.3,
    flying: false,
    size: 1.3,
    color: '#ff5522',
    icon: '🚛',
    explode: { dmg: 100, radius: 80 }
  },
  // 时间扭曲者：扭曲周围时间流速
  timeWarp: {
    name: '时间扭曲者',
    hp: 200,
    speed: 0.4,
    reward: 20,
    armor: 0.2,
    flying: false,
    size: 0.9,
    color: '#cc88ff',
    icon: '⏳',
    special: 'slow_aura_strong'
  },
  // 感染体：死亡分裂成 2 个幼虫
  infected: {
    name: '感染体',
    hp: 180,
    speed: 0.4,
    reward: 12,
    armor: 0,
    flying: false,
    size: 0.8,
    color: '#88ff66',
    icon: '🧟',
    onDeath: 'spawn_2_minibug'
  },
  // 召唤师：周期性召唤小虫
  summoner: {
    name: '召唤师',
    hp: 150,
    speed: 0.3,
    reward: 15,
    armor: 0,
    flying: false,
    size: 0.85,
    color: '#ff88aa',
    icon: '🌀',
    summonInterval: 3
  }
};

/**
 * 根据波次和难度系数计算敌人实际属性
 * @param {number} waveNum - 波次编号（1-20）
 * @param {number} hpMult - 难度血量系数
 * @returns {Object} 各类型敌人的实际属性
 */
export function calculateEnemyStats(waveNum, hpMult) {
  // === Agent A9 P5-4: 三段 HP 增长曲线（累乘式，平滑衔接） ===
  // 第 1-5 波：1.10（前期紧张）
  // 第 6-15 波：1.12（标准）
  // 第 16-20 波：1.08（曲线平缓，避免断崖）
  // 关键：每段从上一段终点累乘，保证曲线在 5→6、15→16 边界处单调递增
  let hpCumulative;
  if (waveNum <= 5) {
    hpCumulative = Math.pow(1.10, waveNum - 1);
  } else if (waveNum <= 15) {
    hpCumulative = Math.pow(1.10, 5) * Math.pow(1.12, waveNum - 6);
  } else {
    hpCumulative = Math.pow(1.10, 5) * Math.pow(1.12, 10) * Math.pow(1.08, waveNum - 16);
  }
  const stats = {};
  for (const [type, base] of Object.entries(ENEMY_BASE)) {
    stats[type] = {
      ...base,
      hp: Math.floor(base.hp * hpMult * hpCumulative),
      speed: Math.min(base.speed * 2, base.speed * (1 + 0.03 * (waveNum - 1))),
      reward: base.reward + Math.floor((waveNum - 1) * 0.3)
    };
  }
  return stats;
}
