// 无头测试：BIOME 地图主题 + AFFIXES 精英词缀（vm stub 头部照抄 test/smoke.js）
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR=path.resolve(__dirname,'../js');

// ---- 浏览器环境 stub ----
const gradient = { addColorStop() {} };
const ctxProxy = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
    return typeof t[k] !== 'undefined' ? t[k] : (...a) => undefined;
  },
  set(t, k, v) { t[k] = v; return true; }
});
const canvas = { getContext: () => ctxProxy, width: 1280, height: 720,
  addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
const sandbox = {
  console, Math, Date, JSON, performance: { now: () => Date.now() },
  setTimeout: (fn) => 0, clearTimeout() {},
  requestAnimationFrame() {},
  document: { getElementById: () => canvas },
  window: { addEventListener() {} },
};
sandbox.window.dispatchEvent = () => {};

// ---- 最小游戏全局 stub ----
sandbox.VIEW_W = 1280; sandbox.VIEW_H = 720;
sandbox.WORLD = { w: 2600, h: 2600 };
sandbox.ctx = ctxProxy;
sandbox.cam = { x: 400, y: -100 };
sandbox.gameTime = 0; sandbox.gameState = 'play';
sandbox.enemies = [];
sandbox.player = { x: 1300, y: 1300, hp: 100, maxHp: 100, r: 16, speed: 220, dmg: 10, xpGain: 0, atkMul: 0 };
sandbox.rand = (a, b) => a + Math.random() * (b - a);
sandbox.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
sandbox.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
sandbox.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
sandbox.particles = [];
sandbox.spawnParticle = (x, y, opt) => { sandbox.particles.push(Object.assign({ vx: 0, vy: 0, life: 0.5, r0: 4, r1: 10, color: '#fff' }, opt, { x, y })); };
sandbox.burstCalls = [];
sandbox.burst = (x, y, n, opt) => { sandbox.burstCalls.push({ x, y, n, opt }); };
sandbox.spawned = [];
sandbox.spawnEnemy = (type, x, y, isElite) => { sandbox.spawned.push({ type, x, y, isElite }); };
vm.createContext(sandbox);

const code = fs.readFileSync(path.join(DIR, 'biome.js'), 'utf8');
try { vm.runInContext(code, sandbox, { filename: 'biome.js' }); }
catch (e) { console.log(`LOAD FAIL biome.js: ${e.message}`); process.exit(1); }
console.log('biome.js loaded');

const T = (expr) => vm.runInContext(expr, sandbox);
let failed = 0;
const check = (name, cond, detail = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' | ' + detail : ''));
  if (!cond) failed++;
};
const eq = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---- 测试 1：BIOME.init —— 三主题均可出现且加成正确应用 ----
const s1 = T(`(() => {
  const res = { seen: { meadow: 0, poisonswamp: 0, magmacave: 0 }, bad: [] };
  for (let i = 0; i < 900; i++) {
    player.xpGain = 0; player.atkMul = 0;
    const b = BIOME.init();
    res.seen[b.id]++;
    if (BIOME.current !== b) res.bad.push(i + ':cur');
    if (b.id === 'poisonswamp' && !(Math.abs(player.xpGain - 0.10) < 1e-9 && player.atkMul === 0)) res.bad.push('swamp@' + i);
    if (b.id === 'magmacave'   && !(Math.abs(player.atkMul - 0.08) < 1e-9 && player.xpGain === 0)) res.bad.push('magma@' + i);
    if (b.id === 'meadow'      && !(player.xpGain === 0 && player.atkMul === 0))                   res.bad.push('meadow@' + i);
  }
  // 加算叠加：已有基础值时应累加而非覆盖
  const hits = [];
  for (let i = 0; i < 300; i++) {
    player.xpGain = 0.05; player.atkMul = 0.02;
    const b = BIOME.init();
    if (b.id === 'poisonswamp') hits.push(['xp', player.xpGain]);
    if (b.id === 'magmacave')   hits.push(['atk', player.atkMul]);
  }
  res.stackedOk = hits.every(([k, v]) => k === 'xp' ? Math.abs(v - 0.15) < 1e-9 : Math.abs(v - 0.10) < 1e-9);
  res.stackN = hits.length;
  return res;
})()`);
check('init: 三种主题都出现', s1.seen.meadow > 0 && s1.seen.poisonswamp > 0 && s1.seen.magmacave > 0, JSON.stringify(s1.seen));
check('init: bonus 正确应用且 current 一致', s1.bad.length === 0, s1.bad.slice(0, 3).join(','));
check('init: xpGain/atkMul 加算叠加', s1.stackedOk && s1.stackN > 0, 'stacked samples=' + s1.stackN);
check('init: 主题数据完整(ground/grid/deco/motes/bonusText)',
  T(`BIOME.list.every(b => b.ground && b.grid && b.deco && b.motes.length === 2 && b.bonusText && b.name)`));

