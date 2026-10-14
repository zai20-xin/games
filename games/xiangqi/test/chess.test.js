'use strict';
/* 规则引擎回归测试：node test/chess.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'chess.js'), 'utf8');
const Chess = new Function(src + '\n;return Chess;')();

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    → ' + e.message); }
}
function expectLen(arr, n, msg) {
  assert.strictEqual(arr.length, n, (msg || '') + '（期望 ' + n + '，实际 ' + arr.length + '：' + JSON.stringify(arr) + '）');
}
function board() { return Chess.createBoard(); }
function blank() { return Array.from({ length: 10 }, () => Array(9).fill(null)); }
function has(arr, r, c) { return arr.some(([rr, cc]) => rr === r && cc === c); }

// ---------- 初始局面 ----------
test('初始局面：32 子，双方各 16', () => {
  const b = board();
  let red = 0, black = 0;
  for (const row of b) for (const p of row) { if (p) p.side === 'red' ? red++ : black++; }
  assert.strictEqual(red, 16);
  assert.strictEqual(black, 16);
});

test('初始局面：红方先行，红帅在 (9,4)', () => {
  const b = board();
  assert.deepStrictEqual(Chess.findKing(b, 'red'), { r: 9, c: 4 });
  assert.deepStrictEqual(Chess.findKing(b, 'black'), { r: 0, c: 4 });
});

// ---------- 车 ----------
test('车：初始 (9,0) 被己方兵挡，合法走法 = (8,0),(7,0)', () => {
  expectLen(Chess.legalMovesFrom(board(), 'red', 9, 0), 2, '车 (9,0)');
});

test('车：直线可吃远端子', () => {
  const b = blank();
  b[9][0] = { side: 'red', type: 'r' };
  b[0][0] = { side: 'black', type: 'r' };
  b[9][3] = { side: 'red', type: 'k' };
  b[0][4] = { side: 'black', type: 'k' };
  const moves = Chess.legalMovesFrom(b, 'red', 9, 0);
  assert.ok(has(moves, 0, 0), '可吃黑车');
  assert.ok(has(moves, 1, 0) && has(moves, 5, 0), '沿列可走通');
  assert.ok(has(moves, 9, 1), '可横走');
});

test('车：不能跳过棋子', () => {
  const b = blank();
  b[9][0] = { side: 'red', type: 'r' };
  b[0][0] = { side: 'black', type: 'r' };
  b[5][0] = { side: 'red', type: 'c' };   // 红炮挡住
  b[9][4] = { side: 'red', type: 'k' };
  b[0][4] = { side: 'black', type: 'k' };
  const moves = Chess.legalMovesFrom(b, 'red', 9, 0);
  assert.ok(!has(moves, 4, 0), '不能跳过炮');
  assert.ok(!has(moves, 0, 0), '不能吃到黑车');
});

// ---------- 马 ----------
test('马：初始 (9,1) 合法走法 = (7,0),(7,2)', () => {
  const moves = Chess.legalMovesFrom(board(), 'red', 9, 1);
  expectLen(moves, 2, '马 (9,1)');
  assert.ok(has(moves, 7, 0) && has(moves, 7, 2));
});

test('马：蹩马腿（(8,1) 有子时马 (9,1) 无合法走法）', () => {
  const b = board();
  b[8][1] = { side: 'black', type: 'p' };
  expectLen(Chess.legalMovesFrom(b, 'red', 9, 1), 0, '蹩马腿');
});

// ---------- 象 ----------
test('象：初始 (9,2) 合法走法 = (7,0),(7,4)', () => {
  const moves = Chess.legalMovesFrom(board(), 'red', 9, 2);
  expectLen(moves, 2, '象 (9,2)');
  assert.ok(has(moves, 7, 0) && has(moves, 7, 4));
});

test('象：塞象眼（(8,1) 有子时只能走 (7,4)）', () => {
  const b = board();
  b[8][1] = { side: 'black', type: 'p' };
  const moves = Chess.legalMovesFrom(b, 'red', 9, 2);
  expectLen(moves, 1, '塞象眼');
  assert.ok(has(moves, 7, 4));
});

test('象：不能过河（红象 (5,2) 只能走到 (7,0),(7,4)）', () => {
  const b = board();
  b[5][2] = { side: 'red', type: 'e' };
  const moves = Chess.legalMovesFrom(b, 'red', 5, 2);
  expectLen(moves, 2, '象不过河');
  assert.ok(has(moves, 7, 0) && has(moves, 7, 4));
});

// ---------- 士 / 将 ----------
test('士：初始 (9,3) 只能走 (8,4)', () => {
  const moves = Chess.legalMovesFrom(board(), 'red', 9, 3);
  expectLen(moves, 1, '士 (9,3)');
  assert.ok(has(moves, 8, 4));
});

test('士：九宫限制（(7,3) 只能走 (8,4)，(8,2) 出九宫）', () => {
  const b = board();
  b[7][3] = { side: 'red', type: 'a' };
  const moves = Chess.legalMovesFrom(b, 'red', 7, 3);
  expectLen(moves, 1, '士九宫');
  assert.ok(has(moves, 8, 4));
});

test('将：初始 (9,4) 只能走 (8,4)', () => {
  const moves = Chess.legalMovesFrom(board(), 'red', 9, 4);
  expectLen(moves, 1, '将 (9,4)');
  assert.ok(has(moves, 8, 4));
});

test('将：九宫中心 (8,4) 可走 4 个方向', () => {
  const b = blank();
  b[8][4] = { side: 'red', type: 'k' };
  b[0][4] = { side: 'black', type: 'k' };
  b[5][4] = { side: 'black', type: 'p' };  // 挡对脸线
  const moves = Chess.legalMovesFrom(b, 'red', 8, 4);
  expectLen(moves, 4, '将中心');
});

test('将：不能出九宫（(7,4) 不能走到 (6,4)）', () => {
  const b = board();
  const moves = Chess.legalMovesFrom(b, 'red', 7, 4);
  assert.ok(!has(moves, 6, 4));
});

// ---------- 兵 ----------
test('兵：未过河 (6,0) 只能前进 (5,0)', () => {
  const moves = Chess.legalMovesFrom(board(), 'red', 6, 0);
  expectLen(moves, 1, '兵未过河');
  assert.ok(has(moves, 5, 0));
});

test('兵：过河后可横走（(4,4) → 3 点）', () => {
  const b = board();
  b[4][4] = { side: 'red', type: 'p' };
  const moves = Chess.legalMovesFrom(b, 'red', 4, 4);
  expectLen(moves, 3, '兵过河');
  assert.ok(has(moves, 3, 4) && has(moves, 4, 3) && has(moves, 4, 5));
});

test('兵：不能后退（(4,4) 不含 (5,4)）', () => {
  const b = board();
  b[4][4] = { side: 'red', type: 'p' };
  const moves = Chess.legalMovesFrom(b, 'red', 4, 4);
  assert.ok(!has(moves, 5, 4));
});

test('兵：底线（黑卒 (9,4)）只能横走 2 点', () => {
  const b = blank();
  b[9][4] = { side: 'black', type: 'p' };
  b[0][4] = { side: 'black', type: 'k' };
  b[1][4] = { side: 'black', type: 'a' };  // 挡对脸线
  b[7][4] = { side: 'red', type: 'k' };
  const moves = Chess.legalMovesFrom(b, 'black', 9, 4);
  expectLen(moves, 2, '底线兵');
  assert.ok(has(moves, 9, 3) && has(moves, 9, 5));
  assert.ok(!has(moves, 8, 4), '不能后退');
});

// ---------- 炮 ----------
test('炮：初始 (7,1) 合法走法 = 12 点', () => {
  const moves = Chess.legalMovesFrom(board(), 'red', 7, 1);
  expectLen(moves, 12, '炮 (7,1)');
  assert.ok(!has(moves, 2, 1), '无炮架不能吃黑炮');
  assert.ok(has(moves, 0, 1), '可隔黑炮吃黑车');
});

test('炮：隔山打牛（(5,0) 隔 (5,2) 吃 (5,4)）', () => {
  const b = blank();
  b[5][0] = { side: 'red', type: 'c' };
  b[5][2] = { side: 'black', type: 'p' };
  b[5][4] = { side: 'black', type: 'h' };
  b[9][4] = { side: 'red', type: 'k' };
  b[0][4] = { side: 'black', type: 'k' };
  b[1][4] = { side: 'black', type: 'a' };  // 挡对脸线，防止吃马后露对脸
  const moves = Chess.legalMovesFrom(b, 'red', 5, 0);
  assert.ok(has(moves, 5, 4), '隔山吃马');
  assert.ok(!has(moves, 5, 2), '炮架子不能吃');
  assert.ok(has(moves, 5, 1), '可走空点');
});

test('炮：无炮架不能吃子（(7,1) 不吃黑炮）', () => {
  const b = board();
  const moves = Chess.legalMovesFrom(b, 'red', 7, 1);
  assert.ok(!has(moves, 2, 1));
});

// ---------- 将帅对脸 ----------
test('将帅对脸：同列无遮挡双方都算被将军', () => {
  const b = blank();
  b[9][4] = { side: 'red', type: 'k' };
  b[0][4] = { side: 'black', type: 'k' };
  assert.ok(Chess.inCheck(b, 'red'));
  assert.ok(Chess.inCheck(b, 'black'));
});

// ---------- 送将过滤 ----------
test('送将过滤：红炮 (7,4) 是唯一遮罩，横走即送将', () => {
  const b = blank();
  b[9][4] = { side: 'red', type: 'k' };
  b[0][4] = { side: 'black', type: 'k' };
  b[7][4] = { side: 'red', type: 'c' };
  const moves = Chess.legalMovesFrom(b, 'red', 7, 4);
  assert.ok(!has(moves, 7, 3) && !has(moves, 7, 5), '横走暴露对脸');
  assert.ok(has(moves, 6, 4), '沿列上移仍遮挡');
  assert.ok(has(moves, 8, 4), '沿列下移仍遮挡');
});

// ---------- 绝杀 / 困毙 ----------
test('绝杀：黑将 (0,4) 被三车+帅围死，无合法走法且被将军', () => {
  const b = blank();
  b[0][4] = { side: 'black', type: 'k' };
  b[1][4] = { side: 'red', type: 'r' };   // 将军
  b[2][3] = { side: 'red', type: 'r' };   // 控 (0,3)
  b[2][5] = { side: 'red', type: 'r' };   // 控 (0,5)
  b[9][4] = { side: 'red', type: 'k' };   // 使将吃 (1,4) 后对脸送死
  assert.ok(Chess.inCheck(b, 'black'), '黑被将军');
  expectLen(Chess.allLegalMoves(b, 'black'), 0, '黑无合法走法');
});

// ---------- 走法命名 ----------
test('notateMove：炮八平五', () => {
  const b = board();
  assert.strictEqual(Chess.notateMove(b, 7, 1, 7, 4), '炮八平五');
});

test('notateMove：炮二平五（右炮）', () => {
  const b = board();
  assert.strictEqual(Chess.notateMove(b, 7, 7, 7, 4), '炮二平五');
});

test('notateMove：马二进四', () => {
  const b = board();
  assert.strictEqual(Chess.notateMove(b, 9, 7, 8, 5), '马二进四');
});

test('notateMove：兵一进一', () => {
  const b = board();
  assert.strictEqual(Chess.notateMove(b, 6, 8, 5, 8), '兵一进一');
});

test('notateMove：黑方用阿拉伯数字（马8进6）', () => {
  const b = board();
  assert.strictEqual(Chess.notateMove(b, 0, 7, 1, 5), '马8进6');
});

test('notateMove：同列双子用前后区分', () => {
  const b = blank();
  b[9][4] = { side: 'red', type: 'k' };
  b[9][0] = { side: 'red', type: 'r' };
  b[6][0] = { side: 'red', type: 'r' };
  b[0][4] = { side: 'black', type: 'k' };
  assert.strictEqual(Chess.notateMove(b, 9, 0, 8, 0), '后车九进一');
  assert.strictEqual(Chess.notateMove(b, 6, 0, 5, 0), '前车九进一');
});

// ---------- 签名 ----------
test('boardSignature：相同局面签名一致，走后不同', () => {
  const b1 = board();
  const b2 = Chess.cloneBoard(b1);
  assert.strictEqual(Chess.boardSignature(b1), Chess.boardSignature(b2));
  Chess.applyMove(b2, 7, 1, 7, 4);
  assert.notStrictEqual(Chess.boardSignature(b1), Chess.boardSignature(b2));
});

// ---------- 越权 ----------
test('legalMovesFrom：非走子方棋子返回空', () => {
  const b = board();
  expectLen(Chess.legalMovesFrom(b, 'red', 0, 0), 0, '黑车非红方');
});

test('legalMovesFrom：空位返回空', () => {
  const b = board();
  expectLen(Chess.legalMovesFrom(b, 'red', 5, 0), 0, '空位');
});

// ---------- 汇总 ----------
console.log('\n共 ' + (passed + failed) + ' 项：通过 ' + passed + '，失败 ' + failed);
process.exit(failed ? 1 : 0);
