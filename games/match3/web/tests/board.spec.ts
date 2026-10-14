import { describe, expect, it } from "vitest";
import { Match3Board } from "../src/game/board";
import { Pos, Special, makeTile, makeObstacle } from "../src/game/cells";

const A = 0;
const B = 1;
const C = 2;

function freshBoard(seed = 7): Match3Board {
  const board = new Match3Board();
  board.setup(7, 8, 5, seed);
  return board;
}

function patterned(board: Match3Board): void {
  for (let r = 0; r < board.height; r++) {
    for (let c = 0; c < board.width; c++) {
      board.cells[r][c] = makeTile(((c + r) * 3) % 4);
    }
  }
}

function firstCleared(events: ReturnType<Match3Board["trySwap"]>["events"]) {
  return events.find((e) => e.type === "cleared") as Extract<
    (typeof events)[number],
    { type: "cleared" }
  >;
}

describe("board 初始化", () => {
  it("初始无匹配且必有可行步（多种子）", () => {
    for (const seed of [1, 7, 42, 99, 123]) {
      const board = freshBoard(seed);
      board.fillFromLayout([]);
      expect(board.findMatches()).toHaveLength(0);
      expect(board.hasAnyMove()).toBe(true);
    }
  });
});

describe("交换与消除", () => {
  it("成三交换：恰好消除3子得30分", () => {
    const board = freshBoard(7);
    patterned(board);
    board.cells[0][2] = makeTile(A);
    board.cells[0][4] = makeTile(A);
    board.cells[1][3] = makeTile(A);
    const result = board.trySwap({ x: 3, y: 0 }, { x: 3, y: 1 });
    expect(result.legal).toBe(true);
    const cleared = firstCleared(result.events)!;
    expect(cleared.cells).toHaveLength(3);
    expect(cleared.points).toBe(30);
    const positions = cleared.cells.map((c) => `${c.pos.x},${c.pos.y}`);
    for (const p of ["2,0", "3,0", "4,0"]) expect(positions).toContain(p);
  });

  it("非法交换回退且不改变棋盘", () => {
    const board = freshBoard(7);
    patterned(board);
    const beforeA = board.cellAt({ x: 0, y: 0 }).color;
    const beforeB = board.cellAt({ x: 1, y: 0 }).color;
    const result = board.trySwap({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(result.legal).toBe(false);
    expect(result.events.some((e) => e.type === "revert")).toBe(true);
    expect(board.cellAt({ x: 0, y: 0 }).color).toBe(beforeA);
    expect(board.cellAt({ x: 1, y: 0 }).color).toBe(beforeB);
  });

  it("非相邻与斜向交换被拒绝", () => {
    const board = freshBoard(7);
    patterned(board);
    expect(board.trySwap({ x: 0, y: 0 }, { x: 3, y: 3 }).legal).toBe(false);
    expect(board.trySwap({ x: 0, y: 0 }, { x: 3, y: 3 }).events).toHaveLength(0);
    expect(board.trySwap({ x: 0, y: 0 }, { x: 1, y: 1 }).legal).toBe(false);
  });
});

describe("形状分析", () => {
  it("四连→竖条纹 / 五连→彩虹 / T形→炸弹于交点", () => {
    const board = freshBoard(7);
    const four = board.analyzeGroup(
      { cells: [0, 1, 2, 3].map((x) => ({ x, y: 0 })), color: A },
      { x: -9, y: -9 },
    );
    expect(four.shape).toBe("four");
    expect(four.spawnSpecial).toBe(Special.STRIPE_V);

    const five = board.analyzeGroup(
      { cells: [0, 1, 2, 3, 4].map((x) => ({ x, y: 0 })), color: B },
      { x: -9, y: -9 },
    );
    expect(five.spawnSpecial).toBe(Special.RAINBOW);

    const tShape = board.analyzeGroup(
      { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }], color: C },
      { x: -9, y: -9 },
    );
    expect(tShape.shape).toBe("lt");
    expect(tShape.spawnSpecial).toBe(Special.BOMB);
    expect(tShape.spawnPos).toEqual({ x: 1, y: 0 });
  });
});

