import { describe, it, expect } from 'vitest';
import { buildGameConfig } from '../../src/config/GameConfig';

describe('GameConfig', () => {
  it('uses 256x240 base resolution with FIT scale', () => {
    const cfg = buildGameConfig('game', { parent: 'app' });
    expect(cfg.width).toBe(256);
    expect(cfg.height).toBe(240);
    expect(cfg.scale?.mode).toBe(3 /* FIT */);
  });

  it('registers all four scenes in order', () => {
    const cfg = buildGameConfig('game', { parent: 'app' });
    expect(cfg.scene?.map((s: any) => s.key)).toEqual(['Boot', 'Menu', 'Game', 'UI']);
  });
});
