// biome.js — 地图主题（BIOME）+ 精英词缀（AFFIXES）双系统
// 全局作用域，无模块。依赖全局：rand/randInt/pick、VIEW_W/VIEW_H、cam、player、
// spawnParticle(x,y,opt)、burst(x,y,n,opt)、spawnEnemy(type,x,y,isElite)。
// 由 index.html 在 utils.js / enemies.js 之后引入即可。
'use strict';

const BIOME = {
  list: [
    { id: 'meadow',      name: '翠绿原野', ground: '#2c3e33', grid: 'rgba(255,255,255,0.04)', deco: 'rgba(96,153,102,0.28)', motes: ['#a8e6a0', '#d0f0c0'], bonus: null,             bonusText: '无加成' },
    { id: 'poisonswamp', name: '幽暗毒沼', ground: '#26302a', grid: 'rgba(160,220,140,0.06)', deco: 'rgba(122,199,79,0.30)', motes: ['#7ac74f', '#9b6bb3'], bonus: { xpGain: 0.10 }, bonusText: '经验获取 +10%' },
    { id: 'magmacave',   name: '灼热熔窟', ground: '#33261f', grid: 'rgba(255,140,66,0.07)',  deco: 'rgba(255,107,53,0.22)', motes: ['#ff8c42', '#ffb347'], bonus: { atkMul: 0.08 }, bonusText: '攻击力 +8%' }
  ],
  current: null,   // init() 后为主题对象；主控可回退用 list[0]
  _moteAcc: 0,

  // 开局随机选一个主题并应用加成（xpGain / atkMul 加算），返回 current
  init() {
    this.current = this.list[randInt(0, this.list.length - 1)];
    const b = this.current.bonus;
    if (b && typeof player !== 'undefined' && player) {
      if (b.xpGain) player.xpGain = (player.xpGain || 0) + b.xpGain;
      if (b.atkMul) player.atkMul = (player.atkMul || 0) + b.atkMul;
    }
    return this.current;
  },

  // 每帧调用：约每秒 8 颗环境浮尘，在相机可视范围内随机位置，缓慢漂移后收缩消散
  updateAmbient(dt) {
    if (!this.current || !(dt > 0)) return;
    this._moteAcc += dt * 8;                       // 速率 ≈ 8 颗/秒
    while (this._moteAcc >= 1) {
      this._moteAcc -= 1;
      spawnParticle(cam.x + rand(0, VIEW_W), cam.y + rand(0, VIEW_H), {
        color: pick(this.current.motes),
        vx: rand(-10, 10), vy: rand(-20, -6),      // 缓慢漂移
        life: rand(1, 2),                          // 存活 1~2 秒
        r0: 2, r1: 0.5                             // 微尘：出生小 → 更小消散
      });
    }
  },

  reset() { this.current = this.list[0]; this._moteAcc = 0; }
};

const AFFIXES = {
  pool: [
    { id: 'shielded',  name: '护盾', color: '#7db8e8', hpMul: 1.7 },
    { id: 'swift',     name: '迅捷', color: '#6dd47e', speedMul: 1.45 },
    { id: 'giant',     name: '巨型', color: '#ffd700', sizeMul: 1.5, dmgMul: 1.3 },
    { id: 'splitting', name: '分裂', color: '#c084fc' }
  ],

  // 精英生成时调用：60% 得 1 条词缀、20% 得 2 条（不重复）、其余无。
  // 数值词缀立即生效；返回 e.affixes（不满足条件时返回 null）。
  rollFor(e) {
    if (!e || !e.isElite || e.isBoss || e.affixes) return null;
    const roll = Math.random();
    const count = roll < 0.20 ? 2 : (roll < 0.80 ? 1 : 0);
    if (!count) { e.affixes = []; return e.affixes; }
    const bag = this.pool.slice();
    e.affixes = [];                                 // 存 def 的浅拷贝，避免共享引用被误改
    for (let i = 0; i < count && bag.length; i++) {
      e.affixes.push(Object.assign({}, bag.splice(randInt(0, bag.length - 1), 1)[0]));
    }
    for (const d of e.affixes) {
      if (d.hpMul)    { e.maxHp *= d.hpMul; e.hp = e.maxHp; }
      if (d.speedMul) e.speed *= d.speedMul;
      if (d.sizeMul)  e.r *= d.sizeMul;
      if (d.dmgMul)   e.dmg *= d.dmgMul;
    }
    return e.affixes;
  },

  // 主控在敌人死亡分支调用；含「分裂」则在原地炸出 2 只普通 slime
  handleDeath(e) {
    if (!e || !Array.isArray(e.affixes)) return false;
    if (!e.affixes.some(a => a.id === 'splitting')) return false;
    burst(e.x, e.y, 14, { color: '#c084fc', spdMin: 40, spdMax: 150, life: 0.5, r0: 3, r1: 0 });
    spawnEnemy('slime', e.x + 20, e.y + 20, false);
    spawnEnemy('slime', e.x - 20, e.y - 20, false);
    return true;
  },

  // 精英头顶（-e.r-18）绘制词缀徽章：每条词缀一枚 12px 圆点 + 名称首字
  drawBadge(ctx, e, camX, camY) {
    if (!e || !Array.isArray(e.affixes)) return;
    const marks = e.affixes.filter(a => a && a.name);
    if (!marks.length) return;
    const gap = 16;
    const sx = e.x - camX - ((marks.length - 1) * gap) / 2;
    const sy = e.y - camY - e.r - 18;
    ctx.save();
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < marks.length; i++) {
      const d = marks[i], x = sx + i * gap;
      ctx.beginPath();
      ctx.arc(x, sy, 6, 0, Math.PI * 2);            // 直径 12px 圆点
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = d.color || '#fff';
      ctx.stroke();
      ctx.fillStyle = d.color || '#fff';
      ctx.fillText(d.name[0], x, sy + 0.5);
    }
    ctx.restore();
  },

  reset() {}   // 词缀挂在敌人实体上随其回收；保留空钩子维持 API 对称
};
