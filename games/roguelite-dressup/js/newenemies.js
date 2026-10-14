// ===== v0.6 新怪物：行为差异化（远程法师/冲锋野猪/召唤师）=====
// 设计原则：行为差异>数值差异。法师教你绕位，野猪教预判，召唤师教集火优先级。
// 依赖：全局 spawnEnemy/enemies/projectiles/burst/Shake/SFX/spawnDmgText/dist2/rand/clamp/WORLD

const NEW_ENEMY_TYPES = {
  // 远程法师：保持距离吟唱，发射慢速追踪法球；被打断（受击）会后退
  mage: { hp:34, speed:60, r:13, dmg:10, xp:3, coin:2, color:"#b06ad4",
          keepDist:230, castCd:2.4 },
  // 冲锋野猪：平时慢走，锁定后蓄力0.7s→直线狂奔(撞墙眩晕1s)
  boar: { hp:55, speed:52, r:16, dmg:14, xp:3, coin:2, color:"#c98a5b" },
  // 召唤师：躲在最远射程外缓慢移动，周期召唤史莱姆；本体脆弱
  summoner:{ hp:42, speed:44, r:14, dmg:8, xp:6, coin:4, color:"#5b9e6d",
             summonCd:5.0, keepDist:330 },
};

// 追加到主 ENEMY_TYPES 表（若已存在则跳过，防重复加载）
if (typeof ENEMY_TYPES !== "undefined") {
  for (const k in NEW_ENEMY_TYPES) {
    if (!ENEMY_TYPES[k]) ENEMY_TYPES[k] = NEW_ENEMY_TYPES[k];
    ENEMY_TYPES[k].v2 = true;   // 标记走 v2 AI
  }
}

