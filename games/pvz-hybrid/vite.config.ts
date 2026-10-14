import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GAME_BASE || "/",
  server: { strictPort: true, host: "127.0.0.1" },
});
