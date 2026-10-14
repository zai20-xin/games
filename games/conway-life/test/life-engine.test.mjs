import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const enginePath = fileURLToPath(new URL('../js/engine.js', import.meta.url));
const src = readFileSync(enginePath, 'utf8');

// 架构拆分（§23）：引擎独立成 js/engine.js，仍保留 ENGINE-START/END 标记作契约
assert.ok(/\/\* ENGINE-START \*\//.test(src) && /\/\* ENGINE-END \*\//.test(src),
  'js/engine.js 必须保留 ENGINE-START / ENGINE-END 标记');

const eng = new Function(`${src}\nreturn LifeEngine;`)();

/* ---------- 工具 ---------- */
function gridFrom(rows, cols, gridRows, ox, oy) {
  const g = eng.createGrid(cols, gridRows);
  const p = eng.parsePattern(rows);
  for (const [x, y] of p.cells) g[(oy + y) * cols + ox + x] = 1;
  return g;
}
function cellsOf(g, cols, rows) {
  const out = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) if (g[y * cols + x]) out.push(`${x},${y}`);
  }
  return out.sort();
}
function run(g, cols, rows, times, wrap) {
  let cur = Uint8Array.from(g);
  let next = eng.createGrid(cols, rows);
  const keys = [];
  for (let i = 0; i < times; i++) {
    eng.step(cur, next, cols, rows, wrap);
    const t = cur; cur = next; next = t;
    keys.unshift(eng.gridKey(cur));
  }
  return { grid: cur, keys };
}

/* ---------- Life 核心逻辑（与图案库无关，用内联形状验证） ---------- */

test('Blinker 竖线 2 代后回到初始形态（周期 2）', () => {
  const rows = ['.O.', '.O.', '.O.'];
  const cols = 12, gridRows = 12;
  const g0 = gridFrom(rows, cols, gridRows, 4, 4);
  const { grid: g2 } = run(g0, cols, gridRows, 2, false);
  assert.deepEqual(cellsOf(g2, cols, gridRows), cellsOf(g0, cols, gridRows));
});

test('Block 静物任意代后形态不变', () => {
  const rows = ['OO', 'OO'];
  const cols = 10, gridRows = 10;
  const g0 = gridFrom(rows, cols, gridRows, 3, 3);
  const { grid: g5 } = run(g0, cols, gridRows, 5, false);
  assert.deepEqual(cellsOf(g5, cols, gridRows), cellsOf(g0, cols, gridRows));
  assert.equal(eng.countLive(g5), 4);
});

test('Glider 4 代后整体平移 (+1, +1)', () => {
  const rows = ['.O.', '..O', 'OOO'];
  const cols = 20, gridRows = 20;
  const g0 = gridFrom(rows, cols, gridRows, 5, 5);
  const { grid: g4 } = run(g0, cols, gridRows, 4, false);
  const expect = cellsOf(g0, cols, gridRows).map((s) => {
    const [x, y] = s.split(',').map(Number);
    return `${x + 1},${y + 1}`;
  }).sort();
  assert.deepEqual(cellsOf(g4, cols, gridRows), expect);
});

test('空网格保持全空', () => {
  const cols = 8, rows = 8;
  const g = eng.createGrid(cols, rows);
  const { grid } = run(g, cols, rows, 3, true);
  assert.equal(eng.countLive(grid), 0);
});

test('死边界下角落孤立细胞邻居数为 0，且下一代死亡', () => {
  const cols = 5, rows = 5;
  const g = eng.createGrid(cols, rows);
  g[0] = 1;
  assert.equal(eng.countNeighbors(g, cols, rows, 0, 0, false), 0);
  const { grid } = run(g, cols, rows, 1, false);
  assert.equal(eng.countLive(grid), 0);
});

test('环面下跨边界邻居计数正确', () => {
  const cols = 5, rows = 5;
  const g = eng.createGrid(cols, rows);
  g[4 * cols + 4] = 1; // (4,4) 对角
  g[0 * cols + 4] = 1; // (4,0)
  g[4 * cols + 0] = 1; // (0,4)
  assert.equal(eng.countNeighbors(g, cols, rows, 0, 0, true), 3);
  assert.equal(eng.countNeighbors(g, cols, rows, 0, 0, false), 0);
});

