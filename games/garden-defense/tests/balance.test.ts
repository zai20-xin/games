import { describe, expect, it } from "vitest";
import {
  COMBAT,
  FLOWERS,
  MAX_FLOWER_LEVEL,
  PETS,
  ROWS,
  CELL_H,
  HOME_Y,
  LAWN_Y,
  flowerDef,
  poolFor,
  upgradeCost,
  waveDefFor,
  waveScale,
  cellCenter,
  LAWN_X,
  CELL_W,
} from "../src/config";

describe("core balance", () => {
  it("lawn is deep: at least 9 rows", () => {
    expect(ROWS).toBeGreaterThanOrEqual(9);
    expect(HOME_Y).toBeGreaterThan(LAWN_Y + 8 * CELL_H);
  });

  it("max evolution is 5 with rare looks", () => {
    expect(MAX_FLOWER_LEVEL).toBe(5);
    for (const f of FLOWERS) {
      expect(f.levels).toHaveLength(5);
      expect(f.looks).toHaveLength(5);
      expect(f.looks[2]!.texture).toContain("epic");
      expect(f.looks[4]!.texture).toContain("legendary");
    }
  });

  it("flowers unlock distinct attack kinds at high level", () => {
    const kinds = new Set(
      FLOWERS.flatMap((f) => f.levels.map((l) => l.attack).filter(Boolean))
    );
    expect(kinds.has("straight")).toBe(true);
    expect(kinds.has("homing")).toBe(true);
    expect(kinds.has("parabola")).toBe(true);
    expect(kinds.has("whirl")).toBe(true);
    expect(kinds.has("laser")).toBe(true);
  });

  it("starting seeds can afford first rose", () => {
    expect(COMBAT.START_SEEDS).toBeGreaterThanOrEqual(flowerDef("rose").seedCost + 25);
  });

  it("rose Lv1 can clear wave-1 cat before home", () => {
    const cat = PETS.cat;
    const travel = (HOME_Y - (LAWN_Y - 40)) / cat.speed;
    const rose = flowerDef("rose").levels[0]!;
    const dps = rose.atk / (rose.rateMs / 1000);
    expect(dps * travel).toBeGreaterThan(cat.hp * 1.1);
  });

  it("upgrade costs rise and Lv5 is expensive", () => {
    expect(upgradeCost("rose", 2)).toBeLessThan(upgradeCost("rose", 3));
    expect(upgradeCost("rose", 5)).toBeGreaterThan(flowerDef("rose").seedCost * 2);
  });

  it("every flower has unique role", () => {
    expect(FLOWERS).toHaveLength(5);
    expect(new Set(FLOWERS.map((f) => f.role)).size).toBe(5);
  });

  it("lotus produces seeds from Lv1", () => {
    expect(flowerDef("lotus").levels[0]!.produceSeeds).toBeGreaterThan(0);
  });

  it("wave 1 small; every 5th huge", () => {
    expect(waveDefFor(1, "standard").huge).toBe(false);
    expect(waveDefFor(5, "standard").huge).toBe(true);
  });

  it("expert denser than casual", () => {
    expect(waveDefFor(3, "expert").count).toBeGreaterThan(waveDefFor(3, "casual").count);
  });

  it("wave scale clamps", () => {
    expect(waveScale(50, "expert").hpMul).toBeLessThanOrEqual(COMBAT.HP_GROW_CLAMP);
  });

  it("cellCenter maps into lawn", () => {
    const c = cellCenter(0, 0);
    expect(c.x).toBe(LAWN_X + CELL_W / 2);
    expect(c.y).toBe(LAWN_Y + CELL_H / 2);
  });

  it("pet unlocks ordered", () => {
    expect(poolFor(1)).toEqual(["cat"]);
    expect(poolFor(9)).toContain("hedgehog");
  });
});
