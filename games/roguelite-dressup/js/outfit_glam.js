// ===== 时装华丽层 Glamour Layer =====
// 目标：把「换装」的爽感拉满——每套时装都有一套夸张、华丽、一眼可辨的常驻视觉层。
//   novice 幸运微光 / flame 烈焰华彩 / frost 霜华领域
//   storm  过载雷霆 / shadow 暗影残华 / holy  圣辉天翼
// 遵守美术规范（DESIGN.md §7）：
//   1) 所有粒子走统一粒子系统，「生成→膨胀→消散」三段生命周期，禁止瞬消；
//   2) 直接绘制元素（翅膀/法阵/闪电/残影/圣光）全部自带透明度呼吸与淡出；
//   3) 带发射预算与粒子上限保护，怪潮高峰不拖帧；玩家出视野时整层跳过。
//
// 对外 API：
//   GLAM_DEFS                 六套时装华丽层定义表（id 对齐 config.js 的 OUTFITS）
//   initGlam(player)          开局/重开绑定华丽层（startGame 内调用；漏调也会自愈）
//   updateGlam(dt)            每帧推进：计时器、粒子发射、轨迹/闪电等状态更新
//   drawGlamBack(ctx,cx,cy)   玩家身后层：光环/翅膀/法阵/残影/圣光束（player.draw 之前调用）
//   drawGlamFront(ctx,cx,cy)  玩家身前层：环绕晶体/头顶光环/星芒/花瓣（player.draw 之后调用）
//   glamBurst(power)          「变身时刻」全屏爆发（开局入场 / 可挂接升级、魔镜换装）
//   getGlamInfo()             调试与无头测试内省

'use strict';

// ---- 全局参数 ----
const GLAM_SOFT_CAP = 520;   // 粒子超过此数 → 环境发射减半
const GLAM_HARD_CAP = 820;   // 超过此数 → 华丽层暂停环境发射（技能特效优先）
const GLAM_TRAIL_MAX = 9;    // 暗影残影历史长度
const GLAM_BURST_N = 42;     // 变身爆发基础粒子数

let glamState = null;        // 当前华丽层运行时状态

// ---- 六套时装华丽层定义表 ----
// palette: 主视觉色板（粒子与描边共用）；rate: 各类环境粒子每秒发射数
const GLAM_DEFS = {
  // 见习冒险家 ·「幸运微光」：脚下绿金呼吸光 + 三叶草碎星 + 金币十字星芒
  novice: {
    label: "幸运微光",
    palette: ["#c9e86a", "#7ed957", "#ffd700"],
    rate: { ambient: 6, pulse: 0.45 },
    pulseEvery: 2.2,
  },
  // 烈焰舞裙 ·「烈焰华彩」：双焰翼扇形抖动 + 火星风暴上腾 + 周期火环新星
  flame: {
    label: "烈焰华彩",
    palette: ["#ff6b35", "#ffb347", "#ff5c5c", "#ff8c42"],
    rate: { ambient: 26, pulse: 0.55 },
    pulseEvery: 1.8,
  },
  // 寒霜斗篷 ·「霜华领域」：六重冰晶法阵反向旋转 + 环绕雪花晶体 + 寒霜脉冲
  frost: {
    label: "霜华领域",
    palette: ["#bfe9ff", "#7ec8e3", "#ffffff", "#9adcf0"],
    rate: { ambient: 14, pulse: 0.45 },
    pulseEvery: 2.2,
  },
  // 雷霆战衣 ·「过载雷霆」：全身爬行电弧 + 抖动电晕环 + 过载落雷立柱
  storm: {
    label: "过载雷霆",
    palette: ["#ffd93d", "#fffbe0", "#ffd700", "#b06ad4"],
    rate: { ambient: 16, pulse: 0.36 },
    pulseEvery: 2.8,
  },
  // 暗影夜行衣 ·「暗影残华」：多段残影分身 + 紫雾上升 + 虚空绽裂 + 飘落魔瓣
  shadow: {
    label: "暗影残华",
    palette: ["#b06ad4", "#8a4fbf", "#5a3280", "#d24bd0"],
    rate: { ambient: 18, pulse: 0.42, petal: 0.8 },
    pulseEvery: 2.4,
  },
  // 圣辉礼服 ·「圣辉天翼」：金色羽翼呼吸扇动 + 旋转光环与星饰 + 天光束 + 圣辉雨
  holy: {
    label: "圣辉天翼",
    palette: ["#ffe66d", "#ffd700", "#fff8dc", "#ffffff"],
    rate: { ambient: 12, pulse: 0.33 },
    pulseEvery: 3.0,
  },
};

