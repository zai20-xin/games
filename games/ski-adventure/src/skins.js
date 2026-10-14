// skins.js —— 皮肤数据 + 装备/购买逻辑 + 图案绘制
import { ctx } from './canvas.js';
import * as storage from './storage.js';
import { EQUIP } from './config.js';

// scarf: 围巾/点缀色 · rarity: 0普通 1稀有 2传说
// board.trail: 滑行拖尾粒子色，可为颜色值或特殊标记 rainbow / fire / star
export const SKINS = {
  char: [
    { id:'c_default', name:'经典蓝', cost:0,   body:'#2e86de', hat:'#ff6b6b', head:'#ffd9a0', pat:'stripe',  pat2:'#ffffff', scarf:'#ecf0f1', rarity:0 },
    { id:'c_flame',  name:'烈焰红', cost:120, body:'#e74c3c', hat:'#2c3e50', head:'#ffd9a0', pat:'flame',   pat2:'#ffd34d', scarf:'#ffd34d', rarity:0 },
    { id:'c_forest', name:'森林绿', cost:120, body:'#27ae60', hat:'#f1c40f', head:'#ffd9a0', pat:'dot',     pat2:'#ffffff', scarf:'#ecf0f1', rarity:0 },
    { id:'c_purple', name:'幻紫',   cost:220, body:'#8e44ad', hat:'#ecf0f1', head:'#ffd9a0', pat:'diamond', pat2:'#ecf0f1', scarf:'#f9ca24', rarity:0 },
    { id:'c_gold',   name:'黄金甲', cost:450, body:'#f1c40f', hat:'#e67e22', head:'#ffffff', pat:'stripe',  pat2:'#e67e22', scarf:'#e74c3c', rarity:1 },
    { id:'c_aqua',   name:'海洋蓝', cost:160, body:'#1abc9c', hat:'#e74c3c', head:'#ffd9a0', pat:'wave',    pat2:'#ffffff', scarf:'#ecf0f1', rarity:0 },
    { id:'c_orange', name:'活力橙', cost:200, body:'#e67e22', hat:'#34495e', head:'#ffd9a0', pat:'dot',     pat2:'#34495e', scarf:'#2c3e50', rarity:0 },
    { id:'c_pink',   name:'樱粉',   cost:260, body:'#ff7eb6', hat:'#8e44ad', head:'#ffffff', pat:'check',   pat2:'#ffffff', scarf:'#ffffff', rarity:0 },
    { id:'c_mint',   name:'薄荷绿', cost:300, body:'#2ecc71', hat:'#ffffff', head:'#ffd9a0', pat:'gradient',pat2:'#ffffff', scarf:'#ff7eb6', rarity:0 },
    { id:'c_shadow', name:'暗夜',   cost:500, body:'#34495e', hat:'#e74c3c', head:'#ffd9a0', pat:'star',    pat2:'#e74c3c', scarf:'#e74c3c', rarity:1 },
    { id:'c_magma',  name:'熔岩骑士', cost:620, body:'#2d3436', hat:'#d63031', head:'#ffd9a0', pat:'flame', pat2:'#fdcb6e', scarf:'#ff7675', rarity:2 },
    { id:'c_aurora', name:'极光幻影', cost:880, body:'#0a3d62', hat:'#0fb9b1', head:'#ffffff', pat:'wave',  pat2:'#7bed9f', scarf:'#38ef7d', rarity:2 },
    // ---- 神话系列（传说级 rarity:2，单价 10000）----
    { id:'c_thunder', name:'雷神·奔雷', cost:10000, body:'#1b1f2a', hat:'#f1c40f', head:'#ffe0a3', pat:'zig',      pat2:'#f1c40f', scarf:'#c0392b', rarity:2 },
    { id:'c_dragon',  name:'青龙·御风', cost:10000, body:'#0e6b5a', hat:'#dff6f0', head:'#ffe0a3', pat:'dragon',  pat2:'#7bed9f', scarf:'#38ef7d', rarity:2 },
    { id:'c_phoenix', name:'凤凰·涅槃', cost:10000, body:'#7b1f1f', hat:'#f1c40f', head:'#ffe0a3', pat:'flame',   pat2:'#ffd34d', scarf:'#ff7675', rarity:2 },
    { id:'c_baihu',   name:'白虎·啸天', cost:10000, body:'#e8edf2', hat:'#34495e', head:'#ffe0a3', pat:'tiger',   pat2:'#2c3e50', scarf:'#34495e', rarity:2 },
    // ---- 机甲系列（传说级 rarity:2，单价 10000，charStyle:mecha）----
    { id:'c_mecha1', name:'机甲·玄铁', cost:10000, body:'#4a5560', hat:'#1f6feb', head:'#cfe3ff', pat:'stripe',  pat2:'#1f6feb', scarf:'#1f6feb', rarity:2, charStyle:'mecha' },
    { id:'c_mecha2', name:'机甲·烈焰', cost:10000, body:'#5a3a2a', hat:'#ff7b29', head:'#ffe0a3', pat:'flame',   pat2:'#ffb15c', scarf:'#ff7b29', rarity:2, charStyle:'mecha' },
    { id:'c_mecha3', name:'机甲·幽蓝', cost:10000, body:'#3a2f5a', hat:'#38efd0', head:'#e6d4ff', pat:'diamond', pat2:'#38efd0', scarf:'#38efd0', rarity:2, charStyle:'mecha' },
  ],
  board: [
    { id:'b_default', name:'薄荷青·紫尾', cost:0, color:'#7FE3D4', pat:'none', pat2:'#8A5CF6', trail:'#b39cff', rarity:0, boardStyle:'art', art:'mint3d' },
    { id:'b_ice',    name:'冰蓝',   cost:100, color:'#1fb6c9', pat:'wave',     pat2:'#ffffff', trail:'#a8e6f7', rarity:0 },
    { id:'b_lava',   name:'熔岩橙', cost:150, color:'#e67e22', pat:'flame',    pat2:'#fff3c4', trail:'#ff9f43', rarity:0 },
    { id:'b_sakura', name:'樱粉',   cost:180, color:'#ff7eb6', pat:'check',    pat2:'#ffffff', trail:'#ffb3d1', rarity:0 },
    { id:'b_neon',   name:'霓虹',   cost:320, color:'#9b59b6', pat:'gradient', pat2:'#ffffff', trail:'#d980fa', rarity:1 },
    { id:'b_mint',   name:'薄荷绿', cost:130, color:'#2ecc71', pat:'dot',      pat2:'#ffffff', trail:'#7bed9f', rarity:0 },
    { id:'b_gold',   name:'黄金',   cost:200, color:'#f1c40f', pat:'stripe',   pat2:'#fff3c4', trail:'#ffd34d', rarity:1 },
    { id:'b_black',  name:'暗夜黑', cost:240, color:'#2c3e50', pat:'diamond',  pat2:'#e74c3c', trail:'#95a5a6', rarity:0 },
    { id:'b_aqua',   name:'海洋蓝', cost:280, color:'#1abc9c', pat:'zig',      pat2:'#ffffff', trail:'#55efc4', rarity:0 },
    { id:'b_rainbow',name:'炫彩紫', cost:400, color:'#e056fd', pat:'star',     pat2:'#ffffff', trail:'#e056fd', rarity:1 },
    { id:'b_ember',  name:'余烬',   cost:560, color:'#d63031', pat:'flame',    pat2:'#fdcb6e', trail:'fire',    rarity:2 },
    { id:'b_aurora', name:'极光之翼', cost:720, color:'#00a8ff', pat:'wave',   pat2:'#7bed9f', trail:'rainbow', rarity:2 },
    { id:'b_galaxy', name:'银河星板', cost:960, color:'#5f27cd', pat:'star',   pat2:'#ffeaa7', trail:'star',    rarity:2 },
    // ---- 神话系列（传说级 rarity:2，单价 10000）----
    { id:'b_kunlun',  name:'昆仑·玉板', cost:10000, color:'#eef3f5', pat:'star',    pat2:'#f1c40f', trail:'star',    rarity:2 },
    { id:'b_huntian', name:'混天·绫板', cost:10000, color:'#d63031', pat:'stripe',  pat2:'#f1c40f', trail:'rainbow', rarity:2 },
    { id:'b_jiuxiao', name:'九霄·雷板', cost:10000, color:'#5f27cd', pat:'zig',     pat2:'#dff6f0', trail:'fire',    rarity:2 },
    // ---- 机甲系列科技滑板（传说级 rarity:2，单价 10000，boardStyle:tech）----
    { id:'b_tech1', name:'科技板·脉冲', cost:10000, color:'#1f6feb', pat:'stripe',  pat2:'#cfe3ff', trail:'#1f6feb', rarity:2, boardStyle:'tech' },
    { id:'b_tech2', name:'科技板·熔核', cost:10000, color:'#ff7b29', pat:'flame',   pat2:'#ffd34d', trail:'fire',    rarity:2, boardStyle:'tech' },
    { id:'b_tech3', name:'科技板·量子', cost:10000, color:'#7b2ff7', pat:'diamond', pat2:'#38efd0', trail:'rainbow', rarity:2, boardStyle:'tech' },
  ],
};