test('全活 3x3 的中心格邻居数为 8', () => {
  const cols = 3, rows = 3;
  const g = new Uint8Array(cols * rows).fill(1);
  assert.equal(eng.countNeighbors(g, cols, rows, 1, 1, false), 8);
  assert.equal(eng.countNeighbors(g, cols, rows, 1, 1, true), 8);
});

test('detectCycle：静物 / 周期 2 / 未进入循环', () => {
  const cols = 12, rows = 12;
  const block = gridFrom(['OO', 'OO'], cols, rows, 4, 4);
  const b = run(block, cols, rows, 1, false);
  assert.deepEqual(eng.detectCycle([eng.gridKey(block)], b.keys[0]), { kind: 'static', period: 1 });

  const blinker = gridFrom(['.O.', '.O.', '.O.'], cols, rows, 4, 4);
  const bl = run(blinker, cols, rows, 2, false);
  const blHistory = [bl.keys[1], eng.gridKey(blinker)];
  assert.deepEqual(eng.detectCycle(blHistory, bl.keys[0]), { kind: 'cycle', period: 2 });

  const glider = gridFrom(['.O.', '..O', 'OOO'], cols, rows, 4, 4);
  const gl = run(glider, cols, rows, 4, false);
  const glHistory = [gl.keys[1], gl.keys[2], gl.keys[3], eng.gridKey(glider)];
  assert.deepEqual(eng.detectCycle(glHistory, gl.keys[0]), { kind: null, period: 0 });
});

test('findComponents：距离≤2 归组，8 连通更碎（用内联形状）', () => {
  // 三个相距 3 格的 block（2x2）：radius2 下互不相连 → 3 块；radius1 同样 3 块
  const cols = 30, rows = 10;
  const g = eng.createGrid(cols, rows);
  const b = eng.parsePattern(['OO', 'OO']);
  eng.placePattern(g, cols, rows, b, 1, 1, false);
  eng.placePattern(g, cols, rows, b, 6, 1, false);
  eng.placePattern(g, cols, rows, b, 11, 1, false);
  assert.equal(eng.findComponents(g, cols, rows, 2).length, 3);
});

/* ---------- 符号库（30 个有意义的数字/情感/节日符号） ---------- */

test('PATTERNS 只含 30 个 symbol 档图案，且字段完整合法', () => {
  assert.equal(eng.PATTERNS.length, 30, '图案总数应为 30，实际 ' + eng.PATTERNS.length);
  const ids = new Set();
  for (const pat of eng.PATTERNS) {
    assert.ok(/^[a-z0-9-]+$/.test(pat.id), 'id 非规范：' + pat.id);
    assert.ok(!ids.has(pat.id), 'id 重复：' + pat.id);
    ids.add(pat.id);
    assert.equal(pat.tier, 'symbol', 'tier 必须是 symbol：' + pat.id);
    assert.ok(pat.name && pat.desc && pat.type, '缺 name/desc/type：' + pat.id);
    assert.equal(pat.type, '静物', '符号 type 必须是静物：' + pat.id);
    assert.equal(pat.period, 1, '符号 period 必须是 1：' + pat.id);
    const p = eng.parsePattern(pat.rows);
    assert.ok(p.cells.length >= 1, '活细胞为 0：' + pat.id);
    assert.equal(p.h, pat.rows.length, '高度不符：' + pat.id);
    for (const r of pat.rows) assert.ok(/^[O.]+$/.test(r), 'rows 含非法字符：' + pat.id);
  }
  // 30 个应包含数字 0-9、情感符号与 v5.3 节日/情感新符号
  for (const want of ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9',
    'heart', 'star', 'check', 'smiley', 'bolt', 'clover', 'sun', 'flower', 'diamond', 'moon',
    'crown', 'key', 'note', 'cat', 'butterfly', 'balloon', 'snow', 'rainbow', 'bell', 'firework']) {
    assert.ok(ids.has(want), '缺少符号：' + want);
  }
});

