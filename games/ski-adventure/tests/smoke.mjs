// 运行时冒烟测试：加载构建产物，校验菜单/商城/开局/暂停/输入，全程 0 pageerror。
// 运行：npm run test:smoke（内部先 build 再跑）
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  cwd: process.cwd(), stdio: 'ignore',
});
await new Promise(r => setTimeout(r, 1600));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const menuShown = await page.$eval('#menu', el => el.classList.contains('show'));
  console.log('1 menu shown:', menuShown);

  await page.click('#shopBtn');
  await page.waitForTimeout(200);
  const shopShown = await page.$eval('#shop', el => el.classList.contains('show'));
  console.log('2 shop shown:', shopShown);
  await page.click('#shopClose');
  await page.waitForTimeout(200);

  await page.click('#startBtn');
  await page.waitForTimeout(400);
  const menuHidden = !(await page.$eval('#menu', el => el.classList.contains('show')));
  console.log('3 menu hidden after start:', menuHidden);

  await page.waitForTimeout(3500);
  const dist = await page.$eval('#dist', el => el.textContent);
  const score = await page.$eval('#score', el => el.textContent);
  console.log('4 dist after run:', dist, '| score:', score);

  await page.keyboard.press('p');
  await page.waitForTimeout(250);
  const paused = await page.$eval('#pause', el => el.classList.contains('show'));
  console.log('5 paused:', paused);
  await page.keyboard.press('p');
  await page.waitForTimeout(250);
  const resumed = !(await page.$eval('#pause', el => el.classList.contains('show')));
  console.log('6 resumed:', resumed);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(600);

  console.log('7 page errors:', errors.length);
  if (errors.length) console.log(errors.join('\n'));
  const dist2 = await page.$eval('#dist', el => el.textContent);
  console.log('8 dist final:', dist2, '(>0 =', Number(dist2) > 0, ')');

  const pass = menuShown && shopShown && menuHidden && Number(dist) > 0 && paused && resumed && errors.length === 0;
  console.log('\nSMOKE RESULT:', pass ? 'PASS' : 'FAIL');
  process.exitCode = pass ? 0 : 1;
} catch (e) {
  console.error('SMOKE ERROR:', e.message);
  console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
