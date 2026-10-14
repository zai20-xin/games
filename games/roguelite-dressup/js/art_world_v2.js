// ===== v0.12 商业化美术升级：背景氛围层 =====
// 覆写 drawWorld：多层地面纹理 + 主题色渐变 + 暗角光照 + 环境装饰。
// 不改动原逻辑，仅替换绘制（加载顺序在 main 之后由 index.html 控制）。

(function(){
// 预生成噪点草地纹理（离屏canvas，性能友好）
let _texCanvas=null,_texCtx=null;

function ensureTex(){
  if(_texCanvas)return;
  _texCanvas=document.createElement("canvas");
  _texCanvas.width=512;_texCanvas.height=512;
  _texCtx=_texCanvas.getContext("2d");
}

// 按主题色生成一张手绘感草地/地砖纹理
function buildTexture(ground,grid,accent){
  ensureTex();
  const c=_texCtx,S=512;
  // 底色
  c.fillStyle=ground;c.fillRect(0,0,S,S);
  // 大块色斑（水彩晕染感）
  for(let i=0;i<26;i++){
    const x=Math.random()*S,y=Math.random()*S,r=30+Math.random()*80;
    const g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,hexA(accent,.06+Math.random()*.05));
    g.addColorStop(1,hexA(accent,0));
    c.fillStyle=g;
    c.beginPath();c.arc(x,y,r,0,7);c.fill();
  }
  // 手绘草丛簇
  for(let i=0;i<90;i++){
    const x=Math.random()*S,y=Math.random()*S;
    c.strokeStyle=hexA("#ffffff",.05+Math.random()*.05);
    c.lineWidth=1.5;
    for(let b=0;b<3;b++){
      c.beginPath();c.moveTo(x+b*3,y);
      c.quadraticCurveTo(x+b*3+(Math.random()*4-2),y-6,x+b*3+(Math.random()*6-3),y-11);
      c.stroke();
    }
  }
  // 细碎石
  for(let i=0;i<40;i++){
    const x=Math.random()*S,y=Math.random()*S,r=1+Math.random()*2.5;
    c.fillStyle=hexA("#000000",.08);
    c.beginPath();c.arc(x,y,r,0,7);c.fill();
    c.fillStyle=hexA("#ffffff",.05);
    c.beginPath();c.arc(x-r*.4,y-r*.4,r*.55,0,7);c.fill();
  }
  // 网格线（淡）
  c.strokeStyle=hexA(grid,.35);c.lineWidth=1;
  for(let k=0;k<=S;k+=64){
    c.beginPath();c.moveTo(k,0);c.lineTo(k,S);c.stroke();
    c.beginPath();c.moveTo(0,k);c.lineTo(S,k);c.stroke();
  }
  return _texCanvas;
}

function hexA(hex,a){
  const h=hex.replace("#","");
  const r=parseInt(h.substring(0,2),16),g2=parseInt(h.substring(2,4),16),b=parseInt(h.substring(4,6),16);
  return `rgba(${r},${g2},${b},${a})`;
}

const __origDrawWorld=drawWorld;
window.drawWorld=function(){
  const B=(typeof BIOME!=="undefined")?BIOME.current:null;
  const ground=B?B.ground:"#2c3e33";
  const grid=B?B.grid:"#22302a";
  // 主题点缀色
  const accent=(typeof ChapterSys!=="undefined"&&ChapterSys.idx===2)?"#8fbf6f":
               (typeof ChapterSys!=="undefined"&&ChapterSys.idx===1)?"#7ec8e3":"#9fd98f";

  // ---- 底层：纹理平铺（视差滚动）----
  const tex=buildTexture(ground,grid,accent);
  const pat=ctx.createPattern(tex,"repeat");
  ctx.save();
  ctx.translate(-cam.x*.85,-cam.y*.85);   // 0.85 视差：背景比前景慢一点点
  ctx.fillStyle=pat;
  ctx.fillRect(cam.x*.85,cam.y*.85,VIEW_W+64,VIEW_H+64);
  ctx.restore();

  // ---- 大型环境装饰（世界固定位置，伪随机分布）----
  const decoSeed=[[-300,-180,"tree"],[420,-520,"rock"],[900,-140,"tree"],[1500,-600,"rock"],
    [-700,300,"rock"],[1100,500,"tree"],[200,800,"tree"],[1600,900,"rock"],
    [-1000,-900,"tree"],[1300,1200,"tree"],[-500,1100,"rock"],[700,-1100,"rock"]];
  for(const [dx,dy,type] of decoSeed){
    const sx=dx-cam.x*.92,sy=dy-cam.y*.92;   // 0.92 视差：远景
    if(sx<-120||sy>-VIEW_H-120||sx>VIEW_W+120||sy<120){}
    if(sx<-120||sx>VIEW_W+120||sy<-120||sy>VIEW_H+120)continue;
    ctx.save();ctx.translate(sx,sy);
    ctx.globalAlpha=.32;
    if(type==="tree"){
      // 剪影树
      ctx.fillStyle="#0d1410";
      ctx.beginPath();ctx.roundRect(-6,-10,12,34,3);ctx.fill();
      ctx.beginPath();ctx.arc(0,-24,26,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(-18,-10,17,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(18,-10,17,0,7);ctx.fill();
      ctx.fillStyle=hexA(accent,.14);
      ctx.beginPath();ctx.arc(-8,-28,18,0,7);ctx.fill();
    } else {
      // 剪影岩石
      ctx.fillStyle="#131a16";
      ctx.beginPath();
      ctx.moveTo(-20,12);ctx.lineTo(-13,-13);ctx.lineTo(2,-19);
      ctx.lineTo(18,-8);ctx.lineTo(21,12);
      ctx.closePath();ctx.fill();
      ctx.fillStyle=hexA("#ffffff",.07);
      ctx.beginPath();ctx.moveTo(-11,-10);ctx.lineTo(1,-15);ctx.lineTo(6,-4);
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }

  __origDrawWorld();

  // ---- 光照氛围层：暗角 + 主题光斑 ----
  const vg=ctx.createRadialGradient(VIEW_W/2,VIEW_H/2,VIEW_H*.42,
                                    VIEW_W/2,VIEW_H/2,VIEW_H*.82);
  vg.addColorStop(0,"rgba(0,0,0,0)");
  vg.addColorStop(1,"rgba(6,4,14,.42)");
  ctx.fillStyle=vg;
  ctx.fillRect(0,0,VIEW_W,VIEW_H);

  // 缓慢移动的光斑（萤火/尘埃氛围）
  const t=performance.now()/1000;
  for(let k=0;k<3;k++){
    const fx=(Math.sin(t*(.13+k*.05)+k*2.1)*.5+.5)*VIEW_W;
    const fy=(Math.cos(t*(.09+k*.04)+k*1.3)*.5+.5)*VIEW_H;
    const g=ctx.createRadialGradient(fx,fy,0,fx,fy,190);
    g.addColorStop(0,hexA(accent,.045));
    g.addColorStop(1,hexA(accent,0));
    ctx.fillStyle=g;
    ctx.fillRect(fx-190,fy-190,380,380);
  }
};
})();
