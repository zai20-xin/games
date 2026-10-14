// ===== 玩家：程序化 chibi 角色绘制（换装可见差异）=====
class Player {
  constructor(outfitId){
    this.outfit = OUTFITS.find(o=>o.id===outfitId) || OUTFITS[0];
    this.x=WORLD.w/2; this.y=WORLD.h/2;
    this.r=14; this.faceDir=1; this.walkT=0; this.moving=false;
    // 基础属性
    this.maxHp=100; this.hp=100;
    this.baseSpeed=220; this.spdMul=1;
    this.atkMul=1; this.pickupR=70;
    this.regenPct=0; this.haste=0; this.xpGain=1;
    // 时装被动
    const m=this.outfit.mods;
    if(m.maxHp){ this.maxHp*=(1+m.maxHp); this.hp=this.maxHp; }
    if(m.moveSpeed) this.spdMul+=m.moveSpeed;
    if(m.regenPct) this.regenPct=m.regenPct;
    if(m.haste) this.haste+=m.haste;
    if(m.xpGain) this.xpGain+=m.xpGain;

    this.level=1; this.xp=0; this.kills=0; this.coins=0;
    this.skills=[];          // [{id,lv}]
    this.iframes=0;
    this.trailT=0;
  }
  get speed(){
    let s=this.baseSpeed*this.spdMul;
    if(this.__chilled>0)s*=0.62;   // 冻气减速（挑战关L2）
    return s;
  }
  hasSkill(id){ return this.skills.some(s=>s.id===id); }
  skillLv(id){ const s=this.skills.find(s=>s.id===id); return s?s.lv:0; }

  gainXp(v){
    this.xp+=v*this.xpGain;
    let ups=0;
    while(this.xp>=this.xpNext()){ this.xp-=this.xpNext(); this.level++; ups++; }
    return ups;
  }
  xpNext(){ return TUNING.xp.base+this.level*TUNING.xp.perLevel; }

  update(dt,input){
    let vx=(input.right?1:0)-(input.left?1:0);
    let vy=(input.down?1:0)-(input.up?1:0);
    this.moving=(vx!==0||vy!==0);
    if(this.moving){
      const len=Math.hypot(vx,vy);
      this.x+=vx/len*this.speed*dt;
      this.y+=vy/len*this.speed*dt;
      if(vx!==0) this.faceDir=vx>0?1:-1;
      this.walkT+=dt*10;
      // 暗影时装残影拖尾 / 圣辉光环粒子
      this.trailT-=dt;
      if(this.trailT<=0){
        this.trailT=0.06;
        if(this.outfit.id==="shadow")
          spawnParticle(this.x,this.y+8,{r0:8,r1:2,life:0.3,color:"rgba(90,50,140,0.5)",shape:"circle"});
        if(this.outfit.id==="holy"&&Math.random()<0.5)
          spawnParticle(this.x+rand(-12,12),this.y+rand(-6,18),{r0:1.5,r1:3,life:0.5,color:"#ffe66d",glow:true});
        if(this.outfit.id==="flame"&&Math.random()<0.6)
          spawnParticle(this.x-this.faceDir*8,this.y+10,{r0:3,r1:1,life:0.4,color:"#ff8c42",vx:-this.faceDir*40,glow:true});
      }
    } else this.walkT=0;
    this.x=clamp(this.x,20,WORLD.w-20);
    this.y=clamp(this.y,20,WORLD.h-20);
    if(this.iframes>0) this.iframes-=dt;
    if(this.hurtFlash>0)this.hurtFlash-=dt;
    if(this.regenPct>0) this.hp=Math.min(this.maxHp,this.hp+this.maxHp*this.regenPct*dt);
  }

  hurt(dmg){
    if(this.iframes>0) return false;
    // 护盾先吸收（战术道具 shieldgen）
    if(typeof Gadgets!=="undefined"&&Gadgets.shieldHp>0){
      const rest=Gadgets.absorb(dmg);
      if(rest<=0){spawnDmgText(this.x,this.y-30,"护盾!","#7ed957");return false;}
      dmg=rest;
    }
    this.hp-=dmg;
    this.iframes=(typeof hasRelic==="function"&&hasRelic("dragonheart"))?1.0:0.5;
    this.hurtFlash=0.22;   // 受击闪白（Hollow Knight 式可读性反馈）
    if(typeof SFX!=="undefined") SFX.play("hurt");
    // 荆棘胸甲：反弹伤害
    if(typeof hasRelic==="function"&&hasRelic("thorns")){
      for(const e of enemies){
        if(dist2(e.x,e.y,this.x,this.y)<95*95) dealDamage(e,15,{color:"#8d99ae"});
      }
      burst(this.x,this.y,10,{r0:3,r1:12,life:0.35,color:"#8d99ae",shape:"shard",spdMin:60,spdMax:190,vrot:4});
    }
    Shake.add(4);
    burst(this.x,this.y,6,{r0:3,r1:1,life:0.35,color:"#ff5c5c",spdMin:60,spdMax:160});
    return true;
  }