function glamDefFor(outfitId){
  return GLAM_DEFS[outfitId] || GLAM_DEFS.novice;
}

// ---- 初始化 / 自愈 ----
function initGlam(player){
  const id = (player && player.outfit && player.outfit.id) || "novice";
  glamState = {
    id: id,
    def: glamDefFor(id),
    playerRef: player || null,
    t: 0,                    // 华丽层内部时钟（驱动所有呼吸/旋转相位）
    emitAcc: 0,              // 环境粒子发射累加器
    pulseT: 0,               // 周期大招倒计时
    trailT: 0,               // 残影采样节流
    trail: [],               // 暗影残影 [{x,y,dir}]
    bolts: [], boltT: 0,     // 雷霆电弧 [{pts:[{x,y}],col,lw}]
    pillarT: -1,             // 过载落雷柱剩余时间
    glints: [], glintT: 0,   // 新手金币星芒 [{dx,dy,t}]
    petals: [], petalT: 0,   // 暗影魔瓣 [{x,y,vx,vy,rot,vr,t,dur}]
    orbitA: 0,               // 冰晶环绕角
    burstT: 99,              // 入场爆发后的余晖计时
    emittedTotal: 0,         // 统计：本局华丽层累计发射粒子数（测试用）
  };
  return glamState;
}

function ensureGlam(){       // 自愈：startGame 忘了 initGlam 或中途重开也能工作
  if(!glamState || !glamState.playerRef || glamState.playerRef !== player)
    initGlam(player);
  return glamState;
}

// ---- 发射保护 ----
function glamEmit(opt){
  if(particles.length >= GLAM_HARD_CAP) return false;
  if(particles.length > GLAM_SOFT_CAP && Math.random() < 0.5) return false;
  spawnParticle(glamState.playerRef.x, glamState.playerRef.y, opt);
  glamState.emittedTotal++;
  return true;
}

// ================= 每帧更新 =================
function updateGlam(dt){
  const s = ensureGlam();
  if(!s.playerRef) return;
  s.t += dt;
  s.burstT += dt;
  const o = s.playerRef;

  // -- 环境粒子（按定义速率发射）--
  s.emitAcc += dt * s.def.rate.ambient;
  while(s.emitAcc >= 1){ s.emitAcc -= 1; emitAmbient(s, o); }

  // -- 周期性小大招 --
  s.pulseT += dt;
  if(s.pulseT >= s.def.pulseEvery){ s.pulseT = 0; doPulse(s, o); }

  // -- 时装专属状态推进 --
  if(s.id === "shadow"){
    // 残影轨迹采样（移动时节流记录，静止时逐渐衰减）
    s.trailT -= dt;
    if(o.moving && s.trailT <= 0){
      s.trailT = 0.05;
      s.trail.push({ x:o.x, y:o.y, dir:o.faceDir });
      if(s.trail.length > GLAM_TRAIL_MAX) s.trail.shift();
    } else if(!o.moving && s.trail.length > 0 && s.t % 0.12 < dt){
      s.trail.shift();   // 站定时残影慢慢散去
    }
    // 魔瓣飘落
    s.petalT -= dt;
    if(s.petalT <= 0){
      s.petalT = 1 / s.def.rate.petal;
      s.petals.push({ x:o.x+rand(-20,20), y:o.y-24+rand(-6,10),
        vx:rand(-12,12), vy:rand(22,40), rot:rand(0,6.28), vr:rand(-4,4),
        t:0, dur:rand(1.1,1.6) });
    }
    for(let i=s.petals.length-1;i>=0;i--){
      const p=s.petals[i]; p.t+=dt;
      p.x+=p.vx*dt + Math.sin((p.t)*6+p.rot)*24*dt;
      p.y+=p.vy*dt; p.rot+=p.vr*dt;
      if(p.t>=p.dur) s.petals.splice(i,1);
    }
  }
  if(s.id === "storm"){
    // 电弧每 0.09s 重新生成一簇锯齿折线
    s.boltT -= dt;
    if(s.boltT <= 0){
      s.boltT = 0.09;
      s.bolts = makeBolts(2 + randInt(0,1));
    }
    if(s.pillarT > 0) s.pillarT -= dt;
  }
  if(s.id === "frost"){
    s.orbitA += dt * 1.9;    // 环绕冰晶公转
  }
  if(s.id === "novice"){
    // 金币星芒
    s.glintT -= dt;
    if(s.glintT <= 0){
      s.glintT = s.def.pulseEvery * rand(0.75,1.25);
      s.glints.push({ dx:rand(-15,15), dy:rand(-30,-4), t:0 });
    }
    for(let i=s.glints.length-1;i>=0;i--){ const g=s.glints[i]; g.t+=dt; if(g.t>0.5) s.glints.splice(i,1); }
  }
}