let owned = storage.getOwned();
let equip = storage.getEquip();
let mode = storage.getMode();

// ---- 装备属性覆盖（乘数/加值，作用于 config.EQUIP 基础值）----
// 角色影响：coinX 金币倍率、glide 落地缓冲；滑板影响：magnet 磁吸、dodge 闪避。
// 只有稀有(r1)/传说(r2)及指定高级皮肤带属性，普通皮肤用基准值。
const STATS_OVERRIDE = {
  // 角色
  c_gold:    { coinX: 1.2 },
  c_shadow:  { coinX: 1.15, glide: 0.15 },
  c_magma:   { coinX: 1.3, glide: 0.2 },
  c_aurora:  { coinX: 1.3, glide: 0.2 },
  c_thunder: { coinX: 1.5, glide: 0.25 },
  c_dragon:  { coinX: 1.5, glide: 0.25 },
  c_phoenix: { coinX: 1.5, glide: 0.25 },
  c_baihu:   { coinX: 1.5, glide: 0.25 },
  c_mecha1:  { coinX: 1.4, glide: 0.3 },
  c_mecha2:  { coinX: 1.4, glide: 0.3 },
  c_mecha3:  { coinX: 1.4, glide: 0.3 },
  // 滑板
  b_neon:    { magnet: 1.4 },
  b_gold:    { magnet: 1.3 },
  b_rainbow: { magnet: 1.5, dodge: 0.1 },
  b_ember:   { magnet: 1.4, dodge: 0.15 },
  b_aurora:  { magnet: 1.5, dodge: 0.15 },
  b_galaxy:  { magnet: 1.6, dodge: 0.2 },
  b_kunlun:  { magnet: 1.8, dodge: 0.25 },
  b_huntian: { magnet: 1.8, dodge: 0.25 },
  b_jiuxiao: { magnet: 1.8, dodge: 0.25 },
  b_tech1:   { magnet: 1.7, dodge: 0.2 },
  b_tech2:   { magnet: 1.7, dodge: 0.2 },
  b_tech3:   { magnet: 1.7, dodge: 0.2 },
};

