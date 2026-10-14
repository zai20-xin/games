// ===== v0.8 挑战模式：战斗规则钩子 + 结算界面 =====
// 弱点加成在 dealDamage 包装；无伤判定在 Player.hurt 包装；
// 小怪波次在 tick 驱动；结算界面 drawChallengeResult。

(function(){
  // ---- 弱点软引导：弱点属性伤害 ×1.5 ----
  const __origDeal=dealDamage;
  dealDamage=function(e,dmg,opt){
    opt=opt||{};
    if(window.__challengeWeak&&opt.element){
      const weakMap={fire:"火",dark:"暗",ice:"冰"};
      if(weakMap[window.__challengeWeak]===opt.element)dmg*=1.5;
    }
    return __origDeal(e,dmg,opt);
  };
  // ---- 无伤判定：挑战局中受伤即破无伤星（不阻止伤害本身）----
  if(typeof Player!=="undefined"&&Player.prototype.hurt){
    const __origHurt=Player.prototype.hurt;
    Player.prototype.hurt=function(){
      const r=__origHurt.apply(this,arguments);
      if(r&&typeof chState!=="undefined"&&chState.levelId>0&&!chState.result){
        chState.noHit=false;
      }
      return r;
    };
  }
})();

// 小怪波次：挑战局中按关卡配置刷怪调剂节奏
function updateChallengeMinions(){
  if(typeof chState==="undefined"||chState.levelId<=0)return;
  const lv=CHALLENGE_LEVELS.find(l=>l.id===chState.levelId);
  if(!lv)return;
  // 狂暴计时器（L4/L5）：超时 Boss 全面强化 + 全屏警示
  if(lv.enrageAt&&gameTime>=lv.enrageAt){
    const b=enemies.find(e=>e.isBoss);
    if(b&&!b.enraged){
      b.enraged=true;
      b.speed*=1.6;
      b.dmg=Math.round(b.dmg*1.5);
      if(b.patternCd!==undefined)b.patternCd=Math.min(b.patternCd,0.5);
      burst(b.x,b.y,50,{r0:5,r1:30,life:.9,color:"#ff3b3b",glow:true,spdMin:120,spdMax:380});
      spawnDmgText(b.x,b.y-b.r-20,"⚡ 狂暴化!! ⚡","#ff3b3b");
      Shake.add(15);
      if(typeof SFX!=="undefined")SFX.play("bosspawn");
    }
  }
  while(chState.minionIdx<lv.minionWaveAt.length
        &&gameTime>=lv.minionWaveAt[chState.minionIdx]){
    chState.minionIdx++;
    spawnDmgText(player.x,player.y-60,"小怪增援！","#ff9e9e");
    for(let k=0;k<6;k++){
      const a=rand(0,Math.PI*2);
      const type=pick(["slime","bat"]);
      enemies.push({
        type,x:player.x+Math.cos(a)*rand(300,420),y:player.y+Math.sin(a)*rand(300,420),
        r:ENEMY_TYPES[type].r,
        hp:ENEMY_TYPES[type].hp*1.2,maxHp:ENEMY_TYPES[type].hp*1.2,
        speed:ENEMY_TYPES[type].speed,dmg:ENEMY_TYPES[type].dmg*0.6,
        xp:0,coin:3,color:ENEMY_TYPES[type].color,isElite:false,isBoss:false,
        sinePhase:rand(0,6.28),hitFlash:0,slowT:0,slowK:0,freezeT:0,blindT:0,
        knockVx:0,knockVy:0,launchT:0,fuse:-1,wobble:rand(0,6.28),
      });
    }
  }
}

function drawChallengeResult(win){
  ctx.save();
  ctx.fillStyle="rgba(10,8,20,.9)";ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.textAlign="center";
  const lv=CHALLENGE_LEVELS.find(l=>l.id===chState.levelId);
  ctx.fillStyle=win?"#ffe66d":"#ff6b6b";
  ctx.font="bold 52px sans-serif";
  ctx.fillText(win?"★ 挑战成功！":"挑战失败…",VIEW_W/2,190);
  ctx.fillStyle="#fff";ctx.font="22px sans-serif";
  ctx.fillText(lv.bossName+" · 用时 "+Math.floor(gameTime)+" 秒",VIEW_W/2,246);
  if(win){
    const st=(chState.result.detail&&chState.result.detail.stars)||1;
    let sTxt="";
    for(let k=0;k<3;k++)sTxt+=k<st?"⭐":"☆";
    ctx.font="44px sans-serif";
    ctx.fillText(sTxt,VIEW_W/2,320);
    ctx.font="17px sans-serif";ctx.fillStyle="#b8a9d9";
    ctx.fillText("通关 ✓   "+(st>=2?"限时 ✓ ("+lv.timeLimitStar+"秒内)":"限时 ✗")+
                 "   "+(st>=3?"无伤 ✓":"无伤 ✗"),VIEW_W/2,368);
    if(chState.result.detail&&chState.result.detail.bonusCoins>0){
      ctx.fillStyle="#ffd700";ctx.font="bold 20px sans-serif";
      ctx.fillText("💰 新星奖励 +"+chState.result.detail.bonusCoins+" 金币",VIEW_W/2,412);
    }
    if(chState.result.detail&&chState.result.detail.newUnlock){
      ctx.fillStyle="#7ed957";ctx.font="bold 22px sans-serif";
      ctx.fillText("🎉 解锁 "+chState.result.detail.newUnlock+"！",VIEW_W/2,456);
    } else {
      ctx.fillStyle="rgba(255,255,255,.55)";ctx.font="16px sans-serif";
      ctx.fillText("更高星级等你刷新",VIEW_W/2,456);
    }
  } else {
    ctx.fillStyle="#b8a9d9";ctx.font="18px sans-serif";
    chState.noHit?null:ctx.fillText("无伤星已破，再试一次！",VIEW_W/2,330);
  }
  ctx.fillStyle="#b8a9d9";ctx.font="19px sans-serif";
  ctx.fillText(win?"[R] 再战 · [N] 下一关/返回 · [Q] 关卡选择"
                  :"[R] 再来一次 · [Q] 返回关卡选择",VIEW_W/2,500);
  ctx.restore();
}
