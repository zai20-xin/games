// ===== 敌人：5 类 + 精英 + Boss =====
let enemies=[];

function spawnEnemy(type,x,y,isElite){
  const t=ENEMY_TYPES[type];
  const timeScale=1+gameTime/60*TUNING.enemyHp.timeScalePerMin;   // 血量随分钟成长
  const e={
    type, x, y,
    r:isElite?t.r*1.8:t.r,
    hp:t.hp*timeScale*(isElite?6:1),
    maxHp:t.hp*timeScale*(isElite?6:1),
    speed:t.speed*(1+gameTime/60*0.04)*(isElite?0.9:1),
    dmg:t.dmg*(1+gameTime/60*0.08)*(isElite?1.5:1),
    xp:t.xp*(isElite?10:1), coin:t.coin*(isElite?15:1),
    color:t.color, isElite:!!isElite, isBoss:false,
    sinePhase:rand(0,Math.PI*2), hitFlash:0, slowT:0, slowK:0,
    freezeT:0, blindT:0, knockVx:0, knockVy:0, launchT:0,
    fuse:-1, wobble:rand(0,Math.PI*2),
  };
  enemies.push(e);
  return e;
}

function spawnBoss(x,y){
  const e={
    type:"boss", x, y, r:46,
    hp:2600*(1+gameTime/60*0.3), maxHp:2600*(1+gameTime/60*0.3),
    speed:55, dmg:30, xp:120, coin:200,
    color:"#c0392b", isElite:false, isBoss:true,
    sinePhase:0, hitFlash:0, slowT:0, slowK:0, freezeT:0, blindT:0,
    knockVx:0, knockVy:0, launchT:0, fuse:-1, wobble:0,
    chargeCd:3, charging:0, chargeVx:0, chargeVy:0,
    // v0.4 三阶段状态机：phase1 追击+冲锋 / phase2 弹幕环 / phase3 狂暴
    phase:1,
    patternCd:2.5,       // 阶段技能冷却
    ringCount:0,         // 已放弹幕环次数（phase2 用）
  };
  enemies.push(e);
  return e;
}
// Boss 弹幕（复用全局 projectiles 池，敌弹标记 hostile）
function bossFireRing(e,n,speed){
  for(let k=0;k<n;k++){
    const a=k/n*Math.PI*2+e.wobble*0.1;
    projectiles.push({kind:"enemybullet",x:e.x,y:e.y,
      vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:7,
      dmg:12,life:4,pierce:99,element:"hostile",color:"#ff5c5c"});
  }
  burst(e.x,e.y,14,{r0:3,r1:12,life:0.35,color:"#ff8080",glow:true,spdMin:40,spdMax:150});
  if(typeof SFX!=="undefined") SFX.play("ring");
}

