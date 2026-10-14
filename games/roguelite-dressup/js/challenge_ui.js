// ===== v0.8 挑战模式界面与战斗流程 =====
// gameState: 'ch_select'(关卡选择) → 'ch_loadout'(备战) → 'playing'(rush规则) → 'ch_result'
// 备战配置：主技能×2(Lv3起板) + 时装；弱点软引导 ×1.5。

const ChallengeUI = {
  selLevel:1, loadout:{skills:["fireball","frostnova"],outfit:"novice"},
  cardRects:[], toast:null,

  reset(){this.cardRects=[];this.toast=null;},

  say(t,c){this.toast={text:t,color:c,t:2};},

  // ---------- 关卡选择 ----------
  drawSelect(ctx){
    ctx.fillStyle="#14121f";ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.textAlign="center";
    ctx.fillStyle="#ffe66d";ctx.font="bold 40px sans-serif";
    ctx.fillText("⚔ 魔 王 挑 战 ⚔",VIEW_W/2,84);
    ctx.fillStyle="#b8a9d9";ctx.font="16px sans-serif";
    ctx.fillText("选择你的关卡 · 星级评价 · 解锁更强力量",VIEW_W/2,116);
    this.cardRects=[];
    const cw=232,ch=300,gap=16;
    const x0=VIEW_W/2-(cw*CHALLENGE_LEVELS.length+gap*(CHALLENGE_LEVELS.length-1))/2;
    for(const lv of CHALLENGE_LEVELS){
      const cx=x0+(lv.id-1)*(cw+gap);
      this.cardRects.push({x:cx,y:150,w:cw,h:ch,lv:lv.id});
      const unlocked=ChallengeSave.isUnlocked(lv.id);
      const stars=ChallengeSave.data.stars[lv.id]||0;
      const hov=unlocked&&mouse.x>=cx&&mouse.x<=cx+cw&&mouse.y>=150&&mouse.y<=150+ch;
      ctx.save();
      if(hov){ctx.shadowColor=lv.bossColor;ctx.shadowBlur=24;}
      ctx.fillStyle=hov?"rgba(255,255,255,.12)":"rgba(255,255,255,.05)";
      ctx.strokeStyle=unlocked?(hov?lv.bossColor:"rgba(255,255,255,.35)"):"rgba(255,255,255,.15)";
      ctx.lineWidth=hov?3.5:2;
      ctx.beginPath();ctx.roundRect(cx,150,cw,ch,16);ctx.fill();ctx.stroke();
      ctx.restore();
      if(!unlocked){
        ctx.fillStyle="rgba(255,255,255,.4)";ctx.font="44px sans-serif";
        ctx.fillText("🔒",cx+cw/2,270);
        ctx.fillStyle="#8a7fa8";ctx.font="15px sans-serif";
        ctx.fillText("通关上一关解锁",cx+cw/2,320);
        continue;
      }
      // 关卡号+Boss名
      ctx.fillStyle=lv.bossColor;ctx.font="bold 15px sans-serif";
      ctx.fillText("LEVEL "+lv.id,cx+cw/2,190);
      ctx.fillStyle="#fff";
      let bfs=26; ctx.font="bold 26px sans-serif";
      while(bfs>14&&ctx.measureText(lv.bossName).width>cw-24){bfs--;ctx.font="bold "+bfs+"px sans-serif";}
      ctx.fillText(lv.bossName,cx+cw/2,226);
      // Boss 剪影（用Boss绘制简化版）
      ctx.save();ctx.translate(cx+cw/2,290);ctx.scale(1.1,1.1);
      drawMiniBossSil(ctx,lv.bossColor);ctx.restore();
      // 弱点标签
      ctx.fillStyle="#ffb347";ctx.font="14px sans-serif";
      ctx.fillText(lv.weakText.split("；")[0],cx+cw/2,366);
      // 星级
      let sTxt="";
      for(let k=0;k<3;k++)sTxt+=k<stars?"⭐":"☆";
      ctx.fillStyle="#ffd700";ctx.font="20px sans-serif";
      ctx.fillText(sTxt,cx+cw/2,402);
      // 限时提示
      ctx.fillStyle="rgba(255,255,255,.5)";ctx.font="13px sans-serif";
      ctx.fillText("限时星："+Math.floor(lv.timeLimitStar)+"秒",cx+cw/2,430);
    }
    ctx.fillStyle="rgba(255,255,255,.45)";ctx.font="15px sans-serif";
    ctx.fillText("点击关卡进入备战 · [Q] 返回标题",VIEW_W/2,560);
  },
  onSelectClick(x,y){
    for(const r of this.cardRects){
      if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h){
        if(!ChallengeSave.isUnlocked(r.lv)){
          this.say("先通关前面的关卡","#ff9e9e");
          if(typeof SFX!=="undefined")SFX.play("ui");
          return true;
        }
        this.selLevel=r.lv;
        gameState="ch_loadout";
        if(typeof SFX!=="undefined")SFX.play("ui");
        return true;
      }
    }
    return false;
  },

  // ---------- 备战界面：选2技能+1时装 ----------
  drawLoadout(ctx){
    const lv=CHALLENGE_LEVELS.find(l=>l.id===this.selLevel);
    ctx.fillStyle="#14121f";ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.textAlign="center";
    ctx.fillStyle="#ffe66d";ctx.font="bold 34px sans-serif";
    ctx.fillText("备 战 · "+lv.bossName,VIEW_W/2,70);
    ctx.fillStyle="#ffb347";ctx.font="bold 17px sans-serif";
    ctx.fillText(lv.weakText,VIEW_W/2,102);
    ctx.fillStyle="rgba(178,169,217,.85)";ctx.font="14px sans-serif";
    ctx.fillText("「"+lv.intro+"」",VIEW_W/2,128);
    this.cardRects=[];
    // 技能区
    ctx.fillStyle="#fff";ctx.font="bold 19px sans-serif";ctx.textAlign="left";
    ctx.fillText("主技能 ×2（Lv3 起板）",80,170);
    const skIds=Object.keys(SKILLS_META).filter(id=>Meta.isUnlocked("skill_"+id)||true); // 全开放，锁定走奖励系统后过滤
    const scw=118,sch=118,sgap=10;
    skIds.forEach((id,i)=>{
      const m=SKILLS_META[id];
      const col=i%6,row=Math.floor(i/6);
      const cx=80+col*(scw+sgap),cy=185+row*(sch+sgap);
      const chosen=this.loadout.skills.includes(id);
      const weakHit=(m.element==="火"&&(lv.weak==="fire"))||(m.element==="暗"&&lv.weak==="dark");
      const hov=mouse.x>=cx&&mouse.x<=cx+scw&&mouse.y>=cy&&mouse.y<=cy+sch;
      ctx.save();
      if(chosen){ctx.shadowColor=m.color;ctx.shadowBlur=18;}
      ctx.fillStyle=chosen?"rgba(255,255,255,.13)":"rgba(255,255,255,.05)";
      ctx.strokeStyle=chosen?m.color:(weakHit?"#ffb347":"rgba(255,255,255,.25)");
      ctx.lineWidth=chosen?3.5:(weakHit?2.6:1.6);
      if(hov)ctx.lineWidth+=1;
      ctx.beginPath();ctx.roundRect(cx,cy,scw,sch,10);ctx.fill();ctx.stroke();
      ctx.restore();
      if(weakHit&&!chosen){ // 弱点推荐角标
        ctx.fillStyle="#ffb347";ctx.font="bold 11px sans-serif";ctx.textAlign="center";
        ctx.fillText("弱点↑",cx+scw/2,cy+16);
      }
      ctx.fillStyle=m.color;ctx.beginPath();ctx.arc(cx+scw/2,cy+48,17,0,7);ctx.fill();
      ctx.fillStyle="#fff";ctx.font="bold 17px sans-serif";ctx.textAlign="center";
      ctx.fillText(m.name[0],cx+scw/2,cy+54);
      ctx.fillStyle=chosen?"#ffe66d":"rgba(255,255,255,.75)";ctx.font="bold 13px sans-serif";
      ctx.fillText(m.name,cx+scw/2,cy+88);
      if(chosen){ctx.fillStyle="#ffe66d";ctx.font="12px sans-serif";ctx.fillText("✓ 已选",cx+scw/2,cy+106);}
    });
    // 时装区（右侧）
    ctx.fillStyle="#fff";ctx.font="bold 19px sans-serif";ctx.textAlign="left";
    ctx.fillText("出战时装 ×1",850,170);
    OUTFITS.forEach((o,i)=>{
      const col=i%3,row=Math.floor(i/3);
      const cx=850+col*(120+10),cy=185+row*(130+10);
      const owned=Meta.isUnlocked(o.id);
      const chosen=this.loadout.outfit===o.id;
      const hov=owned&&mouse.x>=cx&&mouse.x<=cx+115&&mouse.y>=cy&&mouse.y<=cy+125;
      ctx.strokeStyle=chosen?o.accent:(owned?"rgba(255,255,255,.35)":"rgba(255,255,255,.12)");
      ctx.lineWidth=chosen?3.5:1.6;
      ctx.fillStyle=chosen?"rgba(255,255,255,.12)":(owned?"rgba(255,255,255,.04)":"rgba(0,0,0,.25)");
      ctx.beginPath();ctx.roundRect(cx,cy,115,125,10);ctx.fill();ctx.stroke();
      if(!owned){ctx.fillStyle="#666";ctx.font="24px sans-serif";ctx.textAlign="center";ctx.fillText("🔒",cx+57,cy+60);}
      else{
        drawOutfitPreview(ctx,o,cx+57,cy+52);
        ctx.fillStyle=chosen?"#ffe66d":"rgba(255,255,255,.7)";ctx.font="12px sans-serif";ctx.textAlign="center";
        ctx.fillText(o.name,cx+57,cy+105);
        if(chosen){ctx.fillText("✓ 出战中",cx+57,cy+120);}
      }
    });
    // 出战按钮
    const ok=this.loadout.skills.length===2&&Meta.isUnlocked(this.loadout.outfit);
    ctx.save();
    if(ok){ctx.shadowColor="#ffe66d";ctx.shadowBlur=16;}
    ctx.fillStyle=ok?"rgba(255,215,0,.2)":"rgba(255,255,255,.06)";
    ctx.strokeStyle=ok?"#ffd700":"rgba(255,255,255,.3)";ctx.lineWidth=2.5;
    ctx.beginPath();ctx.roundRect(VIEW_W/2-130,520,260,54,14);ctx.fill();ctx.stroke();
    ctx.restore();
    ctx.fillStyle=ok?"#ffd700":"#777";ctx.font="bold 22px sans-serif";ctx.textAlign="center";
    ctx.fillText(ok?"⚔ 出 战 ⚔":"需选满 2 个技能",VIEW_W/2,555);
    this.cardRects.push({go:true,x:VIEW_W/2-130,y:520,w:260,h:54});
    ctx.fillStyle="rgba(255,255,255,.45)";ctx.font="14px sans-serif";
    ctx.fillText("[Q] 返回关卡选择",VIEW_W/2,600);
  },
  onLoadoutClick(x,y){
    const goBtn=this.cardRects.find(r=>r.go);
    if(goBtn&&x>=goBtn.x&&x<=goBtn.x+goBtn.w&&y>=goBtn.y&&y<=goBtn.y+goBtn.h){
      if(this.loadout.skills.length===2){startChallengeRun();return;}
    }
    // 技能卡
    const skIds=Object.keys(SKILLS_META);
    skIds.forEach((id,i)=>{
      const col=i%6,row=Math.floor(i/6);
      const cx=80+col*(118+10),cy=185+row*(118+10);
      if(x>=cx&&x<=cx+118&&y>=cy&&y<=cy+118){
        const s=this.loadout.skills;
        const at=s.indexOf(id);
        if(at>=0)s.splice(at,1);
        else{if(s.length>=2)s.shift();s.push(id);}
        if(typeof SFX!=="undefined")SFX.play("ui");
      }
    });
    // 时装卡
    OUTFITS.forEach((o,i)=>{
      const col=i%3,row=Math.floor(i/3);
      const cx=850+col*(120+10),cy=185+row*(130+10);
      if(x>=cx&&x<=cx+115&&y>=cy&&y<=cy+125){
        if(Meta.isUnlocked(o.id)){
          this.loadout.outfit=o.id;
          if(typeof SFX!=="undefined")SFX.play("ui");
        } else {this.say("该时装尚未解锁","#ff9e9e");}
      }
    });
  },
};

