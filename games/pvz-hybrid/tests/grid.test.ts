import { describe, expect, it } from "vitest";
import { CELL_H, CELL_W, LAWN_X, LAWN_Y } from "../src/config";
import { GridModel, type Occupant } from "../src/systems/GridModel";

function fakeOcc(row: number, col: number, x = 0): Occupant {
  return { row, col, x, alive: true, takeDamage: () => {} };
}

describe("GridModel", () => {
  it("place/at/remove 基本语义", () => {
    const g = new GridModel();
    expect(g.place(fakeOcc(0, 0))).toBe(true);
    expect(g.at(0, 0)).toBeDefined();
    expect(g.place(fakeOcc(0, 0))).toBe(false); // 重复占用
    g.removeAt(0, 0);
    expect(g.at(0, 0)).toBeUndefined();
    expect(g.place(fakeOcc(0, 0))).toBe(true);
  });

  it("越界安全", () => {
    const g = new GridModel();
    expect(g.place(fakeOcc(-1, 0))).toBe(false);
    expect(g.place(fakeOcc(0, 9))).toBe(false);
    expect(g.at(5, 0)).toBeUndefined();
  });

  it("cellCenter / colAt / rowAt 坐标换算互逆", () => {
    const g = new GridModel();
    const { x, y } = g.cellCenter(2, 3);
    expect(x).toBe(LAWN_X + 3 * CELL_W + CELL_W / 2);
    expect(y).toBe(LAWN_Y + 2 * CELL_H + CELL_H / 2);
    expect(g.colAt(x)).toBe(3);
    expect(g.rowAt(y)).toBe(2);
    expect(g.colAt(10)).toBe(-1);
    expect(g.rowAt(10)).toBe(-1);
  });

  it("plantInFront 接触式判定：嘴探入植物右缘即啃食", () => {
    const g = new GridModel();
    // col6 中心 x=735
    g.place(fakeOcc(1, 6, 735));
    // 嘴在植物右缘 55px 窗口内 → 啃
    expect(g.plantInFront(1, 789)?.x).toBe(735);
    expect(g.plantInFront(1, 736)?.x).toBe(735);
    // 嘴已穿过植物中心左侧 30px 以上 → 不再回头啃
    expect(g.plantInFront(1, 704)).toBeUndefined();
    // 嘴还远在植物右缘之外 → 未接触
    expect(g.plantInFront(1, 791)).toBeUndefined();
    // 不同行
    expect(g.plantInFront(4, 789)).toBeUndefined();
  });

  it("plantInFront 按接触窗口命中最近植物", () => {
    const g = new GridModel();
    g.place(fakeOcc(1, 2, 375));
    g.place(fakeOcc(1, 3, 465));
    // 嘴在 465 接触窗内（435,520] → 命中 465
    expect(g.plantInFront(1, 500)?.x).toBe(465);
    expect(g.plantInFront(1, 440)?.x).toBe(465);
    // 嘴退回 375 窗口内（345,430] 且未进入 465 窗口 → 命中 375
    expect(g.plantInFront(1, 420)?.x).toBe(375);
  });
});
