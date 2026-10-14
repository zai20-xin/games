// ===== 工具函数 =====
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function dist(ax,ay,bx,by){ return Math.sqrt(dist2(ax,ay,bx,by)); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function rand(a,b){ return a+Math.random()*(b-a); }
function randInt(a,b){ return Math.floor(rand(a,b+1)); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function lerp(a,b,t){ return a+(b-a)*t; }

// 屏幕震动
const Shake = {
  t:0, power:0,
  add(p){ this.power=Math.max(this.power,p); this.t=Math.max(this.t,0.25); },
  update(dt){ if(this.t>0){ this.t-=dt; if(this.t<=0) this.power=0; } },
  offset(){ if(this.t<=0) return {x:0,y:0};
    const k=this.power*(this.t/0.25);
    return {x:rand(-k,k), y:rand(-k,k)}; }
};

// 伤害数字池
let dmgTexts=[];
function spawnDmgText(x,y,val,color,isCrit,critBig){
  // 字符串文案（如 "+3金币"、"会心!"）原样保留；仅数字取整。
  // 此前 Math.round(字符串) 产生 NaN —— 正是「打中敌人飘 NaN」的根因。
  const isNum=typeof val==="number";
  let shown=val;
  if(isNum){
    shown=Math.round(val);
    if(!isFinite(shown)){shown=0;}   // 数值异常兜底，绝不显示 NaN
  }
  dmgTexts.push({x:x+rand(-8,8), y:y-10, val:shown, color:critBig?"#ffd93d":(color||"#fff"),
                 life:critBig?1.1:0.7, vy:-55, crit:!!isCrit||!!critBig,
                 size:critBig?26:0});
}
function updateDmgTexts(dt){
  for(let i=dmgTexts.length-1;i>=0;i--){ const d=dmgTexts[i];
    d.y+=d.vy*dt; d.vy*=0.92; d.life-=dt;
    if(d.life<=0) dmgTexts.splice(i,1); }
}

// 粒子系统：所有特效统一「生成→膨胀→消散」三段生命周期
let particles=[];
function spawnParticle(x,y,opt){
  particles.push(Object.assign({
    x,y, vx:0, vy:0, life:0.5, maxLife:0.5,
    r0:4, r1:10, color:"#fff", glow:false, shape:"circle", rot:0, vrot:0, grav:0
  }, opt));
  const p=particles[particles.length-1]; p.maxLife=p.life;
}
function burst(x,y,n,opt){ for(let i=0;i<n;i++){
  const a=rand(0,Math.PI*2), sp=rand(opt.spdMin||30, opt.spdMax||120);
  spawnParticle(x,y,Object.assign({},opt,{
    vx:Math.cos(a)*sp+(opt.vx||0), vy:Math.sin(a)*sp+(opt.vy||0),
    life:rand((opt.life||0.5)*0.6,(opt.life||0.5)*1.3)
  }));
}}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i];
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.grav*dt;
    p.rot+=p.vrot*dt; p.life-=dt;
    if(p.life<=0) particles.splice(i,1); }
}
function drawParticles(ctx,camX,camY){
  for(const p of particles){
    const t=1-p.life/p.maxLife;          // 0→1 生命周期进度
    const r=lerp(p.r0,p.r1,t);            // 膨胀
    const alpha=p.life<0.15?p.life/0.15:1;// 淡出
    ctx.save();
    ctx.globalAlpha=alpha*(p.glow?0.9:0.85);
    ctx.translate(p.x-camX,p.y-camY);
    ctx.rotate(p.rot);
    ctx.fillStyle=p.color;
    if(p.shape==="spark"){ ctx.fillRect(-r,-r*0.35,r*2,r*0.7); }
    else if(p.shape==="ring"){ ctx.strokeStyle=p.color; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke(); }
    else if(p.shape==="shard"){ ctx.beginPath(); ctx.moveTo(0,-r);
      ctx.lineTo(r*0.5,r*0.6); ctx.lineTo(-r*0.5,r*0.6); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); }
    if(p.glow){ ctx.globalAlpha=alpha*0.35; ctx.beginPath();
      ctx.arc(0,0,r*1.8,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill(); }
    ctx.restore();
  }
}
