'use strict';
/* 残局 / 教学关卡回归测试：node test/levels.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');

globalThis.Chess = new Function(fs.readFileSync(path.join(root, 'js', 'chess.js'), 'utf8') + ';return Chess;')();
globalThis.AI = new Function(fs.readFileSync(path.join(root, 'js', 'ai.js'), 'utf8') + ';return AI;')();
const Levels = new Function(fs.readFileSync(path.join(root, 'js', 'levels.js'), 'utf8') + ';return Levels;')();

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    → ' + e.message); }
}
function toBoard(pieces) {
  const b = Array.from({ length: 10 }, () => Array(9).fill(null));
  for (const [s, t, r, c] of pieces) b[r][c] = { side: s, type: t };
  return b;
}

const LEVELS = Levels.LEVELS;

// ---------- 残局合法性（全部关卡） ----------
for (let i = 0; i < LEVELS.length; i++) {
  const lv = LEVELS[i];
  const idx = i;
  test(`L${idx + 1} ${lv.name}：局面合法`, () => {
    assert.ok(lv.side === 'red', '红先');
    assert.ok(lv.diff >= 1 && lv.diff <= 3, '难度 1-3');
    const b = toBoard(lv.pieces);
    assert.ok(Chess.findKing(b, 'red'), '红帅存在');
    assert.ok(Chess.findKing(b, 'black'), '黑将存在');
    assert.ok(!Chess.inCheck(b, 'red'), '红不被将军');
    assert.ok(!Chess.inCheck(b, 'black'), '黑不被将军（红先手）');
    assert.ok(Chess.allLegalMoves(b, 'red').length > 0, '红有合法走法');
    assert.ok(Chess.allLegalMoves(b, 'black').length > 0, '黑有应手（非已死局）');
  });
}

// ---------- 残局可解性：L6 起必须存在强制杀（红在 3 层内将死黑方） ----------
for (let i = 5; i < LEVELS.length; i++) {
  const lv = LEVELS[i];
  const idx = i;
  test(`L${idx + 1} ${lv.name}：红先 3 层内强制将死`, () => {
    const b = toBoard(lv.pieces);
    assert.ok(AI.canForceMate(b, 'red', 3), '存在强制杀路径');
  });
}

// ---------- 教学关：任务可达性 ----------
for (const t of Levels.TUTORIAL) {
  test(`教学 ${t.name}：所有目标点任务子可达（BFS 4 层）`, () => {
    assert.ok(t.targets.length >= 2, '至少 2 个任务');
    const b = toBoard(t.pieces);
    // 找到任务子
    let pos = null;
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
      const p = b[r][c];
      if (p && p.side === 'red' && p.type === t.type) pos = [r, c];
    }
    assert.ok(pos, '任务子存在');
    // BFS：任务子从起点出发，真实模拟每一步走子（移动后从新位置继续）
    const q = [{ r: pos[0], c: pos[1], board: b }];
    const dist = new Map();
    dist.set(pos.join(','), 0);
    const maxDist = 4;
    while (q.length) {
      const { r, c, board } = q.shift();
      const d = dist.get(r + ',' + c);
      if (d >= maxDist) continue;
      for (const [nr, nc] of Chess.legalMovesFrom(board, 'red', r, c)) {
        const key = nr + ',' + nc;
        if (dist.has(key)) continue;
        const nb = Chess.cloneBoard(board);
        Chess.applyMove(nb, r, c, nr, nc);
        dist.set(key, d + 1);
        q.push({ r: nr, c: nc, board: nb });
      }
    }
    for (const [tr, tc] of t.targets) {
      assert.ok(dist.has(tr + ',' + tc), `目标 (${tr},${tc}) 可达`);
    }
  });
}

console.log('\n共 ' + (passed + failed) + ' 项：通过 ' + passed + '，失败 ' + failed);
process.exit(failed ? 1 : 0);
