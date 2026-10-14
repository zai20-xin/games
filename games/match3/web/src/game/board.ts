import { Rng } from "./rng";
import {
  CellData,
  Pos,
  Special,
  NO_COLOR,
  makeTile,
  makeObstacle,
  emptyCell,
  hasTile,
  isObstacle,
  manhattan,
} from "./cells";

export interface RunGroup {
  cells: Pos[];
  color: number;
}

export interface ClearedCell {
  pos: Pos;
  color: number;
  special: Special;
}

export interface SpawnInfo {
  pos: Pos;
  special: Special;
  color: number;
  converted?: boolean;
}

export type BoardEvent =
  | { type: "swap" | "revert"; a: Pos; b: Pos }
  | {
      type: "cleared";
      cells: ClearedCell[];
      spawns: SpawnInfo[];
      round: number;
      points: number;
      frost: number;
    }
  | { type: "falls"; moves: { from: Pos; to: Pos }[]; refills: { pos: Pos; color: number }[] }
  | { type: "shuffle"; placements: { pos: Pos; color: number; special: Special }[] }
  | { type: "convert"; pos: Pos; special: Special }
  | { type: "outcome"; won: boolean; finished: boolean };

export const BASE_POINTS = 10;
const MAX_SHUFFLE_ATTEMPTS = 60;

