// ===== 掉落导演：微掉落 / 圣物拾取 / 宝箱轮盘仪式 =====
let drops=[];            // 场上掉落物
let chestRitual=null;    // 宝箱开启动画状态
const SOFT_PITY = { kills:0, granted:false };  // 软保底：300杀必出圣物

// ---------- L1 微掉落 ----------
function rollMicroDrop(x,y){
  const lowHp=player.hp/player.maxHp<0.3;
  const potionChance=lowHp?0.08:0.04;
  const r=Math.random();
  if(r<potionChance) return drops.push({kind:"potion",x,y,t:rand(0,6),life:25});
  if(r<potionChance+0.006) return drops.push({kind:"magnet",x,y,t:0,life:25});
}

// ---------- L2 圣物掉落（精英/Boss/软保底）----------
function dropRelic(x,y,forcedRarity,luckBonus){
  const rarity=forcedRarity||rollRelicRarity(luckBonus||0);
  const def=pickRelicByRarity(rarity);
  drops.push({kind:"relic",def,rarity,x,y,t:0,life:9999});
}
function checkSoftPity(){
  if(SOFT_PITY.granted) return;
  SOFT_PITY.kills++;
  if(SOFT_PITY.kills>=300){
    SOFT_PITY.granted=true;
    dropRelic(player.x+rand(-60,60),player.y+rand(-60,60),null,0.5);
  }
}

// ---------- 拾取与生效 ----------
function applyRelic(def){
  player.relics=player.relics||[];
  if(player.relics.length>=6){ // 满了自动换成等值金币
    const bonus={common:15,rare:40,epic:100,legendary:250}[def.rarity];
    player.coins+=bonus;
    spawnDmgText(player.x,player.y-30,"+"+bonus+"金币","#ffd700");
    return;
  }
  player.relics.push({id:def.id,name:def.name,rarity:def.rarity});
  if(def.apply) def.apply(player);
  burst(player.x,player.y,20,{r0:3,r1:16,life:0.6,color:RELIC_RARITY[def.rarity].color,glow:true,spdMin:70,spdMax:230});
  Shake.add(3);
  spawnDmgText(player.x,player.y-34,def.name+"!",RELIC_RARITY[def.rarity].color);
}

// ---------- 宝箱轮盘仪式（多巴胺峰值时刻）----------
function openChestRitual(x,y,forcedRarity){
  if(chestRitual) return;   // 同屏只进行一个仪式
  const luck=0.35+(gameTime/600)*0.4;   // 越到后期越容易出好货
  chestRitual={
    x,y, t:0,
    phase:"beam",        // beam→spin→land
    rarity: forcedRarity||rollRelicRarity(luck),
    spinT:1.8, shownIdx:0, shownTimer:0,
    order:["common","rare","epic","legendary"],
  };
  Shake.add(4);
}
function updateChestRitual(dt){
  if(!chestRitual) return;
  const c=chestRitual; c.t+=dt;
  if(c.phase==="beam"){
    if(c.t>0.7){ c.phase="spin"; c.t=0;
      burst(c.x,c.y-20,18,{r0:3,r1:12,life:0.5,color:"#ffe66d",glow:true,spdMin:60,spdMax:180}); }
  } else if(c.phase==="spin"){
    c.shownTimer-=dt;
    if(c.shownTimer<=0){
      c.shownTimer=Math.min(0.28,0.06+c.t*0.09);  // 逐渐减速
      c.shownIdx=(c.shownIdx+1)%4;
      spawnParticle(c.x,c.y-26,{r0:3,r1:7,life:0.3,color:RELIC_RARITY[c.order[c.shownIdx]].color,glow:true,vy:-40});
    }
    c.spinT-=dt;
    if(c.spinT<=0){
      c.phase="land"; c.t=0;
      // 强制定格在真实稀有度上
      while(c.order[c.shownIdx]!==c.rarity) c.shownIdx=(c.shownIdx+1)%4;
      const col=RELIC_RARITY[c.rarity].color;
      burst(c.x,c.y-20,c.rarity==="legendary"?60:30,{r0:3,r1:c.rarity==="legendary"?24:14,life:0.8,color:col,glow:true,spdMin:90,spdMax:320});
      spawnParticle(c.x,c.y-20,{r0:10,r1:70,life:0.5,color:col,shape:"ring"});
      Shake.add(c.rarity==="legendary"?12:(c.rarity==="epic"?8:5));
    }
  } else if(c.phase==="land"){
    if(c.t>0.55){
      dropRelic(c.x,c.y-10,c.rarity,0);
      chestRitual=null;
    }
  }
}
function drawChestRitual(ctx,camX,camY){
  if(!chestRitual) return;
  const c=chestRitual, x=c.x-camX, y=c.y-camY;
  ctx.save();
  if(c.phase==="beam"){ // 光柱
    const a=0.5+0.3*Math.sin(c.t*20);
    const g=ctx.createLinearGradient(0,y-400,0,y);
    g.addColorStop(0,"rgba(255,230,109,0)");
    g.addColorStop(1,"rgba(255,230,109,"+a+")");
    ctx.fillStyle=g; ctx.fillRect(x-22,y-400,44,400);
  } else { // 轮盘卡片
    const rar=c.order[c.shownIdx], col=RELIC_RARITY[rar].color;
    const scale=c.phase==="spin"?1:1+Math.sin(Math.min(1,c.t/0.2)*Math.PI)*0.25;
    ctx.translate(x,y-46); ctx.scale(scale,scale);
    ctx.shadowColor=col; ctx.shadowBlur=25;
    ctx.fillStyle="rgba(20,16,36,0.92)";
    ctx.strokeStyle=col; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.roundRect(-58,-32,116,64,12); ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle=col; ctx.font="bold 17px sans-serif"; ctx.textAlign="center";
    ctx.fillText(RELIC_RARITY[rar].name,0,-4);
    ctx.fillStyle="#fff"; ctx.font="bold 13px sans-serif";
    ctx.fillText({common:"★",rare:"★★",epic:"★★★",legendary:"★★★★"}[rar],0,18);
    ctx.restore();
  }
}

