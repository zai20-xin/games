import { CELL_H, CELL_W, COLS, LAWN_X, LAWN_Y, ROWS } from "../config";

export interface Occupant {
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly alive: boolean;
  takeDamage(dmg: number): void;
}

// 纯逻辑网格模型：占用查询 + 坐标换算（可单测）
export class GridModel {
  private cells: (Occupant | undefined)[];

  constructor() {
    this.cells = new Array(ROWS * COLS).fill(undefined);
  }

  inBounds(row: number, col: number): boolean {
    return row >= 0 && row < ROWS && col >= 0 && col < COLS;
  }

  at(row: number, col: number): Occupant | undefined {
    if (!this.inBounds(row, col)) return undefined;
    return this.cells[row * COLS + col];
  }

  place(occ: Occupant): boolean {
    if (!this.inBounds(occ.row, occ.col)) return false;
    const i = occ.row * COLS + occ.col;
    if (this.cells[i]) return false;
    this.cells[i] = occ;
    return true;
  }

  removeAt(row: number, col: number): void {
    if (!this.inBounds(row, col)) return;
    this.cells[row * COLS + col] = undefined;
  }

  cellCenter(row: number, col: number): { x: number; y: number } {
    return {
      x: LAWN_X + col * CELL_W + CELL_W / 2,
      y: LAWN_Y + row * CELL_H + CELL_H / 2,
    };
  }

  colAt(x: number): number {
    const c = Math.floor((x - LAWN_X) / CELL_W);
    return c >= 0 && c < COLS ? c : -1;
  }

  rowAt(y: number): number {
    const r = Math.floor((y - LAWN_Y) / CELL_H);
    return r >= 0 && r < ROWS ? r : -1;
  }

  // 找僵尸嘴前的目标：同行、离嘴最近且在容差内的植物
  plantInFront(row: number, mouthX: number): Occupant | undefined {
    let best: Occupant | undefined;
    let bestDist = Infinity;
    for (let c = 0; c < COLS; c++) {
      const occ = this.at(row, c);
      if (!occ || !occ.alive) continue;
      // 接触式判定：嘴探入植物右缘 55px 内且未穿过植物中心，即开始啃食。
      // （旧版对称容差在边界值处会 eat/walk 震荡导致僵尸卡死）
      if (mouthX <= occ.x + 55 && mouthX > occ.x - 30) {
        const d = Math.abs(occ.x - mouthX);
        if (d < bestDist) {
          best = occ;
          bestDist = d;
        }
      }
    }
    return best;
  }
}
