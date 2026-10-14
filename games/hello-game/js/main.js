const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

// 最高分存档（<id>:save）
const SAVE_KEY = "hello-game:save";
function loadBest() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY))?.best ?? 0; } catch { return 0; }
}
function saveBest(v) {
  if (v > loadBest()) localStorage.setItem(SAVE_KEY, JSON.stringify({ best: v }));
}
let best = loadBest();

const keys = new Set();
addEventListener("keydown", (e) => keys.add(e.key));
addEventListener("keyup", (e) => keys.delete(e.key));

const paddle = { w: 90, h: 12, x: W / 2 - 45 };
const ball = { x: W / 2, y: 120, vx: 4, vy: 3.2, r: 8 };
let score = 0;
let misses = 0;

function resetBall() {
  ball.x = W / 2;
  ball.y = 100;
  ball.vx = Math.random() > 0.5 ? 4 : -4;
  ball.vy = 3.2;
}

function update() {
  if (keys.has("ArrowLeft")) paddle.x -= 7;
  if (keys.has("ArrowRight")) paddle.x += 7;
  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < ball.r || ball.x > W - ball.r) ball.vx *= -1;
  if (ball.y < ball.r) ball.vy *= -1;

  const onPaddle =
    ball.vy > 0 &&
    ball.y + ball.r >= H - 30 &&
    ball.y + ball.r <= H - 30 + paddle.h + 6 &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.w;

  if (onPaddle) {
    ball.vy *= -1;
    score++;
    if (score > best) { best = score; saveBest(best); }
    const speedUp = 1.03;
    ball.vx *= speedUp;
    ball.vy *= speedUp;
  }

  if (ball.y > H + ball.r * 2) {
    misses++;
    resetBall();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#e8ebf2";
  ctx.fillRect(paddle.x, H - 30, paddle.w, paddle.h);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#4c8dff";
  ctx.fill();

  ctx.fillStyle = "#8b93a7";
  ctx.font = "14px ui-monospace, monospace";
  ctx.fillText(`得分 ${score}   掉落 ${misses}   最佳 ${best}`, 16, 24);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
