import { describe, it, expect } from "vitest";
import { generate } from "../src/engine/generator";
import { conflictReasons, computeHint, reasonText } from "../src/ui/assist";

describe("conflictReasons", () => {
  it("检测行/列/相邻/色区四类冲突", () => {
    const n = 4;
    const regions = [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 3, 3];
    // 同列两枚：(0,0) 与 (1,0)
    const col = new Uint8Array(n * n);
    col[0] = 1;
    col[4] = 1;
    let m = conflictReasons(n, regions, col);
    expect(m.get(0)!.has("col")).toBe(true);
    expect(m.get(4)!.has("col")).toBe(true);

    // 斜向相邻两枚：(0,0) 与 (1,1)
    const adj = new Uint8Array(n * n);
    adj[0] = 1;
    adj[5] = 1;
    m = conflictReasons(n, regions, adj);
    expect(m.get(0)!.has("adj")).toBe(true);
    expect(m.get(5)!.has("adj")).toBe(true);

    // 同色区两枚（region 0 含 (0,0)(1,1)）
    const reg = new Uint8Array(n * n);
    reg[0] = 1;
    reg[5] = 1;
    m = conflictReasons(n, regions, reg);
    expect(m.get(0)!.has("region")).toBe(true);

    // 同行两枚：(0,0) 与 (0,2)
    const row = new Uint8Array(n * n);
    row[0] = 1;
    row[2] = 1;
    m = conflictReasons(n, regions, row);
    expect(m.get(0)!.has("row")).toBe(true);
    expect(m.get(2)!.has("row")).toBe(true);
  });

  it("reasonText 输出中文短串", () => {
    expect(reasonText(new Set(["row", "adj"]))).toBe("行/邻");
  });
});

describe("computeHint", () => {
  it("返回安全格且绝不修改 marks", () => {
    const p = generate(6, 12345);
    const marks = new Uint8Array(p.n * p.n);
    for (const c of p.clues) marks[c] = 1;
    const before = marks.slice();
    const h = computeHint(p.n, p.regions, marks);
    expect(marks).toEqual(before); // 不改动盘面
    expect(h).not.toBeNull();
    // 放置提示格后不应与现有皇后冲突
    const after = marks.slice();
    after[h!.cell] = 1;
    const m = conflictReasons(p.n, p.regions, after);
    expect(m.has(h!.cell)).toBe(false);
  });

  it("无安全格时返回 null", () => {
    const n = 3;
    const regions = new Array(n * n).fill(0); // 单色区，放一枚即封全盘
    const marks = new Uint8Array(n * n);
    marks[0] = 1;
    expect(computeHint(n, regions, marks)).toBeNull();
  });

  it("理由文案非空", () => {
    const p = generate(7, 999);
    const marks = new Uint8Array(p.n * p.n);
    for (const c of p.clues) marks[c] = 1;
    const h = computeHint(p.n, p.regions, marks);
    expect(h).not.toBeNull();
    expect(h!.reason.length).toBeGreaterThan(0);
  });
});
