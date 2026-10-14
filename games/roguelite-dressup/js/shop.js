// ===== 商店与衣柜界面（依赖 meta.js 的 META 存档对象）=====
// 防御兜底：若 Meta 未定义（极端加载顺序问题），用内存版保证模块不崩
if(typeof Meta==="undefined"){
  window.Meta={ data:{coins:0,unlocked:["novice"],equipped:"novice"},
    coins:0,
    isUnlocked:id=>id==="novice", equip(){return true;}, purchase(){return{ok:false,reason:"poor"};},
    outfitPrice:id=>({flame:800,frost:1200,storm:1600,shadow:2000,holy:2500}[id]??-1),
    getEquipped:()=>"novice" };
}

const SCREENS={};   // 主程序按 gameState==='shop'|'wardrobe' 调用对应方法
const SHOP_LAYOUT={cardW:180,gap:18,y0:170,h:310};

let shopToast=null;  // 界面内提示条 {text,color,t}
function shopSay(text,color){ shopToast={text,color,t:1.8}; }
function shopTickToast(){ if(shopToast){ shopToast.t-=1/60; if(shopToast.t<=0) shopToast=null; } }
function shopCardHit(x,y){
  const L=SHOP_LAYOUT;
  const totalW=OUTFITS.length*L.cardW+(OUTFITS.length-1)*L.gap;
  const x0=(VIEW_W-totalW)/2;
  for(let i=0;i<OUTFITS.length;i++){
    const cx=x0+i*(L.cardW+L.gap);
    if(x>=cx&&x<=cx+L.cardW&&y>=L.y0&&y<=L.y0+L.h) return i;
  }
  return -1;
}
function shopDrawFrame(title){
  ctx.fillStyle="#14121f"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.textAlign="center";
  ctx.fillStyle="#ffe66d"; ctx.font="bold 40px sans-serif";
  ctx.fillText(title,VIEW_W/2,80);
  // 金币余额
  ctx.textAlign="right"; ctx.fillStyle="#ffd700"; ctx.font="bold 22px sans-serif";
  ctx.fillText("◉ "+Meta.data.coins,VIEW_W-30,50);
  ctx.textAlign="left";
}
function shopDrawCards(mode){ // mode: 'shop' | 'wardrobe'
  const L=SHOP_LAYOUT;
  const totalW=OUTFITS.length*L.cardW+(OUTFITS.length-1)*L.gap;
  const x0=(VIEW_W-totalW)/2;
  const equipped=Meta.getEquipped();
  for(let i=0;i<OUTFITS.length;i++){
    const o=OUTFITS[i], cx=x0+i*(L.cardW+L.gap);
    const hovered=mouse.x>=cx&&mouse.x<=cx+L.cardW&&mouse.y>=L.y0&&mouse.y<=L.y0+L.h;
    const owned=Meta.isUnlocked(o.id);
    const price=Meta.outfitPrice(o.id);
    const afford=Meta.data.coins>=price;
    ctx.save();
    if(hovered&&(owned||afford)){ ctx.shadowColor=o.accent; ctx.shadowBlur=20; }
    ctx.fillStyle=hovered?"rgba(255,255,255,0.10)":"rgba(255,255,255,0.05)";
    ctx.strokeStyle=owned?o.accent:(afford?"#ffd700":"rgba(255,255,255,0.22)");
    ctx.lineWidth=owned&&equipped===o.id?4:2;
    ctx.beginPath(); ctx.roundRect(cx,L.y0,L.cardW,L.h,14); ctx.fill(); ctx.stroke();
    ctx.restore();
    // 预览小人（未拥有画剪影）
    if(owned) drawOutfitPreview(ctx,o,cx+L.cardW/2,L.y0+92);
    else {
      ctx.save(); ctx.globalAlpha=0.16;
      drawOutfitPreview(ctx,o,cx+L.cardW/2,L.y0+92);
      ctx.restore();
      ctx.fillStyle="#8a7fa8"; ctx.font="30px sans-serif"; ctx.textAlign="center";
      ctx.fillText("🔒",cx+L.cardW/2,L.y0+105);
    }
    ctx.textAlign="center";
    ctx.fillStyle=owned?"#fff":"rgba(255,255,255,0.55)";
    ctx.font="bold 18px sans-serif";
    ctx.fillText(o.name,cx+L.cardW/2,L.y0+182);
    // 状态行
    if(mode==="shop"){
      if(owned){ ctx.fillStyle="#7ed957"; ctx.font="13px sans-serif"; ctx.fillText("已拥有",cx+L.cardW/2,L.y0+212); }
      else { const need=price-Meta.data.coins;
        ctx.fillStyle=afford?"#ffd700":(need<=price*0.25?"#ffb347":"#ff6b6b"); ctx.font="bold 15px sans-serif";
        ctx.fillText("◉ "+price+(afford?"  点击购买":"  还差 ◉"+need),cx+L.cardW/2,L.y0+212); }
    } else {
      if(equipped===o.id){ ctx.fillStyle=o.accent; ctx.font="bold 13px sans-serif"; ctx.fillText("✦ 当前装备",cx+L.cardW/2,L.y0+212); }
      else if(owned){ ctx.fillStyle="#fff"; ctx.font="13px sans-serif"; ctx.fillText("点击换上",cx+L.cardW/2,L.y0+212); }
      else { ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font="13px sans-serif";
        ctx.fillText("未解锁 · 商店 ◉"+price,cx+L.cardW/2,L.y0+212); }
    }
    // 被动说明（未拥有也展示属性，灰色降级，便于预判价值）
    ctx.fillStyle=owned?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.3)"; ctx.font="12px sans-serif";
    wrapText(ctx,o.desc,cx+L.cardW/2,L.y0+240,L.cardW-22,16);
    ctx.restore();
  }
  // 提示条
  if(shopToast){
    ctx.save();
    ctx.globalAlpha=Math.min(1,shopToast.t*2);
    ctx.fillStyle="rgba(0,0,0,0.75)";
    const tw=ctx.measureText(shopToast.text).width+50;
    ctx.beginPath(); ctx.roundRect(VIEW_W/2-tw/2,585,tw,42,10); ctx.fill();
    ctx.fillStyle=shopToast.color; ctx.font="bold 17px sans-serif"; ctx.textAlign="center";
    ctx.fillText(shopToast.text,VIEW_W/2,612);
    ctx.restore();
  }
  ctx.textAlign="center";
  ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font="15px sans-serif";
  ctx.fillText("[Q / Esc] 返回",VIEW_W/2,665);
}

