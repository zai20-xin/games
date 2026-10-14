// ===== v0.8b 挑战局技能单体特化 =====
// 群怪技在 Boss 战自动切换为「决斗形态」：
//  火球：追踪弹头+命中必爆（无需AoE找怪）
//  冰环：从扩散环改为「冰晶环绕护体」持续伤害光环
//  雷链：从跳跃链改为「雷神之矛」高频单体重击
//  其余技能（飞刀/地刺/毒雾等）本身可打单体，不特化。
// 实现：挑战局 startChallengeRun 后设置 window.__duelMode=true，
//       各技能更新函数开头检查并走特化分支。

// ---- 特化火球 ----
function duelFireball(dt){
  const lv=player.skillLv("fireball");
  if(lv<=0){fbCd=0;return;}
  fbCd-=dt;
  const cd=0.55*(1-player.haste);   // 决斗调律：更快
  if(fbCd<=0){
    fbCd=cd;
    // 追踪最近Boss
    let t=null,bd=Infinity;
    for(const e of enemies){if(e.isBoss||e.isElite||true){const dd=dist2(player.x,player.y,e.x,e.y);if(dd<bd){bd=dd;t=e;}}}
    if(!t)return;
    projectiles.push({kind:"duelfire",x:player.x,y:player.y,
      vx:Math.cos(0)*380,vy:Math.sin(0)*380,r:10,
      target:t,dmg:26*player.atkMul,life:2.5,pierce:0,
      element:"fire",color:"#ff6b35",turn:6.5});
    if(typeof SFX!=="undefined")SFX.play("shoot");
  }
}
// 特化冰环：冰晶护体光环
function duelFrostnova(dt){
  const lv=player.skillLv("frostnova");
  if(lv<=0)return;
  player.__frostAura=(player.__frostAura||{r:86,tick:0,angle:0});
  const aura=player.__frostAura;
  aura.angle+=dt*3.2;
  aura.tick-=dt;
  if(aura.tick<=0){
    aura.tick=0.4;
    hitArea(player.x,player.y,aura.r,(e)=>{
      dealDamage(e,9,{element:"ice",color:"#a5e3f7"});
      e.slowT=0.8;e.slowK=Math.min(.7,.35+(outfitMods().iceSlow||0));
    });
  }
}
// 绘制冰晶护体（3颗旋转冰晶）
function drawDuelFrostAura(ctx,camX,camY){
  if(!window.__duelMode||!player.__frostAura)return;
  const a=player.__frostAura;
  for(let k=0;k<3;k++){
    const ang=a.angle+k*Math.PI*2/3;
    const x=player.x+Math.cos(ang)*a.r-camX,y=player.y+Math.sin(ang)*a.r-camY;
    ctx.save();ctx.translate(x,y);ctx.rotate(a.angle*2);
    ctx.fillStyle="rgba(223,243,251,.95)";ctx.strokeStyle="#241a2e";ctx.lineWidth=1.4;
    for(let j=0;j<3;j++){
      const b=j*Math.PI/3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(b)*8,Math.sin(b)*8);
      ctx.lineTo(-Math.cos(b)*8,-Math.sin(b)*8);
      ctx.stroke();
    }
    ctx.restore();
  }
}
// 特化雷链：雷神之矛——高频直射重型雷矢
function duelChainbolt(dt){
  const lv=player.skillLv("chainbolt");
  if(lv<=0){cbCd=0;return;}
  cbCd-=dt;
  if(cbCd<=0){
    cbCd=0.7*(1-player.haste);
    const t=nearestEnemy(player.x,player.y,0);
    if(!t){cbCd=0.15;return;}
    const a=Math.atan2(t.y-player.y,t.x-player.x);
    projectiles.push({kind:"duelspear",x:player.x,y:player.y,
      vx:Math.cos(a)*520,vy:Math.sin(a)*520,r:9,
      dmg:34,pierce:2,element:"bolt",color:"#ffd93d"});
    beams.push({x1:player.x,y1:player.y,x2:player.x+Math.cos(a)*60,
      y2:player.y+Math.sin(a)*60,life:.12,maxLife:.12,color:"#fff3a0"});
    if(typeof SFX!=="undefined")SFX.play("zap");
  }
}

// ---- 总开关：挑战局替换技能调度（保留未特化技能的原始逻辑）----
const __origUpdateFireball=typeof updateFireball!=="undefined"?updateFireball:null;
const __origUpdateFrostnova=typeof updateFrostnova!=="undefined"?updateFrostnova:null;
const __origUpdateChainbolt=typeof updateChainbolt!=="undefined"?updateChainbolt:null;

function updateSkillsDuel(dt){
  // 挑战局：特化三技能 + 其余原逻辑
  if(window.__duelMode){
    duelFireball(dt);
    duelFrostnova(dt);
    duelChainbolt(dt);
    updateBlades(dt);updatePoison(dt);updateHolypulse(dt);
    updateKnives(dt);updateQuake(dt);updateStarfall(dt);
  } else {
    updateFireball(dt);updateFrostnova(dt);updateChainbolt(dt);updateBlades(dt);
    updatePoison(dt);updateHolypulse(dt);updateKnives(dt);updateQuake(dt);updateStarfall(dt);
  }
  updateProjectiles(dt);updateShockwaves(dt);updateBeams(dt);updateZones(dt);
  updateDelayed(dt);
}
