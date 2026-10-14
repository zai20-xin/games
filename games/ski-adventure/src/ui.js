// ui.js —— 面板（菜单/结算/暂停）+ 商城 + 音乐/模式切换
import * as storage from './storage.js';
import * as skins from './skins.js';
import * as audio from './audio.js';
import { game, startGame, toMenu, togglePause } from './state.js';
import { questSummary } from './quests.js';
import { startSnowFight } from './snowfight.js';
import * as snowfight from './snowfight.js';
import * as achv from './achievements.js';
import * as meta from './meta.js';
import boardMintUrl from './assets/board_mint_3d.png';

const el = (id) => document.getElementById(id);

function refreshCoins() {
  el('menuCoins').textContent = storage.coins;
  el('shopCoins').textContent = storage.coins;
}

export function refreshMenu() {
  refreshCoins();
  el('menuBest').textContent = game.best;
  el('menuBestScore').textContent = game.bestScore;
  // 成瘾：结晶 / 连胜 / 段位 / 宝箱
  el('menuCrystal').textContent = storage.crystal;
  el('menuStreak').textContent = storage.getStreak();
  el('menuBoxes').textContent = storage.boxes;
  const t = meta.tierInfo();
  el('menuTier').textContent = t.name;
  el('menuTierLv').textContent = t.level;
  el('menuTierFill').style.width = Math.round(t.progress * 100) + '%';
  el('menuTierNext').textContent = t.nextReward
    ? ('距「' + t.nextName + '」还差 ' + Math.max(0, t.nextNeed - t.score) + ' 综合分')
    : '已达最高段位！';
  // 皮肤收集进度
  const all = [...skins.SKINS.char, ...skins.SKINS.board];
  const owned = new Set(storage.getOwned().filter(id => all.some(s => s.id === id)));
  el('menuSkins').textContent = owned.size;
  el('menuSkinsTotal').textContent = all.length;
}

export function hideAllPanels() {
  ['menu', 'overlay', 'shop', 'pause', 'achv', 'lootbox', 'daily'].forEach(id => el(id).classList.remove('show'));
}

export function showMenu() {
  hideAllPanels();
  el('overlay').classList.remove('celebrate');
  el('newBest').style.display = 'none';
  el('deathDetail').textContent = '';
  el('deathTip').textContent = '';
  el('menu').classList.add('show');
}

export function showOverlay(reason, stats) {
  el('finalDist').textContent = stats.dist;
  el('finalScore').textContent = stats.score;
  el('finalCoins').textContent = stats.coins;
  el('walletCoins').textContent = storage.coins;
  el('best').textContent = game.best;
  // 单局任务结算
  const qs = typeof questSummary === 'function' ? questSummary() : { quests: [], done: 0, reward: 0 };
  let qh = '<div class="qr-title">单局任务 ' + qs.done + '/3</div>';
  for (const q of qs.quests) {
    qh += '<div class="qr' + (q.done ? ' done' : '') + '"><span>' + q.text +
      '</span><span class="qr-p">' + Math.min(q.progress, q.target) + '/' + q.target + '</span></div>';
  }
  qh += '<div class="qr-reward">任务奖励 +' + qs.reward + ' 金币</div>';
  el('questResult').innerHTML = qh;
  // 成瘾：本局收获（结晶 / 宝箱 / 段位 / 每日）
  const rm = stats.runMeta;
  if (rm) {
    let rh = '<div class="rm-title">本局收获</div>';
    rh += '<div class="rm"><span>💎 结晶</span><span class="rm-v">+' + (rm.crystal || 0) + '</span></div>';
    rh += '<div class="rm"><span>🎁 宝箱</span><span class="rm-v">+' + (rm.boxes || 0) + '</span></div>';
    if (rm.tierGained && rm.tierGained.length) {
      for (const g of rm.tierGained) rh += '<div class="rm tier"><span>🏅 段位</span><span class="rm-v">' + g.text + '</span></div>';
    }
    if (rm.dailyRank) rh += '<div class="rm daily"><span>📅 今日排名</span><span class="rm-v">第 ' + rm.dailyRank + ' 名</span></div>';
    if (rm.daily && rm.daily.done) rh += '<div class="rm daily"><span>📅 每日目标</span><span class="rm-v">+' + rm.daily.reward + ' 结晶</span></div>';
    el('runMeta').innerHTML = rh;
  } else {
    el('runMeta').innerHTML = '';
  }
  el('overTitle').textContent =
    reason === '雪崩' ? '❄️ 被雪崩吞没！' :
    reason === '摔倒' ? '💥 摔倒了！' :
    reason === '炸弹' ? '💣 被炸晕了！' : '😵 游戏结束！';
  // 失败归因：死因 + 改进建议
  el('deathDetail').textContent = stats.detail || '';
  el('deathTip').textContent = game.deathTip || '';
  // 破纪录仪式感：NEW BEST 徽章
  const badge = el('newBest');
  if (stats.newBestDist || stats.newBestScore) {
    badge.style.display = 'block';
    badge.textContent = stats.newBestDist && stats.newBestScore ? '🏆 新纪录！距离 & 得分' :
                        stats.newBestDist ? '🏆 最远距离纪录！' : '🏆 最高得分纪录！';
    el('overlay').classList.add('celebrate');
  } else {
    badge.style.display = 'none';
    el('overlay').classList.remove('celebrate');
  }
  el('overlay').classList.add('show');
  // 元游戏：结算时检测滑雪成就并提示新解锁
  const fresh = achv.checkGame(game);
  if (fresh.length) toastAchv(fresh);
}

