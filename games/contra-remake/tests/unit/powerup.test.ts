import { describe, it, expect } from 'vitest';
import { PowerUp } from '../../src/entities/PowerUp';
import { WEAPON } from '../../src/utils/constants';

describe('PowerUp', () => {
  it('applies the requested weapon', () => {
    const p = new PowerUp({} as any, 0, 0, 'spread');
    expect(p.weaponKey).toBe('spread');
    expect(WEAPON[p.weaponKey].id).toBe(3);
  });
});
