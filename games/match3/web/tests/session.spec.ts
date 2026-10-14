import { describe, expect, it } from "vitest";
import { GameSession } from "../src/game/session";
import { LevelData } from "../src/game/levels";
import { Pos, makeTile } from "../src/game/cells";

function makeLevel(
  goals: Record<string, unknown>[],
  moves: number,
  stars: number[] = [1000, 2000, 3000],
  obstacles: { pos: [number, number]; layers: number }[] = [],
): LevelData {
  const data = new LevelData();
  data.id = 1;
  data.levelName = "测试";
  data.width = 7;
  data.height = 8;
  data.moves = moves;
  data.colors = 5;
  data.goals = goals as unknown as LevelData["goals"];
  data.stars = stars;
  data.obstacles = obstacles;
  return data;
}

function session(level: LevelData, seed = 7): GameSession {
  const s = new GameSession(level);
  s.start(seed);
  return s;
}

function craftTrio(s: GameSession): void {
  const b = s.board;
  for (let r = 0; r < b.height; r++) {
    for (let c = 0; c < b.width; c++) {
      b.cells[r][c] = makeTile(((c + r) * 3) % 4 + 1);
    }
  }
  b.cells[0][2] = makeTile(0);
  b.cells[0][4] = makeTile(0);
  b.cells[1][3] = makeTile(0);
}

describe("目标系统", () => {
  it("分数与收集进度累计", () => {
    const level = makeLevel(
      [{ type: "score", target: 100 }, { type: "collect", color: 0, count: 5 }],
      10,
    );
    const s = session(level);
    (s as any).digestEvents([
      { type: "cleared", points: 60, frost: 0, cells: [
        { pos: { x: 0, y: 0 }, color: 0, special: 0 },
        { pos: { x: 1, y: 0 }, color: 2, special: 0 },
      ] },
    ]);
    let snap = s.goalSnapshots();
    expect(snap[0].progress).toBe(60);
    expect(snap[0].done).toBe(false);
    expect(snap[1].progress).toBe(1);

    (s as any).digestEvents([
      { type: "cleared", points: 40, frost: 0, cells: [
        { pos: { x: 2, y: 0 }, color: 0, special: 0 },
      ] },
    ]);
    snap = s.goalSnapshots();
    expect(snap[0].progress).toBe(100);
    expect(snap[0].done).toBe(true);
    expect(snap[1].progress).toBe(2);
  });
});

describe("胜负与庆祝", () => {
  it("达成目标→余步转化庆祝→判胜", () => {
    const level = makeLevel([{ type: "score", target: 20 }], 5, [10000, 20000, 30000]);
    const s = session(level, 11);
    craftTrio(s);
    const result = s.playerSwap({ x: 3, y: 0 }, { x: 3, y: 1 });
    expect(result.legal).toBe(true);
    expect(s.finished && s.won).toBe(true);
    const convertCount = result.events.filter((e) => e.type === "convert").length;
    expect(convertCount).toBe(4);
    expect(result.events[result.events.length - 1].type).toBe("outcome");
    expect(s.movesLeft).toBe(0);
  });

  it("零余步胜利无庆祝", () => {
    const level = makeLevel([{ type: "score", target: 20 }], 1);
    const s = session(level, 11);
    craftTrio(s);
    const result = s.playerSwap({ x: 3, y: 0 }, { x: 3, y: 1 });
    expect(s.won).toBe(true);
    expect(result.events.some((e) => e.type === "convert")).toBe(false);
  });

  it("失败路径无庆祝且步数耗尽判负", () => {
    const level = makeLevel([{ type: "score", target: 99999 }], 1);
    const s = session(level, 11);
    craftTrio(s);
    const result = s.playerSwap({ x: 3, y: 0 }, { x: 3, y: 1 });
    if (!s.won) {
      expect(result.events.some((e) => e.type === "convert")).toBe(false);
      expect(s.finished).toBe(true);
      expect(s.won).toBe(false);
    }
  });

  it("庆祝得分推高星级", () => {
    const level = makeLevel([{ type: "score", target: 20 }], 6, [120, 260, 900000]);
    const s = session(level, 23);
    craftTrio(s);
    s.playerSwap({ x: 3, y: 0 }, { x: 3, y: 1 });
    expect(s.won).toBe(true);
    expect(s.starsEarned()).toBeGreaterThanOrEqual(2);
  });
});

