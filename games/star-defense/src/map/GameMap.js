// ================================================================
// 地图管理 - 路径、放置位、碰撞检测（支持多关卡动态网格）
// ================================================================
import { getLevelPaths, isMultiPathLevel } from '../data/LevelConfig.js';

export class GameMap {
  /**
   * @param {Object} level - 关卡配置对象
   */
  constructor(level) {
    /** 关卡配置 */
    this.level = level;

    /** 网格尺寸 */
    this.cols = level.cols;
    this.rows = level.rows;
    this.cell = level.cell;

    /** 路径数组（支持多路径） */
    this.paths = getLevelPaths(level);
    this.isMultiPath = isMultiPathLevel(level);

    /** 路径格子集合 */
    this.pathSet = new Set();
    /** 放置位数组 */
    this.placementSlots = [];
    /** 放置位集合（快速查找） */
    this.slotSet = new Set();

    this._initPath();
    this._initPlacementSlots();
  }

  /** 初始化路径集合 */
  _initPath() {
    // 将所有路径的格子加入集合
    this.paths.forEach(path => {
      path.forEach(p => this.pathSet.add(`${p.r},${p.c}`));
    });
  }

  /** 自动计算放置位（路径相邻的非路径格子） */
  _initPlacementSlots() {
    this.pathSet.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      const adjacents = [
        { r: r - 1, c: c },
        { r: r + 1, c: c },
        { r: r, c: c - 1 },
        { r: r, c: c + 1 }
      ];
      adjacents.forEach(adj => {
        const adjKey = `${adj.r},${adj.c}`;
        if (adj.r >= 0 && adj.r < this.rows && adj.c >= 0 && adj.c < this.cols
            && !this.pathSet.has(adjKey) && !this.slotSet.has(adjKey)) {
          this.slotSet.add(adjKey);
          this.placementSlots.push({ row: adj.r, col: adj.c });
        }
      });
    });
  }

  /**
   * 检查某个格子是否是路径
   */
  isPath(row, col) {
    return this.pathSet.has(`${row},${col}`);
  }

  /**
   * 检查某个格子是否是放置位
   */
  isPlacementSlot(row, col) {
    return this.slotSet.has(`${row},${col}`);
  }

  /**
   * 获取第一条路径（兼容旧接口）
   */
  getPath() {
    return this.paths[0] || [];
  }

  /**
   * 获取所有路径
   */
  getPaths() {
    return this.paths;
  }

  /**
   * 获取第一条路径的起点
   */
  getPathStart() {
    const path = this.paths[0];
    return path ? path[0] : null;
  }

  /**
   * 获取最后一条路径的终点
   */
  getPathEnd() {
    const lastPath = this.paths[this.paths.length - 1];
    return lastPath ? lastPath[lastPath.length - 1] : null;
  }

  /**
   * 获取指定路径的起点
   * @param {number} pathIndex - 路径索引
   */
  getPathStartByIndex(pathIndex) {
    const path = this.paths[pathIndex];
    return path ? path[0] : null;
  }

  /**
   * 获取第一条路径长度
   */
  getPathLength() {
    const path = this.paths[0];
    return path ? path.length : 0;
  }

  /**
   * 获取格子中心像素坐标
   */
  getCellCenter(row, col) {
    return {
      x: col * this.cell + this.cell / 2,
      y: row * this.cell + this.cell / 2
    };
  }

  /**
   * 查找放置位
   */
  findSlot(row, col) {
    return this.placementSlots.find(s => s.row === row && s.col === col) || null;
  }

  /**
   * 获取网格宽度（像素）
   */
  get gridW() {
    return this.cols * this.cell;
  }

  /**
   * 获取网格高度（像素）
   */
  get gridH() {
    return this.rows * this.cell;
  }
}
