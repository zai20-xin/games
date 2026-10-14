'use strict';
/* ============ 亲子象棋 · 主逻辑（渲染 / 动画 / 交互 / 特效） ============ */
/* 依赖全局：Chess / Sound / FX / AI / Levels / Features / UI */

(function () {
  const boardEl = document.getElementById('board');
  const piecesLayer = document.getElementById('pieces-layer');
  const promoLayer = document.getElementById('promo-layer');
  const fxCanvas = document.getElementById('fx-canvas');
  const boardWrap = document.getElementById('board-wrap');
  const turnDot = document.getElementById('turn-dot');
  const turnText = document.getElementById('turn-text');
  const turnCheck = document.getElementById('turn-check');
  const btnFlip = document.getElementById('btn-flip');
  const btnHint = document.getElementById('btn-hint');
  const btnUndo = document.getElementById('btn-undo');
  const btnNew = document.getElementById('btn-new');
  const btnAutoflip = document.getElementById('btn-autoflip');
  const btnSound = document.getElementById('btn-sound');
  const btnMl = document.getElementById('btn-ml');
  const btnCloseMl = document.getElementById('btn-close-ml');
  const btnLevel = document.getElementById('btn-level');
  const btnTut = document.getElementById('btn-tut');
  const btnStats = document.getElementById('btn-stats');
  const btnReplay = document.getElementById('btn-replay');
  const movelist = document.getElementById('movelist');
  const mlBody = document.getElementById('ml-body');
  const statRound = document.getElementById('stat-round');
  const statEat = document.getElementById('stat-eat');
  const statMove = document.getElementById('stat-move');
  const overlay = document.getElementById('overlay');
  const overlayEmoji = document.getElementById('overlay-emoji');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-sub');
  const btnRestart = document.getElementById('btn-restart');
  const repCtrl = document.getElementById('repctrl');
  const repPrev = document.getElementById('rep-prev');
  const repPlay = document.getElementById('rep-play');
  const repNext = document.getElementById('rep-next');
  const repSlider = document.getElementById('rep-slider');
  const repLabel = document.getElementById('rep-label');
  const repExitBtn = document.getElementById('rep-exit');

  const PIECE_NAME = { r: '车', h: '马', c: '炮', p: '兵', e: '象', a: '士', k: '将' };

  let board, turn, history = [];
  let selected = null, legalCache = [];
  let posMap = {};        // 'r-c' -> { el, r, c, piece }
  let flipped = false, autoFlip = false, gameOver = false, hintOn = false;
  let cellW = 0, cellH = 0, moveSeq = 0;
  let moveRecord = [];    // { side, not, captured }
  let sigCount = {};      // 局面签名计数（重复局面和棋）
  let noCapPly = 0;       // 连续无吃子步数（限着和棋）
  let aiTimer = null;     // AI 走子定时器
  let tutTask = null;     // 教学关任务 { type, targets, idx }

  // 复盘状态
  let rep = { active: false, moves: [], record: [], idx: 0, timer: null, finalMoves: [], finalRecord: [] };

  // ---------- 对局存档（刷新/关闭后恢复） ----------
  const SAVE_KEY = 'xiangqi:save';
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
  function saveState() {
    try {
      if (gameOver || rep.active || Features.isLevel() || Features.isTutorial()) return;
      if (!history.length) { clearSave(); return; }
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
        mode: Features.mode,
        aiLevel: Features.aiLevel,
        flipped, autoFlip,
        history, record: moveRecord,
      }));
    } catch (e) {}
  }
  function restoreState() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
    if (!data || data.v !== 1 || !Array.isArray(data.history) || !data.history.length) return false;
    board = Chess.createBoard();
    for (const mv of data.history) {
      const p = board[mv.fr] && board[mv.fr][mv.fc];
      if (!p) return false; // 走法无法回放，视为脏数据
      Chess.applyMove(board, mv.fr, mv.fc, mv.tr, mv.tc);
    }
    history = data.history;
    moveRecord = Array.isArray(data.record) ? data.record : [];
    Features.setMode(data.mode === 'ai' ? 'ai' : 'pvp', data.aiLevel);
    flipped = !!data.flipped;
    autoFlip = !!data.autoFlip;
    btnAutoflip.classList.toggle('active', autoFlip);
    rebuildCounters();
    renderAll();
    turn = history[history.length - 1].side;
    setTurn(turn);
    updateStats();
    if (Features.isAI() && turn === 'black') scheduleAI();
    return true;
  }

  // ---------- 工具 ----------
  function calcCell() {
    cellW = boardEl.clientWidth / Chess.COLS;
    cellH = boardEl.clientHeight / Chess.ROWS;
    boardEl.style.setProperty('--cell', cellW + 'px');
    boardEl.style.setProperty('--piece-size', (cellW * 0.92) + 'px');
    FX.resize();
  }

  function px(r, c) { return { x: c * cellW + cellW / 2, y: r * cellH + cellH / 2 }; }

  function positionPiece(el, r, c) {
    const rot = flipped ? 180 : 0;
    el.style.transform = 'translate(' + (c * cellW + cellW / 2) + 'px,' + (r * cellH + cellH / 2) + 'px) rotate(' + rot + 'deg)';
  }

  function boardFromPieces(pieces) {
    const b = Array.from({ length: Chess.ROWS }, () => Array(Chess.COLS).fill(null));
    for (const [s, t, r, c] of pieces) b[r][c] = { side: s, type: t };
    return b;
  }

  // ---------- 渲染（增量 diff：复用 DOM，避免全量重建） ----------
  function renderAll() {
    const keys = new Set();
    for (let r = 0; r < Chess.ROWS; r++) {
      for (let c = 0; c < Chess.COLS; c++) {
        const p = board[r][c];
        if (!p) continue;
        const k = r + '-' + c;
        keys.add(k);
        const info = posMap[k];
        if (info) {
          if (info.piece !== p) {
            info.el.textContent = Chess.PIECE_NAME[p.side][p.type];
            info.el.className = 'piece ' + p.side;
            info.piece = p;
          }
          if (info.r !== r || info.c !== c) { info.r = r; info.c = c; positionPiece(info.el, r, c); }
        } else {
          const el = document.createElement('div');
          el.className = 'piece ' + p.side;
          el.textContent = Chess.PIECE_NAME[p.side][p.type];
          el.style.transition = 'none';
          piecesLayer.appendChild(el);
          posMap[k] = { el, r, c, piece: p };
          positionPiece(el, r, c);
          requestAnimationFrame(() => { el.style.transition = ''; });
        }
      }
    }
    for (const k in posMap) {
      if (!keys.has(k)) { posMap[k].el.remove(); delete posMap[k]; }
    }
    // 清理 piecesLayer 中已不在 posMap 的残留 DOM（被吃 / 被悔棋撤掉的棋子），避免视觉重叠与点击错位
    const alive = new Set();
    for (const k in posMap) alive.add(posMap[k].el);
    for (const child of [...piecesLayer.children]) {
      if (!alive.has(child)) child.remove();
    }
    updateBoardStatus();
  }

  function updateBoardStatus() {
    for (const k in posMap) posMap[k].el.classList.remove('in-check');
    turnCheck.classList.add('hidden');
    if (!gameOver && Chess.inCheck(board, turn)) {
      const k = Chess.findKing(board, turn);
      if (k && posMap[k.r + '-' + k.c]) posMap[k.r + '-' + k.c].el.classList.add('in-check');
      turnCheck.classList.remove('hidden');
    }
  }

  // ---------- 回合 / 翻转 ----------
  function setTurn(t) {
    turn = t;
    turnDot.className = 'turn-dot ' + t;
    turnText.textContent = t === 'red' ? '红方走子' : '黑方走子';
    if (autoFlip) setFlip(t === 'black');
    updateBoardStatus();
  }

  function setFlip(v) {
    flipped = !!v;
    for (const k in posMap) {
      const info = posMap[k];
      if (info.el.style.transition !== 'none') info.el.style.transition = 'transform .35s';
      positionPiece(info.el, info.r, info.c);
    }
    Sound.flip();
  }

  // ---------- 统计栏 / 棋谱 ----------
  function updateStats() {
    const ply = moveRecord.length;
    const round = Math.floor(ply / 2) + 1;
    statRound.textContent = '第 ' + round + ' 回合';
    let redEat = 0, blackEat = 0;
    for (const m of moveRecord) {
      if (!m.captured) continue;
      if (m.side === 'red') redEat++;
      else blackEat++;
    }
    statEat.textContent = '🔴红吃 ' + redEat + ' · ⚫黑吃 ' + blackEat;
    const last = moveRecord[ply - 1];
    if (!Features.isLevel() && !Features.isTutorial()) {
      statMove.textContent = last ? (last.side === 'red' ? '🔴' : '⚫') + ' ' + last.not : '—';
    } else if (!last && Features.isLevel()) {
      statMove.textContent = '🎯 ' + Features.LEVELS[Features.levelIdx].name + '：' + Features.LEVELS[Features.levelIdx].desc;
    } else if (!last && Features.isTutorial()) {
      statMove.textContent = '🎓 ' + Features.TUTORIAL[Features.tutIdx].name + '：' + Features.TUTORIAL[Features.tutIdx].desc;
    } else {
      statMove.textContent = last ? (last.side === 'red' ? '🔴' : '⚫') + ' ' + last.not : '—';
    }
    renderMovelist();
  }

  function renderMovelist() {
    mlBody.innerHTML = '';
    const frag = document.createDocumentFragment();
    const curRow = rep.active ? Math.floor((rep.idx - 1) / 2) : -1;
    for (let i = 0; i < moveRecord.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'ml-row' + (i / 2 === curRow ? ' cur' : '');
      row.innerHTML =
        '<span class="ml-no">' + (i / 2 + 1) + '</span>' +
        '<span class="ml-red" data-i="' + i + '">' + (moveRecord[i] ? moveRecord[i].not : '') + '</span>' +
        '<span class="ml-black" data-i="' + (i + 1) + '">' + (moveRecord[i + 1] ? moveRecord[i + 1].not : '') + '</span>';
      frag.appendChild(row);
    }
    mlBody.appendChild(frag);
  }

  // ---------- 终局处理（胜利 / 认输 / 和棋） ----------
  function showEnd(result, title, sub, emoji) {
    gameOver = true;
    stopRepTimer();
    clearSave();
    // 记录战绩与成就
    let achievements = [];
    let stars = 0;
    if (Features.isLevel()) {
      // 残局：仅红方（挑战方）取胜算通关
      if (result === 'win' && title.indexOf('红方') === 0) {
        const r = Features.recordLevelClear(Features.levelIdx, moveRecord.length);
        stars = r.stars;
        achievements = r.achievements;
      }
    } else {
      const winner = result === 'win' ? (title.indexOf('红方') === 0 ? 'red' : 'black') : 'draw';
      const eatTotal = moveRecord.filter(m => m.captured).length;
      achievements = Features.isAI() ? Features.recordAI(winner, eatTotal) : Features.recordGame(winner, eatTotal);
    }
    setTimeout(() => {
      if (result === 'win') Sound.win();
      else if (result === 'draw') Sound.flip();
      FX.confetti();
      const c = px(4.5, 5);
      FX.burst(c.x, c.y, { count: 60, colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ffffff'], speed: 9, size: 7 });
      FX.ring(c.x, c.y, '#ffd93d', 120, 6, 3);
      FX.flashCanvas(0.5);
      overlayEmoji.textContent = emoji;
      overlayTitle.textContent = title;
      let subText = sub;
      if (stars) subText += ' · ⭐'.repeat(stars) + ' (' + stars + ' 星)';
      if (achievements.length) {
        subText += ' · 解锁成就 ' + achievements.map(a => a.icon + ' ' + a.name).join('、');
      }
      overlaySub.textContent = subText;
      // 复盘按钮：残局 / 教学不提供
      btnReplay.classList.toggle('hidden', Features.isLevel() || Features.isTutorial());
      btnRestart.textContent = Features.isLevel() ? '继续挑战' : '再来一局';
      overlay.classList.remove('hidden');
    }, 700);
  }

  // ---------- 复盘（可控：进度条 / 上一步 / 下一步 / 播放） ----------
  function resetToInitial() {
    board = Chess.createBoard();
    history = [];
    moveRecord = [];
    sigCount = {};
    noCapPly = 0;
    selected = null; legalCache = [];
    clearDots();
  }

  function startReplay() {
    if (history.length === 0) return;
    if (Features.isLevel() || Features.isTutorial()) { UI.toast('残局和教学暂不支持复盘'); return; }
    if (rep.active) return;
    UI.close();
    overlay.classList.add('hidden');
    rep.active = true;
    rep.finalMoves = history.slice();
    rep.finalRecord = moveRecord.slice();
    rep.moves = history.slice();
    rep.record = moveRecord.slice();
    rep.idx = 0;
    resetToInitial();
    renderAll();
    setTurn('red');
    updateStats();
    showRepCtrl(true);
    repUpdateSlider();
  }

  function repGoto(i) {
    if (!rep.active) return;
    stopRepTimer();
    repPlay.textContent = '▶';
    if (i < 0) i = 0;
    if (i > rep.moves.length) i = rep.moves.length;
    resetToInitial();
    for (let j = 0; j < i; j++) {
      const mv = rep.moves[j];
      Chess.applyMove(board, mv.fr, mv.fc, mv.tr, mv.tc);
      history.push(mv);
      moveRecord.push(rep.record[j]);
    }
    rep.idx = i;
    renderAll();
    setTurn(i > 0 ? Chess.opponent(rep.moves[i - 1].side) : 'red');
    updateStats();
    repUpdateSlider();
  }

  function repStep(d) {
    const next = rep.idx + d;
    if (next < 0 || next > rep.moves.length) { Sound.invalid(); return; }
    if (d > 0 && next > 0) {
      const mv = rep.moves[next - 1];
      const p = board[mv.tr][mv.tc] || null;
      if (p) Sound.move(p.type);
    }
    repGoto(next);
  }

  function repToggle() {
    if (rep.timer) { stopRepTimer(); return; }
    if (rep.idx >= rep.moves.length) repGoto(0);
    repPlay.textContent = '⏸';
    rep.timer = setInterval(() => {
      if (!rep.active) { stopRepTimer(); return; }
      if (rep.idx >= rep.moves.length) { stopRepTimer(); return; }
      repStep(1);
    }, 800);
  }

  function stopRepTimer() {
    if (rep.timer) { clearInterval(rep.timer); rep.timer = null; repPlay.textContent = '▶'; }
  }

  function repExit() {
    if (!rep.active) return;
    stopRepTimer();
    rep.active = false;
    showRepCtrl(false);
    // 恢复终局局面与记录
    resetToInitial();
    for (let j = 0; j < rep.finalMoves.length; j++) {
      const mv = rep.finalMoves[j];
      Chess.applyMove(board, mv.fr, mv.fc, mv.tr, mv.tc);
      history.push(mv);
      moveRecord.push(rep.finalRecord[j]);
    }
    rep.idx = rep.moves.length;
    renderAll();
    setTurn(rep.finalMoves.length ? Chess.opponent(rep.finalMoves[rep.finalMoves.length - 1].side) : 'red');
    updateStats();
  }

  function showRepCtrl(show) {
    repCtrl.classList.toggle('hidden', !show);
  }
  function repUpdateSlider() {
    repSlider.max = rep.moves.length;
    repSlider.value = rep.idx;
    repLabel.textContent = rep.idx + ' / ' + rep.moves.length;
  }

  // ---------- 残局 / 教学加载 ----------
  function startLevel(i) {
    if (rep.active) repExit();
    Features.setMode('level', 0);
    Features.levelIdx = i;
    clearSave();
    const lv = Features.LEVELS[i];
    if (!lv) return;
    moveSeq++;
    board = boardFromPieces(lv.pieces);
    history = [];
    moveRecord = [];
    sigCount = {};
    noCapPly = 0;
    gameOver = false;
    selected = null; legalCache = [];
    hintOn = false;
    btnHint.classList.remove('active');
    overlay.classList.add('hidden');
    UI.close();
    movelist.classList.add('hidden');
    renderAll();
    setTurn(lv.side);
    updateStats();
    statMove.textContent = '🎯 ' + lv.name + '：' + lv.desc;
    Sound.tap();
  }

  function startTutorial(i) {
    if (rep.active) repExit();
    Features.setMode('tutorial', 0);
    Features.tutIdx = i;
    clearSave();
    const t = Features.TUTORIAL[i];
    if (!t) return;
    moveSeq++;
    board = boardFromPieces(t.pieces);
    history = [];
    moveRecord = [];
    sigCount = {};
    noCapPly = 0;
    gameOver = false;
    selected = null; legalCache = [];
    hintOn = false;
    btnHint.classList.remove('active');
    overlay.classList.add('hidden');
    UI.close();
    movelist.classList.add('hidden');
    tutTask = { type: t.type, targets: t.targets, idx: 0 };
    renderAll();
    renderTargets();
    setTurn('red');
    updateStats();
    statMove.textContent = '🎓 ' + t.name + '：' + t.desc;
    UI.toast('把「' + PIECE_NAME[t.type] + '」走到星星上吧！');
    Sound.tap();
  }

  // 教学目标星星
  function renderTargets() {
    promoLayer.querySelectorAll('.target-star').forEach(el => el.remove());
    if (!Features.isTutorial() || !tutTask) return;
    const t = Features.TUTORIAL[Features.tutIdx];
    t.targets.forEach(([tr, tc], idx) => {
      const star = document.createElement('div');
      star.className = 'target-star' + (idx < tutTask.idx ? ' got' : (idx === tutTask.idx ? ' cur' : ''));
      star.textContent = idx < tutTask.idx ? '✓' : '★';
      const p = px(tr, tc);
      star.style.left = p.x + 'px';
      star.style.top = p.y + 'px';
      promoLayer.appendChild(star);
    });
  }

  function checkTutGoal() {
    if (!Features.isTutorial() || !tutTask || gameOver) return;
    const t = Features.TUTORIAL[Features.tutIdx];
    let pos = null;
    for (let r = 0; r < Chess.ROWS; r++) for (let c = 0; c < Chess.COLS; c++) {
      const p = board[r][c];
      if (p && p.side === 'red' && p.type === t.type) pos = [r, c];
    }
    if (!pos) return;
    const [tr, tc] = t.targets[tutTask.idx];
    if (pos[0] === tr && pos[1] === tc) {
      tutTask.idx++;
      renderTargets();
      Sound.select();
      if (tutTask.idx >= t.targets.length) {
        tutWin();
      } else {
        UI.toast('太棒了！还剩 ' + (t.targets.length - tutTask.idx) + ' 个目标');
      }
    }
  }

  function tutWin() {
    gameOver = true;
    const i = Features.tutIdx;
    const t = Features.TUTORIAL[i];
    const ach = Features.recordTutorialClear(i);
    setTimeout(() => {
      Sound.win();
      FX.confetti();
      const c = px(4.5, 5);
      FX.burst(c.x, c.y, { count: 50, colors: ['#ffd93d', '#6bcb77', '#4d96ff', '#ffffff'], speed: 8, size: 6 });
      FX.ring(c.x, c.y, '#6bcb77', 110, 5, 3);
      FX.flashCanvas(0.4);
      overlayEmoji.textContent = '🎓';
      overlayTitle.textContent = '学会啦！';
      let subText = '「' + t.name + '」的走法，你掌握了吗？';
      if (ach.length) subText += ' · 解锁成就 ' + ach.map(a => a.icon + ' ' + a.name).join('、');
      overlaySub.textContent = subText;
      btnReplay.classList.add('hidden');
      btnRestart.textContent = (i < Features.TUTORIAL.length - 1) ? '下一课 →' : '完成 🎉';
      overlay.classList.remove('hidden');
    }, 500);
  }

  // ---------- 走子点提示 ----------
  function clearDots() {
    promoLayer.querySelectorAll('.dot').forEach(d => d.remove());
  }
  function renderDots() {
    clearDots();
    for (const [r, c] of legalCache) {
      const dot = document.createElement('div');
      const isCap = !!board[r][c];
      dot.className = 'dot' + (isCap ? ' dot-capture' : '');
      const p = px(r, c);
      dot.style.left = p.x + 'px';
      dot.style.top = p.y + 'px';
      promoLayer.appendChild(dot);
    }
  }

  function clearHintDots() {
    promoLayer.querySelectorAll('.dot.hint-dot').forEach(d => d.remove());
  }
  function renderHint() {
    clearHintDots();
    const seen = {};
    for (const m of Chess.allLegalMoves(board, turn)) {
      const key = m.tr + '-' + m.tc;
      if (seen[key]) continue;
      seen[key] = true;
      const dot = document.createElement('div');
      dot.className = 'dot hint-dot';
      const p = px(m.tr, m.tc);
      dot.style.left = p.x + 'px';
      dot.style.top = p.y + 'px';
      promoLayer.appendChild(dot);
    }
  }

  function deselect() {
    if (selected && posMap[selected.r + '-' + selected.c]) {
      posMap[selected.r + '-' + selected.c].el.classList.remove('selected');
    }
    selected = null;
    legalCache = [];
    clearDots();
  }

  function select(r, c) {
    deselect();
    selected = { r, c };
    legalCache = Chess.legalMovesFrom(board, turn, r, c);
    posMap[r + '-' + c].el.classList.add('selected');
    renderDots();
    Sound.select();
  }

  // ---------- 动画 ----------
  function withTimeout(p, ms) {
    return Promise.race([
      Promise.resolve(p).catch(() => {}),
      new Promise(res => setTimeout(res, ms)),
    ]);
  }

  function animatePiece(el, fr, fc, tr, tc, type, seq) {
    const rot = flipped ? 180 : 0;
    const rotDeg = 'rotate(' + rot + 'deg)';
    const startAbs = 'translate(' + (fc + 0.5) * cellW + 'px,' + (fr + 0.5) * cellH + 'px) ' + rotDeg;
    const absFinal = 'translate(' + (tc + 0.5) * cellW + 'px,' + (tr + 0.5) * cellH + 'px) ' + rotDeg;
    const dx = (tc - fc) * cellW, dy = (tr - fr) * cellH;
    // 动画可能被悔棋/新局/复盘打断：只有序号仍一致才收尾，避免旧动画覆盖棋子位置
    const settle = () => { if (el.__seq === seq) el.style.transform = absFinal; };

    if (type === 'h' || type === 'e') { // 马/象：抛物线跳跃
      const peak = type === 'h' ? -cellH * 0.85 : -cellH * 0.55;
      const mid = 'translate(' + ((fc + 0.5) * cellW + dx * 0.5) + 'px,' + ((fr + 0.5) * cellH + dy * 0.5) + 'px) translate(0,' + peak + 'px) ' + rotDeg;
      const dur = type === 'h' ? 480 : 540;
      const anim = el.animate([
        { transform: startAbs },
        { transform: mid, offset: 0.5 },
        { transform: absFinal },
      ], { duration: dur, easing: 'cubic-bezier(.2,.75,.35,1)' });
      return withTimeout(anim.finished, dur + 120).then(settle);
    }

    if (type === 'p') { // 兵：小碎步跳
      const mid = 'translate(' + ((fc + 0.5) * cellW + dx * 0.5) + 'px,' + ((fr + 0.5) * cellH + dy * 0.5) + 'px) translate(0,-7px) ' + rotDeg;
      const anim = el.animate([
        { transform: startAbs },
        { transform: mid, offset: 0.4 },
        { transform: absFinal },
      ], { duration: 280, easing: 'ease-out' });
      return withTimeout(anim.finished, 420).then(settle);
    }

    // 车/炮/士/将：直线滑行
    el.style.transform = absFinal;
    return new Promise(res => setTimeout(res, 300));
  }

  function popText(type) {
    const map = {
      h: ['嗒嗒！', '嘶——！'],
      e: ['呼——！'],
      c: ['轰！', '砰！'],
      r: ['轰隆！', '冲！'],
      p: ['嘿！', '冲鸭！'],
      a: ['嗒！'],
      k: ['将军！'],
    };
    const arr = map[type] || ['啪！'];
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function typeColors(type) {
    switch (type) {
      case 'c': return ['#ffd23f', '#ff7847', '#ffffff'];
      case 'r': return ['#ff5e5e', '#ffb347', '#ffffff'];
      case 'h': return ['#c77dff', '#ffd23f', '#ffffff'];
      case 'e': return ['#4d96ff', '#8ef6ff', '#ffffff'];
      case 'p': return ['#6bcb77', '#b8ffcf', '#ffffff'];
      default: return ['#ffd23f', '#ffb347', '#ffffff'];
    }
  }
  function shakeBoard(strong = false) {
    boardWrap.classList.remove('shake', 'shake-strong');
    void boardWrap.offsetWidth;
    boardWrap.classList.add(strong ? 'shake-strong' : 'shake');
  }

  function hitFX(fr, fc, tr, tc, type, capturedEl) {
    return new Promise(res => {
      const p0 = px(fr, fc);
      const p = px(tr, tc);
      Sound.capture(type);
      const colors = typeColors(type);

      if (type === 'h') {
        FX.ghostRun(p0.x, p0.y, p.x, p.y, '马', 'rgba(255,160,90,0.85)', 7);
        FX.dust(p0.x, p0.y, { count: 22, speed: 3.2 });
        FX.dust(p.x, p.y, { count: 26, speed: 3.6 });
      }
      if (type === 'r') {
        FX.dust(p.x, p.y, { count: 28, speed: 3.8 });
        FX.spark(p.x, p.y, { count: 22, speed: 8 });
      }
      if (capturedEl) {
        capturedEl.classList.add('hit');
        const isRed = capturedEl.classList.contains('red');
        FX.shards(p.x, p.y, isRed ? '#ff7847' : '#6a7ad9', 12);
      }
      FX.burst(p.x, p.y, { count: 34, colors, speed: 8, size: 7 });
      FX.burst(p.x, p.y, { count: 14, colors: ['#ffffff', '#ffd23f'], speed: 5, size: 4 });
      FX.ring(p.x, p.y, '#ffffff', 60, 4, 2);
      FX.ring(p.x, p.y, colors[0], 40, 3);
      FX.pop(p.x, p.y - 20, popText(type), 'pop-hit');
      FX.flashCanvas(0.35);
      shakeBoard();
      setTimeout(res, 380);
    });
  }

  function cannonFX(fr, fc, tr, tc, capturedEl) {
    return new Promise(res => {
      const p0 = px(fr, fc), p1 = px(tr, tc);
      const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);

      const aim = document.createElement('div');
      aim.className = 'aim-line';
      aim.style.width = len + 'px';
      aim.style.left = p0.x + 'px';
      aim.style.top = p0.y + 'px';
      aim.style.transform = 'rotate(' + ang + 'rad)';
      promoLayer.appendChild(aim);
      setTimeout(() => aim.remove(), 210);

      const b = document.createElement('div');
      b.className = 'bullet';
      b.style.left = p0.x + 'px';
      b.style.top = p0.y + 'px';
      promoLayer.appendChild(b);
      b.animate([
        { transform: 'translate(-50%,-50%) scale(.5)' },
        { transform: 'translate(' + (p1.x - p0.x) + 'px,' + (p1.y - p0.y) + 'px) translate(-50%,-50%) scale(1.5)', offset: 0.92 },
        { transform: 'translate(' + (p1.x - p0.x) + 'px,' + (p1.y - p0.y) + 'px) translate(-50%,-50%) scale(0)', offset: 1 },
      ], { duration: 250, easing: 'cubic-bezier(.1,.9,.3,1)' }).finished.then(() => b.remove());

      setTimeout(() => {
        Sound.capture('c');
        FX.fireball(p1.x, p1.y, cellW * 0.5);
        FX.burst(p1.x, p1.y, { count: 60, colors: ['#ffd23f', '#ff7847', '#ff5e5e', '#ffffff'], speed: 11, size: 8 });
        FX.burst(p1.x, p1.y, { count: 18, colors: ['#ffffff'], speed: 6, size: 5 });
        FX.smoke(p1.x, p1.y, { count: 16, speed: 3.4 });
        FX.dust(p1.x, p1.y, { count: 22, speed: 3.5 });
        FX.spark(p1.x, p1.y, { count: 30, speed: 9 });
        if (capturedEl) {
          capturedEl.classList.add('hit');
          FX.shards(p1.x, p1.y, capturedEl.classList.contains('red') ? '#ff7847' : '#6a7ad9', 16);
        }
        FX.ring(p1.x, p1.y, '#ffd23f', 110, 6, 3);
        FX.ring(p1.x, p1.y, '#ff5e5e', 70, 5, 2);
        FX.pop(p1.x, p1.y - 28, '轰！！', 'pop-hit');
        FX.flashCanvas(0.65);
        shakeBoard(true);
        setTimeout(res, 420);
      }, 300);
    });
  }

  function playMoveAnimation(el, fr, fc, tr, tc, type, captured, capturedEl, seq) {
    return animatePiece(el, fr, fc, tr, tc, type, seq).then(() => {
      if (el.__seq !== seq) return;
      if (type === 'c' && captured) return cannonFX(fr, fc, tr, tc, capturedEl);
      if (captured) return hitFX(fr, fc, tr, tc, type, capturedEl);
      return Promise.resolve();
    });
  }

  // ---------- AI 走子 ----------
  function scheduleAI() {
    if (aiTimer) return;
    if (gameOver) return;
    aiTimer = setTimeout(aiTurn, 700);
  }
  function aiTurn() {
    aiTimer = null;
    if (gameOver) return;
    if (!(Features.isAI() || Features.isLevel())) return;
    if (turn !== 'black') return;
    const mv = AI.chooseMove(board, 'black', Features.isLevel() ? 1 : Features.aiLevel);
    if (mv) doMove(mv.fr, mv.fc, mv.tr, mv.tc);
  }

  // ---------- 走子 ----------
  function doMove(fr, fc, tr, tc) {
    const moving = board[fr][fc];
    const captured = board[tr][tc];
    deselect();

    const not = Chess.notateMove(board, fr, fc, tr, tc);
    history.push({ fr, fc, tr, tc, captured, side: turn });
    moveRecord.push({ side: turn, not, captured });

    const movingInfo = posMap[fr + '-' + fc];
    const movingEl = movingInfo.el;
    let capturedEl = null;
    if (captured) {
      capturedEl = posMap[tr + '-' + tc].el;
      delete posMap[tr + '-' + tc];
    }
    Chess.applyMove(board, fr, fc, tr, tc);
    delete posMap[fr + '-' + fc];
    movingInfo.r = tr; movingInfo.c = tc;
    posMap[tr + '-' + tc] = movingInfo;

    noCapPly = captured ? 0 : noCapPly + 1;
    const sig = Chess.boardSignature(board);
    sigCount[sig] = (sigCount[sig] || 0) + 1;

    const seq = ++moveSeq;
    movingEl.__seq = seq;
    hintOn = false;
    btnHint.classList.remove('active');
    clearHintDots();
    Sound.move(moving.type);
    Sound.speak(not);

    playMoveAnimation(movingEl, fr, fc, tr, tc, moving.type, captured, capturedEl, seq).then(() => {
      if (seq !== moveSeq) return;
      if (capturedEl && capturedEl.parentNode) capturedEl.parentNode.removeChild(capturedEl);
      afterMove();
    });
  }

  function afterMove() {
    if (Features.isTutorial()) {
      // 教学关：始终红方走子，黑方不应手
      checkTutGoal();
      if (!gameOver) {
        const noMove = Chess.allLegalMoves(board, 'black').length === 0;
        const inCheck = Chess.inCheck(board, 'black');
        if (noMove && inCheck) {
          // 别把黑将将死，回退一步重新走
          UI.toast('别把黑将将死啦，换一步试试');
          popMove();
          renderAll();
          renderTargets();
        }
        setTurn('red');
        updateStats();
      }
      return;
    }

    const next = Chess.opponent(turn);
    const winner = turn;
    const noMove = Chess.allLegalMoves(board, next).length === 0;
    const inCheck = Chess.inCheck(board, next);
    setTurn(next);
    updateStats();

    if (noMove) {
      const sub = inCheck ? '将军！绝杀！' : '对方无棋可走～';
      showEnd('win', (winner === 'red' ? '红方' : '黑方') + '获胜！', sub, '🎉');
    } else {
      const sigNow = Chess.boardSignature(board);
      if (sigCount[sigNow] >= 3 || noCapPly >= 120) {
        showEnd('draw', '和棋', sigCount[sigNow] >= 3 ? '局面重复三次' : '60 回合未吃子', '🤝');
        return;
      }
      if (inCheck) Sound.check();
      // AI / 残局：黑方由 AI 应手
      if ((Features.isAI() || Features.isLevel()) && turn === 'black') scheduleAI();
    }
    saveState();
  }

  // ---------- 悔棋（AI 模式回退两步） ----------
  function popMove() {
    const mv = history.pop();
    if (!mv) return null;
    moveRecord.pop();
    board[mv.fr][mv.fc] = board[mv.tr][mv.tc];
    board[mv.tr][mv.tc] = mv.captured;
    return mv;
  }

  function undo() {
    if (rep.active) { repExit(); return; }
    if (history.length === 0) { Sound.invalid(); return; }
    moveSeq++;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    // 记录被撤回各步的行棋方：轮到「最早被撤回那步」的一方重走
    const popped = [];
    if (Features.isAI() || Features.isLevel()) {
      const count = history[history.length - 1].side === 'black' ? Math.min(2, history.length) : 1;
      for (let i = 0; i < count; i++) {
        const mv = popMove();
        if (!mv) break;
        popped.push(mv.side);
      }
    } else {
      const mv = popMove();
      if (mv) popped.push(mv.side);
    }
    rebuildCounters();
    gameOver = false;
    overlay.classList.add('hidden');
    deselect();
    hintOn = false;
    btnHint.classList.remove('active');
    clearHintDots();
    turn = popped.length ? popped[popped.length - 1] : 'red';
    renderAll();
    renderTargets();
    setTurn(turn);
    updateStats();
    Sound.undo();
    saveState();
  }

  function rebuildCounters() {
    sigCount = {};
    noCapPly = 0;
    const b = Chess.createBoard();
    for (const m of history) {
      Chess.applyMove(b, m.fr, m.fc, m.tr, m.tc);
      noCapPly = m.captured ? 0 : noCapPly + 1;
      const sig = Chess.boardSignature(b);
      sigCount[sig] = (sigCount[sig] || 0) + 1;
    }
  }

  // ---------- 新对局 ----------
  function newGame() {
    if (rep.active) repExit();
    moveSeq++;
    clearSave();
    board = Chess.createBoard();
    history = [];
    moveRecord = [];
    sigCount = {};
    noCapPly = 0;
    gameOver = false;
    selected = null; legalCache = [];
    tutTask = null;
    hintOn = false;
    btnHint.classList.remove('active');
    overlay.classList.add('hidden');
    UI.close();
    movelist.classList.add('hidden');
    clearDots();
    if (flipped) setFlip(false); // 新局回到默认视角
    renderAll();
    renderTargets();
    setTurn('red');
    updateStats();
    btnRestart.textContent = '再来一局';
    btnReplay.classList.remove('hidden');
    Sound.tap();
  }

  // ---------- 点击 ----------
  function handleTap(r, c) {
    if (gameOver || rep.active) return;
    Sound.init();
    // AI / 残局：黑方回合由电脑应手，点击时给出提示而非"无反应"
    if ((Features.isAI() || Features.isLevel()) && turn === 'black') {
      UI.toast('🤖 AI 思考中，请稍候…');
      return;
    }
    const p = board[r][c];
    if (selected) {
      if (r === selected.r && c === selected.c) { deselect(); return; }
      const ok = legalCache.some(([lr, lc]) => lr === r && lc === c);
      if (ok) { doMove(selected.r, selected.c, r, c); return; }
      if (Features.isTutorial()) {
        UI.toast('「' + PIECE_NAME[tutTask.type] + '」要走这里吗？再看看');
        return;
      }
    }
    if (p && p.side === turn) {
      if (Features.isTutorial() && p.type !== tutTask.type) {
        UI.toast('这一课只学「' + PIECE_NAME[tutTask.type] + '」的走法哦');
        return;
      }
      select(r, c);
    }
    else if (p) Sound.invalid();
    else if (selected) deselect();
  }

  function onBoardTap(e) {
    const rect = boardEl.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (flipped) { x = rect.width - x; y = rect.height - y; }
    const c = Math.round(x / cellW - 0.5);
    const r = Math.round(y / cellH - 0.5);
    if (r < 0 || r >= Chess.ROWS || c < 0 || c >= Chess.COLS) return;
    handleTap(r, c);
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    boardEl.addEventListener('pointerdown', onBoardTap);
    btnFlip.addEventListener('click', () => setFlip(!flipped));
    btnHint.addEventListener('click', () => {
      Sound.tap();
      hintOn = !hintOn;
      btnHint.classList.toggle('active', hintOn);
      clearHintDots();
      if (hintOn) renderHint();
    });
    btnUndo.addEventListener('click', undo);
    btnNew.addEventListener('click', () => {
      Sound.tap();
      if (rep.active) repExit();
      UI.modeSelect((m, lv) => {
        Features.setMode(m, lv);
        newGame();
      });
    });
    btnAutoflip.addEventListener('click', () => {
      autoFlip = !autoFlip;
      btnAutoflip.classList.toggle('active', autoFlip);
      Sound.tap();
    });
    btnSound.addEventListener('click', () => {
      const m = Sound.toggleMuted();
      btnSound.textContent = m ? '🔇' : '🔊';
      Sound.tap();
    });
    btnMl.addEventListener('click', () => {
      Sound.tap();
      const show = movelist.classList.toggle('hidden');
      if (!show) renderMovelist();
    });
    btnCloseMl.addEventListener('click', () => movelist.classList.add('hidden'));
    btnLevel.addEventListener('click', () => {
      Sound.tap();
      UI.levelSelect(i => startLevel(i));
    });
    btnTut.addEventListener('click', () => {
      Sound.tap();
      UI.tutorialSelect(i => startTutorial(i));
    });
    btnStats.addEventListener('click', () => {
      Sound.tap();
      UI.statsPanel();
    });
    btnRestart.addEventListener('click', () => {
      Sound.tap();
      if (Features.isTutorial()) {
        const next = Features.tutIdx + 1;
        if (next < Features.TUTORIAL.length) startTutorial(next);
        else { Features.setMode('pvp', 0); newGame(); }
        return;
      }
      if (Features.isLevel()) { UI.levelSelect(i => startLevel(i)); return; }
      newGame();
    });
    btnReplay.addEventListener('click', startReplay);

    // 复盘控制条
    repPrev.addEventListener('click', () => repStep(-1));
    repNext.addEventListener('click', () => repStep(1));
    repPlay.addEventListener('click', repToggle);
    repExitBtn.addEventListener('click', repExit);
    repSlider.addEventListener('input', () => repGoto(parseInt(repSlider.value, 10)));

    // 棋谱可点：跳转到对应局面（复盘）
    mlBody.addEventListener('click', e => {
      const t = e.target.closest('[data-i]');
      if (!t) return;
      if (Features.isLevel() || Features.isTutorial()) { UI.toast('残局和教学暂不支持复盘'); return; }
      const i = +t.dataset.i;
      if (i < 0 || i >= moveRecord.length) return;
      if (!rep.active) startReplay();
      repGoto(i + 1);
    });

    window.addEventListener('resize', () => { calcCell(); renderAll(); });
  }

  // ---------- PWA Service Worker ----------
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // ---------- 启动 ----------
  function init() {
    registerSW();
    Sound.init();
    btnSound.textContent = Sound.isMuted() ? '🔇' : '🔊';
    FX.init(fxCanvas);
    calcCell();
    if (!restoreState()) {
      board = Chess.createBoard();
      renderAll();
      setTurn('red');
      updateStats();
    }
    bindEvents();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