// 各时装环境粒子形态
function emitAmbient(s, o){
  const pal = s.def.palette;
  switch(s.id){
    case "novice":  // 三叶草碎星缓缓上升
      glamEmit({ x:o.x+rand(-13,13), y:o.y+rand(-4,14),
        vx:rand(-4,4), vy:-rand(14,26), r0:2, r1:0.4, life:rand(0.8,1.3),
        color:pick(pal.slice(0,2)), shape:"shard", vrot:rand(-3,3), glow:true });
      break;
    case "flame":   // 火星风暴：裙摆两侧上腾
      glamEmit({ x:o.x-this0(s)-0+rand(-11,11)+ (Math.random()<0.5?-8:8)*0 , y:o.y+rand(4,14),
        vx:rand(-14,14), vy:-rand(50,120), r0:3, r1:0.6, life:rand(0.45,0.9),
        color:pick(pal), shape:"circle", glow:true });
      break;
    case "frost":   // 细雪飘坠微光
      glamEmit({ x:o.x+rand(-22,22), y:o.y-rand(6,26),
        vx:rand(-8,8), vy:rand(18,32), r0:1.6, r1:0.3, life:rand(0.7,1.2),
        color:pick(pal), shape:"circle", glow:true });
      break;
    case "storm":   // 随机角度迸出的金色火花
      glamEmit({ x:o.x+rand(-10,10), y:o.y+rand(-18,10),
        vx:rand(-70,70), vy:rand(-90,-20), grav:160,
        r0:2.2, r1:0.4, life:rand(0.25,0.5),
        color:pick(pal.slice(0,3)), shape:"spark", glow:true });
      break;
    case "shadow":  // 紫雾袅袅
      glamEmit({ x:o.x+rand(-10,10), y:o.y+rand(-2,12),
        vx:rand(-16,16), vy:-rand(26,48), r0:3.5, r1:12, life:rand(0.5,0.85),
        color:"rgba(122,64,182,0.38)", shape:"circle" });
      break;
    case "holy":    // 圣辉雨：金尘缓落 + 偶尔白色羽毛碎片
      if(Math.random()<0.82)
        glamEmit({ x:o.x+rand(-20,20), y:o.y-rand(10,26),
          vx:rand(-5,5), vy:rand(20,34), r0:1.8, r1:0.4, life:rand(0.7,1.2),
          color:pick(pal.slice(0,2)), shape:"circle", glow:true });
      else
        glamEmit({ x:o.x+this0(s)+rand(-16,16), y:o.y-22,
          vx:rand(-8,8), vy:rand(14,24), r0:2.6, r1:1.2, life:rand(1.0,1.5),
          color:"#fff8dc", shape:"shard", vrot:rand(-2.5,2.5) });
      break;
  }
}
function this0(){ return 0; }   // 兼容占位（保留表达式可读性）

