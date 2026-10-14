import type Phaser from "phaser";

type Handler = (...args: unknown[]) => void;

class Bus {
  private map = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): void {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event)!.add(fn);
  }

  off(event: string, fn: Handler): void {
    this.map.get(event)?.delete(fn);
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.map.get(event);
    if (!set) return;
    for (const fn of [...set]) fn(...args);
  }

  clear(): void {
    this.map.clear();
  }
}

export const bus = new Bus();

/** 供 Game 重开时清空残留监听 */
export function resetBus(scene?: Phaser.Scene): void {
  void scene;
  bus.clear();
}
