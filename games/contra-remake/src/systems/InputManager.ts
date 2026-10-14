/**
 * 输入管理：把键盘事件映射到逻辑动作 (left/right/jump/crouch/fire/enter/pause)。
 *
 * 设计要点：
 * - 使用 Phaser 推荐方式：this.input.keyboard.addKey(KeyCodes.X) 拿到 Key 对象，
 *   监听 Key 自己的 'down' 事件，避免依赖字符串事件名 (keydown-X)。
 * - Key 对象在 keydown 时会触发 'down' 事件一次（edge-triggered），与原 plan 一致。
 * - 对外 API：`on(action, cb)` 订阅动作状态变化；`isDown(action)` 查状态。
 */

import Phaser from 'phaser';

export type Action =
  | 'left' | 'right' | 'jump' | 'crouch' | 'enter' | 'fire'
  | 'pause' | 'restart' | 'mute';

interface KeyBinding {
  action: Action;
  keyCode: number;
  // 备选 keycode（小写 z、大写 Z 数字相同，但有些键盘布局需要额外映射）
  aliases?: number[];
}

const BINDINGS: KeyBinding[] = [
  { action: 'left',   keyCode: Phaser.Input.Keyboard.KeyCodes.LEFT },
  { action: 'right',  keyCode: Phaser.Input.Keyboard.KeyCodes.RIGHT },
  { action: 'enter',  keyCode: Phaser.Input.Keyboard.KeyCodes.UP },
  { action: 'crouch', keyCode: Phaser.Input.Keyboard.KeyCodes.DOWN },
  { action: 'jump',   keyCode: Phaser.Input.Keyboard.KeyCodes.SPACE },
  { action: 'fire',   keyCode: Phaser.Input.Keyboard.KeyCodes.Z,
    // 兼容 QWE 区域玩家：X 也可开火（按 plan 不做，只留 Z）
  },
  { action: 'pause',  keyCode: Phaser.Input.Keyboard.KeyCodes.P },
  { action: 'restart', keyCode: Phaser.Input.Keyboard.KeyCodes.R },
  { action: 'mute',   keyCode: Phaser.Input.Keyboard.KeyCodes.M },
];

export class InputManager {
  private listeners = new Map<Action, Set<(down: boolean) => void>>();
  private down = new Set<Action>();

  constructor(private keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    for (const b of BINDINGS) {
      const key = keyboard.addKey(b.keyCode);
      key.on('down', () => this.setDown(b.action, true));
      key.on('up',   () => this.setDown(b.action, false));
    }
  }

  private setDown(action: Action, value: boolean) {
    if (value) {
      if (this.down.has(action)) return;
      this.down.add(action);
    } else {
      this.down.delete(action);
    }
    this.emit(action, value);
  }

  private emit(action: Action, value: boolean) {
    this.listeners.get(action)?.forEach((cb) => cb(value));
  }

  on(action: Action, cb: (down: boolean) => void): () => void {
    if (!this.listeners.has(action)) this.listeners.set(action, new Set());
    this.listeners.get(action)!.add(cb);
    return () => this.listeners.get(action)?.delete(cb);
  }

  isDown(action: Action): boolean { return this.down.has(action); }
}
