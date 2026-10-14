// input.js —— 键盘 / 触摸 / 鼠标输入 → 玩家动作
import { canvas } from './canvas.js';
import * as audio from './audio.js';
import { game, player, startGame, moveLane, doJump, doCrouch, addFallTap, togglePause } from './state.js';
import * as snowfight from './snowfight.js';

// held：持续状态（由 entities 每帧读取）
//   down：长按蹲下；left/right：空中特技旋转方向；jump：跳跃键是否按住（可变跳跃高度）
export const held = { down: false, left: false, right: false, jump: false };

function shopOpen() { return document.getElementById('shop').classList.contains('show'); }

export function bindInput() {
  let suppressClick = 0;

  window.addEventListener('keydown', (e) => {
    audio.initAudio();
    // 欢乐打雪仗：独立输入路由
    if (game.state === 'snowfight') {
      const k = e.key;
      if (k === ' ' || k === 'Enter') { snowfight.throwBall(); e.preventDefault(); }
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { snowfight.moveLeft(true); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { snowfight.moveRight(true); e.preventDefault(); }
      else if (k === 'u' || k === 'U') { snowfight.upgrade(); e.preventDefault(); }
      else if (k === 'Escape' || k === 'p' || k === 'P') { snowfight.togglePauseFight(); e.preventDefault(); }
      return;
    }
    if (game.fallT > 0) { addFallTap(); return; }
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { moveLane(-1); held.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { moveLane(1); held.right = true; e.preventDefault(); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') { doJump(); held.jump = true; e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { doCrouch(); held.down = true; e.preventDefault(); }
    else if (k === ' ' || k === 'Enter') {
      if (shopOpen()) return;
      if (game.state === 'over' || game.state === 'menu') startGame();
      else if (game.state === 'playing') { doJump(); held.jump = true; }
      e.preventDefault();
    } else if (k === 'Escape' || k === 'p' || k === 'P') {
      if (game.state === 'playing' || game.state === 'paused') togglePause();
    } else if (k === 'r' || k === 'R') {
      // R：结算/暂停界面快速重开
      if (game.state === 'over' || game.state === 'paused') startGame();
    } else if (k === 'm' || k === 'M') {
      audio.toggleMute();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key;
    if (game.state === 'snowfight') {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') snowfight.moveLeft(false);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') snowfight.moveRight(false);
      return;
    }
    if (k === 'ArrowDown' || k === 's' || k === 'S') held.down = false;
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') held.left = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') held.right = false;
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ' || k === 'Enter') { held.jump = false; player.jumpHeld = false; }
  });

  let touchX = null, touchY = null;
  canvas.addEventListener('touchstart', (e) => {
    audio.initAudio();
    // 欢乐打雪仗：点屏投球（移动由屏幕按钮负责）
    if (game.state === 'snowfight') {
      if (e.touches && e.touches[0]) { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }
      return;
    }
    if (game.fallT > 0) { addFallTap(); return; }
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    // 欢乐打雪仗：轻点投球
    if (game.state === 'snowfight') {
      if (touchX !== null && e.changedTouches && e.changedTouches[0]) {
        const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) snowfight.throwBall();
      }
      touchX = null; touchY = null;
      return;
    }
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      // 点击即跳 / 结算重开
      suppressClick = performance.now() + 500;
      if (game.state === 'playing') doJump();
      else if (game.state === 'over' && !shopOpen()) startGame();
    } else if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) doJump(); else doCrouch();
    } else if (Math.abs(dx) > 30) {
      moveLane(dx > 0 ? 1 : -1);
    }
    touchX = null; touchY = null;
  }, { passive: true });

  canvas.addEventListener('click', () => {
    if (performance.now() < suppressClick) return;
    audio.initAudio();
    if (game.state === 'snowfight') { snowfight.throwBall(); return; }
    if (game.state === 'over' && !shopOpen()) startGame();
    else if (game.state === 'playing') doJump();
  });
}
