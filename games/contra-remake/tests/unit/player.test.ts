import { describe, it, expect, vi } from 'vitest';

// 用 vi.mock 在 Player 模块加载前替换 Phaser 为轻量 fake。
// 既要支持 `import Phaser from 'phaser'` (CJS interop) 又要支持 `Phaser.Physics.Arcade.Sprite`。
vi.mock('phaser', () => {
  class FakeGameObject {
    x = 0; y = 0;
    flipX = false;
    scaleX = 1; scaleY = 1;
    body: any = { blocked: { down: false }, velocity: { y: 0 }, setSize: vi.fn(), setOffset: vi.fn() };
    scene: any = { events: { emit: () => undefined } };
    anims: any = { currentAnim: null, isPlaying: false, play: vi.fn() };
    setVelocityX = vi.fn();
    setVelocityY = vi.fn();
    setVelocity = vi.fn();
    setSize = vi.fn();
    setOffset = vi.fn();
    setDisplaySize = vi.fn();
    setScale = vi.fn((s: number) => { this.scaleX = s; this.scaleY = s; });
    setFlipX = vi.fn((v: boolean) => { this.flipX = v; });
    setOrigin = vi.fn();
    setMaxVelocity = vi.fn();
    setCollideWorldBounds = vi.fn();
    play = vi.fn((key: string) => { (this.anims as any).currentAnim = { key }; });
  }
  class FakeSprite extends FakeGameObject {
    constructor(..._args: any[]) { super(); }
  }
  const Phaser: any = { Physics: { Arcade: { Sprite: FakeSprite } } };
  return { default: Phaser, ...Phaser };
});

import { Player, PlayerState } from '../../src/entities/Player';
import type { InputManager } from '../../src/systems/InputManager';

function fakeInput(actions: Record<string, boolean> = {}): InputManager {
  return { isDown: (a: string) => !!actions[a] } as unknown as InputManager;
}

function makePlayer(actions: Record<string, boolean> = {}): { player: Player; scene: any } {
  const events: any[] = [];
  const scene: any = { events: { emit: (e: string, payload: any) => events.push([e, payload]) } };
  scene.add = { existing: vi.fn() };
  scene.physics = { add: { existing: vi.fn() } };
  const player = new Player(scene as any, 0, 0);
  (player as any).scene = scene;
  player.setOnGround(true);
  return { player, scene };
}

describe('PlayerState', () => {
  it('starts at 3 lives and weapon level 1', () => {
    const s = new PlayerState();
    expect(s.lives).toBe(3);
    expect(s.weaponId).toBe(1);
    expect(s.score).toBe(0);
  });

  it('clamps weapon level between 1 and 5', () => {
    const s = new PlayerState();
    s.setWeapon(99);
    expect(s.weaponId).toBe(5);
    s.setWeapon(0);
    expect(s.weaponId).toBe(1);
  });

  it('takes damage only when not invincible', () => {
    const s = new PlayerState();
    s.takeDamage();
    expect(s.lives).toBe(2);
    s.takeDamage();
    expect(s.lives).toBe(2);
  });
});

describe('Player handleInput', () => {
  it('emits player-fire with dir=1 when facing right (default)', () => {
    const { player, scene } = makePlayer();
    const events: any[] = [];
    scene.events.emit = (e: string, payload: any) => events.push([e, payload]);
    player.handleInput(fakeInput({ fire: true }), 1000);
    expect(events).toEqual([['player-fire', expect.objectContaining({ dir: 1 })]]);
  });

  it('flips the sprite and emits dir=-1 when moving left', () => {
    const { player, scene } = makePlayer();
    const events: any[] = [];
    scene.events.emit = (e: string, payload: any) => events.push([e, payload]);
    player.handleInput(fakeInput({ fire: true, left: true }), 1000);
    expect((player as any).flipX).toBe(true);
    expect(events).toEqual([['player-fire', expect.objectContaining({ dir: -1 })]]);
  });

  it('flips back to the right when moving right after left', () => {
    const { player } = makePlayer();
    player.handleInput(fakeInput({ left: true }), 0);
    expect((player as any).flipX).toBe(true);
    player.handleInput(fakeInput({ right: true }), 0);
    expect((player as any).flipX).toBe(false);
  });

  it('resizes body to 16x8 while crouching and 16x16 otherwise', () => {
    const { player } = makePlayer();
    // 现在 Player.applyBodySize 调 this.body.setSize(w/s, h/s) = (80, 40) 蹲 / (80, 80) 站。
    // Phaser Arcade body 内部 width = w * scaleX = 80 * 0.2 = 16（实际像素）。
    const body = (player as any).body;
    player.handleInput(fakeInput({ crouch: true }), 0);
    // 第一次 setSize(80, 80) 在构造时（默认 stand），然后蹲时 setSize(80, 40)
    expect(body.setSize).toHaveBeenCalledWith(80, 40);
    player.handleInput(fakeInput({}), 0);
    expect(body.setSize).toHaveBeenCalledWith(80, 80);
  });

  it('ignores input when dead', () => {
    const { player } = makePlayer();
    const vxSpy = vi.fn();
    (player as any).setVelocityX = vxSpy;
    player.state.lives = 0;
    player.state.alive = false;
    player.handleInput(fakeInput({ fire: true, left: true }), 1000);
    expect(vxSpy).not.toHaveBeenCalled();
  });
});
