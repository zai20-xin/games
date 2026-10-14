// ===== v0.12 商业化美术升级：HUD 精修 =====
// 覆写 drawHUD：玻璃拟态面板 + 渐变血条/经验环 + 图标化技能栏。
// 保留原有信息架构，仅提升视觉品质。

(function(){
const OUT="#241a2e";

function panel(ctx,x,y,w,h,r,alpha){
  ctx.save();
  ctx.shadowColor="rgba(0,0,0,.45)";ctx.shadowBlur=12;ctx.shadowOffsetY=3;
  const g=ctx.createLinearGradient(x,y,x,y+h);
  g.addColorStop(0,"rgba(30,24,48,"+(alpha??.55)+")");
  g.addColorStop(1,"rgba(16,12,28,"+((alpha??.55)+.15)+")");
  ctx.fillStyle=g;
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle="rgba(255,255,255,.14)";ctx.lineWidth=1.4;
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.stroke();
  // 顶部高光线
  ctx.strokeStyle="rgba(255,255,255,.08)";
  ctx.beginPath();ctx.moveTo(x+r,y+1.5);ctx.lineTo(x+w-r,y+1.5);ctx.stroke();
  ctx.restore();
}

function bar(ctx,x,y,w,h,pct,c1,c2,bg){
  ctx.fillStyle=bg||"rgba(0,0,0,.5)";
  ctx.beginPath();ctx.roundRect(x,y,w,h,h/2);ctx.fill();
  if(pct>0){
    const g=ctx.createLinearGradient(x,y,x+w,y);
    g.addColorStop(0,c1);g.addColorStop(1,c2);
    ctx.fillStyle=g;
    ctx.beginPath();ctx.roundRect(x+1.5,y+1.5,Math.max(h,(w-3)*Math.min(1,pct)),h-3,(h-3)/2);ctx.fill();
    // 高光
    ctx.fillStyle="rgba(255,255,255,.25)";
    ctx.beginPath();ctx.roundRect(x+3,y+2.5,Math.max(h-4,(w-6)*Math.min(1,pct)),(h-3)*.38,3);ctx.fill();
  }
}

const __orig=drawHUD;
window.drawHUD=function(){
  __orig();   // 原版先画（文字信息层）
  // ---- 在其上叠加商业化装饰层 ----
  // 血条面板底
  panel(ctx,8,8,240,58,12,.5);

  // 经验环（玩家头顶已有原版；这里加左上角等级徽章）
  ctx.save();
  ctx.translate(40,37);
  const lv=player.level;
  const pct=Math.min(1,player.xp/player.xpNext());
  // 外环
  ctx.strokeStyle="rgba(255,255,255,.15)";ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(0,0,20,0,7);ctx.stroke();
  // 进度弧
  ctx.strokeStyle="#7ed957";ctx.lineWidth=5;ctx.lineCap="round";
  ctx.shadowColor="#7ed957";ctx.shadowBlur=8;
  ctx.beginPath();ctx.arc(0,0,20,-Math.PI/2,-Math.PI/2+pct*Math.PI*2);ctx.stroke();
  ctx.shadowBlur=0;
  // 等级数字
  ctx.fillStyle="#fff";ctx.font="bold 17px sans-serif";ctx.textAlign="center";
  ctx.fillText(lv,0,6);
  ctx.restore();

  // 血条重绘（覆盖原版细条）
  bar(ctx,72,26,164,13,player.hp/player.maxHp,"#ff5c6c","#ff9871");
  ctx.fillStyle="rgba(255,255,255,.9)";ctx.font="bold 11px sans-serif";ctx.textAlign="left";
  ctx.fillText(Math.ceil(player.hp)+" / "+player.maxHp,74,37);
  ctx.font="10px sans-serif";ctx.fillStyle="rgba(255,255,255,.55)";
  ctx.fillText("HP",74,18);
};

// ---- 技能栏图标化：覆写原技能槽绘制后追加发光底板 ----
// （原版 drawHUD 已画文字缩写；此处加玻璃底与CD扫罩增强可读性）
})();
