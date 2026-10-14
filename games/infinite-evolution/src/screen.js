// ============================================
//  无限进化 V2.0 — 屏幕自适应缩放
//  根据窗口尺寸等比缩放 canvas
// ============================================

const GAME_W = 1280;
const GAME_H = 720;

let scale = 1;

export function setupScreen() {
  const canvas = document.getElementById('game');
  if (!canvas) {
    console.error('[screen] canvas#game not found');
    return;
  }
  applyScale();
  window.addEventListener('resize', applyScale);
}

function applyScale() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const scaleX = winW / GAME_W;
  const scaleY = winH / GAME_H;
  scale = Math.min(scaleX, scaleY);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

export function getScale() {
  return scale;
}
