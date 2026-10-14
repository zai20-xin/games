import { Rng } from "./rng";

export interface Puzzle {
  n: number;
  /** regionOf[r*n+c] = 色区 id (0..n-1) */
  regions: number[];
  /** 提示格：解皇后所在 cell 下标 r*n+c */
  clues: number[];
  /** 唯一解：solution[row] = col */
  solution: number[];
  seed: number;
  dateStr: string;
  /** 难度级 1..3（求解最高技巧） */
  level: number;
}

export interface GradeResult {
  /** 是否仅凭人类技巧（≤L3）解出 */
  solved: boolean;
  /** 使用过的最高技巧级：1 单元唯一 / 2 区域-行列交叉排除 / 3 试位反证 / 4 需要猜测 */
  maxLevel: 1 | 2 | 3 | 4;
}

const NEIGHBORS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

/** 摆放一枚皇后后需要从候选中剔除的格子（同行/列/区/相邻，含自身） */
export function eliminationSet(
  n: number,
  regions: number[],
  r: number,
  c: number,
  out: Set<number>,
): void {
  for (let i = 0; i < n; i++) {
    out.add(r * n + i);
    out.add(i * n + c);
  }
  const k = regions[r * n + c];
  for (let i = 0; i < n * n; i++) {
    if (regions[i] === k) out.add(i);
  }
  for (const [dr, dc] of NEIGHBORS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < n && nc >= 0 && nc < n) out.add(nr * n + nc);
  }
}

/** 纯回溯解计数（达到 cap 即止，用于唯一性判定） */
export function countSolutions(n: number, regions: number[], clues: number[], cap = 2): number {
  const colUsed = new Array(n).fill(false);
  const regionUsed = new Array(n).fill(false);
  const blocked = new Uint8Array(n * n);
  const rowQueens: number[] = [];
  const clueRows = new Array(n).fill(false);
  let count = 0;

  const applyElimination = (r: number, c: number, removed: number[]): void => {
    const tmp = new Set<number>();
    eliminationSet(n, regions, r, c, tmp);
    for (const cell of tmp) {
      if (!blocked[cell]) {
        blocked[cell] = 1;
        removed.push(cell);
      }
    }
  };

  // 预置提示
  for (const clue of clues) {
    const r = Math.floor(clue / n);
    const c = clue % n;
    if (colUsed[c] || regionUsed[regions[clue]] || blocked[clue]) return 0;
    colUsed[c] = true;
    regionUsed[regions[clue]] = true;
    rowQueens.push(c);
    clueRows[r] = true;
    applyElimination(r, c, []);
  }

  const dfs = (r: number): void => {
    if (count >= cap) return;
    if (clueRows[r]) {
      dfs(r + 1);
      return;
    }
    if (r === n) {
      count++;
      return;
    }
    for (let c = 0; c < n; c++) {
      const cell = r * n + c;
      if (colUsed[c] || regionUsed[regions[cell]] || blocked[cell]) continue;
      const removed: number[] = [];
      applyElimination(r, c, removed);
      colUsed[c] = true;
      regionUsed[regions[cell]] = true;
      rowQueens.push(c);
      dfs(r + 1);
      rowQueens.pop();
      colUsed[c] = false;
      regionUsed[regions[cell]] = false;
      for (const cell2 of removed) blocked[cell2] = 0;
      if (count >= cap) return;
    }
  };
  dfs(0);
  return count;
}

interface State {
  cand: Uint8Array;
}

function cloneState(s: State): State {
  return { cand: s.cand.slice() };
}

function unitCounts(n: number, regions: number[], s: State) {
  const rowCount = new Array(n).fill(0);
  const colCount = new Array(n).fill(0);
  const regionCount = new Array(n).fill(0);
  const rowRegion = new Array(n).fill(-1);
  const colRegion = new Array(n).fill(-1);
  const regionRow = new Array(n).fill(-1);
  const regionCol = new Array(n).fill(-1);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!s.cand[r * n + c]) continue;
      rowCount[r]++;
      colCount[c]++;
      const k = regions[r * n + c];
      regionCount[k]++;
      if (rowRegion[r] === -1) rowRegion[r] = k;
      else if (rowRegion[r] !== k) rowRegion[r] = -2;
      if (colRegion[c] === -1) colRegion[c] = k;
      else if (colRegion[c] !== k) colRegion[c] = -2;
      if (regionRow[k] === -1) regionRow[k] = r;
      else if (regionRow[k] !== r) regionRow[k] = -2;
      if (regionCol[k] === -1) regionCol[k] = c;
      else if (regionCol[k] !== c) regionCol[k] = -2;
    }
  }
  return { rowCount, colCount, regionCount, rowRegion, colRegion, regionRow, regionCol };
}

