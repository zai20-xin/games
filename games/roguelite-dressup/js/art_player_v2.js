// ===== 角色美术 v2：粗描边 chibi 全面重绘 =====
// 加载后覆写 Player.prototype.draw。特点：
//  大头身比(1:1.4)/表情系统(眨眼·受击·低血汗滴)/走路循环(手脚摆动+头发裙摆惯性)/六套时装专属配件

(function(){
const OUT="#241a2e";   // 统一描边色

function limb(c,x1,y1,x2,y2,w,col){
  c.strokeStyle=OUT;c.lineWidth=w+2;c.lineCap="round";
  c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  c.strokeStyle=col;c.lineWidth=w;
  c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
}
function dotEye(c,x,y,r,col){
  c.fillStyle=col||OUT;
  c.beginPath();c.arc(x,y,r,0,7);c.fill();
  c.fillStyle="rgba(255,255,255,.9)";
  c.beginPath();c.arc(x+r*.35,y-r*.35,r*.32,0,7);c.fill();
}

Player.prototype.draw=function(ctx,camX,camY){
  const p=this,o=p.outfit;
  const x=p.x-camX,y=p.y-camY;
  const t=performance.now()/1000;
  const mv=p.moving, wt=p.walkT;
  const bob=mv?Math.abs(Math.sin(wt))*2.8:Math.sin(t*2.1)*1.3;
  const legA=mv?Math.sin(wt)*5.5:0;
  const armA=mv?-Math.sin(wt)*4.2:Math.sin(t*2.1)*.9;
  const d=p.faceDir;

  ctx.save();
  ctx.translate(x,y);
  if(p.iframes>0&&Math.floor(t*12)%2===0)ctx.globalAlpha=.45;
  // 影子（不随bob）
  ctx.fillStyle="rgba(0,0,0,.28)";
  ctx.beginPath();ctx.ellipse(0,14.5,12,4,0,0,7);ctx.fill();

  // ---- 时装背后层（背包/披风/围巾尾）----
  if(o.id==="novice"){ // 背包
    ctx.save();ctx.translate(-d*9,-4+bob*.4);
    ctx.fillStyle="#a8763e";ctx.strokeStyle=OUT;ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(-5,-6,10,12,3);ctx.fill();ctx.stroke();
    ctx.strokeStyle="#7a5628";ctx.beginPath();ctx.moveTo(-5,-1);ctx.lineTo(5,-1);ctx.stroke();
    ctx.restore();
  }
  if(o.id==="shadow"){ // 双飘带围巾尾（惯性波动）
    for(let s=-1;s<=1;s+=2){
      const sway=Math.sin(t*6+s)*4+(mv?-d*4:0);
      ctx.fillStyle=s>0?"#b06ad4":"#8a4fbf";ctx.strokeStyle=OUT;ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(-d*-2*s,-6+bob*.3);
      ctx.quadraticCurveTo(-d*(10+s*2)+sway*.5,-2+sway*.4,-d*(16+s*3)+sway,4+sway*.6);
      ctx.quadraticCurveTo(-d*(10+s*2)+sway*.5,3+sway*.3,-d*-1*s,-2+bob*.3);
      ctx.closePath();ctx.fill();ctx.stroke();
    }
  }
  if(o.id==="holy"){ // 光环（悬浮微动）
    ctx.save();ctx.translate(0,-34+bob);
    ctx.rotate(Math.sin(t*1.7)*.06);
    ctx.strokeStyle="rgba(255,215,0,.95)";ctx.lineWidth=2.4;
    ctx.beginPath();ctx.ellipse(0,0,10,3.2,0,0,7);ctx.stroke();
    ctx.strokeStyle="rgba(255,248,220,.55)";ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(0,0,13,4.4,0,0,7);ctx.stroke();
    ctx.restore();
  }

  // ---- 腿 ----
  const legCol=o.cloth2;
  limb(c=ctx,-4.5,4,-4.5-legA*.5,13,4.5,legCol);
  limb(ctx,4.5,4,4.5+legA*.5,13,4.5,legCol);
  // 鞋
  ctx.fillStyle=OUT==="#241a2e"?"#3d2b45":"#3d2b45";
  ctx.beginPath();ctx.roundRect(-7-legA*.5,11.5,6,3.4,1.6);ctx.fill();
  ctx.beginPath();ctx.roundRect(1+legA*.5,11.5,6,3.4,1.6);ctx.fill();

  // ---- 身体/服装 ----
  ctx.save();ctx.translate(0,bob*.55);
  ctx.lineJoin="round";
  switch(o.id){
    case "novice": case "storm": { // 合身短装
      ctx.fillStyle=o.cloth;ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
      ctx.beginPath();ctx.roundRect(-8.5,-9,17,15,5);ctx.fill();ctx.stroke();
      if(o.id==="novice"){ // 腰带+铜扣
        ctx.fillStyle="#7a5628";ctx.fillRect(-8.5,-1,17,3.4);
        ctx.fillStyle="#ffd700";ctx.beginPath();ctx.arc(0,.7,1.8,0,7);ctx.fill();
      } else { // 雷电纹章 + 胸口核心
        ctx.fillStyle="#ffd93d";
        ctx.beginPath();ctx.moveTo(1,-7);ctx.lineTo(-3,-1);ctx.lineTo(-.5,-1);ctx.lineTo(-1.5,4);ctx.lineTo(3.5,-2.4);ctx.lineTo(.8,-2.4);ctx.closePath();ctx.fill();
        ctx.fillStyle=o.accent;ctx.beginPath();ctx.arc(0,3.4,2.2,0,7);ctx.fill();
        ctx.strokeStyle="#fff";ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,3.4,3.4,0,7);ctx.stroke();
      }
      break;}
    case "flame": { // 大摆舞裙
      ctx.fillStyle=o.cloth;ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
      ctx.beginPath();ctx.moveTo(-6,-9);
      ctx.quadraticCurveTo(-13,2,-12.5,11);ctx.lineTo(12.5,11);
      ctx.quadraticCurveTo(13,2,6,-9);ctx.closePath();ctx.fill();ctx.stroke();
      // 裙摆金边+火纹
      ctx.fillStyle=o.accent;ctx.fillRect(-12.5,9,25,2.6);
      ctx.fillStyle="rgba(255,179,71,.85)";
      for(let i=-1;i<=1;i++){const fx=i*7;
        ctx.beginPath();ctx.moveTo(fx,6.4);ctx.quadraticCurveTo(fx+2.4,8.4,fx,10.6);ctx.quadraticCurveTo(fx-2.4,8.4,fx,6.4);ctx.fill();}
      break;}
    case "frost": { // 连帽斗篷+绒毛领
      ctx.fillStyle=o.cloth;ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
      ctx.beginPath();ctx.moveTo(-9,-8);
      ctx.quadraticCurveTo(-13,3,-10,12);ctx.lineTo(10,12);
      ctx.quadraticCurveTo(13,3,9,-8);ctx.closePath();ctx.fill();ctx.stroke();
      // 绒毛领
      ctx.fillStyle="#ffffff";
      for(let i=-2;i<=2;i++){ctx.beginPath();ctx.arc(i*4,-6.5,3,0,7);ctx.fill();}
      ctx.strokeStyle=OUT;ctx.lineWidth=1.2;
      for(let i=-2;i<=2;i++){ctx.beginPath();ctx.arc(i*4,-6.5,3,0,7);ctx.stroke();}
      // 雪花扣
      ctx.strokeStyle="#dff3fb";ctx.lineWidth=1.4;
      for(let k=0;k<3;k++){const a=k*Math.PI/3+.3;
        ctx.beginPath();ctx.moveTo(Math.cos(a)*-0? 0:0-Math.cos(a)*3,2-Math.sin(a)*3);ctx.lineTo(0+Math.cos(a)*3,2+Math.sin(a)*3);ctx.stroke();}
      break;}
    case "shadow": { // 修身夜行衣+面罩
      ctx.fillStyle=o.cloth;ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
      ctx.beginPath();ctx.roundRect(-7.5,-9,15,15,6);ctx.fill();ctx.stroke();
      ctx.strokeStyle=o.accent;ctx.lineWidth=1.4;
      ctx.beginPath();ctx.moveTo(-7.5,1);ctx.lineTo(7.5,1);ctx.stroke();
      break;}
    case "holy": { // 礼服+肩泡袖
      ctx.fillStyle=o.cloth;ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
      ctx.beginPath();ctx.moveTo(-5.5,-9);
      ctx.quadraticCurveTo(-12,3,-13,12.5);ctx.lineTo(13,12.5);
      ctx.quadraticCurveTo(12,3,5.5,-9);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle=o.accent;ctx.fillRect(-13,10.6,26,2);
      // 肩泡袖
      for(const s of[-1,1]){ctx.fillStyle="#fff";ctx.strokeStyle=OUT;ctx.lineWidth=1.8;
        ctx.beginPath();ctx.arc(s*9,-6.5,3.6,0,7);ctx.fill();ctx.stroke();}
      break;}
  }
  // ---- 手臂 ----
  const sleeve=(o.id==="holy")?"#ffffff":o.cloth;
  limb(ctx,-8,-5.5,-10-armA*.4,2.5,3.6,sleeve);
  limb(ctx,8,-5.5,10+armA*.4,2.5,3.6,sleeve);
  ctx.fillStyle=o.body; // 手
  ctx.beginPath();ctx.arc(-10-armA*.4,3.4,2.2,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(10+armA*.4,3.4,2.2,0,7);ctx.fill();
  ctx.restore();

  // ---- 头部 ----
  ctx.save();ctx.translate(0,bob*.8);
  const hy=-20;
  // 后发层
  ctx.fillStyle=o.hair;
  switch(o.id){
    case "flame": // 高马尾
      ctx.save();ctx.rotate(Math.sin(t*5)*(mv?.09:.04));
      ctx.strokeStyle=OUT;ctx.lineWidth=2;ctx.fillStyle=o.hair;
      ctx.beginPath();ctx.moveTo(-d*6,hy-6);
      ctx.quadraticCurveTo(-d*15,hy+4,-d*13,hy+16);
      ctx.quadraticCurveTo(-d*8,hy+8,-d*5,hy+2);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();break;
    case "shadow": case "holy": // 及肩长发两侧
      for(const s of[-1,1]){ctx.fillStyle=o.hair;ctx.strokeStyle=OUT;ctx.lineWidth=1.6;
        ctx.beginPath();ctx.roundRect(s*10-4,hy-6,8,16,3);ctx.fill();ctx.stroke();}
      break;
  }
  // 头圆
  ctx.fillStyle=o.body;ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
  ctx.beginPath();ctx.arc(0,hy,12,0,7);ctx.fill();ctx.stroke();
  // 刘海（前发）
  ctx.fillStyle=o.hair;ctx.strokeStyle=OUT;ctx.lineWidth=1.8;
  ctx.beginPath();
  ctx.arc(0,hy-1,11.6,Math.PI*1.02,Math.PI*1.98);
  ctx.quadraticCurveTo(d*9,hy-6,d*7,hy-2);
  ctx.quadraticCurveTo(d*2,hy-9,-6*d,hy-3.4);
  ctx.quadraticCurveTo(-d*8,hy-6,-11*d,hy+1);
  ctx.closePath();ctx.fill();ctx.stroke();
  // 发光高光
  ctx.fillStyle="rgba(255,255,255,.35)";
  ctx.beginPath();ctx.ellipse(-d*4,hy-7,4.5,1.8,-.4,0,7);ctx.fill();

  // ---- 表情 ----
  const lowHp=p.hp/p.maxHp<.25;
  const blink=(t%3.2)<.12&&!lowHp&&p.iframes<=0;
  if(p.iframes>0){ // 受击 ><
    ctx.strokeStyle=OUT;ctx.lineWidth=1.8;ctx.lineCap="round";
    for(const s of[-1,1]){ctx.beginPath();ctx.moveTo(s*3-2,hy-2);ctx.lineTo(s*3+2,hy-1);ctx.stroke();}
  }else if(blink){
    ctx.strokeStyle=OUT;ctx.lineWidth=1.8;
    ctx.beginPath();ctx.moveTo(-6,hy-1.4);ctx.lineTo(-2.4,hy-1.4);ctx.moveTo(2.4,hy-1.4);ctx.lineTo(6,hy-1.4);ctx.stroke();
  }else{
    dotEye(ctx,d*3+ (mv?d*.6:0),hy-1,2.1);
    dotEye(ctx,-d*3+(mv?d*.6:0),hy-1,2.1);
  }
  // 腮红
  ctx.fillStyle="rgba(255,120,140,.32)";
  ctx.beginPath();ctx.arc(-d*7.4,hy+2.4,2.1,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(d*7.4,hy+2.4,2.1,0,7);ctx.fill();
  // 嘴
  ctx.strokeStyle=OUT;ctx.lineWidth=1.5;ctx.lineCap="round";
  if(lowHp){ctx.beginPath();ctx.arc(d*1,hy+4.4,1.8,1.15*Math.PI,1.85*Math.PI);ctx.stroke();
    ctx.fillStyle="#7db8e8"; // 汗滴
    ctx.beginPath();ctx.moveTo(d*8.6,hy-6);ctx.quadraticCurveTo(d*10.4,hy-2.6,d*8.6,hy-1.6);ctx.quadraticCurveTo(d*6.8,hy-2.6,d*8.6,hy-6);ctx.fill();
  } else {ctx.beginPath();ctx.arc(d*1,hy+3,2.2,.15*Math.PI,.85*Math.PI);ctx.stroke();}

  // ---- 头顶专属配件 ----
  if(o.id==="flame"){ // 火焰发饰
    ctx.save();ctx.translate(-d*8,hy-11+Math.sin(t*8)*.8);
    ctx.fillStyle="#ffb347";ctx.strokeStyle=OUT;ctx.lineWidth=1.4;
    ctx.beginPath();ctx.moveTo(0,3);ctx.quadraticCurveTo(-3.4,-1,0,-5.4);ctx.quadraticCurveTo(3.4,-1,0,3);ctx.fill();ctx.stroke();
    ctx.fillStyle="#ffe66d";ctx.beginPath();ctx.moveTo(0,2);ctx.quadraticCurveTo(-1.6,0,0,-2.2);ctx.quadraticCurveTo(1.6,0,0,2);ctx.fill();
    ctx.restore();
  }
  if(o.id==="storm"){ // 额前风镜
    ctx.fillStyle="#3d3268";ctx.strokeStyle=OUT;ctx.lineWidth=1.6;
    ctx.beginPath();ctx.roundRect(-d*10,hy-9,20,5,2.4);ctx.fill();ctx.stroke();
    ctx.fillStyle="#ffd93d";
    ctx.beginPath();ctx.arc(d*4,hy-6.4,1.9,0,7);ctx.fill();
    ctx.beginPath();ctx.arc(-d*4,hy-6.4,1.9,0,7);ctx.fill();
    if(Math.random()<.05){ // 静电小火花
      ctx.strokeStyle="#fffbe0";ctx.lineWidth=1.2;
      ctx.beginPath();ctx.moveTo(d*10,hy-7);ctx.lineTo(d*13,hy-9);ctx.stroke();
    }
  }
  if(o.id==="frost"){ // 帽尖雪绒球
    ctx.fillStyle="#fff";ctx.strokeStyle=OUT;ctx.lineWidth=1.6;
    ctx.beginPath();ctx.arc(-d*2,hy-13.4,3,0,7);ctx.fill();ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
};
})();