// ---- 测试 2：updateAmbient —— 约 8 颗/秒，位置/颜色/参数正确 ----
T(`BIOME.reset()`);                       // current=meadow, acc=0
sandbox.particles.length = 0;
T(`BIOME.updateAmbient(1.0)`);            // 精确 8 颗
let ps = sandbox.particles;
check('ambient: 1 秒发射 8 颗', ps.length === 8, 'n=' + ps.length);
check('ambient: 全部落在相机视口内且颜色取自 motes',
  ps.every(p => p.x >= sandbox.cam.x && p.x <= sandbox.cam.x + 1280 &&
                p.y >= sandbox.cam.y && p.y <= sandbox.cam.y + 720 &&
                ['#a8e6a0', '#d0f0c0'].includes(p.color)),
  'cam=' + JSON.stringify(sandbox.cam));
check('ambient: 参数 r0=2 r1=0.5 life∈[1,2]',
  ps.every(p => p.r0 === 2 && p.r1 === 0.5 && p.life >= 1 && p.life <= 2));
T(`BIOME.updateAmbient(0.0166)`);         // acc≈0.13 → 不发射
check('ambient: 小步长不发射', sandbox.particles.length === 8);
T(`BIOME.updateAmbient(0.25)`);           // acc≈2.13 → 再发 2 颗
check('ambient: 累计器跨帧累计正确', sandbox.particles.length === 10);
T(`BIOME.current = BIOME.list.find(b => b.id === 'magmacave')`);
sandbox.particles.length = 0;
T(`BIOME.updateAmbient(1.0)`);
check('ambient: 切主题后颜色跟随', sandbox.particles.length === 8 &&
  sandbox.particles.every(p => ['#ff8c42', '#ffb347'].includes(p.color)));

// ---- 测试 3+4：rollFor —— 非精英/Boss 不出；精英 0~2 条、不重复、数值生效 ----
const s3 = T(`(() => {
  const res = { leakNonElite: 0, leakBoss: 0, lens: { 0: 0, 1: 0, 2: 0 }, dup: 0, retMismatch: 0,
                badHp: 0, badGiant: 0, badSwift: 0, rerolled: 0, sharesRef: 0 };
  for (let i = 0; i < 1200; i++) {
    const ne = { isElite: i % 3 === 0, isBoss: i % 3 === 1, hp: 100, maxHp: 100, r: 14, speed: 80, dmg: 12 };
    const r = AFFIXES.rollFor(ne);
    if ((!ne.isElite || ne.isBoss) && (r !== null || ne.affixes !== undefined)) {
      if (ne.isBoss) res.leakBoss++; else res.leakNonElite++;
    }
  }
  for (let i = 0; i < 1500; i++) {
    const e = { isElite: true, hp: 100, maxHp: 100, r: 14, speed: 80, dmg: 12 };
    const got = AFFIXES.rollFor(e);
    const L = e.affixes.length;
    res.lens[L]++;
    if (got !== e.affixes) res.retMismatch++;
    const ids = e.affixes.map(a => a.id);
    if (new Set(ids).size !== ids.length) res.dup++;
    if (e.affixes.some(a => a.id === 'shielded') && !(Math.abs(e.maxHp - 170) < 1e-9 && Math.abs(e.hp - e.maxHp) < 1e-9)) res.badHp++;
    if (e.affixes.some(a => a.id === 'giant') && !(Math.abs(e.r - 21) < 1e-9 && Math.abs(e.dmg - 15.6) < 1e-9)) res.badGiant++;
    if (e.affixes.some(a => a.id === 'swift') && !(Math.abs(e.speed - 116) < 1e-9)) res.badSwift++;
    const again = AFFIXES.rollFor(e);
    if (again !== null || e.affixes.length !== L) res.rerolled++;
    if (L && e.affixes[0] === AFFIXES.pool.find(p => p.id === e.affixes[0].id)) res.sharesRef++;
  }
  return res;
})()`);
check('rollFor: 非精英与 Boss 均不出词缀', s3.leakNonElite === 0 && s3.leakBoss === 0, JSON.stringify(s3));
check('rollFor: 精英得 0~2 条且三种情况都出现', s3.lens[0] > 0 && s3.lens[1] > 0 && s3.lens[2] > 0, JSON.stringify(s3.lens));
check('rollFor: 词缀不重复、返回值即 e.affixes、不与池共享引用',
  s3.dup === 0 && s3.retMismatch === 0 && s3.sharesRef === 0);
