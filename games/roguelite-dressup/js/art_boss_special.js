// ===== v0.9 专属Boss绘制：寒霜巨像 / 影武者（含分身）+ 新弹种 =====
(function(){
const OUT="#241a2e";
const __orig=drawEnemies;

window.drawEnemies=function(ctx,camX,camY){
  const t=performance.now()/1000;
  // ---- L3 影武者分身先画（在Boss下层）----
  for(const e of enemies){
    if(e.isBoss&&e.challenge&&e.clones){
      for(const c of e.clones){
        const x=c.x-camX,y=c.y-camY;
        if(x<-80||y<-80||x>VIEW_W+80||y>VIEW_H+80)continue;
        ctx.save();ctx.translate(x,y);
        ctx.globalAlpha=Math.min(.75,.3+c.t*.12);
        // 分身剪影
        ctx.fillStyle="#5a3280";ctx.strokeStyle="rgba(36,26,46,.8)";ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(0,-6,15,0,7);ctx.fill();ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9,-16);ctx.lineTo(0,-30);ctx.lineTo(9,-16);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.roundRect(-10,-4,20,22,7);ctx.fill();ctx.stroke();
        // 紫眼
        ctx.fillStyle="#d24bd0";
        for(const s of[-1,1]){ctx.beginPath();ctx.arc(s*5,-8,2.2,0,7);ctx.fill();}
        ctx.restore();
      }
    }
  }
  __orig(ctx,camX,camY);
  // ---- 挑战Boss专属造型覆画（在通用Boss之上）----
  for(const e of enemies){
    if(!e.isBoss||!e.challenge)continue;
    const kind=(e===enemies.find(bb=>bb.isBoss))?window.__challengeBossKind:null;
    if(!kind)continue;
    const x=e.x-camX,y=e.y-camY;
    if(x<-120||y<-120||x>VIEW_W+120||y>VIEW_H+120)continue;
    ctx.save();ctx.translate(x,y);
    if(kind==="frost")drawFrostColossus(ctx,e,t);
    else if(kind==="shadow")drawShadowBlade(ctx,e,t);
    ctx.restore();
  }
};

// ---- 寒霜巨像：冰晶装甲巨人体 ----
function drawFrostColossus(ctx,e,t){
  const R=e.r*1.25;   // 更魁梧
  const bob=Math.sin(t*1.4)*2.5;
  ctx.translate(0,bob);
  ctx.lineJoin="round";
  // 背后冰晶翼
  for(const s of[-1,1]){
    ctx.fillStyle=s<0?"rgba(165,227,247,.5)":"rgba(205,238,253,.42)";
    ctx.strokeStyle=OUT;ctx.lineWidth=2;
    const sway=Math.sin(t*(e.phase>=3?6:3)+s)*.08;
    ctx.save();ctx.rotate(s*.35+sway);
    ctx.beginPath();ctx.moveTo(s*R*.3,-R*.3);
    ctx.lineTo(s*R*.95,-R*1.05);ctx.lineTo(s*R*.55,R*.15);
    ctx.closePath();ctx.fill();ctx.stroke();
    // 冰晶内纹
    ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=1.3;
    ctx.beginPath();ctx.moveTo(s*R*.45,-R*.45);ctx.lineTo(s*R*.72,-R*.72);ctx.stroke();
    ctx.restore();
  }
  // 巨体（冰岩质感多边形）
  ctx.fillStyle=e.hitFlash>0?"#ffffff":"#9fd3ea";
  ctx.strokeStyle=OUT;ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(-R*.88,R*.72);ctx.lineTo(-R*1.02,-R*.18);
  ctx.lineTo(-R*.62,-R*.92);ctx.lineTo(R*.58,-R*.96);
  ctx.lineTo(R*.98,-R*.08);ctx.lineTo(R*.82,R*.74);
  ctx.closePath();ctx.fill();ctx.stroke();
  // 冰装甲板（上半身覆盖）
  ctx.fillStyle="rgba(223,243,251,.85)";ctx.strokeStyle=OUT;ctx.lineWidth=2.2;
  ctx.beginPath();
  ctx.moveTo(-R*.66,-R*.28);ctx.lineTo(-R*.44,-R*.86);
  ctx.lineTo(R*.46,-R*.9);ctx.lineTo(R*.68,-R*.24);
  ctx.quadraticCurveTo(0,-R*.52,-R*.66,-R*.28);
  ctx.closePath();ctx.fill();ctx.stroke();
  // 装甲裂纹（P3 更多裂纹发白光）
  const cracks=e.phase>=3?4:2;
  ctx.strokeStyle=e.phase>=3?"rgba(255,255,255,.95)":"rgba(36,26,46,.4)";
  ctx.lineWidth=e.phase>=3?2:1.5;
  for(let k=0;k<cracks;k++){
    const cx=-R*.4+k*R*.3;
    ctx.beginPath();ctx.moveTo(cx,-R*.7);
    ctx.lineTo(cx+R*.1,-R*.45);ctx.lineTo(cx-R*.06,-R*.3);ctx.stroke();
  }
  // 冻气环绕粒子（P2+）
  if(e.phase>=2&&Math.random()<.4)
    spawnParticle(e.x+rand(-R,R)*.8,e.y-rand(0,R),
      {r0:2,r1:4.5,life:.7,color:"rgba(205,238,253,.6)",vy:-26});
  // 眼：深洞蓝光
  for(const s of[-1,1]){
    ctx.fillStyle=OUT;
    ctx.beginPath();ctx.arc(s*R*.28,-R*.34,R*.14,0,7);ctx.fill();
    ctx.fillStyle=e.phase>=3?"#fff":(e.phase>=2?"#dff3fb":"#a5e3f7");
    ctx.beginPath();ctx.arc(s*R*.28,-R*.34,R*.07,0,7);ctx.fill();
  }
  // 阶段文字底座冰霜圈
  if(e.phase>=3){
    ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=2;
    ctx.setLineDash([8,6]);ctx.lineDashOffset=t*30;
    ctx.beginPath();ctx.arc(0,R*.3,R*1.15,0,7);ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ---- 影武者：黑影忍者 ----
function drawShadowBlade(ctx,e,t){
  const R=e.r;
  const flicker=.75+.25*Math.sin(t*(e.phase>=3?17:9));
  ctx.globalAlpha=flicker;
  ctx.lineJoin="round";
  // 残影外圈
  ctx.fillStyle="rgba(90,50,128,.3)";
  ctx.beginPath();ctx.arc(Math.sin(t*13)*4,-4,R*1.15,0,7);ctx.fill();
  // 身体：流线黑袍
  ctx.fillStyle="#2b1f3f";ctx.strokeStyle=OUT;ctx.lineWidth=2.6;
  ctx.beginPath();
  ctx.moveTo(-R*.62,-R*.5);
  ctx.quadraticCurveTo(-R*.9,R*.3,-R*.62,R*.92);
  ctx.lineTo(R*.62,R*.92);
  ctx.quadraticCurveTo(R*.9,R*.3,R*.62,-R*.5);
  ctx.quadraticCurveTo(0,-R*.98,-R*.62,-R*.5);
  ctx.closePath();ctx.fill();ctx.stroke();
  // 围巾飘带
  for(const s of[-1,1]){
    ctx.fillStyle=s<0?"#8a4fbf":"#b06ad4";ctx.strokeStyle=OUT;ctx.lineWidth=1.6;
    const sw=Math.sin(t*7+s)*6;
    ctx.beginPath();ctx.moveTo(-s*4,-R*.42);
    ctx.quadraticCurveTo(-s*(R*.8)-sw*.4,-R*.3,-s*(R*1.15)-sw,R*.02);
    ctx.quadraticCurveTo(-s*(R*.7),-R*.18,-s*2,-R*.32);
    ctx.closePath();ctx.fill();ctx.stroke();
  }
  // 斗笠
  ctx.fillStyle="#3a2450";ctx.strokeStyle=OUT;ctx.lineWidth=2.2;
  ctx.beginPath();
  ctx.moveTo(-R*.78,-R*.52);ctx.lineTo(0,-R*1.18);ctx.lineTo(R*.78,-R*.52);
  ctx.quadraticCurveTo(0,-R*.68,-R*.78,-R*.52);
  ctx.closePath();ctx.fill();ctx.stroke();
  // 斗笠下的发光眼
  ctx.fillStyle="#d24bd0";
  const blinkE=Math.sin(t*2.7)>.94;
  if(!blinkE)for(const s of[-1,1]){
    ctx.beginPath();ctx.ellipse(s*R*.24,-R*.38,R*.11,R*.05,s*.2,0,7);ctx.fill();
  }
  // 双刀（P3 双持出鞘发光）
  if(e.phase>=2){
    ctx.save();
    const swing=Math.sin(t*5)*.25;
    for(const s of[-1,1]){
      ctx.save();ctx.translate(s*R*.72,R*.1);ctx.rotate(s*(.7+swing));
      ctx.strokeStyle=OUT;ctx.lineWidth=3.4;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-R*.95);ctx.stroke();
      ctx.strokeStyle=e.phase>=3?"#d24bd0":"#8a4fbf";ctx.lineWidth=1.8;
      ctx.beginPath();ctx.moveTo(0,-R*.15);ctx.lineTo(0,-R*.9);ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.globalAlpha=1;
}
})();
