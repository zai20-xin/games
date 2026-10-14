import { defineConfig, type Plugin } from "vite";

/**
 * 经面板代理（GAME_BASE 模式）访问时，代理不转发 WebSocket：
 * 注入的 /@vite/client 会反复重连并在 console 刷 error。该模式下直接摘除 HMR 客户端。
 */
const stripHmrClientThroughProxy: Plugin = {
  name: "queens-strip-hmr-client",
  transformIndexHtml(html) {
    if (!process.env.GAME_BASE) return html;
    return html.replace(
      /<script type="module" src="[^"]*\/@vite\/client"><\/script>\s*/i,
      "",
    );
  },
};

export default defineConfig(() => {
  return {
    // 面板代理走 GAME_BASE 前缀，本地直接跑用根路径
    base: process.env.GAME_BASE || "/",
    plugins: [stripHmrClientThroughProxy],
    server: { port: 8090, host: true },
    build: {
      outDir: "dist",
      target: "es2020",
    },
    test: {
      include: ["tests/**/*.spec.ts"],
      environment: "node",
    },
  };
});
