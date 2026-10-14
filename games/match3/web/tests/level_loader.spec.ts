import { describe, it, expect } from "vitest";
import { loadAllFromWeb } from "../src/game/level_loader";

// 验证浏览器端内联关卡加载（vite import.meta.glob 转换管线，
// 与 dev/build 使用同一套 glob 解析——回归防 MIME 崩溃）
describe("level_loader 内联加载", () => {
  it("loadAllFromWeb 返回全部 30 关且按 id 排序", async () => {
    const levels = await loadAllFromWeb();
    expect(levels.length).toBe(30);
    expect(levels[0].id).toBe(1);
    expect(levels[levels.length - 1].id).toBe(30);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].id).toBeGreaterThan(levels[i - 1].id);
    }
  });

  it("每关基础字段齐全", async () => {
    const levels = await loadAllFromWeb();
    for (const lv of levels) {
      expect(lv.moves).toBeGreaterThan(0);
      expect(lv.stars.length).toBe(3);
      expect(lv.goals.length).toBeGreaterThan(0);
      expect(lv.sourcePath).toContain("levels-data");
    }
  });
});