export function showPause(show) {
  el('pause').classList.toggle('show', show);
}

export function setPowerBadges(html) {
  el('power').innerHTML = html || '';
}

// ---- 成就面板 ----
let achvToastT = null;
function renderAchv() {
  const list = achv.getList();
  const done = list.filter(a => a.unlocked).length;
  el('achvProgress').textContent = '已解锁 ' + done + ' / ' + list.length;
  const grid = el('achvGrid');
  grid.innerHTML = '';
  for (const a of list) {
    const card = document.createElement('div');
    card.className = 'achv-card' + (a.unlocked ? ' done' : '');
    card.innerHTML = '<div class="grp">' + (a.group === 'ski' ? '滑雪' : '打雪仗') + '</div>' +
      '<div class="badge">' + (a.unlocked ? '🏆' : '🔒') + '</div>' +
      '<div class="an">' + a.name + '</div>' +
      '<div class="ad">' + a.desc + '</div>';
    grid.appendChild(card);
  }
}
export function toastAchv(fresh) {
  if (!fresh || !fresh.length) return;
  const t = el('achvToast');
  t.textContent = '🏆 解锁成就：' + fresh.map(f => f.name).join('、');
  t.style.display = 'block';
  if (achvToastT) clearTimeout(achvToastT);
  achvToastT = setTimeout(() => { t.style.display = 'none'; }, 2600);
}
function openAchv() {
  renderAchv();
  hideAllPanels();
  el('achv').classList.add('show');
}

export function isShopOpen() { return el('shop').classList.contains('show'); }

// ---- 商城 ----
let shopTab = 'char';