export function getMode() { return mode; }
export function setMode(m) {
  mode = m;
  storage.setMode(m);
}

export function ownedHas(id) {
  return id === 'c_default' || id === 'b_default' || owned.indexOf(id) !== -1;
}

export function getEquipColors() {
  let c = SKINS.char.find(s => s.id === equip.char); if (!c) c = SKINS.char[0];
  let b = SKINS.board.find(s => s.id === equip.board); if (!b) b = SKINS.board[0];
  return { body:c.body, hat:c.hat, head:c.head, board:b.color,
           charPat:c.pat||'none', charPat2:c.pat2||'#fff',
           boardPat:b.pat||'none', boardPat2:b.pat2||'#fff',
           scarf:c.scarf||'#ecf0f1', trail:b.trail||'#ffffff',
           charRarity:c.rarity||0, boardRarity:b.rarity||0,
           charStyle:c.charStyle||'normal', boardStyle:b.boardStyle||'normal',
           art:b.art||null };
}

export function getEquipped(cat) { return equip[cat]; }

// 聚合当前装备的属性（基础值 × 角色/滑板覆盖）
export function getEquippedStats() {
  const c = SKINS.char.find(s => s.id === equip.char) || SKINS.char[0];
  const b = SKINS.board.find(s => s.id === equip.board) || SKINS.board[0];
  const co = STATS_OVERRIDE[c.id] || {};
  const bo = STATS_OVERRIDE[b.id] || {};
  return {
    magnet: EQUIP.baseMagnet * (bo.magnet || 1),
    coinX: EQUIP.baseCoinX * (co.coinX || 1),
    glide: EQUIP.baseGlide + (co.glide || 0),
    dodge: EQUIP.baseDodge + (bo.dodge || 0),
  };
}
export function getStatsOf(id) {
  const c = SKINS.char.find(s => s.id === id);
  const b = SKINS.board.find(s => s.id === id);
  const o = STATS_OVERRIDE[id] || {};
  if (c) return { coinX: o.coinX || 1, glide: o.glide || 0 };
  if (b) return { magnet: o.magnet || 1, dodge: o.dodge || 0 };
  return {};
}