function updateEnemies(dt){
  const p=player;
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if(e.hitFlash>0) e.hitFlash-=dt;
    if(e.slowT>0) e.slowT-=dt;
    if(e.freezeT>0){ e.freezeT-=dt; }
    if(e.blindT>0) e.blindT-=dt;
    if(e.launchT>0) e.launchT-=dt;

    // 击退速度衰减
    e.x+=e.knockVx*dt; e.y+=e.knockVy*dt;
    e.knockVx*=Math.pow(0.001,dt); e.knockVy*=Math.pow(0.001,dt);

    let canMove = e.freezeT<=0 && e.launchT<=0 && !e.blindT;
    let dx=p.x-e.x, dy=p.y-e.y;
    const d=Math.hypot(dx,dy)||1;

    if(canMove){
      let sp=e.speed*(e.slowT>0?(1-e.slowK):1);
      if(e.type==="boss"){
        // 挑战关专属Boss走独立AI（L2寒霜/L3影武者）
        if(window.__challengeBossKind
           &&typeof updateChallengeBossAI==="function"
           &&updateChallengeBossAI(e,dt,d,dx,dy)){
          // 专属AI已处理移动与攻击
        }
        // v0.4 三阶段：血量 66%/33% 切换，阶段切换有爆发演出
        else{
        const hpPct=e.hp/e.maxHp;
        if(e.phase===1&&hpPct<=0.66){
          e.phase=2; e.patternCd=1.2;
          burst(e.x,e.y,30,{r0:4,r1:20,life:0.6,color:"#ff5c5c",glow:true,spdMin:80,spdMax:280});
          spawnDmgText(e.x,e.y-e.r-14,"深渊魔王 · 弹幕形态!","#ff5c5c");
          Shake.add(8);
          if(typeof SFX!=="undefined") SFX.play("bosspawn");
        } else if(e.phase===2&&hpPct<=0.33){
          e.phase=3; e.patternCd=1.0;
          e.speed*=1.35;
          burst(e.x,e.y,40,{r0:4,r1:24,life:0.7,color:"#ffd93d",glow:true,spdMin:90,spdMax:320});
          spawnDmgText(e.x,e.y-e.r-14,"狂暴化!!","#ffd93d");
          Shake.add(12);
          if(typeof SFX!=="undefined") SFX.play("bosspawn");
        }
        // Boss：平时追击，每几秒冲锋一次；阶段技能按冷却释放
        e.chargeCd-=dt;
        e.patternCd-=dt;
        if(e.charging>0){
          e.charging-=dt;
          e.x+=e.chargeVx*dt; e.y+=e.chargeVy*dt;
        } else {
          e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt;
          if(e.phase>=3&&e.patternCd<=0){
            // 狂暴：召唤两只蝙蝠 + 扇形三连弹
            e.patternCd=2.6;
            for(let k=0;k<2;k++)
              spawnEnemy("bat",e.x+rand(-50,50),e.y+rand(-50,50),false);
            const baseA=Math.atan2(dy,dx);
            for(let k=-1;k<=1;k++){
              const a=baseA+k*0.45;
              projectiles.push({kind:"enemybullet",x:e.x,y:e.y,
                vx:Math.cos(a)*260,vy:Math.sin(a)*260,r:7,
                dmg:12,life:4,pierce:99,element:"hostile",color:"#ffb347"});
            }
            burst(e.x,e.y,10,{r0:3,r1:10,life:0.3,color:"#ffb347",glow:true,spdMin:40,spdMax:140});
            if(typeof SFX!=="undefined") SFX.play("ring");
          }
          else if(e.phase===2&&e.patternCd<=0){
            // 弹幕形态：交替双环/旋转环，共4轮后回追击节奏
            e.ringCount++;
            e.patternCd=e.ringCount%2===0?2.2:1.4;
            bossFireRing(e,e.ringCount%2===0?18:12,150+(e.ringCount*12));
            Shake.add(3);
          }
          else if(e.chargeCd<=0 && d<420){
            e.charging=0.7; e.chargeCd=4.5;
            e.chargeVx=dx/d*430; e.chargeVy=dy/d*430;
            burst(e.x,e.y,12,{r0:4,r1:14,life:0.4,color:"#ff6b6b",shape:"ring",spdMin:20,spdMax:80});
            Shake.add(5);
          }
        }
        }
      } else {
        // v0.6 新怪 AI（法师/野猪/召唤师）；返回 false 走旧的贴脸追击
        const handled = (typeof updateNewEnemyAI==="function") && updateNewEnemyAI(e,dt,dx,dy,d);
        if(!handled){
          e.x+=dx/d*sp*dt;
          e.y+=dy/d*sp*dt;
          if(ENEMY_TYPES[e.type]&&ENEMY_TYPES[e.type].sine)
            e.y+=Math.sin(gameTime*5+e.sinePhase)*40*dt;
        }
        // 自爆菇引信
        if(ENEMY_TYPES[e.type]&&ENEMY_TYPES[e.type].explode){
          if(d<38){
            if(e.fuse<0) e.fuse=0.8;
          }
          if(e.fuse>=0){
            e.fuse-=dt;
            if(e.fuse<=0){
              if(dist2(e.x,e.y,p.x,p.y)<70*70) p.hurt(e.dmg*1.6);
              burst(e.x,e.y,26,{r0:5,r1:22,life:0.45,color:"#ff7bac",glow:true,spdMin:80,spdMax:240});
              spawnDmgText(e.x,e.y,"自爆!","#ff7bac");
              Shake.add(6);
              enemies.splice(i,1); continue;
            }
          }
        }
      }
    }
    // 接触伤害
    if(d < e.r+p.r && p.iframes<=0){
      p.hurt(e.dmg);
    }
    e.wobble+=dt*8;

    // 死亡
    if(e.hp<=0){
      if(typeof window.spawnCorpse==="function")window.spawnCorpse(e);   // 死亡残骸（VS式割草反馈）
      player.kills++; player.coins+=e.coin;
      spawnXpGem(e.x,e.y,e.xp);
      rollMicroDrop(e.x,e.y);
      checkSoftPity();
      if(hasRelic("vampfang")){ player.hp=Math.min(player.maxHp,player.hp+2); }
      if(typeof SFX!=="undefined") SFX.play(e.isBoss?"victory":"kill");
      // 挑战局 Boss 死亡 → 挑战胜利结算
      if(typeof chState!=="undefined"&&chState.levelId>0&&e.isBoss&&!chState.result){
        chState.result={win:true};
        winFlag=true; gameState="end";
      }
      burst(e.x,e.y,e.isBoss?50:(e.isElite?24:8),{
        r0:4,r1:e.isBoss?26:10,life:0.5,color:e.color,spdMin:50,spdMax:e.isBoss?300:170,glow:e.isBoss||e.isElite});
      spawnDmgText(e.x,e.y,"+"+e.coin+"金币","#ffd700");
      if(e.isBoss){ Shake.add(14); gameVictory(); }
      else if(e.isElite){ Shake.add(8); dropChest(e.x,e.y); }
      else Shake.add(1.5);
      if(typeof AFFIXES!=="undefined") AFFIXES.handleDeath(e);
      enemies.splice(i,1);
    }
  }
}

