// ===== v0.7 随机事件系统：每 60~90s 随机惊喜，打断节奏重复 =====
// 事件池：宝箱雨 / 诅咒祭坛(高风险高回报) / 流浪商人(局内花金币)
// 事件不暂停世界（宝箱雨），祭坛与商人用世界内交互物呈现。

const RandomEvents = {
  timer:0,                 // 距下次事件的倒计时
  nextIn:0,                // 下次间隔（秒）
  active:null,             // 当前进行中的交互事件 {kind,...}
  banner:null,             // {text,color,t}
  cardRects:[],

  reset(){
    this.timer=45; this.nextIn=0;
    this.active=null; this.banner=null; this.cardRects=[];
  },

  update(dt){
    // 倒计时到点 → 掷事件
    this.timer-=dt;
    if(this.timer<=0 && !this.active){
      this.timer=this._rollNext();
      this._trigger();
    }
    // 祭坛超时消散
    if(this.active&&this.active.kind==="altar"){
      this.active.life-=dt;
      if(this.active.life<=0){this.active=null;this._say("祭坛隐没了…","#8a7fa8");}
    }
    if(this.banner){this.banner.t-=dt;if(this.banner.t<=0)this.banner=null;}
  },

  _rollNext(){ return rand(60,90); },

  _say(text,color){ this.banner={text,color,t:2.2}; },

  _trigger(){
    const roll=Math.random();
    if(roll<0.4) this._eventChestRain();
    else if(roll<0.72) this._eventAltar();
    else this._eventMerchant();
  },

  // ---- 宝箱雨：6个圣物掉落实例从天而降 ----
  _eventChestRain(){
    this._say("🎁 宝箱雨来袭！","#ffd700");
    Shake.add(5);
    if(typeof SFX!=="undefined") SFX.play("levelup");
    for(let k=0;k<6;k++){
      const x=clamp(player.x+rand(-320,320),60,WORLD.w-60);
      const y=clamp(player.y+rand(-260,260),60,WORLD.h-60);
      drops.push({kind:"relic",def:pickRelicByRarity(rollRelicRarity(0.15)),
        rarity:null,x,y,t:rand(0,6),life:20,fallT:-k*0.18});
      const d=drops[drops.length-1]; d.rarity=d.def.rarity;
    }
  },

  // ---- 诅咒祭坛：献祭当前10%血 → 三选一强力祝福 ----
  _eventAltar(){
    // 在玩家附近生成祭坛
    const a=rand(0,Math.PI*2),d=rand(120,220);
    this.active={kind:"altar",
      x:clamp(player.x+Math.cos(a)*d,60,WORLD.w-60),
      y:clamp(player.y+Math.sin(a)*d,60,WORLD.h-60),
      life:25};
    this._say("🕯 诅咒祭坛浮现了…","#b06ad4");
  },
  altarTouch(){
    // 献祭 10% 当前生命 → 随机一个未持有的章节级强祝福
    const cost=Math.max(1,Math.round(player.hp*0.10));
    player.hp=Math.max(1,player.hp-cost);
    burst(player.x,player.y,16,{r0:3,r1:14,life:.5,color:"#b06ad4",glow:true,spdMin:60,spdMax:200});
    // 从强化池三选一
    this.active=null;
    const pool=[
      {id:"atk",name:"嗜血之力",desc:"攻击 +25%",apply:p=>{p.atkMul+=0.25;}},
      {id:"spd",name:"疾风残影",desc:"移速 +22%",apply:p=>{p.spdMul+=0.22;}},
      {id:"cd", name:"时光裂隙",desc:"冷却 -18%",apply:p=>{p.haste+=0.18;}},
    ];
    this.pendingBoon={choices:pool.map(b=>({id:b.id,name:b.name,desc:b.desc}))};
    this._boonPool=pool;
    spawnDmgText(player.x,player.y-40,"-"+cost+" 生命","#ff5c5c");
    if(typeof SFX!=="undefined") SFX.play("evolution");
  },

  // ---- 流浪商人：花金币买随机圣物/治疗 ----
  _eventMerchant(){
    const a=rand(0,Math.PI*2),d=rand(140,240);
    this.active={kind:"merchant",
      x:clamp(player.x+Math.cos(a)*d,60,WORLD.w-60),
      y:clamp(player.y+Math.sin(a)*d,60,WORLD.h-60),
      life:30,
      goods:this._rollGoods()};
    this._say("🧙 流浪商人出现了…","#7db8e8");
    if(typeof SFX!=="undefined") SFX.play("coin");
  },
  _rollGoods(){
    const g=[];
    g.push({id:"relic",name:"神秘圣物",desc:"随机稀有度圣物",price:120});
    g.push({id:"heal",name:"治愈之泉",desc:"回复 50% 生命",price:80});
    if(gameTime>150) g.push({id:"relicE",name:"史诗圣物箱",desc:"必出紫色以上",price:260});
    return g;
  },
  buy(i){
    if(!this.active||this.active.kind!=="merchant")return;
    const good=this.active.goods[i];if(!good)return;
    if(Meta.coins<good.price){
      spawnDmgText(player.x,player.y-40,"金币不足!","#ff6b6b");
      if(typeof SFX!=="undefined") SFX.play("ui");
      return;
    }
    Meta.spendCoins(good.price);   // 局内消费直接扣局外钱包
    if(good.id==="heal"){
      player.hp=Math.min(player.maxHp,player.hp+player.maxHp*0.5);
      burst(player.x,player.y,14,{r0:3,r1:12,life:.5,color:"#7ed957",glow:true,spdMin:50,spdMax:170});
      spawnDmgText(player.x,player.y-36,"+"+Math.round(player.maxHp*0.5)+" HP","#7ed957");
    } else {
      const rar=good.id==="relicE"?pick(["epic","legendary"]):rollRelicRarity(0.3);
      const def=pickRelicByRarity(rar);
      applyRelic(def);
      spawnDmgText(player.x,player.y-52,def.name+"!",RELIC_RARITY[rar].color);
    }
    if(typeof SFX!=="undefined") SFX.play("coin");
    this.active.goods.splice(i,1);
    if(!this.active.goods.length) this.active=null;
  },

  drawWorldObjects(ctx,camX,camY){
    if(!this.active)return;
    const a=this.active,x=a.x-camX,y=a.y-camY;
    const t=performance.now()/1000;
    ctx.save();ctx.translate(x,y+Math.sin(t*2.5)*2);
    if(a.kind==="altar"){
      ctx.strokeStyle="rgba(176,106,212,.85)";ctx.lineWidth=2.2;
      ctx.setLineDash([6,4]);ctx.lineDashOffset=-t*24;
      ctx.beginPath();ctx.arc(0,4,22+Math.sin(t*4)*2,0,7);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle="#3a2450";ctx.strokeStyle=OUT_COLOR();ctx.lineWidth=2.2;
      ctx.beginPath();ctx.roundRect(-13,-8,26,14,4);ctx.fill();ctx.stroke();
      const fl=.5+.5*Math.sin(t*9);
      ctx.fillStyle="rgba(176,106,212,"+(0.55+fl*.45)+")";
      ctx.beginPath();ctx.moveTo(0,-26);ctx.quadraticCurveTo(-7,-12,0,-4);
      ctx.quadraticCurveTo(7,-12,0,-26);ctx.fill();
      if(Math.random()<.3)spawnParticle(a.x+rand(-16,16),a.y+rand(-4,8),
        {r0:1.8,r1:3.4,life:.6,color:"#c084fc",vy:-34,glow:true});
    } else if(a.kind==="merchant"){
      ctx.strokeStyle="rgba(125,184,232,.75)";ctx.lineWidth=2;
      ctx.setLineDash([8,5]);ctx.lineDashOffset=t*18;
      ctx.beginPath();ctx.arc(0,6,26,0,7);ctx.stroke();
      ctx.setLineDash([]);
      // 小帐篷商贩
      ctx.fillStyle="#8a5a2b";ctx.strokeStyle=OUT_COLOR();ctx.lineWidth=2.2;
      ctx.beginPath();ctx.moveTo(-18,8);ctx.lineTo(0,-16);ctx.lineTo(18,8);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#ffd700";
      ctx.beginPath();ctx.moveTo(-18,8);ctx.lineTo(0,-16);ctx.lineTo(0,8);ctx.closePath();ctx.fill();
      ctx.fillStyle="#e8d8c0";ctx.strokeStyle=OUT_COLOR();ctx.lineWidth=1.8;
      ctx.beginPath();ctx.arc(0,-2,5.5,0,7);ctx.fill();ctx.stroke();
      dotEyesLocal(ctx,0,-3,1.2,2.2);
      ctx.fillStyle="#fff";ctx.font="bold 11px sans-serif";ctx.textAlign="center";
      ctx.fillText("💰"+a.goods.length+"件货",0,22);
    }
    ctx.restore();
  },

  // 交互检测：靠近触发
  tryInteract(){
    if(!this.active)return false;
    const a=this.active;
    if(dist2(a.x,a.y,player.x,player.y)<38*38){
      if(a.kind==="altar"){this.altarTouch();return true;}
      if(a.kind==="merchant")return "merchant-open";
    }
    return false;
  },
};

