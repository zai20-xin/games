// 概率配置校验脚本：1 万次抽样验证分布
// 运行：node test/probability-validation.mjs
import { PROBABILITY, validateProbabilities, getRandomTier } from '../src/data/ProbabilityConfig.js';

const SAMPLES = 10000;

console.log('=== 1) 配置权重校验 ===');
try {
  validateProbabilities();
  console.log('✅ validateProbabilities() 通过：所有类目权重之和 = 100，3 档齐全');
} catch (e) {
  console.error('❌ 校验失败:', e.message);
  process.exit(1);
}

console.log('\n=== 2) 1 万次抽样分布验证 ===');
for (const [key, cat] of Object.entries(PROBABILITY)) {
  const counts = cat.tiers.map(() => 0);
  for (let i = 0; i < SAMPLES; i++) {
    const tier = getRandomTier(key);
    const idx = cat.tiers.findIndex((t) => t.label === tier.label);
    if (idx >= 0) counts[idx]++;
  }
  console.log(`\n[${key}] ${cat.title}:`);
  cat.tiers.forEach((t, i) => {
    const actual = (counts[i] / SAMPLES) * 100;
    const expected = t.weight;
    const diff = Math.abs(actual - expected);
    const status = diff < 2 ? '✅' : '⚠️';
    console.log(`  ${status} ${t.label.padEnd(8)} 期望 ${String(expected).padStart(3)}% | 实际 ${actual.toFixed(2)}% | 误差 ${diff.toFixed(2)}pp`);
  });
}

console.log('\n=== 3) DOM/UI 元素确认（构建产物） ===');
// 静态检查构建产物
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distAssets = join(__dirname, '..', 'dist', 'assets');
if (!existsSync(distAssets)) {
  console.log('⚠️ dist/assets 不存在，请先 npm run build');
} else {
  const cssFile = readFileSync(join(distAssets, 'index-DIYYqcfd.css'), 'utf8');
  const cssChecks = [
    ['glass-panel',         '.glass-panel 基类'],
    ['--bg-deep',           'CSS 变量 --bg-deep'],
    ['--accent-primary',    'CSS 变量 --accent-primary'],
    ['--accent-energy',     'CSS 变量 --accent-energy'],
    ['--accent-gold',       'CSS 变量 --accent-gold'],
    ['--accent-magic',      'CSS 变量 --accent-magic'],
    ['--text-primary',      'CSS 变量 --text-primary'],
    ['--text-dim',          'CSS 变量 --text-dim'],
    ['--border-glow',       'CSS 变量 --border-glow'],
    ['probability-overlay', '概率浮层样式'],
    ['probability-modal',   '概率浮层 modal'],
    ['probability-menu-btn','主菜单入口按钮'],
    ['probability-card',    '概率卡片'],
  ];
  cssChecks.forEach(([needle, label]) => {
    console.log(`  ${cssFile.includes(needle) ? '✅' : '❌'} CSS: ${label}`);
  });

  // 找最新的 JS 文件
  const { readdirSync, statSync } = await import('node:fs');
  const jsFiles = readdirSync(distAssets)
    .filter((f) => /^index-.*\.js$/.test(f))
    .map((f) => ({ f, t: statSync(join(distAssets, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (jsFiles.length === 0) {
    console.log('  ⚠️ 未找到构建的 JS 文件');
  } else {
    const jsFile = readFileSync(join(distAssets, jsFiles[0].f), 'utf8');
    const jsChecks = [
      ['__probabilityOverlay__', '自动实例化单例挂载'],
      ['probabilityMenuBtn',     '入口按钮 ID'],
      ['probabilityOverlay',     '浮层根 ID'],
      ['随机塔刷新',              '类目 1：随机塔刷新'],
      ['通关宝箱',                '类目 2：通关宝箱'],
      ['每日挑战奖励',            '类目 3：每日挑战奖励'],
    ];
    console.log(`  (JS 文件: ${jsFiles[0].f})`);
    jsChecks.forEach(([needle, label]) => {
      console.log(`  ${jsFile.includes(needle) ? '✅' : '❌'} JS: ${label}`);
    });
  }

  // index.html 检查
  const distIndex = readFileSync(join(__dirname, '..', 'dist', 'index.html'), 'utf8');
  const htmlChecks = [
    // Vite 会把 /styles/theme.css 重写为 /assets/index-*.css（bundled）
    ['assets/index-',         'CSS 资源被 Vite 打包（theme.css 已并入主 CSS）'],
    // Vite 会把 <script src="/src/ui/ProbabilityOverlay.js"> 删除/并入主 JS
    ['assets/index-',         'JS 资源被 Vite 打包（ProbabilityOverlay 已并入主 JS）'],
    ['probabilityMenuBtn',    '概率入口按钮 DOM'],
    ['id="overlay"',          '主菜单 overlay DOM（用于控制入口按钮显隐）'],
  ];
  console.log('  (dist/index.html)');
  // 用去重的 Set 避免重复打印
  const printedHtml = new Set();
  htmlChecks.forEach(([needle, label]) => {
    if (printedHtml.has(label)) return;
    printedHtml.add(label);
    console.log(`  ${distIndex.includes(needle) ? '✅' : '❌'} HTML: ${label}`);
  });

  // 额外校验：source/index.html 的两处 source-only 引用（在 dist 中被 Vite 重写）
  const srcIndex = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
  console.log('  (source/index.html)');
  const srcChecks = [
    ['/styles/theme.css',       'source: 引入 theme.css 引用'],
    ['/src/ui/ProbabilityOverlay.js', 'source: 概率浮层模块脚本'],
    ['probabilityMenuBtn',      'source: 概率入口按钮'],
  ];
  srcChecks.forEach(([needle, label]) => {
    console.log(`  ${srcIndex.includes(needle) ? '✅' : '❌'} ${label}`);
  });
}

console.log('\n=== 全部校验完成 ===');
