export enum Special {
  NONE = 0,
  STRIPE_H = 1,
  STRIPE_V = 2,
  BOMB = 3,
  RAINBOW = 4,
}

export const NO_COLOR = -1;

export interface Pos {
  x: number;
  y: number;
}

export interface CellData {
  color: number;
  special: Special;
  obstacleLayers: number;
}

export function makeTile(color: number, special: Special = Special.NONE): CellData {
  return { color, special, obstacleLayers: 0 };
}

export function makeObstacle(layers: number): CellData {
  return { color: NO_COLOR, special: Special.NONE, obstacleLayers: Math.min(2, Math.max(1, layers)) };
}

export function emptyCell(): CellData {
  return { color: NO_COLOR, special: Special.NONE, obstacleLayers: 0 };
}

export function hasTile(c: CellData): boolean {
  return c.obstacleLayers === 0 && c.color !== NO_COLOR;
}

export function isObstacle(c: CellData): boolean {
  return c.obstacleLayers > 0;
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
