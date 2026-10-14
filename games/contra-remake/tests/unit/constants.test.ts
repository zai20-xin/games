import { describe, it, expect } from 'vitest';
import { PHYSICS, WEAPON, COLLISION, BOSS_PHASE_HP } from '../../src/utils/constants';

describe('constants', () => {
  it('exposes expected player physics', () => {
    expect(PHYSICS.playerSpeed).toBe(180);
    expect(PHYSICS.jumpVelocity).toBe(-650);
    expect(PHYSICS.gravity).toBe(1200);
  });

  it('maps weapon ids to bullet counts', () => {
    expect(WEAPON.single.bullets).toBe(1);
    expect(WEAPON.double.bullets).toBe(2);
    expect(WEAPON.spread.bullets).toBe(3);
  });

  it('uses Arcade Physics bitmask ranges', () => {
    expect(COLLISION.PLAYER).toBeGreaterThan(0);
    expect((COLLISION.PLAYER & COLLISION.ENEMY_BULLET) !== 0).toBe(true);
  });

  it('defines boss phase thresholds in descending order', () => {
    expect(BOSS_PHASE_HP.phase1).toBe(60);
    expect(BOSS_PHASE_HP.phase2).toBe(20);
  });
});
