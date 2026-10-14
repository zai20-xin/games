import { COLS, ROWS } from "../config";

export interface Cell {
  col: number;
  row: number;
  flowerId: number | null;
}

export class GridModel {
  readonly cols = COLS;
  readonly rows = ROWS;
  private cells: Cell[][] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.cells = [];
    for (let r = 0; r < ROWS; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < COLS; c++) row.push({ col: c, row: r, flowerId: null });
      this.cells.push(row);
    }
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && col < COLS && row >= 0 && row < ROWS;
  }

  at(col: number, row: number): Cell | null {
    if (!this.inBounds(col, row)) return null;
    return this.cells[row]![col]!;
  }

  isEmpty(col: number, row: number): boolean {
    const c = this.at(col, row);
    return !!c && c.flowerId === null;
  }

  place(col: number, row: number, flowerId: number): boolean {
    const c = this.at(col, row);
    if (!c || c.flowerId !== null) return false;
    c.flowerId = flowerId;
    return true;
  }

  clear(col: number, row: number): void {
    const c = this.at(col, row);
    if (c) c.flowerId = null;
  }

  flowerIdAt(col: number, row: number): number | null {
    return this.at(col, row)?.flowerId ?? null;
  }
}
