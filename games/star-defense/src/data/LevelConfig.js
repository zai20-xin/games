// ================================================================
// 关卡配置 - 5个独立关卡 + 12个星座关卡（共17关）
// ================================================================

import { ZODIAC_LEVELS } from './ZodiacLevelConfig.js';

/**
 * 关卡配置数据结构
 * id: 关卡编号
 * name: 关卡名称
 * desc: 关卡描述
 * cols: 列数
 * rows: 行数
 * cell: 格子大小（像素）
 * path: 路径数组（单路径）或路径数组（多路径，如关卡4）
 * difficulty: 难度标识
 * initEnergy: 初始能量
 * initHP: 初始生命值
 * bgGradient: 背景渐变色
 * starThresholds: [3星, 2星, 1星] 的生命值阈值
 * difficultyStars: 难度星级显示
 */
export const LEVELS = [
  // === 关卡1：新手训练场 ===
  {
    id: 1,
    name: '新手训练场',
    desc: '简单的S形路径，适合熟悉操作',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 从右上进入，S形蜿蜒到左下
      { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
      { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
      // 向下
      { r: 1, c: 8 }, { r: 2, c: 8 },
      // 向左
      { r: 2, c: 7 }, { r: 2, c: 6 }, { r: 2, c: 5 }, { r: 2, c: 4 }, { r: 2, c: 3 },
      // 向下
      { r: 3, c: 3 }, { r: 4, c: 3 },
      // 向右
      { r: 4, c: 4 }, { r: 4, c: 5 }, { r: 4, c: 6 }, { r: 4, c: 7 },
      { r: 4, c: 8 }, { r: 4, c: 9 }, { r: 4, c: 10 },
      // 向下
      { r: 5, c: 10 }, { r: 6, c: 10 },
      // 向左
      { r: 6, c: 9 }, { r: 6, c: 8 }, { r: 6, c: 7 }, { r: 6, c: 6 },
      { r: 6, c: 5 }, { r: 6, c: 4 }, { r: 6, c: 3 },
      // 向下
      { r: 7, c: 3 }, { r: 8, c: 3 },
      // 向左到基地
      { r: 8, c: 2 }, { r: 8, c: 1 }, { r: 8, c: 0 }
    ],
    difficulty: 'easy',
    initEnergy: 60,
    initHP: 25,
    bgGradient: ['#1a0f1e', '#201520', '#1f1018'],
    starThresholds: [20, 15, 10],
    difficultyStars: 1
  },

  // === 关卡2：峡谷通道 ===
  {
    id: 2,
    name: '峡谷通道',
    desc: 'U形通道，敌人从右侧绕行到左侧出口',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 从右上进入，大U形绕到左下
      { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
      { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
      { r: 0, c: 7 }, { r: 0, c: 6 }, { r: 0, c: 5 }, { r: 0, c: 4 }, { r: 0, c: 3 },
      // 向下
      { r: 1, c: 3 }, { r: 2, c: 3 }, { r: 3, c: 3 }, { r: 4, c: 3 },
      // 向右
      { r: 4, c: 4 }, { r: 4, c: 5 }, { r: 4, c: 6 }, { r: 4, c: 7 },
      { r: 4, c: 8 }, { r: 4, c: 9 }, { r: 4, c: 10 }, { r: 4, c: 11 }, { r: 4, c: 12 },
      // 向下
      { r: 5, c: 12 }, { r: 6, c: 12 }, { r: 7, c: 12 }, { r: 8, c: 12 },
      // 向左到基地
      { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 }, { r: 8, c: 8 },
      { r: 8, c: 7 }, { r: 8, c: 6 }, { r: 8, c: 5 }, { r: 8, c: 4 },
      { r: 8, c: 3 }, { r: 8, c: 2 }, { r: 8, c: 1 }, { r: 8, c: 0 }
    ],
    difficulty: 'normal',
    initEnergy: 45,
    initHP: 25,
    bgGradient: ['#1a1018', '#201222', '#1f0f1a'],
    starThresholds: [18, 12, 8],
    difficultyStars: 2
  },

  // === 关卡3：星际漩涡 ===
  {
    id: 3,
    name: '星际漩涡',
    desc: '螺旋形路径，从外圈到中心',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 从右侧进入，螺旋向中心
      { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
      { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
      { r: 0, c: 7 }, { r: 0, c: 6 }, { r: 0, c: 5 }, { r: 0, c: 4 },
      { r: 0, c: 3 }, { r: 0, c: 2 }, { r: 0, c: 1 },
      // 向下
      { r: 1, c: 1 }, { r: 2, c: 1 },
      // 向右
      { r: 2, c: 2 }, { r: 2, c: 3 }, { r: 2, c: 4 }, { r: 2, c: 5 },
      { r: 2, c: 6 }, { r: 2, c: 7 }, { r: 2, c: 8 }, { r: 2, c: 9 },
      { r: 2, c: 10 }, { r: 2, c: 11 }, { r: 2, c: 12 }, { r: 2, c: 13 },
      // 向下
      { r: 3, c: 13 }, { r: 4, c: 13 },
      // 向左
      { r: 4, c: 12 }, { r: 4, c: 11 }, { r: 4, c: 10 }, { r: 4, c: 9 },
      { r: 4, c: 8 }, { r: 4, c: 7 }, { r: 4, c: 6 }, { r: 4, c: 5 },
      { r: 4, c: 4 }, { r: 4, c: 3 },
      // 向下
      { r: 5, c: 3 }, { r: 6, c: 3 },
      // 向右
      { r: 6, c: 4 }, { r: 6, c: 5 }, { r: 6, c: 6 }, { r: 6, c: 7 },
      { r: 6, c: 8 }, { r: 6, c: 9 }, { r: 6, c: 10 }, { r: 6, c: 11 },
      // 向下
      { r: 7, c: 11 }, { r: 8, c: 11 },
      // 向左到基地
      { r: 8, c: 10 }, { r: 8, c: 9 }, { r: 8, c: 8 }
    ],
    difficulty: 'normal+',
    initEnergy: 35,
    initHP: 25,
    bgGradient: ['#1f1210', '#251518', '#201015'],
    starThresholds: [16, 10, 6],
    difficultyStars: 3
  },

  // === 关卡4：双线夹击 ===
  // 多路径关卡：上下两条路径从右侧汇合到左侧
  {
    id: 4,
    name: '双线夹击',
    desc: '双路径同时进攻，需要双线防御',
    cols: 16,
    rows: 9,
    cell: 56,
    // 多路径：数组包含两条路径
    path: [
      // 上路径
      [
        { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
        { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
        { r: 0, c: 7 }, { r: 0, c: 6 }, { r: 0, c: 5 },
        { r: 1, c: 5 }, { r: 2, c: 5 }, { r: 3, c: 5 }, { r: 4, c: 5 }
      ],
      // 下路径
      [
        { r: 8, c: 15 }, { r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 },
        { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 }, { r: 8, c: 8 },
        { r: 8, c: 7 }, { r: 8, c: 6 }, { r: 8, c: 5 },
        { r: 7, c: 5 }, { r: 6, c: 5 }, { r: 5, c: 5 }, { r: 4, c: 5 }
      ],
      // 汇合后路径
      [
        { r: 4, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 3 }, { r: 4, c: 2 },
        { r: 4, c: 1 }, { r: 4, c: 0 }
      ]
    ],
    difficulty: 'hard',
    initEnergy: 30,
    initHP: 25,
    bgGradient: ['#201015', '#251218', '#1f0f18'],
    starThresholds: [14, 8, 4],
    difficultyStars: 4
  },

  // === 关卡5：终极防线 ===
  {
    id: 5,
    name: '终极防线',
    desc: '复杂蜿蜒路径，全类型敌人混合进攻',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 从右上进入，多次蜿蜒
      { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
      { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 },
      { r: 0, c: 7 }, { r: 0, c: 6 }, { r: 0, c: 5 },
      // 向下
      { r: 1, c: 5 }, { r: 2, c: 5 },
      // 向右
      { r: 2, c: 6 }, { r: 2, c: 7 }, { r: 2, c: 8 }, { r: 2, c: 9 },
      { r: 2, c: 10 }, { r: 2, c: 11 }, { r: 2, c: 12 }, { r: 2, c: 13 }, { r: 2, c: 14 },
      // 向下
      { r: 3, c: 14 }, { r: 4, c: 14 },
      // 向左
      { r: 4, c: 13 }, { r: 4, c: 12 }, { r: 4, c: 11 }, { r: 4, c: 10 },
      { r: 4, c: 9 }, { r: 4, c: 8 }, { r: 4, c: 7 }, { r: 4, c: 6 },
      { r: 4, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 3 },
      // 向下
      { r: 5, c: 3 }, { r: 6, c: 3 },
      // 向右
      { r: 6, c: 4 }, { r: 6, c: 5 }, { r: 6, c: 6 }, { r: 6, c: 7 },
      { r: 6, c: 8 }, { r: 6, c: 9 }, { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 },
      // 向下
      { r: 7, c: 12 }, { r: 8, c: 12 },
      // 向左到基地
      { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 }, { r: 8, c: 8 },
      { r: 8, c: 7 }, { r: 8, c: 6 }, { r: 8, c: 5 }, { r: 8, c: 4 },
      { r: 8, c: 3 }, { r: 8, c: 2 }, { r: 8, c: 1 }, { r: 8, c: 0 }
    ],
    difficulty: 'ultimate',
    initEnergy: 25,
    initHP: 25,
    bgGradient: ['#200f18', '#251220', '#1f101a'],
    starThresholds: [12, 6, 2],
    difficultyStars: 5
  },

  // ================================================================
  // 4 主题 × 2 难度 共 8 张新地图（任务 P4-3）
  // id 18-25：森林(18,19) / 雪地(20,21) / 熔岩(22,23) / 太空(24,25)
  // 每主题 1 张简单单路径 + 1 张多路径，每条 path 至少 8 格
  // ================================================================

  // === 关卡18：森林·林间小径（单路径，简单） ===
  {
    id: 18,
    name: '林间小径',
    theme: 'forest',
    desc: '穿越密林的曲折小道，适合新主题入门',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 },
      { r: 0, c: 4 }, { r: 0, c: 5 },
      { r: 1, c: 5 }, { r: 2, c: 5 },
      { r: 2, c: 6 }, { r: 2, c: 7 }, { r: 2, c: 8 },
      { r: 3, c: 8 }, { r: 4, c: 8 },
      { r: 4, c: 9 }, { r: 4, c: 10 },
      { r: 5, c: 10 }, { r: 6, c: 10 },
      { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 },
      { r: 7, c: 13 }, { r: 8, c: 13 }, { r: 8, c: 14 }, { r: 8, c: 15 }
    ],
    difficulty: 'easy',
    initEnergy: 55,
    initHP: 25,
    bgGradient: ['#0a2010', '#0a2a18', '#0a1a10'],
    starThresholds: [20, 14, 8],
    difficultyStars: 1
  },

  // === 关卡19：森林·古木岔路（多路径，普通） ===
  {
    id: 19,
    name: '古木岔路',
    theme: 'forest',
    desc: '参天古树间两条平行小径，需双线布防',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 上路径
      [
        { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 },
        { r: 0, c: 4 }, { r: 0, c: 5 }, { r: 0, c: 6 }, { r: 0, c: 7 },
        { r: 0, c: 8 },
        { r: 1, c: 8 }, { r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 }
      ],
      // 下路径
      [
        { r: 8, c: 0 }, { r: 8, c: 1 }, { r: 8, c: 2 }, { r: 8, c: 3 },
        { r: 8, c: 4 }, { r: 8, c: 5 }, { r: 8, c: 6 }, { r: 8, c: 7 },
        { r: 8, c: 8 },
        { r: 7, c: 8 }, { r: 6, c: 8 }, { r: 5, c: 8 }, { r: 4, c: 8 }
      ],
      // 汇合到基地
      [
        { r: 4, c: 8 }, { r: 4, c: 9 }, { r: 4, c: 10 }, { r: 4, c: 11 },
        { r: 4, c: 12 }, { r: 4, c: 13 }, { r: 4, c: 14 }, { r: 4, c: 15 }
      ]
    ],
    difficulty: 'normal',
    initEnergy: 45,
    initHP: 25,
    bgGradient: ['#0c2412', '#0c2e1a', '#0c1c12'],
    starThresholds: [18, 12, 6],
    difficultyStars: 2
  },

  // === 关卡20：雪地·冰原急行（单路径，简单） ===
  {
    id: 20,
    name: '冰原急行',
    theme: 'snow',
    desc: '冰封冻土上的快速长道，敌人移动加速',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
      { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 },
      { r: 1, c: 9 }, { r: 2, c: 9 },
      { r: 2, c: 8 }, { r: 2, c: 7 }, { r: 2, c: 6 },
      { r: 3, c: 6 }, { r: 4, c: 6 },
      { r: 4, c: 5 }, { r: 4, c: 4 },
      { r: 5, c: 4 }, { r: 6, c: 4 },
      { r: 6, c: 3 }, { r: 6, c: 2 }, { r: 6, c: 1 },
      { r: 7, c: 1 }, { r: 8, c: 1 }, { r: 8, c: 0 }
    ],
    difficulty: 'easy',
    initEnergy: 50,
    initHP: 25,
    bgGradient: ['#0a1a2a', '#102a3a', '#0a1828'],
    starThresholds: [20, 14, 8],
    difficultyStars: 1
  },

  // === 关卡21：雪地·极昼双线（多路径，普通+） ===
  {
    id: 21,
    name: '极昼双线',
    theme: 'snow',
    desc: '极昼暴风雪中，三路并进',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 上路径
      [
        { r: 0, c: 15 }, { r: 0, c: 14 }, { r: 0, c: 13 }, { r: 0, c: 12 },
        { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 },
        { r: 1, c: 9 }, { r: 2, c: 9 }, { r: 3, c: 9 }, { r: 4, c: 9 }
      ],
      // 中路径
      [
        { r: 4, c: 15 }, { r: 4, c: 14 }, { r: 4, c: 13 }, { r: 4, c: 12 },
        { r: 4, c: 11 }, { r: 4, c: 10 }, { r: 4, c: 9 }, { r: 4, c: 8 }
      ],
      // 下路径
      [
        { r: 8, c: 15 }, { r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 },
        { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 },
        { r: 7, c: 9 }, { r: 6, c: 9 }, { r: 5, c: 9 }, { r: 4, c: 9 }
      ],
      // 汇合到基地
      [
        { r: 4, c: 8 }, { r: 4, c: 7 }, { r: 4, c: 6 },
        { r: 4, c: 5 }, { r: 4, c: 4 }, { r: 4, c: 3 }, { r: 4, c: 2 },
        { r: 4, c: 1 }, { r: 4, c: 0 }
      ]
    ],
    difficulty: 'normal+',
    initEnergy: 40,
    initHP: 25,
    bgGradient: ['#0c1c2e', '#14323e', '#0c1a2c'],
    starThresholds: [16, 10, 5],
    difficultyStars: 3
  },

  // === 关卡22：熔岩·熔岩河流（单路径，普通） ===
  {
    id: 22,
    name: '熔岩河流',
    theme: 'lava',
    desc: '沿岩浆河道蜿蜒，敌人耐热强化',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      { r: 8, c: 0 }, { r: 8, c: 1 }, { r: 8, c: 2 }, { r: 8, c: 3 },
      { r: 8, c: 4 }, { r: 8, c: 5 },
      { r: 7, c: 5 }, { r: 6, c: 5 },
      { r: 6, c: 6 }, { r: 6, c: 7 }, { r: 6, c: 8 },
      { r: 5, c: 8 }, { r: 4, c: 8 },
      { r: 4, c: 7 }, { r: 4, c: 6 },
      { r: 3, c: 6 }, { r: 2, c: 6 },
      { r: 2, c: 7 }, { r: 2, c: 8 }, { r: 2, c: 9 },
      { r: 3, c: 9 }, { r: 4, c: 9 }, { r: 4, c: 10 },
      { r: 5, c: 10 }, { r: 6, c: 10 },
      { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 },
      { r: 6, c: 14 }, { r: 6, c: 15 }
    ],
    difficulty: 'normal',
    initEnergy: 45,
    initHP: 25,
    bgGradient: ['#2a0a0a', '#3a0a0a', '#1a0a0a'],
    starThresholds: [18, 12, 6],
    difficultyStars: 2
  },

  // === 关卡23：熔岩·火山隘口（多路径，困难） ===
  {
    id: 23,
    name: '火山隘口',
    theme: 'lava',
    desc: '火山口两侧分流，险峻异常',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 左路
      [
        { r: 4, c: 15 }, { r: 4, c: 14 }, { r: 4, c: 13 }, { r: 4, c: 12 },
        { r: 3, c: 12 }, { r: 2, c: 12 }, { r: 1, c: 12 }, { r: 0, c: 12 },
        { r: 0, c: 11 }, { r: 0, c: 10 }, { r: 0, c: 9 }, { r: 0, c: 8 }
      ],
      // 右路
      [
        { r: 4, c: 15 }, { r: 4, c: 14 }, { r: 4, c: 13 }, { r: 4, c: 12 },
        { r: 5, c: 12 }, { r: 6, c: 12 }, { r: 7, c: 12 }, { r: 8, c: 12 },
        { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 }, { r: 8, c: 8 }
      ],
      // 汇合到基地
      [
        { r: 0, c: 8 }, { r: 1, c: 8 }, { r: 2, c: 8 }, { r: 3, c: 8 },
        { r: 4, c: 8 }, { r: 4, c: 7 }, { r: 4, c: 6 }, { r: 4, c: 5 },
        { r: 4, c: 4 }, { r: 4, c: 3 }, { r: 4, c: 2 }, { r: 4, c: 1 }, { r: 4, c: 0 }
      ]
    ],
    difficulty: 'hard',
    initEnergy: 35,
    initHP: 25,
    bgGradient: ['#320a0a', '#420c0c', '#1f0808'],
    starThresholds: [14, 8, 4],
    difficultyStars: 4
  },

  // === 关卡24：太空·星云通道（单路径，普通+） ===
  {
    id: 24,
    name: '星云通道',
    theme: 'space',
    desc: '穿越绚烂星云，敌人来自异次元',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      { r: 4, c: 0 }, { r: 4, c: 1 }, { r: 4, c: 2 }, { r: 4, c: 3 },
      { r: 4, c: 4 }, { r: 4, c: 5 },
      { r: 3, c: 5 }, { r: 2, c: 5 },
      { r: 2, c: 6 }, { r: 2, c: 7 }, { r: 2, c: 8 }, { r: 2, c: 9 },
      { r: 3, c: 9 }, { r: 4, c: 9 },
      { r: 4, c: 10 }, { r: 4, c: 11 },
      { r: 5, c: 11 }, { r: 6, c: 11 },
      { r: 6, c: 10 }, { r: 6, c: 9 },
      { r: 7, c: 9 }, { r: 8, c: 9 },
      { r: 8, c: 10 }, { r: 8, c: 11 }, { r: 8, c: 12 },
      { r: 8, c: 13 }, { r: 8, c: 14 }, { r: 8, c: 15 }
    ],
    difficulty: 'normal+',
    initEnergy: 40,
    initHP: 25,
    bgGradient: ['#0a0a1a', '#10102a', '#08081a'],
    starThresholds: [16, 10, 5],
    difficultyStars: 3
  },

  // === 关卡25：太空·虫洞分叉（多路径，困难） ===
  {
    id: 25,
    name: '虫洞分叉',
    theme: 'space',
    desc: '虫洞撕开空间，敌人从三个入口涌来',
    cols: 16,
    rows: 9,
    cell: 56,
    path: [
      // 入口1：上
      [
        { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 },
        { r: 0, c: 4 }, { r: 0, c: 5 }, { r: 0, c: 6 },
        { r: 1, c: 6 }, { r: 2, c: 6 }, { r: 3, c: 6 }, { r: 4, c: 6 }
      ],
      // 入口2：中
      [
        { r: 4, c: 0 }, { r: 4, c: 1 }, { r: 4, c: 2 }, { r: 4, c: 3 },
        { r: 4, c: 4 }, { r: 4, c: 5 }, { r: 4, c: 6 }, { r: 4, c: 7 }
      ],
      // 入口3：下
      [
        { r: 8, c: 0 }, { r: 8, c: 1 }, { r: 8, c: 2 }, { r: 8, c: 3 },
        { r: 8, c: 4 }, { r: 8, c: 5 }, { r: 8, c: 6 },
        { r: 7, c: 6 }, { r: 6, c: 6 }, { r: 5, c: 6 }, { r: 4, c: 6 }
      ],
      // 汇合 → 基地
      [
        { r: 4, c: 7 }, { r: 4, c: 8 }, { r: 4, c: 9 },
        { r: 4, c: 10 }, { r: 4, c: 11 }, { r: 4, c: 12 }, { r: 4, c: 13 },
        { r: 4, c: 14 }, { r: 4, c: 15 }
      ]
    ],
    difficulty: 'hard',
    initEnergy: 35,
    initHP: 25,
    bgGradient: ['#0c0c20', '#14143a', '#0a0a1c'],
    starThresholds: [14, 8, 4],
    difficultyStars: 4
  }
];

