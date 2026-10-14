// ===== 主循环：状态机 + 出怪导演 + 相机 + 输入 =====
const canvas=document.getElementById("game");
ctx=canvas.getContext("2d");

let gameState="start";     // start | playing | levelup | end
let player=null;
let gameTime=0, pendingLevelUps=0;
let winFlag=false;
let spawnTimer=0, waveTimer=0, eliteTimer=0, bossSpawned=false;
let mouse={x:0,y:0};
const input={left:false,right:false,up:false,down:false};

// 相机（跟随玩家，含震动偏移）
const cam={x:0,y:0};
function updateCamera(){
  const targetX=clamp(player.x-VIEW_W/2,0,WORLD.w-VIEW_W);
  const targetY=clamp(player.y-VIEW_H/2,0,WORLD.h-VIEW_H);
  cam.x=targetX; cam.y=targetY;
}

// ---------- 出怪导演 ----------
function updateSpawner(dt){
  // 环外生成：屏幕外一圈随机点
  function edgePos(){
    const side=randInt(0,3); const m=60;
    if(side===0) return {x:cam.x-m, y:cam.y+rand(-m,VIEW_H+m)};
    if(side===1) return {x:cam.x+VIEW_W+m, y:cam.y+rand(-m,VIEW_H+m)};
    if(side===2) return {x:cam.x+rand(-m,VIEW_W+m), y:cam.y-m};
    return {x:cam.x+rand(-m,VIEW_W+m), y:cam.y+VIEW_H+m};
  }
  spawnTimer-=dt;
  // v0.6：出怪池按当前章节切换
  const ch=(typeof ChapterSys!=="undefined")?ChapterSys.current:null;
  const interval=Math.max(TUNING.spawn.intervalMin,
    TUNING.spawn.intervalBase*Math.pow(TUNING.spawn.intervalDecay, gameTime/30));
  if(spawnTimer<=0){
    spawnTimer=interval;
    const batch=1+Math.floor(gameTime/120);
    for(let k=0;k<batch;k++){
      let type;
      if(ch){
        // 章节池随机；毒菇按章节时间门槛加入
        type=pick(ch.spawnPool);
        if(ch.shroomAfter&&gameTime>ch.shroomAfter&&Math.random()<0.25) type="shroom";
      } else {
        type="slime";
        if(gameTime>50) type=pick(["slime","bat"]);
        if(gameTime>140) type=pick(["slime","bat","golem","shroom"]);
        else if(gameTime>90) type=pick(["slime","bat","shroom"]);
      }
      const pos=edgePos();
      spawnEnemy(type,pos.x,pos.y,false);
    }
  }
  // 包围网波次（第 3/6/9 分钟）
  waveTimer-=dt;
  if(waveTimer<=0){
    waveTimer=180;
    const n=16+Math.floor(gameTime/40)*4;
    for(let k=0;k<n;k++){
      const a=k/n*Math.PI*2;
      const R=560;
      const x=clamp(player.x+Math.cos(a)*R,20,WORLD.w-20);
      const y=clamp(player.y+Math.sin(a)*R,20,WORLD.h-20);
      const wtype=ch?pick(ch.spawnPool):(gameTime>150?pick(["bat","slime"]):"slime");
      spawnEnemy(wtype,x,y,false);
    }
  }
  // 精英
  eliteTimer-=dt;
  if(eliteTimer<=0){
    eliteTimer=ELITE_EVERY;
    const pos=edgePos();
    spawnEnemy(pick(ch?(ch.id>=3?["golem","boar","mage"]:["golem","mage"]):["golem","shroom"]),pos.x,pos.y,true);
  }
  // Boss
  if(!bossSpawned&&gameTime>=BOSS_TIME){
    bossSpawned=true;
    enemies.length=0; xpGems.length=0; projectiles.length=0;   // 清场仪式感（含敌弹）
    const a=rand(0,Math.PI*2);
    spawnBoss(clamp(player.x+Math.cos(a)*420,60,WORLD.w-60),
              clamp(player.y+Math.sin(a)*420,60,WORLD.h-60));
    Shake.add(10);
    if(typeof SFX!=="undefined") SFX.play("bosspawn");
  }
}

