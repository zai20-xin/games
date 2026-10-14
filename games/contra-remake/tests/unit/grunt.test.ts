import { describe, it, expect } from 'vitest';
import { Grunt } from '../../src/entities/Grunt';
import { PHYSICS } from '../../src/utils/constants';

// fake scene 的 add.sprite 必须返回带 setOrigin / play / setFlipX 的对象（脚底锚点 + 动画）。
function makeFakeGfx() {
  const gfx: any = { x: 0, y: 0, flipX: false, destroy() {} };
  gfx.setOrigin = () => gfx;
  gfx.setFlipX = (v: boolean) => { gfx.flipX = v; };
  gfx.setDisplaySize = (_w: number, _h: number) => gfx;
  gfx.setScale = (_s: number) => gfx;
  gfx.play = (_key: string, _ignore?: boolean) => gfx;
  return gfx;
}
function makeFakeScene() {
  return { add: { sprite: () => makeFakeGfx(), image: () => makeFakeGfx() } } as any;
}

describe('Grunt AI', () => {
  it('does nothing out of sight', () => {
    const g = new Grunt(makeFakeScene(), 0, 0);
    const action = g.tickAI(0, 0, 0);
    expect(action).toBe('idle');
  });

  it('fires when player in sight', () => {
    const g = new Grunt(makeFakeScene(), 0, 0);
    g.lastFireAt = -9999;
    const action = g.tickAI(PHYSICS.gruntSight - 1, 0, 1200);
    expect(action).toBe('fire');
  });
});
