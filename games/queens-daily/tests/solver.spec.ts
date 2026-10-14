import { describe, expect, it } from "vitest";
import { countSolutions, gradeSolve, growRegions, placeSolution } from "../src/engine/solver";
import { Rng } from "../src/engine/rng";

/** 手工构造 6×6：解在主对角线附近，色区为 6 个 2×3 横条，每区恰一枚 */
function fixture6() {
  const n = 6;
  const solution = [0, 2, 4, 1, 3, 5];
  // 检查相邻：行差 1 时列差需 ≥2
  for (let r = 1; r < n; r++) {
    if (Math.abs(solution[r] - solution[r - 1]) <= 1) {
      throw new Error("fixture 相邻冲突");
    }
  }
  const regions: number[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      regions.push(Math.floor(c / 1) * 1 === c ? Math.floor(r / 1) : 0);
    }
  }
  // 简单分区：每行一个区（列全行）→ 每区 6 格含一枚解 ✓ 连通 ✓
  const regionsByRow: number[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) regionsByRow.push(r);
  }
  return { n, solution, regions: regionsByRow };
}

describe("countSolutions", () => {
  it("完整提示 → 恰 1 解", () => {
    const { n, solution, regions } = fixture6();
    const clues = solution.map((c, r) => r * n + c);
    expect(countSolutions(n, regions, clues, 2)).toBe(1);
  });

  it("无提示 → 多解（达到 cap 即止）", () => {
    const { n, regions } = fixture6();
    expect(countSolutions(n, regions, [], 2)).toBe(2);
  });

  it("非法提示（同列两枚）→ 0 解", () => {
    const { n, regions } = fixture6();
    const clues = [0 * n + 0, 1 * n + 0];
    expect(countSolutions(n, regions, clues, 2)).toBe(0);
  });
});

describe("gradeSolve", () => {
  it("完整提示 → L1 直接解出", () => {
    const { n, solution, regions } = fixture6();
    const clues = solution.map((c, r) => r * n + c);
    const grade = gradeSolve(n, regions, clues);
    expect(grade.solved).toBe(true);
    expect(grade.maxLevel).toBe(1);
  });

  it("空提示 → 需要 L4（人类不可解）", () => {
    const { n, regions } = fixture6();
    const grade = gradeSolve(n, regions, []);
    expect(grade.solved).toBe(false);
    expect(grade.maxLevel).toBe(4);
  });
});

describe("placeSolution / growRegions", () => {
  it("解满足行列唯一且不相邻", () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const n of [6, 7, 8, 9]) {
        const solution = placeSolution(n, new Rng(seed * 100 + n));
        expect(new Set(solution).size).toBe(n);
        for (let r = 1; r < n; r++) {
          expect(Math.abs(solution[r] - solution[r - 1])).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("色区连通且每区恰一枚解皇后", () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const n of [6, 8, 9]) {
        const solution = placeSolution(n, new Rng(seed * 77 + n));
        const regions = growRegions(n, solution, new Rng(seed * 31 + n));
        if (regions === null) continue;
        // 每区恰一解
        const counts = new Array(n).fill(0);
        for (let r = 0; r < n; r++) counts[regions[r * n + solution[r]]]++;
        expect(counts.every((v) => v === 1)).toBe(true);
        // 连通性：同色格 BFS 可达同色格数量 == 该色面积
        const sizes = new Array(n).fill(0);
        for (const k of regions) sizes[k]++;
        const seen = new Uint8Array(n * n);
        const start = 0;
        const queue = [start];
        seen[start] = 1;
        let visited = 0;
        while (queue.length > 0) {
          const cell = queue.pop()!;
          visited++;
          const r = Math.floor(cell / n);
          const c = cell % n;
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
            const idx = nr * n + nc;
            if (!seen[idx] && regions[idx] === regions[cell]) {
              seen[idx] = 1;
              queue.push(idx);
            }
          }
        }
        expect(visited).toBe(sizes[regions[start]]);
      }
    }
  });
});
