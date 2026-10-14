import { describe, it, expect } from "vitest";
import { streakDates } from "../src/ui/calendar";

describe("streakDates", () => {
  it("从今天连续回溯连胜日", () => {
    const history = {
      "2026-08-27": { ms: 1000 },
      "2026-08-26": { ms: 1000 },
      "2026-08-25": { ms: 1000 },
    };
    const s = streakDates(history, "2026-08-27");
    expect([...s].sort()).toEqual(["2026-08-25", "2026-08-26", "2026-08-27"]);
  });

  it("今天未解则从昨天起回溯", () => {
    const history = {
      "2026-08-26": { ms: 1000 },
      "2026-08-25": { ms: 1000 },
    };
    const s = streakDates(history, "2026-08-27");
    expect([...s].sort()).toEqual(["2026-08-25", "2026-08-26"]);
  });

  it("中间断开则只回溯到断开处", () => {
    const history = {
      "2026-08-27": { ms: 1000 },
      "2026-08-26": { ms: 1000 },
      "2026-08-24": { ms: 1000 }, // 8-25 缺失 → 断
    };
    const s = streakDates(history, "2026-08-27");
    expect([...s].sort()).toEqual(["2026-08-26", "2026-08-27"]);
  });

  it("空 history 返回空集", () => {
    expect(streakDates({}, "2026-08-27").size).toBe(0);
  });

  it("跨月连续回溯正确", () => {
    const history = {
      "2026-03-01": { ms: 1 },
      "2026-02-28": { ms: 1 },
      "2026-02-27": { ms: 1 },
    };
    const s = streakDates(history, "2026-03-01");
    expect([...s].sort()).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });
});
