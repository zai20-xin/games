/* 最小 DOM 桩：驱动应用层，做「无异常 + 关键状态流转」冒烟
 * 架构拆分（§23）后加载 js/app.js（运行时），结构/样式断言合并 index.html + css/style.css + js/*.js
 * 用法：node test/ui-smoke.cjs   （零依赖，退出码 0 = 全绿）
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const engineScript = fs.readFileSync(path.join(ROOT, 'js/engine.js'), 'utf8');
const appScript = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
// 浏览器按 <script src> 顺序加载：engine 先、app 后（var LifeEngine 全局供 app 闭包引用）
// 冒烟等价复现：拼接两段在同一作用域执行
const bootScript = engineScript + '\n;\n' + appScript;
// 合并所有源文件，供正则结构/样式断言复用（原 html 变量语义）
const html = ['index.html', 'css/style.css', 'js/engine.js', 'js/app.js']
  .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

const els = new Map();
const results = [];
function check(name, ok, extra) { results.push({ name, ok }); console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  [' + extra + ']' : '')); }
function mkClassList() {
  const set = new Set();
  return { add: (...c) => c.forEach((x) => set.add(x)), remove: (...c) => c.forEach((x) => set.delete(x)),
    toggle: (c, on) => { const v = on === undefined ? !set.has(c) : !!on; v ? set.add(c) : set.delete(c); return v; },
    contains: (c) => set.has(c) };
}
const CTX_PROPS = new Set(['fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap', 'globalAlpha',
  'globalCompositeOperation', 'imageSmoothingEnabled', 'filter', 'font', 'textAlign', 'textBaseline',
  'shadowBlur', 'shadowColor', 'miterLimit', 'direction']);
function ctxStub() {
  const noop = () => {};
  const t = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    setLineDash: noop, measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    toDataURL: (type) => 'data:' + (type || 'image/png') + ';base64,dGVzdA==',
  };
  return new Proxy(t, {
    get(o, k) { if (k in o) return o[k]; if (CTX_PROPS.has(k)) return o['_p_' + k] ?? ''; return noop; },
    set(o, k, v) { o['_p_' + k] = v; o[k] = v; return true; },
  });
}
function mkEl(id) {
  const el = {
    id: id || '', tagName: 'DIV', hidden: false, textContent: '', innerHTML: '', value: '',
    width: 300, height: 150, dataset: {}, children: [], style: {}, _events: {},
    clientWidth: 800, clientHeight: 600, offsetWidth: 100, offsetHeight: 100,
    getContext: () => ctxStub(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
    setAttribute(k, v) { el['_attr_' + k] = v; if (k === 'hidden') el.hidden = true; if (k.indexOf('data-') === 0) el.dataset[k.slice(5)] = v; },
    getAttribute(k) { return el['_attr_' + k]; },
    removeAttribute(k) { delete el['_attr_' + k]; if (k === 'hidden') el.hidden = false; },
    appendChild(c) { el.children.push(c); return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; },
    click() { (el._events.click || []).forEach((fn) => fn({})); },
    toDataURL(type) { return 'data:' + (type || 'image/png') + ';base64,dGVzdA=='; },
    querySelector(sel) {
      const m = /\[data-id="([^"]+)"\]/.exec(sel);
      if (m) {
        const want = m[1];
        const walk = (nodes) => {
          for (const n of nodes) {
            if (n.dataset && n.dataset.id === want) return n;
            if (n.children && n.children.length) { const f = walk(n.children); if (f) return f; }
          }
          return null;
        };
        return walk(el.children);
      }
      const cm = /^\.([\w-]+)$/.exec(sel);
      if (cm) return el.children.find((c) => c.classList && c.classList.contains(cm[1])) || null;
      return null;
    },
    querySelectorAll(sel) {
      if (/\[data-id/.test(sel)) return el.children.filter((c) => c.dataset && c.dataset.id);
      if (/^\.slot$|\.slot/.test(sel)) return el.children.flatMap((c) => c.children || []).filter((c) => c.classList && c.classList.contains('slot'));
      if (sel === '[data-tier-got]') return el.children.filter((c) => c.getAttribute && c.getAttribute('data-tier-got'));
      return [];
    },
    addEventListener(t, fn) { (el._events[t] = el._events[t] || []).push(fn); },
    removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {}, focus() {}, blur() {},
    dispatch(t, ev) { (el._events[t] || []).forEach((fn) => fn(ev)); },
  };
  el.classList = mkClassList();
  let _cn = '';
  Object.defineProperty(el, 'className', {
    get: () => _cn,
    set: (v) => { _cn = String(v); _cn.split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c)); },
  });
  return el;
}
function getEl(id) { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); }

const rafQueue = [];
const intervals = new Map();
let intervalSeq = 1;
let timeouts = [];
let now = 0;

const document = {
  documentElement: mkEl('__html'),
  body: mkEl('__body'),
  getElementById: (id) => (els.has(id) ? els.get(id) : getEl(id)),
  createElement: (tag) => { const e = mkEl(''); e.tagName = String(tag).toUpperCase(); return e; },
  addEventListener: (t, fn) => { (document._ev = document._ev || {})[t] = (document._ev[t] || []).concat(fn); },
  _ev: {},
  dispatch(t, ev) { (document._ev[t] || []).forEach((fn) => fn(ev)); },
};
document.documentElement.setAttribute = (k, v) => { document.documentElement['_attr_' + k] = v; };

const window = {
  innerWidth: 900, innerHeight: 700, devicePixelRatio: 2,
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  addEventListener: (t, fn) => { (window._ev = window._ev || {})[t] = (window._ev[t] || []).concat(fn); },
  _ev: {},
  dispatch(t, ev) { (window._ev[t] || []).forEach((fn) => fn(ev)); },
};

global.document = document;
global.window = window;
global.navigator = { vibrate() {}, userAgent: 'node' };
global.performance = { now: () => now };
global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
global.cancelAnimationFrame = () => {};
global.setTimeout = (fn, ms) => { timeouts.push({ fn, at: now + (ms || 0) }); return timeouts.length; };
global.clearTimeout = () => {};
global.setInterval = (fn, ms) => { const id = intervalSeq++; intervals.set(id, { fn, ms, next: now + ms }); return id; };
global.clearInterval = (id) => { intervals.delete(id); };
global.getComputedStyle = () => ({ getPropertyValue: (p) => ({ '--cell-a': '#5EF3C8', '--cell-b': '#A855F7', '--glow': '#37E6B0', '--bg': '#05070c', '--grid': 'rgba(255,255,255,.05)' })[p] || '' });
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };

let bootErr = null;
try { new Function(bootScript)(); } catch (e) { bootErr = e; }
console.log('boot: ' + (bootErr ? '✗ ' + bootErr.message : '✓'));

let hardErr = bootErr || null;
function drive(n, dtMs, hook) {
  for (let i = 0; i < n; i++) {
    now += dtMs;
    for (const [, iv] of intervals) { while (now >= iv.next) { iv.next += iv.ms; try { iv.fn(); } catch (e) { hardErr = hardErr || e; } } }
    for (let k = timeouts.length - 1; k >= 0; k--) { if (timeouts[k] && now >= timeouts[k].at) { const t = timeouts[k]; timeouts[k] = null; try { t.fn(); } catch (e) { hardErr = hardErr || e; } } }
    const cb = rafQueue.shift();
    if (!cb) { hardErr = hardErr || new Error('主循环中断(rAF 空)'); break; }
    try { cb(now); } catch (e) { hardErr = hardErr || e; break; }
    if (hook) hook(i);
  }
}

/* ---- A. 静态结构：v5.0 许愿卡/宇宙之卡/星野默认主题/任务与演示已移除 ---- */
check('许愿卡浮层存在（wishLayer + 输入 + chips + 生日）',
  /id="wishLayer"/.test(html) && /id="wishInput"/.test(html) && /data-wish=/.test(html) && /id="wishBday"/.test(html));
