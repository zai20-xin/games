import { chromium } from 'playwright';

const url = 'http://localhost:5173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.keyboard.press('Space');           // 开始对局
await page.waitForTimeout(1500);              // 过倒计时

const stats = await page.evaluate(() => new Promise(resolve => {
  const samples = [];
  let last = performance.now();
  const start = last;
  function tick(t) {
    const dt = t - last; last = t;
    samples.push(dt);
    if (t - start < 5000) requestAnimationFrame(tick);
    else {
      const s = [...samples].sort((a, b) => a - b);
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      const max = s[s.length - 1];
      const p99 = s[Math.floor(s.length * 0.99)];
      const big = samples.filter(d => d > 40).length;     // >40ms 视为卡顿帧
      const huge = samples.filter(d => d > 80).length;
      resolve({ count: samples.length, avgMs: +avg.toFixed(2), avgFps: +(1000 / avg).toFixed(1), maxMs: +max.toFixed(1), p99Ms: +p99.toFixed(1), bigCount: big, hugeCount: huge });
    }
  }
  requestAnimationFrame(tick);
}));

console.log('FRAME STATS:', JSON.stringify(stats));
if (errors.length) console.log('PAGE ERRORS:', errors.slice(0, 5).join(' | '));
await browser.close();
