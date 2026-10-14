// ===== v0.12 商业化美术升级：特效质感层 =====
// 1) 粒子系统发光增强（additive blending）
// 2) 玩家弹体拖尾
// 3) 命中反馈闪光强化

(function(){
// ---- 粒子绘制覆写：发光混合 ----
const __origDrawParticles=drawParticles;
window.drawParticles=function(ctx,camX,camY){
  ctx.save();
  ctx.globalCompositeOperation="lighter";   // 加色混合=霓虹发光感
  __origDrawParticles(ctx,camX,camY);
  ctx.restore();
};

// ---- 玩家弹体拖尾：在 render 的 projectiles 之后叠加 ----
const __origDrawProjectiles=drawProjectiles;
window.drawProjectiles=function(ctx,camX,camY){
  // 先画发光拖尾（lighter 混合）
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  for(const p of projectiles){
    if(p.kind==="enemybullet"||p.kind==="icicle"||p.kind==="frostbreath"||p.kind==="shadowblade")continue;
    const x=p.x-camX,y=p.y-camY;
    if(x<-40||y<-40||x>VIEW_W+40||y>VIEW_H+40)continue;
    const vx=p.vx||0,vy=p.vy||0,sp=Math.hypot(vx,vy);
    if(sp<60)continue;
    const tl=Math.min(22,sp*.045);   // 拖尾长度
    const g=ctx.createLinearGradient(x,y,x-vx/sp*tl,y-vy/sp*tl);
    const col=p.color||"#ffe66d";
    g.addColorStop(0,col);
    g.addColorStop(1,"rgba(0,0,0,0)");
    ctx.strokeStyle=g;
    ctx.lineWidth=(p.r||5)*1.4;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-vx/sp*tl,y-vy/sp*tl);ctx.stroke();
  }
  ctx.restore();
  __origDrawProjectiles(ctx,camX,camY);
};

// ---- Boss/精英受击白闪强化：hitFlash 期间叠加轮廓光 ----
const __origDrawEnemies=drawEnemies;
window.drawEnemies=function(ctx,camX,camY){
  // 受击瞬间的光圈（画在敌人之下）
  for(const e of enemies){
    if(e.hitFlash>0.05&&(e.isBoss||e.isElite)){
      const x=e.x-camX,y=e.y-camY;
      const a=e.hitFlash*4;
      const g=ctx.createRadialGradient(x,y,e.r*.4,x,y,e.r*(2.2-a));
      g.addColorStop(0,"rgba(255,255,220,"+(a*.35)+")");
      g.addColorStop(1,"rgba(255,255,220,0)");
      ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(x,y,e.r*2.2,0,7);ctx.fill();
    }
  }
  __origDrawEnemies(ctx,camX,camY);
};
})();