function gameVictory(){ winFlag=true; gameState="end"; }

// ---------- 背景绘制 ----------
function drawWorld(){
  // 手绘风地面（v0.3：按 BIOME 主题换色）
  const B=(typeof BIOME!=="undefined")?BIOME.current:null;
  ctx.fillStyle=B?B.ground:"#2c3e33";
  ctx.fillRect(0,0,VIEW_W,VIEW_H);
  const gs=130;
  const startX=Math.floor(cam.x/gs)*gs, startY=Math.floor(cam.y/gs)*gs;
  ctx.strokeStyle=B?B.grid:"rgba(255,255,255,0.04)";
  ctx.lineWidth=1;
  for(let gx=startX;gx<cam.x+VIEW_W+gs;gx+=gs)
    for(let gy=startY;gy<cam.y+VIEW_H+gs;gy+=gs){
      ctx.strokeRect(gx-cam.x,gy-cam.y,gs,gs);
      if((gx/gs+gy/gs)%2===0){
        ctx.fillStyle="rgba(255,255,255,0.015)";
        ctx.fillRect(gx-cam.x,gy-cam.y,gs,gs);
      }
    }
  // 世界边界
  ctx.strokeStyle="rgba(255,110,110,0.35)";
  ctx.lineWidth=4;
  ctx.setLineDash([14,10]);
  ctx.strokeRect(-cam.x,-cam.y,WORLD.w,WORLD.h);
  ctx.setLineDash([]);
  // 装饰草丛（确定性伪随机）
  ctx.fillStyle=B?B.deco:"rgba(96,153,102,0.28)";
  for(let i=0;i<80;i++){
    const sx=(i*761)%WORLD.w, sy=(i*397)%WORLD.h;
    const px=sx-cam.x, py=sy-cam.y;
    if(px>-30&&px<VIEW_W+30&&py>-30&&py<VIEW_H+30){
      ctx.beginPath();
      ctx.ellipse(px,py,14+i%3*4,7,((i*37)%100)/100*3,0,Math.PI*2);
      ctx.fill();
    }
  }
}