test('每个符号放置后永久稳定（block 像素拼成的静物）', () => {
  const cols = 60, rows = 60;
  for (const pat of eng.PATTERNS) {
    const g = eng.createGrid(cols, rows);
    const p = eng.parsePattern(pat.rows);
    eng.placePattern(g, cols, rows, p, 8, 8, false);
    const g0 = cellsOf(g, cols, rows);
    let cur = Uint8Array.from(g), next = eng.createGrid(cols, rows);
    for (let i = 0; i < 8; i++) {
      eng.step(cur, next, cols, rows, false);
      const t = cur; cur = next; next = t;
    }
    assert.deepEqual(cellsOf(cur, cols, rows), g0, pat.id + ' 跑 8 代后形态应不变');
  }
});

/* ---------- 数据守护：符号的 type/period/desc 必须与真实动力学一致 ---------- */
function cellsOfXY(g, cols) {
  const out = [];
  for (let i = 0; i < g.length; i++) if (g[i]) out.push([i % cols, (i - (i % cols)) / cols]);
  return out;
}
function absKeyOf(cells) { return cells.map((c) => c[0] + ',' + c[1]).sort().join(';'); }
function truthOf(pat) {
  const PAD = 30, WRAP = true;
  const p = eng.parsePattern(pat.rows);
  const cols = p.w + PAD * 2, rows = p.h + PAD * 2;
  const g0 = eng.createGrid(cols, rows);
  eng.placePattern(g0, cols, rows, p, PAD, PAD, WRAP);
  const cur = Uint8Array.from(g0), next = eng.createGrid(cols, rows);
  eng.step(cur, next, cols, rows, WRAP);
  return absKeyOf(cellsOfXY(next, cols)) === absKeyOf(cellsOfXY(g0, cols)) ? '静物' : '非静物';
}

test('真值守护：30 个符号在环面下逐个复算都是静物', () => {
  for (const pat of eng.PATTERNS) {
    assert.equal(truthOf(pat), '静物', `${pat.id} 声称「${pat.type}」，环面真值不是「静物」`);
    assert.equal(pat.period, 1, `静物 period 必须是 1：${pat.id}`);
    assert.ok(!/周期|摆动|振荡|飞船/.test(pat.desc), `${pat.id} 静物 desc 不该含动力学术语：${pat.desc}`);
  }
});

test('phaseCountOf：每个符号都是 1 相位（静物）', () => {
  for (const pat of eng.PATTERNS) assert.equal(eng.phaseCountOf(pat), 1, pat.id + ' 相位应为 1');
});

/* ---------- 识别：符号不进注册表，恒不误报 ---------- */

test('identify：符号不进识别注册表，放置后仍识别为空', () => {
  const cols = 80, rows = 80;
  for (const pat of eng.PATTERNS) {
    const g = eng.createGrid(cols, rows);
    const p = eng.parsePattern(pat.rows);
    eng.placePattern(g, cols, rows, p, 10, 10, false);
    assert.deepEqual(eng.identify(g, cols, rows), {}, pat.id + ' 不应被自然识别命中');
  }
});

test('identify：随机稠密 soup 不产生任何误报', () => {
  let seed = 20261010;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const cols = 60, rows = 40;
  for (let i = 0; i < 60; i++) {
    const g = eng.createGrid(cols, rows);
    eng.randomFill(g, cols, rows, 0.3, rnd);
    assert.deepEqual(eng.identify(g, cols, rows), {}, `随机网格 #${i} 不应识别出结构`);
  }
});

/* ================= 大白话展示层（图鉴详情 / 彩蛋文案） ================= */

test('typeLabel：全部 type 都有大白话标签', () => {
  const types = [...new Set(eng.PATTERNS.map((p) => p.type))];
  for (const t of types) {
    const l = eng.typeLabel(t);
    assert.ok(l && l !== t, `type ${t} 必须映射到大白话标签，实际 ${l}`);
  }
  assert.equal(eng.typeLabel('静物'), '静止不动');
  assert.equal(eng.typeLabel(''), '');
});

