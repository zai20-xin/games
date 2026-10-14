// ===== v0.9 挑战关专属Boss AI：L2 寒霜巨像 / L3 影武者 =====
// 每个Boss三阶段，技能组完全独立于通用深渊魔王。
// 依赖：全局 enemies/projectiles/player/gameTime/burst/spawnParticle/Shake/SFX/spawnDmgText/dist2/rand

// ---------- L2 寒霜巨像 ----------
const FROST_COLOSSUS = {
  // P1 追击+冰环弹幕(慢) / P2 冰棱新星(地面预警圈)+冻气吐息 / P3 白狂暴：全屏冰刺阵
  update(e,dt,d,dx,dy){
    const p=player;
    const sp=e.speed*(e.slowT>0?(1-e.slowK):1);
    e.patternCd-=dt;

    // 阶段切换演出
    const hpPct=e.hp/e.maxHp;
    if(e.phase===1&&hpPct<=0.66){
      e.phase=2;e.patternCd=1.4;
      burst(e.x,e.y,34,{r0:4,r1:22,life:.7,color:"#a5e3f7",glow:true,spdMin:80,spdMax:300});
      spawnDmgText(e.x,e.y-e.r-16,"寒霜巨像 · 冰棱形态!","#a5e3f7");
      Shake.add(9);
      if(typeof SFX!=="undefined")SFX.play("frost");
    } else if(e.phase===2&&hpPct<=0.33){
      e.phase=3;e.patternCd=1.0;e.speed*=1.25;
      burst(e.x,e.y,46,{r0:4,r1:26,life:.8,color:"#ffffff",glow:true,spdMin:100,spdMax:340});
      spawnDmgText(e.x,e.y-e.r-16,"极寒暴走!!","#dff3fb");
      Shake.add(13);
      if(typeof SFX!=="undefined")SFX.play("frost");
    }

    if(e.charging>0){e.charging-=dt;e.x+=e.chargeVx*dt;e.y+=e.chargeVy*dt;return;}

    if(e.phase===1){
      e.x+=dx/d*sp*dt;e.y+=dy/d*sp*dt;
      if(e.patternCd<=0&&d<420){
        // 慢速八向冰环
        e.patternCd=2.6;
        for(let k=0;k<8;k++){
          const a=k/8*Math.PI*2+gameTime*.4;
          projectiles.push({kind:"enemybullet",x:e.x,y:e.y,
            vx:Math.cos(a)*140,vy:Math.sin(a)*140,r:8,
            dmg:11,life:3.5,pierce:99,element:"hostile",color:"#a5e3f7"});
        }
        if(typeof SFX!=="undefined")SFX.play("frost");
      }
    }
    else if(e.phase===2){
      // 缓慢逼近，交替释放：冰棱新星 / 冻气吐息
      e.x+=dx/d*sp*.5*dt;e.y+=dy/d*sp*.5*dt;
      if(e.patternCd<=0){
        e.alt=(e.alt||0)+1;
        if(e.alt%2===1)this.icicleNova(e);
        else this.frostBreath(e,dt,dx,dy);
        e.patternCd=e.alt%2===1?2.2:1.8;
      }
    }
    else { // P3 极寒暴走
      e.x+=dx/d*sp*dt;e.y+=dy/d*sp*dt;
      if(e.patternCd<=0){
        e.alt=(e.alt||0)+1;
        if(e.alt%3===1)this.icicleNova(e,true);
        else if(e.alt%3===2)this.frostBreath(e,dt,dx,dy);
        else this.iceSpikeField(e);
        e.patternCd=2.0;
      }
    }
  },
  // 冰棱新星：地面预警圈→延迟冰刺爆出（可预判走位）
  icicleNova(e,triple){
    const n=triple?5:3;
    for(let k=0;k<n;k++){
      const a=rand(0,Math.PI*2),dist=rand(90,240);
      const x=e.x+Math.cos(a)*dist,y=e.y+Math.sin(a)*dist;
      spawnParticle(x,y,{r0:6,r1:30,life:.75,color:"rgba(165,227,247,.55)",shape:"ring"});
      delayedCalls.push({t:.75,fn:()=>{
        for(let j=-1;j<=1;j++){
          projectiles.push({kind:"icicle",x:x+j*14,y,
            vx:(x-player.x)*.02+(j*30),vy:150,r:7,
            dmg:14,life:2,pierce:0,element:"hostile",color:"#dff3fb"});
        }
        burst(x,y,10,{r0:3,r1:12,life:.4,color:"#dff3fb",shape:"shard",
          spdMin:60,spdMax:200,vrot:4});
        Shake.add(3);
        if(typeof SFX!=="undefined")SFX.play("frost");
      }});
    }
    if(typeof SFX!=="undefined")SFX.play("ring");
  },
  // 冻气吐息：朝玩家扇形冷气弹幕（减速效果）
  frostBreath(e,dt,dx,dy){
    const base=Math.atan2(dy,dx);
    for(let k=-3;k<=3;k++){
      const a=base+k*.16;
      projectiles.push({kind:"frostbreath",x:e.x,y:e.y,
        vx:Math.cos(a)*230,vy:Math.sin(a)*230,r:9,
        dmg:9,life:1.6,pierce:99,element:"hostile",color:"#cdeefd",
        slowOnHit:true});
    }
    // 吐息粒子
    for(let k=-2;k<=2;k++){
      const a=Math.atan2(dy,dx)+k*.2;
      spawnParticle(e.x+Math.cos(a)*40,e.y+Math.sin(a)*40,
        {r0:5,r1:14,life:.5,color:"rgba(205,238,253,.5)",vx:Math.cos(a)*120,vy:Math.sin(a)*120});
    }
    if(typeof SFX!=="undefined")SFX.play("frost");
  },
  // P3 全屏冰刺阵：以玩家当前位置为中心的大范围预警
  iceSpikeField(e){
    for(let ring=0;ring<3;ring++){
      const R=70+ring*85;
      const cnt=8+ring*4;
      for(let k=0;k<cnt;k++){
        const a=k/cnt*Math.PI*2+ring*.3;
        const x=player.x+Math.cos(a)*R,y=player.y+Math.sin(a)*R;
        if(x<20||x>WORLD.w-20||y<20||y>WORLD.h-20)continue;
        spawnParticle(x,y,{r0:5,r1:26,life:.9,color:"rgba(223,243,251,.5)",shape:"ring"});
        delayedCalls.push({t:.9,fn:()=>{
          spawnParticle(x,y,{r0:3,r1:18,life:.35,color:"#fff",shape:"shard",vy:-50});
          if(dist2(x,y,player.x,player.y)<26*26)player.hurt(15);
        }});
      }
    }
    spawnDmgText(player.x,player.y-56,"冰封领域!","#a5e3f7");
    if(typeof SFX!=="undefined")SFX.play("bosspawn");
  },
};

