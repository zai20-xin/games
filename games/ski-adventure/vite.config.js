import { defineConfig } from 'vite';

// 滑雪大冒险 · 构建配置
// - dev:   vite（HMR 开发服务器，默认 http://localhost:5173）
// - build: vite build → dist/（可部署的静态产物）
export default defineConfig({
  base: process.env.GAME_BASE || './',
  server: {
    host: true,
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