const DIRS_ORTH = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export class Match3Board {
  width = 7;
  height = 8;
  colorsCount = 5;
  rng = new Rng();
  cells: CellData[][] = [];

  setup(width: number, height: number, colors: number, seed = -1): void {
    this.width = width;
    this.height = height;
    this.colorsCount = Math.max(3, colors);
    this.rng.reseed(seed >= 0 ? seed : Date.now() >>> 0);
    this.cells = [];
    for (let r = 0; r < height; r++) {
      this.cells.push(Array.from({ length: width }, () => emptyCell()));
    }
  }

  fillFromLayout(obstacles: { pos: [number, number]; layers: number }[]): void {
    for (const entry of obstacles) {
      const pos = { x: entry.pos[0], y: entry.pos[1] };
      if (this.inBounds(pos)) this.cells[pos.y][pos.x] = makeObstacle(entry.layers);
    }
    this.regenTilesPreservingObstacles();
    while (this.findMatches().length > 0 || !this.hasAnyMove()) {
      this.regenTilesPreservingObstacles();
    }
  }

  private regenTilesPreservingObstacles(): void {
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (!isObstacle(this.cellAt({ x: c, y: r }))) {
          this.cells[r][c] = makeTile(this.randomColor());
        }
      }
    }
  }

  private randomColor(): number {
    return this.rng.randiRange(0, this.colorsCount - 1);
  }

  inBounds(pos: Pos): boolean {
    return pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height;
  }

  cellAt(pos: Pos): CellData {
    return this.cells[pos.y][pos.x];
  }

  isSwappable(pos: Pos): boolean {
    return this.inBounds(pos) && hasTile(this.cellAt(pos));
  }

  findMatches(): RunGroup[] {
    const runs: RunGroup[] = [];
    for (let r = 0; r < this.height; r++) runs.push(...this.scanLine(true, r));
    for (let c = 0; c < this.width; c++) runs.push(...this.scanLine(false, c));
    return this.mergeRuns(runs);
  }

  private scanLine(horizontal: boolean, index: number): RunGroup[] {
    const found: RunGroup[] = [];
    let run: Pos[] = [];
    const steps = horizontal ? this.width : this.height;
    const flush = () => {
      if (run.length >= 3) {
        found.push({ cells: [...run], color: this.cellAt(run[run.length - 1]).color });
      }
      run = [];
    };
    for (let i = 0; i < steps; i++) {
      const pos = horizontal ? { x: i, y: index } : { x: index, y: i };
      const cell = this.cellAt(pos);
      if (hasTile(cell)) {
        if (run.length > 0 && this.cellAt(run[run.length - 1]).color !== cell.color) flush();
        run.push(pos);
      } else {
        flush();
      }
    }
    flush();
    return found;
  }

  private mergeRuns(runs: RunGroup[]): RunGroup[] {
    const groups: RunGroup[] = [];
    const used = new Array(runs.length).fill(false);
    for (let i = 0; i < runs.length; i++) {
      if (used[i]) continue;
      const merged: RunGroup = { cells: [...runs[i].cells], color: runs[i].color };
      used[i] = true;
      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < runs.length; j++) {
          if (used[j] || runs[j].color !== merged.color) continue;
          const overlaps = runs[j].cells.some((p) => merged.cells.some((q) => q.x === p.x && q.y === p.y));
          if (overlaps) {
            for (const p of runs[j].cells) {
              if (!merged.cells.some((q) => q.x === p.x && q.y === p.y)) merged.cells.push(p);
            }
            used[j] = true;
            changed = true;
          }
        }
      }
      groups.push(merged);
    }
    return groups;
  }

  analyzeGroup(group: RunGroup, swapPos: Pos): {
    shape: "five" | "lt" | "four" | "three";
    spawnPos: Pos;
    spawnSpecial: Special;
  } {
    const cells = group.cells;
    const xs = cells.map((p) => p.x);
    const ys = cells.map((p) => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs) + 1;
    const spanY = Math.max(...ys) - Math.min(...ys) + 1;
    const count = cells.length;

    let anchor = cells.find((p) => p.x === swapPos.x && p.y === swapPos.y);
    if (!anchor) anchor = cells[this.rng.randiRange(0, count - 1)];

    if (spanX >= 5 || spanY >= 5) {
      return { shape: "five", spawnPos: anchor, spawnSpecial: Special.RAINBOW };
    }
    if (spanX >= 3 && spanY >= 3) {
      let intersect: Pos | undefined;
      for (const pos of cells) {
        const rowN = cells.filter((o) => o.y === pos.y).length;
        const colN = cells.filter((o) => o.x === pos.x).length;
        if (rowN >= 3 && colN >= 3) {
          intersect = pos;
          break;
        }
      }
      return { shape: "lt", spawnPos: intersect ?? anchor, spawnSpecial: Special.BOMB };
    }
    if (count === 4) {
      const kind = spanY === 1 ? Special.STRIPE_V : Special.STRIPE_H;
      return { shape: "four", spawnPos: anchor, spawnSpecial: kind };
    }
    return { shape: "three", spawnPos: { x: -9, y: -9 }, spawnSpecial: Special.NONE };
  }

  createsMatchAt(pos: Pos): boolean {
    const color = this.cellAt(pos).color;
    if (color === NO_COLOR) return false;
    let horiz = 1;
    for (const dir of [{ x: -1, y: 0 }, { x: 1, y: 0 }]) {
      let scan = { x: pos.x + dir.x, y: pos.y + dir.y };
      while (this.inBounds(scan) && hasTile(this.cellAt(scan)) && this.cellAt(scan).color === color) {
        horiz++;
        scan = { x: scan.x + dir.x, y: scan.y + dir.y };
      }
    }
    let vert = 1;
    for (const dir of [{ x: 0, y: -1 }, { x: 0, y: 1 }]) {
      let scan = { x: pos.x + dir.x, y: pos.y + dir.y };
      while (this.inBounds(scan) && hasTile(this.cellAt(scan)) && this.cellAt(scan).color === color) {
        vert++;
        scan = { x: scan.x + dir.x, y: scan.y + dir.y };
      }
    }
    return horiz >= 3 || vert >= 3;
  }

  firstPlayablePair(): Pos[] {
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const pos = { x: c, y: r };
        if (!this.isSwappable(pos)) continue;
        for (const dir of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
          const other = { x: pos.x + dir.x, y: pos.y + dir.y };
          if (!this.isSwappable(other)) continue;
          const sa = this.cellAt(pos).special;
          const sb = this.cellAt(other).special;
          const comboReady =
            (sa !== Special.NONE && sb !== Special.NONE) ||
            sa === Special.RAINBOW ||
            sb === Special.RAINBOW;
          if (comboReady) return [pos, other];
          this.swapData(pos, other);
          const ok = this.createsMatchAt(pos) || this.createsMatchAt(other);
          this.swapData(pos, other);
          if (ok) return [pos, other];
        }
      }
    }
    return [];
  }

  hasAnyMove(): boolean {
    return this.firstPlayablePair().length > 0;
  }

  findHint(): Pos[] {
    return this.firstPlayablePair();
  }

  randomNormalTilePos(): Pos {
    const candidates: Pos[] = [];
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const pos = { x: c, y: r };
        const cell = this.cellAt(pos);
        if (hasTile(cell) && cell.special === Special.NONE) candidates.push(pos);
      }
    }
    if (candidates.length === 0) return { x: -9, y: -9 };
    return candidates[this.rng.randiRange(0, candidates.length - 1)];
  }

  swapData(a: Pos, b: Pos): void {
    const tmp = this.cells[a.y][a.x];
    this.cells[a.y][a.x] = this.cells[b.y][b.x];
    this.cells[b.y][b.x] = tmp;
  }

  trySwap(a: Pos, b: Pos): { legal: boolean; events: BoardEvent[] } {
    if (!this.isSwappable(a) || !this.isSwappable(b)) return { legal: false, events: [] };
    if (manhattan(a, b) !== 1) return { legal: false, events: [] };

    const events: BoardEvent[] = [{ type: "swap", a, b }];
    const sa = this.cellAt(a).special;
    const sb = this.cellAt(b).special;

    if (sa !== Special.NONE && sb !== Special.NONE) {
      this.applyCombo(a, b, events);
      return { legal: true, events };
    }
    if (sa === Special.RAINBOW || sb === Special.RAINBOW) {
      this.applyRainbowSwap(a, b, events);
      return { legal: true, events };
    }

    this.swapData(a, b);
    let involves = false;
    for (const group of this.findMatches()) {
      const hitA = group.cells.some((p) => p.x === a.x && p.y === a.y);
      const hitB = group.cells.some((p) => p.x === b.x && p.y === b.y);
      if (hitA || hitB) {
        involves = true;
        break;
      }
    }
    if (!involves) {
      this.swapData(a, b);
      events.push({ type: "revert", a, b });
      return { legal: false, events };
    }

    this.runResolution(b, events);
    this.ensurePlayable(events);
    return { legal: true, events };
  }

  runResolution(firstAnchor: Pos, events: BoardEvent[]): void {
    let roundNo = 0;
    for (;;) {
      const groups = this.findMatches();
      if (groups.length === 0) break;
      roundNo++;
      const clearSet = new Map<string, Pos>();
      const key = (p: Pos) => `${p.x},${p.y}`;
      const spawns: SpawnInfo[] = [];
      const anchor = roundNo === 1 ? firstAnchor : { x: -9, y: -9 };
      for (const group of groups) {
        const info = this.analyzeGroup(group, anchor);
        for (const pos of group.cells) clearSet.set(key(pos), pos);
        if (info.shape !== "three") {
          spawns.push({
            pos: info.spawnPos,
            special: info.spawnSpecial,
            color: group.color,
          });
        }
      }
      this.expandSpecialEffects(clearSet);
      this.applyClearBatch(clearSet, spawns, roundNo, events);
      this.gravityAndRefill(events);
    }
  }

  private applyRainbowSwap(rainbowPosIn: Pos, otherIn: Pos, events: BoardEvent[]): void {
    let rainbowPos = rainbowPosIn;
    let otherPos = otherIn;
    if (this.cellAt(rainbowPos).special !== Special.RAINBOW) {
      [rainbowPos, otherPos] = [otherPos, rainbowPos];
    }
    const targetColor = this.cellAt(otherPos).color;
    const clearSet = new Map<string, Pos>([[`${rainbowPos.x},${rainbowPos.y}`, rainbowPos]]);
    this.cellAt(rainbowPos).special = Special.NONE;
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const pos = { x: c, y: r };
        if (
          !(pos.x === rainbowPos.x && pos.y === rainbowPos.y) &&
          hasTile(this.cellAt(pos)) &&
          this.cellAt(pos).color === targetColor
        ) {
          clearSet.set(`${c},${r}`, pos);
        }
      }
    }
    this.expandSpecialEffects(clearSet);
    this.applyClearBatch(clearSet, [], 1, events);
    this.gravityAndRefill(events);
  }

  private applyCombo(a: Pos, b: Pos, events: BoardEvent[]): void {
    const ca = this.cellAt(a);
    const cb = this.cellAt(b);
    const clearSet = new Map<string, Pos>();
    const spawns: SpawnInfo[] = [];
    const key = (p: Pos) => `${p.x},${p.y}`;

    if (ca.special === Special.RAINBOW && cb.special === Special.RAINBOW) {
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          if (hasTile(this.cellAt({ x: c, y: r }))) clearSet.set(`${c},${r}`, { x: c, y: r });
        }
      }
    } else if (ca.special === Special.RAINBOW || cb.special === Special.RAINBOW) {
      const rainbowPos = ca.special === Special.RAINBOW ? a : b;
      const otherPos = rainbowPos === a ? b : a;
      const targetColor = this.cellAt(otherPos).color;
      const kind = this.cellAt(otherPos).special;
      clearSet.set(key(rainbowPos), rainbowPos);
      clearSet.set(key(otherPos), otherPos);
      this.cellAt(rainbowPos).special = Special.NONE;
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          const pos = { x: c, y: r };
          const same = pos.x === rainbowPos.x && pos.y === rainbowPos.y;
          const same2 = pos.x === otherPos.x && pos.y === otherPos.y;
          if (!same && !same2 && hasTile(this.cellAt(pos)) && this.cellAt(pos).color === targetColor) {
            this.cellAt(pos).special = kind;
            spawns.push({ pos, special: kind, color: targetColor, converted: true });
          }
        }
      }
      this.expandFromConversions(spawns, clearSet);
    } else {
      const stripeKinds = [Special.STRIPE_H, Special.STRIPE_V];
      if (stripeKinds.includes(ca.special) && stripeKinds.includes(cb.special)) {
        for (let c = 0; c < this.width; c++) this.addEffectTarget(clearSet, { x: c, y: b.y });
        for (let r = 0; r < this.height; r++) this.addEffectTarget(clearSet, { x: b.x, y: r });
      } else {
        this.addBombArea(clearSet, b, 2);
      }
    }

    this.applyClearBatch(clearSet, spawns, 1, events);
    this.gravityAndRefill(events);
  }

  private expandFromConversions(spawns: SpawnInfo[], clearSet: Map<string, Pos>): void {
    if (spawns.length === 0) return;
    for (const s of spawns) clearSet.set(`${s.pos.x},${s.pos.y}`, s.pos);
    this.expandSpecialEffects(clearSet);
  }

  private effectQueue: Pos[] = [];

  expandSpecialEffects(clearSet: Map<string, Pos>): void {
    this.effectQueue = [];
    for (const pos of clearSet.values()) {
      if (hasTile(this.cellAt(pos)) && this.cellAt(pos).special !== Special.NONE) {
        this.effectQueue.push(pos);
      }
    }
    const processed = new Set<string>();
    while (this.effectQueue.length > 0) {
      const pos = this.effectQueue.shift()!;
      const k = `${pos.x},${pos.y}`;
      if (processed.has(k) || !this.inBounds(pos)) continue;
      processed.add(k);
      switch (this.cellAt(pos).special) {
        case Special.STRIPE_H:
          for (let c = 0; c < this.width; c++) this.addEffectTarget(clearSet, { x: c, y: pos.y });
          break;
        case Special.STRIPE_V:
          for (let r = 0; r < this.height; r++) this.addEffectTarget(clearSet, { x: pos.x, y: r });
          break;
        case Special.BOMB:
          this.addBombArea(clearSet, pos, 1);
          break;
        case Special.RAINBOW: {
          const dominant = this.dominantColorExcluding(pos);
          for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
              const p = { x: c, y: r };
              if (hasTile(this.cellAt(p)) && this.cellAt(p).color === dominant) {
                this.addEffectTarget(clearSet, p);
              }
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private addEffectTarget(clearSet: Map<string, Pos>, pos: Pos): void {
    if (!this.inBounds(pos)) return;
    const k = `${pos.x},${pos.y}`;
    const cell = this.cellAt(pos);
    if (isObstacle(cell)) {
      clearSet.set(k, pos);
    } else if (hasTile(cell)) {
      if (!clearSet.has(k)) clearSet.set(k, pos);
      if (cell.special !== Special.NONE) this.effectQueue.push(pos);
    }
  }

  private addBombArea(clearSet: Map<string, Pos>, center: Pos, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.addEffectTarget(clearSet, { x: center.x + dx, y: center.y + dy });
      }
    }
  }

  private dominantColorExcluding(skip: Pos): number {
    const counts = new Map<number, number>();
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const pos = { x: c, y: r };
        if (pos.x === skip.x && pos.y === skip.y) continue;
        const cell = this.cellAt(pos);
        if (hasTile(cell)) counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1);
      }
    }
    let best = 0;
    let bestN = -1;
    for (const [color, n] of counts.entries()) {
      if (n > bestN) {
        bestN = n;
        best = color;
      }
    }
    return best;
  }

  applyClearBatch(
    clearSet: Map<string, Pos>,
    spawns: SpawnInfo[],
    roundNo: number,
    events: BoardEvent[],
  ): void {
    const clearedInfo: ClearedCell[] = [];
    let tileCount = 0;
    let frostDestroyed = 0;
    for (const pos of clearSet.values()) {
      const cell = this.cellAt(pos);
      if (isObstacle(cell)) {
        cell.obstacleLayers -= 1;
        frostDestroyed += 1;
        if (cell.obstacleLayers <= 0) this.cells[pos.y][pos.x] = emptyCell();
        continue;
      }
      if (!hasTile(cell)) continue;
      tileCount += 1;
      clearedInfo.push({ pos, color: cell.color, special: cell.special });
      this.cells[pos.y][pos.x] = emptyCell();
    }
    for (const entry of spawns) {
      if (entry.converted) continue;
      const pos = entry.pos;
      if (this.inBounds(pos) && !isObstacle(this.cellAt(pos))) {
        this.cells[pos.y][pos.x] = makeTile(entry.color, entry.special);
      }
    }
    const points = tileCount * BASE_POINTS * roundNo;
    events.push({
      type: "cleared",
      cells: clearedInfo,
      spawns,
      round: roundNo,
      points,
      frost: frostDestroyed + this.damageFrostAround(clearedInfo),
    });
  }

  private damageFrostAround(clearedInfo: ClearedCell[]): number {
    let destroyed = 0;
    for (const entry of clearedInfo) {
      for (const dir of DIRS_ORTH) {
        const pos = { x: entry.pos.x + dir.x, y: entry.pos.y + dir.y };
        if (this.inBounds(pos) && isObstacle(this.cellAt(pos))) {
          this.cellAt(pos).obstacleLayers -= 1;
          destroyed += 1;
          if (this.cellAt(pos).obstacleLayers <= 0) this.cells[pos.y][pos.x] = emptyCell();
        }
      }
    }
    return destroyed;
  }

  gravityAndRefill(events: BoardEvent[]): void {
    const moves: { from: Pos; to: Pos }[] = [];
    const refills: { pos: Pos; color: number }[] = [];
    for (let c = 0; c < this.width; c++) {
      let writeY = this.height - 1;
      for (let r = this.height - 1; r >= 0; r--) {
        const pos = { x: c, y: r };
        const cell = this.cellAt(pos);
        if (isObstacle(cell)) {
          writeY = r - 1;
          continue;
        }
        if (hasTile(cell)) {
          if (writeY !== r) {
            this.cells[writeY][c] = cell;
            this.cells[r][c] = emptyCell();
            moves.push({ from: pos, to: { x: c, y: writeY } });
          }
          writeY -= 1;
        }
      }
      for (let r = writeY; r >= 0; r--) {
        const tile = makeTile(this.randomColor());
        this.cells[r][c] = tile;
        refills.push({ pos: { x: c, y: r }, color: tile.color });
      }
    }
    if (moves.length > 0 || refills.length > 0) {
      events.push({ type: "falls", moves, refills });
    }
  }

  shuffleBoard(): { pos: Pos; color: number; special: Special }[] {
    const positions: Pos[] = [];
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (this.isSwappable({ x: c, y: r })) positions.push({ x: c, y: r });
      }
    }
    for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS; attempt++) {
      const tiles = positions.map((p) => this.cellAt(p));
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = this.rng.randiRange(0, i);
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      positions.forEach((p, k) => (this.cells[p.y][p.x] = tiles[k]));
      if (this.hasAnyMove()) return this.snapshotPlacements(positions);
    }
    this.forcePlayableTransposition(positions);
    return this.snapshotPlacements(positions);
  }

  private snapshotPlacements(positions: Pos[]): { pos: Pos; color: number; special: Special }[] {
    return positions.map((pos) => {
      const cell = this.cellAt(pos);
      return { pos, color: cell.color, special: cell.special };
    });
  }

  private forcePlayableTransposition(positions: Pos[]): void {
    for (let i = 0; i < positions.length; i++) {
      for (let j = 0; j < positions.length; j++) {
        if (i === j) continue;
        const pa = positions[i];
        const pb = positions[j];
        this.swapData(pa, pb);
        if (this.createsMatchAt(pa) || this.createsMatchAt(pb)) return;
        this.swapData(pa, pb);
      }
    }
  }

  ensurePlayable(events: BoardEvent[]): void {
    if (!this.hasAnyMove()) {
      events.push({ type: "shuffle", placements: this.shuffleBoard() });
    }
  }
}