test('plainDesc：30 条描述全部非空且不含术语', () => {
  for (const p of eng.PATTERNS) {
    const d = eng.plainDesc(p);
    assert.ok(d && d.length > 0, p.id + ' 描述不能为空');
    assert.ok(!/周期|摆动|振荡|定格|指纹|相位|平移/.test(d), `${p.id} 描述含术语：${d}`);
  }
});

test('plainDesc：静物符号翻成大白话', () => {
  const by = (id) => eng.plainDesc(eng.PATTERN_INDEX[id]);
  for (const id of ['d0', 'heart', 'star', 'moon']) {
    assert.equal(by(id), '落定后就不再变化，永远静止', id + ' 静物大白话不符');
  }
});

/* ================= v5.0 许愿仪式：种子 PRNG / 心愿映射 / 签文库 ================= */

test('mulberry32：同种子 → 同序列（确定性，同生日即同宇宙）', () => {
  const a = eng.mulberry32(12345), b = eng.mulberry32(12345);
  const seqA = Array.from({ length: 50 }, () => a());
  const seqB = Array.from({ length: 50 }, () => b());
  assert.deepEqual(seqA, seqB, '同种子必须产生完全相同的序列');
  for (const v of seqA) assert.ok(v >= 0 && v < 1, 'rng 输出应在 [0,1)：' + v);
  // 不同种子应产生不同序列（至少首个值不同）
  assert.notEqual(eng.mulberry32(12345)(), eng.mulberry32(99999)());
});

test('hashSeed：同字符串 → 同数字，不同字符串大概率不同', () => {
  assert.equal(eng.hashSeed('1990-01-01'), eng.hashSeed('1990-01-01'));
  assert.notEqual(eng.hashSeed('1990-01-01'), eng.hashSeed('1990-01-02'));
  assert.equal(typeof eng.hashSeed('x'), 'number');
});

test('randomFill：同种子 rng → 同一片汤（网格逐格一致）', () => {
  const cols = 40, rows = 30;
  const g1 = eng.createGrid(cols, rows), g2 = eng.createGrid(cols, rows);
  eng.randomFill(g1, cols, rows, 0.28, eng.mulberry32(eng.hashSeed('2000-05-20')));
  eng.randomFill(g2, cols, rows, 0.28, eng.mulberry32(eng.hashSeed('2000-05-20')));
  assert.deepEqual(Array.from(g1), Array.from(g2), '同生日种子应填出完全相同的初始网格');
});

test('birthdayDigit：生命灵数（各位相加至一位）', () => {
  assert.equal(eng.birthdayDigit('1990-01-01'), 3);   // 1+9+9+0+0+1+0+1=21 → 3
  assert.equal(eng.birthdayDigit('1999-09-09'), 1);   // 1+9+9+9+0+9+0+9=46 → 10 → 1
  assert.equal(eng.birthdayDigit('2000-08-08'), 9);   // 2+0+0+0+0+8+0+8=18 → 9
  assert.equal(eng.birthdayDigit(''), null);
  assert.equal(eng.birthdayDigit('乱码'), null);
});

test('pickWishSymbol：关键词命中对应符号', () => {
  const cases = [
    ['希望早日脱单', 'heart'], ['想要好运', 'clover'], ['愿梦想发光', 'star'],
    ['天天开心', 'smiley'], ['考试上岸', 'check'], ['想要暴富', 'diamond'],
    ['晚安温柔', 'moon'], ['桃花绽放', 'flower'], ['需要灵感', 'bolt'], ['平安健康', 'sun']
  ];
  for (const [text, id] of cases) {
    assert.equal(eng.pickWishSymbol(text, '', Math.random).id, id, `「${text}」应命中 ${id}`);
  }
});

test('pickWishSymbol：生日分支用数字根选数字符号', () => {
  // 命中「生日」→ @digit，无生日则用文本首个数字，再无不随机
  assert.equal(eng.pickWishSymbol('生日快乐', '1990-01-01', Math.random).id, 'd3');  // 数字根 3
  assert.equal(eng.pickWishSymbol('祝我 7 岁快乐', '', Math.random).id, 'd7');        // 文本数字 7
  const r = eng.pickWishSymbol('生日', '', eng.mulberry32(7));
  assert.ok(/^d[0-9]$/.test(r.id), '生日分支应返回数字符号，实际 ' + r.id);
});