// ---------- 输入 ----------
window.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(typeof SFX!=="undefined") SFX.unlock();     // 首次交互解锁音频
  if(k==="m"&&typeof SFX!=="undefined"){
    const m=SFX.toggleMute();
    if(typeof Settings!=="undefined")Settings.setMuted(m);   // 静音持久化
    spawnDmgText(player?player.x:VIEW_W/2,player?player.y-40:200,m?"已静音 🔇":"声音开启 🔊",m?"#9aa0a6":"#ffe66d");
    return;
  }
  // 暂停切换（游戏中按 P/Esc）
  if((k==="p"||k==="escape")&&(gameState==="playing"||gameState==="paused")){
    gameState=gameState==="playing"?"paused":"playing";
    lastT=performance.now();
    return;
  }
  if(k==="w"||k==="arrowup") input.up=true;
  if(k==="s"||k==="arrowdown") input.down=true;
  if(k==="a"||k==="arrowleft") input.left=true;
  if(k==="d"||k==="arrowright") input.right=true;
  if(gameState==="levelup"&&["1","2","3"].includes(k))
    applyUpgradeChoice(parseInt(k)-1);
  // 弹窗选择路由：技能分支/章节祝福/魔镜
  if(gameState==="playing"){
    if(typeof SkillBranchSys!=="undefined"&&SkillBranchSys.pending&&["1","2"].includes(k)){
      SkillBranchSys.choose(parseInt(k)-1); return;
    }
    if(typeof ChapterSys!=="undefined"&&ChapterSys.boonChoices.length&&["1","2","3"].includes(k)){
      ChapterSys.chooseBoon(parseInt(k)-1); return;
    }
    if(typeof MIRROR!=="undefined"&&MIRROR.pendingChoice&&["1","2"].includes(k)){
      MIRROR.choose(parseInt(k)-1); return;
    }
  }
  // 祭坛赐福三选一
  if(gameState==="playing"&&typeof RandomEvents!=="undefined"&&RandomEvents.pendingBoon
     &&["1","2","3"].includes(k)){
    RandomEvents.choose(parseInt(k)-1); return;
  }
  if((gameState==="shop"||gameState==="wardrobe")&&(k==="q"||k==="escape")){
    gameState="start"; return;
  }
  // 挑战界面 Q 返回
  if((gameState==="ch_select"||gameState==="ch_loadout"||gameState==="gadget_select")&&(k==="q"||k==="escape")){
    gameState=gameState==="ch_select"?"start":(gameState==="gadget_select"?"start":"ch_select");
    return;
  }
  // 道具选择 C 清空
  if(gameState==="gadget_select"&&k==="c"){ GSel.picked=[]; return; }
  // 设置界面 Q 返回
  if(gameState==="__settings"&&(k==="q"||k==="escape")){ gameState="start"; return; }
  // 道具快捷键：1~6 选出/取消，右键/Esc 收起
  if(gameState==="playing"&&typeof Gadgets!=="undefined"&&Gadgets.owned.length){
    const slot=parseInt(k);
    if(slot>=1&&slot<=Gadgets.owned.length){
      Gadgets.arm(Gadgets.owned[slot-1]);
      return;
    }
    if((k==="escape"||k==="x")&&Gadgets.armed){ Gadgets.disarm(); return; }
  }
  // 挑战进行中 R 放弃重开
  if(gameState==="playing"&&player&&player.outfit&&typeof chState!=="undefined"
     &&chState.levelId>0&&k==="r"){
    startChallengeRun(); return;
  }
  if((gameState==="shop")&&k==="b"){ gameState="wardrobe"; return; }
  if((gameState==="wardrobe")&&k==="b"){ gameState="shop"; return; }
  if(gameState==="end"){
    // 挑战结算的按键：R 再战 / N 下一关 / Q 返回关卡选择
    if(typeof chState!=="undefined"&&chState.levelId>0&&chState.result){
      if(k==="r") startChallengeRun();
      else if(k==="q") gameState="ch_select";
      else if(k==="n"){
        const next=CHALLENGE_LEVELS.find(l=>l.id===chState.levelId+1);
        if(next&&ChallengeSave.isUnlocked(next.id)){
          ChallengeUI.selLevel=next.id; gameState="ch_loadout";
        } else gameState="ch_select";
      }
      return;
    }
    if(k==="r"){ startGame(player.outfit.id); }
    if(k==="q") gameState="start";
  }
});
window.addEventListener("keyup",e=>{
  const k=e.key.toLowerCase();
  if(k==="w"||k==="arrowup") input.up=false;
  if(k==="s"||k==="arrowdown") input.down=false;
  if(k==="a"||k==="arrowleft") input.left=false;
  if(k==="d"||k==="arrowright") input.right=false;
});
canvas.addEventListener("contextmenu",e=>{
  e.preventDefault();
  if(typeof Gadgets!=="undefined"&&Gadgets.armed)Gadgets.disarm();
});
canvas.addEventListener("mousemove",e=>{
  const rect=canvas.getBoundingClientRect();
  mouse.x=(e.clientX-rect.left)*(canvas.width/rect.width);
  mouse.y=(e.clientY-rect.top)*(canvas.height/rect.height);
});
canvas.addEventListener("click",()=>{
  if(gameState==="start"){
    // 底部功能按钮：无尽 / 挑战 / 商店 / 衣柜
    for(const b of START_BUTTONS){
      if(mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h){
        if(b.action==="__endless"){ startGame("novice"); return; }
        if(b.action==="__gadgets"){ GadgetSelectUI.open("start"); return; }
        if(b.action==="__settings"){ gameState="__settings"; return; }
        gameState=b.action; return;
      }
    }
    // 命中时装卡片？（未解锁的不允许直接选用）
    const cardW=180,gap=18;
    const totalW=OUTFITS.length*cardW+(OUTFITS.length-1)*gap;
    const x0=(VIEW_W-totalW)/2, y0=210;
    for(let i=0;i<OUTFITS.length;i++){
      const cx=x0+i*(cardW+gap);
      if(mouse.x>=cx&&mouse.x<=cx+cardW&&mouse.y>=y0&&mouse.y<=y0+300){
        if(Meta.isUnlocked(OUTFITS[i].id)) startGame(OUTFITS[i].id);
        return;
      }
    }
  } else if(gameState==="gadget_select"){
    GadgetSelectUI.onClick(mouse.x,mouse.y); return;
  } else if(gameState==="__settings"){
    settingsClick(mouse.x,mouse.y); return;
  } else if(gameState==="ch_select"){
    ChallengeUI.onSelectClick(mouse.x,mouse.y); return;
  } else if(gameState==="ch_loadout"){
    ChallengeUI.onLoadoutClick(mouse.x,mouse.y); return;
  } else if(gameState==="shop"||gameState==="wardrobe"){
    SCREENS[gameState].onClick(mouse.x,mouse.y);
  } else if(gameState==="playing"){
    // 道具放置模式：左键在准星处放置
    if(typeof Gadgets!=="undefined"&&Gadgets.armed){
      Gadgets.placeAt(mouse.x+cam.x,mouse.y+cam.y);
      return;
    }
    // 弹窗点击路由
    const pend=(typeof SkillBranchSys!=="undefined"&&SkillBranchSys.pending)?SkillBranchSys
             :(typeof ChapterSys!=="undefined"&&ChapterSys.boonChoices.length)?ChapterSys
             :(typeof MIRROR!=="undefined"&&MIRROR.pendingChoice)?MIRROR:null;
    if(pend&&pend.cardRects){
      for(let i=0;i<pend.cardRects.length;i++){
        const r=pend.cardRects[i];
        if(mouse.x>=r.x&&mouse.x<=r.x+r.w&&mouse.y>=r.y&&mouse.y<=r.y+r.h){
          pend.choose(i); return;
        }
      }
    }
    // 事件交互：祭坛靠近即献祭；商人靠近每1.2s自动买最便宜的一件
    if(typeof RandomEvents!=="undefined"&&RandomEvents.active){
      const a=RandomEvents.active;
      const near=dist2(a.x,a.y,player.x,player.y)<38*38;
      if(near){
        if(a.kind==="altar"){ RandomEvents.altarTouch(); }
        else if(a.kind==="merchant"){
          a.buyT=(a.buyT||0)-dt;
          if(a.buyT===undefined||a.buyT<=0){ // 首次或计时到
            // 找最便宜的可买商品
            let bi=-1,bp=Infinity;
            for(let i=0;i<a.goods.length;i++)
              if(a.goods[i].price<bp&&Meta.coins>=a.goods[i].price){bp=a.goods[i].price;bi=i;}
            if(bi>=0){ Meta.coins>0&&RandomEvents.buy(bi); a.buyT=1.2; }
            else { spawnDmgText(a.x,a.y-40,"金币不足…","#ff6b6b"); a.buyT=3; }
          } else { a.buyT-=0; }
        }
      }
    }
  } else if(gameState==="levelup"){
    const cardW=280,cardH=330,gap=30;
    const x0=VIEW_W/2-(cardW*3+gap*2)/2, y0=190;
    for(let i=0;i<upgradeChoices.length;i++){
      const cx=x0+i*(cardW+gap);
      if(mouse.x>=cx&&mouse.x<=cx+cardW&&mouse.y>=y0&&mouse.y<=y0+cardH){
        applyUpgradeChoice(i); return;
      }
    }
  }
});