// ---------- 掉落物更新与绘制 ----------
function updateDrops(dt){
  for(let i=drops.length-1;i>=0;i--){ const d=drops[i];
    d.t+=dt; d.life-=dt;
    const d2=dist2(d.x,d.y,player.x,player.y);
    // 磁力水晶触发：全场吸金吸晶体
    if(d.kind==="magnet"&&d2<player.pickupR*player.pickupR){
      for(const g of xpGems) g.magnet=true;
      for(const o of drops) if(o!==d&&(o.kind==="coin"||o.kind==="gem")) o.magnet=true;
      burst(player.x,player.y,24,{r0:4,r1:18,life:0.6,color:"#7db8e8",glow:true,spdMin:80,spdMax:260});
      spawnDmgText(player.x,player.y-30,"磁力全收!","#7db8e8");
      Shake.add(3); drops.splice(i,1); continue;
    }
    // 血瓶
    if(d.kind==="potion"&&d2<(player.r+12)*(player.r+12)){
      const heal=Math.round(player.maxHp*0.2);
      player.hp=Math.min(player.maxHp,player.hp+heal);
      spawnDmgText(player.x,player.y-28,"+"+heal,"#7ed957");
      burst(player.x,player.y,10,{r0:3,r1:9,life:0.45,color:"#7ed957",glow:true,spdMin:50,spdMax:150});
      if(typeof SFX!=="undefined") SFX.play("potion");
      drops.splice(i,1); continue;
    }
    // 圣物
    if(d.kind==="relic"&&d2<(player.r+16)*(player.r+16)){
      applyRelic(d.def);
      if(typeof SFX!=="undefined") SFX.play("relic");
      drops.splice(i,1); continue;
    }
    if(d.life<=0) drops.splice(i,1);
  }
}
function drawDrops(ctx,camX,camY){
  for(const d of drops){
    const x=d.x-camX, y=d.y-camY+Math.sin(d.t*3)*3;
    const blink=d.life<4&&Math.floor(d.life*6)%2===0;
    ctx.save();
    if(blink) ctx.globalAlpha=0.35;
    if(d.kind==="potion"){
      ctx.fillStyle="#ef476f"; ctx.strokeStyle="#241a2e"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(x-5,y-4,10,12,3); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#7ed957"; ctx.fillRect(x-3,y-8,6,4);
      ctx.fillStyle="rgba(255,255,255,0.75)";
      ctx.beginPath(); ctx.arc(x-1.5,y-1,1.5,0,Math.PI*2); ctx.fill();
    } else if(d.kind==="magnet"){
      ctx.rotate(d.t*2);
      ctx.fillStyle="#7db8e8"; ctx.strokeStyle="#241a2e"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-7,-6); ctx.lineTo(-7,4); ctx.arc(0,4,7,Math.PI,0,true); ctx.lineTo(7,-6);
      ctx.lineWidth=5; ctx.strokeStyle="#7db8e8"; ctx.stroke();
      ctx.strokeStyle="#fff"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-7,-6); ctx.lineTo(-7,4); ctx.arc(0,4,7,Math.PI,0,true); ctx.lineTo(7,-6);
      ctx.stroke();
    } else if(d.kind==="relic"){
      const col=RELIC_RARITY[d.rarity].color;
      const pulse=1+Math.sin(d.t*4)*0.12;
      ctx.translate(x,y); ctx.scale(pulse,pulse);
      ctx.shadowColor=col; ctx.shadowBlur=18;
      // 底座菱形
      ctx.fillStyle="rgba(20,16,36,0.9)"; ctx.strokeStyle=col; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(11,0); ctx.lineTo(0,13); ctx.lineTo(-11,0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0;
      ctx.fillStyle=col; ctx.font="bold 12px sans-serif"; ctx.textAlign="center";
      ctx.fillText(d.def.icon,0,4.5);
    }
    ctx.restore();
  }
}