  draw(ctx,camX,camY){
    const x=this.x-camX, y=this.y-camY;
    const bob=this.moving?Math.sin(this.walkT)*2.5:Math.sin(performance.now()/500)*1.2;
    const legSwing=this.moving?Math.sin(this.walkT)*5:0;
    const o=this.outfit;
    ctx.save();
    ctx.translate(x,y+bob);
    ctx.scale(this.faceDir,1);
    if(this.iframes>0 && Math.floor(performance.now()/80)%2===0) ctx.globalAlpha=0.45;
    ctx.lineWidth=2.5; ctx.lineJoin="round"; ctx.strokeStyle="#241a2e";
    // 阴影
    ctx.fillStyle="rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(0,16-bob,13,4.5,0,0,Math.PI*2); ctx.fill();
    // 腿
    ctx.fillStyle=o.cloth2;
    ctx.beginPath(); ctx.roundRect(-7-legSwing*0.4,6,5.5,11,2); ctx.stroke(); ctx.fill();
    ctx.beginPath(); ctx.roundRect(2+legSwing*0.4,6,5.5,11,2); ctx.stroke(); ctx.fill();
    // 身体（服装主体）
    this.drawBodyByOutfit(ctx,o);
    // 头（大头身比）
    ctx.fillStyle=o.body;
    ctx.beginPath(); ctx.arc(0,-12,11,0,Math.PI*2); ctx.stroke(); ctx.fill();
    // 头发
    ctx.fillStyle=o.hair;
    ctx.beginPath(); ctx.arc(0,-15,11,Math.PI*1.05,Math.PI*1.95); 
    ctx.lineTo(9,-13); ctx.quadraticCurveTo(0,-19,-9,-13); ctx.closePath(); ctx.fill();
    // 表情
    ctx.fillStyle="#241a2e";
    ctx.beginPath(); ctx.arc(4,-12,1.6,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-1,-12,1.6,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#241a2e"; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(1.5,-8.5,2.6,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
    ctx.restore();
  }

  drawBodyByOutfit(ctx,o){
    switch(o.id){
      case "novice": // 布衣+背包
        ctx.fillStyle=o.cloth;
        ctx.beginPath(); ctx.roundRect(-8,-3,16,11,3); ctx.stroke(); ctx.fill();
        ctx.fillStyle="#a8763e";
        ctx.beginPath(); ctx.roundRect(-13,-2,6,8,2); ctx.stroke(); ctx.fill();
        break;
      case "flame": // 飘逸红裙
        ctx.fillStyle=o.cloth;
        ctx.beginPath(); ctx.moveTo(-6,-3);
        ctx.quadraticCurveTo(-13,8,-10,13); ctx.lineTo(10,13);
        ctx.quadraticCurveTo(13,8,6,-3); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.fillStyle=o.accent;
        ctx.fillRect(-8,9,16,3);
        break;
      case "frost": // 斗篷
        ctx.fillStyle=o.cloth;
        ctx.beginPath(); ctx.moveTo(-9,-4);
        ctx.quadraticCurveTo(-12,10,-8,13); ctx.lineTo(8,13);
        ctx.quadraticCurveTo(12,10,9,-4); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.fillStyle="rgba(255,255,255,0.85)";
        ctx.fillRect(-9,11,18,2.5);
        break;
      case "storm": // 战衣+胸口核心
        ctx.fillStyle=o.cloth;
        ctx.beginPath(); ctx.roundRect(-8,-3,16,11,3); ctx.stroke(); ctx.fill();
        ctx.fillStyle=o.accent;
        ctx.beginPath(); ctx.arc(0,2,3.2,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="#fff"; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(0,2,4.6,0,Math.PI*2); ctx.stroke();
        break;
      case "shadow": // 夜行衣围巾
        ctx.fillStyle=o.cloth;
        ctx.beginPath(); ctx.roundRect(-7,-3,14,11,4); ctx.stroke(); ctx.fill();
        ctx.fillStyle=o.accent;
        ctx.beginPath(); ctx.roundRect(-9,-4,18,4,2); ctx.fill();
        break;
      case "holy": // 礼服裙摆
        ctx.fillStyle=o.cloth;
        ctx.beginPath(); ctx.moveTo(-5,-3);
        ctx.quadraticCurveTo(-14,10,-12,14); ctx.lineTo(12,14);
        ctx.quadraticCurveTo(14,10,5,-3); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.fillStyle=o.accent;
        ctx.beginPath(); ctx.arc(0,1,2,0,Math.PI*2); ctx.fill();
        break;
    }
  }
}
