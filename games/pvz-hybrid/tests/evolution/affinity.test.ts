import { describe, it, expect } from "vitest";
import {
  getAffinity,
  getAffinityLevel,
  getSuccessRate,
  getFormWeights,
  getSkillWeights,
} from "../../src/engine/affinity";

describe("affinity", () => {
  describe("getAffinityLevel", () => {
    it("同族返回 same", () => {
      expect(getAffinityLevel("shooter", "shooter")).toBe("same");
    });

    it("互补返回 complement", () => {
      expect(getAffinityLevel("shooter", "wall")).toBe("complement");
    });

    it("混搭返回 mixed", () => {
      expect(getAffinityLevel("shooter", "melee")).toBe("mixed");
    });

    it("无规则时返回 mixed", () => {
      expect(getAffinityLevel("explosive", "wall")).toBe("mixed");
    });
  });

  describe("getSuccessRate", () => {
    it("同族成功率 95%", () => {
      expect(getSuccessRate("shooter", "shooter")).toBe(0.95);
    });

    it("互补成功率 80%", () => {
      expect(getSuccessRate("shooter", "wall")).toBe(0.80);
    });

    it("混搭成功率 70%", () => {
      expect(getSuccessRate("shooter", "melee")).toBe(0.70);
    });

    it("顺序不影响结果", () => {
      expect(getSuccessRate("wall", "shooter")).toBe(getSuccessRate("shooter", "wall"));
    });
  });

  describe("getFormWeights", () => {
    it("同族 shooter 偏向火焰/雷电", () => {
      const weights = getFormWeights("shooter", "shooter");
      expect(weights.flame).toBeGreaterThan(1);
      expect(weights.lightning).toBeGreaterThan(1);
    });

    it("互补 shooter+wall 偏向寒冰", () => {
      const weights = getFormWeights("shooter", "wall");
      expect(weights.ice).toBeGreaterThan(1);
    });

    it("混搭返回空权重", () => {
      const weights = getFormWeights("shooter", "melee");
      expect(Object.keys(weights)).toHaveLength(0);
    });
  });

  describe("getSkillWeights", () => {
    it("同族 shooter 偏向急速/弹射", () => {
      const weights = getSkillWeights("shooter", "shooter");
      expect(weights.rapidfire).toBeGreaterThan(1);
      expect(weights.bounce).toBeGreaterThan(1);
    });

    it("互补 shooter+wall 偏向减速", () => {
      const weights = getSkillWeights("shooter", "wall");
      expect(weights.slow).toBeGreaterThan(1);
    });
  });
});
