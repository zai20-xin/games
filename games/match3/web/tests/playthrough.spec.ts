import { describe, expect, it } from "vitest";
import { GameSession } from "../src/game/session";
import { LevelData } from "../src/game/levels";
import { Pos } from "../src/game/cells";
import path from "node:path";
import { readFileSync } from "node:fs";

function loadLevel(id: number): LevelData {
  const file = path.join(__dirname, "..", "src", "game", "levels-data", `level_${String(id).padStart(2, "0")}.json`);
  return LevelData.fromDict(JSON.parse(readFileSync(file, "utf-8")), file);
}


describe("端到端贪心通关", () => {
  it("多种子正常结算且事件流以 outcome 结尾", () => {
    const level = loadLevel(1);
    for (const seed of [11, 42, 777]) {
      const s = new GameSession(level);
      s.start(seed);
      let swaps = 0;
      while (!s.finished && swaps < 200) {
        const move = firstMove(s.board);
        if (!move) break;
        const result = s.playerSwap(move[0], move[1]);
        if (!result.legal) break;
        swaps++;
        expect(result.events.length).toBeGreaterThan(0);
        expect(result.events[result.events.length - 1].type).toBe("outcome");
      }
      expect(s.finished, `seed=${seed} 应正常结算`).toBe(true);
      if (s.won) {
        const stars = s.starsEarned();
        expect(stars).toBeGreaterThanOrEqual(1);
        expect(stars).toBeLessThanOrEqual(3);
      }
    }
  });
});

function firstMove(board: import("../src/game/board").Match3Board): [Pos, Pos] | null {
  for (let r = 0; r < board.height; r++) {
    for (let c = 0; c < board.width; c++) {
      const pos: Pos = { x: c, y: r };
      if (!board.isSwappable(pos)) continue;
      for (const dir of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const other: Pos = { x: pos.x + dir.x, y: pos.y + dir.y };
        if (!board.isSwappable(other)) continue;
        board.swapData(pos, other);
        const ok = board.createsMatchAt(pos) || board.createsMatchAt(other);
        board.swapData(pos, other);
        if (ok) return [pos, other];
      }
    }
  }
  return null;
}