function startGame(outfitId){
  player=new Player(outfitId);
  player.relics=[];
  gameTime=0; pendingLevelUps=0; winFlag=false;
  spawnTimer=0; waveTimer=178; eliteTimer=ELITE_EVERY; bossSpawned=false;
  enemies=[]; xpGems=[]; chests=[]; projectiles=[]; zones=[]; drops=[];
  beams=[]; shockwaves=[]; particles=[]; dmgTexts=[]; delayedCalls=[];
  quakeQueue=[]; starfallQueue=[]; bladeState=null;
  chestRitual=null; SOFT_PITY.kills=0; SOFT_PITY.granted=false;
  Meta.beginRun();     // 标记新局：结算只入账一次
  RESONANCE.recompute();
  initGlam(player);
  glamBurst(1.2);      // 变身时刻：入场全屏爆发
  window.__duelMode=false;   // 无尽模式无决斗调律
  if(typeof Gadgets!=="undefined") Gadgets.reset(Gadgets.owned.length?Gadgets.owned:(Meta.data.gadgetPreset||[]));
  if(typeof SysReg!=="undefined") SysReg.resetAll();   // v0.14：统一生命周期（EVOLUTION/MIRROR/Juice/ChapterSys/SkillBranchSys/RandomEvents/DuelTuning）
  if(typeof BIOME!=="undefined") BIOME.init();          // 随机地图主题+加成
  if(typeof BGM!=="undefined"){ BGM.stop(); BGM.play(0); }   // 开局第一章BGM
  upgradeChoices=[];
  fbCd=fnCd=cbCd=psCd=hpCd=knCd=qkCd=sfCd=0;
  delayedCalls=[];
  pendingLevelUps=1;   // 开局免费一级：选择初始技能，避免「无技能→无经验」死锁
  upgradeChoices=[]; buildUpgradeChoices();
  gameState="playing";
}