test('pickWishSymbol：无匹配走加权兜底，恒返回合法 symbol', () => {
  const ids = new Set(eng.PATTERNS.map((p) => p.id));
  for (let i = 0; i < 100; i++) {
    const p = eng.pickWishSymbol('一些完全不相关的话 xyz', '', eng.mulberry32(i));
    assert.ok(ids.has(p.id), '兜底必须返回 PATTERNS 内的符号，实际 ' + p.id);
    assert.equal(p.tier, 'symbol');
  }
});

test('pickFortune：每个符号都有签文，种子选一条且确定', () => {
  for (const p of eng.PATTERNS) {
    const arr = eng.FORTUNES[p.id];
    assert.ok(Array.isArray(arr) && arr.length >= 3, p.id + ' 签文应至少 3 条');
    for (const f of arr) assert.ok(f && f.length >= 4, p.id + ' 存在过短签文：' + f);
  }
  // 同种子 → 同签文
  const s = eng.hashSeed('heart');
  assert.equal(eng.pickFortune('heart', eng.mulberry32(s)), eng.pickFortune('heart', eng.mulberry32(s)));
  // 落在合法集合内
  assert.ok(eng.FORTUNES['heart'].includes(eng.pickFortune('heart', Math.random)));
});

/* ================= v5.0.2 许愿增强：主题表 / wishThemeOf / buildFortune ================= */

test('WISH_THEMES：9 主题字段齐全，symbols 全部是合法符号 id，颜色为 hex', () => {
  const ids = new Set(eng.PATTERNS.map((p) => p.id));
  const themes = Object.keys(eng.WISH_THEMES);
  assert.ok(themes.length >= 7, '主题应至少 7 类，实际 ' + themes.length);
  for (const t of themes) {
    const th = eng.WISH_THEMES[t];
    assert.ok(th.name && th.name.length >= 2, t + ' 缺中文名');
    assert.ok(Array.isArray(th.symbols) && th.symbols.length >= 3, t + ' symbols 至少 3 个');
    for (const s of th.symbols) assert.ok(ids.has(s), t + ' 引用了不存在的符号 ' + s);
    for (const k of ['c1', 'c2', 'dust']) assert.ok(/^#[0-9a-f]{6}$/i.test(th[k]), t + '.' + k + ' 非 hex：' + th[k]);
  }
  // WISH_RULES 的 theme 全部有对应表项
  for (const rule of eng.WISH_RULES) assert.ok(eng.WISH_THEMES[rule.theme], '规则 theme 无表项：' + rule.theme);
});

test('wishThemeOf：关键词命中主题；无匹配按兜底符号反推', () => {
  assert.equal(eng.wishThemeOf('想脱单', ''), 'love');
  assert.equal(eng.wishThemeOf('考研上岸', ''), 'study');
  assert.equal(eng.wishThemeOf('早日暴富', ''), 'wealth');
  assert.equal(eng.wishThemeOf('家人平安', ''), 'health');
  assert.equal(eng.wishThemeOf('生日快乐', '1990-01-01'), 'number');
  // 无匹配 → 反推出的主题必须在表内
  for (let i = 0; i < 50; i++) {
    const t = eng.wishThemeOf('xyz 无关文本', '', eng.mulberry32(i));
    assert.ok(eng.WISH_THEMES[t], '兜底主题非法：' + t);
  }
  // 确定性：同种子同主题
  assert.equal(eng.wishThemeOf('xyz', '', eng.mulberry32(7)), eng.wishThemeOf('xyz', '', eng.mulberry32(7)));
});

test('buildFortune：拼入心愿原话（独一无二）；空心愿退回纯签文；同种子确定', () => {
  const wish = '想和喜欢的人一起去大理';
  const out = eng.buildFortune('heart', wish, eng.mulberry32(3));
  assert.ok(out.includes(wish), '卡面文案应包含心愿原话：' + out);
  // 4 个句式模板都只含一组 {wish}/{fortune} 占位，替换后无残留
  assert.ok(!/\{wish\}|\{fortune\}/.test(out), '占位符未替换干净：' + out);
  // 不同心愿 → 不同文案（独一无二的最小验证）
  const a = eng.buildFortune('heart', '心愿甲', eng.mulberry32(9));
  const b = eng.buildFortune('heart', '心愿乙', eng.mulberry32(9));
  assert.notEqual(a, b);
  // 空心愿 → 纯签文（在 FORTUNES 集合内）
  assert.ok(eng.FORTUNES['heart'].includes(eng.buildFortune('heart', '', Math.random)));
  // 同种子同心愿 → 同文案（确定性不破）
  assert.equal(eng.buildFortune('star', '发光', eng.mulberry32(11)), eng.buildFortune('star', '发光', eng.mulberry32(11)));
});

test('SYMBOL_THEME：反查表覆盖全部主题符号且值合法', () => {
  for (const t of Object.keys(eng.WISH_THEMES)) {
    for (const s of eng.WISH_THEMES[t].symbols) {
      assert.ok(eng.SYMBOL_THEME[s], s + ' 应有主题反查');
      assert.ok(eng.WISH_THEMES[eng.SYMBOL_THEME[s]], s + ' 反查到的主题不在表内');
    }
  }
});

/* ================= v5.3 首字母凝形：字模 / letterPattern / 稳定性 ================= */

test('letterPattern：A–Z 全部可生成，小写自动大写，非法字符返回 null', () => {
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    const p = eng.letterPattern(ch);
    assert.ok(p, ch + ' 字模缺失');
    assert.equal(p.id, 'letter_' + ch);
    assert.equal(p.letter, ch);
  }
  assert.equal(eng.letterPattern('k').id, 'letter_K', '小写应自动大写');
  assert.equal(eng.letterPattern('1'), null);
  assert.equal(eng.letterPattern(''), null);
  assert.equal(eng.letterPattern(null), null);
});

