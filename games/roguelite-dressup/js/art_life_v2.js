// ===== v0.13b 受击闪白渲染 + 弹体生命感 =====
// A) 玩家 hurtFlash 期间叠加白色剪影（Hollow Knight 式）
// B) 玩家弹体旋转/脉动（Hades 式活力）——覆写 drawProjectiles 后处理

(function(){
// ---- 玩家受击闪白：在玩家绘制后叠一层白影 ----
const __origPlayerDraw=Player.prototype.draw;
Player.prototype.draw=function(ctx,camX,camY){
  __origPlayerDraw.call(this,ctx,camX,camY);
  if(this.hurtFlash>0){
    const x=this.x-camX,y=this.y-camY;
    ctx.save();
    ctx.globalCompositeOperation="source-atop";
    // 白色圆形闪光罩（近似角色轮廓，视觉等效闪白）
    const a=Math.min(1,this.hurtFlash/0.22);
    ctx.fillStyle=`rgba(255,255,255,${a*.65})`;
    ctx.beginPath();ctx.arc(x,y-4,this.r+6,0,7);ctx.fill();
    ctx.restore();
    // 低血持续红脉冲
    if(this.hp/this.maxHp<0.3){
      const pulse=.25+.2*Math.sin(performance.now()/120);
      ctx.save();
      ctx.strokeStyle=`rgba(255,60,60,${pulse})`;
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(x,y-4,this.r+9,0,7);ctx.stroke();
      ctx.restore();
    }
  }
};

// ---- 玩家弹体生命感：旋转的水晶弹/脉动的火球 ----
const __origDrawProjectiles=drawProjectiles;
window.drawProjectiles=function(ctx,camX,camY){
  __origDrawProjectiles(ctx,camX,camY);
  // 在原绘制之上叠加"活力装饰"
  const t=performance.now()/1000;
  for(const p of projectiles){
    if(p.kind==="enemybullet"||p.kind==="icicle"||p.kind==="frostbreath"||p.kind==="shadowblade")continue;
    const x=p.x-camX,y=p.y-camY;
    if(x<-40||y<-40||x>VIEW_W+40||y>VIEW_H+40)continue;
    if(p.kind==="fireball"||p.kind==="duelfire"){
      // 火球表面游走的亮点
      const oa=t*7+p.x*0.01;
      ctx.fillStyle="rgba(255,245,200,.85)";
      ctx.beginPath();
      ctx.arc(x+Math.cos(oa)*(p.r*.5),y+Math.sin(oa)*(p.r*.5),1.8,0,7);
      ctx.fill();
    } else if(p.kind==="knife"||(p.color==="#b8c4d6")){
      // 飞刀旋转感：侧刃高光随时间摆动
      ctx.strokeStyle="rgba(255,255,255,"+(.3+.3*Math.sin(t*12+p.y))+")";
      ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x-p.vx*0.008,y-p.vy*0.008);
      ctx.lineTo(x+p.vy*0.004,y-p.vx*0.004);ctx.stroke();
    } else {
      // 通用：轻微脉动光环
      const pu=1+.15*Math.sin(t*10+p.x*.02);
      ctx.strokeStyle="rgba(255,255,255,.28)";
      ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(x,y,(p.r||5)*pu,0,7);ctx.stroke();
    }
  }
};
})();