describe("重力补充", () => {
  it("塌落并顶部补充", () => {
    const board = freshBoard(7);
    patterned(board);
    for (let r = 0; r < 3; r++) board.cells[r][3] = CellDataEmpty();
    const events: Parameters<typeof board.gravityAndRefill>[0] = [];
    board.gravityAndRefill(events);
    expect(events).toHaveLength(1);
    const falls = events[0] as Extract<(typeof events)[number], { type: "falls" }>;
    expect(falls.refills).toHaveLength(3);
    for (let r = 0; r < board.height; r++) {
      expect(board.cellAt({ x: 3, y: r }).color).toBeGreaterThanOrEqual(0);
    }
  });
});

function CellDataEmpty() {
  return { color: -1, special: Special.NONE as Special, obstacleLayers: 0 };
}

describe("计分倍率", () => {
  it("连锁第n轮×n：30+60+120=210", () => {
    const board = freshBoard(7);
    patterned(board);
    const groups = [
      [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }],
      [{ x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }],
      [{ x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }],
    ];
    let total = 0;
    let roundNo = 1;
    const events: any[] = [];
    for (const cells of groups) {
      const clearSet = new Map<string, Pos>();
      for (const pos of cells) {
        board.cells[pos.y][pos.x] = makeTile(A);
        clearSet.set(`${pos.x},${pos.y}`, pos);
      }
      events.length = 0;
      board.applyClearBatch(clearSet, [], roundNo, events);
      total += (events[0] as { points: number }).points;
      roundNo++;
    }
    expect(total).toBe(210);
  });
});

describe("死局洗牌", () => {
  it("周期棋盘无可行步→洗牌保证有解且构成不变", () => {
    const board = new Match3Board();
    board.setup(6, 6, 5, 7);
    for (let r = 0; r < board.height; r++) {
      for (let c = 0; c < board.width; c++) {
        board.cells[r][c] = makeTile((c + 2 * r) % 3);
      }
    }
    expect(board.findMatches()).toHaveLength(0);
    expect(board.hasAnyMove()).toBe(false);
    const snapshot = new Map<string, number>();
    for (let r = 0; r < board.height; r++) {
      for (let c = 0; c < board.width; c++) {
        const cell = board.cellAt({ x: c, y: r });
        const key = `${cell.color}_${cell.special}`;
        snapshot.set(key, (snapshot.get(key) ?? 0) + 1);
      }
    }
    const events: any[] = [];
    board.ensurePlayable(events);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("shuffle");
    expect(board.hasAnyMove()).toBe(true);
    const after = new Map<string, number>();
    for (const placement of (events[0] as any).placements) {
      const key = `${placement.color}_${placement.special}`;
      after.set(key, (after.get(key) ?? 0) + 1);
    }
    expect(after).toEqual(snapshot);
  });
});

describe("提示", () => {
  it("有解返回合法对，死局为空", () => {
    // 随机初始化保证可行步
    const liveBoard = freshBoard(11);
    liveBoard.fillFromLayout([]);
    const hint = liveBoard.findHint();
    expect(hint).toHaveLength(2);

    const dead = new Match3Board();
    dead.setup(6, 6, 5, 7);
    for (let r = 0; r < dead.height; r++) {
      for (let c = 0; c < dead.width; c++) {
        dead.cells[r][c] = makeTile((c + 2 * r) % 3);
      }
    }
    expect(dead.findHint()).toHaveLength(0);
    expect(dead.hasAnyMove()).toBe(false);
  });
});

