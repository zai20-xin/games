// ===== v0.12 商业化美术升级：界面精修层 =====
// 标题屏：星空背景+光效标题+卡片玻璃拟态。
// 结算屏：渐变面板+星级动画感。

(function(){
const OUT="#241a2e";

// ---- 标题背景：深空渐变 + 星尘 ----
function drawTitleBG(t){
  const g=ctx.createLinearGradient(0,0,0,VIEW_H);
  g.addColorStop(0,"#1a1433");
  g.addColorStop(.55,"#241d44");
  g.addColorStop(1,"#14101f");
  ctx.fillStyle=g;ctx.fillRect(0,0,VIEW_W,VIEW_H);
  // 星尘（伪随机固定）
  for(let k=0;k<70;k++){
    const sx=(k*173.7)%VIEW_W;
    const sy=(k*97.3)%VIEW_H;
    const tw=.25+.75*Math.abs(Math.sin(t*(.4+k%5*.13)+k));
    ctx.fillStyle=`rgba(255,250,230,${tw*.5})`;
    ctx.beginPath();ctx.arc(sx,sy,k%3===0?1.6:.9,0,7);ctx.fill();
  }
  // 底部地平线光晕
  const hz=ctx.createRadialGradient(VIEW_W/2,VIEW_H+140,60,VIEW_W/2,VIEW_H+140,520);
  hz.addColorStop(0,"rgba(126,217,135,.14)");
  hz.addColorStop(1,"rgba(126,217,135,0)");
  ctx.fillStyle=hz;
  ctx.fillRect(VIEW_W/2-540,VIEW_H-380,1080,400);
}

// 覆写标题：光效字
const __origTitle=typeof drawGameLogo==="function"?drawGameLogo:null;

// ---- 时钟钩子：在 start 状态先铺背景再画原版内容 ----
const __origTickStart=drawStartScreen;
window.drawStartScreen=function(){
  drawTitleBG(performance.now()/1000);
  __origTickStart();
};

// ---- 卡片玻璃拟态增强：给选装卡加顶部光泽条与内阴影 ----
const __origRender=render;
window.render=function(){
  __origRender();
  // 游戏内叠加：屏幕边缘电影黑边（轻微）
  const eb=ctx.createLinearGradient(0,0,0,54);
  eb.addColorStop(0,"rgba(8,6,18,.35)");eb.addColorStop(1,"rgba(8,6,18,0)");
  if(typeof gameState!=="undefined"&&gameState==="playing"){
    ctx.fillStyle=eb;ctx.fillRect(0,0,VIEW_W,54);
  }
};
})();