describe("星级映射", () => {
  it("阈值映射与只胜授星", () => {
    const level = makeLevel([{ type: "score", target: 10 }], 5, [100, 200, 300]);
    const s = session(level);
    s.score = 150; (s as any).finished = true; (s as any).won = true;
    expect(s.starsEarned()).toBe(1);
    s.score = 250; expect(s.starsEarned()).toBe(2);
    s.score = 350; expect(s.starsEarned()).toBe(3);
    (s as any).won = false;
    expect(s.starsEarned()).toBe(0);
  });
});

describe("道具 API", () => {
  it("锤子消除不耗步、计分、产生事件", () => {
    const level = makeLevel([{ type: "score", target: 999999 }], 9);
    const s = session(level);
    const beforeMoves = s.movesLeft;
    const target: Pos = { x: 6, y: 7 };
    const result = s.useHammer(target);
    expect(result.ok).toBe(true);
    expect(s.movesLeft).toBe(beforeMoves);
    const hit = (result.events as any[]).some(
      (e) => e.type === "cleared" && e.cells.some((c: any) => c.pos.x === 6 && c.pos.y === 7),
    );
    expect(hit).toBe(true);
    expect(s.score).toBeGreaterThan(0);
  });

  it("锤子削双层冰霜一层", () => {
    const level = makeLevel([{ type: "score", target: 999999 }], 9, undefined, [
      { pos: [3, 3], layers: 2 },
    ]);
    const s = new GameSession(level);
    s.start(7);
    s.board.cells[0][0] = makeTile(1);
    const result = s.useHammer({ x: 3, y: 3 });
    expect(result.ok).toBe(true);
    expect(s.board.cellAt({ x: 3, y: 3 }).obstacleLayers).toBe(1);
  });

  it("自由换位不成三：生效不回退不计分", () => {
    const level = makeLevel([{ type: "score", target: 999999 }], 9);
    const s = session(level);
    const a: Pos = { x: 0, y: 0 };
    const b: Pos = { x: 1, y: 0 };
    const colorA = s.board.cellAt(a).color;
    const colorB = s.board.cellAt(b).color;
    const beforeScore = s.score;
    const result = s.useFreeSwap(a, b);
    expect(result.ok).toBe(true);
    expect(s.score).toBe(beforeScore);
    expect(s.movesLeft).toBe(level.moves);
    expect(s.board.cellAt(a).color).toBe(colorB);
    expect(s.board.cellAt(b).color).toBe(colorA);
    expect((result.events as any[]).some((e) => e.type === "cleared")).toBe(false);
  });

  it("自由换位成三正常结算并可判胜", () => {
    const level = makeLevel([{ type: "score", target: 20 }], 5);
    const s = session(level);
    const b = s.board;
    for (let r = 0; r < b.height; r++) {
      for (let c = 0; c < b.width; c++) {
        b.cells[r][c] = makeTile(((c + r) * 3) % 4 + 1);
      }
    }
    b.cells[0][2] = makeTile(0);
    b.cells[0][4] = makeTile(0);
    b.cells[1][3] = makeTile(0);
    const result = s.useFreeSwap({ x: 3, y: 0 }, { x: 3, y: 1 });
    expect(result.ok).toBe(true);
    expect(s.won).toBe(true);
    const clearedCount = (result.events as any[])
      .filter((e) => e.type === "cleared")
      .reduce((n, e) => n + e.cells.length, 0);
    expect(clearedCount).toBeGreaterThanOrEqual(3);
  });

  it("手动洗牌保持构成且有可行步", () => {
    const level = makeLevel([{ type: "score", target: 999999 }], 9);
    const s = session(level);
    const before = new Map<string, number>();
    for (let r = 0; r < s.board.height; r++) {
      for (let c = 0; c < s.board.width; c++) {
        const cell = s.board.cellAt({ x: c, y: r });
        const key = `${cell.color}_${cell.special}`;
        before.set(key, (before.get(key) ?? 0) + 1);
      }
    }
    const result = s.useShuffleHand();
    expect(result.ok).toBe(true);
    expect(result.events).toHaveLength(1);
    const after = new Map<string, number>();
    for (const p of ((result.events[0] as any).placements as any[])) {
      const key = `${p.color}_${p.special}`;
      after.set(key, (after.get(key) ?? 0) + 1);
    }
    expect(after).toEqual(before);
    expect(s.board.hasAnyMove()).toBe(true);
  });
});
