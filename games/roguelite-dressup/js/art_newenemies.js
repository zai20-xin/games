// ===== v0.6 新怪绘制：接入 drawEnemies 的 switch（覆写包装）=====
(function(){
const OUT="#241a2e";
const __origDraw = (typeof drawEnemies==="function") ? drawEnemies : null;

window.drawEnemies=function(ctx,camX,camY){
  const t=performance.now()/1000;
  let drewNew=false;
  for(const e of enemies){
    if(!NEW_ENEMY_TYPES[e.type]) continue;
    drewNew=true;
    const x=e.x-camX,y=e.y-camY;
    if(x<-90||y<-90||x>VIEW_W+90||y>VIEW_H+90) continue;
    ctx.save(); ctx.translate(x,y);
    // 影子
    ctx.fillStyle="rgba(0,0,0,.28)";
    ctx.beginPath();ctx.ellipse(0,e.r*.92,e.r*.95,e.r*.32,0,0,7);ctx.fill();
    // 精英光环
    if(e.isElite){
      ctx.strokeStyle="rgba(255,215,0,.8)";ctx.lineWidth=2.6;
      ctx.setLineDash([9,6]);ctx.lineDashOffset=-t*26;
      ctx.beginPath();ctx.arc(0,e.r*.25,e.r+8+Math.sin(t*3)*2,0,7);ctx.stroke();
      ctx.setLineDash([]);
    }
    let body=e.color;
    if(e.freezeT>0)body="#a5e3f7";
    else if(e.poisonT>0)body=mixColor(e.color,"#7ac74f",.45);
    if(e.hitFlash>0)body="#ffffff";
    ctx.lineJoin="round";

    if(e.type==="mage"){
      // 悬浮法袍：下摆无脚，波浪底边
      const float=Math.sin(t*2.4+e.sinePhase)*2.5;
      ctx.translate(0,float);
      // 法袍主体
      ctx.fillStyle=body;ctx.strokeStyle=OUT;ctx.lineWidth=2.3;
      ctx.beginPath();
      ctx.moveTo(-e.r*.8,-e.r*.55);
      ctx.quadraticCurveTo(-e.r*1.05,e.r*.4,-e.r*.85,e.r*.72);
      // 波浪下摆
      for(let k=2;k>=-2;k--)
        ctx.quadraticCurveTo(e.r*k*.42,e.r*(k%2?.92:.58),e.r*(k-1)*.42,e.r*.72);
      ctx.quadraticCurveTo(e.r*1.05,e.r*.4,e.r*.8,-e.r*.55);
      ctx.closePath();ctx.fill();ctx.stroke();
      // 兜帽阴影下的眼睛
      ctx.fillStyle=OUT;
      ctx.beginPath();ctx.arc(0,-e.r*.62,e.r*.52,Math.PI,0);ctx.closePath();ctx.fill();
      dotEyesV2(ctx,0,-e.r*.66,1.9,e.r*.22,"#c084fc");
      // 咏唱时手持发光宝珠
      if(e.casting){
        const g=.6+.4*Math.sin(t*10);
        ctx.fillStyle="rgba(192,132,252,"+(0.35+g*.45)+")";
        ctx.beginPath();ctx.arc(e.r*.75,e.r*.05,e.r*.3+g*2,0,7);ctx.fill();
        ctx.strokeStyle="#fff";ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(e.r*.75,e.r*.05,e.r*.42,0,7);ctx.stroke();
      }
      // 帽顶星饰
      ctx.fillStyle="#ffd93d";
      ctx.save();ctx.translate(0,-e.r*1.18);ctx.rotate(t);
      ctx.fillRect(-1.4,-4,2.8,8);ctx.fillRect(-4,-1.4,8,2.8);
      ctx.restore();
    }
    else if(e.type==="boar"){
      const d=e.chargeDir? Math.atan2(e.chargeDir.y,e.chargeDir.x):0;
      ctx.rotate(d);  // 朝冲锋方向
      // 蓄力抖动
      if(e.boarState==="windup") ctx.translate(rand(-1.5,1.5),rand(-1.5,1.5));
      // 身体（椭圆猪）
      ctx.fillStyle=body;ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
      ctx.beginPath();ctx.ellipse(0,0,e.r*1.15,e.r*.82,0,0,7);ctx.fill();ctx.stroke();
      // 鬃毛背脊
      ctx.fillStyle="#8a5a34";
      ctx.beginPath();ctx.moveTo(-e.r*.7,-e.r*.7);
      for(let k=0;k<4;k++){
        const bx=-e.r*.7+k*e.r*.38;
        ctx.lineTo(bx+e.r*.14,-e.r*1.02);
        ctx.lineTo(bx+e.r*.3,-e.r*.68);
      }
      ctx.closePath();ctx.fill();
      // 猪鼻
      ctx.fillStyle="#e8b48f";ctx.strokeStyle=OUT;ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(e.r*1.02,0,e.r*.3,e.r*.24,0,0,7);ctx.fill();ctx.stroke();
      ctx.fillStyle=OUT;
      ctx.beginPath();ctx.arc(e.r*1.1,-e.r*.07,1.3,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(e.r*1.1,e.r*.09,1.3,0,7);ctx.fill();
      // 獠牙
      ctx.fillStyle="#fff";ctx.strokeStyle=OUT;ctx.lineWidth=1.1;
      for(const s of[-1,1]){
        ctx.beginPath();ctx.moveTo(e.r*.86,s*e.r*.26);
        ctx.quadraticCurveTo(e.r*1.16,s*e.r*.44,e.r*1.06,s*e.r*.06);
        ctx.closePath();ctx.fill();ctx.stroke();
      }
      // 眼睛（冲锋时红眼）
      const eyeCol=(e.boarState==="charge"||e.boarState==="windup")?"#ff5c5c":OUT;
      ctx.fillStyle=eyeCol;
      ctx.beginPath();ctx.arc(e.r*.5,-e.r*.32,2,0,7);ctx.fill();
      // 短腿跑动
      if(e.boarState==="walk"){
        const run=Math.sin(performance.now()/60)*e.r*.24;
        ctx.strokeStyle=OUT;ctx.lineWidth=3.6;
        ctx.beginPath();ctx.moveTo(-e.r*.5,e.r*.7);ctx.lineTo(-e.r*.5,e.r*.95+run);ctx.stroke();
        ctx.beginPath();ctx.moveTo(e.r*.45,e.r*.7);ctx.lineTo(e.r*.45,e.r*.95-run);ctx.stroke();
      }
      // 蓄力/眩晕标记
      if(e.boarState==="windup"){
        ctx.rotate(-d);
        ctx.fillStyle="#ffd93d";ctx.font="bold 11px sans-serif";ctx.textAlign="center";
        ctx.fillText("!",0,-e.r-6);
      }
      if(e.boarState==="stun"){
        ctx.rotate(-d);
        for(let k=0;k<3;k++){const a=t*4+k*2.1;
          ctx.fillStyle="#ffd93d";
          ctx.beginPath();ctx.arc(Math.cos(a)*e.r*.5,-e.r-.8+Math.sin(a)*2,1.8,0,7);ctx.fill();}
      }
    }
    else if(e.type==="summoner"){
      const float=Math.sin(t*1.8+e.sinePhase)*2;
      ctx.translate(0,float);
      // 底部召唤法阵（常驻旋转）
      ctx.strokeStyle="rgba(122,199,79,.55)";ctx.lineWidth=1.6;
      ctx.setLineDash([5,4]);ctx.lineDashOffset=t*20;
      ctx.beginPath();ctx.ellipse(0,e.r*.85,e.r*.95,e.r*.3,0,0,7);ctx.stroke();
      ctx.setLineDash([]);
      // 兜帽长袍
      ctx.fillStyle=body;ctx.strokeStyle=OUT;ctx.lineWidth=2.3;
      ctx.beginPath();
      ctx.moveTo(-e.r*.75,-e.r*.5);
      ctx.quadraticCurveTo(-e.r*1,e.r*.3,-e.r*.8,e.r*.8);
      ctx.lineTo(e.r*.8,e.r*.8);
      ctx.quadraticCurveTo(e.r*1,e.r*.3,e.r*.75,-e.r*.5);
      ctx.quadraticCurveTo(0,-e.r*1.05,-e.r*.75,-e.r*.5);
      ctx.closePath();ctx.fill();ctx.stroke();
      // 兜帽深洞 + 双绿眼
      ctx.fillStyle=OUT;
      ctx.beginPath();ctx.arc(0,-e.r*.42,e.r*.44,0,7);ctx.fill();
      ctx.fillStyle="#7ac74f";
      for(const s of[-1,1]){
        ctx.beginPath();ctx.arc(s*e.r*.16,-e.r*.44,1.9,0,7);ctx.fill();
      }
      // 手持藤杖+顶端绿珠
      ctx.strokeStyle="#6b8e5a";ctx.lineWidth=2.4;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(e.r*.7,e.r*.6);ctx.lineTo(e.r*.88,-e.r*.7);ctx.stroke();
      const g=.5+.5*Math.sin(t*6);
      ctx.fillStyle="rgba(122,199,79,"+(0.5+g*.5)+")";
      ctx.beginPath();ctx.arc(e.r*.88,-e.r*.78,e.r*.17+g*1.5,0,7);ctx.fill();
    }
    // 冻结壳/血条
    if(e.freezeT>0){ctx.strokeStyle="rgba(255,255,255,.85)";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,e.r+3,0,7);ctx.stroke();}
    if(e.hp<e.maxHp&&!e.isElite){
      const w=e.r*2.1;
      ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(-w/2,-e.r-12,w,4);
      ctx.fillStyle="#7ed957";ctx.fillRect(-w/2,-e.r-12,w*Math.max(0,e.hp/e.maxHp),4);
    }
    if(e.affixes&&typeof AFFIXES!=="undefined") AFFIXES.drawBadge(ctx,e,camX,camY);
    ctx.restore();
  }
  // 新怪画完后，若存在旧怪则调用原函数补画（原函数内部会重画全部但旧怪才可见差异）
  if(__origDraw && enemies.some(e=>!NEW_ENEMY_TYPES[e.type])) __origDraw(ctx,camX,camY);
};

function dotEyesV2(c,x,y,r,gap,col){
  for(const s of[-1,1]){
    c.fillStyle=col||OUT;c.beginPath();c.arc(s*gap+x,y,r,0,7);c.fill();
  }
}
})();
