import { describe, it, expect, beforeEach } from 'vitest';
import { readHighScore, writeHighScore } from '../../src/utils/persistence';

describe('high score persistence', () => {
  beforeEach(() => localStorage.clear());

  it('returns 0 when no record', () => expect(readHighScore()).toBe(0));

  it('persists and reads back', () => {
    writeHighScore(12345);
    expect(readHighScore()).toBe(12345);
  });
});
