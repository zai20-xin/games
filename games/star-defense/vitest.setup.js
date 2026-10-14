// ================================================================
// Vitest 全局 setup - 在 node 环境下把 jest 映射到 vi
// 并 polyfill requestAnimationFrame / performance.now 等浏览器 API
// 让现有的浏览器代码 + Jest 风格测试可以在 vitest 中工作
// ================================================================
import { vi } from 'vitest';

if (typeof globalThis.jest === 'undefined' && typeof vi !== 'undefined') {
  globalThis.jest = vi;
}

// 简单的 requestAnimationFrame polyfill（同步驱动 _tick）
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  let rafId = 0;
  const rafCallbacks = new Map();
  globalThis.requestAnimationFrame = (cb) => {
    const id = ++rafId;
    rafCallbacks.set(id, cb);
    // 同步立即触发（让 UiAnimator 测试能跑）
    setTimeout(() => {
      const fn = rafCallbacks.get(id);
      if (fn) {
        rafCallbacks.delete(id);
        fn(performance.now());
      }
    }, 0);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    rafCallbacks.delete(id);
  };
}
