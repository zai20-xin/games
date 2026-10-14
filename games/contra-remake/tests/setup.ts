// Vitest setup: stub HTMLCanvasElement.getContext for Phaser's module-load probe.
// We don't need real rendering for unit tests on config object shape.
if (typeof HTMLCanvasElement !== 'undefined') {
  const noop = () => {};
  const fakeCtx: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'canvas') return null;
      if (prop === 'fillStyle' || prop === 'globalCompositeOperation' || prop === 'strokeStyle') return '';
      if (prop === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      });
      if (prop === 'putImageData' || prop === 'drawImage' || prop === 'save' || prop === 'restore' || prop === 'beginPath' || prop === 'closePath' || prop === 'translate' || prop === 'scale' || prop === 'setTransform' || prop === 'resetTransform' || prop === 'rotate' || prop === 'clearRect' || prop === 'fillRect' || prop === 'strokeRect' || prop === 'moveTo' || prop === 'lineTo' || prop === 'arc' || prop === 'bezierCurveTo' || prop === 'quadraticCurveTo') return noop;
      return undefined;
    },
    set() { return true; },
  });

  // @ts-ignore - mocking the canvas API for jsdom
  HTMLCanvasElement.prototype.getContext = function () {
    return fakeCtx;
  };
}

// jsdom 默认不提供 localStorage（opaque origin），手动注入一个最小实现
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  (globalThis as any).localStorage = memoryStorage;
  if (typeof window !== 'undefined') (window as any).localStorage = memoryStorage;
}
