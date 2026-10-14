import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: process.env.GAME_BASE || (command === 'serve' ? '/' : './'),
  server: { port: 5173, host: '127.0.0.1' },
  build: { target: 'es2020', sourcemap: true }
}));