// ---------- 商店：购买 ----------
SCREENS.shop={
  draw(){
    shopDrawFrame("装 备 商 店");
    shopDrawCards("shop");
    shopTickToast();
  },
  onClick(x,y){
    const i=shopCardHit(x,y);
    if(i<0) return;
    const o=OUTFITS[i];
    if(Meta.isUnlocked(o.id)){ shopSay("已经拥有「"+o.name+"」啦","#9adcf0"); return; }
    const r=Meta.purchase(o.id);
    if(r.ok){ shopSay("购买成功：「"+o.name+"」已加入衣柜！","#ffd700"); Shake.add(3); }
    else if(r.reason==="poor"){ shopSay("金币不足，还差 ◉"+(Meta.outfitPrice(o.id)-Meta.data.coins),"#ff6b6b"); }
  },
};

// ---------- 衣柜：试穿换装 ----------
SCREENS.wardrobe={
  draw(){
    shopDrawFrame("衣 柜");
    shopDrawCards("wardrobe");
    shopTickToast();
  },
  onClick(x,y){
    const i=shopCardHit(x,y);
    if(i<0) return;
    const o=OUTFITS[i];
    if(!Meta.isUnlocked(o.id)){ shopSay("尚未解锁，先去商店购买吧 [B]","#ff9e9e"); return; }
    Meta.equip(o.id);
    shopSay("已换上：「"+o.name+"」",o.accent);
  },
};
