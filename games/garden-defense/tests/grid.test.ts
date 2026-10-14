import { beforeEach, describe, expect, it } from "vitest";
import { GridModel } from "../src/systems/Grid";

describe("GridModel", () => {
  let g: GridModel;
  beforeEach(() => {
    g = new GridModel();
  });

  it("places and clears flowers", () => {
    expect(g.isEmpty(2, 3)).toBe(true);
    expect(g.place(2, 3, 7)).toBe(true);
    expect(g.isEmpty(2, 3)).toBe(false);
    expect(g.flowerIdAt(2, 3)).toBe(7);
    expect(g.place(2, 3, 8)).toBe(false);
    g.clear(2, 3);
    expect(g.isEmpty(2, 3)).toBe(true);
  });

  it("rejects out of bounds", () => {
    expect(g.at(-1, 0)).toBeNull();
    expect(g.at(0, 99)).toBeNull();
    expect(g.isEmpty(9, 9)).toBe(false);
  });

  it("reset clears all", () => {
    g.place(0, 0, 1);
    g.reset();
    expect(g.isEmpty(0, 0)).toBe(true);
  });
});
