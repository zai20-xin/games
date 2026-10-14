import { Rng, fnv1a } from "./rng";
import type { Puzzle } from "./solver";
import { countSolutions, gradeSolve, growRegions, placeSolution } from "./solver";

const MAX_REGION_RETRIES = 50;

/** 生成一道通过全部门禁的谜题（唯一解 + 人类可解 ≤L3） */
export function generate(n: number, seed: number): Puzzle {
  const rng = new Rng(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const solution = placeSolution(n, rng);
    let regions: number[] | null = null;
    for (let i = 0; i < MAX_REGION_RETRIES && regions === null; i++) {
      regions = growRegions(n, solution, rng);
    }
    if (regions === null) continue;

    // 删提示：从全解提示出发，随机顺序尝试移除，破坏唯一解或升到 L4 即回填
    const clues = new Set<number>(solution.map((c, r) => r * n + c));
    let level = 1;
    for (const cell of rng.shuffled([...clues])) {
      clues.delete(cell);
      const count = countSolutions(n, regions, [...clues], 2);
      const grade = count === 1 ? gradeSolve(n, regions, [...clues]) : null;
      if (count !== 1 || grade === null || !grade.solved) {
        clues.add(cell);
      } else {
        level = grade.maxLevel;
      }
    }

    return {
      n,
      regions,
      clues: [...clues].sort((a, b) => a - b),
      solution,
      seed,
      dateStr: "",
      level,
    };
  }
  throw new Error(`generate: n=${n} seed=${seed} 200 次尝试均未收敛`);
}

/** 星期 → 尺寸爬坡：周一 6 / 二三 7 / 四五 8 / 六日 9 */
export function sizeForDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=周日
  return [9, 6, 7, 7, 8, 8, 9][weekday];
}

export function dateSeed(dateStr: string): number {
  return fnv1a("queens-" + dateStr);
}

export function generateDaily(dateStr: string): Puzzle {
  const puzzle = generate(sizeForDate(dateStr), dateSeed(dateStr));
  puzzle.dateStr = dateStr;
  return puzzle;
}