// ---------- L3 影武者 ----------
const SHADOW_BLADE = {
  update(e,dt,d,dx,dy){
    const sp=e.speed*(e.slowT>0?(1-e.slowK):1);
    e.patternCd-=dt;
    const hpPct=e.hp/e.maxHp;
    if(e.phase===1&&hpPct<=0.66){
      e.phase=2;e.patternCd=.8;e.blinkCd=2.2;
      burst(e.x,e.y,30,{r0:3,r1:20,life:.6,color:"#5a3280",glow:true,spdMin:80,spdMax:280});
      spawnDmgText(e.x,e.y-e.r-16,"影武者 · 分身之术!","#b06ad4");
      Shake.add(9);
      if(typeof SFX!=="undefined")SFX.play("zap");
    } else if(e.phase===2&&hpPct<=0.33){
      e.phase=3;e.patternCd=.6;e.speed*=1.3;
      burst(e.x,e.y,42,{r0:3,r1:24,life:.7,color:"#d24bd0",glow:true,spdMin:100,spdMax:330});
      spawnDmgText(e.x,e.y-e.r-16,"影分身·极!!","#d24bd0");
      Shake.add(12);
      if(typeof SFX!=="undefined")SFX.play("evolution");
    }

    // 瞬移背刺计时（P2起）
    if(e.phase>=2){
      e.blinkCd-=dt;
      if(e.blinkCd<=0){this.blinkStrike(e);e.blinkCd=rand(3.2,4.4);}
    }

    // 常规行为：游斗（绕玩家转圈接近）
    e.orbitA=(e.orbitA||rand(0,6.28))+(e.phase>=3?.9:.55)*dt*(e.orbitDir||(e.orbitDir=Math.random()<.5?1:-1));
    const want=e.phase>=3?110:170;
    const tx=player.x+Math.cos(e.orbitA)*want,ty=player.y+Math.sin(e.orbitA)*want;
    const mdx=tx-e.x,mdy=ty-e.y,md=Math.hypot(mdx,mdy)||1;
    e.x+=mdx/md*sp*dt;e.y+=mdy/md*sp*dt;

    // 攻击节奏
    if(e.patternCd<=0){
      if(e.phase===1)this.crossSlash(e,dx,dy);
      else if(e.phase===2){
        if(!e.clones||e.clones.length<2)this.spawnClones(e,2);
        else this.crossSlash(e,dx,dy);
        e.patternCd=1.8;
      }
      else {
        if(!e.clones||e.clones.length<3)this.spawnClones(e,3-e.clones.length);
        this.homingShadows(e);
        e.patternCd=1.5;
      }
    }
    // 分身生命周期
    if(e.clones){
      for(let i=e.clones.length-1;i>=0;i--){
        const c=e.clones[i];c.t-=dt;
        c.x+=(player.x-c.x)*.3*dt;c.y+=(player.y-c.y)*.3*dt;
        if(c.t<=0){
          burst(c.x,c.y,8,{r0:2,r1:10,life:.3,color:"#5a3280",spdMin:40,spdMax:130});
          e.clones.splice(i,1);
        }
      }
    }
  },
  // 瞬移背刺：消失→出现在玩家背后→十字斩
  blinkStrike(e){
    burst(e.x,e.y,16,{r0:2,r1:14,life:.35,color:"#3a2450",spdMin:60,spdMax:220});
    const a=rand(0,Math.PI*2),R=70;
    e.x=clamp(player.x+Math.cos(a)*R,30,WORLD.w-30);
    e.y=clamp(player.y+Math.sin(a)*R,30,WORLD.h-30);
    burst(e.x,e.y,16,{r0:2,r1:14,life:.35,color:"#d24bd0",glow:true,spdMin:60,spdMax:220});
    if(typeof SFX!=="undefined")SFX.play("zap");
    // 出现瞬间十字斩
    for(const ang of[0,Math.PI/2]){
      for(const s of[-1,1]){
        projectiles.push({kind:"shadowblade",x:e.x,y:e.y,
          vx:Math.cos(ang)*s*300,vy:Math.sin(ang)*s*300,r:7,
          dmg:13,life:1.1,pierce:99,element:"hostile",color:"#b06ad4"});
      }
    }
    Shake.add(4);
  },
  crossSlash(e,dx,dy){
    const base=Math.atan2(dy,dx);
    for(let k=-1;k<=1;k++){
      const a=base+k*.28;
      projectiles.push({kind:"shadowblade",x:e.x,y:e.y,
        vx:Math.cos(a)*320,vy:Math.sin(a)*320,r:7,
        dmg:11,life:1.4,pierce:99,element:"hostile",color:"#b06ad4"});
    }
    if(typeof SFX!=="undefined")SFX.play("zap");
  },
  // 镜像分身：复制玩家时装配色，周期放影弹（打掉本体才消失——简化为限时）
  spawnClones(e,n){
    e.clones=e.clones||[];
    for(let k=0;k<n;k++){
      const a=rand(0,Math.PI*2);
      e.clones.push({x:e.x+Math.cos(a)*90,y:e.y+Math.sin(a)*90,t:rand(4,6),
        shootT:rand(.8,1.6)});
    }
    burst(e.x,e.y,14,{r0:3,r1:14,life:.4,color:"#8a4fbf",spdMin:50,spdMax:180});
    spawnDmgText(e.x,e.y-e.r-10,"影分身!","#b06ad4");
  },
  homingShadows(e){
    if(!e.clones)return;
    for(const c of e.clones){
      const a=Math.atan2(player.y-c.y,player.x-c.x);
      projectiles.push({kind:"shadowblade",x:c.x,y:c.y,
        vx:Math.cos(a)*250,vy:Math.sin(a)*250,r:6,
        dmg:9,life:2.2,pierce:99,element:"hostile",color:"#8a4fbf"});
    }
  },
};

// ---------- 总调度：挑战Boss专属AI入口 ----------
function updateChallengeBossAI(e,dt,d,dx,dy){
  if(!e.challenge)return false;
  if(window.__challengeBossKind==="frost"){FROST_COLOSSUS.update(e,dt,d,dx,dy);return true;}
  if(window.__challengeBossKind==="shadow"){SHADOW_BLADE.update(e,dt,d,dx,dy);return true;}
  return false;   // L1 用通用深渊魔王逻辑
}