// 周期性小大招
function doPulse(s, o){
  const pal = s.def.palette;
  switch(s.id){
    case "novice":
      burst(o.x,o.y+8,6,{ r0:2,r1:5,life:0.6,color:"#ffd700",shape:"shard",
        spdMin:20,spdMax:60,vy:-30,glow:true,vrot:4 });
      break;
    case "flame": { // 烈焰新星：双层火环 + 外抛火星
      spawnParticle(o.x,o.y+8,{ r0:8,r1:46,life:0.45,color:pal[0],shape:"ring" });
      spawnParticle(o.x,o.y+8,{ r0:4,r1:30,life:0.35,color:pal[1],shape:"ring" });
      burst(o.x,o.y+6,10,{ r0:3,r1:0.5,life:0.5,color:pick(pal),shape:"spark",
        spdMin:90,spdMax:210,vy:-40,glow:true });
      break; }
    case "frost": { // 寒霜脉冲：扩散白环 + 雾团
      spawnParticle(o.x,o.y+8,{ r0:6,r1:44,life:0.55,color:"#eaf9ff",shape:"ring" });
      for(let i=0;i<4;i++)
        spawnParticle(o.x+rand(-18,18),o.y+rand(0,14),
          { r0:5,r1:18,life:rand(0.5,0.8),color:"rgba(190,230,255,0.45)",vx:rand(-14,14) });
      break; }
    case "storm": { // 过载落雷：立柱闪光 + 屏幕轻震 + 环形电圈
      s.pillarT = 0.28;
      spawnParticle(o.x,o.y-4,{ r0:5,r1:36,life:0.3,color:pal[0],shape:"ring" });
      burst(o.x,o.y-6,8,{ r0:2.4,r1:0.4,life:0.4,color:pal[0],shape:"spark",
        spdMin:110,spdMax:240,glow:true });
      if(typeof Shake!=="undefined") Shake.add(2);
      break; }
    case "shadow": { // 虚空绽裂：紫环 + 暗晶四溅
      spawnParticle(o.x,o.y+6,{ r0:4,r1:38,life:0.5,color:pal[0],shape:"ring" });
      burst(o.x,o.y+4,10,{ r0:3.4,r1:0.6,life:0.55,color:pick(pal),shape:"shard",
        spdMin:60,spdMax:170,glow:true,vrot:5 });
      break; }
    case "holy": {  // 圣愈祝福：宽金环 + 头顶十字圣印
      spawnParticle(o.x,o.y+8,{ r0:8,r1:52,life:0.7,color:pal[0],shape:"ring" });
      s.crossT = 0;   // 触发前层十字圣印动画
      break; }
  }
}

// 雷霆电弧折线生成（相对玩家锚点的锯齿路径）
function makeBolts(n){
  const bolts=[];
  for(let i=0;i<n;i++){
    const a=rand(0,Math.PI*2), len=rand(15,27);
    let px=Math.cos(a)*6, py=Math.sin(a)*6 - 6;
    const pts=[{x:px,y:py}];
    const segs=4, nx=-Math.sin(a), ny=Math.cos(a);
    for(let k=1;k<=segs;k++){
      const t=k/segs, off=rand(-4.5,4.5)*(1-t*0.4);
      pts.push({ x:Math.cos(a)*len*t+nx*off, y:Math.sin(a)*len*t+ny*off-6 });
    }
    bolts.push({ pts:pts, col:(i%2===0)?"#fffbe0":"#ffd93d", lw:rand(1.6,2.6) });
  }
  return bolts;
}

// ================= 绘制：身后层 =================
function drawGlamBack(ctx, camX, camY){
  const s = ensureGlam();
  const o = s.playerRef; if(!o) return;
  const px=o.x-camX, py=o.y-camY;
  // 出视野裁剪
  if(px<-90||px>VIEW_W+90||py<-100||py>VIEW_H+90) return;

  switch(s.id){
    case "novice":  drawNoviceBack(ctx,s,px,py); break;
    case "flame":   drawFlameBack(ctx,s,px,py);  break;
    case "frost":   drawFrostBack(ctx,s,px,py);  break;
    case "storm":   drawStormBack(ctx,s,px,py);  break;
    case "shadow":  drawShadowBack(ctx,s,px,py,camX,camY); break;
    case "holy":    drawHolyBack(ctx,s,px,py);   break;
  }
}

