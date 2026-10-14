import { chromium } from 'playwright';

const url = 'http://localhost:5173/';
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// 进入对局：菜单浮层会拦截画布点击，改用键盘空格触发 startGame（menu -> 倒计时 -> playing）
await page.keyboard.press('Space');
// 等过倒计时 + 障碍接近，换到 lane0 躲开 fence 以获得近景侧面视角
await page.waitForTimeout(6300);
await page.keyboard.press('ArrowLeft');
// 密集截图：fence / bar 会从玩家邻近车道经过，便于看清新绘制细节
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `tests/shot_near${i}.png` });
}

await browser.close();
console.log('screenshots saved');
