// ================================================================
// Vitest 配置 - 启用 Jest 风格全局 API（describe / test / expect / jest）
// 解决现有测试文件使用 Jest 风格全局但未在 vite.config.js 中开启的问题
// ================================================================
import { defineConfig } from 'vitest/config';
import { vi } from 'vitest';

// 在 node 环境下把 jest 映射到 vi（兼容现有 UiAnimator 测试的 jest.fn()）
if (typeof globalThis.jest === 'undefined' && typeof vi !== 'undefined') {
  globalThis.jest = vi;
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.js'],
  },
});
