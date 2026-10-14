// ================================================================
// 星际防线 - 入口文件
// ================================================================
import { Game } from './src/core/Game.js';
import { BackgroundRenderer } from './src/render/BackgroundRenderer.js';
import { preloadAllPixelSprites } from './src/data/PixelSprites.js';
import './style.css';

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas);

  // 初始化游戏
  game.init();

  // 预加载像素 sprite（异步：CC0 雷电 PNG 等），玩家在主菜单时即可后台完成
  preloadAllPixelSprites().catch(err => {
    console.warn('[PixelSprites] Preload failed (will retry on demand):', err);
  });

  // 响应式缩放
  game.resize();
  window.addEventListener('resize', () => game.resize());

  // 主菜单背景渲染（视差星空）
  const bgCanvas = document.getElementById('bgCanvas');
  const bgRenderer = new BackgroundRenderer(bgCanvas);
  window.addEventListener('resize', () => bgRenderer._resize());

  // 暴露到 game 上，便于按 overlay 显隐控制启停
  game.bgRenderer = bgRenderer;

  // ─────────────────────────────────────────────
  //  元游戏循环（科技树 / 星尘）桥接
  // ─────────────────────────────────────────────
  // 暴露 profile 供 e2e 测试与调试
  game.profile = game.meta ? game.meta.getProfile() : null;
  // 注入 eventBus 到 meta 以便后续 broadcast meta:buffsChanged
  if (game.meta && game.eventBus && typeof game.meta.setEventBus === 'function') {
    game.meta.setEventBus(game.eventBus);
  }

  // 顶部 HUD 星尘显示（仅在有元素时刷新）
  const refreshStardustHud = () => {
    const el = document.getElementById('stardustDisplay');
    if (el && game.meta) {
      el.textContent = String(game.meta.getStardust() || 0);
    }
  };
  refreshStardustHud();
  // 监听 localStorage 变更 + 定时轻刷新（星尘变动后）
  window.addEventListener('storage', refreshStardustHud);
  setInterval(refreshStardustHud, 1500);

  // 桥接：星际图谱菜单按钮 → 打开 OverlayManager.showTechTree
  if (game.overlayManager && typeof game.overlayManager.setShowTechTreeCallback === 'function') {
    game.overlayManager.setShowTechTreeCallback(() => {
      const overlay = game.overlayManager;
      const meta = game.meta;
      const profile = meta ? meta.getProfile() : (game.profile || null);
      if (!profile) {
        overlay.showStartScreen(0);
        return;
      }
      overlay.showTechTree({
        profile,
        meta,
        onBack: () => {
          // 返回主菜单时同步刷新星尘 HUD
          refreshStardustHud();
          overlay.showStartScreen(meta ? meta.getStardust() : (profile.stardust || 0));
        },
      });
    });
  }

  // 暴露到 window 上便于 e2e 测试
  window.__game__ = game;
  // 暴露常量
  import('./src/data/TowerTypes.js').then(m => { window.__TOWER_TYPES__ = m.TOWER_TYPES; });
  // 暴露科技树常量
  import('./src/data/TechTree.js').then(m => { window.__TECH_TREE__ = m.TECH_TREE; });

  // 主菜单 / 关卡选择界面显示时：背景激活
  // 游戏中：背景隐藏，节省性能
  const showBg = () => {
    bgRenderer._resize();
    bgCanvas.classList.add('active');
    bgCanvas.classList.remove('hidden');
    bgRenderer.start();
  };
  const hideBg = () => {
    bgCanvas.classList.remove('active');
    bgCanvas.classList.add('hidden');
    bgRenderer.stop();
  };

  // 初始显示主菜单 → 启动背景
  showBg();

  // 监听 overlay / levelSelect 显隐
  const overlay = document.getElementById('overlay');
  const levelSelect = document.getElementById('levelSelect');
  const observer = new MutationObserver(() => {
    const overlayVisible = !overlay.classList.contains('hidden');
    const levelSelectVisible = !levelSelect.classList.contains('hidden');
    if (overlayVisible || levelSelectVisible) {
      if (!bgRenderer.running) showBg();
    } else {
      hideBg();
    }
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  observer.observe(levelSelect, { attributes: true, attributeFilter: ['class'] });
});
