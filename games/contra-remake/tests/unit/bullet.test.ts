import { describe, it, expect } from 'vitest';
import { BulletPool } from '../../src/entities/Bullet';

function makePool() {
  const fakeGfx: any = { x: 0, y: 0, flipX: false, destroy() { /* noop */ } };
  fakeGfx.setFlipX = (v: boolean) => { fakeGfx.flipX = v; };
  fakeGfx.setDisplaySize = (_w: number, _h: number) => fakeGfx;
  fakeGfx.setScale = (_s: number) => fakeGfx;
  const fakeScene: any = { add: { image: () => fakeGfx } };
  return { pool: new BulletPool({ capacity: 4, scene: fakeScene } as any), fakeScene, fakeGfx };
}

describe('BulletPool', () => {
  it('acquires from pool and recycles when out of bounds', () => {
    const { pool } = makePool();
    const b1 = pool.acquire(0, 0, 1, 'player');
    const b2 = pool.acquire(0, 0, 1, 'player');
    expect(b1).not.toBe(b2);
    b1.update(9999, 0, -1000);
    expect(b1.active).toBe(false);
  });

  it('moves acquired bullets forward when update() is called repeatedly', () => {
    const { pool } = makePool();
    const b = pool.acquire(100, 50, 1, 'player');
    const startX = b.x;
    pool.update(0, 1000, 9999);
    expect(b.x).toBeGreaterThan(startX);
  });

  it('moves active bullets in negative direction when dir is -1', () => {
    const { pool } = makePool();
    const b = pool.acquire(100, 50, -1, 'player');
    const startX = b.x;
    pool.update(0, 1000, 9999);
    expect(b.x).toBeLessThan(startX);
  });

  it('moves active bullets across multiple update() calls', () => {
    const { pool } = makePool();
    const b = pool.acquire(100, 50, 1, 'player');
    const startX = b.x;
    for (let i = 0; i < 5; i++) pool.update(0, 100, 9999);
    expect(b.x).toBeGreaterThan(startX + 1);
  });

  it('stops calling update on recycled bullets', () => {
    const { pool } = makePool();
    const b = pool.acquire(100, 50, 1, 'player');
    b.update(0, 0, -10); // 触发 recycle
    expect(b.active).toBe(false);
    const xAfterRecycle = b.x;
    pool.update(0, 1000, 9999);
    expect(b.x).toBe(xAfterRecycle);
  });

  it('release() puts bullets back to the free pool', () => {
    const { pool } = makePool();
    const b = pool.acquire(0, 0, 1, 'player');
    pool.release(b);
    expect(b.active).toBe(false);
    const reused = pool.acquire(10, 10, 1, 'player');
    expect(reused).toBe(b);
  });
});
