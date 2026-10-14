import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GAME_BASE || './',
  server: {
    host: '0.0.0.0',
    port: 5180
  }
});