// 经验晶体
let xpGems=[];
let gemMagnetQueue=[];
function spawnXpGem(x,y,v){ xpGems.push({x,y,v,t:rand(0,Math.PI*2)}); }
function updateGems(dt){
  const p=player;
  for(let i=xpGems.length-1;i>=0;i--){ const g=xpGems[i];
    g.t+=dt*4;
    const d2=dist2(g.x,g.y,p.x,p.y);
    if(d2<p.pickupR*p.pickupR || g.magnet){
      const d=Math.sqrt(d2)||1;
      g.x+=(p.x-g.x)/d*380*dt; g.y+=(p.y-g.y)/d*380*dt;
    }
    if(d2<(p.r+8)*(p.r+8)){
      const gained=p.gainXp(g.v); if(gained>0) pendingLevelUps+=gained;
      if(typeof SFX!=="undefined") SFX.play("gem");
      xpGems.splice(i,1);
    }
  }
}
function drawGems(ctx,camX,camY){
  for(const g of xpGems){
    const x=g.x-camX,y=g.y-camY;
    ctx.save(); ctx.translate(x,y+Math.sin(g.t)*2);
    ctx.fillStyle="#5eead4"; ctx.strokeStyle="#134e4a"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(4.5,0); ctx.lineTo(0,6); ctx.lineTo(-4.5,0);
    ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.arc(-1,-1.5,1.4,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// 精英宝箱：直接升 1 级
let chests=[];
function dropChest(x,y){ chests.push({x,y}); }
function updateChests(dt){
  for(let i=chests.length-1;i>=0;i--){ const c=chests[i];
    if(dist2(c.x,c.y,player.x,player.y)<40*40){
      openChestRitual(c.x,c.y,null);   // 改为轮盘仪式：光柱→滚动→定格→圣物
      chests.splice(i,1);
    } } }
function drawChests(ctx,camX,camY){
  for(const c of chests){
    const x=c.x-camX,y=c.y-camY+Math.sin(performance.now()/300)*3;
    ctx.save(); ctx.translate(x,y);
    ctx.fillStyle="#a8763e"; ctx.strokeStyle="#241a2e"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(-11,-7,22,15,3); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#ffd700";
    ctx.fillRect(-11,-2,22,3);
    ctx.restore();
  }
}

function drawEnemies(ctx,camX,camY){
  for(const e of enemies){
    const x=e.x-camX, y=e.y-camY;
    if(x<-80||y<-80||x>VIEW_W+80||y>VIEW_H+80) continue;
    ctx.save();
    ctx.translate(x,y);
    // 精英光环
    if(e.isElite||e.isBoss){
      ctx.strokeStyle=e.isBoss?"rgba(255,80,80,0.8)":"rgba(255,215,0,0.75)";
      ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(0,4,e.r+6+Math.sin(performance.now()/200)*2,0,Math.PI*2); ctx.stroke();
    }
    // 冻结染色 / 中毒染色
    let bodyColor=e.color;
    if(e.freezeT>0) bodyColor="#a5e3f7";
    else if(e.poisoned) bodyColor=mixColor(e.color,"#7ac74f",0.5);
    if(e.hitFlash>0) bodyColor="#ffffff";

    ctx.fillStyle="rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(0,e.r*0.85,e.r*0.9,e.r*0.32,0,0,Math.PI*2); ctx.fill();

    ctx.strokeStyle="#241a2e"; ctx.lineWidth=2.2; ctx.fillStyle=bodyColor;

    switch(e.type){
      case "slime": {
        const sq=1+Math.sin(e.wobble)*0.08;
        ctx.beginPath(); ctx.ellipse(0,2,e.r*sq,e.r/sq,0,0,Math.PI*2); ctx.stroke(); ctx.fill();
        eyes(ctx,e.r*0.28);
        break; }
      case "bat": {
        const flap=Math.sin(performance.now()/40)*e.r*0.7;
        ctx.beginPath(); ctx.moveTo(-e.r*0.4,0);
        ctx.quadraticCurveTo(-e.r*1.6,-flap,-e.r*1.9,flap*0.4);
        ctx.quadraticCurveTo(-e.r*1.1,e.r*0.35,-e.r*0.4,e.r*0.3); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(e.r*0.4,0);
        ctx.quadraticCurveTo(e.r*1.6,-flap,e.r*1.9,flap*0.4);
        ctx.quadraticCurveTo(e.r*1.1,e.r*0.35,e.r*0.4,e.r*0.3); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.beginPath(); ctx.arc(0,0,e.r*0.75,0,Math.PI*2); ctx.stroke(); ctx.fill();
        eyes(ctx,e.r*0.3);
        break; }
      case "golem": {
        ctx.beginPath(); ctx.roundRect(-e.r*0.8,-e.r,e.r*1.6,e.r*2,4); ctx.stroke(); ctx.fill();
        ctx.fillStyle="#6c7686";
        ctx.beginPath(); ctx.roundRect(-e.r*0.55,-e.r*0.75,e.r*1.1,e.r*0.7,3); ctx.fill();
        eyes(ctx,e.r*0.3);
        break; }
      case "shroom": {
        const blink=(e.fuse>=0&&Math.floor(e.fuse*10)%2===0)?"#ffffff":bodyColor;
        ctx.fillStyle=blink;
        ctx.beginPath(); ctx.arc(0,-e.r*0.25,e.r,Math.PI,0); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.fillStyle="#ffe8f0";
        ctx.beginPath(); ctx.roundRect(-e.r*0.35,-e.r*0.25,e.r*0.7,e.r*0.75,3); ctx.stroke(); ctx.fill();
        ctx.fillStyle=blink==="#ffffff"?"#333":"#fff";
        ctx.beginPath(); ctx.arc(-e.r*0.4,-e.r*0.7,e.r*0.18,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(e.r*0.35,-e.r*0.55,e.r*0.14,0,Math.PI*2); ctx.fill();
        break; }
      case "boss": {
        const bob=Math.sin(e.wobble*0.5)*3;
        ctx.translate(0,bob);
        // 角
        ctx.fillStyle="#7a1f1f";
        ctx.beginPath(); ctx.moveTo(-e.r*0.55,-e.r*0.8); ctx.lineTo(-e.r*0.8,-e.r*1.45); ctx.lineTo(-e.r*0.25,-e.r*0.95); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(e.r*0.55,-e.r*0.8); ctx.lineTo(e.r*0.8,-e.r*1.45); ctx.lineTo(e.r*0.25,-e.r*0.95); ctx.closePath(); ctx.stroke(); ctx.fill();
        // 身体
        ctx.fillStyle=bodyColor;
        ctx.beginPath(); ctx.arc(0,0,e.r,0,Math.PI*2); ctx.stroke(); ctx.fill();
        // 眼
        ctx.fillStyle="#ffd93d";
        ctx.beginPath(); ctx.arc(-e.r*0.3,-e.r*0.15,e.r*0.13,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(e.r*0.3,-e.r*0.15,e.r*0.13,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle="#241a2e"; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(0,e.r*0.25,e.r*0.35,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
        break; }
    }
    // 冻结冰壳
    if(e.freezeT>0){ ctx.strokeStyle="rgba(255,255,255,0.85)"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(0,0,e.r+3,0,Math.PI*2); ctx.stroke(); }
    // 血条（受伤过才显示）
    if(e.hp<e.maxHp&&!e.isBoss){
      const w=e.r*2;
      ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(-w/2,-e.r-10,w,4);
      ctx.fillStyle="#7ed957"; ctx.fillRect(-w/2,-e.r-10,w*Math.max(0,e.hp/e.maxHp),4);
    }
    ctx.restore();
  }
}
function eyes(ctx,off){
  ctx.fillStyle="#241a2e";
  ctx.beginPath(); ctx.arc(-off,0,2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(off,0,2,0,Math.PI*2); ctx.fill();
}
function mixColor(a,b,t){
  const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
  const r=Math.round(((pa>>16)&255)*(1-t)+((pb>>16)&255)*t);
  const g=Math.round(((pa>>8)&255)*(1-t)+((pb>>8)&255)*t);
  const bl=Math.round((pa&255)*(1-t)+(pb&255)*t);
  return "#"+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);
}