// ---------- 主循环 ----------
let lastT=performance.now();
let lastDt=0.016;   // 供特效系统（残骸等）使用
function frame(now){
if(typeof Settings!=="undefined")Settings.load();   // v0.16 配置持久化：启动恢复音量/震屏/静音
requestAnimationFrame(frame);
  let dt=Math.min(0.033,(now-lastT)/1000);
  lastT=now;
  lastDt=dt;

  try{ tick(dt); }catch(err){ drawFatal(err); throw err; }
}
function tick(dt){
  if(gameState==="start"){
    drawStartScreen();
    // 「无尽模式」按钮高亮为绿色主入口
    const endless=START_BUTTONS.find(b=>b.action==="__endless");
    if(endless){
      ctx.save();
      const hov=mouse.x>=endless.x&&mouse.x<=endless.x+endless.w&&mouse.y>=endless.y&&mouse.y<=endless.y+endless.h;
      ctx.fillStyle=hov?"rgba(126,217,87,.25)":"rgba(126,217,87,.1)";
      ctx.strokeStyle=hov?"#7ed957":"rgba(126,217,87,.6)";
      ctx.lineWidth=hov?2.8:1.8;
      ctx.beginPath();ctx.roundRect(endless.x,endless.y,endless.w,endless.h,12);
      ctx.fill();ctx.stroke();
      ctx.fillStyle=hov?"#a5f08c":"#7ed957";
      ctx.font="bold 19px sans-serif";ctx.textAlign="center";
      ctx.fillText(endless.label,endless.x+endless.w/2,endless.y+31);
      ctx.restore();
    }
    return;
  }
  if(gameState==="gadget_select"){
    GadgetSelectUI.draw(ctx);
    return;
  }
  if(gameState==="__settings"){
    drawSettingsScreen(ctx);
    return;
  }
  if(gameState==="ch_select"){
    ChallengeUI.drawSelect(ctx);
    return;
  }
  if(gameState==="ch_loadout"){
    ChallengeUI.drawLoadout(ctx);
    if(ChallengeUI.toast){
      ChallengeUI.toast.t-=dt;
      if(ChallengeUI.toast.t<=0)ChallengeUI.toast=null;
    }
    return;
  }
  if(gameState==="shop"||gameState==="wardrobe"){
    SCREENS[gameState].draw(); return;
  }
  if(gameState==="paused"){
    render();
    ctx.save();
    ctx.fillStyle="rgba(10,8,20,0.6)"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.textAlign="center";
    ctx.fillStyle="#ffe66d"; ctx.font="bold 46px sans-serif";
    ctx.fillText("⏸ 已暂停",VIEW_W/2,VIEW_H/2-16);
    ctx.fillStyle="rgba(255,255,255,0.7)"; ctx.font="18px sans-serif";
    ctx.fillText("按 [P] / [Esc] 继续战斗 · [M] 静音",VIEW_W/2,VIEW_H/2+26);
    ctx.restore();
    return;
  }
  if(gameState==="end"){
    // 挑战模式结算：星级+解锁，专用界面
    if(typeof chState!=="undefined"&&chState.levelId>0&&chState.result){
      if(!chState.settled){
        chState.settled=true;
        chState.result.detail=ChallengeSave.settle(chState.levelId,gameTime,chState.noHit,chState.result.win);
      }
      render(); drawChallengeResult(winFlag);
      return;
    }
    // 无尽模式结算（幂等），先入账再绘制
    const result=Meta.settleRun(player,gameTime,winFlag);
    if(result){
      console.log("[结算] 金币入库 +"+result.banked+" → 总计 "+result.total);
      Meta.equip(player.outfit.id);   // 本局使用的时装记为当前装备
      if(typeof SFX!=="undefined") SFX.play(winFlag?"victory":"defeat");
    }
    render(); drawEndScreen(winFlag);
    return;
  }

  if(gameState==="playing"){
    // 冻气减速衰减（挑战关寒霜巨像）
    if(player.__chilled>0){
      player.__chilled-=dt;
      if(player.__chilled<=0)delete player.__chilled;
    }
    // 弹窗优先级：技能分支 > 章节祝福 > 祭坛赐福 > 魔镜选牌（弹出时世界暂停）
    const pend=(typeof SkillBranchSys!=="undefined"&&SkillBranchSys.pending)?SkillBranchSys
             :(typeof ChapterSys!=="undefined"&&ChapterSys.boonChoices.length)?ChapterSys
             :(typeof RandomEvents!=="undefined"&&RandomEvents.pendingBoon)?RandomEvents
             :(typeof MIRROR!=="undefined"&&MIRROR.pendingChoice)?MIRROR:null;
    if(pend){
      updateParticles(dt);
      render();
      pend.drawOverlay(ctx);
      return;
    }
    gameTime+=dt;
    // 手感顿帧：Juice.update 返回 dtScale（0=世界冻结），魔镜/UI 计时仍走真实 dt
    const dtScale=(typeof Juice!=="undefined")?Juice.update(dt):1;
    const wdt=dt*dtScale;
    player.update(wdt,input);
    updateGlam(wdt);
    if(typeof BIOME!=="undefined") BIOME.updateAmbient(dt);
    updateSpawner(wdt);
    updateEnemies(wdt);
    RESONANCE.recompute();
    if(typeof AFFIXES!=="undefined") for(const e of enemies) AFFIXES.rollFor(e);
    if(typeof ChapterSys!=="undefined") ChapterSys.update(dt);
    if(typeof RandomEvents!=="undefined") RandomEvents.update(dt);
    // 战术道具：充能回复与实体更新
    if(typeof Gadgets!=="undefined") Gadgets.update(dt);
    // 挑战局：小怪波次 + Boss死亡→挑战胜利
    if(typeof chState!=="undefined"&&chState.levelId>0){
      updateChallengeMinions();
    }
    // 决斗调律：挑战局技能调度走特化版本（火球追踪/冰环护体/雷矛），否则原版
    if(typeof updateSkillsDuel==="function"&&window.__duelMode) updateSkillsDuel(wdt);
    else updateSkills(wdt);
    // BGM 随章节/Boss 切换
    if(typeof BGM!=="undefined"){
      const wantTrack=(enemies.some(e=>e.isBoss))?3:((typeof ChapterSys!=="undefined")?ChapterSys.idx:0);
      if(BGM.trackIdx!==wantTrack||!BGM.playing){BGM.stop();BGM.play(wantTrack);}
    }
    RESONANCE.update(wdt);
    if(typeof EVOLUTION!=="undefined") EVOLUTION.check();
    if(typeof MIRROR!=="undefined") MIRROR.update(dt);
    updateGems(wdt);
    updateChests(wdt);
    updateDrops(wdt);
    updateChestRitual(wdt);
    updateParticles(wdt);
    updateDmgTexts(wdt);
    Shake.update(wdt);
    updateCamera();
    // 中毒染色衰减
    for(const e of enemies) if(e.poisonT>0){ e.poisonT-=dt; if(e.poisonT<=0) e.poisoned=false; }
    // 死亡判定优先于升级弹窗
    if(player.hp<=0){
      winFlag=false; gameState="end"; Shake.add(12);
      if(typeof chState!=="undefined"&&chState.levelId>0){
        chState.result={win:false};
      }
    }
    else if(pendingLevelUps>0){ buildUpgradeChoices(); gameState="levelup"; }
  } else if(gameState==="levelup"){
    // 暂停世界，仅更新粒子做背景呼吸感
    updateParticles(dt);
    if(pendingLevelUps>0){
      if(upgradeChoices.length===0) buildUpgradeChoices(); // 连升队列：补齐下一轮选项
    } else {
      gameState="playing";
      lastT=performance.now(); // 防止暂停期间积累的 dt 造成世界快进
    }
  }
  render();
  if(gameState==="levelup") drawUpgradeScreen();
}