function renderShop() {
  const list = el('shopList');
  list.innerHTML = '';
  for (const s of skins.SKINS[shopTab]) {
    const isOwned = skins.ownedHas(s.id);
    const isEquipped = skins.getEquipped(shopTab) === s.id;
    const costHtml = s.cost === 0
      ? '<div class="skin-cost">免费</div>'
      : '<div class="skin-cost">💰 ' + s.cost + ' 金币</div>';
    let btn;
    if (isEquipped) btn = '<button class="skin-btn equipped" disabled>已装备</button>';
    else if (isOwned) btn = '<button class="skin-btn" data-act="equip" data-cat="' + shopTab + '" data-id="' + s.id + '">装备</button>';
    else if (storage.coins >= s.cost) btn = '<button class="skin-btn" data-act="buy" data-cat="' + shopTab + '" data-id="' + s.id + '">购买</button>';
    else btn = '<button class="skin-btn locked" disabled>还差 ' + (s.cost - storage.coins) + '</button>';
    let prev;
    const rar = s.rarity || 0;
    const rarName = rar === 2 ? '传说' : rar === 1 ? '稀有' : '';
    const rarHtml = rarName ? '<div class="rarity r' + rar + '">' + rarName + '</div>' : '';
    if (shopTab === 'char') {
      prev = '<div class="skin-prev" style="--body:' + s.body + '"><span class="hat" style="background:' + s.hat + '"></span><span class="scarf" style="background:' + (s.scarf || '#ecf0f1') + '"></span></div>';
    } else {
      if (s.boardStyle === 'art') {
        const artUrl = (s.art === 'mint3d') ? boardMintUrl : '';
        prev = '<div class="skin-prev board">' +
                 '<img class="board-art" src="' + artUrl + '" alt="' + s.name + '" />' +
               '</div>';
      } else {
        const trailCss = s.trail === 'rainbow'
          ? 'background:linear-gradient(90deg,#ff9a9e,#a18cd1,#89cff0,#7bed9f,#ffd97d)'
          : 'background:' + (s.trail || '#ffffff');
        prev = '<div class="skin-prev board" style="--board:' + s.color + '"><span class="trailDot" style="' + trailCss + '"></span></div>';
      }
    }
    const card = document.createElement('div');
    card.className = 'skin-card' + (rar ? ' r' + rar : '');
    // 装备属性标签
    const st = skins.getStatsOf(s.id);
    let statHtml = '';
    if (st.coinX) statHtml += '<span class="stat-tag">金币 ×' + st.coinX.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + '</span>';
    if (st.glide) statHtml += '<span class="stat-tag">落地 ' + Math.round(st.glide * 100) + '%</span>';
    if (st.magnet) statHtml += '<span class="stat-tag">磁吸 ×' + st.magnet.toFixed(1) + '</span>';
    if (st.dodge) statHtml += '<span class="stat-tag">闪避 ' + Math.round(st.dodge * 100) + '%</span>';
    const statLine = statHtml ? '<div class="skin-stats">' + statHtml + '</div>' : '';
    card.innerHTML = rarHtml + prev + '<div class="skin-name">' + s.name + '</div>' + statLine + costHtml + btn;
    list.appendChild(card);
  }
}

function openShop() {
  renderShop();
  refreshCoins();
  el('shop').classList.add('show');
}
function closeShop() { el('shop').classList.remove('show'); }

export function bindUi() {
  el('startFight').addEventListener('click', () => { audio.initAudio(); hideAllPanels(); startSnowFight(); });
  el('startBtn').addEventListener('click', () => { audio.initAudio(); startGame(); });
  el('shopBtn').addEventListener('click', () => { audio.initAudio(); openShop(); });
  el('overShop').addEventListener('click', () => { audio.initAudio(); openShop(); });
  el('restart').addEventListener('click', () => { audio.initAudio(); startGame(); });
  el('resumeBtn').addEventListener('click', () => { audio.initAudio(); togglePause(); });
  el('pauseRestart').addEventListener('click', () => { audio.initAudio(); togglePause(); startGame(); });
  el('pauseMenu').addEventListener('click', () => { audio.initAudio(); togglePause(); toMenu(); });
  el('shopClose').addEventListener('click', closeShop);

  el('shopList').addEventListener('click', (e) => {
    const btn = e.target.closest('.skin-btn');
    if (!btn || btn.disabled) return;
    const skin = skins.SKINS[btn.dataset.cat].find(s => s.id === btn.dataset.id);
    if (!skin) return;
    if (btn.dataset.act === 'buy') {
      if (skins.buySkin(btn.dataset.cat, skin)) { audio.sfxCoin(); refreshCoins(); renderShop(); }
    } else if (btn.dataset.act === 'equip') {
      skins.equipSkin(btn.dataset.cat, skin.id);
      renderShop();
    }
  });

  document.querySelectorAll('.shop-tabs button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.shop-tabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      shopTab = b.dataset.tab;
      renderShop();
    });
  });

  function updateModeUI() {
    el('modeBoard').classList.toggle('active', skins.getMode() === 'board');
    el('modeSki').classList.toggle('active', skins.getMode() === 'ski');
  }
  el('modeBoard').addEventListener('click', () => { skins.setMode('board'); updateModeUI(); });
  el('modeSki').addEventListener('click', () => { skins.setMode('ski'); updateModeUI(); });
  updateModeUI();

  const musicBtn = el('music');
  function updateMusicUI() {
    musicBtn.textContent = audio.getBgmOn() ? '♪ 音乐' : '♪ 静音';
    musicBtn.classList.toggle('off', !audio.getBgmOn());
  }
  musicBtn.addEventListener('click', () => { audio.initAudio(); audio.toggleBgm(); updateMusicUI(); });
  updateMusicUI();

  // 打雪仗屏幕控制按钮（触屏/鼠标）
  const fcBtn = (id, down, up) => {
    const b = el(id);
    const on = (e) => { e.preventDefault(); audio.initAudio(); down(); };
    const off = (e) => { e.preventDefault(); if (up) up(); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
  };
  fcBtn('fcLeft', () => snowfight.moveLeft(true), () => snowfight.moveLeft(false));
  fcBtn('fcRight', () => snowfight.moveRight(true), () => snowfight.moveRight(false));
  fcBtn('fcThrow', () => snowfight.throwBall());
  fcBtn('fcUp', () => snowfight.upgrade());
  fcBtn('fcPause', () => snowfight.togglePauseFight());

  // 成就
  el('achvBtn').addEventListener('click', () => { audio.initAudio(); openAchv(); });
  el('achvClose').addEventListener('click', () => { hideAllPanels(); el('menu').classList.add('show'); });

  // 成瘾：开宝箱 + 每日挑战
  el('boxBtn').addEventListener('click', () => { audio.initAudio(); openLoot(); });
  el('lootOpen').addEventListener('click', () => { audio.initAudio(); doOpenBox(); });
  el('lootClose').addEventListener('click', () => { hideAllPanels(); el('menu').classList.add('show'); refreshMenu(); });
  el('dailyBtn').addEventListener('click', () => { audio.initAudio(); openDaily(); });
  el('dailyClose').addEventListener('click', () => { hideAllPanels(); el('menu').classList.add('show'); });
}