function isContradiction(n: number, regions: number[], s: State): boolean {
  const { rowCount, colCount, regionCount } = unitCounts(n, regions, s);
  return (
    rowCount.some((v) => v === 0) ||
    colCount.some((v) => v === 0) ||
    regionCount.some((v) => v === 0)
  );
}

function isSolved(n: number, regions: number[], s: State): boolean {
  const { rowCount, colCount, regionCount } = unitCounts(n, regions, s);
  if (!rowCount.every((v) => v === 1)) return false;
  if (!colCount.every((v) => v === 1)) return false;
  if (!regionCount.every((v) => v === 1)) return false;
  // 相邻校验：候选唯一化后仍可能存在相邻对（纯删除路径）
  const queens: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (s.cand[r * n + c]) queens.push([r, c]);
    }
  }
  for (let i = 0; i < queens.length; i++) {
    for (let j = i + 1; j < queens.length; j++) {
      if (
        Math.abs(queens[i][0] - queens[j][0]) <= 1 &&
        Math.abs(queens[i][1] - queens[j][1]) <= 1
      )
        return false;
    }
  }
  return true;
}

/** L1：行/列/区唯一候选 → 放置并剔除。返回是否发生变化，矛盾返回 null */
function propagateL1(n: number, regions: number[], s: State): boolean | null {
  let changed = false;
  for (;;) {
    if (isContradiction(n, regions, s)) return null;
    const { rowCount, colCount, regionCount } = unitCounts(n, regions, s);
    let acted = false;
    const place = (r: number, c: number): boolean => {
      const tmp = new Set<number>();
      eliminationSet(n, regions, r, c, tmp);
      tmp.delete(r * n + c);
      let anyChanged = false;
      for (const cell of tmp) {
        if (s.cand[cell]) {
          s.cand[cell] = 0;
          changed = true;
          anyChanged = true;
        }
      }
      return anyChanged;
    };
    for (let r = 0; r < n; r++) {
      if (rowCount[r] === 1) {
        for (let c = 0; c < n; c++) {
          if (s.cand[r * n + c] && place(r, c)) acted = true;
        }
      }
    }
    for (let c = 0; c < n; c++) {
      if (colCount[c] === 1) {
        for (let r = 0; r < n; r++) {
          if (s.cand[r * n + c] && place(r, c)) acted = true;
        }
      }
    }
    for (let k = 0; k < n; k++) {
      if (regionCount[k] === 1) {
        for (let i = 0; i < n * n; i++) {
          if (regions[i] === k && s.cand[i] && place(Math.floor(i / n), i % n)) acted = true;
        }
      }
    }
    if (!acted) return changed;
  }
}

/** L2：区域-行列交叉排除。返回是否发生变化 */
function propagateL2(n: number, regions: number[], s: State): boolean {
  let changed = false;
  const { rowRegion, colRegion, regionRow, regionCol } = unitCounts(n, regions, s);
  const remove = (i: number) => {
    if (s.cand[i]) {
      s.cand[i] = 0;
      changed = true;
    }
  };
  for (let r = 0; r < n; r++) {
    const k = rowRegion[r];
    if (k >= 0) {
      for (let i = 0; i < n * n; i++) {
        if (regions[i] === k && Math.floor(i / n) !== r) remove(i);
      }
    }
  }
  for (let c = 0; c < n; c++) {
    const k = colRegion[c];
    if (k >= 0) {
      for (let i = 0; i < n * n; i++) {
        if (regions[i] === k && i % n !== c) remove(i);
      }
    }
  }
  for (let k = 0; k < n; k++) {
    if (regionRow[k] >= 0) {
      const r = regionRow[k];
      for (let c = 0; c < n; c++) {
        if (regions[r * n + c] !== k) remove(r * n + c);
      }
    }
    if (regionCol[k] >= 0) {
      const c = regionCol[k];
      for (let r = 0; r < n; r++) {
        if (regions[r * n + c] !== k) remove(r * n + c);
      }
    }
  }
  return changed;
}