function OUT_COLOR(){return "#241a2e";}
function dotEyesLocal(c,x,y,r,gap){
  for(const s of[-1,1]){c.fillStyle="#241a2e";c.beginPath();c.arc(s*gap+x,y+r,r,0,7);c.fill();}
}

// 祭坛三选一浮层（复用弹窗契约）
RandomEvents.drawOverlay=function(ctx){
  if(!this.pendingBoon)return;
  ctx.save();
  ctx.fillStyle="rgba(10,8,20,.66)";ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.textAlign="center";
  ctx.fillStyle="#b06ad4";ctx.font="bold 32px sans-serif";
  ctx.fillText("✦ 祭坛回响 · 选择赐福 ✦",VIEW_W/2,116);
  this.cardRects=[];
  const cw=250,ch=230,gap=26;
  const x0=VIEW_W/2-(cw*3+gap*2)/2,y0=170;
  for(let i=0;i<this.pendingBoon.choices.length;i++){
    const c=this.pendingBoon.choices[i];
    const cx=x0+i*(cw+gap);
    this.cardRects.push({x:cx,y:y0,w:cw,h:ch});
    const hov=mouse.x>=cx&&mouse.x<=cx+cw&&mouse.y>=y0&&mouse.y<=y0+ch;
    ctx.shadowColor="#b06ad4";ctx.shadowBlur=hov?26:12;
    ctx.fillStyle="rgba(255,255,255,.07)";
    ctx.strokeStyle="#b06ad4";ctx.lineWidth=hov?4:2.5;
    ctx.beginPath();ctx.roundRect(cx,y0,cw,ch,16);ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle=c.color||"#fff";ctx.font="bold 21px sans-serif";
    ctx.fillText(c.name,cx+cw/2,y0+92);
    ctx.fillStyle="rgba(255,255,255,.82)";ctx.font="16px sans-serif";
    wrapText(ctx,c.desc,cx+cw/2,y0+132,cw-36,22);
    ctx.fillStyle="rgba(255,255,255,.4)";ctx.font="13px sans-serif";
    ctx.fillText(`[${i+1}]`,cx+cw/2,y0+210);
  }
  ctx.restore();
};
RandomEvents.choose=function(i){
  if(!this.pendingBoon)return;
  const c=this.pendingBoon.choices[i];
  const def=this._boonPool&&this._boonPool.find(b=>b.id===c.id);
  if(def)def.apply(player);
  burst(player.x,player.y,22,{r0:3,r1:16,life:.6,color:"#b06ad4",glow:true,spdMin:70,spdMax:240});
  spawnDmgText(player.x,player.y-42,c.name,"#b06ad4");
  if(typeof SFX!=="undefined")SFX.play("relic");
  this.pendingBoon=null;this.cardRects=[];
};

// v0.14 系统注册
if(typeof SysReg!=="undefined"&&typeof RandomEvents!=="undefined")SysReg.add("events",RandomEvents);