function render(){
  const off=Shake.offset();
  const camX=cam.x-off.x, camY=cam.y-off.y;
  drawWorld();
  if(typeof MIRROR!=="undefined") MIRROR.drawWorld(ctx,camX,camY);
  if(typeof RandomEvents!=="undefined") RandomEvents.drawWorldObjects(ctx,camX,camY);
  drawZones(ctx,camX,camY);
  drawGems(ctx,camX,camY);
  drawDrops(ctx,camX,camY);
  drawChestRitual(ctx,camX,camY);
  drawChests(ctx,camX,camY);
  drawQuakeWarn(ctx,camX,camY);
  drawStarfallWarn(ctx,camX,camY);
  drawEnemies(ctx,camX,camY);
  if(typeof drawGlamBack==="function") drawGlamBack(ctx,camX,camY);
  player.draw(ctx,camX,camY);
  if(typeof drawGlamFront==="function") drawGlamFront(ctx,camX,camY);
  drawBlades(ctx,camX,camY);
  if(typeof Gadgets!=="undefined"){
    Gadgets.drawWorld(ctx,camX,camY);
    Gadgets.drawGhost(ctx,camX,camY);   // 放置预览
  }
  if(typeof drawDuelFrostAura==="function") drawDuelFrostAura(ctx,camX,camY);
  drawProjectiles(ctx,camX,camY);
  drawBeams(ctx,camX,camY);
  drawShockwaves(ctx,camX,camY);
  drawParticles(ctx,camX,camY);
  ctx.textAlign="center";
  for(const d of dmgTexts){
    ctx.save();
    ctx.globalAlpha=Math.min(1,d.life/0.25);
    ctx.font=d.size?("bold "+d.size+"px sans-serif"):(d.crit?"bold 22px sans-serif":"bold 15px sans-serif");
    ctx.fillStyle="#241a2e";
    ctx.fillText(d.val,d.x-camX+1,d.y-camY+1);
    ctx.fillStyle=d.color;
    ctx.fillText(d.val,d.x-camX,d.y-camY);
    ctx.restore();
  }
  drawHUD();
  RESONANCE.drawHUD();
  if(typeof Gadgets!=="undefined") Gadgets.drawHUD(ctx);
  if(typeof EVOLUTION!=="undefined") EVOLUTION.drawHUD();
  if(typeof ChapterSys!=="undefined"&&ChapterSys.banner) ChapterSys.drawBanner(ctx);
  if(typeof RandomEvents!=="undefined"&&RandomEvents.banner){
    const b=RandomEvents.banner;
    ctx.save();ctx.globalAlpha=Math.min(1,b.t/.5);ctx.textAlign="center";
    ctx.font="bold 30px sans-serif";ctx.lineWidth=6;ctx.strokeStyle="#1a1026";
    ctx.strokeText(b.text,VIEW_W/2,240);ctx.fillStyle=b.color;
    ctx.fillText(b.text,VIEW_W/2,240);ctx.restore();
  }
  if(typeof AFFIXES!=="undefined") for(const e of enemies) if(e.affixes) AFFIXES.drawBadge(ctx,e,camX,camY);
  if(typeof Juice!=="undefined"){
    Juice.drawBossBar(ctx);
    Juice.drawOverlays(ctx);
  }
}

function drawFatal(err){
  ctx.fillStyle="#1a0d0d"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.fillStyle="#ff6b6b"; ctx.font="18px monospace"; ctx.textAlign="left";
  ctx.fillText("原型出错了："+err.message,30,60);
  ctx.fillText(String(err.stack).split("\n").slice(0,6).join("\n"),30,100);
}
requestAnimationFrame(frame);