function drawMiniBossSil(ctx,col){
  ctx.fillStyle="rgba(0,0,0,.35)";
  ctx.beginPath();ctx.ellipse(0,42,34,10,0,0,7);ctx.fill();
  ctx.fillStyle=col;ctx.strokeStyle=OUT_COLOR();ctx.lineWidth=2.6;
  ctx.beginPath();ctx.arc(0,8,32,0,7);ctx.fill();ctx.stroke();
  ctx.fillStyle="#7a1f1f";ctx.strokeStyle=OUT_COLOR();ctx.lineWidth=2;
  for(const s of[-1,1]){
    ctx.beginPath();ctx.moveTo(s*15,-16);
    ctx.quadraticCurveTo(s*30,-33,s*23,-46);
    ctx.quadraticCurveTo(s*20,-34,s*7,-28);
    ctx.closePath();ctx.fill();ctx.stroke();
  }
  ctx.fillStyle="#ffd93d";
  ctx.beginPath();ctx.arc(-10,2,4.4,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(10,2,4.4,0,7);ctx.fill();
}

// ---------- 挑战局流程控制 ----------
let chState={levelId:0,noHit:true,minionIdx:0,timer:0};

function startChallengeRun(){
  const lv=CHALLENGE_LEVELS.find(l=>l.id===ChallengeUI.selLevel);
  window.__duelMode=true;   // 决斗调律开启
  if(typeof DuelTuning!=="undefined")DuelTuning.reset();
  if(typeof Gadgets!=="undefined") Gadgets.reset(Meta.data.gadgetPreset||Gadgets.owned);
  if(typeof SysReg!=="undefined") SysReg.resetAll();   // v0.14：统一生命周期
  player=new Player(ChallengeUI.loadout.outfit);
  player.relics=[];
  // 主技能×2，Lv3起板（沿用已选分支默认第一条）
  player.skills=[];
  for(const id of ChallengeUI.loadout.skills){
    player.skills.push({id:id,lv:3});
    const tiers=SKILL_BRANCHES[id];
    if(tiers&&tiers[3])tiers[3][0].mod(player);   // 默认应用 Lv3 第一分支
  }
  gameTime=0;pendingLevelUps=0;winFlag=false;
  spawnTimer=999;waveTimer=99999;eliteTimer=99999;bossSpawned=true; // 无尽出怪全关
  enemies=[];xpGems=[];chests=[];projectiles=[];zones=[];drops=[];
  beams=[];shockwaves=[];particles=[];dmgTexts=[];delayedCalls=[];
  quakeQueue=[];starfallQueue=[];bladeState=null;
  chestRitual=null;SOFT_PITY.kills=0;SOFT_PITY.granted=false;
  Meta.beginRun();
  RESONANCE.recompute();initGlam(player);glamBurst(1.2);
  if(typeof BIOME!=="undefined")BIOME.init();
  if(typeof EVOLUTION!=="undefined")EVOLUTION.reset();
  if(typeof MIRROR!=="undefined")MIRROR.reset();
  if(typeof Juice!=="undefined")Juice.reset();
  if(typeof ChapterSys!=="undefined")ChapterSys.reset();
  if(typeof SkillBranchSys!=="undefined")SkillBranchSys.reset();
  if(typeof RandomEvents!=="undefined")RandomEvents.reset();
  if(typeof BGM!=="undefined"){BGM.stop();BGM.play(2);}
  // 弱点全局标记
  window.__challengeWeak=lv.weak;
  // 生成挑战Boss
  chState={levelId:lv.id,noHit:true,minionIdx:0,timer:0};
  const b=spawnChallengeBoss(lv);
  burst(b.x,b.y,40,{r0:4,r1:24,life:.8,color:lv.bossColor,glow:true,spdMin:90,spdMax:320});
  Shake.add(12);
  if(typeof SFX!=="undefined")SFX.play("bosspawn");
  gameState="playing";
}

function spawnChallengeBoss(lv){
  window.__challengeBossKind = lv.id===2?"frost":(lv.id===3?"shadow":null);
  const e={
    type:"boss",x:player.x+300,y:player.y,r:46,
    hp:2600*lv.hpMul,maxHp:2600*lv.hpMul,
    speed:55,dmg:26,xp:0,coin:150,
    color:lv.bossColor,isElite:false,isBoss:true,
    sinePhase:0,hitFlash:0,slowT:0,slowK:0,freezeT:0,blindT:0,
    knockVx:0,knockVy:0,launchT:0,fuse:-1,wobble:0,
    chargeCd:3,charging:0,chargeVx:0,chargeVy:0,
    phase:1,patternCd:2.2,ringCount:0,
    challenge:true,
    enrageAt:lv.enrageAt||0,   // 狂暴计时（L4/L5）：超时攻速移速暴涨
    enraged:false,
  };
  // 狂暴检查挂到敌人身上（updateEnemies 中按 gameTime 判定）
  enemies.push(e);
  return e;
}