// ---- 开宝箱 ----
function openLoot() {
  hideAllPanels();
  el('lootContent').innerHTML = storage.boxes > 0
    ? '<div class="loot-empty">你有 ' + storage.boxes + ' 个宝箱，点击开启！</div>'
    : '<div class="loot-empty">暂无可开启的宝箱，去滑一局或打一局吧～</div>';
  el('lootbox').classList.add('show');
}
function doOpenBox() {
  if (storage.boxes <= 0) { el('lootContent').innerHTML = '<div class="loot-empty">没有宝箱啦～</div>'; return; }
  const r = meta.openBox();
  if (!r) { el('lootContent').innerHTML = '<div class="loot-empty">开启失败</div>'; return; }
  audio.sfxQuestDone();
  let html;
  if (r.kind === 'crystal') {
    html = '<div class="loot-rar">' + r.rar + '</div><div class="loot-amt">💎 +' + r.amt + '</div><div>结晶</div>';
  } else {
    html = '<div class="loot-rar">' + r.rar + '</div><div class="loot-skin">🎉 ' + meta.skinName(r.id) + '</div><div>' + (r.isNew ? '新皮肤已收入囊中！' : '（已在收藏中）') + '</div>';
  }
  const c = el('lootContent');
  c.innerHTML = html;
  c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  el('menuBoxes').textContent = storage.boxes;
  el('menuCrystal').textContent = storage.crystal;
}

// ---- 每日挑战 ----
function openDaily() {
  hideAllPanels();
  const obj = meta.dailyObjective();
  const claimed = (() => { try { return JSON.parse(localStorage.getItem('ski_daily_claim') || '{}'); } catch { return {}; } })();
  const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const doneToday = claimed.date === today && claimed.id === obj.id;
  const box = el('dailyObj');
  box.className = 'daily-obj' + (doneToday ? ' done' : '');
  box.innerHTML = obj.text + '<div class="do-reward">完成奖励 💎 +' + obj.reward + (doneToday ? '（今日已领取 ✓）' : '') + '</div>';
  el('dailyDate').textContent = '日期 ' + today + '（每日 0 点刷新目标与榜单）';
  const board = meta.todayBoard();
  const meT = (() => { const b = JSON.parse(localStorage.getItem('ski_daily') || '{}'); return (b[today] && b[today][0]) ? b[today][0].t : -1; })();
  let bh = board.length ? '' : '<div class="db-empty">今日还没有成绩，去滑一局登榜吧！</div>';
  board.forEach((e, i) => {
    bh += '<div class="db-row' + (e.t === meT ? ' me' : '') + '"><span>#' + (i + 1) + (e.t === meT ? ' （你）' : '') + '</span><span>得分 ' + e.score + ' · ' + e.dist + 'm</span></div>';
  });
  el('dailyBoard').innerHTML = bh;
  el('daily').classList.add('show');
}
