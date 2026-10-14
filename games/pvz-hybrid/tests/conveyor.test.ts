import { describe, expect, it } from "vitest";
import { Conveyor, pickBeltPlant } from "../src/systems/Conveyor";
import { BELT_POOL } from "../src/config";

describe("Conveyor · 传送带", () => {
  it("pickBeltPlant 只从出卡池抽取", () => {
    const rand = () => 0;
    const kind = pickBeltPlant(BELT_POOL, rand);
    expect(BELT_POOL).toContain(kind);
  });

  it("spawn 从自定义池出卡（关卡卡组）", () => {
    const c = new Conveyor(3, ["peashooter", "snowpea"]);
    const s = c.spawn(() => 0);
    expect(s.kind).toBe("peashooter");
    const s2 = c.spawn(() => 0.9);
    expect(s2.kind).toBe("snowpea");
  });

  it("空带初始无卡，不视为满", () => {
    const c = new Conveyor(3);
    expect(c.list).toHaveLength(0);
    expect(c.isFull).toBe(false);
  });

  it("spawn 追加到队尾，id 唯一递增", () => {
    const c = new Conveyor(3);
    const s1 = c.spawn();
    const s2 = c.spawn();
    expect(c.list).toHaveLength(2);
    expect(c.list[0]!.id).toBe(s1.id);
    expect(c.list[1]!.id).toBe(s2.id);
    expect(s2.id).toBeGreaterThan(s1.id);
  });

  it("到达容量上限后，新卡挤掉最旧（队头），保持满带", () => {
    const c = new Conveyor(2);
    c.spawn();
    c.spawn();
    const oldest = c.list[0]!.id;
    c.spawn();
    expect(c.list).toHaveLength(2);
    expect(c.list.some((s) => s.id === oldest)).toBe(false);
    expect(c.isFull).toBe(true);
  });

  it("take 拆走指定卡并返回，列表补齐", () => {
    const c = new Conveyor(4);
    const s1 = c.spawn();
    const s2 = c.spawn();
    const took = c.take(s1.id);
    expect(took?.id).toBe(s1.id);
    expect(c.list.map((s) => s.id)).toEqual([s2.id]);
  });

  it("take 未知 id 返回 undefined 且列表不变", () => {
    const c = new Conveyor(2);
    c.spawn();
    expect(c.take(999)).toBeUndefined();
    expect(c.list).toHaveLength(1);
  });

  it("snapshot 与 list 指向同一份列表引用", () => {
    const c = new Conveyor(2);
    c.spawn();
    expect(c.snapshot()).toBe(c.list);
  });
});