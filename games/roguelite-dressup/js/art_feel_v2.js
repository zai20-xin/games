// ===== v0.13 商业化手感三件套（对标 Vampire Survivors / Hades 的共性）=====
// 调研结论：商业成功 = 可读性 + 反馈密度 + 角色辨识度，而非高保真。
// 本文件实现：
//   A) 敌人死亡残骸动画（不再瞬间消失）→ VS 式割草满足感
//   B) 玩家受击闪白+红脉冲 → 可读性（在 art_life_v2.js）
//   C) 技能弹体旋转/脉动生命感 → Hades 式活力（在 art_life_v2.js）

var corpses=[];   // var 使其进入 vm 沙箱全局，测试可读取
const CORPSE_TTL=0.9;

window.spawnCorpse=function(e){
  while(corpses.length>=40)corpses.shift();   // 上限保护：最多40具
  corpses.push({x:e.x,y:e.y,r:e.r,color:e.color,type:e.type,
    t:CORPSE_TTL,vx:rand(-60,60),vy:rand(-90,-30),vr:rand(-6,6),rot:0,
    squash:1});
};

// 更新+绘制挂到 render 尾部（render 定义在 main.js，此处覆写时其尚未执行——安全）
const __origRender=render;
window.render=function(){
  // 残骸更新：用真实帧间隔（lastDt 由主循环维护）
  for(let i=corpses.length-1;i>=0;i--){
    const c=corpses[i];c.t-=lastDt;
    c.x+=c.vx*lastDt;c.y+=c.vy*lastDt;
    c.vy+=260*lastDt;               // 小重力
    c.vx*=0.94;c.vy*=0.96;
    c.rot+=c.vr*lastDt;
    if(c.t<=0){corpses.splice(i,1);continue;}
    const x=c.x-cam.x,y=c.y-cam.y;
    if(x<-80||y<-80||x>VIEW_W+80||y>VIEW_H+80)continue;
    ctx.save();
    ctx.translate(x,y);
    ctx.globalAlpha=Math.min(1,c.t/CORPSE_TTL*1.4);
    ctx.rotate(c.rot);
    // 压扁的尸体色块（按类型微调形状）
    ctx.fillStyle=c.color;
    ctx.strokeStyle="rgba(36,26,46,.55)";
    ctx.lineWidth=1.6;
    const r=c.r*(0.75+c.t/CORPSE_TTL*0.35);
    if(c.type==="bat"){
      ctx.beginPath();ctx.ellipse(0,0,r*1.3,r*.45,0,0,7);ctx.fill();ctx.stroke();
    } else if(c.type==="golem"){
      ctx.beginPath();ctx.roundRect(-r,-r*.7,r*2,r*1.4,4);ctx.fill();ctx.stroke();
    } else {
      ctx.beginPath();ctx.ellipse(0,0,r,r*.62,0,0,7);ctx.fill();ctx.stroke();
      // X 眼
      ctx.strokeStyle="#241a2e";ctx.lineWidth=1.4;
      for(const s of[-1,1]){
        ctx.beginPath();
        ctx.moveTo(s*r*.3-2,-r*.15);ctx.lineTo(s*r*.3+2,r*.18);
        ctx.moveTo(s*r*.3+2,-r*.15);ctx.lineTo(s*r*.3-2,r*.18);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  __origRender();
};

// 敌人死亡时由 enemies.js 死亡分支直接调用 spawnCorpse
