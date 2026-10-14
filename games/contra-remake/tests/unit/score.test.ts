import { describe, it, expect } from 'vitest';
import { WEAPON } from '../../src/utils/constants';

describe('weapon table', () => {
  it('single weapon shoots 1 bullet', () => expect(WEAPON.single.bullets).toBe(1));
  it('spread weapon shoots 3 bullets', () => expect(WEAPON.spread.bullets).toBe(3));
});
