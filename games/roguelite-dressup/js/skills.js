// ===== 技能系统：投射物/区域/特效 全局池 =====
let projectiles=[];   // 直线飞行弹体
let zones=[];         // 滞留区域（毒圈等）
let beams=[];         // 瞬时射线视觉（雷链等）
let shockwaves=[];    // 扩散环
const outfitMods=()=>player.outfit.mods;

function dealDamage(e,dmg,opt){
  opt=opt||{};
  if(typeof dmg!=="number"||!isFinite(dmg))dmg=0;   // 伤害兜底：绝不把 NaN 写进飘字
  let final=dmg*player.atkMul;
  if(opt.element==="fire"&&outfitMods().fireDmg) final*=(1+outfitMods().fireDmg);
  if((e.isElite||e.isBoss)&&typeof hasRelic==="function"&&hasRelic("giantslayer")) final*=1.35;
  e.hp-=final;
  e.hitFlash=0.1;
  spawnDmgText(e.x,e.y-e.r,final,opt.color||"#fff",false,opt.__crit);
}

// ---------- 1. 烈焰火球 ----------
let fbCd=0;
function updateFireball(dt){
  const lv=player.skillLv("fireball");
  if(lv<=0){ fbCd=0; return; }
  fbCd-=dt;
  const cd=1.0*(1-player.haste);
  if(fbCd<=0){
    fbCd=cd;
    const count=lv>=3?2:1;
    for(let k=0;k<count;k++){
      const t=nearestEnemy(player.x,player.y,k*60);
      if(!t) break;
      const a=Math.atan2(t.y-player.y,t.x-player.x)+rand(-0.05,0.05);
      projectiles.push({
        kind:"fireball", x:player.x, y:player.y,
        vx:Math.cos(a)*420, vy:Math.sin(a)*420,
        r:9, dmg:18*(lv===2?1.3:lv===4?1.82:1)*(1+(lv>=3?0:0)),
        life:2.2, pierce:0, element:"fire",
        aoeR:(55+lv*4)*(1+(outfitMods().fireAoe||0)),
        tripleBlast:lv>=5, color:"#ff6b35"
      });
    }
  }
}
function explodeFireball(p){
  burst(p.x,p.y,18,{r0:4,r1:20,life:0.45,color:"#ff8c42",glow:true,spdMin:80,spdMax:260});
  spawnParticle(p.x,p.y,{r0:10,r1:p.aoeR+12,life:0.35,color:"rgba(255,120,40,0.5)",shape:"ring"});
  Shake.add(3);
  hitArea(p.x,p.y,p.aoeR,(e)=>{ dealDamage(e,p.dmg,{element:"fire",color:"#ff8c42"}); });
  if(p.tripleBlast){
    // 三连爆：延迟两次再炸
    setTimeoutFx(0.18,()=>{ blastAt(p.x,p.y,p.aoeR*0.85,p.dmg*0.6); });
    setTimeoutFx(0.36,()=>{ blastAt(p.x+rand(-30,30),p.y+rand(-30,30),p.aoeR*0.7,p.dmg*0.36); });
  }
}
function blastAt(x,y,r,dmg){
  burst(x,y,14,{r0:4,r1:16,life:0.4,color:"#ffb347",glow:true,spdMin:70,spdMax:220});
  spawnParticle(x,y,{r0:8,r1:r+10,life:0.3,color:"rgba(255,140,50,0.45)",shape:"ring"});
  hitArea(x,y,r,(e)=>dealDamage(e,dmg,{element:"fire",color:"#ff8c42"}));
}

// 延迟回调池（不用 setTimeout，避免暂停/结束时错乱）
let delayedCalls=[];
function setTimeoutFx(t,fn){ delayedCalls.push({t,fn}); }
function updateDelayed(dt){
  for(let i=delayedCalls.length-1;i>=0;i--){
    delayedCalls[i].t-=dt;
    if(delayedCalls[i].t<=0){ const fn=delayedCalls[i].fn; delayedCalls.splice(i,1); fn(); }
  }
}

// ---------- 圣物查询工具（由 loot.js 定义，防御式声明防加载顺序问题）----------
function relicAoeMul(){ return (typeof hasRelic==="function"&&hasRelic("astralens"))?1.2:1; }
function hasRelic(id){ return !!(player&&player.relics&&player.relics.some(r=>r.id===id)); }

// 区域命中工具
function hitArea(x,y,r,cb){
  const R=r*relicAoeMul();          // 星界透镜：全技能范围+20%
  const r2=R*R;
  for(const e of enemies){
    if(dist2(x,y,e.x,e.y)<r2+(e.r*e.r)) cb(e);
  }
}
function nearestEnemy(x,y,minDist){
  let best=null,bd=Infinity;
  for(const e of enemies){
    const d=dist2(x,y,e.x,e.y);
    if(d>minDist*minDist && d<bd && d<600*600){ bd=d; best=e; }
  }
  return best;
}

