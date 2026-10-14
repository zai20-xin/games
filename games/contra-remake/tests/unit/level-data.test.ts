import { describe, it, expect } from 'vitest';
import { generateLevel1 } from '../../scripts/build-level1.mjs';

describe('level1 data', () => {
  it('generates 320x15 ground data with a baseline of solid tiles', () => {
    const data = generateLevel1();
    expect(data.length).toBe(320 * 15);
    expect(data[319 * 15 + 14]).toBe(1); // 末行最后一格为地面
  });
});
