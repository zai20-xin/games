import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// base 由 GAME_BASE 注入：dev 走 dashboard 代理前缀（/g/<id>/），build 用相对路径
// viteSingleFile 只在 build 启用——它会在 dev 的 HTML transform 里覆盖 base 前缀注入，
// 导致 <script src> 退化为根路径，经 dashboard 代理后 404。dev 必须禁用它。
export default defineConfig(({ command }) => ({
  base: process.env.GAME_BASE || (command === "build" ? "./" : "/"),
  plugins: command === "build" ? [viteSingleFile()] : [],
  server: { strictPort: true, host: "127.0.0.1" },
  build: {
    // 单文件构建：JS/CSS/图片内联进 index.html，产物可离线自包含
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100000,
  },
}));