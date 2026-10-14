/* ENGINE-START */
var LifeEngine = (function () {
  'use strict';

  var BIRTH = { 3: true };
  var SURVIVE = { 2: true, 3: true };

  var ALIVE_CHARS = { 'O': 1, 'o': 1, '1': 1, '*': 1, '#': 1, 'X': 1, 'x': 1 };

  var PATTERNS = [
    { id: 'd0', name: '数字0', desc: '数字 0，圆满归零，也能拼出年份和幸运数', type: '静物', tier: 'symbol', period: 1,
      rows: ['....OO..OO..OO....', '....OO..OO..OO....', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', '....OO..OO..OO....', '....OO..OO..OO....'] },
    { id: 'd1', name: '数字1', desc: '数字 1，拔得头筹，孤独又坚定', type: '静物', tier: 'symbol', period: 1,
      rows: ['........OO........', '........OO........', '..................', '..................', '....OO..OO........', '....OO..OO........', '..................', '..................', '........OO........', '........OO........', '..................', '..................', '........OO........', '........OO........', '..................', '..................', '........OO........', '........OO........', '..................', '..................', '........OO........', '........OO........', '..................', '..................', '....OO..OO..OO....', '....OO..OO..OO....'] },
    { id: 'd2', name: '数字2', desc: '数字 2，成双成对', type: '静物', tier: 'symbol', period: 1,
      rows: ['....OO..OO..OO....', '....OO..OO..OO....', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', '................OO', '................OO', '..................', '..................', '........OO..OO....', '........OO..OO....', '..................', '..................', '....OO............', '....OO............', '..................', '..................', 'OO................', 'OO................', '..................', '..................', 'OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO'] },
    { id: 'd3', name: '数字3', desc: '数字 3，三生万物', type: '静物', tier: 'symbol', period: 1,
      rows: ['....OO..OO..OO....', '....OO..OO..OO....', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', '................OO', '................OO', '..................', '..................', '........OO..OO....', '........OO..OO....', '..................', '..................', '................OO', '................OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', '....OO..OO..OO....', '....OO..OO..OO....'] },
    { id: 'd4', name: '数字4', desc: '数字 4，四季安稳', type: '静物', tier: 'symbol', period: 1,
      rows: ['............OO..OO', '............OO..OO', '..................', '..................', '........OO......OO', '........OO......OO', '..................', '..................', '....OO..........OO', '....OO..........OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', 'OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO', '..................', '..................', '................OO', '................OO', '..................', '..................', '................OO', '................OO'] },
    { id: 'd5', name: '数字5', desc: '数字 5，五福临门', type: '静物', tier: 'symbol', period: 1,
      rows: ['OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO', '..................', '..................', 'OO................', 'OO................', '..................', '..................', 'OO..OO..OO..OO....', 'OO..OO..OO..OO....', '..................', '..................', '................OO', '................OO', '..................', '..................', '................OO', '................OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', '....OO..OO..OO....', '....OO..OO..OO....'] },
    { id: 'd6', name: '数字6', desc: '数字 6，六六大顺', type: '静物', tier: 'symbol', period: 1,
      rows: ['........OO..OO....', '........OO..OO....', '..................', '..................', '....OO............', '....OO............', '..................', '..................', 'OO................', 'OO................', '..................', '..................', 'OO..OO..OO..OO....', 'OO..OO..OO..OO....', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', '....OO..OO..OO....', '....OO..OO..OO....'] },
    { id: 'd7', name: '数字7', desc: '数字 7，幸运之星', type: '静物', tier: 'symbol', period: 1,
      rows: ['OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO', '..................', '..................', '................OO', '................OO', '..................', '..................', '............OO....', '............OO....', '..................', '..................', '........OO........', '........OO........', '..................', '..................', '........OO........', '........OO........', '..................', '..................', '........OO........', '........OO........', '..................', '..................', '........OO........', '........OO........'] },
    { id: 'd8', name: '数字8', desc: '数字 8，发发发，财源滚滚', type: '静物', tier: 'symbol', period: 1,
      rows: ['....OO..OO..OO....', '....OO..OO..OO....', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', '....OO..OO..OO....', '....OO..OO..OO....', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', '....OO..OO..OO....', '....OO..OO..OO....'] },
    { id: 'd9', name: '数字9', desc: '数字 9，长长久久', type: '静物', tier: 'symbol', period: 1,
      rows: ['....OO..OO..OO....', '....OO..OO..OO....', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', 'OO..............OO', 'OO..............OO', '..................', '..................', '....OO..OO..OO..OO', '....OO..OO..OO..OO', '..................', '..................', '................OO', '................OO', '..................', '..................', '............OO....', '............OO....', '..................', '..................', '....OO..OO........', '....OO..OO........'] },
    { id: 'heart', name: '爱心', desc: '把爱意铺满这片宇宙', type: '静物', tier: 'symbol', period: 1,
      rows: ['....OO..............OO....', '....OO..............OO....', '..........................', '..........................', 'OO..OO..OO......OO..OO..OO', 'OO..OO..OO......OO..OO..OO', '..........................', '..........................', 'OO..OO..OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO..OO..OO', '..........................', '..........................', 'OO..OO..OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO..OO..OO', '..........................', '..........................', '....OO..OO..OO..OO..OO....', '....OO..OO..OO..OO..OO....', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........', '..........................', '..........................', '............OO............', '............OO............'] },
    { id: 'star', name: '星星', desc: '替你点亮一个愿望', type: '静物', tier: 'symbol', period: 1,
      rows: ['............OO............', '............OO............', '..........................', '..........................', '............OO............', '............OO............', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........', '..........................', '..........................', 'OO..OO..OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO..OO..OO', '..........................', '..........................', '....OO..OO..OO..OO..OO....', '....OO..OO..OO..OO..OO....', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........', '..........................', '..........................', '....OO..............OO....', '....OO..............OO....'] },
    { id: 'check', name: '对勾', desc: '标记一件已完成的小事', type: '静物', tier: 'symbol', period: 1,
      rows: ['....................OO', '....................OO', '......................', '......................', '................OO..OO', '................OO..OO', '......................', '......................', '............OO..OO....', '............OO..OO....', '......................', '......................', 'OO..........OO..OO....', 'OO..........OO..OO....', '......................', '......................', '....OO..OO..OO........', '....OO..OO..OO........', '......................', '......................', '........OO............', '........OO............'] },
    { id: 'smiley', name: '笑脸', desc: '让这片宇宙一直开心', type: '静物', tier: 'symbol', period: 1,
      rows: ['....OO..OO..OO..OO..OO....', '....OO..OO..OO..OO..OO....', '..........................', '..........................', 'OO......OO......OO......OO', 'OO......OO......OO......OO', '..........................', '..........................', 'OO......................OO', 'OO......................OO', '..........................', '..........................', 'OO......................OO', 'OO......................OO', '..........................', '..........................', '....OO..OO......OO..OO....', '....OO..OO......OO..OO....', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........'] },
    { id: 'bolt', name: '闪电', desc: '注入一股能量与灵感', type: '静物', tier: 'symbol', period: 1,
      rows: ['................OO', '................OO', '..................', '..................', '............OO....', '............OO....', '..................', '..................', '........OO..OO....', '........OO..OO....', '..................', '..................', '....OO..OO..OO....', '....OO..OO..OO....', '..................', '..................', '............OO....', '............OO....', '..................', '..................', '........OO........', '........OO........', '..................', '..................', '....OO............', '....OO............'] },
    { id: 'clover', name: '四叶草', desc: '遇见幸运', type: '静物', tier: 'symbol', period: 1,
      rows: ['....OO..OO..........OO..OO....', '....OO..OO..........OO..OO....', '..............................', '..............................', 'OO..OO..OO..........OO..OO..OO', 'OO..OO..OO..........OO..OO..OO', '..............................', '..............................', 'OO..OO..................OO..OO', 'OO..OO..................OO..OO', '..............................', '..............................', '..............................', '..............................', '..............................', '..............................', 'OO..OO..................OO..OO', 'OO..OO..................OO..OO', '..............................', '..............................', 'OO..OO..OO..........OO..OO..OO', 'OO..OO..OO..........OO..OO..OO', '..............................', '..............................', '....OO..OO..........OO..OO....', '....OO..OO..........OO..OO....'] },
    { id: 'sun', name: '太阳', desc: '永远晴朗温暖', type: '静物', tier: 'symbol', period: 1,
      rows: ['............OO............', '............OO............', '..........................', '..........................', '....OO......OO......OO....', '....OO......OO......OO....', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........', '..........................', '..........................', 'OO..OO..OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO..OO..OO', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........', '..........................', '..........................', '....OO......OO......OO....', '....OO......OO......OO....', '..........................', '..........................', '............OO............', '............OO............'] },
    { id: 'flower', name: '花朵', desc: '花开不败，静静盛开', type: '静物', tier: 'symbol', period: 1,
      rows: ['....OO..............OO....', '....OO..............OO....', '..........................', '..........................', '....OO......OO......OO....', '....OO......OO......OO....', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........', '..........................', '..........................', '....OO..OO..OO..OO..OO....', '....OO..OO..OO..OO..OO....', '..........................', '..........................', 'OO..OO..OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO..OO..OO', '..........................', '..........................', '....OO..OO..OO..OO..OO....', '....OO..OO..OO..OO..OO....', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........'] },
    { id: 'diamond', name: '钻石', desc: '珍贵的时刻值得铭记', type: '静物', tier: 'symbol', period: 1,
      rows: ['............OO............', '............OO............', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........', '..........................', '..........................', '....OO..OO..OO..OO..OO....', '....OO..OO..OO..OO..OO....', '..........................', '..........................', 'OO..OO..OO..OO..OO..OO..OO', 'OO..OO..OO..OO..OO..OO..OO', '..........................', '..........................', '....OO..OO..OO..OO..OO....', '....OO..OO..OO..OO..OO....', '..........................', '..........................', '........OO..OO..OO........', '........OO..OO..OO........', '..........................', '..........................', '............OO............', '............OO............'] },
    { id: 'moon', name: '月亮', desc: '夜里安静的一弯温柔', type: '静物', tier: 'symbol', period: 1,
      rows: ['............OO..OO..OO....', '............OO..OO..OO....', '..........................', '..........................', '........OO................', '........OO................', '..........................', '..........................', '....OO....................', '....OO....................', '..........................', '..........................', '....OO....................', '....OO....................', '..........................', '..........................', '....OO....................', '....OO....................', '..........................', '..........................', '........OO................', '........OO................', '..........................', '..........................', '............OO..OO..OO....', '............OO..OO..OO....'] },
    /* v5.3 新增 10 符号（block 像素逻辑图经 blockRows 展开，规则与数字/爱心一致：2×2 方块当像素、间隔 2 格 → 永久静物） */
    { id: 'crown', name: '皇冠', desc: '为你在意的事加冕', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        'O........O',
        'O..O..O..O',
        'OOOOOOOOOO',
        'OOOOOOOOOO',
        '..........',
        'OOOOOOOOOO']) },
    { id: 'key', name: '钥匙', desc: '打开通往新阶段的那扇门', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        '..OOOOOO..',
        '..O....O..',
        '..O....O..',
        '..OOOOOO..',
        '.....O....',
        '.....O....',
        '.....O....',
        '.....O....',
        '.....O....',
        '.....O..OO',
        '.....O....',
        '.....O..OO',
        '.....OO...']) },
    { id: 'note', name: '音符', desc: '把今天哼成一首歌', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        '.......O',
        '......OO',
        '.....OO.',
        '.....O..',
        '.....O..',
        '.....O..',
        '.....O..',
        '.....O..',
        '.....O..',
        '....OO..',
        '...OOO..',
        '...OO...']) },
    { id: 'cat', name: '猫脸', desc: '像猫一样，慵懒又自由', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        'O......O',
        'OO....OO',
        '.OOOOOO.',
        'OOO..OOO',
        'OOOOOOOO',
        'OO.OO.OO',
        'OOO..OOO',
        '.OOOOOO.',
        '........',
        'O....O..',
        '.O..O...',
        'O....O..']) },
    { id: 'butterfly', name: '蝴蝶', desc: '破茧的事，宇宙替你记着', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        'OO....OO..',
        'OOO..OOO..',
        'OOOOOOOO..',
        'OOO..OOO..',
        '..OOOO....',
        'OOOOOOOO..',
        'OOO..OOO..',
        'OO....OO..',
        'O..OO..O..']) },
    { id: 'balloon', name: '气球', desc: '把坏情绪飘走，把心愿升空', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        '..OOOO..',
        '.OOOOOO.',
        'OOOOOOOO',
        'OOOOOOOO',
        'OOOOOOOO',
        '.OOOOOO.',
        '..OOOO..',
        '...OO...',
        '....O...',
        '...O....',
        '....O...',
        '...O....']) },
    { id: 'snow', name: '雪花', desc: '六角的温柔，落点都是运气', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        '...O....',
        'O..O..O.',
        '.O.OO.O.',
        'OOOOOOOO',
        '.O.OO.O.',
        'O..O..O.',
        '...O....']) },
    { id: 'rainbow', name: '彩虹', desc: '风雨之后，宇宙给你看这个', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        '....OO....',
        '..OO..OO..',
        '.O......O.',
        'O........O',
        'O........O',
        'O........O',
        '..........'
      ]) },
    { id: 'bell', name: '铃铛', desc: '叮当一声，好事敲门', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        '...OO...',
        '....O...',
        '..OOOO..',
        '.OOOOOO.',
        '.OOOOOO.',
        'OOOOOOOO',
        'OOOOOOOO',
        '........',
        '...OO...']) },
    { id: 'firework', name: '烟花', desc: '攒了很久的光，就为这一刻', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows([
        'O...O...O',
        '.O.O.O.O.',
        '..O.O.O..',
        'OOO...OOO',
        '...OOO...',
        'OOO...OOO',
        '..O.O.O..',
        '.O.O.O.O.',
        'O...O...O']) },
  ];

  // block 像素展开：逻辑图（每字符=一个 2×2 方块像素）。
  // 关键：每个 block 恒隔 2 空格（每字符占 4 列：'OO..' / '....'），纵向重复 2 行 + 空 1 行。
  // 这样每个 block 都是独立的经典 2×2 静物、互不共享邻居 → 任意逻辑图都是永久静物
  // （若把相邻像素合并成实心 2×N 条，N≥3 中间列邻居>3 会死，故必须隔开）。与手写数字/爱心格式一致。
  function blockRows(logical) {
    var out = [];
    for (var i = 0; i < logical.length; i++) {
      var s = '';
      for (var j = 0; j < logical[i].length; j++) s += (logical[i].charAt(j) === 'O' ? 'OO..' : '....');
      out.push(s); out.push(s);
      if (i < logical.length - 1) out.push(new Array(logical[i].length * 4 + 1).join('.'));
    }
    return out;
  }

  function parsePattern(rows) {
    var cells = [], w = 0, h = rows.length;
    for (var y = 0; y < rows.length; y++) {
      var r = rows[y];
      if (r.length > w) w = r.length;
      for (var x = 0; x < r.length; x++) {
        if (ALIVE_CHARS[r.charAt(x)]) cells.push([x, y]);
      }
    }
    return { cells: cells, w: w, h: h };
  }

  function createGrid(cols, rows) {
    return new Uint8Array(cols * rows);
  }

  function countLive(g) {
    var n = 0;
    for (var i = 0; i < g.length; i++) if (g[i]) n++;
    return n;
  }

  function countNeighbors(g, cols, rows, x, y, wrap) {
    var n = 0;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        var nx = x + dx, ny = y + dy;
        if (wrap) {
          nx = (nx + cols) % cols;
          ny = (ny + rows) % rows;
        } else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
          continue;
        }
        n += g[ny * cols + nx];
      }
    }
    return n;
  }

  function step(cur, next, cols, rows, wrap) {
    var live = 0;
    for (var y = 0; y < rows; y++) {
      var rowOff = y * cols;
      for (var x = 0; x < cols; x++) {
        var i = rowOff + x;
        var n = countNeighbors(cur, cols, rows, x, y, wrap);
        var alive = cur[i] ? SURVIVE[n] === true : BIRTH[n] === true;
        next[i] = alive ? 1 : 0;
        if (alive) live++;
      }
    }
    return live;
  }

  function randomFill(g, cols, rows, density, rng) {
    var r = rng || Math.random, live = 0;
    for (var i = 0; i < g.length; i++) {
      var on = r() < density ? 1 : 0;
      g[i] = on;
      live += on;
    }
    return live;
  }

  function placePattern(g, cols, rows, pattern, ox, oy, wrap) {
    var p = pattern.cells ? pattern : parsePattern(pattern.rows);
    for (var i = 0; i < p.cells.length; i++) {
      var x = ox + p.cells[i][0], y = oy + p.cells[i][1];
      if (wrap) {
        x = ((x % cols) + cols) % cols;
        y = ((y % rows) + rows) % rows;
      } else if (x < 0 || y < 0 || x >= cols || y >= rows) {
        continue;
      }
      g[y * cols + x] = 1;
    }
    return p;
  }

  function gridKey(g) {
    var h = 2166136261;
    for (var i = 0; i < g.length; i++) {
      h ^= g[i];
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  function detectCycle(history, current) {
    for (var k = 0; k < history.length; k++) {
      if (history[k] === current) {
        var period = k + 1;
        return { kind: period === 1 ? 'static' : 'cycle', period: period };
      }
    }
    return { kind: null, period: 0 };
  }

  /* ---------------- 种子随机（v5.0 许愿仪式：同生日 → 同宇宙） ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------------- 心愿 → 符号映射（v5.0） ---------------- */
  // 关键词按序匹配：心愿文本包含任一词即命中该符号；theme 决定后续惊喜池加权与卡面色系
  var WISH_RULES = [
    { kw: ['生日', '岁', '生辰', 'birthday'], id: '@digit', theme: 'number' },   // 特殊：数字由生日/文本数字决定（优先级最高）
    { kw: ['爱', '恋', '告白', '表白', '脱单', '喜欢的人', '暗恋', '姻缘', '桃花运'], id: 'heart', theme: 'love' },
    { kw: ['幸运', '好运', '锦鲤', '欧', '中奖', '抽卡', '转运'], id: 'clover', theme: 'luck' },
    { kw: ['愿望', '梦想', '发光', '闪耀', '星'], id: 'star', theme: 'wish' },
    { kw: ['开心', '快乐', '笑', '心情', '治愈', 'emo', '难过', '焦虑', '内耗'], id: 'smiley', theme: 'mood' },
    { kw: ['上岸', '考研', '考公', '考试', '面试', 'offer', '学业', '毕业', '通过', '过级', '成功', '录取', '答辩'], id: 'check', theme: 'study' },
    { kw: ['暴富', '钱', '发财', '富', '加薪', '涨薪', '搞钱', '财运', '副业'], id: 'diamond', theme: 'wealth' },
    { kw: ['温柔', '安静', '晚安', '睡', '思念', '想他', '想她', '放下'], id: 'moon', theme: 'mood' },
    { kw: ['美', '绽放', '花开', '颜值', '变美', '皮肤'], id: 'flower', theme: 'love' },
    { kw: ['能量', '灵感', '动力', '冲刺', '效率', '状态', '事业', '升职', '项目'], id: 'bolt', theme: 'career' },
    { kw: ['平安', '顺利', '健康', '顺遂', '晴朗', '阳光', '家人', '父母', '无病'], id: 'sun', theme: 'health' },
    /* v5.3 新符号关键词（追加在末尾：既有规则优先命中，旧映射行为不变） */
    { kw: ['第一名', '夺冠', '加冕', 'c位', '折桂'], id: 'crown', theme: 'study' },
    { kw: ['解锁', '钥匙', '新阶段', '转折', '开门'], id: 'key', theme: 'wish' },
    { kw: ['音乐', '歌', '哼', '旋律', '单曲循环'], id: 'note', theme: 'mood' },
    { kw: ['猫', '撸猫', '宠物', '喵'], id: 'cat', theme: 'mood' },
    { kw: ['蝴蝶', '蜕变', '破茧'], id: 'butterfly', theme: 'wish' },
    { kw: ['气球', '放飞', '飘走'], id: 'balloon', theme: 'mood' },
    { kw: ['雪', '初雪', '雪花', '浪漫'], id: 'snow', theme: 'love' },
    { kw: ['彩虹', '雨后', '见彩虹'], id: 'rainbow', theme: 'luck' },
    { kw: ['铃铛', '圣诞', '新年', '祈福', '敲门'], id: 'bell', theme: 'luck' },
    { kw: ['烟花', '绚烂', '跨年', '这一刻'], id: 'firework', theme: 'wish' }
  ];
  // 无匹配时的加权随机池（情感符号权重更高，更符合许愿语境）
  var WISH_FALLBACK = ['heart', 'star', 'clover', 'smiley', 'heart', 'star', 'sun', 'moon', 'flower', 'diamond', 'bolt', 'check'];

  /* ---------------- 心愿主题（v5.0.2：让愿望贯穿整局 + 决定卡面色系） ---------------- */
  // 每个主题：情感符号集合（后续惊喜池按此加权 ×3）+ 卡面渐变色 + 星点粒子色
  var WISH_THEMES = {
    love:   { name: '爱意', symbols: ['heart', 'flower', 'moon', 'snow'], c1: '#e8a0bf', c2: '#f7c873', dust: '#ffd7e6' },
    luck:   { name: '好运', symbols: ['clover', 'star', 'd7', 'rainbow', 'bell'], c1: '#7ee8b0', c2: '#f7c873', dust: '#c8ffe0' },
    wish:   { name: '心愿', symbols: ['star', 'heart', 'moon', 'key', 'butterfly', 'firework'], c1: '#a0b8ff', c2: '#e8a0bf', dust: '#d5deff' },
    study:  { name: '上岸', symbols: ['check', 'star', 'd1', 'crown'], c1: '#6fd6e8', c2: '#a0b8ff', dust: '#c8f0ff' },
    wealth: { name: '财运', symbols: ['diamond', 'clover', 'd8'], c1: '#f7c873', c2: '#ffe08a', dust: '#fff0c0' },
    mood:   { name: '心情', symbols: ['smiley', 'moon', 'star', 'note', 'cat', 'balloon'], c1: '#c8a0ff', c2: '#e8a0bf', dust: '#e6d5ff' },
    career: { name: '事业', symbols: ['bolt', 'sun', 'd7'], c1: '#ffb347', c2: '#ff8a5c', dust: '#ffd9b0' },
    health: { name: '平安', symbols: ['sun', 'clover', 'd6'], c1: '#8affc1', c2: '#a0e8ff', dust: '#d0ffe8' },
    number: { name: '数字', symbols: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'], c1: '#f7c873', c2: '#e8a0bf', dust: '#efeaff' }
  };
  // 符号 → 主题反查（fallback 时据此推主题；数字符号归 number）
  var SYMBOL_THEME = (function () {
    var map = {};
    for (var t in WISH_THEMES) {
      var syms = WISH_THEMES[t].symbols;
      for (var i = 0; i < syms.length; i++) if (!map[syms[i]]) map[syms[i]] = t;
    }
    return map;
  })();

  // 命中规则（返回 rule 或 null）：供 pickWishSymbol 与 wishThemeOf 共用
  function matchWishRule(text) {
    text = (text || '').toLowerCase();
    for (var i = 0; i < WISH_RULES.length; i++) {
      var rule = WISH_RULES[i];
      for (var k = 0; k < rule.kw.length; k++) {
        if (text.indexOf(rule.kw[k]) >= 0) return rule;
      }
    }
    return null;
  }

  // 生日数字根：YYYY-MM-DD 各位数字相加至一位（1–9），即「生命灵数」玩法
  function birthdayDigit(bday) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bday || '');
    if (!m) return null;
    var s = (m[1] + m[2] + m[3]).split('').reduce(function (a, c) { return a + (+c); }, 0);
    while (s > 9) s = String(s).split('').reduce(function (a, c) { return a + (+c); }, 0);
    return s;   // 1..9
  }

  // 心愿文本 + 生日 → 目标符号（返回 PATTERNS 条目）；rng 用于兜底随机
  function pickWishSymbol(text, bday, rng) {
    var r = rng || Math.random;
    var rule = matchWishRule(text);
    var id;
    if (rule && rule.id === '@digit') {
      var bd = birthdayDigit(bday);
      var dm = /([0-9])/.exec((text || '').toLowerCase());
      id = 'd' + (bd !== null ? bd : (dm ? dm[1] : Math.floor(r() * 10)));
    } else if (rule) {
      id = rule.id;
    } else {
      id = WISH_FALLBACK[Math.floor(r() * WISH_FALLBACK.length)];
    }
    for (var i = 0; i < PATTERNS.length; i++) if (PATTERNS[i].id === id) return PATTERNS[i];
    return PATTERNS[0];
  }

  // 心愿文本 + 生日 → 主题 key（决定后续惊喜池加权 + 卡面色系）
  function wishThemeOf(text, bday, rng) {
    var rule = matchWishRule(text);
    if (rule) return rule.theme;
    // 无匹配：按兜底符号所属主题推
    var sym = pickWishSymbol(text, bday, rng);
    return SYMBOL_THEME[sym.id] || 'wish';
  }

  /* ---------------- 签文库（每符号 3 条，种子选一条） ---------------- */
  var FORTUNES = {
    d0: ['圆满归零，也是新的开始', '把过去轻轻放下，宇宙替你收好', '零是起点，不是终点'],
    d1: ['一往无前，今天适合做第一个吃螃蟹的人', '孤身赶路的日子，星星都为你亮着', '唯一，本身就是稀有'],
    d2: ['成双成对，好事正在路上', '二是一半加一半，你很快会遇到另一半', '犹豫的两个选项里，先做的那个会赢'],
    d3: ['三生万物，灵感正在发芽', '今天说出口的三句话里，藏着一个机会', '过去、现在、未来，正在悄悄对齐'],
    d4: ['四季安稳，慢一点也没关系', '稳，是你今年最值钱的能力', '打地基的日子不好看，但楼会很高'],
    d5: ['五福临门，好运正在排队', '给五件事同时努力，总有一件会开花', '五个手指握起来，才是一个拳头'],
    d6: ['六六大顺，最近的路会好走', '顺，不是没风，是你的帆终于调好了', '一切顺利的前提，是你先允许它顺利'],
    d7: ['七星报喜，你等的消息快到了', '七是奇迹的谐音，别在最后一天放弃', '今天的一个小决定，会幸运很久'],
    d8: ['发发发，财源正在转向你', '八是转圈的循环，付出会以另一种方式回来', '先富起来的是胆量，别空着手勇敢'],
    d9: ['长长久久，坚持的事正在起势', '九是接近满的数字，你已经快到岸了', '长久的东西都不喧哗，比如你的努力'],
    heart: ['爱意会从你种下的地方长出来', '先爱自己，宇宙收到后会加倍返还', '你心里那点柔软，正是最硬的力量'],
    star: ['许过的愿望正在排队生效', '发光不需要理由，你本来就是星', '夜里越暗，你亮得越明显'],
    check: ['对勾已落下，这件事稳了', '完成比完美重要，而你正在完成', '宇宙确认：你走的这条路没错'],
    smiley: ['笑一下，运气会跟着弯起来', '今天的好心情是刚需，不是奢侈', '爱笑的人，宇宙会多帮一点点'],
    bolt: ['一道灵光正在劈向你的方向', '能量已充满，去做那件拖了很久的事', '快，是宇宙给你的节奏信号'],
    clover: ['幸运正在第四片叶子上等你', '转运转运，你已经是别人的锦鲤', '好事不讲道理，就像四叶草不挑地方长'],
    sun: ['天亮了，包括你心里那部分', '把自己放到有光的地方，比如今天', '温暖别人之前，宇宙先温暖你'],
    flower: ['花开有期，你的季节快到了', '慢慢开，开久一点，比开得早重要', '你浇过的水，正在别处开花'],
    diamond: ['珍贵的东西需要一点压力，你快成了', '钻石是时间的形状，你的坚持正在结晶', '值钱的日子，从不自证，只管发光'],
    moon: ['今晚的月亮替你保管思念', '安静不是落后，是另一种在生长', '阴晴圆缺都是月，低谷也是你的一部分'],
    crown: ['你在意的那件事，正在为你加冕', '皇冠从不预告，它只在努力攒够时落下', '今天起，把自己当第一名对待'],
    key: ['那把钥匙已经在你手里，门也快松动了', '新阶段不是撞开的，是你攒够了自动解锁', '先转动手里的钥匙，再谈门后有什么'],
    note: ['宇宙给你哼了一段旋律，记住今天的轻盈', '把心事谱成歌，它就只剩一半重量', '节奏对了，事情会跟着拍子来'],
    cat: ['像猫一样：该睡睡，该跳跳，不解释', '慵懒不是摆烂，是把自己的节奏放在第一位', '你也值得被温柔地摸一下头'],
    butterfly: ['破茧之前都叫等待，破茧之后都叫天赋', '你正在蜕的那层，宇宙都替你记着', '翅膀是熬出来的，不是等来的'],
    balloon: ['坏情绪已放飞，绳子这头只剩轻松', '心愿要升空，先得把手松开一点', '飘起来的事，就别再攥着了'],
    snow: ['初雪和好运一样，来的时候不需要通知', '每片雪花都落得准，你的也是', '浪漫正在路上，六角的、带光的'],
    rainbow: ['雨还没停完，但彩虹已经在排队了', '熬过那段灰的，才轮得到这七种亮', '抬头，宇宙刚给你演示完什么叫苦尽甘来'],
    bell: ['叮当一声——好事已经在敲门了', '祈福的话说过就算数，宇宙记性很好', '节日的铃铛替你倒数，快到了'],
    firework: ['攒了很久的光，就为这一刻炸开', '烟花不问高度，只问敢不敢亮', '你的那一刻正在升空，别眨眼']
  };
  function pickFortune(id, rng) {
    var arr = FORTUNES[id] || ['宇宙正在为你演化 ✦'];
    var r = rng || Math.random;
    return arr[Math.floor(r() * arr.length)];
  }

  // 卡面文案模板（v5.0.2）：把用户心愿原话混入句式 → 心愿 × 签文 × 句式 = 独一无二
  var FORTUNE_TEMPLATES = [
    '你说「{wish}」— 宇宙的回答是：{fortune}',
    '「{wish}」已收到。{fortune}',
    '你写下「{wish}」，而 {fortune}',
    '关于「{wish}」，宇宙说：{fortune}'
  ];
  // 生成卡面签文：拼入心愿原话；wish 为空则退回纯签文。rng 决定句式与签文 → 同种子同文案
  function buildFortune(id, wish, rng) {
    var r = rng || Math.random;
    var fortune = pickFortune(id, r);
    var w = (wish || '').trim();
    if (!w) return fortune;
    var tpl = FORTUNE_TEMPLATES[Math.floor(r() * FORTUNE_TEMPLATES.length)];
    return tpl.replace('{wish}', w).replace('{fortune}', fortune);
  }

  /* ---------------- 首字母表（v5.4：字母不再凝形，仅作卡面签名印章；表同时用于输入校验） ---------------- */
  // 5×7 block 字模（每字符=一个 block 像素，经 blockRows 展开即为永久静物，供未来字母纹理卡复用）
  var LETTER_FONTS = {
    A: ['.OOO.','O...O','O...O','OOOOO','O...O','O...O','O...O'],
    B: ['OOOO.','O...O','O...O','OOOO.','O...O','O...O','OOOO.'],
    C: ['.OOOO','O....','O....','O....','O....','O....','.OOOO'],
    D: ['OOOO.','O...O','O...O','O...O','O...O','O...O','OOOO.'],
    E: ['OOOOO','O....','O....','OOOO.','O....','O....','OOOOO'],
    F: ['OOOOO','O....','O....','OOOO.','O....','O....','O....'],
    G: ['.OOOO','O....','O....','O.OOO','O...O','O...O','.OOOO'],
    H: ['O...O','O...O','O...O','OOOOO','O...O','O...O','O...O'],
    I: ['OOOOO','..O..','..O..','..O..','..O..','..O..','OOOOO'],
    J: ['....O','....O','....O','....O','O...O','O...O','.OOO.'],
    K: ['O...O','O..O.','O.O..','OO...','O.O..','O..O.','O...O'],
    L: ['O....','O....','O....','O....','O....','O....','OOOOO'],
    M: ['O...O','OO.OO','O.O.O','O...O','O...O','O...O','O...O'],
    N: ['O...O','OO..O','O.O.O','O..OO','O...O','O...O','O...O'],
    O: ['.OOO.','O...O','O...O','O...O','O...O','O...O','.OOO.'],
    P: ['OOOO.','O...O','O...O','OOOO.','O....','O....','O....'],
    Q: ['.OOO.','O...O','O...O','O...O','O.O.O','O..O.','.OO.O'],
    R: ['OOOO.','O...O','O...O','OOOO.','O.O..','O..O.','O...O'],
    S: ['.OOOO','O....','O....','.OOO.','....O','....O','OOOO.'],
    T: ['OOOOO','..O..','..O..','..O..','..O..','..O..','..O..'],
    U: ['O...O','O...O','O...O','O...O','O...O','O...O','.OOO.'],
    V: ['O...O','O...O','O...O','O...O','O...O','.O.O.','..O..'],
    W: ['O...O','O...O','O...O','O...O','O.O.O','OO.OO','O...O'],
    X: ['O...O','O...O','.O.O.','..O..','.O.O.','O...O','O...O'],
    Y: ['O...O','O...O','.O.O.','..O..','..O..','..O..','..O..'],
    Z: ['OOOOO','....O','...O.','..O..','.O...','O....','OOOOO']
  };
  // 单字母 → 一次性图案对象（id 前缀 letter_，供 app 层识别「不入图鉴」）
  function letterPattern(ch) {
    var up = (ch || '').toUpperCase();
    var font = LETTER_FONTS[up];
    if (!font) return null;
    return { id: 'letter_' + up, name: up, letter: up, desc: '宇宙专门为你凝出的字母', type: '静物', tier: 'symbol', period: 1,
      rows: blockRows(font) };
  }

  /* ---------------- 结构识别 ---------------- */
  // 分组半径取 2：Life 中细胞通过"共享邻居"相互作用，标准 8 连通会把灯塔切成 12 块、
  // 把滑翔机工厂切成 8 块，无法作为整体识别。
  var RECOG_R = 2;
  var RECOG_MAX = 300;   // 超过此规模的分量视为混沌块，不参与识别（语料最大 n=131）

  var NAMES = {};
  var PATTERN_INDEX = {};
  for (var _pi = 0; _pi < PATTERNS.length; _pi++) {
    NAMES[PATTERNS[_pi].id] = PATTERNS[_pi].name;
    PATTERN_INDEX[PATTERNS[_pi].id] = PATTERNS[_pi];
  }

  // 每条图案登记多少个相位指纹：振荡/飞船按真实周期覆盖全部相位，
  // 静物仅 gen0，混沌/增殖/奇观仅 gen0（没有稳定循环可覆盖），
  // 制造机（gun）显式给 gens=30，才能识别出正在运转的工厂。
  function phaseCountOf(pat) {
    if (pat.gens) return pat.gens;
    if (pat.type === '静物') return 1;
    if ((pat.type === '振荡' || pat.type === '飞船') && pat.period >= 2) return pat.period;
    return 1;
  }

  function findComponents(g, cols, rows, radius) {
    var r = radius || RECOG_R;
    var seen = new Uint8Array(g.length);
    var stack = [];
    var out = [];
    for (var i = 0; i < g.length; i++) {
      if (!g[i] || seen[i]) continue;
      stack.length = 0; stack.push(i); seen[i] = 1;
      var idx = [];
      var minX = cols, minY = rows, maxX = -1, maxY = -1;
      while (stack.length) {
        var p = stack.pop();
        var x = p % cols, y = (p - x) / cols;
        idx.push(p);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        for (var dy = -r; dy <= r; dy++) {
          var ny = y + dy;
          if (ny < 0 || ny >= rows) continue;
          for (var dx = -r; dx <= r; dx++) {
            if (dx === 0 && dy === 0) continue;
            var nx = x + dx;
            if (nx < 0 || nx >= cols) continue;
            var ni = ny * cols + nx;
            if (g[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
          }
        }
      }
      out.push({ idx: idx, n: idx.length, minX: minX, minY: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
    }
    return out;
  }

  // 生成 8 种朝向（D4 群）的归一化指纹，使旋转/镜像/平移都不影响识别
  function orientKeys(idx, minX, minY, cols) {
    var base = [];
    for (var i = 0; i < idx.length; i++) {
      var x = idx[i] % cols, y = (idx[i] - x) / cols;
      base.push([x - minX, y - minY]);
    }
    var seen = {}, out = [];
    for (var m = 0; m < 8; m++) {
      var t = [];
      for (var k = 0; k < base.length; k++) {
        var bx = base[k][0], by = base[k][1], nx, ny;
        if (m === 0) { nx = bx; ny = by; }
        else if (m === 1) { nx = -by; ny = bx; }
        else if (m === 2) { nx = -bx; ny = -by; }
        else if (m === 3) { nx = by; ny = -bx; }
        else if (m === 4) { nx = -bx; ny = by; }
        else if (m === 5) { nx = bx; ny = -by; }
        else if (m === 6) { nx = -by; ny = -bx; }
        else { nx = by; ny = bx; }
        t.push([nx, ny]);
      }
      t.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
      var s = '';
      for (var q = 0; q < t.length; q++) s += t[q][0] + ',' + t[q][1] + ';';
      if (!seen[s]) { seen[s] = 1; out.push(s); }
    }
    return out;
  }

  var _reg = null;
  function registry() {
    if (_reg) return _reg;
    _reg = {};
    // 两遍登记：第一遍锁死每条图案的 gen0 主体指纹，第二遍才补相位指纹。
    // 只登一遍时，图案 A 的第 k 相位指纹会抢走图案 B 的初始形态指纹，
    // 导致 B 永远认不出自己、图鉴卡在 122/128（v3.6 修复）。
    for (var pass = 0; pass < 2; pass++) {
      for (var pi = 0; pi < PATTERNS.length; pi++) {
        var pat = PATTERNS[pi];
        // 符号图案（block 像素拼成）不进识别注册表：其分量就是一堆 2×2 方块，
        // 会与「石头」指纹撞车、让自然扫描把任意方块误判成数字/符号（v3.9 修复定格误触发）。
        // 它们靠「放置即收集」解锁，无需识别。
        if (pat.tier === 'symbol') continue;
        var parsed = parsePattern(pat.rows);
        var phases = phaseCountOf(pat);
        var pad = 4, extra = phases + 6;
        var c = parsed.w + pad * 2 + extra, r = parsed.h + pad * 2 + extra;
        var g = createGrid(c, r), nx = createGrid(c, r);
        placePattern(g, c, r, parsed, pad, pad, false);

        var comps0 = findComponents(g, c, r);
        var maxN = 0;
        for (var j = 0; j < comps0.length; j++) if (comps0[j].n > maxN) maxN = comps0[j].n;
        // 只登记"主体级"分量（=gen0 最大分量）：工厂的 12 格次主体与两个 2x2 方块
        // 因此被排除，否则一座工厂会被计成 2 个、孤立的"石头"也会被误判成工厂。
        var minN = maxN;

        for (var gen = 0; gen < phases; gen++) {
          if ((pass === 0) === (gen === 0)) {
            var cs = gen === 0 ? comps0 : findComponents(g, c, r);
            for (var ci = 0; ci < cs.length; ci++) {
              var comp = cs[ci];
              if (comp.n < minN) continue;
              var keys = orientKeys(comp.idx, comp.minX, comp.minY, c);
              for (var ki = 0; ki < keys.length; ki++) {
                var k = keys[ki], have = _reg[k];
                if (!have) _reg[k] = [pat.id];
                else if (pass === 0 && have.indexOf(pat.id) < 0) have.push(pat.id);
              }
            }
          }
          if (gen + 1 < phases) { step(g, nx, c, r, false); var tmp = g; g = nx; nx = tmp; }
        }
      }
    }
    return _reg;
  }

  function identify(g, cols, rows) {
    var reg = registry();
    var comps = findComponents(g, cols, rows);
    var counts = {};
    for (var i = 0; i < comps.length; i++) {
      var c = comps[i];
      if (c.n < 3 || c.n > RECOG_MAX) continue;
      var keys = orientKeys(c.idx, c.minX, c.minY, cols);
      for (var k = 0; k < keys.length; k++) {
        var ids = reg[keys[k]];
        if (ids) {
          // 一个分量可能同时命中多条图案（gen0 主体指纹相同），全部计入
          for (var ai = 0; ai < ids.length; ai++) counts[ids[ai]] = (counts[ids[ai]] || 0) + 1;
          break;
        }
      }
    }
    return counts;
  }

  /* ---------------- 大白话展示层（只改展示，不动数据真值枚举） ---------------- */
  var TYPE_LABEL = {
    '静物': '静止不动', '振荡': '原地打转', '飞船': '会自己飞', '演化': '先变形',
    '混沌': '一片混乱', '增殖': '越长越多', '奇观': '罕见奇观', '制造机': '永动工厂'
  };
  function typeLabel(type) { return TYPE_LABEL[type] || type || ''; }

  // desc 是数据真值（单测按它复算动力学），这里只负责翻成普通人能懂的话
  function plainDesc(pat) {
    var d = pat.desc || '', m;
    if ((m = /^演化 (\d+) 代后进入周期 (\d+) 摆动$/.exec(d))) {
      return '闹腾 ' + m[1] + ' 代后开始重复：每 ' + m[2] + ' 代回到原样';
    }
    if ((m = /^演化 (\d+) 代后化作飞船飞走$/.exec(d))) {
      return m[1] + ' 代后长出翅膀，飞走了';
    }
    if ((m = /^演化 (\d+) 代后定格$/.exec(d))) {
      return m[1] + ' 代后彻底静止，再无变化';
    }
    if (pat.type === '静物') return '落定后就不再变化，永远静止';
    if (pat.type === '振荡') {
      return (pat.period === 2 ? '原地来回晃' : '原地打转') + '，每 ' + (pat.period || '?') + ' 代回到原样';
    }
    if (pat.type === '飞船') return '会自己飞走，每 ' + (pat.period || '?') + ' 代换一个位置';
    if (pat.type === '制造机') return '永动机工厂：源源不断造出滑翔机';
    if (pat.type === '增殖') return '越长越多，很难安静下来';
    if (pat.type === '混沌') return '看不出规律，一直乱下去';
    return d;   // 奇观等自带可读描述，原样展示
  }

  // 光告诉用户「它循环了」没用——还得告诉他们下一步能干什么。
  // 两组候选按序轮换，避免每次都是同一句；sel 指向要高亮的入口 id。
  var CYCLE_HINTS = {
    'static': [
      { text: '下一步：点右下「符号盒」，放一个有意义的符号上去', sel: 'btnPatterns' },
      { text: '下一步：在空格上画几笔，或按 R 随机来一片', sel: 'stage' },
      { text: '下一步：拖底部速度条调慢，看清它怎么变', sel: 'speed' }
    ],
    'cycle': [
      { text: '下一步：点右下「符号盒」放个符号，或按 R 再撒一锅汤', sel: 'btnPatterns' },
      { text: '下一步：自己画几格，看会不会长出新形状', sel: 'stage' },
      { text: '下一步：调快速度，看它跑得有多欢', sel: 'speed' }
    ]
  };
  function cycleHint(kind, seq) {
    var pool = CYCLE_HINTS[kind] || CYCLE_HINTS['cycle'];
    var n = pool.length;
    var i = ((seq | 0) % n + n) % n;   // 允许负数/超大序号
    return pool[i];
  }

  return {
    BIRTH: BIRTH, SURVIVE: SURVIVE, PATTERNS: PATTERNS, NAMES: NAMES, PATTERN_INDEX: PATTERN_INDEX,
    phaseCountOf: phaseCountOf,
    parsePattern: parsePattern, createGrid: createGrid, countLive: countLive,
    countNeighbors: countNeighbors, step: step, randomFill: randomFill,
    placePattern: placePattern, gridKey: gridKey, detectCycle: detectCycle,
    blockRows: blockRows,
    findComponents: findComponents, orientKeys: orientKeys, identify: identify,
    typeLabel: typeLabel, plainDesc: plainDesc, cycleHint: cycleHint,
    mulberry32: mulberry32, hashSeed: hashSeed, birthdayDigit: birthdayDigit,
    pickWishSymbol: pickWishSymbol, pickFortune: pickFortune, buildFortune: buildFortune,
    wishThemeOf: wishThemeOf, matchWishRule: matchWishRule,
    letterPattern: letterPattern, LETTER_FONTS: LETTER_FONTS,
    WISH_RULES: WISH_RULES, WISH_FALLBACK: WISH_FALLBACK, FORTUNES: FORTUNES,
    WISH_THEMES: WISH_THEMES, SYMBOL_THEME: SYMBOL_THEME, FORTUNE_TEMPLATES: FORTUNE_TEMPLATES
  };
})();
/* ENGINE-END */