describe("特殊棋子生成与触发", () => {
  it("横向四连在段内生成竖条纹", () => {
    const board = freshBoard(11);
    patterned(board);
    board.cells[0][2] = makeTile(A);
    board.cells[0][4] = makeTile(A);
    board.cells[0][5] = makeTile(A);
    board.cells[1][3] = makeTile(A);
    const result = board.trySwap({ x: 3, y: 0 }, { x: 3, y: 1 });
    expect(result.legal).toBe(true);
    let stripeOk = false;
    for (const event of result.events) {
      if (event.type !== "cleared") continue;
      for (const spawn of event.spawns) {
        if (
          spawn.special === Special.STRIPE_V &&
          spawn.pos.y === 0 &&
          spawn.pos.x >= 2 &&
          spawn.pos.x <= 5
        ) {
          stripeOk = true;
        }
      }
    }
    expect(stripeOk).toBe(true);
  });

  it("彩虹+普通清全场同色", () => {
    const board = freshBoard(7);
    patterned(board);
    board.cells[0][0] = makeTile(C, Special.RAINBOW);
    board.cells[0][1] = makeTile(C);
    const targets: Pos[] = [{ x: 5, y: 1 }, { x: 6, y: 2 }, { x: 2, y: 6 }];
    for (const pos of targets) board.cells[pos.y][pos.x] = makeTile(C);
    const result = board.trySwap({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(result.legal).toBe(true);
    const cleared: string[] = [];
    for (const event of result.events) {
      if (event.type === "cleared") {
        for (const info of event.cells) cleared.push(`${info.pos.x},${info.pos.y}`);
      }
    }
    for (const pos of targets) expect(cleared).toContain(`${pos.x},${pos.y}`);
  });
});

describe("组合强化", () => {
  function clearedPositions(events: any[]): Pos[] {
    const out: Pos[] = [];
    for (const event of events) {
      if (event.type === "cleared") {
        for (const info of event.cells) out.push(info.pos);
      }
    }
    return out;
  }

  function has(pos: Pos, list: Pos[]): boolean {
    return list.some((p) => p.x === pos.x && p.y === pos.y);
  }

  it("双条纹十字清除", () => {
    const board = freshBoard(7);
    patterned(board);
    board.cells[3][3] = makeTile(A, Special.STRIPE_H);
    board.cells[3][4] = makeTile(B, Special.STRIPE_V);
    const result = board.trySwap({ x: 3, y: 3 }, { x: 4, y: 3 });
    expect(result.legal).toBe(true);
    const cleared = clearedPositions(result.events);
    expect(has({ x: 0, y: 3 }, cleared)).toBe(true);
    expect(has({ x: 6, y: 3 }, cleared)).toBe(true);
    expect(has({ x: 4, y: 0 }, cleared)).toBe(true);
    expect(has({ x: 4, y: 7 }, cleared)).toBe(true);
  });

  it("双炸弹5×5", () => {
    const board = freshBoard(7);
    patterned(board);
    board.cells[3][3] = makeTile(A, Special.BOMB);
    board.cells[3][4] = makeTile(B, Special.BOMB);
    const result = board.trySwap({ x: 3, y: 3 }, { x: 4, y: 3 });
    expect(result.legal).toBe(true);
    const cleared = clearedPositions(result.events);
    expect(has({ x: 2, y: 1 }, cleared)).toBe(true);
    expect(has({ x: 6, y: 5 }, cleared)).toBe(true);
    expect(has({ x: 0, y: 0 }, cleared)).toBe(false);
  });

  it("双彩虹清空全盘", () => {
    const board = freshBoard(7);
    patterned(board);
    board.cells[3][3] = makeTile(A, Special.RAINBOW);
    board.cells[3][4] = makeTile(B, Special.RAINBOW);
    let tilesBefore = 0;
    for (let r = 0; r < board.height; r++) {
      for (let c = 0; c < board.width; c++) {
        if (board.cellAt({ x: c, y: r }).color >= 0) tilesBefore++;
      }
    }
    const result = board.trySwap({ x: 3, y: 3 }, { x: 4, y: 3 });
    expect(result.legal).toBe(true);
    let clearedCount = 0;
    for (const event of result.events) {
      if (event.type === "cleared") clearedCount += event.cells.length;
    }
    expect(clearedCount).toBe(tilesBefore);
  });
});

describe("冰霜障碍", () => {
  it("不可交换；单层相邻消除即毁", () => {
    const board = freshBoard(7);
    patterned(board);
    board.cells[3][3] = makeObstacle(1);
    expect(board.trySwap({ x: 3, y: 3 }, { x: 3, y: 2 }).legal).toBe(false);
    const destroyed = (board as any).damageFrostAround([{ pos: { x: 3, y: 2 } }]);
    expect(destroyed).toBe(1);
    expect(board.cellAt({ x: 3, y: 3 }).obstacleLayers).toBe(0);
  });

  it("双层需两次打击", () => {
    const board = freshBoard(7);
    patterned(board);
    board.cells[3][3] = makeObstacle(2);
    (board as any).damageFrostAround([{ pos: { x: 3, y: 2 } }]);
    expect(board.cellAt({ x: 3, y: 3 }).obstacleLayers).toBe(1);
    (board as any).damageFrostAround([{ pos: { x: 3, y: 4 } }]);
    expect(board.cellAt({ x: 3, y: 3 }).obstacleLayers).toBeLessThanOrEqual(0);
  });
});
