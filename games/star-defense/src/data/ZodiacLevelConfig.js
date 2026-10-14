// ================================================================
// 星座关卡配置 - 12个星座主题关卡（id: 6-17）
// ================================================================

/**
 * 星座关卡配置数据结构
 * id: 关卡编号（6-17）
 * name: 关卡名称
 * zodiac: 星座英文名
 * symbol: 星座符号
 * element: 元素属性（fire/earth/wind/water）
 * cols/rows/cell: 网格参数
 * path: 路径数组（单路径或多路径）
 * specialMechanic: 特殊机制标识
 * theme: 视觉主题
 * constellation: 星座连线坐标（归一化0-1）
 * initEnergy/initHP: 初始资源
 * starThresholds: 星级阈值
 * difficultyStars: 难度星级
 * desc: 关卡描述
 */
export const ZODIAC_LEVELS = [
  // === ♈ 白羊座 Aries (id:6, 火, 简单) ===
  {
    id: 6,
    name: '白羊座',
    zodiac: 'aries',
    symbol: '♈',
    element: 'fire',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 直线冲锋：从右到左，中间有少量弯折
      { r: 4, c: 15 }, { r: 4, c: 14 }, { r: 4, c: 13 }, { r: 4, c: 12 },
      { r: 4, c: 11 }, { r: 4, c: 10 }, { r: 4, c: 9 }, { r: 4, c: 8 },
      { r: 3, c: 8 }, { r: 2, c: 8 }, { r: 2, c: 7 }, { r: 2, c: 6 },
      { r: 3, c: 6 }, { r: 4, c: 6 }, { r: 4, c: 5 }, { r: 4, c: 4 },
      { r: 4, c: 3 }, { r: 4, c: 2 }, { r: 4, c: 1 }, { r: 4, c: 0 }
    ],
    multiPath: false,
    specialMechanic: 'speed_boost',
    theme: {
      bg: ['#1a0505', '#2a0a0a', '#1a0505'],
      pathColor: '#ff4422',
      accentColor: '#ff6644',
      portalIcon: '♈',
      baseIcon: '🔥'
    },
    constellation: [
      { x: 0.2, y: 0.3 }, { x: 0.35, y: 0.2 }, { x: 0.5, y: 0.3 },
      { x: 0.65, y: 0.2 }, { x: 0.8, y: 0.3 }
    ],
    initEnergy: 70,
    initHP: 20,
    starThresholds: [18, 12, 6],
    difficultyStars: 2,
    difficulty: 'easy',
    desc: '直线冲锋，敌人速度极快'
  },

  // === ♉ 金牛座 Taurus (id:7, 土, 简单) ===
  {
    id: 7,
    name: '金牛座',
    zodiac: 'taurus',
    symbol: '♉',
    element: 'earth',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 宽阔U形路径
      { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
      { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
      { r: 0, c: 7 }, { r: 0, c: 6 }, { r: 0, c: 5 }, { r: 0, c: 4 },
      { r: 0, c: 3 }, { r: 0, c: 2 }, { r: 0, c: 1 },
      // 向下
      { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 3, c: 1 }, { r: 4, c: 1 },
      { r: 5, c: 1 }, { r: 6, c: 1 }, { r: 7, c: 1 }, { r: 8, c: 1 },
      // 向左到基地
      { r: 8, c: 0 }
    ],
    multiPath: false,
    specialMechanic: 'tank_enemies',
    theme: {
      bg: ['#0a1a0a', '#0f2a0f', '#0a1a0a'],
      pathColor: '#44aa44',
      accentColor: '#66cc66',
      portalIcon: '♉',
      baseIcon: '🌍'
    },
    constellation: [
      { x: 0.15, y: 0.4 }, { x: 0.3, y: 0.25 }, { x: 0.45, y: 0.35 },
      { x: 0.55, y: 0.5 }, { x: 0.7, y: 0.6 }, { x: 0.85, y: 0.5 }
    ],
    initEnergy: 70,
    initHP: 20,
    starThresholds: [18, 12, 6],
    difficultyStars: 2,
    difficulty: 'easy',
    desc: '宽阔U形路径，敌人血量极高'
  },

  // === ♊ 双子座 Gemini (id:8, 风, 普通) ===
  {
    id: 8,
    name: '双子座',
    zodiac: 'gemini',
    symbol: '♊',
    element: 'wind',
    cols: 16,
    rows: 9,
    cell: 56,
    // 多路径：上下两路汇合
    path: [
      // 上路径
      [
        { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
        { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
        { r: 0, c: 7 }, { r: 0, c: 6 },
        { r: 1, c: 6 }, { r: 2, c: 6 }, { r: 3, c: 6 }, { r: 4, c: 6 }
      ],
      // 下路径
      [
        { r: 8, c: 15 }, { r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 },
        { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 }, { r: 8, c: 8 },
        { r: 8, c: 7 }, { r: 8, c: 6 },
        { r: 7, c: 6 }, { r: 6, c: 6 }, { r: 5, c: 6 }, { r: 4, c: 6 }
      ]
    ],
    multiPath: true,
    specialMechanic: 'split_paths',
    theme: {
      bg: ['#1a1018', '#201522', '#1a1018'],
      pathColor: '#aa88ff',
      accentColor: '#ccaaff',
      portalIcon: '♊',
      baseIcon: '🌀'
    },
    constellation: [
      { x: 0.3, y: 0.15 }, { x: 0.3, y: 0.35 }, { x: 0.3, y: 0.55 },
      { x: 0.7, y: 0.15 }, { x: 0.7, y: 0.35 }, { x: 0.7, y: 0.55 }
    ],
    initEnergy: 60,
    initHP: 20,
    starThresholds: [16, 10, 6],
    difficultyStars: 3,
    difficulty: 'normal',
    desc: 'Y形分叉，上下两路敌人类型不同'
  },

  // === ♋ 巨蟹座 Cancer (id:9, 水, 普通) ===
  {
    id: 9,
    name: '巨蟹座',
    zodiac: 'cancer',
    symbol: '♋',
    element: 'water',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 螺旋路径到中心
      { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
      { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
      { r: 0, c: 7 }, { r: 0, c: 6 },
      // 向下
      { r: 1, c: 6 }, { r: 2, c: 6 },
      // 向右
      { r: 2, c: 7 }, { r: 2, c: 8 }, { r: 2, c: 9 }, { r: 2, c: 10 },
      { r: 2, c: 11 }, { r: 2, c: 12 }, { r: 2, c: 13 }, { r: 2, c: 14 },
      // 向下
      { r: 3, c: 14 }, { r: 4, c: 14 },
      // 向左
      { r: 4, c: 13 }, { r: 4, c: 12 }, { r: 4, c: 11 }, { r: 4, c: 10 },
      { r: 4, c: 9 }, { r: 4, c: 8 }, { r: 4, c: 7 }, { r: 4, c: 6 },
      { r: 4, c: 5 }, { r: 4, c: 4 },
      // 向下到中心
      { r: 5, c: 4 }, { r: 6, c: 4 },
      // 向左到基地
      { r: 6, c: 3 }, { r: 6, c: 2 }, { r: 6, c: 1 }, { r: 6, c: 0 }
    ],
    multiPath: false,
    specialMechanic: 'nest_defense',
    theme: {
      bg: ['#1a1218', '#201828', '#1a1218'],
      pathColor: '#cc8866',
      accentColor: '#ff9977',
      portalIcon: '♋',
      baseIcon: '🌙'
    },
    constellation: [
      { x: 0.25, y: 0.3 }, { x: 0.4, y: 0.2 }, { x: 0.55, y: 0.3 },
      { x: 0.6, y: 0.5 }, { x: 0.45, y: 0.6 }, { x: 0.3, y: 0.5 }
    ],
    initEnergy: 55,
    initHP: 20,
    starThresholds: [16, 10, 6],
    difficultyStars: 3,
    difficulty: 'normal',
    desc: '螺旋路径，中心核心被攻击时全塔伤害+20%'
  },

  // === ♌ 狮子座 Leo (id:10, 火, 普通) ===
  {
    id: 10,
    name: '狮子座',
    zodiac: 'leo',
    symbol: '♌',
    element: 'fire',
    cols: 16,
    rows: 9,
    cell: 56,
    // 多路径：3条从右侧不同位置进入，汇合到左侧
    path: [
      // 路径1：右上到中心
      [
        { r: 0, c: 15 }, { r: 1, c: 15 }, { r: 2, c: 15 }, { r: 3, c: 15 },
        { r: 4, c: 15 }, { r: 4, c: 14 }, { r: 4, c: 13 }, { r: 4, c: 12 },
        { r: 4, c: 11 }, { r: 4, c: 10 }, { r: 4, c: 9 }, { r: 4, c: 8 },
        { r: 4, c: 7 }, { r: 4, c: 6 }, { r: 4, c: 5 }
      ],
      // 路径2：右侧中间到中心
      [
        { r: 4, c: 15 }, { r: 4, c: 14 }, { r: 4, c: 13 }, { r: 4, c: 12 },
        { r: 4, c: 11 }, { r: 4, c: 10 }, { r: 4, c: 9 }, { r: 4, c: 8 },
        { r: 4, c: 7 }, { r: 4, c: 6 }, { r: 4, c: 5 }
      ],
      // 路径3：右下到中心
      [
        { r: 8, c: 15 }, { r: 7, c: 15 }, { r: 6, c: 15 }, { r: 5, c: 15 },
        { r: 4, c: 15 }, { r: 4, c: 14 }, { r: 4, c: 13 }, { r: 4, c: 12 },
        { r: 4, c: 11 }, { r: 4, c: 10 }, { r: 4, c: 9 }, { r: 4, c: 8 },
        { r: 4, c: 7 }, { r: 4, c: 6 }, { r: 4, c: 5 }
      ]
    ],
    multiPath: true,
    specialMechanic: 'multi_entry',
    theme: {
      bg: ['#1a1005', '#2a1a0a', '#1a1005'],
      pathColor: '#ffaa22',
      accentColor: '#ffcc44',
      portalIcon: '♌',
      baseIcon: '👑'
    },
    constellation: [
      { x: 0.2, y: 0.25 }, { x: 0.35, y: 0.15 }, { x: 0.5, y: 0.25 },
      { x: 0.55, y: 0.45 }, { x: 0.45, y: 0.6 }, { x: 0.3, y: 0.55 },
      { x: 0.65, y: 0.35 }
    ],
    initEnergy: 55,
    initHP: 20,
    starThresholds: [16, 10, 6],
    difficultyStars: 3,
    difficulty: 'normal',
    desc: '放射状3路同时进攻，需要全方位防御'
  },

  // === ♍ 处女座 Virgo (id:11, 土, 普通) ===
  {
    id: 11,
    name: '处女座',
    zodiac: 'virgo',
    symbol: '♍',
    element: 'earth',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 精密迷宫：长蜿蜒路径，多次转弯
      { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
      { r: 0, c: 11 }, { r: 0, c: 10 },
      // 向下
      { r: 1, c: 10 }, { r: 2, c: 10 },
      // 向左
      { r: 2, c: 9 }, { r: 2, c: 8 }, { r: 2, c: 7 }, { r: 2, c: 6 },
      // 向下
      { r: 3, c: 6 }, { r: 4, c: 6 },
      // 向右
      { r: 4, c: 7 }, { r: 4, c: 8 }, { r: 4, c: 9 }, { r: 4, c: 10 },
      { r: 4, c: 11 }, { r: 4, c: 12 }, { r: 4, c: 13 }, { r: 4, c: 14 },
      // 向下
      { r: 5, c: 14 }, { r: 6, c: 14 },
      // 向左
      { r: 6, c: 13 }, { r: 6, c: 12 }, { r: 6, c: 11 }, { r: 6, c: 10 },
      { r: 6, c: 9 }, { r: 6, c: 8 }, { r: 6, c: 7 }, { r: 6, c: 6 },
      { r: 6, c: 5 }, { r: 6, c: 4 },
      // 向下
      { r: 7, c: 4 }, { r: 8, c: 4 },
      // 向左到基地
      { r: 8, c: 3 }, { r: 8, c: 2 }, { r: 8, c: 1 }, { r: 8, c: 0 }
    ],
    multiPath: false,
    specialMechanic: 'long_path',
    theme: {
      bg: ['#1a1210', '#201815', '#1a1210'],
      pathColor: '#aabbcc',
      accentColor: '#ccddee',
      portalIcon: '♍',
      baseIcon: '💎'
    },
    constellation: [
      { x: 0.2, y: 0.2 }, { x: 0.35, y: 0.3 }, { x: 0.3, y: 0.5 },
      { x: 0.45, y: 0.45 }, { x: 0.55, y: 0.6 }, { x: 0.7, y: 0.55 },
      { x: 0.8, y: 0.7 }
    ],
    initEnergy: 50,
    initHP: 20,
    starThresholds: [16, 10, 6],
    difficultyStars: 3,
    difficulty: 'normal',
    desc: '精密迷宫路径极长，需要持续输出'
  },

  // === ♎ 天秤座 Libra (id:12, 风, 困难) ===
  {
    id: 12,
    name: '天秤座',
    zodiac: 'libra',
    symbol: '♎',
    element: 'wind',
    cols: 16,
    rows: 9,
    cell: 56,
    // 多路径：上下对称的两条路径
    path: [
      // 上路径
      [
        { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
        { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
        { r: 0, c: 7 }, { r: 0, c: 6 },
        { r: 1, c: 6 }, { r: 2, c: 6 }, { r: 3, c: 6 }, { r: 4, c: 6 },
        { r: 4, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 3 }, { r: 4, c: 2 },
        { r: 4, c: 1 }, { r: 4, c: 0 }
      ],
      // 下路径（对称）
      [
        { r: 8, c: 15 }, { r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 },
        { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 }, { r: 8, c: 8 },
        { r: 8, c: 7 }, { r: 8, c: 6 },
        { r: 7, c: 6 }, { r: 6, c: 6 }, { r: 5, c: 6 }, { r: 4, c: 6 },
        { r: 4, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 3 }, { r: 4, c: 2 },
        { r: 4, c: 1 }, { r: 4, c: 0 }
      ]
    ],
    multiPath: true,
    specialMechanic: 'symmetry_bonus',
    theme: {
      bg: ['#1a0f1a', '#2a1a2a', '#1a0f1a'],
      pathColor: '#ff88cc',
      accentColor: '#ffaadd',
      portalIcon: '♎',
      baseIcon: '⚖️'
    },
    constellation: [
      { x: 0.3, y: 0.3 }, { x: 0.5, y: 0.2 }, { x: 0.7, y: 0.3 },
      { x: 0.5, y: 0.5 }, { x: 0.3, y: 0.7 }, { x: 0.5, y: 0.8 }, { x: 0.7, y: 0.7 }
    ],
    initEnergy: 45,
    initHP: 20,
    starThresholds: [14, 8, 4],
    difficultyStars: 4,
    difficulty: 'hard',
    desc: '完美对称路径，对称放置塔获得伤害+25%加成'
  },

  // === ♏ 天蝎座 Scorpio (id:13, 水, 困难) ===
  {
    id: 13,
    name: '天蝎座',
    zodiac: 'scorpio',
    symbol: '♏',
    element: 'water',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // S形毒刺路径
      { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
      { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
      { r: 0, c: 7 }, { r: 0, c: 6 }, { r: 0, c: 5 },
      // 向下
      { r: 1, c: 5 }, { r: 2, c: 5 }, { r: 3, c: 5 }, { r: 4, c: 5 },
      // 向左
      { r: 4, c: 4 }, { r: 4, c: 3 }, { r: 4, c: 2 }, { r: 4, c: 1 },
      { r: 4, c: 0 },
      // 向下
      { r: 5, c: 0 }, { r: 6, c: 0 },
      // 向右
      { r: 6, c: 1 }, { r: 6, c: 2 }, { r: 6, c: 3 }, { r: 6, c: 4 },
      { r: 6, c: 5 }, { r: 6, c: 6 }, { r: 6, c: 7 }, { r: 6, c: 8 },
      { r: 6, c: 9 }, { r: 6, c: 10 },
      // 向下
      { r: 7, c: 10 }, { r: 8, c: 10 },
      // 向左到基地
      { r: 8, c: 9 }, { r: 8, c: 8 }, { r: 8, c: 7 }, { r: 8, c: 6 },
      { r: 8, c: 5 }, { r: 8, c: 4 }, { r: 8, c: 3 }, { r: 8, c: 2 },
      { r: 8, c: 1 }, { r: 8, c: 0 }
    ],
    multiPath: false,
    specialMechanic: 'turn_boost',
    theme: {
      bg: ['#0f050f', '#1a0a1a', '#0f050f'],
      pathColor: '#cc2255',
      accentColor: '#ee4477',
      portalIcon: '♏',
      baseIcon: '🦂'
    },
    constellation: [
      { x: 0.15, y: 0.3 }, { x: 0.25, y: 0.2 }, { x: 0.4, y: 0.25 },
      { x: 0.5, y: 0.4 }, { x: 0.6, y: 0.5 }, { x: 0.7, y: 0.45 },
      { x: 0.8, y: 0.55 }, { x: 0.85, y: 0.7 }
    ],
    initEnergy: 45,
    initHP: 20,
    starThresholds: [14, 8, 4],
    difficultyStars: 4,
    difficulty: 'hard',
    desc: 'S形毒刺路径，转弯处的塔伤害×1.5'
  },

  // === ♐ 射手座 Sagittarius (id:14, 火, 困难) ===
  {
    id: 14,
    name: '射手座',
    zodiac: 'sagittarius',
    symbol: '♐',
    element: 'fire',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 弧形抛物线路径
      { r: 8, c: 15 }, { r: 7, c: 14 }, { r: 6, c: 13 },
      { r: 5, c: 12 }, { r: 4, c: 11 }, { r: 3, c: 10 },
      { r: 2, c: 9 }, { r: 1, c: 8 }, { r: 0, c: 7 },
      { r: 0, c: 6 }, { r: 0, c: 5 }, { r: 0, c: 4 },
      { r: 0, c: 3 }, { r: 0, c: 2 }, { r: 0, c: 1 }, { r: 0, c: 0 }
    ],
    multiPath: false,
    specialMechanic: 'arrow_rain',
    theme: {
      bg: ['#1a0f1e', '#201525', '#1a0f1e'],
      pathColor: '#cc7766',
      accentColor: '#dd8877',
      portalIcon: '♐',
      baseIcon: '🏹'
    },
    constellation: [
      { x: 0.2, y: 0.7 }, { x: 0.35, y: 0.6 }, { x: 0.5, y: 0.45 },
      { x: 0.6, y: 0.3 }, { x: 0.75, y: 0.2 }, { x: 0.8, y: 0.35 }
    ],
    initEnergy: 45,
    initHP: 20,
    starThresholds: [14, 8, 4],
    difficultyStars: 4,
    difficulty: 'hard',
    desc: '弧形抛物线路径，路径上随机区域受箭雨伤害'
  },

  // === ♑ 摩羯座 Capricorn (id:15, 土, 困难) ===
  {
    id: 15,
    name: '摩羯座',
    zodiac: 'capricorn',
    symbol: '♑',
    element: 'earth',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 阶梯式上升路径
      { r: 8, c: 15 }, { r: 8, c: 14 }, { r: 8, c: 13 },
      { r: 7, c: 13 }, { r: 6, c: 13 },
      { r: 6, c: 12 }, { r: 6, c: 11 }, { r: 6, c: 10 },
      { r: 5, c: 10 }, { r: 4, c: 10 },
      { r: 4, c: 9 }, { r: 4, c: 8 }, { r: 4, c: 7 },
      { r: 3, c: 7 }, { r: 2, c: 7 },
      { r: 2, c: 6 }, { r: 2, c: 5 }, { r: 2, c: 4 },
      { r: 1, c: 4 }, { r: 0, c: 4 },
      { r: 0, c: 3 }, { r: 0, c: 2 }, { r: 0, c: 1 }, { r: 0, c: 0 }
    ],
    multiPath: false,
    specialMechanic: 'height_bonus',
    theme: {
      bg: ['#0f0a05', '#1a150a', '#0f0a05'],
      pathColor: '#887766',
      accentColor: '#aa9988',
      portalIcon: '♑',
      baseIcon: '🏔️'
    },
    constellation: [
      { x: 0.2, y: 0.8 }, { x: 0.3, y: 0.65 }, { x: 0.4, y: 0.5 },
      { x: 0.5, y: 0.4 }, { x: 0.6, y: 0.3 }, { x: 0.75, y: 0.2 }
    ],
    initEnergy: 45,
    initHP: 20,
    starThresholds: [14, 8, 4],
    difficultyStars: 4,
    difficulty: 'hard',
    desc: '阶梯式上升，越高的放置位射程越远'
  },

  // === ♒ 水瓶座 Aquarius (id:16, 风, 终极) ===
  {
    id: 16,
    name: '水瓶座',
    zodiac: 'aquarius',
    symbol: '♒',
    element: 'wind',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 波浪形路径
      { r: 4, c: 15 }, { r: 3, c: 14 }, { r: 2, c: 13 },
      { r: 1, c: 12 }, { r: 0, c: 11 },
      { r: 1, c: 10 }, { r: 2, c: 9 }, { r: 3, c: 8 },
      { r: 4, c: 7 }, { r: 5, c: 6 }, { r: 6, c: 5 },
      { r: 7, c: 4 }, { r: 8, c: 3 },
      { r: 7, c: 2 }, { r: 6, c: 1 }, { r: 5, c: 0 },
      { r: 4, c: 0 }, { r: 3, c: 0 }, { r: 2, c: 0 },
      { r: 1, c: 0 }, { r: 0, c: 0 }
    ],
    multiPath: false,
    specialMechanic: 'flowing_path',
    theme: {
      bg: ['#1a1015', '#201520', '#1a1015'],
      pathColor: '#88bbcc',
      accentColor: '#77ccdd',
      portalIcon: '♒',
      baseIcon: '🌊'
    },
    constellation: [
      { x: 0.2, y: 0.3 }, { x: 0.3, y: 0.45 }, { x: 0.4, y: 0.35 },
      { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.4 }, { x: 0.7, y: 0.55 },
      { x: 0.8, y: 0.45 }
    ],
    initEnergy: 40,
    initHP: 20,
    starThresholds: [12, 6, 2],
    difficultyStars: 5,
    difficulty: 'ultimate',
    desc: '波浪形路径，路径每30秒偏移1格'
  },

  // === ♓ 双鱼座 Pisces (id:17, 水, 终极) ===
  {
    id: 17,
    name: '双鱼座',
    zodiac: 'pisces',
    symbol: '♓',
    element: 'water',
    cols: 16,
    rows: 9,
    cell: 56,
    // 多路径：两个环形路径
    path: [
      // 路径1：上环
      [
        { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
        { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
        { r: 0, c: 7 }, { r: 0, c: 6 }, { r: 0, c: 5 }, { r: 0, c: 4 },
        { r: 0, c: 3 },
        { r: 1, c: 3 }, { r: 2, c: 3 }, { r: 3, c: 3 }, { r: 4, c: 3 },
        { r: 4, c: 2 }, { r: 4, c: 1 }, { r: 4, c: 0 }
      ],
      // 路径2：下环
      [
        { r: 8, c: 15 }, { r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 },
        { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 }, { r: 8, c: 8 },
        { r: 8, c: 7 }, { r: 8, c: 6 }, { r: 8, c: 5 }, { r: 8, c: 4 },
        { r: 8, c: 3 },
        { r: 7, c: 3 }, { r: 6, c: 3 }, { r: 5, c: 3 }, { r: 4, c: 3 },
        { r: 4, c: 2 }, { r: 4, c: 1 }, { r: 4, c: 0 }
      ]
    ],
    multiPath: true,
    specialMechanic: 'dual_ring',
    theme: {
      bg: ['#1a0f18', '#201525', '#1a0f18'],
      pathColor: '#cc8877',
      accentColor: '#dd9988',
      portalIcon: '♓',
      baseIcon: '🐟'
    },
    constellation: [
      { x: 0.25, y: 0.3 }, { x: 0.35, y: 0.2 }, { x: 0.5, y: 0.3 },
      { x: 0.65, y: 0.2 }, { x: 0.75, y: 0.3 },
      { x: 0.25, y: 0.7 }, { x: 0.35, y: 0.8 }, { x: 0.5, y: 0.7 },
      { x: 0.65, y: 0.8 }, { x: 0.75, y: 0.7 }
    ],
    initEnergy: 40,
    initHP: 20,
    starThresholds: [12, 6, 2],
    difficultyStars: 5,
    difficulty: 'ultimate',
    desc: '双环形路径，两路敌人属性不同'
  }
];

/**
 * 获取星座关卡配置
 * @param {number} id - 关卡编号（6-17）
 * @returns {Object} 关卡配置
 */
export function getZodiacLevelConfig(id) {
  return ZODIAC_LEVELS.find(l => l.id === id) || null;
}

/**
 * 获取元素名称
 * @param {string} element - 元素标识
 * @returns {string} 中文元素名称
 */
export function getElementName(element) {
  const names = {
    fire: '火',
    earth: '土',
    wind: '风',
    water: '水'
  };
  return names[element] || element;
}

/**
 * 获取特殊机制名称
 * @param {string} mechanic - 机制标识
 * @returns {string} 中文机制描述
 */
export function getMechanicName(mechanic) {
  const names = {
    speed_boost: '速度加成',
    tank_enemies: '坦克敌人',
    split_paths: '分路进攻',
    nest_defense: '巢穴防御',
    multi_entry: '多路进攻',
    long_path: '超长路径',
    symmetry_bonus: '对称加成',
    turn_boost: '转弯加成',
    arrow_rain: '箭雨',
    height_bonus: '高度加成',
    flowing_path: '流动路径',
    dual_ring: '双环路径'
  };
  return names[mechanic] || mechanic;
}