// ---------- 2. 冰霜新星 ----------
let fnCd=0;
function updateFrostnova(dt){
  const lv=player.skillLv("frostnova");
  if(lv<=0){ fnCd=0; return; }
  fnCd-=dt;
  if(fnCd<=0){
    fnCd=3.5*(1-player.haste);
    const dur=(lv>=4?3.0:2.0)*(1+(outfitMods().iceDur||0));
    const slowK=Math.min(0.9,0.4+(lv>=3?0.25:0)+(outfitMods().iceSlow||0));
    const R=140+(lv>=2?28:0);
    shockwaves.push({x:player.x,y:player.y,r0:20,r1:R,maxR:R,life:0.5,maxLife:0.5,
      color:"#a5e3f7",width:6,hit:false,
      element:"ice",dmg:10*(lv>=2?1.4:1),
      slowK,dur,freeze:lv>=5?1.0:0});
    burst(player.x,player.y,10,{r0:2,r1:8,life:0.5,color:"#dff3fb",shape:"shard",spdMin:60,spdMax:180,vrot:3});
  }
}
// 冲击波更新（冰环/圣光共用）
function updateShockwaves(dt){
  for(let i=shockwaves.length-1;i>=0;i--){ const w=shockwaves[i];
    w.life-=dt;
    const t=1-w.life/w.maxLife;
    w.curR=lerp(w.r0,w.maxR,t);
    if(!w.hitDone){
      if(w.knockback){
        // 圣光：全屏推荡
        for(const e of enemies){
          if(dist2(w.x,w.y,e.x,e.y)<w.maxR*w.maxR){
            dealDamage(e,w.dmg,{element:w.element,color:w.color});
            if(!e.isBoss){ const d=dist(w.x,w.y,e.x,e.y)||1;
              e.knockVx+=(e.x-w.x)/d*w.knockback*4; e.knockVy+=(e.y-w.y)/d*w.knockback*4; }
            if(w.blind) e.blindT=w.blind;
            spawnParticle(e.x,e.y,{r0:3,r1:9,life:0.3,color:"#ffe66d",glow:true,shape:"spark"});
          } }
        w.hitDone=true;
      } else {
        // 冰霜：扩散边缘命中
        for(const e of enemies){
          const d=dist(w.x,w.y,e.x,e.y);
          if(Math.abs(d-w.curR)<e.r+14 && !w.hitSet){
            // 首次扫过
          }
        }
      }
    }
    // 冰环命中判定：扩散前沿扫过敌人一次
    if(w.element==="ice"){
      w.hitList=w.hitList||new Set();
      for(const e of enemies){
        const d=dist(w.x,w.y,e.x,e.y);
        if(Math.abs(d-w.curR)<e.r+16&&!w.hitList.has(e)){
          w.hitList.add(e);
          dealDamage(e,w.dmg,{element:"ice",color:"#a5e3f7"});
          if(w.freeze>0&&!e.isBoss) e.freezeT=w.freeze;
          else { e.slowT=w.dur; e.slowK=w.slowK; }
        } }
    }
    if(w.life<=0) shockwaves.splice(i,1);
  }
}
function drawShockwaves(ctx,camX,camY){
  for(const w of shockwaves){
    const alpha=w.life/w.maxLife;
    ctx.save();
    ctx.globalAlpha=alpha*0.9;
    ctx.strokeStyle=w.color;
    ctx.lineWidth=w.width*alpha+1;
    ctx.beginPath(); ctx.arc(w.x-camX,w.y-camY,w.curR,0,Math.PI*2); ctx.stroke();
    if(w.glowy){ ctx.globalAlpha=alpha*0.3; ctx.lineWidth=(w.width*alpha+1)*3;
      ctx.beginPath(); ctx.arc(w.x-camX,w.y-camY,w.curR,0,Math.PI*2); ctx.stroke(); }
    ctx.restore();
  }
}

