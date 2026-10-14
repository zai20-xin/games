'use strict';
/* ============ AI 引擎：初级贪心 / 中级两步搜索 / 残局可解性判定 ============ */
const AI = (function () {
  const VALUE = { p: 1, a: 2, e: 2, h: 4, c: 4.5, r: 9, k: 1000 };
  const opp = (s) => (s === 'red' ? 'black' : 'red');

  // 子力评估（side 视角，正数对 side 有利）
  function evalBoard(b, side) {
    let score = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = b[r][c];
        if (!p) continue;
        let v = VALUE[p.type] || 1;
        if (p.type === 'p') {
          const crossed = p.side === 'red' ? r <= 4 : r >= 5;
          if (crossed) v += 1;            // 过河兵价值提升
          if (p.side === 'red' ? r === 0 : r === 9) v += 0.5; // 底兵
        }
        score += (p.side === side ? 1 : -1) * v;
      }
    }
    if (Chess.inCheck(b, side)) score -= 3;
    if (Chess.inCheck(b, opp(side))) score += 3;
    return score;
  }

  // 负极大搜索（depth 为剩余层数）
  function negamax(b, side, depth, alpha, beta) {
    const moves = Chess.allLegalMoves(b, side);
    if (moves.length === 0) {
      // 无子可走：被将死或困毙
      return Chess.inCheck(b, side) ? -100000 + depth : -90000 + depth;
    }
    if (depth === 0) return evalBoard(b, side);
    let best = -Infinity;
    for (const m of moves) {
      const nb = Chess.cloneBoard(b);
      Chess.applyMove(nb, m.fr, m.fc, m.tr, m.tc);
      const s = -negamax(nb, opp(side), depth - 1, -beta, -alpha);
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function moveOrder(b, moves, side) {
    // 吃子价值排序 + 将军优先，提升剪枝效率
    return moves.slice().sort((a, c) => {
      const ca = b[a.tr][a.tc] ? VALUE[b[a.tr][a.tc].type] : 0;
      const cb = b[c.tr][c.tc] ? VALUE[b[c.tr][c.tc].type] : 0;
      return cb - ca;
    });
  }

  // level 1 初级：贪心（吃子 + 将军 + 送将惩罚 + 随机扰动）
  function greedyMove(b, side) {
    const moves = Chess.allLegalMoves(b, side);
    if (!moves.length) return null;
    let best = null, bestScore = -Infinity;
    for (const m of moves) {
      const cap = b[m.tr][m.tc];
      const nb = Chess.cloneBoard(b);
      Chess.applyMove(nb, m.fr, m.fc, m.tr, m.tc);
      let sc = cap ? VALUE[cap.type] * 3 : 0;
      if (!Chess.findKing(nb, opp(side))) sc += 10000;       // 吃王
      if (Chess.allLegalMoves(nb, opp(side)).length === 0) sc += 8000; // 将死
      if (Chess.inCheck(nb, opp(side))) sc += 5;             // 将军
      if (Chess.inCheck(nb, side)) sc -= 6;                  // 送将（理论已过滤）
      sc += Math.random() * 0.6;                             // 初级的一点"人味"
      if (sc > bestScore) { bestScore = sc; best = m; }
    }
    return best;
  }

  // level 2 中级：两步搜索（己方走 + 对方最优应）
  function searchMove(b, side) {
    const moves = moveOrder(b, Chess.allLegalMoves(b, side), side);
    if (!moves.length) return null;
    let best = null, bestScore = -Infinity;
    for (const m of moves) {
      const nb = Chess.cloneBoard(b);
      Chess.applyMove(nb, m.fr, m.fc, m.tr, m.tc);
      const s = -negamax(nb, opp(side), 1, -Infinity, Infinity);
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best;
  }

  function chooseMove(b, side, level) {
    if (!Chess.findKing(b, side)) return null;
    return level >= 2 ? searchMove(b, side) : greedyMove(b, side);
  }

  // 强制杀判定：side 走，depth 层内无论对方如何应对都能将死
  function canForceMate(b, side, depth) {
    const moves = Chess.allLegalMoves(b, side);
    for (const m of moves) {
      const nb = Chess.cloneBoard(b);
      Chess.applyMove(nb, m.fr, m.fc, m.tr, m.tc);
      if (!Chess.findKing(nb, opp(side))) return true;       // 直接吃王
      if (Chess.allLegalMoves(nb, opp(side)).length === 0) return true; // 将死
      if (depth <= 1) continue;
      const oppMoves = Chess.allLegalMoves(nb, opp(side));
      let allMate = true;
      for (const om of oppMoves) {
        const nb2 = Chess.cloneBoard(nb);
        Chess.applyMove(nb2, om.fr, om.fc, om.tr, om.tc);
        if (!canForceMate(nb2, side, depth - 1)) { allMate = false; break; }
      }
      if (allMate) return true;
    }
    return false;
  }

  return { chooseMove, canForceMate, evalBoard };
})();