check('宇宙之卡浮层存在（cosmosLayer + 符号 canvas + 保存按钮）',
  /id="cosmosLayer"/.test(html) && /id="cosmosSymbol"/.test(html) && /id="btnCosmosSave"/.test(html));
check('默认主题为星野（html data-theme + THEMES 首位）',
  /<html lang="zh-CN" data-theme="starfield">/.test(html) && /var THEMES = \['starfield'/.test(appScript));
check('星野主题色板存在（深紫蓝 + 粉金）', /\[data-theme="starfield"\]/.test(html) && /--cell-a:#f7c873/.test(html));
check('任务条/教练/高光演示已整体移除（HTML 无 mission/coach/demoHint 节点）',
  !/id="(mission|missionLabel|coach|coachDots|demoHint|btnSwapMission)"/.test(html));
check('星尘粒子层接入渲染（drawStardust + starfield 判断）',
  /function drawStardust/.test(appScript) && /S\.theme === 'starfield'/.test(appScript));
/* v5.2 竖屏专属化：移动优先 + 横屏遮罩 + 抽屉底部滑入 */
check('竖屏基准：已删除 max-width:640px 桌面降级补丁', !/max-width:\s*640px/.test(html));
check('横屏遮罩存在（.rotate-hint + orientation:landscape 媒体查询）',
  /class="rotate-hint"/.test(html) && /@media \(orientation:landscape\)/.test(html));
check('符号盒抽屉改底部滑入（translateY + 顶部圆角）',
  /\.drawer\{[\s\S]*?left:0;right:0;bottom:0/.test(html) && /transform:translateY\(102%\)/.test(html));
check('iOS 输入防放大：心愿输入字号 16px', /\.wish-field input\{[\s\S]*?font-size:16px/.test(html));
check('视口用 dvh（宇宙之卡高度推导）', /100dvh/.test(html));
const dockHtml = (/<footer class="dock">([\s\S]*?)<\/footer>/.exec(html) || [, ''])[1];
check('dock 仅保留 播放/暂停 + 速度',
  /id="btnPlay"/.test(dockHtml) && /id="speed"/.test(dockHtml) && !/mission/.test(dockHtml));
check('抽屉改名符号盒', /<b>符号盒<\/b>/.test(html) && /id="btnPatterns"[^>]*>符号盒</.test(html));
check('图鉴槽位数 = 30（v5.3：20 + 10 节日/情感新符号）', getEl('dexList').querySelectorAll('.slot').length === 30,
  getEl('dexList').querySelectorAll('.slot').length + ' 个');
check('符号盒按「符号」一档分组展示', getEl('dexList').children.filter((c) => c.getAttribute && c.getAttribute('data-tier-got')).length === 1);

/* ---- B. 首屏 = 许愿卡 ---- */
check('boot 后许愿卡可见', getEl('wishLayer').hidden === false);
check('boot 后宇宙静置（running=false，等许愿启动仪式）', window.__life.S.running === false);
check('暂停态显示播放三角图标（两态可辨）', getEl('icoPlay').hidden === false && getEl('icoPause').hidden === true);

/* ---- C. 许愿 → 启动仪式 ---- */
const L = window.__life, S = L.S;
getEl('wishInput').value = '想要好运气';
getEl('wishBday').value = '1990-01-01';
getEl('btnWishGo').onclick.call(getEl('btnWishGo'), {});
check('许愿后仪式启动（ritual=true, phase=evolve）', S.ritual === true && S.ritualPhase === 'evolve', S.ritualPhase);
check('心愿映射：「好运气」→ 四叶草', S.ritualTarget && S.ritualTarget.id === 'clover', S.ritualTarget && S.ritualTarget.id);
check('心愿主题记录：好运 → luck（贯穿整局）', S.wishTheme === 'luck', String(S.wishTheme));
check('生日种子生效（seed=hashSeed(生日)）', S.ritualSeed === L.E.hashSeed('1990-01-01'), String(S.ritualSeed));
check('仪式期许愿卡收起、速度档保持可见（v5.2.1：仪式墙钟驱动，不藏控件）',
  getEl('wishLayer').hidden === true && getEl('speedWrap').style.visibility !== 'hidden');
check('仪式提示条可见（v5.4 长按注入能量引导）', getEl('ritualHint').hidden === false && /能量/.test(getEl('ritualHint').textContent), getEl('ritualHint').textContent);
check('播放/暂停图标两态区分（运行中显示暂停图标）',
  getEl('icoPlay').hidden === true && getEl('icoPause').hidden === false);

/* ---- D. 演化 → 凝形 → 宇宙之卡（全流程） ---- */
let cardFrames = 0;
drive(1600, 16.6, () => { cardFrames++; });
check('仪式走完进入 card 阶段（≤1600 帧内）', S.ritualPhase === 'card', S.ritualPhase + ' @' + cardFrames);
check('宇宙之卡弹出（cosmosLayer 可见）', getEl('cosmosLayer').hidden === false);
check('卡面心愿回显', /想要好运气/.test(getEl('cosmosWish').textContent), getEl('cosmosWish').textContent);
check('卡面有签文', getEl('cosmosFortune').textContent.length >= 4, getEl('cosmosFortune').textContent);
check('卡面签文拼入心愿原话（独一无二）', /想要好运气/.test(getEl('cosmosFortune').textContent), getEl('cosmosFortune').textContent);
check('卡面渐变按主题色系变化（cosmosCard 内联背景）', /linear-gradient/.test(String(getEl('cosmosCard').style.background)), getEl('cosmosCard').style.background);
check('卡面宇宙编号 = 生日（传播钩子）', /NO\.19900101/.test(getEl('cosmosMeta').textContent), getEl('cosmosMeta').textContent);
check('凝出的符号点亮符号盒（found.clover）', S.found['clover'] === true);
check('仪式凝形不占普通定格（freezeBar 未显示）', !getEl('freezeBar').classList.contains('show'));
check('成卡后宇宙暂停（定格欣赏）', S.running === false);

/* ---- E. 确定性：同生日 → 同宇宙 ---- */
const seedA = S.ritualSeed, tgtA = S.ritualTarget.id, durA = S.ritualEvolveDur, fortA = S.ritualFortune;
L.startRitual('想要好运气', '1990-01-01');
check('同生日同心愿 → 同种子/同符号/同演化时长', S.ritualSeed === seedA && S.ritualTarget.id === tgtA && S.ritualEvolveDur === durA, seedA + '/' + tgtA);
L.startRitual('想要好运气', '1990-01-02');
check('不同生日 → 不同种子', S.ritualSeed !== seedA, String(S.ritualSeed));
L.startRitual('随便', '');
const r1 = S.ritualSeed;
L.startRitual('随便', '');
check('无生日 → 随机种子（两次大概率不同）', r1 !== S.ritualSeed, r1 + ' vs ' + S.ritualSeed);

/* ---- F. 卡片出口 ---- */
L.showCosmosCard();
check('showCosmosCard 可直接弹卡', getEl('cosmosLayer').hidden === false && getEl('cosmosFortune').textContent.length >= 4, getEl('cosmosFortune').textContent);
getEl('btnCosmosClose').onclick.call(getEl('btnCosmosClose'), {});
check('「继续看宇宙」退出仪式：running 恢复、速度档可见', S.ritual === false && S.running === true && getEl('speedWrap').style.visibility !== 'hidden');
L.startRitual('爱意满满', '');
L.showCosmosCard();
getEl('btnCosmosAgain').onclick.call(getEl('btnCosmosAgain'), {});
check('「再许一愿」回到许愿卡', S.ritual === false && getEl('wishLayer').hidden === false && S.running === false);
getEl('btnWishSkip').onclick.call(getEl('btnWishSkip'), {});
check('跳过按钮 → 随机降级也启动仪式', S.ritual === true && !!S.ritualWish, S.ritualWish);
getEl('btnCosmosClose').onclick.call(getEl('btnCosmosClose'), {});
drive(120, 16.6);

/* ---- G. 导出图片 ---- */
let exportErr = null, dataURL = '';
try {
  S.ritualTarget = L.E.PATTERN_INDEX['heart']; S.ritualWish = '测试'; S.ritualSeed = 123; S.ritualBday = '';
  dataURL = L.renderCardToCanvas().toDataURL('image/png');
  getEl('btnCosmosSave').onclick.call(getEl('btnCosmosSave'), {});
} catch (e) { exportErr = e; }
check('renderCardToCanvas 产出 PNG dataURL', /^data:image\/png/.test(dataURL), dataURL.slice(0, 24));
check('保存图片按钮点击无异常', !exportErr, exportErr ? exportErr.message : '');
check('宇宙编号（无生日）用种子码', /^NO\.[0-9A-Z]{1,6}$/.test(L.universeCode()), L.universeCode());

/* ---- H. 清空 → 符号放置即收集（符号盒路径保留） ---- */
document.dispatch('keydown', { key: 'c', code: '', target: { tagName: 'BODY' }, preventDefault() {} });
check('主动清空后给出空状态轻提示', /网格空了/.test(getEl('toast').textContent), getEl('toast').textContent);
const heartSlot = [...getEl('dexList').querySelectorAll('.slot')].find((c) => c.querySelector('.n') && c.querySelector('.n').textContent === '爱心');
check('符号盒含「爱心」条目', !!heartSlot);
const dexBeforeSym = getEl('dexCount').textContent;
if (heartSlot) {
  heartSlot.dispatch('click', {});
  check('点击符号进入放置模式', !!(S.placing && S.placing.pattern.id === 'heart'));
  getEl('board').dispatch('pointerdown', { pointerId: 1, clientX: 150, clientY: 150, button: 0, pointerType: 'mouse', shiftKey: false });
  getEl('board').dispatch('pointerup', { pointerId: 1 });
}
check('放置「爱心」后立即收入符号盒（found 置位）', S.found['heart'] === true);
check('放置符号后计数增加', getEl('dexCount').textContent !== dexBeforeSym, dexBeforeSym + ' → ' + getEl('dexCount').textContent);
check('符号槽位点亮为已收集', !!(heartSlot && heartSlot.classList.contains('on')));
check('收集持久化已写入 localStorage', !!store['life.found'], store['life.found']);

/* ---- I. 大白话文案 ---- */
const heartSlot2 = [...getEl('dexList').querySelectorAll('.slot')].find((c) => c.querySelector('.n') && c.querySelector('.n').textContent === '爱心');
if (heartSlot2) heartSlot2.dispatch('mouseenter', {});
check('符号盒详情区展示大白话描述（静物符号）',
  getEl('dexDetail').hidden === false && /落定后就不再变化/.test(getEl('dxDesc').textContent) && !/周期|摆动|振荡/.test(getEl('dxDesc').textContent),
  getEl('dxDesc').textContent);
check('详情区带档位徽章与大白话类型', getEl('dxBadge').textContent === '符号' && getEl('dxType').textContent === '静止不动',
  getEl('dxBadge').textContent + ' / ' + getEl('dxType').textContent);
check('符号盒底部展示收集进度（任务/连胜已移除）', /已收集 \d+\/30 个符号/.test(getEl('bestRec').textContent), getEl('bestRec').textContent);

/* ---- J. 交互冒烟 ---- */
let ierr = null;
const clicks = ['btnPlay', 'btnPatterns', 'btnCloseDrawer', 'btnWhat', 'btnCloseModal',
  'btnTheme', 'btnTheme', 'btnTheme', 'btnTheme', 'btnFreezeGo', 'btnCosmosSave', 'btnCosmosAgain', 'btnCosmosClose'];
for (const id of clicks) { try { const el = getEl(id); if (typeof el.onclick === 'function') el.onclick.call(el, {}); } catch (e) { ierr = ierr || new Error(id + ': ' + e.message); } }
check('主题四档循环回星野（4 次点击）', S.theme === 'starfield', S.theme);
for (const k of [' ', 'ArrowRight', 'n', 'r', 'c', '=', '-', 'Escape']) {
  try { document.dispatch('keydown', { key: k, code: k === ' ' ? 'Space' : '', target: { tagName: 'BODY' }, preventDefault() {} }); } catch (e) { ierr = ierr || new Error('key ' + k + ': ' + e.message); }
}
try {
  const b = getEl('board');
  b.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', shiftKey: false });
  b.dispatch('pointermove', { pointerId: 1, clientX: 140, clientY: 130 });
  b.dispatch('pointerup', { pointerId: 1 });
  b.dispatch('wheel', { deltaY: -1, preventDefault() {} });
  b.dispatch('contextmenu', { preventDefault() {} });
} catch (e) { ierr = ierr || new Error('pointer: ' + e.message); }
check('按钮/快捷键/指针交互无异常', !ierr, ierr ? ierr.message : clicks.length + ' 按钮 + 8 快捷键 + 指针');

/* ---- K. 仪式期画布不接受涂画 ---- */
L.startRitual('测试', '');
{
  const liveBefore = S.live;
  getEl('board').dispatch('pointerdown', { pointerId: 2, clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', shiftKey: false });
  getEl('board').dispatch('pointerup', { pointerId: 2 });
  check('仪式期间 pointerdown 被忽略（不干扰剧本）', S.live === liveBefore, liveBefore + ' → ' + S.live);
}
getEl('btnCosmosClose').onclick.call(getEl('btnCosmosClose'), {});
S.ritual = false;   // 强制收尾（此时无卡，exitRitual 幂等）

/* ---- L. 流星激活（整屏进入循环/静止 → 投流星重燃宇宙） ---- */
{
  check('测试钩子 window.__life 可用', !!L && !!L.S && typeof L.spawnMeteorShower === 'function');
  S.ritual = false; S.autoSeed = true;   // 本段直接测流星机制，确保未被仪式关闭
  L.clearGrid();
  // 铺满孤立 block（静物 → 整屏必然静止）
  for (let y = 1; y < S.rows - 1; y += 3)
    for (let x = 1; x < S.cols - 1; x += 3) {
      S.cur[y * S.cols + x] = 1; S.cur[y * S.cols + x + 1] = 1;
      S.cur[(y + 1) * S.cols + x] = 1; S.cur[(y + 1) * S.cols + x + 1] = 1;
    }
  S.live = 0; for (let i = 0; i < S.cur.length; i++) if (S.cur[i]) S.live++;
  S.keys.length = 0; S.calloutKind = null;
  const liveBefore = S.live;
  for (let g = 0; g < 2; g++) L.trackStructure();
  check('整屏静止被识别（calloutKind=static）', S.calloutKind === 'static', 'kind=' + S.calloutKind);
  check('流星已投放（meteors 非空）', S.meteors.length > 0, S.meteors.length + ' 颗');
  let steps = 0;
  while (S.meteors.length > 0 && steps < 600) { L.stepMeteors(0.05); steps++; }
  check('流星全部撞击落地', S.meteors.length === 0, '推进 ' + steps + ' 帧后剩余 ' + S.meteors.length);
  check('撞击注入新生命（活细胞数增加）', S.live > liveBefore, liveBefore + ' → ' + S.live);
  check('撞击重置结构识别（keys 清空）', S.keys.length === 0, 'keys=' + S.keys.length);
}

/* ---- M. 速度档 1–1000×（指数映射 + 时间预算步进） ---- */
{
  S.running = true;
  S.speed = 12; S.gen = 0;
  drive(60, 16.6);
  const genAt12 = S.gen;
  S.speed = 1000; S.gen = 0; S.keys.length = 0;
  drive(60, 16.6);
  const genAt1000 = S.gen;
  check('1000× 档 1 秒演代数远超旧 guard=8 上限（>600 代）', genAt1000 > 600, genAt1000 + ' 代');
  check('1000× 档明显快于 12× 基线（>10 倍）', genAt1000 > genAt12 * 10, '12×=' + genAt12 + ' 1000×=' + genAt1000);
  const sv = getEl('speed');
  const fireSpeed = (val) => { sv.value = val; (sv._events.input || []).forEach((fn) => fn.call(sv, {})); };
  fireSpeed(0);
  check('滑块最左 → 1×', S.speed === 1, 'speed=' + S.speed);
  fireSpeed(100);
  check('滑块最右 → 1000×', S.speed === 1000, 'speed=' + S.speed);
  check('速度值回显 = 1000', String(getEl('speedVal').textContent) === '1000', getEl('speedVal').textContent);
  S.speed = 12;
}

/* ---- N. 混沌凝形（自由模式：30 符号加权随机凝出 → 首次定格庆祝） ---- */
{
  S.running = true;
  S.freezeId = null; S.freezeUntil = 0;
  L.clearGrid();
  // 铺一层随机汤，模拟真实演化现场
  for (let i = 0; i < S.cur.length; i++) S.cur[i] = Math.random() < 0.2 ? 1 : 0;
  S.live = 0; for (let i = 0; i < S.cur.length; i++) if (S.cur[i]) S.live++;

  // 惊喜池：多次抽样应覆盖多个符号（不再只有一颗心），且连续两次不重复
  const seen = new Set(); let consecDup = true; let prev = null;
  for (let i = 0; i < 200; i++) {
    const p = L.pickSurpriseShape(prev);
    seen.add(p.id);
    if (prev && p.id === prev) consecDup = false;
    prev = p.id;
  }
  check('惊喜池覆盖 ≥10 个符号（不再只有一颗心）', seen.size >= 10, seen.size + ' 种');
  check('传入上一个 id 时连续不重复', consecDup);

  // 心愿主题加权：许「爱意」后，love 主题符号（heart/flower/moon/snow）出现占比应显著高于无主题基线
  // 理论值（30 符号）：基线 17/83≈20%，love 加权后 51/117≈44%
  const loveSet = new Set(['heart', 'flower', 'moon', 'snow']);
  let loveBoost = 0, loveBase = 0;
  for (let i = 0; i < 400; i++) { if (loveSet.has(L.pickSurpriseShape(null, 'love').id)) loveBoost++; if (loveSet.has(L.pickSurpriseShape(null, null).id)) loveBase++; }
  check('主题加权生效：爱意主题下情感符号占比 >35%（基线约 20%）', loveBoost / 400 > 0.35, (loveBoost / 400 * 100).toFixed(0) + '% vs 基线 ' + (loveBase / 400 * 100).toFixed(0) + '%');
  check('无主题时惊喜池不受影响（基线占比 10%–32%）', loveBase / 400 > 0.1 && loveBase / 400 < 0.32, (loveBase / 400 * 100).toFixed(0) + '%');

  const shape = L.pickSurpriseShape(null);
  const expected = L.E.parsePattern(shape.rows).cells.length;   // 形状活细胞数
  S.found = {};   // 清收集状态：本段验证「首次发现」路径
  L.startCrystallize(shape);
  check('凝形已启动（S.crystal 非空）', !!(S.crystal && S.crystal.cells.length > 0), S.crystal ? S.crystal.cells.length + ' 个目标细胞' : 'null');
  check('目标细胞数 = 形状活细胞数（parsePattern 兼容 # 与 O）', S.crystal.cells.length === expected, S.crystal.cells.length + ' vs ' + expected);

  const total = S.crystal.cells.length;
  L.stepCrystal(2.5);   // 推进到中途
  const midIdx = S.crystal ? S.crystal.idx : total;
  check('凝形中途已揭示部分细胞（0 < idx < total）', midIdx > 0 && midIdx < total, 'idx=' + midIdx + '/' + total);
  let steps = 0;
  while (S.crystal && steps < 100) { L.stepCrystal(0.5); steps++; }
  check('凝形完成（S.crystal 清空）', !S.crystal);
  check('首次凝出 → 定格已触发（freezeBar 显示）', getEl('freezeBar').classList.contains('show'));
  check('定格标注为稀有档', getEl('freezeBadge').textContent === '稀有', getEl('freezeBadge').textContent);
  check('定格名称 = 凝出的符号名', getEl('freezeName').textContent === shape.name, getEl('freezeName').textContent);
  check('首次凝出点亮符号盒（found 置位）', S.found[shape.id] === true, shape.id);
  check('记录 lastSurpriseId（下次不重复）', S.lastSurpriseId === shape.id, String(S.lastSurpriseId));
  check('凝形后宇宙暂停', S.running === false);

  // 凝出的符号：所有目标细胞已钉活（Life 啃不动，形状稳定）
  let pinnedAlive = 0;
  for (const k in S.pinned) if (S.cur[+k]) pinnedAlive++;
  check('凝出的符号全部细胞钉活（稳定不塌）', Object.keys(S.pinned).length === total && pinnedAlive === total, pinnedAlive + '/' + total);

  // 继续 → 恢复演化，符号仍在（pinned 不清）
  getEl('btnFreezeGo').onclick && getEl('btnFreezeGo').onclick.call(getEl('btnFreezeGo'), {});
  check('点「继续」恢复演化', S.running === true && !getEl('freezeBar').classList.contains('show'));
  check('继续后凝出的符号仍留在宇宙里', Object.keys(S.pinned).length === total);

  // 重复凝出同一符号 → 只轻提示、不定格、不暂停（宇宙不停）
  S.freezeId = null; S.freezeUntil = 0;
  L.startCrystallize(shape);
  while (S.crystal) L.stepCrystal(0.5);
  check('重复凝出：不触发定格', !getEl('freezeBar').classList.contains('show'));
  check('重复凝出：宇宙保持演化（不停）', S.running === true);
  check('重复凝出：轻提示文案', /又凝出/.test(getEl('toast').textContent), getEl('toast').textContent);

  // 第二颗不同符号凝出时，第一颗应溶掉（一次只留一个发现，不堆积）
  const firstMark = S.crystalMark.slice();
  const shape2 = L.pickSurpriseShape(S.lastSurpriseId);
  L.startCrystallize(shape2);
  check('第二次凝形启动时第一颗已溶掉（一次只留一个发现）',
    firstMark.every((i) => !(i in S.pinned)));
  while (S.crystal) L.stepCrystal(0.5);   // 走完第二颗
  L.clearGrid();
  check('清空后钉活/凝形状态全部复位', Object.keys(S.pinned).length === 0 && !S.crystal && S.crystalMark.length === 0);
}

/* ---- P. 首字母降级为卡面印章（v5.4：不再凝字母，等半天看字母没有情绪回报） ---- */
{
  getEl('wishInput').value = '想要好运';
  getEl('wishLetter').value = 'k';
  getEl('btnWishGo').onclick.call(getEl('btnWishGo'), {});
  check('填字母后仪式目标仍是情感符号（v5.4 降级：不凝字母）',
    S.ritual === true && !/^letter_/.test(S.ritualTarget.id), S.ritualTarget.id);
  check('字母大写记录为 ritualLetter（只印卡）', S.ritualLetter === 'K', String(S.ritualLetter));
  check('心愿仍决定主题（好运 → luck）', S.wishTheme === 'luck', String(S.wishTheme));
  drive(1600, 16.6);
  check('仪式走完成卡', S.ritualPhase === 'card' && getEl('cosmosLayer').hidden === false, S.ritualPhase);
  check('卡面印章显示 K', getEl('cosmosStamp').hidden === false && getEl('cosmosStamp').textContent === 'K', getEl('cosmosStamp').textContent);
  check('卡面 meta 不再出现「凝出字母」文案', !/凝出了/.test(getEl('cosmosMeta').textContent), getEl('cosmosMeta').textContent);
  check('背景纹理 canvas 已接入（cosmosTexture）', /id="cosmosTexture"/.test(html));
  getEl('btnCosmosClose').onclick.call(getEl('btnCosmosClose'), {});
  // 非法字母仍被拦截
  getEl('wishLetter').value = '1';
  getEl('wishInput').value = '测试';
  getEl('btnWishGo').onclick.call(getEl('btnWishGo'), {});
  check('非法首字母拦截（toast 提示且不启动仪式）', S.ritual === false && /A–Z/.test(getEl('toast').textContent), getEl('toast').textContent);
  getEl('wishLetter').value = '';
  // 不填字母 → 印章隐藏
  getEl('wishInput').value = '想要好运';
  getEl('btnWishGo').onclick.call(getEl('btnWishGo'), {});
  drive(1600, 16.6);
  check('不填字母时印章隐藏', getEl('cosmosStamp').hidden === true);
  getEl('btnCosmosClose').onclick.call(getEl('btnCosmosClose'), {});
}

/* ---- Q. 光爆与长按能量（v5.4） ---- */
{
  check('光爆函数与闪光层接入（crystalBurst + #flash + rings 状态）',
    /function crystalBurst/.test(appScript) && /id="flash"/.test(html) && /rings: \[\]/.test(appScript));
  check('长按能量接入：pointerdown 置 ritualHold、frame 用 speedEff 加速',
    /S\.ritualHold = true/.test(appScript) && /speedEff/.test(appScript));
  // 启动仪式，模拟按住：能量应上升且演化加速
  getEl('wishInput').value = '想要好运';
  getEl('btnWishGo').onclick.call(getEl('btnWishGo'), {});
  const dur = S.ritualEvolveDur;
  check('演化时长已砍至 4–6s（v5.4 节奏）', dur >= 4 && dur <= 6, String(dur));
  const boardEl = getEl('board');
  boardEl.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, button: 0, pointerType: 'mouse' });
  drive(30, 16.6);   // ~0.5s 按住
  check('按住注入能量：ritualEnergy 上升', S.ritualEnergy > 0.3, String(S.ritualEnergy));
  check('能量态提示条发光（.energy）', getEl('ritualHint').classList.contains('energy'));
  boardEl.dispatch('pointerup', { pointerId: 1, pointerType: 'mouse' });
  drive(60, 16.6);
  check('松手能量回落', S.ritualEnergy < 0.1, String(S.ritualEnergy));
  check('凝形时长 2.5s（startCrystallize dur）', /startCrystallize\(S\.ritualTarget, S\.ritualRng, 2\.5\)/.test(appScript));
  // 走完仪式触发光爆：rings 应出现
  drive(1600, 16.6);
  check('成卡（光爆 700ms 延迟后出卡）', S.ritualPhase === 'card', S.ritualPhase);
  getEl('btnCosmosClose').onclick.call(getEl('btnCosmosClose'), {});
}

/* ---- O. 二次启动（读持久化） ---- */
const dexSaved = getEl('dexCount').textContent;
let boot2 = null;
try { new Function(bootScript)(); } catch (e) { boot2 = e; }
check('二次启动无异常', !boot2, boot2 ? boot2.message : '');
check('刷新后符号盒收集保留', getEl('dexCount').textContent === dexSaved || !/^0\//.test(getEl('dexCount').textContent), getEl('dexCount').textContent);
check('刷新后仍首屏进许愿卡', window.__life.S.running === false);
drive(300, 16.6);
check('二次主循环无异常', !hardErr, hardErr ? hardErr.message : '');

console.log('\n==== 冒烟：' + (results.every((r) => r.ok) ? 'PASS' : 'FAIL') + ' (' + results.filter((r) => r.ok).length + '/' + results.length + ') ====');
process.exit(results.every((r) => r.ok) ? 0 : 1);
