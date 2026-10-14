// ================================================================
// 对战模式地图 - 4甬道直线进攻布局
// ================================================================
// 地图布局 (16列 x 10行):
//
//   [我方槽位]  ====甬道1====  [敌方槽位]
//              ====甬道2====
//              ====甬道3====
//              ====甬道4====
//
// 列1: 我方兵营槽位（4个）
// 列14: 敌方兵营槽位（4个）
// 列2-13: 对线区域
// ================================================================

export class BattleMap {
  constructor() {
    this.cols = 16;
    this.rows = 10;
    this.cell = 56;
    this.width = this.cols * this.cell;
    this.height = this.rows * this.cell;
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
  }

  resize(canvas, topBarH, bottomBarH) {
    const rect = canvas.getBoundingClientRect();
    const availW = rect.width;
    const availH = rect.height - (topBarH || 0) - (bottomBarH || 0);
    this.scale = Math.min(availW / this.width, availH / this.height);
    this.offsetX = (availW - this.width * this.scale) / 2;
    this.offsetY = (topBarH || 0) + (availH - this.height * this.scale) / 2;
  }

  getMapRect() {
    return { x: this.offsetX, y: this.offsetY, w: this.width * this.scale, h: this.height * this.scale };
  }

  getChannels() {
    return [
      { row: 1, name: '甬道1' },
      { row: 3, name: '甬道2' },
      { row: 6, name: '甬道3' },
      { row: 8, name: '甬道4' }
    ];
  }

  // 我方兵营槽位（列1）
  getPlayerSlots() {
    return [
      { row: 1, col: 1, channel: 1 },
      { row: 3, col: 1, channel: 3 },
      { row: 6, col: 1, channel: 6 },
      { row: 8, col: 1, channel: 8 }
    ];
  }

  // 敌方兵营槽位（列14）
  getEnemySlots() {
    return [
      { row: 1, col: 14, channel: 1 },
      { row: 3, col: 14, channel: 3 },
      { row: 6, col: 14, channel: 6 },
      { row: 8, col: 14, channel: 8 }
    ];
  }

  // 兼容旧方法
  getBarrackSlots() { return this.getPlayerSlots(); }

  isPlayerSlot(row, col) {
    return this.getPlayerSlots().some(s => s.row === row && s.col === col);
  }

  isEnemySlot(row, col) {
    return this.getEnemySlots().some(s => s.row === row && s.col === col);
  }

  isBarrackSlot(row, col) {
    return this.isPlayerSlot(row, col) || this.isEnemySlot(row, col);
  }

  getCellCenter(row, col) {
    return {
      x: this.offsetX + (col + 0.5) * this.cell * this.scale,
      y: this.offsetY + (row + 0.5) * this.cell * this.scale
    };
  }

  pixelToGrid(px, py) {
    return {
      col: Math.floor((px - this.offsetX) / (this.cell * this.scale)),
      row: Math.floor((py - this.offsetY) / (this.cell * this.scale))
    };
  }
}
