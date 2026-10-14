// ===== 技能下半：毒雾 / 圣光 / 飞刀 / 地刺 / 星陨 =====

// ---------- 5. 剧毒瘴气 ----------
let psCd=0;
function updatePoison(dt){
  const lv=player.skillLv("poison");
  if(lv<=0){ psCd=0; return; }
  psCd-=dt;
  if(psCd<=0){
    psCd=4.0*(1-player.haste);
    const t=nearestEnemy(player.x,player.y,0);
    if(!t){ psCd=0.3; return; }
    zones.push({
      kind:"poison", x:t.x, y:t.y, r:65*(lv>=3?1.3:1),
      dmg:6*(lv>=2?1.3:1), dur:3*(lv>=4?1.5:1),
      spore:lv>=5, tick:0
    });
  }
}
function updateZones(dt){
  for(let i=zones.length-1;i>=0;i--){ const z=zones[i];
    z.dur-=dt; z.tick-=dt;
    if(z.tick<=0){
      z.tick=0.5;
      hitArea(z.x,z.y,z.r,(e)=>{
        dealDamage(e,z.dmg,{element:"poison",color:"#7ac74f"});
        e.poisoned=true; e.poisonT=0.6;
      });
      for(let k=0;k<4;k++)
        spawnParticle(z.x+rand(-z.r,z.r)*0.8,z.y+rand(-z.r,z.r)*0.8,
          {r0:2,r1:6,life:rand(0.4,0.9),color:"rgba(122,199,79,0.45)",vy:-20});
    }
    if(z.dur<=0){
      if(z.spore){ // Lv5 孢子爆裂
        burst(z.x,z.y,24,{r0:3,r1:14,life:0.5,color:"#a3d977",glow:true,spdMin:80,spdMax:240});
        spawnParticle(z.x,z.y,{r0:10,r1:z.r*1.4,life:0.35,color:"rgba(163,217,119,0.5)",shape:"ring"});
        hitArea(z.x,z.y,z.r*1.3,(e)=>dealDamage(e,18,{element:"spore",color:"#a3d977"}));
      }
      zones.splice(i,1);
    }
  }
}
function drawZones(ctx,camX,camY){
  for(const z of zones){
    const x=z.x-camX,y=z.y-camY;
    ctx.save();
    for(let i=0;i<3;i++){
      ctx.globalAlpha=0.16+0.05*i;
      ctx.fillStyle=i%2?"#7ac74f":"#9b6bb3";
      ctx.beginPath(); ctx.arc(x,y,z.r*(0.75+i*0.15),0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=0.7; ctx.fillStyle="#c8e6a0";
    for(let i=0;i<3;i++){
      const a=performance.now()/400+i*2.1;
      ctx.beginPath(); ctx.arc(x+Math.cos(a)*z.r*0.55,y+Math.sin(a)*z.r*0.55,2.5,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

// ---------- 6. 圣光脉冲 ----------
let hpCd=0;
function updateHolypulse(dt){
  const lv=player.skillLv("holypulse");
  if(lv<=0){ hpCd=0; return; }
  hpCd-=dt;
  if(hpCd<=0){
    hpCd=5*(lv>=3?0.75:1)*(1-player.haste);
    shockwaves.push({x:player.x,y:player.y,r0:30,maxR:420,life:0.45,maxLife:0.45,
      color:"#ffe66d",width:10,glowy:true,
      element:"holy",dmg:14*(lv>=2?1.4:1),
      knockback:(180*(lv>=4?1.5:1))*(lv>=5?2:1),
      blind:lv>=5?1.5:0,hitDone:false});
    burst(player.x,player.y,12,{r0:3,r1:10,life:0.4,color:"#fff3b0",glow:true,spdMin:60,spdMax:200});
    Shake.add(2);
  }
}

// ---------- 7. 暗影飞刀 ----------
let knCd=0;
function updateKnives(dt){
  const lv=player.skillLv("knives");
  if(lv<=0){ knCd=0; return; }
  knCd-=dt;
  if(knCd<=0){
    knCd=0.45*(1-player.haste);
    let count=2+(outfitMods().daggerExtra||0);
    if(lv>=3) count=Math.max(count,3);
    if(lv===5) count=7;
    const dmg=9*((lv>=2?1.3:1)*(lv>=4?1.4:1));
    const aim=aimAngle();
    for(let k=0;k<count;k++){
      const spread=count>2?(k-(count-1)/2)*0.16:rand(-0.04,0.04);
      const a=aim+spread;
      projectiles.push({kind:"knife",x:player.x,y:player.y,
        vx:Math.cos(a)*640, vy:Math.sin(a)*640, r:6,
        dmg, life:1.1, pierce:1, element:"dark", color:"#b06ad4"});
    }
  }
}
function aimAngle(){
  const t=nearestEnemy(player.x,player.y,0);
  if(t) return Math.atan2(t.y-player.y,t.x-player.x);
  return player.faceDir>0?0:Math.PI;
}
function drawKnifeShape(p,x,y){
  ctx.save(); ctx.translate(x,y);
  ctx.rotate(Math.atan2(p.vy,p.vx));
  ctx.fillStyle="#b06ad4"; ctx.strokeStyle="#241a2e"; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-6,-4); ctx.lineTo(-3,0); ctx.lineTo(-6,4);
  ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
}

// ---------- 投射物统一更新/绘制（火球 + 飞刀共用池）----------
function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){ const p=projectiles[i];
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
    // 尾迹粒子
    if(p.kind==="fireball"&&Math.random()<0.7)
      spawnParticle(p.x,p.y,{r0:5,r1:1,life:0.3,color:Math.random()<0.5?"#ff8c42":"#ffb347",glow:true});
    if(p.kind==="knife")
      spawnParticle(p.x,p.y,{r0:3,r1:1,life:0.18,color:"rgba(176,106,212,0.5)"});
    let dead=p.life<=0;
    if(!dead){
      // 决斗特化：追踪火球转向
      if(p.kind==="duelfire"&&p.target&&enemies.includes(p.target)){
        const want=Math.atan2(p.target.y-p.y,p.target.x-p.x);
        const cur=Math.atan2(p.vy,p.vx);
        let diff=want-cur;
        while(diff>Math.PI)diff-=Math.PI*2;
        while(diff<-Math.PI)diff+=Math.PI*2;
        const na=cur+clamp(diff,-p.turn*dt,p.turn*dt);
        p.vx=Math.cos(na)*380;p.vy=Math.sin(na)*380;
      }
      // 敌方弹幕：只打玩家，与玩家弹互不干扰
      if(p.kind==="enemybullet"||p.kind==="icicle"||p.kind==="frostbreath"||p.kind==="shadowblade"){
        const d2p=dist2(p.x,p.y,player.x,player.y);
        if(d2p<(p.r+player.r)*(p.r+player.r)){
          player.hurt(p.dmg);
          // 冻气弹附加减速
          if(p.kind==="frostbreath"){player.spdMul=Math.max(.5,player.spdMul-0);player.__chilled=1.4;}
          burst(p.x,p.y,6,{r0:2,r1:7,life:0.25,color:p.color,spdMin:40,spdMax:140});
          dead=true;
        }
      } else
      for(const e of enemies){
        if(dist2(p.x,p.y,e.x,e.y)<(p.r+e.r)*(p.r+e.r)){
          if(p.kind==="fireball"){ explodeFireball(p); dead=true; }
          else {
            dealDamage(e,p.dmg,{element:p.element,color:p.color});
            burst(p.x,p.y,4,{r0:2,r1:6,life:0.22,color:p.color,spdMin:30,spdMax:120});
            p.pierce--; if(p.pierce<0) dead=true;
          }
          break;
        } }
    }
    // 敌弹出界或超时清理（世界坐标）
    if(!dead&&(p.kind==="enemybullet")&&
       (p.x<-100||p.y<-100||p.x>WORLD.w+100||p.y>WORLD.h+100)) dead=true;
    if(dead) projectiles.splice(i,1);
  }
}
function drawProjectiles(ctx,camX,camY){
  for(const p of projectiles){
    const x=p.x-camX,y=p.y-camY;
    if(p.kind==="enemybullet"){
      // 敌方弹幕：红/橙光珠+外圈描边，与玩家弹视觉明确区分
      ctx.save();
      ctx.fillStyle=p.color; ctx.strokeStyle="#fff"; ctx.lineWidth=1.5;
      ctx.shadowColor=p.color; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.beginPath(); ctx.arc(x,y,p.r-2,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    } else if(p.kind==="icicle"){
      // 冰棱：尖锥朝下
      ctx.save();ctx.translate(x,y);
      ctx.fillStyle="#dff3fb";ctx.strokeStyle="#241a2e";ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(-6,-8);ctx.lineTo(6,-8);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="rgba(255,255,255,.7)";
      ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(-2.4,-5);ctx.lineTo(1.4,-5);
      ctx.closePath();ctx.fill();
      ctx.restore();
    } else if(p.kind==="frostbreath"){
      // 冻气团：半透明蓝白雾球
      ctx.save();
      const g=ctx.createRadialGradient(x,y,1,x,y,p.r+3);
      g.addColorStop(0,"rgba(255,255,255,.85)");
      g.addColorStop(.6,"rgba(205,238,253,.6)");
      g.addColorStop(1,"rgba(165,227,247,0)");
      ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(x,y,p.r+3,0,Math.PI*2);ctx.fill();
      ctx.restore();
    } else if(p.kind==="shadowblade"){
      // 影刃：紫色细月牙
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(p.vy,p.vx));
      ctx.fillStyle=p.color;ctx.strokeStyle="#241a2e";ctx.lineWidth=1.4;
      ctx.beginPath();ctx.moveTo(11,0);
      ctx.quadraticCurveTo(2,-6,-8,-2);
      ctx.quadraticCurveTo(-2,0,-8,2);
      ctx.quadraticCurveTo(2,6,11,0);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
    } else if(p.kind==="duelfire"){
      // 决斗追踪火球：更大更亮
      ctx.save();
      const g=ctx.createRadialGradient(x,y,1,x,y,p.r+8);
      g.addColorStop(0,"#fff5cc");g.addColorStop(.5,"#ff8c42");g.addColorStop(1,"rgba(255,80,30,0)");
      ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(x,y,p.r+8,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#c94f2a";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(x,y,p.r*0.75,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    } else if(p.kind==="duelspear"){
      // 雷神之矛：金色长矛
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(p.vy,p.vx));
      ctx.strokeStyle="#fff3a0";ctx.lineWidth=4;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(10,0);ctx.stroke();
      ctx.fillStyle="#ffd93d";ctx.strokeStyle="#241a2e";ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(6,-5);ctx.lineTo(6,5);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
    } else if(p.kind==="fireball"){
      ctx.save();
      const g=ctx.createRadialGradient(x,y,1,x,y,p.r+6);
      g.addColorStop(0,"#fff5cc"); g.addColorStop(0.5,"#ff8c42"); g.addColorStop(1,"rgba(255,80,30,0)");
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(x,y,p.r+6,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#c94f2a"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(x,y,p.r*0.75,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    } else drawKnifeShape(p,x,y);
  }
}

// ---------- 8. 大地震击 ----------
let qkCd=0, quakeQueue=[];
function updateQuake(dt){
  const lv=player.skillLv("quake");
  if(lv<=0){ qkCd=0; return; }
  qkCd-=dt;
  if(qkCd<=0){
    qkCd=2.8*(1-player.haste)*(lv>=3?0.8:1);
    // 找敌人密集处破土
    let targets=[];
    for(let k=0;k<(lv>=3?2:1);k++){
      const t=k===0?nearestEnemy(player.x,player.y,0):nearestEnemy(player.x,player.y,60);
      if(t) targets.push(t);
    }
    for(const t of targets) quakeQueue.push({x:t.x,y:t.y,warn:0.35,lv});
  }
  for(let i=quakeQueue.length-1;i>=0;i--){ const q=quakeQueue[i];
    q.warn-=dt;
    if(q.warn<=0){
      quakeErupt(q.x,q.y,q.lv);
      quakeQueue.splice(i,1);
    } }
}
function quakeErupt(x,y,lv){
  const dmg=26*((lv>=2?1.3:1)*(lv>=4?1.4:1));
  // 尖刺锥体粒子
  for(let k=0;k<5;k++)
    spawnParticle(x+rand(-14,14),y+rand(-6,10),{r0:2,r1:rand(12,20),life:rand(0.35,0.6),
      color:k%2?"#a3855c":"#8d99ae",shape:"shard",vy:-40,grav:160,vrot:rand(-4,4)});
  spawnParticle(x,y,{r0:6,r1:44,life:0.3,color:"rgba(164,133,92,0.5)",shape:"ring"});
  burst(x,y,8,{r0:2,r1:5,life:0.4,color:"#6c584c",spdMin:50,spdMax:170,grav:220});
  hitArea(x,y,42,(e)=>{ dealDamage(e,dmg,{element:"earth",color:"#c49a6c"});
    if(!e.isBoss){ e.launchT=0.4; e.knockVx=(e.x-x)*6; e.knockVy=(e.y-y)*6; } });
  Shake.add(4);
}
function drawQuakeWarn(ctx,camX,camY){
  for(const q of quakeQueue){
    const x=q.x-camX,y=q.y-camY;
    ctx.save();
    ctx.globalAlpha=0.4+0.3*Math.sin(performance.now()/40);
    ctx.strokeStyle="#c49a6c"; ctx.lineWidth=2; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.arc(x,y,36,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle="rgba(196,154,108,0.25)";
    ctx.beginPath(); ctx.arc(x,y,30,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ---------- 9. 星陨术 ----------
let sfCd=0, starfallQueue=[];
function updateStarfall(dt){
  const lv=player.skillLv("starfall");
  if(lv<=0){ sfCd=0; return; }
  sfCd-=dt;
  if(sfCd<=0){
    sfCd=5.5*(1-player.haste);
    const n=lv>=3?(lv>=5?3:2):1;
    for(let k=0;k<n;k++){
      // 落在玩家附近最密集处（简化：随机屏内偏移）
      const a=rand(0,Math.PI*2), d=rand(60,260);
      starfallQueue.push({x:player.x+Math.cos(a)*d, y:player.y+Math.sin(a)*d,
        warn:0.6+k*0.15, delay:0.55+k*0.15, lv});
    }
  }
  for(let i=starfallQueue.length-1;i>=0;i--){ const s=starfallQueue[i];
    s.delay-=dt;
    if(s.delay<=0){
      starImpact(s.x,s.y,s.lv);
      starfallQueue.splice(i,1);
    } }
}
function starImpact(x,y,lv){
  const R=70*(lv>=4?1.3:1);
  const dmg=45*(lv>=2?1.3:1);
  // 流星拖尾
  beams.push({x1:x-260,y1:y-420,x2:x,y2:y,life:0.28,maxLife:0.28,color:"#c084fc"});
  burst(x,y,26,{r0:4,r1:20,life:0.55,color:"#9d6ff0",glow:true,spdMin:90,spdMax:300});
  burst(x,y,10,{r0:3,r1:12,life:0.5,color:"#ffb347",spdMin:60,spdMax:200,grav:150});
  spawnParticle(x,y,{r0:12,r1:R+16,life:0.4,color:"rgba(160,110,240,0.5)",shape:"ring"});
  hitArea(x,y,R,(e)=>dealDamage(e,dmg,{element:"arcane",color:"#c084fc"}));
  Shake.add(7);
}
function drawStarfallWarn(ctx,camX,camY){
  for(const s of starfallQueue){
    const x=s.x-camX,y=s.y-camY;
    ctx.save();
    ctx.globalAlpha=0.35+0.3*Math.sin(performance.now()/50);
    ctx.strokeStyle="#c084fc"; ctx.lineWidth=2.5; ctx.setLineDash([7,5]);
    ctx.beginPath(); ctx.arc(x,y,64,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x-70,y); ctx.lineTo(x+70,y);
    ctx.moveTo(x,y-70); ctx.lineTo(x,y+70); ctx.stroke();
    ctx.restore();
  }
}

// ---------- 技能总调度 ----------
function updateSkills(dt){
  updateFireball(dt); updateFrostnova(dt); updateChainbolt(dt); updateBlades(dt);
  updatePoison(dt); updateHolypulse(dt); updateKnives(dt); updateQuake(dt); updateStarfall(dt);
  updateProjectiles(dt); updateShockwaves(dt); updateBeams(dt); updateZones(dt);
  updateDelayed(dt);
}