// ---- 单个新怪 AI 更新（在 updateEnemies 的 else 分支后调用）----
function updateNewEnemyAI(e, dt, dx, dy, d){
  const p = player;
  const def = NEW_ENEMY_TYPES[e.type];
  if(!def || !def.v2) return false;   // 非新怪 → 走旧逻辑
  let sp = e.speed * (e.slowT>0 ? (1-e.slowK) : 1);

  if(e.type === "mage"){
    // 保持距离：太近后退，太远靠近，适中则站定吟唱
    e.castT = (e.castT===undefined? def.castCd*rand(.5,1) : e.castT) - dt;
    const want = def.keepDist;
    if(e.hitFlash > 0 && Math.random()<.3){ /* 受击打断 */ }
    if(d < want*0.72){        // 玩家逼近 → 后撤
      e.x -= dx/d*sp*1.15*dt; e.y -= dy/d*sp*1.15*dt;
      e.casting = false;
    } else if(d > want*1.25){ // 太远 → 靠近
      e.x += dx/d*sp*dt; e.y += dy/d*sp*dt;
      e.casting = false;
    } else {                  // 吟唱窗口
      e.casting = true;
      if(e.castT <= 0){
        e.castT = def.castCd*(1+rand(-.2,.2));
        // 发射 1~2 枚慢速追踪法球
        const n = gameTime>240 ? 2 : 1;
        for(let k=0;k<n;k++){
          const a = Math.atan2(dy,dx)+k*.35-(n-1)*.17;
          projectiles.push({kind:"enemybullet", x:e.x, y:e.y,
            vx:Math.cos(a)*170, vy:Math.sin(a)*170, r:8,
            dmg:def.dmg, life:3.2, pierce:99, element:"hostile", color:"#c084fc"});
        }
        burst(e.x,e.y,6,{r0:2,r1:8,life:.3,color:"#c084fc",glow:true,spdMin:30,spdMax:110});
        if(typeof SFX!=="undefined") SFX.play("zap");
      }
    }
    return true;
  }

  if(e.type === "boar"){
    // 状态机：walk → windup(蓄力0.7s) → charge(直线狂奔1.1s) → stun(撞墙/超时眩晕0.9s)
    e.boarState = e.boarState || "walk";
    e.stateT = (e.stateT===undefined? rand(0,1.5) : e.stateT) - dt;

    if(e.boarState==="walk"){
      e.x += dx/d*sp*dt; e.y += dy/d*sp*dt;
      if(d < 300 && d > 90 && e.stateT<=0){
        e.boarState="windup"; e.stateT=0.7;
        burst(e.x,e.y+8,5,{r0:2,r1:6,life:.35,color:"#e8c39e",spdMin:20,spdMax:70});
      } else if(e.stateT<=0){ e.stateT=rand(.6,1.4); }
    } else if(e.boarState==="windup"){
      // 原地刨蹄+朝向锁定（记录方向）
      if(!e.chargeDir){ e.chargeDir={x:dx/d,y:dy/d}; }
      else { e.chargeDir.x=dx/d; e.chargeDir.y=dy/d; }
      if(Math.random()<.25) spawnParticle(e.x+rand(-10,10),e.y+12,{r0:2,r1:4,life:.3,color:"#d9b48f",vy:-30});
      if(e.stateT<=0){
        e.boarState="charge"; e.stateT=1.1;
        Shake.add(2);
        if(typeof SFX!=="undefined") SFX.play("ring");
      }
    } else if(e.boarState==="charge"){
      const csp=430;
      e.x+=e.chargeDir.x*csp*dt; e.y+=e.chargeDir.y*csp*dt;
      // 冲锋尾尘
      if(Math.random()<.5) spawnParticle(e.x,e.y+10,{r0:3,r1:6,life:.28,color:"#cbb694",vy:-14});
      // 撞墙判定
      if(e.x<24||e.x>WORLD.w-24||e.y<24||e.y>WORLD.h-24){
        e.boarState="stun"; e.stateT=0.9;
        e.x=clamp(e.x,24,WORLD.w-24); e.y=clamp(e.y,24,WORLD.h-24);
        burst(e.x,e.y,10,{r0:3,r1:10,life:.4,color:"#e8c39e",spdMin:50,spdMax:160});
        spawnDmgText(e.x,e.y-e.r,"晕!","#ffd93d");
      } else if(e.stateT<=0){ e.boarState="stun"; e.stateT=0.6; }
    } else if(e.boarState==="stun"){
      // 眩晕冒星
      if(Math.random()<.3) spawnParticle(e.x+rand(-8,8),e.y-e.r-6,{r0:1.6,r1:2.6,life:.4,color:"#ffd93d"});
      if(e.stateT<=0){ e.boarState="walk"; e.stateT=rand(1,2); e.chargeDir=null; }
    }
    return true;
  }

  if(e.type === "summoner"){
    // 与玩家和最近非召唤师怪都保持距离；周期传送门召唤
    e.summonT = (e.summonT===undefined? def.summonCd*rand(.6,1): e.summonT) - dt;
    const want = def.keepDist;
    // 缓慢横向游走 + 距离维持
    if(d < want*0.85){ e.x-=dx/d*sp*1.3*dt; e.y-=dy/d*sp*1.3*dt; }
    else if(d > want*1.15){ e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt; }
    else { // 游走切向
      e.wanderA=(e.wanderA||rand(0,6.28));
      e.wanderT=(e.wanderT||0)-dt;
      if(e.wanderT<=0){ e.wanderT=rand(1,2); e.wanderDir=Math.random()<.5?1:-1; }
      e.x+=(-dy/d)*sp*.5*(e.wanderDir||1)*dt;
      e.y+=( dx/d)*sp*.5*(e.wanderDir||1)*dt;
    }
    if(e.summonT<=0){
      e.summonT=def.summonCd*(1+rand(-.25,.25));
      // 召唤 2 只史莱姆（带传送门特效）
      const px=e.x+rand(-36,36), py=e.y+rand(-36,36);
      spawnParticle(px,py,{r0:6,r1:26,life:.45,color:"rgba(122,199,79,.6)",shape:"ring"});
      burst(px,py,8,{r0:2,r1:7,life:.4,color:"#7ac74f",glow:true,spdMin:40,spdMax:130});
      for(let k=0;k<2;k++)
        spawnEnemy("slime", px+rand(-18,18), py+rand(-18,18), false);
      if(typeof SFX!=="undefined") SFX.play("poison");
    }
    return true;
  }
  return false;
}