export function buySkin(cat, skin) {
  if (ownedHas(skin.id)) { equipSkin(cat, skin.id); return true; }
  if (!storage.spendCoins(skin.cost)) return false;
  owned.push(skin.id);
  storage.setOwned(owned);
  equipSkin(cat, skin.id);
  return true;
}

export function equipSkin(cat, id) {
  equip[cat] = id;
  storage.setEquip(equip);
}

// ---- 图案绘制（星星 / 条纹 / 圆点 / 锯齿 / 棋盘 / 火焰 / 波浪 / 菱形 / 渐变）----
export function drawStarPath(cx, cy, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI / 5 * i - Math.PI / 2;
    const rad = (i % 2 === 0) ? R : r;
    ctx.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

export function paintPattern(type, color, x0, y0, w, h) {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = color;
  if (type === 'stripe') {
    const gap = Math.max(4, h * 0.26);
    for (let sx = x0; sx < x0 + w + gap; sx += gap * 2) ctx.fillRect(sx, y0, gap, h);
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    for (let sx = x0 + gap * 0.5; sx < x0 + w + gap; sx += gap * 2)
      ctx.fillRect(sx, y0, Math.max(1, gap * 0.2), h);
  } else if (type === 'dot') {
    const r = Math.max(1.8, Math.min(w, h) * 0.14);
    const step = r * 2.5;
    for (let yy = y0 + step * 0.5; yy < y0 + h + step; yy += step)
      for (let xx = x0 + step * 0.5; xx < x0 + w + step; xx += step) {
        ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(xx - r * 0.3, yy - r * 0.3, r * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
      }
  } else if (type === 'zig') {
    ctx.lineWidth = Math.max(2, h * 0.18);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const amp = h * 0.24, step = h * 0.36;
    for (let yy = y0 + step * 0.5; yy < y0 + h + step; yy += step) {
      ctx.beginPath();
      let first = true;
      for (let xx = x0; xx <= x0 + w; xx += 4) {
        const off = Math.sin((xx - x0) / w * Math.PI * 4) * amp;
        if (first) { ctx.moveTo(xx, yy + off); first = false; }
        else ctx.lineTo(xx, yy + off);
      }
      ctx.stroke();
    }
  } else if (type === 'check') {
    const n = Math.max(3, Math.round(w / (Math.min(w, h) * 0.42)));
    const cw = w / n, ch = h / n, rr = Math.min(cw, ch) * 0.22;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if ((i + j) % 2 === 0) {
          const rx = x0 + i * cw, ry = y0 + j * ch;
          ctx.beginPath();
          ctx.moveTo(rx + rr, ry);
          ctx.arcTo(rx + cw, ry, rx + cw, ry + ch, rr);
          ctx.arcTo(rx + cw, ry + ch, rx, ry + ch, rr);
          ctx.arcTo(rx, ry + ch, rx, ry, rr);
          ctx.arcTo(rx, ry, rx + cw, ry, rr);
          ctx.closePath(); ctx.fill();
        }
  } else if (type === 'flame') {
    const n = Math.max(3, Math.round(w / (h * 0.5)));
    const fw = w / n;
    for (let i = 0; i < n; i++) {
      const cx = x0 + fw * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(cx - fw * 0.42, y0 + h);
      ctx.quadraticCurveTo(cx - fw * 0.55, y0 + h * 0.5, cx, y0 + h * 0.08);
      ctx.quadraticCurveTo(cx + fw * 0.55, y0 + h * 0.5, cx + fw * 0.42, y0 + h);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < n; i++) {
      const cx = x0 + fw * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(cx - fw * 0.2, y0 + h);
      ctx.quadraticCurveTo(cx - fw * 0.28, y0 + h * 0.55, cx, y0 + h * 0.3);
      ctx.quadraticCurveTo(cx + fw * 0.28, y0 + h * 0.55, cx + fw * 0.2, y0 + h);
      ctx.closePath(); ctx.fill();
    }
  } else if (type === 'wave') {
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.1);
    ctx.lineCap = 'round';
    const rows = Math.max(2, Math.round(h / (Math.min(w, h) * 0.5)));
    for (let r = 0; r <= rows; r++) {
      const yy = y0 + (h / rows) * r + (h / rows) * 0.5;
      ctx.beginPath();
      let first = true;
      for (let xx = x0; xx <= x0 + w; xx += 4) {
        const off = Math.sin((xx - x0) / w * Math.PI * 3 + r) * (h / rows * 0.3);
        if (first) { ctx.moveTo(xx, yy + off); first = false; }
        else ctx.lineTo(xx, yy + off);
      }
      ctx.stroke();
    }
  } else if (type === 'diamond') {
    const size = Math.max(6, Math.min(w, h) * 0.34);
    const step = size * 1.15;
    for (let yy = y0 - size; yy < y0 + h + size; yy += step)
      for (let xx = x0 - size; xx < x0 + w + size; xx += step) {
        ctx.beginPath();
        ctx.moveTo(xx, yy - size);
        ctx.lineTo(xx + size, yy);
        ctx.lineTo(xx, yy + size);
        ctx.lineTo(xx - size, yy);
        ctx.closePath(); ctx.fill();
      }
  } else if (type === 'gradient') {
    const g = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);
  } else if (type === 'star') {
    const r = Math.max(1.6, Math.min(w, h) * 0.1);
    const step = r * 3.2;
    for (let yy = y0 + step * 0.5; yy < y0 + h + step; yy += step)
      for (let xx = x0 + step * 0.5; xx < x0 + w + step; xx += step)
        drawStarPath(xx, yy, r, r * 0.45);
  } else if (type === 'dragon') {
    // 龙纹：平铺 S 形盘龙（金身 + 脊刺 + 鳞点 + 龙首），color 为龙身色
    const r = Math.max(6, Math.min(w, h) * 0.32);
    const step = r * 1.5;
    for (let yy = y0 - r; yy < y0 + h + r; yy += step)
      for (let xx = x0 - r; xx < x0 + w + r; xx += step) {
        const cx = xx + ((Math.round(yy / step) % 2) ? step * 0.5 : 0);
        // 龙身（S 曲线）
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, r * 0.32);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.8, yy - r * 0.4);
        ctx.quadraticCurveTo(cx, yy - r * 0.9, cx + r * 0.4, yy - r * 0.2);
        ctx.quadraticCurveTo(cx + r * 0.9, yy + r * 0.3, cx + r * 0.2, yy + r * 0.7);
        ctx.quadraticCurveTo(cx - r * 0.4, yy + r * 1.0, cx - r * 0.9, yy + r * 0.5);
        ctx.stroke();
        // 脊刺
        ctx.fillStyle = color;
        for (let k = -1; k <= 1; k++) {
          const sx = cx + k * r * 0.4, sy = yy + k * r * 0.18;
          ctx.beginPath();
          ctx.moveTo(sx, sy - r * 0.34);
          ctx.lineTo(sx + r * 0.12, sy);
          ctx.lineTo(sx - r * 0.12, sy);
          ctx.closePath(); ctx.fill();
        }
        // 鳞点高光
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(cx + r * 0.3, yy + r * 0.1, r * 0.1, 0, Math.PI * 2); ctx.fill();
        // 龙首（三角吻 + 眼）
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.9, yy + r * 0.5);
        ctx.lineTo(cx - r * 1.15, yy + r * 0.35);
        ctx.lineTo(cx - r * 0.85, yy + r * 0.62);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1b1f2a';
        ctx.beginPath(); ctx.arc(cx - r * 0.78, yy + r * 0.5, r * 0.07, 0, Math.PI * 2); ctx.fill();
      }
  } else if (type === 'tiger') {
    // 虎纹：橙黑虎斑条纹 + 虎头侧影（耳/眼/鼻），color 为斑纹色（深）
    const r = Math.max(5, Math.min(w, h) * 0.28);
    const step = r * 1.4;
    // 背景已由调用方填充底色，这里只画斑纹
    ctx.fillStyle = color;
    for (let yy = y0 - r; yy < y0 + h + r; yy += step)
      for (let xx = x0 - r; xx < x0 + w + r; xx += step) {
        const cx = xx + ((Math.round(yy / step) % 2) ? step * 0.5 : 0);
        // 虎斑（双弧条纹）
        ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.strokeStyle = color; ctx.lineCap = 'round';
        for (const off of [-r * 0.25, r * 0.25]) {
          ctx.beginPath();
          ctx.moveTo(cx + off, yy - r * 0.5);
          ctx.quadraticCurveTo(cx + off * 0.4, yy, cx + off, yy + r * 0.5);
          ctx.stroke();
        }
      }
    // 虎头侧影（放在区域中央一格）
    const hx = x0 + w * 0.5, hy = y0 + h * 0.5, hr = Math.min(w, h) * 0.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr * 0.9, hr * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    // 耳
    ctx.beginPath(); ctx.arc(hx - hr * 0.6, hy - hr * 0.7, hr * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + hr * 0.6, hy - hr * 0.7, hr * 0.28, 0, Math.PI * 2); ctx.fill();
    // 眼（白底 + 瞳）
    ctx.fillStyle = '#fff7e0';
    ctx.beginPath(); ctx.arc(hx - hr * 0.32, hy - hr * 0.05, hr * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + hr * 0.32, hy - hr * 0.05, hr * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1f2a';
    ctx.beginPath(); ctx.arc(hx - hr * 0.32, hy - hr * 0.05, hr * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + hr * 0.32, hy - hr * 0.05, hr * 0.08, 0, Math.PI * 2); ctx.fill();
    // 鼻
    ctx.fillStyle = '#2c1810';
    ctx.beginPath(); ctx.moveTo(hx, hy + hr * 0.18);
    ctx.lineTo(hx - hr * 0.12, hy + hr * 0.32);
    ctx.lineTo(hx + hr * 0.12, hy + hr * 0.32);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
