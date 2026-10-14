import { describe, expect, it } from "vitest";
import { Match3Board } from "../src/game/board";
import { GameSession } from "../src/game/session";
import { LevelData } from "../src/game/levels";
import { Pos } from "../src/game/cells";
import { readdirSync } from "node:fs";
import path from "node:path";

const LEVELS_DIR = path.join(__dirname, "..", "src", "game", "levels-data");
const TOTAL_LEVELS = 30;
const INTRO_BOUNDARIES: [number, number][] = [[4, 3], [7, 6], [10, 9]];
const SIM_SEEDS = 6;

function loadAll(): LevelData[] {
  const names = readdirSync(LEVELS_DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
  return names
    .map((name) => LevelData.fromDict(JSON.parse(readFileSync2(name)), name))
    .sort((a, b) => a.id - b.id);
}

function readFileSync2(name: string): string {
  // eslint 风格说明：node 同步读取在测试环境无碍
  return require("node:fs").readFileSync(path.join(LEVELS_DIR, name), "utf-8");
}

function avgMovesPerGoal(level: LevelData): number {
  return level.moves / Math.max(1, level.goals.length);
}

/** 目标感知贪心机器人：优先收集目标色 / 造特殊，否则取最大游程收益 */
function greedyFindMove(session: GameSession): [Pos, Pos] | null {
  const board = session.board;
  const wantColors = new Set<number>();
  for (const goal of session.goalSnapshots()) {
    if (goal.type === "collect" && !goal.done) wantColors.add(goal.color);
  }
  let bestGain = 0;
  let best: [Pos, Pos] | null = null;
  for (let r = 0; r < board.height; r++) {
    for (let c = 0; c < board.width; c++) {
      const pos = { x: c, y: r };
      if (!board.isSwappable(pos)) continue;
      for (const dir of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const other = { x: pos.x + dir.x, y: pos.y + dir.y };
        if (!board.isSwappable(other)) continue;
        const sa = board.cellAt(pos).special;
        const sb = board.cellAt(other).special;
        if (
          (sa !== 0 && sb !== 0) ||
          sa === 4 ||
          sb === 4
        ) {
          return [pos, other];
        }
        const gain = estimateMove(board, pos, other, wantColors);
        if (gain > bestGain) {
          bestGain = gain;
          best = [pos, other];
        }
      }
    }
  }
  return best;
}

function runLenThrough(board: Match3Board, anchor: Pos): number {
  const color = board.cellAt(anchor).color;
  const walk = (dx: number, dy: number): number => {
    let n = 0;
    let s = { x: anchor.x + dx, y: anchor.y + dy };
    while (board.inBounds(s) && board.cellAt(s).color >= 0 && board.cellAt(s).color === color) {
      n++;
      s = { x: s.x + dx, y: s.y + dy };
    }
    return n;
  };
  const horiz = walk(-1, 0) + walk(1, 0) + 1;
  if (horiz >= 3) return horiz;
  const vert = walk(0, -1) + walk(0, 1) + 1;
  if (vert >= 3) return vert;
  return 0;
}

function estimateMove(
  board: Match3Board,
  pos: Pos,
  other: Pos,
  wantColors: Set<number>,
): number {
  board.swapData(pos, other);
  let gain = 0;
  for (const anchor of [pos, other]) {
    const len = runLenThrough(board, anchor);
    if (len >= 3) {
      gain += len * 0.1;
      if (len >= 4) gain += 2;
      if (wantColors.has(board.cellAt(anchor).color)) gain += 3 * len;
      break;
    }
  }
  board.swapData(pos, other);
  return gain;
}

function simulate(level: LevelData, seed: number): boolean {
  const session = new GameSession(level);
  session.start(seed);
  let swaps = 0;
  while (!session.finished && swaps < level.moves * 2) {
    const move = greedyFindMove(session);
    if (!move) break;
    const result = session.playerSwap(move[0], move[1]);
    if (!result.legal) break;
    swaps++;
  }
  return session.won;
}

function winRate(level: LevelData): number {
  let wins = 0;
  for (let i = 0; i < SIM_SEEDS; i++) {
    if (simulate(level, 1000 + i * 37)) wins++;
  }
  return wins / SIM_SEEDS;
}

describe("关卡数据", () => {
  it(`加载 ${TOTAL_LEVELS} 关且校验零错误`, () => {
    const levels = loadAll();
    expect(levels).toHaveLength(TOTAL_LEVELS);
    const ids = levels.map((l) => l.id);
    for (let i = 1; i <= TOTAL_LEVELS; i++) expect(ids).toContain(i);
    for (const level of levels) expect(level.validate()).toEqual([]);
  });

  it("新机制引入关步数富余 ≥ 前关 1.3 倍", () => {
    const byId = new Map(loadAll().map((l) => [l.id, l]));
    for (const [introId, prevId] of INTRO_BOUNDARIES) {
      const introAvg = avgMovesPerGoal(byId.get(introId)!);
      const prevAvg = avgMovesPerGoal(byId.get(prevId)!);
      expect(introAvg).toBeGreaterThanOrEqual(prevAvg * 1.3);
    }
  });

  it("后期关混合机制与障碍", () => {
    for (const level of loadAll()) {
      if (level.id < 10) continue;
      const kinds = level.features.filter((f) => ["stripe", "bomb", "rainbow"].includes(f));
      expect(kinds.length).toBeGreaterThanOrEqual(2);
      expect(level.obstacles.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("教学 bracket 为纯基础", () => {
    for (const level of loadAll()) {
      if (![1, 2, 3].includes(level.id)) continue;
      expect(level.features).toEqual(["basic"]);
      expect(level.goals).toHaveLength(1);
    }
  });

  it("清冰目标必须有冰且计数一致", () => {
    for (const level of loadAll()) {
      for (const goal of level.goals) {
        if (goal.type !== "frost") continue;
        expect(level.obstacles.length).toBeGreaterThan(0);
        expect(goal.count ?? goal.target ?? -1).toBe(level.totalFrostLayers());
      }
    }
  });
});

describe("模拟器平衡门禁", () => {
  it(`前期胜率≥70%、后期≥55%（种子 ${SIM_SEEDS}）`, () => {
    for (const level of loadAll()) {
      const rate = winRate(level);
      const floor = level.id <= 15 ? 0.7 : 0.55;
      if (rate < floor) {
        throw new Error(`关卡 ${level.id} 贪心仿真胜率 ${rate.toFixed(2)} 应 ≥ ${floor}`);
      }
    }
  }, 240000);
});