check('rollFor: hpMul/speedMul/sizeMul+dmgMul 数值生效', s3.badHp === 0 && s3.badGiant === 0 && s3.badSwift === 0);
check('rollFor: 已有词缀不会重掷', s3.rerolled === 0);

// ---- 测试 5：handleDeath —— 分裂出 2 只 slime + 紫色特效 ----
T(`var sd = { isElite: true, x: 100, y: 200, affixes: [{ id: 'splitting', name: '分裂', color: '#c084fc' }] }`);
sandbox.spawned.length = 0; sandbox.burstCalls.length = 0;
const splitRet = T(`AFFIXES.handleDeath(sd)`);
check('handleDeath: 分裂返回 true 且生成 2 只普通 slime',
  splitRet === true && sandbox.spawned.length === 2 &&
  sandbox.spawned.every(s => s.type === 'slime' && s.isElite === false),
  JSON.stringify(sandbox.spawned));
check('handleDeath: 出生于 x±20 / y±20',
  sandbox.spawned.some(s => s.x === 120 && s.y === 220) &&
  sandbox.spawned.some(s => s.x === 80 && s.y === 180));
check('handleDeath: 带紫色(#c084fc) burst 特效',
  sandbox.burstCalls.length === 1 && sandbox.burstCalls[0].opt && sandbox.burstCalls[0].opt.color === '#c084fc');
T(`var nd = { isElite: true, x: 0, y: 0, affixes: [{ id: 'swift', name: '迅捷', color: '#6dd47e' }] }`);
sandbox.spawned.length = 0;
check('handleDeath: 无分裂词缀不生成', T(`AFFIXES.handleDeath(nd)`) === false && sandbox.spawned.length === 0);
sandbox.spawned.length = 0;
check('handleDeath: 无词缀敌人安全返回 false', T(`AFFIXES.handleDeath({ x: 0, y: 0 })`) === false && sandbox.spawned.length === 0);

// ---- 测试 6：drawBadge —— 各种输入均不抛错 ----
try {
  T(`var be = { x: 600, y: 300, r: 20, isElite: true,
       affixes: [{ id: 'shielded', name: '护盾', color: '#7db8e8' }, { id: 'giant', name: '巨型', color: '#ffd700' }] }`);
  T(`AFFIXES.drawBadge(ctx, be, cam.x, cam.y)`);                                            // 双词缀
  T(`AFFIXES.drawBadge(ctx, { x: 0, y: 0, r: 10, affixes: [{ id: 'swift', name: '迅捷', color: '#6dd47e' }] }, 0, 0)`); // 单词缀
  T(`AFFIXES.drawBadge(ctx, { x: 0, y: 0, r: 10, affixes: [] }, 0, 0)`);                    // 空
  T(`AFFIXES.drawBadge(ctx, { x: 0, y: 0, r: 10 }, 0, 0)`);                                 // 无字段
  T(`AFFIXES.drawBadge(ctx, null, 0, 0)`);                                                  // 空参
  check('badge: 单/双/空/缺失词缀绘制均不抛错', true);
} catch (e) { check('badge: 单/双/空/缺失词缀绘制均不抛错', false, e.message); }

// ---- 测试 7：reset 干净 ----
T(`BIOME.current = BIOME.list[2]; BIOME.updateAmbient(0.5); AFFIXES.reset()`);
T(`BIOME.reset()`);
check('reset: current 回 meadow、发射器归零', T(`BIOME.current === BIOME.list[0] && BIOME._moteAcc === 0`));
sandbox.particles.length = 0;
T(`BIOME.updateAmbient(1.0)`);
check('reset: 重置后仍正常工作', sandbox.particles.length === 8 && T(`typeof AFFIXES.reset === 'function'`));
check('globals: BIOME / AFFIXES 已暴露', T(`typeof BIOME === 'object' && typeof AFFIXES === 'object' && BIOME.list.length === 3 && AFFIXES.pool.length === 4`));

console.log(failed ? `TEST-BIOME FAILED (${failed} checks)` : 'TEST-BIOME ALL PASS');
process.exitCode = failed ? 1 : 0;
