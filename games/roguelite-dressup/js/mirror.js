// ===== 魔镜房：局内限时变身系统 =====
// 每 75s 生成一面魔镜（存在30s）；触碰弹出二选一时装，变身持续60s后自动换回。
// 数值被动即时生效/回退（乘区键运行时自动读取的无需处理，构造时加算的在此处理）。
// 集成：tick 调 MIRROR.update(dt)；render 调 drawWorld；选牌暂停时调 drawOverlay；
//      键盘[1]/[2]与点击路由调 choose(i)。新局调 reset()。

const MIRROR = {
  mirrors:[],          // 场上魔镜 [{x,y,t,life}]
  spawnEvery:75,       // 生成间隔（秒）
  _spawnT:0,           // 生成计时
  tempT:0,             // 变身剩余时间
  originalId:null,     // 本局原始时装
  pendingChoice:null,  // 二选一 [{id,name,accent},...]
  cardRects:[],        // 选牌卡片命中区域（供点击路由）

  // ---- 每帧更新 ----
  update(dt){
    // 变身倒计时
    if(this.tempT>0){
      this.tempT-=dt;
      if(this.tempT<=0){ this.tempT=0; this.revert(); }
    }
    // 变身中或选牌打开时不再生成新镜
    if(!this.pendingChoice && this.mirrors.length<1 && this.tempT<=0){
      this._spawnT+=dt;
      if(this._spawnT>=this.spawnEvery){
        this._spawnT=0;
        const a=rand(0,Math.PI*2), d=rand(180,320);
        this.mirrors.push({
          x:clamp(player.x+Math.cos(a)*d,40,WORLD.w-40),
          y:clamp(player.y+Math.sin(a)*d,40,WORLD.h-40),
          t:0, life:30,
        });
      }
    }
    // 触碰检测 → 弹出二选一
    if(!this.pendingChoice){
      for(let i=this.mirrors.length-1;i>=0;i--){
        const m=this.mirrors[i];
        m.t+=dt; m.life-=dt;
        if(m.life<=0){ this.mirrors.splice(i,1); continue; }
        if(dist2(m.x,m.y,player.x,player.y)<34*34){
          // 从 OUTFITS 中除当前外随机抽 2 个
          const pool=OUTFITS.filter(o=>o.id!==player.outfit.id);
          const picks=[];
          const avail=[...pool];
          while(picks.length<2&&avail.length>0)
            picks.push(avail.splice(Math.floor(Math.random()*avail.length),1)[0]);
          this.pendingChoice=picks.map(o=>({id:o.id,name:o.name,accent:o.accent}));
          this.mirrors.splice(i,1);
        }
      }
    }
  },

  // ---- 选择并变身 ----
  choose(i){
    if(!this.pendingChoice) return;
    const c=this.pendingChoice[i];
    if(c) this.switchTo(c.id);
  },

  switchTo(outfitId){
    const target=OUTFITS.find(o=>o.id===outfitId);
    if(!target) { this.pendingChoice=null; return; }
    // 正在变身先回原装，防止数值叠加污染
    if(this.tempT>0) this.revert();
    if(!this.originalId) this.originalId=player.outfit.id;
    // 回退当前时装的一次性数值（引用替换前的旧装）
    this._applyMods(player.outfit.mods,-1);
    player.outfit=target;
    this._applyMods(target.mods,+1);
    this.tempT=60;
    burst(player.x,player.y,40,{color:target.accent,glow:true,spdMin:80,spdMax:300,r0:3,r1:9,life:0.7});
    Shake.add(8);
    spawnDmgText(player.x,player.y-46,"变身！"+target.name,target.accent);
    this.pendingChoice=null;
    this.cardRects=[];
  },

  // ---- 变身结束回原装 ----
  revert(){
    if(!this.originalId) return;
    this._applyMods(player.outfit.mods,-1);
    const orig=OUTFITS.find(o=>o.id===this.originalId);
    if(orig){
      player.outfit=orig;
      this._applyMods(orig.mods,+1);
    }
    this.tempT=0;
    burst(player.x,player.y,16,{color:"#cfd8dc",spdMin:50,spdMax:160,r0:2,r1:6,life:0.4});
  },

  // ---- 一次性数值应用/回退（乘区键运行时实时读取，不在此处理）----
  _applyMods(mods,sign){
    if(!mods) return;
    for(const k in mods){
      const v=mods[k]*sign;
      if(k==="maxHp"){
        // 加成用乘法：正号 *(1+v)，负号 /(1+v)，保证精确可逆
        if(sign>0){ player.maxHp*=(1+v); player.hp=Math.min(player.maxHp,player.hp*(1+v)); }
        else { player.maxHp/=(1-v); player.hp=Math.min(player.maxHp,player.hp); }
      }
      else if(k==="moveSpeed") player.spdMul+=v;
      else if(k==="regenPct")  player.regenPct+=v;
      else if(k==="haste")     player.haste+=v;
      else if(k==="xpGain")    player.xpGain+=v;
    }
  },

  // ---- 场景绘制：漩涡镜门 ----
  drawWorld(ctx,camX,camY){
    for(const m of this.mirrors){
      const x=m.x-camX,y=m.y-camY;
      if(x<-60||y<-60||x>VIEW_W+60||y>VIEW_H+60) continue;
      ctx.save();
      ctx.translate(x,y+Math.sin(m.t*3)*3);
      // 双圈旋转虚线椭圆
      for(let ring=0;ring<2;ring++){
        ctx.rotate(0); // 保持椭圆水平
        ctx.strokeStyle=ring===0?"rgba(176,106,212,0.9)":"rgba(255,255,255,0.55)";
        ctx.lineWidth=ring===0?3:1.5;
        ctx.setLineDash([7,5]);
        ctx.lineDashOffset=(ring?-1:1)*m.t*22;
        ctx.beginPath(); ctx.ellipse(0,0,20-ring*5,27-ring*6,0,0,Math.PI*2); ctx.stroke();
      }
      ctx.setLineDash([]);
      // 中心闪光
      const fl=0.5+0.5*Math.sin(m.t*5);
      ctx.fillStyle="rgba(210,75,208,"+(0.25+fl*0.35)+")";
      ctx.beginPath(); ctx.ellipse(0,0,12,18,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,"+(0.5+fl*0.4)+")";
      ctx.beginPath(); ctx.arc(-4,-8,2.5+fl,0,Math.PI*2); ctx.fill();
      // 即将消散闪烁
      if(m.life<5&&Math.floor(m.life*6)%2===0){
        ctx.globalAlpha=0.35;
        ctx.strokeStyle="#fff";
        ctx.beginPath(); ctx.ellipse(0,0,24,31,0,0,Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }
  },

  // ---- 选牌浮层 ----
  drawOverlay(ctx){
    if(!this.pendingChoice) return;
    ctx.save();
    ctx.fillStyle="rgba(10,8,20,0.6)"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.textAlign="center";
    ctx.fillStyle="#ffe66d"; ctx.font="bold 34px sans-serif";
    ctx.fillText("✦ 魔镜闪现 · 选择变身形态 ✦",VIEW_W/2,86);
    ctx.font="15px sans-serif"; ctx.fillStyle="rgba(255,255,255,0.65)";
    ctx.fillText("变身持续 60 秒，结束后自动换回",VIEW_W/2,114);
    this.cardRects=[];
    const cw=160,ch=190,gap=24;
    const x0=VIEW_W/2-(cw*2+gap)/2, y0=150;
    for(let i=0;i<this.pendingChoice.length;i++){
      const c=this.pendingChoice[i];
      const cx=x0+i*(cw+gap);
      this.cardRects.push({x:cx,y:y0,w:cw,h:ch});
      const hov=mouse.x>=cx&&mouse.x<=cx+cw&&mouse.y>=y0&&mouse.y<=y0+ch;
      ctx.shadowColor=c.accent; ctx.shadowBlur=hov?26:12;
      ctx.fillStyle="rgba(255,255,255,0.08)";
      ctx.strokeStyle=c.accent; ctx.lineWidth=hov?4:2.5;
      ctx.beginPath(); ctx.roundRect(cx,y0,cw,ch,14); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0;
      // 时装预览小人
      const o=OUTFITS.find(o=>o.id===c.id);
      if(o&&typeof drawOutfitPreview==="function") drawOutfitPreview(ctx,o,cx+cw/2,y0+72);
      ctx.fillStyle="#fff"; ctx.font="bold 17px sans-serif";
      ctx.fillText(c.name,cx+cw/2,y0+140);
      ctx.fillStyle=c.accent; ctx.font="13px sans-serif";
      ctx.fillText("变身 60s",cx+cw/2,y0+162);
      ctx.fillStyle="rgba(255,255,255,0.45)"; ctx.font="bold 15px sans-serif";
      ctx.fillText("["+ (i+1) +"]",cx+cw/2,y0+182);
    }
    ctx.restore();
  },

  reset(){
    this.mirrors=[]; this._spawnT=0; this.tempT=0;
    this.originalId=null; this.pendingChoice=null; this.cardRects=[];
  },
};

// v0.14 系统注册
if(typeof SysReg!=="undefined")SysReg.add("mirror",MIRROR);
