'use strict';
/* 临时脚本：生成"强制 3 步杀"残局局面（node tools/generate_levels.js）
   输出到 tools/generated_levels.json，人工挑选后嵌入 js/levels.js */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
globalThis.Chess = new Function(fs.readFileSync(path.join(root, 'js', 'chess.js'), 'utf8') + ';return Chess;')();
const AISRC = fs.readFileSync(path.join(root, 'js', 'ai.js'), 'utf8');
globalThis.AI = new Function(AISRC + ';return AI;')();

const rnd = (n) => Math.floor(Math.random() * n);
const RED_TYPES = ['r', 'h', 'c', 'p', 'a', 'e'];
const BLACK_TYPES = ['a', 'e', 'h', 'c', 'r', 'p'];
const TYPE_NAME = { r: '车', h: '马', c: '炮', p: '兵', a: '士', e: '象', k: '帅' };
const COOL = ['铁骑', '惊雷', '破阵', '穿云', '锁喉', '飞燕', '断桥', '卷帘', '探营', '勒马', '伏虎', '回马', '长虹', '摘星', '封喉'];

function blank() { return Array.from({ length: 10 }, () => Array(9).fill(null)); }
function toBoard(level) {
  const b = blank();
  for (const [s, t, r, c] of level.pieces) b[r][c] = { side: s, type: t };
  return b;
}

function genOne() {
  const pieces = [
    ['red', 'k', 9, 4],
    ['black', 'k', 0, 4],
  ];
  const used = new Set(['9,4', '0,4']);
  const redN = 1 + rnd(4);       // 1-4 个红子
  const blackN = rnd(4);         // 0-3 个黑子
  const pick = (types, allowOwnPalace) => {
    for (let k = 0; k < 60; k++) {
      const t = types[rnd(types.length)];
      const r = rnd(10), c = rnd(9);
      if (used.has(r + ',' + c)) continue;
      // 红子尽量在本方半场（r>=5 或进攻子任意）；黑子防御位置随意
      if (t === 'e') { // 象必须在本方半场
        if (r < 5 || r > 9) continue;
        if (c < 0 || c > 8) continue;
      }
      if (t === 'a') { if (c < 3 || c > 5 || r < 7 || r > 9) continue; } // 红士九宫
      used.add(r + ',' + c);
      return [t, r, c];
    }
    return null;
  };
  for (let i = 0; i < redN; i++) {
    const p = pick(RED_TYPES);
    if (!p) return null;
    pieces.push(['red', p[0], p[1], p[2]]);
  }
  for (let i = 0; i < blackN; i++) {
    const t = BLACK_TYPES[rnd(BLACK_TYPES.length)];
    let r, c;
    let ok = false;
    for (let k = 0; k < 80 && !ok; k++) {
      r = rnd(10); c = rnd(9);
      if (used.has(r + ',' + c)) continue;
      if (t === 'a' && (c < 3 || c > 5 || r > 2)) continue;  // 黑士九宫 r<=2
      if (t === 'e' && r > 4) continue;                       // 黑象本方
      ok = true;
    }
    if (!ok) return null;
    used.add(r + ',' + c);
    pieces.push(['black', t, r, c]);
  }
  return pieces;
}

function valid(pieces) {
  const b = toBoard({ pieces });
  if (Chess.inCheck(b, 'red')) return false;     // 红不被将军
  if (Chess.inCheck(b, 'black')) return false;   // 黑不被将军（红先手）
  if (Chess.allLegalMoves(b, 'black').length === 0) return false; // 黑有应手
  if (Chess.allLegalMoves(b, 'red').length === 0) return false;
  return true;
}

const levels = [];
const seen = new Set();
const attempts = [];
let rounds = 0;
while (levels.length < 46 && rounds < 40000) {
  rounds++;
  const pieces = genOne();
  if (!pieces) continue;
  const b = toBoard({ pieces });
  const sig = Chess.boardSignature(b);
  if (seen.has(sig)) continue;
  seen.add(sig);
  if (!valid(pieces)) continue;
  // 找到红第一步走什么子（将军走法的子力类型，用于命名/描述）
  let firstMoveType = null;
  const moves = Chess.allLegalMoves(b, 'red');
  for (const m of moves) {
    const nb = Chess.cloneBoard(b);
    Chess.applyMove(nb, m.fr, m.fc, m.tr, m.tc);
    if (!Chess.findKing(nb, 'black') || Chess.allLegalMoves(nb, 'black').length === 0) {
      firstMoveType = b[m.fr][m.fc].type;
      break;
    }
  }
  let depth = 2;
  if (!AI.canForceMate(b, 'red', 2)) {
    if (!AI.canForceMate(b, 'red', 3)) continue;
    depth = 3;
  }
  if (firstMoveType === null) firstMoveType = 'k';
  const redTypes = pieces.filter(p => p[0] === 'red' && p[1] !== 'k').map(p => p[1]);
  const blackN = pieces.filter(p => p[0] === 'black' && p[1] !== 'k').length;
  const total = pieces.length - 2;
  // 难度 = 深度（2 步杀 1 档 / 3 步杀 2 档）+ 子力复杂度加成
  let diff = depth === 2 ? 1 : 2;
  if (total >= 5) diff++;
  if (total >= 7) diff++;
  diff = Math.min(3, Math.max(1, diff));
  const name0 = TYPE_NAME[firstMoveType];
  const name = COOL[rnd(COOL.length)] + name0 + '阵';
  levels.push({
    name, diff,
    desc: '红先，' + (depth === 2 ? '两步' : '三步') + '内将死黑方',
    side: 'red',
    pieces,
  });
  attempts.push({ name, depth, diff, red: redTypes.join(''), blackN, first: firstMoveType });
}

fs.writeFileSync(path.join(__dirname, 'generated_levels.json'), JSON.stringify(levels, null, 1));
console.log('生成 ' + levels.length + ' 个有效关卡（目标 46）');
console.log('难度分布：', levels.reduce((a, l) => { a[l.diff] = (a[l.diff] || 0) + 1; return a; }, {}));
console.log('两步杀 ' + levels.filter(l => l.desc.includes('两步')).length + ' / 三步杀 ' + levels.filter(l => l.desc.includes('三步')).length);