/**
 * 获取关卡配置
 * @param {number} levelId - 关卡编号（1-17）
 * @returns {Object} 关卡配置
 */
export function getLevelConfig(levelId) {
  return ALL_LEVELS.find(l => l.id === levelId) || ALL_LEVELS[0];
}

/**
 * 判断关卡是否为多路径关卡
 * @param {Object} level - 关卡配置
 * @returns {boolean}
 */
export function isMultiPathLevel(level) {
  return Array.isArray(level.path[0]);
}

/**
 * 获取关卡的所有路径（统一为数组格式）
 * @param {Object} level - 关卡配置
 * @returns {Array<Array>} 路径数组
 */
export function getLevelPaths(level) {
  if (isMultiPathLevel(level)) {
    return level.path;
  }
  return [level.path];
}

/**
 * 获取关卡难度名称
 * @param {string} difficulty - 难度标识
 * @returns {string} 中文难度名称
 */
export function getDifficultyName(difficulty) {
  const names = {
    'easy': '简单',
    'normal': '普通',
    'normal+': '普通+',
    'hard': '困难',
    'ultimate': '终极'
  };
  return names[difficulty] || difficulty;
}

// ================================================================
// 合并所有关卡（5个基础 + 12个星座 = 17关）
// ================================================================
export const ALL_LEVELS = [...LEVELS, ...ZODIAC_LEVELS];
export const TOTAL_LEVELS = ALL_LEVELS.length;