// ---------- 3. 雷链术 ----------
let cbCd=0;
function updateChainbolt(dt){
  const lv=player.skillLv("chainbolt");
  if(lv<=0){ cbCd=0; return; }
  cbCd-=dt;
  if(cbCd<=0){
    cbCd=2.2*(1-player.haste);
    const first=nearestEnemy(player.x,player.y,0);
    if(!first){ cbCd=0.3; return; }
    const jumps=(4+(lv>=3?2:0)+(outfitMods().chainExtra||0))+(lv>=5?2:0);
    const dmg=16*((lv>=2?1.3:1)*(lv>=4?1.3:1));
    let cur=first, from={x:player.x,y:player.y};
    const hit=new Set();
    for(let j=0;j<jumps&&cur;j++){
      hit.add(cur);
      beams.push({x1:from.x,y1:from.y,x2:cur.x,y2:cur.y,life:0.22,maxLife:0.22,color:"#ffd93d"});
      dealDamage(cur,dmg,{element:"bolt",color:"#ffd93d"});
      cur.stunT=0.15;
      burst(cur.x,cur.y,5,{r0:2,r1:7,life:0.25,color:"#fff3a0",glow:true,spdMin:40,spdMax:150});
      from={x:cur.x,y:cur.y};
      // 下一个最近未命中敌人
      let best=null,bd=Infinity;
      for(const e of enemies){ if(hit.has(e)) continue;
        const d=dist2(from.x,from.y,e.x,e.y);
        if(d<bd&&d<260*260){ bd=d; best=e; } }
      cur=best;
    }
    if(lv>=5&&from){ // 终点落雷
      blastAt(from.x,from.y,70,dmg*0.8);
      beams.push({x1:from.x,y1:from.y-500,x2:from.x,y2:from.y,life:0.25,maxLife:0.25,color:"#fff"});
      Shake.add(4);
    } else Shake.add(1.5);
  }
}
function updateBeams(dt){
  for(let i=beams.length-1;i>=0;i--){ beams[i].life-=dt; if(beams[i].life<=0) beams.splice(i,1); }
}
function drawBeams(ctx,camX,camY){
  for(const b of beams){
    const alpha=b.life/b.maxLife;
    ctx.save(); ctx.globalAlpha=alpha;
    ctx.strokeStyle=b.color; ctx.lineWidth=3; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(b.x1-camX,b.y1-camY);
    // 锯齿折线
    const segs=6, dx=(b.x2-b.x1)/segs, dy=(b.y2-b.y1)/segs;
    for(let s=1;s<segs;s++){
      ctx.lineTo(b.x1+dx*s+rand(-7,7)-camX, b.y1+dy*s+rand(-7,7)-camY);
    }
    ctx.lineTo(b.x2-camX,b.y2-camY); ctx.stroke();
    ctx.globalAlpha=alpha*0.4; ctx.lineWidth=8; ctx.stroke();
    ctx.restore();
  }
}

// ---------- 4. 回旋刃 ----------
let bladeState=null;
function updateBlades(dt){
  const lv=player.skillLv("blades");
  if(lv<=0){ bladeState=null; return; }
  if(!bladeState) bladeState={angle:0};
  bladeState.angle+=dt*(3*(lv>=2?1.3:1));
  const count=lv>=5?4:(lv>=3?3:2);
  const radius=80*(lv>=5?1.5:1);
  const dmg=12*(lv>=4?1.4:1);
  bladeState.list=bladeState.list||[];
  while(bladeState.list.length<count) bladeState.list.push({hitCd:new Map()});
  for(let i=0;i<count;i++){
    const a=bladeState.angle+i*Math.PI*2/count;
    const bx=player.x+Math.cos(a)*radius, by=player.y+Math.sin(a)*radius;
    bladeState.list[i].x=bx; bladeState.list[i].y=by;
    // 命中判定（每个敌人 0.3s 内不重复受伤）
    for(const e of enemies){
      const m=bladeState.list[i].hitCd;
      const last=m.get(e)||0;
      if(gameTime-last>0.35&&dist2(bx,by,e.x,e.y)<(e.r+13)*(e.r+13)){
        m.set(e,gameTime);
        dealDamage(e,dmg,{element:"wind",color:"#a8e6cf"});
        burst(bx,by,3,{r0:2,r1:6,life:0.2,color:"#d8ffe9",spdMin:30,spdMax:100});
      } }
  }
}
function drawBlades(ctx,camX,camY){
  if(!bladeState) return;
  for(const b of bladeState.list){
    const x=b.x-camX,y=b.y-camY;
    ctx.save(); ctx.translate(x,y);
    ctx.rotate(gameTime*12);
    ctx.strokeStyle="#241a2e"; ctx.lineWidth=2; ctx.fillStyle="#cdeedd";
    ctx.beginPath();
    ctx.moveTo(0,-13); ctx.quadraticCurveTo(9,-6,0,13); ctx.quadraticCurveTo(-9,-6,0,-13);
    ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.fillStyle="#a8e6cf";
    ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // 刀光残影
    if(Math.random()<0.3)
      spawnParticle(b.x,b.y,{r0:5,r1:2,life:0.2,color:"rgba(168,230,207,0.5)"});
  }
}
