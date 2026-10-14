import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GAME_BASE || "/",
  server: { port: 8080, host: true },
  build: { outDir: "dist", target: "es2020" },
  test: {
    include: ["tests/**/*.spec.ts"],
    environment: "node",
  },
});