// -- 新手：脚下呼吸绿金光晕 --
function drawNoviceBack(ctx,s,px,py){
  const k=0.5+0.5*Math.sin(s.t*2.4);
  ctx.save();
  ctx.translate(px,py+12);
  ctx.fillStyle="rgba(126,217,87,"+(0.10+k*0.08).toFixed(3)+")";
  ctx.beginPath(); ctx.ellipse(0,0,19+k*4,7.5+k*1.6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(201,232,106,"+(0.08+k*0.07).toFixed(3)+")";
  ctx.beginPath(); ctx.ellipse(0,0,26+k*6,10+k*2,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// -- 烈焰：背后双焰翼（三舌贝塞尔火舌 × 抖动）--
function drawFlameBack(ctx,s,px,py){
  const cols=["#ffb347","#ff6b35","#e04a3a"];
  for(const side of [-1,1]){
    for(let i=0;i<3;i++){
      const wob=Math.sin(s.t*(11+i*2.6)+side*1.3+i)*0.10;
      const a=-Math.PI/2 + side*(0.52+i*0.40) + wob;
      const L=(23-i*4)+Math.sin(s.t*15+i*2+side)*3;
      const bx=side*-3, by=-4;                       // 肩部锚点
      const tx=bx+Math.cos(a)*L, ty=by+Math.sin(a)*L;
      const w=6.5-i*1.1;                             // 火舌半宽
      const mx=bx+Math.cos(a)*L*0.45, my=by+Math.sin(a)*L*0.45;
      const nx=-Math.sin(a), ny=Math.cos(a);
      ctx.save();
      ctx.globalAlpha=0.85-i*0.22;
      ctx.fillStyle=cols[i];
      ctx.beginPath();
      ctx.moveTo(bx+nx*w,by+ny*w);
      ctx.quadraticCurveTo(mx+nx*w*1.5,my+ny*w*1.5,tx,ty);
      ctx.quadraticCurveTo(mx-nx*w*1.5,my-ny*w*1.5,bx-nx*w,by-ny*w);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  // 裙底火焰呼吸环
  const k=0.5+0.5*Math.sin(s.t*5);
  ctx.save();
  ctx.strokeStyle="rgba(255,140,66,"+(0.30+k*0.25).toFixed(3)+")";
  ctx.lineWidth=2.5+k*1.5;
  ctx.beginPath(); ctx.ellipse(px,py+12,17+k*3,6.5,0,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

// -- 寒霜：地面六重冰晶法阵（双向旋转）--
function drawFrostBack(ctx,s,px,py){
  ctx.save();
  ctx.translate(px,py+11);
  // 外虚线圈（正向旋转）
  ctx.save(); ctx.rotate(s.t*0.55);
  ctx.strokeStyle="rgba(170,225,255,0.50)"; ctx.lineWidth=2;
  ctx.setLineDash([7,5]);
  ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  // 内实线圈（反向）
  ctx.strokeStyle="rgba(200,240,255,0.30)"; ctx.lineWidth=1.4;
  ctx.save(); ctx.rotate(-s.t*0.8);
  ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.stroke();
  // 六辐条 + 尖端菱晶
  ctx.strokeStyle="rgba(190,235,255,0.55)"; ctx.lineWidth=1.8;
  for(let k=0;k<6;k++){
    const a=k*Math.PI/3;
    const cx=Math.cos(a), cy=Math.sin(a);
    ctx.beginPath(); ctx.moveTo(cx*8,cy*8); ctx.lineTo(cx*27,cy*27); ctx.stroke();
    ctx.save(); ctx.translate(cx*29,cy*29); ctx.rotate(a);
    ctx.fillStyle="rgba(230,248,255,0.65)";
    ctx.beginPath(); ctx.moveTo(3.4,0); ctx.lineTo(0,2.2); ctx.lineTo(-3.4,0); ctx.lineTo(0,-2.2);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // 内六边形
  ctx.strokeStyle="rgba(220,245,255,0.35)"; ctx.lineWidth=1.2;
  ctx.beginPath();
  for(let k=0;k<=6;k++){ const a=k*Math.PI/3+s.t*0.3;
    const X=Math.cos(a)*13,Y=Math.sin(a)*13; k===0?ctx.moveTo(X,Y):ctx.lineTo(X,Y); }
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // 地面寒气薄雾（大而淡的椭圆）
  const k=0.5+0.5*Math.sin(s.t*1.6);
  ctx.fillStyle="rgba(158,216,240,"+(0.05+k*0.05).toFixed(3)+")";
  ctx.beginPath(); ctx.ellipse(px,py+11,34+k*5,13,0,0,Math.PI*2); ctx.fill();
}

// -- 雷霆：抖动电晕环 + 过载落雷立柱 --
function drawStormBack(ctx,s,px,py){
  // 电晕环：分段随机亮度闪烁
  const R=23;
  for(let k=0;k<12;k++){
    const a0=k*Math.PI/6, a1=a0+Math.PI/6*0.86;
    ctx.strokeStyle="rgba(255,217,61,"+(0.18+Math.random()*0.42).toFixed(3)+")";
    ctx.lineWidth=2+Math.random()*2;
    ctx.beginPath(); ctx.arc(px,py-6,R+rand(-1.5,1.5),a0,a1); ctx.stroke();
  }
  // 爬行电弧（双层：粗淡 + 细亮）
  for(const b of s.bolts){
    ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.strokeStyle="rgba(176,106,212,0.30)"; ctx.lineWidth=b.lw*3;
    ctx.beginPath();
    for(let i=0;i<b.pts.length;i++) i===0?ctx.moveTo(px+b.pts[i].x,py+b.pts[i].y):ctx.lineTo(px+b.pts[i].x,py+b.pts[i].y);
    ctx.stroke();
    ctx.strokeStyle=b.col; ctx.lineWidth=b.lw;
    ctx.beginPath();
    for(let i=0;i<b.pts.length;i++) i===0?ctx.moveTo(px+b.pts[i].x,py+b.pts[i].y):ctx.lineTo(px+b.pts[i].x,py+b.pts[i].y);
    ctx.stroke();
  }
  // 过载落雷立柱
  if(s.pillarT>0){
    const f=s.pillarT/0.28;                        // 1→0
    ctx.save();
    ctx.globalAlpha=f*0.55;
    ctx.fillStyle="#ffd93d";
    ctx.fillRect(px-6,py-78,12,84);
    ctx.globalAlpha=f*0.9;
    ctx.fillStyle="#fffbe0";
    ctx.fillRect(px-2.2,py-74,4.4,80);
    ctx.restore();
  }
}

// -- 暗影：残影分身队列（旧→新，透明度递增）--
function drawShadowBack(ctx,s,px,py,camX,camY){
  const n=s.trail.length;
  for(let i=0;i<n;i++){
    const g=s.trail[i];
    const age=(i+1)/n;                             // 越新越实
    const alpha=0.30*age;
    ctx.save();
    ctx.translate(g.x-camX,g.y-camY);
    ctx.scale(g.dir,1);
    ctx.globalAlpha=alpha;
    ctx.fillStyle="#b06ad4";
    ctx.beginPath(); ctx.arc(0,-12,10,0,Math.PI*2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-7,-3); ctx.quadraticCurveTo(-9,8,-7,13);
    ctx.lineTo(7,13); ctx.quadraticCurveTo(9,8,7,-3);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// -- 圣辉：金色羽翼（每侧 5 根羽毛扇形排布，呼吸+扑动）+ 旋转天光束 --
function drawHolyBack(ctx,s,px,py){
  const breathe=1+0.06*Math.sin(s.t*1.7);
  const flap=Math.sin(s.t*2.6)*0.10;
  for(const side of [-1,1]){
    ctx.save();
    ctx.translate(px-side*3,py-9);
    ctx.scale(side*breathe,breathe);
    for(let j=0;j<5;j++){
      const a=-Math.PI/2+(0.30+j*0.185)+flap+j*flap*0.35;
      const L=(27-j*2.6)*(1-flap*side*0.4);
      const cx=Math.cos(a)*L*0.55, cy=Math.sin(a)*L*0.55;
      ctx.save();
      ctx.translate(cx,cy);
      ctx.rotate(a+Math.PI/2);
      ctx.globalAlpha=0.88-j*0.09;
      ctx.fillStyle=j%2===0?"#fff8dc":"#ffe9a8";
      ctx.beginPath(); ctx.ellipse(0,0,L*0.52,3.1-j*0.28,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="rgba(255,215,0,0.5)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.ellipse(0,0,L*0.52,3.1-j*0.28,0,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  // 天光束：6 道缓慢旋转的金色楔形
  ctx.save();
  ctx.translate(px,py-6);
  for(let k=0;k<6;k++){
    const a=k*Math.PI/3+s.t*0.12;
    ctx.fillStyle="rgba(255,230,150,0.07)";
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(a-0.055)*72,Math.sin(a-0.055)*72);
    ctx.lineTo(Math.cos(a+0.055)*72,Math.sin(a+0.055)*72);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ================= 绘制：身前层 =================
function drawGlamFront(ctx, camX, camY){
  const s = ensureGlam();
  const o = s.playerRef; if(!o) return;
  const px=o.x-camX, py=o.y-camY;
  if(px<-90||px>VIEW_W+90||py<-100||py>VIEW_H+90) return;

  switch(s.id){
    case "novice":  drawNoviceFront(ctx,s,px,py); break;
    case "frost":   drawFrostFront(ctx,s,px,py);  break;
    case "storm":   drawStormFront(ctx,s,px,py);  break;
    case "shadow":  drawShadowFront(ctx,s,px,py,camX,camY); break;
    case "holy":    drawHolyFront(ctx,s,px,py);   break;
    case "flame":   drawFlameFront(ctx,s,px,py);  break;
  }
}

// -- 新手：金币十字星芒 --
function drawNoviceFront(ctx,s,px,py){
  for(const g of s.glints){
    const f=g.t/0.5, sc=0.5+f*1.4, al=(1-f);
    const gx=px+g.dx, gy=py+g.dy;
    ctx.save();
    ctx.translate(gx,gy); ctx.scale(sc,sc);
    ctx.globalAlpha=al;
    ctx.strokeStyle="#ffd700"; ctx.lineWidth=1.6; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,6);
    ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.stroke();
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-3,-3); ctx.lineTo(3,3);
    ctx.moveTo(3,-3); ctx.lineTo(-3,3); ctx.stroke();
    ctx.restore();
  }
}

// -- 烈焰：头顶热浪扭曲点（少量、克制，保证技能读得清）--
function drawFlameFront(ctx,s,px,py){
  for(let k=0;k<3;k++){
    const a=s.t*2.2+k*2.09;
    const rx=Math.cos(a)*15, ry=-20+Math.sin(a*1.7)*5;
    ctx.save();
    ctx.globalAlpha=0.5+0.3*Math.sin(s.t*9+k*2);
    ctx.fillStyle="#ffb347";
    ctx.beginPath(); ctx.arc(px+rx,py+ry,1.8,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// -- 寒霜：公转环绕雪晶（六角小星星）--
function drawFrostFront(ctx,s,px,py){
  for(let k=0;k<5;k++){
    const a=s.orbitA+k*(Math.PI*2/5);
    const rx=px+Math.cos(a)*(21+3*Math.sin(s.t*2+k));
    const ry=py-4+Math.sin(a)*9;
    const sz=2.4+0.7*Math.sin(s.t*5+k*1.4);
    ctx.save();
    ctx.translate(rx,ry); ctx.rotate(s.t*1.4+k);
    ctx.strokeStyle="rgba(235,250,255,0.9)"; ctx.lineWidth=1.2; ctx.lineCap="round";
    for(let j=0;j<3;j++){
      const b=j*Math.PI/3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(b)*sz,Math.sin(b)*sz);
      ctx.lineTo(-Math.cos(b)*sz,-Math.sin(b)*sz);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// -- 雷霆：胸口过载核心闪光 --
function drawStormFront(ctx,s,px,py){
  const k=0.5+0.5*Math.sin(s.t*8);
  ctx.save();
  ctx.globalAlpha=0.55+k*0.4;
  ctx.fillStyle="#fffbe0";
  ctx.beginPath(); ctx.arc(px,py-2,3.2+k*1.4,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=(0.55+k*0.4)*0.4;
  ctx.beginPath(); ctx.arc(px,py-2,(3.2+k*1.4)*2.1,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// -- 暗影：飘落魔瓣 --
function drawShadowFront(ctx,s,px,py,camX,camY){
  for(const p of s.petals){
    const al=Math.min(1,(1-p.t/p.dur)*1.6)*0.8;
    ctx.save();
    ctx.translate(p.x-camX,p.y-camY);
    ctx.rotate(p.rot);
    ctx.globalAlpha=al;
    ctx.fillStyle="#d24bd0";
    ctx.beginPath(); ctx.ellipse(0,0,3.4,1.7,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// -- 圣辉：头顶旋转光环（双环 + 三颗星饰）+ 十字圣印 --
function drawHolyFront(ctx,s,px,py){
  const hy=py-27;
  ctx.save();
  ctx.translate(px,hy);
  // 主环
  ctx.strokeStyle="rgba(255,215,0,0.95)"; ctx.lineWidth=2.4;
  ctx.beginPath(); ctx.ellipse(0,0,12.5,4.4,0,0,Math.PI*2); ctx.stroke();
  // 旋转刻度环
  ctx.strokeStyle="rgba(255,230,109,0.5)"; ctx.lineWidth=1.3;
  ctx.setLineDash([4,6]); ctx.lineDashOffset=-s.t*26;
  ctx.beginPath(); ctx.ellipse(0,0,16.5,5.8,0,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  // 三颗轨道星饰
  for(let k=0;k<3;k++){
    const a=s.t*2+k*Math.PI*2/3;
    const sx=Math.cos(a)*16.5, sy=Math.sin(a)*5.8;
    ctx.fillStyle="#fffbe0";
    ctx.beginPath(); ctx.arc(sx,sy,1.7,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  // 十字圣印（祝福脉冲触发后 0.55s 动画）
  if(typeof s.crossT==="number" && s.crossT<0.55){
    s.crossT+=1/60;                                // 无 dt 上下文，用固定步长近似
    const f=Math.max(0,s.crossT/0.55);
    const sc=(0.6+f*1.6), al=(1-f);
    ctx.save();
    ctx.translate(px,hy-8); ctx.scale(sc,sc);
    ctx.globalAlpha=al;
    ctx.strokeStyle="#ffe66d"; ctx.lineWidth=2; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(0,5);
    ctx.moveTo(-3.4,-1.4); ctx.lineTo(3.4,-1.4); ctx.stroke();
    ctx.restore();
  }
}

// ================= 「变身时刻」全屏爆发 =================
function glamBurst(power){
  const s=ensureGlam();
  const o=s.playerRef; if(!o) return 0;
  const p=power==null?1:power;
  const pal=s.def.palette;
  let n=0;
  for(let i=0;i<GLAM_BURST_N*p;i++){
    const a=rand(0,Math.PI*2), sp=rand(70,300)*p;
    if(glamEmit({ x:o.x,y:o.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      r0:rand(2,4.5), r1:0.4, life:rand(0.4,0.9),
      color:pick(pal), shape:Math.random()<0.5?"spark":"circle",
      glow:true })) n++;
  }
  spawnParticle(o.x,o.y,{ r0:6,r1:70*p,life:0.55,color:pal[0],shape:"ring" });
  spawnParticle(o.x,o.y,{ r0:3,r1:46*p,life:0.4,color:pal[1]||pal[0],shape:"ring" });
  if(typeof Shake!=="undefined") Shake.add(3*p);
  s.burstT=0;
  return n+2;
}

// ---- 测试/调试内省 ----
function getGlamInfo(){
  if(!glamState) return null;
  return {
    id:glamState.id, label:glamState.def.label, t:+glamState.t.toFixed(3),
    bound:!!glamState.playerRef,
    trail:glamState.trail.length, bolts:glamState.bolts.length,
    glints:glamState.glints.length, petals:glamState.petals.length,
    emittedTotal:glamState.emittedTotal,
    particles:particles.length,
  };
}
