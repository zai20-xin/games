import { describe, it, expect, vi } from 'vitest';
import { buildGroundTiles } from '../../src/systems/CollisionSystem';

// buildGroundTiles 需要一个最小 Phaser scene 形状：
//  - add.image() / add.rectangle()
//  - physics.add.existing(obj, isStatic) / physics.add.staticGroup()
function makeScene() {
  const physBodies: any[] = [];
  const staticGroup: any = { add: (b: any) => { physBodies.push(b); return b; }, children: { entries: [] } };
  const scene: any = {
    add: {
      image: (_x: number, _y: number, _key: string, _frame?: number) => ({
        setOrigin: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
      }),
      rectangle: (x: number, y: number, w: number, h: number) => ({
        x, y, w, h, visible: true,
        setOrigin: vi.fn().mockReturnThis(),
        setVisible: function (v: boolean) { this.visible = v; return this; },
      }),
    },
    physics: {
      add: {
        existing: (obj: any, _isStatic?: boolean) => obj,
        staticGroup: () => staticGroup,
      },
    },
  };
  return { scene, physBodies };
}

describe('buildGroundTiles', () => {
  it('returns a graphics object and registers a static body for every solid run', () => {
    const { scene, physBodies } = makeScene();
    const data = new Array(320 * 15).fill(0);
    // 底部一整行 (320 块)
    for (let x = 0; x < 320; x++) data[14 * 320 + x] = 1;
    // 一个 4 块的平台
    for (let x = 10; x < 14; x++) data[7 * 320 + x] = 1;
    buildGroundTiles(scene, data, 320);
    // 底部 1 段 + 平台 1 段 = 2 个合并的物理体
    expect(physBodies.length).toBe(2);
  });

  it('splits a row of 3 separate tiles into 3 bodies', () => {
    const { scene, physBodies } = makeScene();
    const data = new Array(320 * 15).fill(0);
    data[5 * 320 + 1] = 1;
    data[5 * 320 + 3] = 1;
    data[5 * 320 + 5] = 1;
    buildGroundTiles(scene, data, 320);
    expect(physBodies.length).toBe(3);
  });

  it('registers zero bodies when there is no ground', () => {
    const { scene, physBodies } = makeScene();
    buildGroundTiles(scene, new Array(320 * 15).fill(0), 320);
    expect(physBodies.length).toBe(0);
  });
});
