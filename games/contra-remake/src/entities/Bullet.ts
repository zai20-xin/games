import { PHYSICS } from '../utils/constants';

export type BulletOwner = 'player' | 'enemy';

/** 子弹可视对象的最小结构约束：真实 Phaser.Image 与单测桩场景都满足。 */
export interface BulletImage {
  x: number;
  y: number;
  setScale: (s: number) => unknown;
  setFlipX?: (v: boolean) => unknown;
  destroy?: () => void;
}

export class Bullet {
  active = true;
  owner: BulletOwner;
  x: number; y: number; vx: number; vy = 0; damage = 1;
  /** 可视对象；recycle 后置 undefined */
  gfx: BulletImage | undefined;
  /** 朝向：+1 向右，-1 向左。仅用于控制 sprite.flipX。 */
  dir: number = 1;
  constructor(public scene: { add: { image: (x: number, y: number, key: string) => BulletImage } }, x: number, y: number, dir: number, owner: BulletOwner) {
    this.x = x; this.y = y; this.owner = owner; this.dir = dir;
    this.vx = dir * PHYSICS.bulletSpeed;
    this.draw();
  }
  /** 画/重画子弹的可视对象（替换之前的 rectangle 占位）。 */
  private draw() {
    if (this.gfx) { try { this.gfx.destroy?.(); } catch { /* ignore */ } }
    const key = this.owner === 'player' ? 'bullet-player' : 'bullet-enemy';
    const img = this.scene.add.image(this.x, this.y, key);
    // bullet-player 20x20 → 4x4 视觉；bullet-enemy 30x30 → 6x6
    img.setScale(this.owner === 'player' ? 4 / 20 : 6 / 30);
    if (this.dir < 0 && typeof img.setFlipX === 'function') img.setFlipX(true);
    this.gfx = img;
  }
  /** 重置一颗已存在的子弹到新的位置/方向/拥有者。 */
  reset(x: number, y: number, dir: number, owner: BulletOwner) {
    this.x = x; this.y = y; this.vx = dir * PHYSICS.bulletSpeed;
    this.owner = owner; this.vy = 0; this.damage = 1; this.active = true; this.dir = dir;
    this.draw();
  }
  update(_t: number, d: number, worldW: number) {
    if (!this.active) return;
    this.x += (this.vx * d) / 1000;
    if (this.gfx) this.gfx.x = this.x;
    if (this.x < 0 || this.x > worldW) this.recycle();
  }
  recycle() {
    this.active = false;
    if (this.gfx) { try { this.gfx.destroy?.(); } catch { /* ignore */ } this.gfx = undefined; }
  }
}

export class BulletPool {
  /** 当前活跃（在场）的子弹，由 GameScene update 遍历。 */
  readonly active: Bullet[] = [];
  /** 已被回收、可被复用的子弹。 */
  private free: Bullet[] = [];
  constructor(private opts: { capacity: number; scene: Bullet['scene'] }) {}
  acquire(x: number, y: number, dir: number, owner: BulletOwner) {
    const reused = this.free.pop();
    let b: Bullet;
    if (reused) {
      reused.reset(x, y, dir, owner);
      b = reused;
    } else {
      b = new Bullet(this.opts.scene, x, y, dir, owner);
    }
    this.active.push(b);
    return b;
  }
  release(b: Bullet) {
    b.recycle();
    const i = this.active.indexOf(b);
    if (i >= 0) this.active.splice(i, 1);
    this.free.push(b);
  }
  /** 由 GameScene 在每一帧调用，遍历所有活跃子弹并 update。 */
  update(t: number, d: number, worldW: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      if (!b.active) { this.active.splice(i, 1); continue; }
      b.update(t, d, worldW);
    }
  }
}