test('letterPattern：26 个字母放置后全部永久稳定（block 静物）且尺寸适配手机网格', () => {
  const cols = 60, rows = 60;
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    const p = eng.letterPattern(ch);
    const parsed = eng.parsePattern(p.rows);
    // 宽度须放进竖屏小网格（仪式 cell=6 → 640/6≈106 列；保守取 60）
    assert.ok(parsed.w <= 52 && parsed.h <= 52, ch + ' 尺寸过大 ' + parsed.w + '×' + parsed.h);
    const g = eng.createGrid(cols, rows);
    eng.placePattern(g, cols, rows, parsed, 4, 4, false);
    const g0 = cellsOf(g, cols, rows);
    let cur = Uint8Array.from(g), next = eng.createGrid(cols, rows);
    for (let k = 0; k < 8; k++) {
      eng.step(cur, next, cols, rows, false);
      const t = cur; cur = next; next = t;
    }
    assert.deepEqual(cellsOf(cur, cols, rows), g0, ch + ' 跑 8 代后形态应不变');
  }
});

test('v5.3 新 10 符号：心愿关键词命中 + 签文齐全 + 主题归组', () => {
  const cases = [
    ['我要夺冠', 'crown'], ['解锁新阶段', 'key'], ['想听歌', 'note'], ['撸猫', 'cat'],
    ['破茧蜕变', 'butterfly'], ['把烦恼放飞', 'balloon'], ['想看初雪', 'snow'],
    ['雨后见彩虹', 'rainbow'], ['圣诞祈福', 'bell'], ['跨年烟花', 'firework']
  ];
  for (const [text, id] of cases) {
    assert.equal(eng.pickWishSymbol(text, '', Math.random).id, id, `「${text}」应命中 ${id}`);
    assert.ok(eng.FORTUNES[id] && eng.FORTUNES[id].length >= 3, id + ' 签文应至少 3 条');
    assert.ok(eng.SYMBOL_THEME[id], id + ' 应归入某主题');
  }
});
