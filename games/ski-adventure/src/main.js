// main.js —— 启动入口：resize / 主循环 / 全局事件绑定 / 引导
import { canvas, ctx } from './canvas.js';
import * as state from './state.js';
import { initSnow, ensureSnowPattern, rebuildSkyCache, render } from './render.js';
import { update } from './entities.js';
import { updateQuests } from './quests.js';
import * as vfx from './vfx.js';
import { bindInput } from './input.js';
import { bindUi } from './ui.js';
import { loadAssets } from './assets.js';

// ---- roundRect polyfill ----
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

// ---- 视口 ----
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.setViewport(W, H);
  rebuildSkyCache();
}
window.addEventListener('resize', resize);

// ---- 失焦自动暂停 ----
document.addEventListener('visibilitychange', () => { if (document.hidden) state.autoPause(); });
window.addEventListener('blur', () => state.autoPause());

// ---- 启动 ----
resize();
initSnow();
ensureSnowPattern();
rebuildSkyCache();
bindUi();
bindInput();

loadAssets().then(() => {
  state.toMenu();
  requestAnimationFrame(loop);
}).catch(err => {
  console.error('Asset load failed:', err);
  state.toMenu();
  requestAnimationFrame(loop);
});

let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  update(dt);
  updateQuests(dt);
  vfx.update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
