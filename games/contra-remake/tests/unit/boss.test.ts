import { describe, it, expect } from 'vitest';
import { BossState } from '../../src/entities/Boss';
import { BOSS_PHASE_HP } from '../../src/utils/constants';

describe('BossState', () => {
  it('starts at phase 1', () => {
    const b = new BossState(100);
    expect(b.phase).toBe(1);
  });
  it('transitions to phase 2 at 60% hp', () => {
    const b = new BossState(100);
    b.takeDamage(40); // hp=60
    expect(b.phase).toBe(2);
  });
  it('transitions to phase 3 at 20% hp', () => {
    const b = new BossState(100);
    b.takeDamage(80); // hp=20
    expect(b.phase).toBe(3);
  });
  it('dies at 0', () => {
    const b = new BossState(100);
    b.takeDamage(200);
    expect(b.alive).toBe(false);
  });
  it('exposes phase thresholds from constants', () => {
    expect(BOSS_PHASE_HP.phase1).toBe(60);
    expect(BOSS_PHASE_HP.phase2).toBe(20);
  });
});
