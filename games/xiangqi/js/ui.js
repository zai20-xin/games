'use strict';
/* ============ UI：弹层 / 选关 / 战绩 / 轻提示 ============ */
/* 依赖全局：Features（features.js） */

const UI = (function () {
  const root = document.getElementById('modal-root');
  const DIFF_NAME = ['', '入门', '进阶', '高手'];
  const STARS = s => '★'.repeat(Math.min(s, 3)) + '☆'.repeat(Math.max(0, 3 - s));

  function open(html) {
    root.innerHTML = html;
    root.classList.add('open');
    const mask = root.querySelector('.modal-mask');
    const x = root.querySelector('.modal-x');
    const closeFn = () => { root.classList.remove('open'); root.innerHTML = ''; };
    if (mask) mask.addEventListener('click', closeFn);
    if (x) x.addEventListener('click', closeFn);
    root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeFn));
    return closeFn;
  }
  function close() { root.classList.remove('open'); root.innerHTML = ''; }
  function isOpen() { return root.classList.contains('open'); }

  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1700);
  }

  // ---------- 新对局：模式选择 ----------
  function modeSelect(onPick) {
    open(`
      <div class="modal-mask"></div>
      <div class="modal mode-modal">
        <div class="modal-head"><h3>🆕 新对局</h3><button class="modal-x">✕</button></div>
        <div class="modal-body">
          <button class="mode-card" data-mode="pvp" data-lv="0">
            <span class="mode-ico">👫</span>
            <span class="mode-name">双人对战</span>
            <span class="mode-sub">红黑轮流，同屏对战</span>
          </button>
          <button class="mode-card" data-mode="ai" data-lv="1">
            <span class="mode-ico">🐣</span>
            <span class="mode-name">初级 AI</span>
            <span class="mode-sub">稳健的新手陪练</span>
          </button>
          <button class="mode-card" data-mode="ai" data-lv="2">
            <span class="mode-ico">🦊</span>
            <span class="mode-name">中级 AI</span>
            <span class="mode-sub">更强的电脑对手</span>
          </button>
        </div>
      </div>
    `);
    root.querySelectorAll('.mode-card').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.mode, lv = parseInt(b.dataset.lv, 10);
      close();
      onPick(m, lv);
    }));
  }

  // ---------- 残局选关 ----------
  function levelSelect(onPick) {
    const s = Features.getStats();
    const lvs = Features.LEVELS;
    const card = i => {
      const lv = lvs[i];
      const done = s.levelsCleared.includes(i);
      const stars = s.levelStars[i] || 0;
      return `
      <button class="lv-card ${done ? 'done' : ''}" data-i="${i}">
        <span class="lv-no">${i + 1}</span>
        <span class="lv-name">${lv.name}</span>
        <span class="lv-diff">${DIFF_NAME[lv.diff] || ''}</span>
        <span class="lv-star">${STARS(stars)}</span>
        <span class="lv-ok">${done ? '✓' : ''}</span>
      </button>`;
    };
    const grid = (lo, hi) => lvs.map((_, i) => (i >= lo && i <= hi) ? card(i) : '').join('');
    open(`
      <div class="modal-mask"></div>
      <div class="modal level-modal">
        <div class="modal-head">
          <h3>♟ 残局挑战 <em>${s.levelsCleared.length}/${lvs.length}</em></h3>
          <button class="modal-x">✕</button>
        </div>
        <div class="tabs">
          <button class="tab on" data-lo="0" data-hi="9">入门</button>
          <button class="tab" data-lo="10" data-hi="19">进阶</button>
          <button class="tab" data-lo="20" data-hi="29">高手</button>
        </div>
        <div class="lv-grid" id="lv-grid">${grid(0, 9)}</div>
      </div>
    `);
    root.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      document.getElementById('lv-grid').innerHTML = grid(+t.dataset.lo, +t.dataset.hi);
    }));
    root.querySelectorAll('.lv-card').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      close();
      onPick(i);
    }));
  }

  // ---------- 教学选关 ----------
  function tutorialSelect(onPick) {
    const s = Features.getStats();
    const tuts = Features.TUTORIAL;
    const ICONS = ['🚗', '🐎', '💥', '🪖', '🐘', '🛡️', '👑'];
    open(`
      <div class="modal-mask"></div>
      <div class="modal tut-modal">
        <div class="modal-head">
          <h3>🎓 教学课堂 <em>${s.tutorialCleared.length}/${tuts.length}</em></h3>
          <button class="modal-x">✕</button>
        </div>
        <div class="tut-grid">
          ${tuts.map((t, i) => `
          <button class="tut-card ${s.tutorialCleared.includes(t.id) ? 'done' : ''}" data-i="${i}">
            <span class="tut-ico">${ICONS[i]}</span>
            <span class="tut-name">${t.name} · ${t.desc}</span>
            <span class="tut-go">${s.tutorialCleared.includes(t.id) ? '✓ 已学会' : '去学习 →'}</span>
          </button>`).join('')}
        </div>
      </div>
    `);
    root.querySelectorAll('.tut-card').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      close();
      onPick(i);
    }));
  }

  // ---------- 战绩面板 ----------
  function statsPanel() {
    const s = Features.getStats();
    const got = Object.values(s.achievements).filter(Boolean).length;
    open(`
      <div class="modal-mask"></div>
      <div class="modal stats-modal">
        <div class="modal-head"><h3>📊 我的战绩</h3><button class="modal-x">✕</button></div>
        <div class="modal-body">
          <div class="stat-grid">
            <div class="stat"><b>${s.redWins + s.blackWins + s.draws + s.aiWins + s.aiLosses}</b><span>总场次</span></div>
            <div class="stat red"><b>${s.redWins + s.aiWins}</b><span>我方胜</span></div>
            <div class="stat black"><b>${s.blackWins + s.aiLosses}</b><span>落败</span></div>
            <div class="stat"><b>${s.draws}</b><span>和棋</span></div>
            <div class="stat"><b>${s.totalEat}</b><span>累计吃子</span></div>
            <div class="stat"><b>${s.eatMax}</b><span>单局最多吃</span></div>
          </div>
          <div class="stat-prog">
            <div>♟ 残局 <b>${s.levelsCleared.length}/${Features.LEVELS.length}</b> 关，三星 <b>${Object.values(s.levelStars).filter(v => v >= 3).length}</b> 个</div>
            <div>🎓 教学 <b>${s.tutorialCleared.length}/${Features.TUTORIAL.length}</b> 课</div>
            <div>🤖 人机 <b>${s.aiWins}胜 ${s.aiLosses}负</b></div>
          </div>
          <h4 class="ach-title">🏅 成就 <em>${got}/${Features.ACHS.length}</em></h4>
          <div class="ach-grid">
            ${Features.ACHS.map(a => `
            <div class="ach ${s.achievements[a.id] ? 'got' : 'no'}">
              <span class="ach-ico">${s.achievements[a.id] ? a.icon : '🔒'}</span>
              <span class="ach-name">${a.name}</span>
              <span class="ach-desc">${a.desc}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
    `);
  }

  return { open, close, isOpen, toast, modeSelect, levelSelect, tutorialSelect, statsPanel };
})();
