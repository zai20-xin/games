import { eliminationSet } from "../engine/solver";

/** 冲突类型：行/列/色区重复 或 相邻（含斜向） */
export type ConflictType = "row" | "col" | "region" | "adj";

const TYPE_LABEL: Record<ConflictType, string> = {
  row: "行",
  col: "列",
  region: "区",
  adj: "邻",
};

/**
 * 返回每个处于冲突中的格子及其违反的约束集合。
 * 纯函数，便于单测；不依赖 DOM。
 */
export function conflictReasons(
  n: number,
  regions: number[],
  marks: Uint8Array,
): Map<number, Set<ConflictType>> {
  const queens: number[] = [];
  for (let i = 0; i < n * n; i++) if (marks[i] === 1) queens.push(i);

  const map = new Map<number, Set<ConflictType>>();
  const add = (i: number, t: ConflictType): void => {
    let set = map.get(i);
    if (!set) {
      set = new Set();
      map.set(i, set);
    }
    set.add(t);
  };

  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      const ra = Math.floor(queens[a] / n);
      const ca = queens[a] % n;
      const rb = Math.floor(queens[b] / n);
      const cb = queens[b] % n;
      const sameRegion = regions[queens[a]] === regions[queens[b]];
      const adjacent = Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1;
      if (ra === rb) {
        add(queens[a], "row");
        add(queens[b], "row");
      }
      if (ca === cb) {
        add(queens[a], "col");
        add(queens[b], "col");
      }
      if (sameRegion) {
        add(queens[a], "region");
        add(queens[b], "region");
      }
      if (adjacent) {
        add(queens[a], "adj");
        add(queens[b], "adj");
      }
    }
  }
  return map;
}

/** 把冲突类型集合转成人类可读短串，如「行/邻」 */
export function reasonText(types: Set<ConflictType>): string {
  return [...types].map((t) => TYPE_LABEL[t]).join("/");
}

/**
 * 消除法提示：基于已放置皇后推导一枚「当前可安全放置」的格子及其人类可读理由。
 * 仅使用 L1 人类技巧（行列/色区占用 + 相邻排除 + 单元唯一计数），
 * 不泄露仅靠搜索才能得出的信息，且绝不修改 marks。
 * 无任何安全格时返回 null（玩家大概率已存在冲突，应先消除）。
 */
export function computeHint(
  n: number,
  regions: number[],
  marks: Uint8Array,
): { cell: number; reason: string } | null {
  const blocked = new Set<number>();
  for (let i = 0; i < n * n; i++) {
    if (marks[i] === 1) {
      eliminationSet(n, regions, Math.floor(i / n), i % n, blocked);
    }
  }

  const candidates: number[] = [];
  for (let i = 0; i < n * n; i++) {
    if (marks[i] === 0 && !blocked.has(i)) candidates.push(i);
  }
  if (candidates.length === 0) return null;

  // 单元唯一计数，挑「最被迫」的格子（行内候选最少优先，其次色区）
  const rowCount = new Array(n).fill(0);
  const regionCount = new Array(n).fill(0);
  for (const c of candidates) {
    rowCount[Math.floor(c / n)]++;
    regionCount[regions[c]]++;
  }

  let pick = candidates[0];
  let best = Infinity;
  for (const c of candidates) {
    const score = rowCount[Math.floor(c / n)] * 4 + regionCount[regions[c]];
    if (score < best) {
      best = score;
      pick = c;
    }
  }

  const r = Math.floor(pick / n);
  let reason: string;
  if (rowCount[r] === 1) {
    reason = `第 ${r + 1} 行仅此格可放皇后`;
  } else if (regionCount[regions[pick]] === 1) {
    reason = `第 ${regions[pick] + 1} 色区仅剩此格可放`;
  } else {
    reason = `此处放置不与任何已放皇后冲突（行列/色区/相邻均空闲）`;
  }
  return { cell: pick, reason };
}
