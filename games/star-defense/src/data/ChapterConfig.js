// ================================================================
// 章节配置 - 5 个基础关卡按"章节"组织
// ================================================================

export const CHAPTERS = [
  {
    id: 1,
    name: '序章·第七象限',
    levels: [1],
    gradient: ['#1a0f1e', '#201520'],
    subtitle: '新兵的第一天',
  },
  {
    id: 2,
    name: '第二章·峡谷通道',
    levels: [2],
    gradient: ['#1a1018', '#201222'],
    subtitle: '敌人在山谷集结',
  },
  {
    id: 3,
    name: '第三章·星际漩涡',
    levels: [3],
    gradient: ['#1f1210', '#251518'],
    subtitle: '母舰的螺旋阵',
  },
  {
    id: 4,
    name: '第四章·双线夹击',
    levels: [4],
    gradient: ['#201015', '#251218'],
    subtitle: '分兵两路的考验',
  },
  {
    id: 5,
    name: '终章·终极防线',
    levels: [5],
    gradient: ['#200f18', '#251220'],
    subtitle: '最后一道屏障',
  },
];

/**
 * 根据关卡 ID 找到所属章节
 * @param {number} levelId
 * @returns {object|null}
 */
export function getChapterByLevelId(levelId) {
  return CHAPTERS.find(c => c.levels.includes(levelId)) || null;
}
