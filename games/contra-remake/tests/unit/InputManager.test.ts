import { describe, it, expect, vi } from 'vitest';
import { InputManager } from '../../src/systems/InputManager';

/**
 * 构造一个最小的 Phaser KeyboardPlugin 桩：维护 keyCode → { down: EventEmitter }。
 * InputManager 在 addKey(code) 时取/建一个 Key；'down'/'up' 事件就是 fire/up 钩子。
 */
function fakeKeyboard() {
  const keys = new Map<number, { emit: (e: 'down' | 'up') => void }>();
  return {
    addKey(code: number) {
      if (!keys.has(code)) {
        const listeners: { down: Array<() => void>; up: Array<() => void> } = { down: [], up: [] };
        keys.set(code, {
          emit: (e: 'down' | 'up') => listeners[e].forEach((cb) => cb()),
        });
        // 暴露 on('down'/'up') 给 InputManager 注册
        (keys.get(code) as any).on = (e: 'down' | 'up', cb: () => void) => listeners[e].push(cb);
      }
      return keys.get(code);
    },
    fire: (code: number) => keys.get(code)?.emit('down'),
    release: (code: number) => keys.get(code)?.emit('up'),
  } as any;
}

describe('InputManager', () => {
  it('LEFT/RIGHT/SPACE/Z map to logical actions', () => {
    const kb = fakeKeyboard();
    const input = new InputManager(kb);
    const fn = vi.fn();
    input.on('fire', fn);
    kb.fire(90); // Z
    expect(fn).toHaveBeenCalled();
  });

  it('fires (down=true) on press and (down=false) on release', () => {
    const kb = fakeKeyboard();
    const input = new InputManager(kb);
    const fn = vi.fn();
    input.on('fire', fn);
    kb.fire(90);   // Z 按下
    kb.release(90); // Z 抬起
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, true);
    expect(fn).toHaveBeenNthCalledWith(2, false);
  });

  it('isDown reflects state after down/up', () => {
    const kb = fakeKeyboard();
    const input = new InputManager(kb);
    expect(input.isDown('fire')).toBe(false);
    kb.fire(90);
    expect(input.isDown('fire')).toBe(true);
    kb.release(90);
    expect(input.isDown('fire')).toBe(false);
  });

  it('handles LEFT/RIGHT/UP/DOWN/SPACE/P', () => {
    const kb = fakeKeyboard();
    const input = new InputManager(kb);
    const down: string[] = [];
    input.on('left', (d) => down.push(`left:${d}`));
    input.on('right', (d) => down.push(`right:${d}`));
    input.on('jump', (d) => down.push(`jump:${d}`));
    input.on('crouch', (d) => down.push(`crouch:${d}`));
    input.on('enter', (d) => down.push(`enter:${d}`));
    input.on('pause', (d) => down.push(`pause:${d}`));
    kb.fire(37);  // LEFT
    kb.fire(39);  // RIGHT
    kb.fire(38);  // UP
    kb.fire(40);  // DOWN
    kb.fire(32);  // SPACE
    kb.fire(80);  // P
    expect(down).toEqual([
      'left:true', 'right:true', 'enter:true', 'crouch:true',
      'jump:true', 'pause:true',
    ]);
  });
});
