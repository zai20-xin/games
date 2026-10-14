'use strict';
/* ============ 中国象棋规则引擎（纯逻辑，无渲染） ============ */
const Chess = (function () {
  const ROWS = 10, COLS = 9;

  const K = 'k', A = 'a', E = 'e', H = 'h', R = 'r', C = 'c', P = 'p';

  const PIECE_NAME = {
    red:   { k: '帅', a: '仕', e: '相', h: '马', r: '车', c: '炮', p: '兵' },
    black: { k: '将', a: '士', e: '象', h: '马', r: '车', c: '炮', p: '卒' },
  };

  const DIR4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const HORSE_MOVES = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const HORSE_LEGS  = [[-1, 0], [-1, 0], [0, -1], [0, 1], [0, -1], [0, 1], [1, 0], [1, 0]];
  const ELEPHANT_MOVES = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
  const ELEPHANT_EYES  = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function opponent(side) { return side === 'red' ? 'black' : 'red'; }
  function forward(side) { return side === 'red' ? -1 : 1; }
  function inside(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  // 初始局面：红方在下（row 9），黑方在上（row 0）
  function createBoard() {
    const b = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const line = (side, row) => {
      const t = (type) => ({ type, side });
      b[row][0] = t(R); b[row][1] = t(H); b[row][2] = t(E); b[row][3] = t(A); b[row][4] = t(K);
      b[row][5] = t(A); b[row][6] = t(E); b[row][7] = t(H); b[row][8] = t(R);
    };
    line('black', 0);
    line('red', 9);
    b[2][1] = { type: C, side: 'black' }; b[2][7] = { type: C, side: 'black' };
    b[7][1] = { type: C, side: 'red' };   b[7][7] = { type: C, side: 'red' };
    for (let c = 0; c < COLS; c += 2) {
      b[3][c] = { type: P, side: 'black' };
      b[6][c] = { type: P, side: 'red' };
    }
    return b;
  }

  function cloneBoard(b) { return b.map(row => row.slice()); }

  function findKing(b, side) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (p && p.type === K && p.side === side) return { r, c };
      }
    }
    return null;
  }

  function inPalace(r, c, side) {
    if (c < 3 || c > 5) return false;
    return side === 'red' ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
  }

  function crossedRiver(r, side) { return side === 'red' ? r <= 4 : r >= 5; }

  // 伪走法：不校验“送将”
  function pseudoMoves(b, r, c) {
    const p = b[r][c];
    if (!p) return [];
    const moves = [];
    const tryAdd = (nr, nc) => {
      if (!inside(nr, nc)) return;
      const t = b[nr][nc];
      if (!t || t.side !== p.side) moves.push([nr, nc]);
    };

    if (p.type === R) { // 车：直线
      for (const [dr, dc] of DIR4) {
        let nr = r + dr, nc = c + dc;
        while (inside(nr, nc)) {
          const t = b[nr][nc];
          if (!t) { moves.push([nr, nc]); }
          else { if (t.side !== p.side) moves.push([nr, nc]); break; }
          nr += dr; nc += dc;
        }
      }
    } else if (p.type === H) { // 马：日字，蹩马腿
      for (let i = 0; i < 8; i++) {
        const [dr, dc] = HORSE_MOVES[i];
        const [lr, lc] = HORSE_LEGS[i];
        if (inside(r + lr, c + lc) && b[r + lr][c + lc]) continue; // 蹩腿
        tryAdd(r + dr, c + dc);
      }
    } else if (p.type === E) { // 象：田字，塞象眼，不过河
      for (let i = 0; i < 4; i++) {
        const nr = r + ELEPHANT_MOVES[i][0], nc = c + ELEPHANT_MOVES[i][1];
        if (!inside(nr, nc)) continue;
        if (p.side === 'red' ? nr < 5 : nr > 4) continue; // 不能过河
        const [er, ec] = ELEPHANT_EYES[i];
        if (b[r + er][c + ec]) continue; // 塞象眼
        tryAdd(nr, nc);
      }
    } else if (p.type === A) { // 士：九宫斜走
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (inside(nr, nc) && inPalace(nr, nc, p.side)) tryAdd(nr, nc);
      }
    } else if (p.type === K) { // 将/帅：九宫直走
      for (const [dr, dc] of DIR4) {
        const nr = r + dr, nc = c + dc;
        if (inside(nr, nc) && inPalace(nr, nc, p.side)) tryAdd(nr, nc);
      }
    } else if (p.type === C) { // 炮：隔山打牛
      for (const [dr, dc] of DIR4) {
        let nr = r + dr, nc = c + dc, jumped = false;
        while (inside(nr, nc)) {
          const t = b[nr][nc];
          if (!jumped) {
            if (!t) { moves.push([nr, nc]); }
            else { jumped = true; }
          } else {
            if (t) { if (t.side !== p.side) moves.push([nr, nc]); break; }
          }
          nr += dr; nc += dc;
        }
      }
    } else if (p.type === P) { // 兵：前进，过河可横
      const nr = r + forward(p.side);
      if (inside(nr, c)) tryAdd(nr, c);
      if (crossedRiver(r, p.side)) {
        tryAdd(r, c - 1);
        tryAdd(r, c + 1);
      }
    }
    return moves;
  }

  // 是否被将军（含将帅对脸）
  function inCheck(b, side) {
    const k = findKing(b, side);
    if (!k) return true;
    const enemy = opponent(side);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (p && p.side === enemy) {
          if (pseudoMoves(b, r, c).some(([nr, nc]) => nr === k.r && nc === k.c)) return true;
        }
      }
    }
    const ek = findKing(b, enemy);
    if (ek && ek.c === k.c) {
      const lo = Math.min(ek.r, k.r), hi = Math.max(ek.r, k.r);
      let between = 0;
      for (let rr = lo + 1; rr < hi; rr++) if (b[rr][ek.c]) between++;
      if (between === 0) return true; // 将帅对脸
    }
    return false;
  }

  // 合法走法（过滤送将）
  function legalMovesFrom(b, side, r, c) {
    const p = b[r][c];
    if (!p || p.side !== side) return [];
    const res = [];
    for (const [nr, nc] of pseudoMoves(b, r, c)) {
      const tmp = cloneBoard(b);
      tmp[nr][nc] = tmp[r][c];
      tmp[r][c] = null;
      if (!inCheck(tmp, side)) res.push([nr, nc]);
    }
    return res;
  }

  function allLegalMoves(b, side) {
    const res = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (b[r][c] && b[r][c].side === side) {
          for (const [nr, nc] of legalMovesFrom(b, side, r, c)) {
            res.push({ fr: r, fc: c, tr: nr, tc: nc });
          }
        }
      }
    }
    return res;
  }

  function applyMove(b, fr, fc, tr, tc) {
    const captured = b[tr][tc];
    b[tr][tc] = b[fr][fc];
    b[fr][fc] = null;
    return captured;
  }

  // ---------- 走法命名（棋谱） ----------
  const RED_DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const BLACK_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const NAME_BY_TYPE = { k: '帅', a: '仕', e: '相', h: '马', r: '车', c: '炮', p: '兵' };
  const BLACK_NAME = { k: '将', a: '士', e: '象', h: '马', r: '车', c: '炮', p: '卒' };

  // 生成一步棋的标准走法名，如"炮二平五"、"马八进七"
  // 需要在走子前调用（board 还是旧局面，fr/fc 为起点）
  function notateMove(b, fr, fc, tr, tc) {
    const p = b[fr][fc];
    if (!p) return '';
    const isRed = p.side === 'red';
    const digits = isRed ? RED_DIGITS : BLACK_DIGITS;
    const name = (isRed ? NAME_BY_TYPE : BLACK_NAME)[p.type];
    // 起点列号：红方视角从右数（c=8 是一路），黑方视角从左数（c=0 是1路）
    const fileOf = (c) => isRed ? 8 - c : c;

    // 同列是否有另一枚同类型同方棋子（用于"前/后"区分）
    let otherRow = -1;
    for (let r = 0; r < ROWS; r++) {
      if (r === fr) continue;
      const q = b[r][fc];
      if (q && q.type === p.type && q.side === p.side) { otherRow = r; break; }
    }
    const hasTwin = otherRow >= 0;
    // 前后判定：红方视角 r 小者为前，黑方视角 r 大者为前
    const isFront = hasTwin ? (isRed ? fr < otherRow : fr > otherRow) : false;

    let action, target;
    if (p.type === 'h' || p.type === 'e' || p.type === 'a') {
      // 马/相/士：永远用进/退 + 目标列（横向走也称进/退）
      const forward = isRed ? tr < fr : tr > fr;
      action = forward ? '进' : '退';
      target = digits[fileOf(tc)];
    } else if (tc === fc) { // 纵向（车/炮/帅/兵）
      const forward = isRed ? tr < fr : tr > fr;
      const steps = Math.abs(tr - fr);
      action = forward ? '进' : '退';
      target = digits[steps - 1];
    } else { // 横向平移
      action = '平';
      target = digits[fileOf(tc)];
    }

    const prefix = hasTwin ? (isFront ? '前' : '后') : '';
    return prefix + name + digits[fileOf(fc)] + action + target;
  }

  // 局面签名（用于重复局面和棋判定）：序列化所有棋子位置
  function boardSignature(b) {
    const parts = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (p) parts.push(p.side[0] + p.type + r + '-' + c);
      }
    }
    return parts.sort().join('|');
  }

  return {
    ROWS, COLS, PIECE_NAME,
    createBoard, cloneBoard, findKing,
    legalMovesFrom, allLegalMoves, inCheck, applyMove,
    opponent, inside, notateMove, boardSignature,
  };
})();