/** 传播至不动点；矛盾返回 null */
function propagate(n: number, regions: number[], s: State, useL2: boolean): boolean | null {
  for (;;) {
    const r1 = propagateL1(n, regions, s);
    if (r1 === null) return null;
    const r2 = useL2 ? propagateL2(n, regions, s) : false;
    if (!r1 && !r2) return true;
  }
}

/** L3：试位反证——假设某候选为真，传播后矛盾则删除该候选 */
function trialEliminate(n: number, regions: number[], s: State): boolean {
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = r * n + c;
      if (!s.cand[cell]) continue;
      const trial = cloneState(s);
      const tmp = new Set<number>();
      eliminationSet(n, regions, r, c, tmp);
      tmp.delete(cell);
      for (const t of tmp) trial.cand[t] = 0;
      if (propagate(n, regions, trial, true) === null) {
        s.cand[cell] = 0;
        return true;
      }
    }
  }
  return false;
}

/**
 * 人类技巧分级求解：L1 单元唯一 → L2 交叉排除 → L3 试位反证。
 * 不使用回溯；需要猜测时返回 solved=false / maxLevel=4。
 */
export function gradeSolve(n: number, regions: number[], clues: number[]): GradeResult {
  const state: State = { cand: new Uint8Array(n * n).fill(1) };
  for (const clue of clues) {
    const r = Math.floor(clue / n);
    const c = clue % n;
    state.cand[r * n + c] = 1;
    const tmp = new Set<number>();
    eliminationSet(n, regions, r, c, tmp);
    tmp.delete(clue);
    for (const t of tmp) state.cand[t] = 0;
  }
  if (propagate(n, regions, state, false) === null) return { solved: false, maxLevel: 4 };

  let maxLevel: 1 | 2 | 3 = 1;
  for (;;) {
    if (isSolved(n, regions, state)) return { solved: true, maxLevel };
    if (propagateL2(n, regions, state)) {
      maxLevel = maxLevel < 2 ? 2 : maxLevel;
      if (propagate(n, regions, state, false) === null) return { solved: false, maxLevel: 4 };
      continue;
    }
    if (trialEliminate(n, regions, state)) {
      maxLevel = 3;
      if (propagate(n, regions, state, false) === null) return { solved: false, maxLevel: 4 };
      continue;
    }
    return { solved: false, maxLevel: 4 };
  }
}

/** 摆放随机合法解（行列唯一 + 上下两行内不相邻），回溯收敛 */
export function placeSolution(n: number, rng: Rng): number[] {
  const solution: number[] = [];
  const colUsed = new Array(n).fill(false);
  const dfs = (r: number): boolean => {
    if (r === n) return true;
    for (const c of rng.shuffled(Array.from({ length: n }, (_, i) => i))) {
      if (colUsed[c]) continue;
      if (r > 0 && Math.abs(solution[r - 1] - c) <= 1) continue;
      solution.push(c);
      colUsed[c] = true;
      if (dfs(r + 1)) return true;
      solution.pop();
      colUsed[c] = false;
    }
    return false;
  };
  if (!dfs(0)) throw new Error("placeSolution: 无解（不应发生）");
  return solution;
}

/** 多源 BFS 随机生长连通色区，每区恰含一枚解皇后 */
export function growRegions(n: number, solution: number[], rng: Rng): number[] | null {
  const regions = new Array(n * n).fill(-1);
  const frontiers: number[][] = [];
  const sizes = new Array(n).fill(1);
  for (let k = 0; k < n; k++) {
    const cell = k * n + solution[k];
    regions[cell] = k;
    frontiers.push([cell]);
  }
  let unassigned = n * n - n;
  const maxSize = Math.ceil(1.6 * n);

  while (unassigned > 0) {
    let progressed = false;
    for (const k of rng.shuffled(Array.from({ length: n }, (_, i) => i))) {
      if (sizes[k] >= maxSize) continue;
      const order = rng.shuffled(frontiers[k]);
      let grown: number | null = null;
      for (const cell of order) {
        const r = Math.floor(cell / n);
        const c = cell % n;
        const neighbors: number[] = [];
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr * n + nc] === -1) {
            neighbors.push(nr * n + nc);
          }
        }
        if (neighbors.length > 0) {
          grown = neighbors[rng.randiRange(0, neighbors.length - 1)];
          break;
        }
      }
      if (grown === null) continue;
      regions[grown] = k;
      sizes[k] += 1;
      frontiers[k].push(grown);
      unassigned -= 1;
      progressed = true;
    }
    if (!progressed) return null;
  }
  return regions;
}
