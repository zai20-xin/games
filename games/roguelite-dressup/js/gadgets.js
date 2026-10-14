// ===== v0.11 战术道具系统：手动放置 × 充能存储 =====
// 玩家按 1~6 选出道具 → 鼠标移动显示幽灵预览 → 左键在指定位置放置。
// 每件道具有独立充能：上限 3 层，随时间回复（cd 即单层回充时间）。
// 羁绊系统保留：同时携带特定组合激活额外特效。

const GADGETS = [
  { id:"laser",   name:"激光发射器", icon:"🔆", cd:4.0, color:"#ff5c5c", aim:"direction",
    desc:"向准星方向射出贯穿激光" },
  { id:"mine",    name:"蜘蛛地雷",  icon:"💣", cd:3.5, color:"#ffb347", aim:"point", range:95,
    desc:"放置感应地雷，敌近引爆" },
  { id:"hourglass",name:"沙漏陷阱", icon:"⏳", cd:5.5, color:"#e8c39e", aim:"point", range:100,
    desc:"时滞力场大幅减速敌人" },
  { id:"turret",  name:"自动炮塔",  icon:"🔫", cd:8.0, color:"#7db8e8", aim:"point", range:340,
    desc:"部署炮塔自动索敌射击" },
  { id:"capacitor",name:"电容线圈", icon:"⚡", cd:6.0, color:"#ffe66d", aim:"point", range:170,
    desc:"在该点释放环形电弧爆发" },
  { id:"frostgen",name:"冰霜发生器",icon:"❄", cd:5.0, color:"#a5e3f7", aim:"point", range:92,
    desc:"冻结地面持续冰伤减速" },
  { id:"gascan",  name:"毒气喷罐",  icon:"☠", cd:4.5, color:"#9ccc65", aim:"point", range:88,
    desc:"投掷毒云持续中毒伤害" },
  { id:"dronerep",name:"回收无人机",icon:"🛸", cd:7.0, color:"#b06ad4", aim:"self",
    desc:"召唤无人机环绕吸晶体" },
  { id:"shieldgen",name:"护盾发生器",icon:"🛡", cd:9.0, color:"#7ed957", aim:"self",
    desc:"获得临时护盾吸收伤害" },
  { id:"spikepad",name:"尖刺地板",  icon:"🔺", cd:4.0, color:"#ff8fab", aim:"point", range:72,
    desc:"铺设尖刺区持续刺伤" },
];

// 羁绊表：need 为道具id数组（全部携带即激活）
const SYNERGIES = [
  { id:"overload", name:"过载网络", need:["laser","capacitor"], color:"#ffd93d",
    desc:"激光首中目标引发电容连锁电弧" },
  { id:"timebomb", name:"时滞爆破", need:["mine","hourglass"], color:"#e8c39e",
    desc:"时滞力场中的地雷伤害×2且范围+50%" },
  { id:"legion",   name:"自动化军团", need:["turret","dronerep"], color:"#7ed957",
    desc:"炮塔射速+40%，无人机吸取半径×2" },
  { id:"etchbeam", name:"蚀刻光束", need:["gascan","laser"], color:"#9ccc65",
    desc:"激光路径残留毒地带" },
  { id:"icemine",  name:"冰晶地雷", need:["frostgen","mine"], color:"#a5e3f7",
    desc:"地雷爆炸附带冻结1秒" },
  { id:"matrix",   name:"能量矩阵", need:["laser","capacitor","turret"], minCount:3, color:"#7db8e8",
    desc:"三科技齐携：护盾值翻倍且护盾CD-30%" },
];

const MAX_CHARGES = 3;

const Gadgets = {
  owned:[],        // 本局携带的道具id（顺序即快捷键 1~6）
  active:[],       // 场上实体 {kind,x,y,t,...}
  synergies:[],    // 已激活羁绊id
  shieldHp:0, shieldCd:0,
  charges:{},      // 各道具当前充能层数
  rechargeT:{},    // 各道具回充倒计时
  armed:null,      // 正在瞄准的道具id（null=未选）

  has(id){ return this.owned.includes(id); },
  syn(id){ return this.synergies.includes(id); },
  slotOf(id){ return this.owned.indexOf(id); },

  reset(owned){
    this.owned=(owned||[]).slice(0,6);
    this.active=[]; this.shieldHp=0; this.shieldCd=0; this.synergies=[];
    this.armed=null; this.charges={}; this.rechargeT={};
    for(const g of GADGETS){
      if(this.has(g.id)){
        this.charges[g.id]=1;                       // 开局自带1层立即可用
        this.rechargeT[g.id]=g.cd*0.6;              // 首次回充稍快
      }
    }
    // 羁绊判定
    this.synergies=[];
    for(const s of SYNERGIES){
      if(s.minCount){ if(s.need.every(id=>this.has(id)))this.synergies.push(s.id); }
      else if(s.need.every(id=>this.has(id)))this.synergies.push(s.id);
    }
  },

  // 按 1~6 触发：选中进入瞄准（再按同键取消）
  arm(id){
    if(!this.has(id))return false;
    if((this.charges[id]||0)<=0){
      if(typeof SFX!=="undefined")SFX.play("ui");
      return false;
    }
    this.armed=(this.armed===id)?null:id;
    if(typeof SFX!=="undefined")SFX.play(this.armed?"ui":"hurt");
    return this.armed!==null;
  },
  disarm(){ this.armed=null; },

  // 回充与实体生命周期
  update(dt){
    if(!this.owned.length)return;
    for(const g of GADGETS){
      const id=g.id;
      if(!this.has(id))continue;
      if((this.charges[id]||0)<MAX_CHARGES){
        this.rechargeT[id]=(this.rechargeT[id]??g.cd)-dt;
        if(this.rechargeT[id]<=0){
          this.charges[id]=(this.charges[id]||0)+1;
          this.rechargeT[id]=g.cd*(id==="shieldgen"&&this.syn("matrix")?0.7:1);
          spawnDmgText(player.x,player.y-52,g.icon+" +1","#d8f3c8");
        }
      }
    }
    // 实体生命周期
    for(let i=this.active.length-1;i>=0;i--){
      const a=this.active[i]; a.t-=dt;
      this._tickActive(a,dt);
      if(a.t<=0){this._expire(a);this.active.splice(i,1);}
    }
    if(this.shieldHp>0)this.shieldHp=Math.max(0,this.shieldHp-dt*2);
  },

  // 在世界坐标 (wx,wy) 放置当前瞄准道具
  placeAt(wx,wy){
    const id=this.armed;
    if(!id)return false;
    if((this.charges[id]||0)<=0){this.disarm();return false;}
    wx=clamp(wx,20,WORLD.w-20); wy=clamp(wy,20,WORLD.h-20);
    this._deploy(id,wx,wy);
    this.charges[id]--;
    burst(wx,wy,8,{r0:3,r1:14,life:.35,color:this._def(id).color,glow:true,spdMin:50,spdMax:170});
    if(typeof SFX!=="undefined")SFX.play("relic");
    if((this.charges[id]||0)<=0)this.disarm();
    return true;
  },

  _def(id){ return GADGETS.find(g=>g.id===id); },

  _deploy(id,x,y){
    const p=player;
    switch(id){
      case "laser":{
        // 从玩家向准星方向的贯穿光束（长度560）
        const dx=x-p.x,dy=y-p.y,len=Math.hypot(dx,dy)||1;
        const a=Math.atan2(dy,dx);
        const ex=p.x+dx/len*560,ey=p.y+dy/len*560;
        beams.push({x1:p.x,y1:p.y,x2:ex,y2:ey,life:.22,maxLife:.22,color:"#ff5c5c"});
        let first=null;
        for(const e of enemies){
          // 点到线段距离
          const t=clamp(((e.x-p.x)*Math.cos(a)+(e.y-p.y)*Math.sin(a)),0,560);
          const px=p.x+Math.cos(a)*t,py=p.y+Math.sin(a)*t;
          if(dist2(px,py,e.x,e.y)<(e.r+9)*(e.r+9)){
            dealDamage(e,26,{color:"#ff5c5c",element:"bolt"});
            burst(px,py,4,{r0:2,r1:6,life:.25,color:"#ffd0d0",spdMin:40,spdMax:120});
            if(!first)first=e;
            if(this.syn("etchbeam")){
              e.poisoned=true;e.poisonT=2;
              this.active.push({kind:"field",sub:"poison",x:px,y:py,t:2,r:42,
                color:"rgba(156,204,101,.18)",tick:0});
            }
          }
        }
        if(this.syn("overload")&&first){
          const near=enemies.filter(e=>e!==first&&dist2(first.x,first.y,e.x,e.y)<130*130);
          for(const e of near.slice(0,3)){
            dealDamage(e,15,{element:"bolt",color:"#ffe66d"});
            beams.push({x1:first.x,y1:first.y,x2:e.x,y2:e.y,life:.14,maxLife:.14,color:"#ffe66d"});
          }
        }
        Shake.add(2);
        break;
      }
      case "capacitor":{
        shockwaves.push({x,y,r:10,maxR:170,life:.45,maxLife:.45,
          color:"#ffe66d",hit:new Set(),dmg:20});
        burst(x,y,16,{r0:3,r1:14,life:.4,color:"#ffe66d",glow:true,spdMin:70,spdMax:230});
        break;
      }
      case "drone":{
        this.active.push({kind:"drone",x:p.x,y:p.y,t:6,phase:rand(0,6.28)});
        break;
      }
      case "shieldgen":{
        const base=30+(player.maxHp*0.08|0);
        this.shieldHp=this.syn("matrix")?base*2:base;
        burst(p.x,p.y,14,{r0:3,r1:16,life:.5,color:"#7ed957",glow:true,spdMin:50,spdMax:180});
        break;
      }
      case "mine":
        this.active.push({kind:"mine",x,y,t:14,r:9});
        break;
      case "hourglass":
        this.active.push({kind:"field",sub:"slow",x,y,t:6.5,r:100,color:"rgba(232,195,158,.2)"});
        break;
      case "frostgen":
        this.active.push({kind:"field",sub:"ice",x,y,t:5.5,r:92,color:"rgba(165,227,247,.18)"});
        break;
      case "gascan":
        this.active.push({kind:"field",sub:"poison",x,y,t:5,r:88,
          color:"rgba(156,204,101,.18)",tick:0});
        break;
      case "spikepad":
        this.active.push({kind:"spike",x,y,t:4.5,r:72,tick:0});
        break;
      case "turret":
        this.active.push({kind:"turret",x,y,t:9,shootT:0,
          rate:this.syn("legion")?0.33:0.55,dmg:17});
        break;
    }
  },

  _tickActive(a,dt){
    switch(a.kind){
      case "field":{
        const inField=enemies.filter(e=>dist2(a.x,a.y,e.x,e.y)<a.r*a.r);
        if(a.sub==="slow"){
          for(const e of inField){e.slowT=Math.max(e.slowT,.2);e.slowK=.62;}
        } else if(a.sub==="ice"){
          a.tick=(a.tick||0)-dt;
          if(a.tick<=0){a.tick=.5;
            for(const e of inField){dealDamage(e,7,{element:"ice",color:"#a5e3f7"});}}
        } else if(a.sub==="poison"){
          a.tick=(a.tick||0)-dt;
          if(a.tick<=0){a.tick=.5;
            for(const e of inField){dealDamage(e,6,{color:"#9ccc65"});e.poisoned=true;e.poisonT=1.2;}}
        }
        break;
      }
      case "spike":{
        a.tick=(a.tick||0)-dt;
        if(a.tick<=0){a.tick=.6;
          for(const e of enemies)if(dist2(a.x,a.y,e.x,e.y)<a.r*a.r)
            dealDamage(e,9,{color:"#ff8fab"});}
        break;
      }
      case "turret":{
        a.shootT-=dt;
        if(a.shootT<=0){
          const t=nearestEnemy(a.x,a.y,340);
          if(t){
            a.shootT=a.rate;
            const ang=Math.atan2(t.y-a.y,t.x-a.x);
            projectiles.push({kind:"playerbullet",x:a.x,y:a.y,
              vx:Math.cos(ang)*430,vy:Math.sin(ang)*430,r:5,
              dmg:a.dmg,pierce:1,life:1.4,color:"#7db8e8"});
            // 枪口闪光
            spawnParticle(a.x+Math.cos(ang)*14,a.y+Math.sin(ang)*14,
              {r0:3,r1:6,life:.12,color:"#cfe6ff"});
            if(typeof SFX!=="undefined")SFX.play("shoot");
          } else a.shootT=0.2;
        }
        break;
      }
      case "drone":{
        const R=this.syn("legion")?220:110;
        a.phase+=dt*1.6;
        const tx=player.x+Math.cos(a.phase)*46,ty=player.y+Math.sin(a.phase)*46;
        a.x+=(tx-a.x)*3*dt;a.y+=(ty-a.y)*3*dt;
        if(Math.random()<.3)spawnParticle(a.x,a.y,{r0:1.5,r1:3,life:.3,color:"rgba(176,106,212,.5)"});
        for(const g2 of xpGems){
          if(dist2(a.x,a.y,g2.x,g2.y)<R*R){
            const ang=Math.atan2(player.y-g2.y,player.x-g2.x);
            g2.x+=Math.cos(ang)*380*dt;g2.y+=Math.sin(ang)*380*dt;
          }
        }
        break;
      }
      case "mine":{
        for(const e of enemies){
          if(dist2(a.x,a.y,e.x,e.y)<44*44){
            const inSlow=this.syn("timebomb")&&this.active.some(f=>f.kind==="field"&&f.sub==="slow"&&dist2(f.x,f.y,a.x,a.y)<f.r*f.r);
            const mul=inSlow?2:1,R=inSlow?135:90;
            burst(a.x,a.y,inSlow?28:15,{r0:4,r1:inSlow?24:14,life:.5,color:"#ffb347",glow:true,spdMin:80,spdMax:260});
            Shake.add(inSlow?5:2);
            if(typeof SFX!=="undefined")SFX.play("boom");
            for(const e2 of enemies)
              if(dist2(a.x,a.y,e2.x,e2.y)<R*R){
                dealDamage(e2,36*mul,{color:"#ffb347"});
                if(this.syn("icemine")){e2.freezeT=Math.max(e2.freezeT,1);e2.slowT=1;e2.slowK=.6;}
              }
            a.t=0;break;
          }
        }
        break;
      }
    }
  },

  _expire(a){
    if(a.kind==="turret")burst(a.x,a.y,8,{r0:3,r1:10,life:.4,color:"#7db8e8",spdMin:40,spdMax:150});
  },

  // ---------- 绘制 ----------
  drawWorld(ctx,camX,camY){
    for(const a of this.active){
      const x=a.x-camX,y=a.y-camY;
      if(x<-160||y<-160||x>VIEW_W+160||y>VIEW_H+160)continue;
      if(a.kind==="field"){
        const pulse=.96+Math.sin(performance.now()/260)*.05;
        ctx.fillStyle=a.color;
        ctx.beginPath();ctx.arc(x,y,a.r*pulse,0,7);ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,.4)";ctx.lineWidth=2;
        ctx.setLineDash([7,7]);ctx.lineDashOffset=-performance.now()/50;
        ctx.beginPath();ctx.arc(x,y,a.r,0,7);ctx.stroke();
        ctx.setLineDash([]);
        ctx.font="17px sans-serif";ctx.textAlign="center";ctx.globalAlpha=.85;
        ctx.fillText(a.sub==="slow"?"⏳":a.sub==="ice"?"❄":"☠",x,y+6);
        ctx.globalAlpha=1;
        // 场内上升粒子
        if(Math.random()<.25)spawnParticle(a.x+rand(-a.r*.7,a.r*.7),a.y+rand(-a.r*.5,a.r*.5),
          {r0:2,r1:4,life:.7,color:a.sub==="ice"?"rgba(165,227,247,.7)":a.sub==="poison"?"rgba(156,204,101,.6)":"rgba(232,195,158,.6)",vy:-30});
      } else if(a.kind==="mine"){
        ctx.save();ctx.translate(x,y+Math.sin(performance.now()/200)*1.5);
        // 感应圈微光
        ctx.strokeStyle="rgba(255,179,71,.25)";ctx.lineWidth=1.2;
        ctx.beginPath();ctx.arc(0,0,30+Math.sin(performance.now()/300)*3,0,7);ctx.stroke();
        ctx.fillStyle="#5a4a3a";ctx.strokeStyle="#241a2e";ctx.lineWidth=1.8;
        ctx.beginPath();ctx.arc(0,0,8,0,7);ctx.fill();ctx.stroke();
        // 呼吸红灯
        const bl=.4+.6*Math.abs(Math.sin(performance.now()/250));
        ctx.fillStyle=`rgba(255,80,60,${bl})`;
        ctx.beginPath();ctx.arc(0,-2,2.8,0,7);ctx.fill();
        ctx.restore();
      } else if(a.kind==="turret"){
        ctx.save();ctx.translate(x,y);
        // 射程淡圈
        ctx.strokeStyle="rgba(125,184,232,.18)";ctx.lineWidth=1.2;
        ctx.beginPath();ctx.arc(0,0,340,0,7);ctx.stroke();
        ctx.fillStyle="#4a5a78";ctx.strokeStyle="#241a2e";ctx.lineWidth=2;
        ctx.beginPath();ctx.roundRect(-9,-7,18,14,4);ctx.fill();ctx.stroke();
        ctx.strokeStyle="#9fb8d8";ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(13,0);ctx.stroke();
        // 剩余寿命环
        ctx.strokeStyle="rgba(126,217,87,.7)";ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(0,0,13,-Math.PI/2,-Math.PI/2+(a.t/9)*Math.PI*2);ctx.stroke();
        ctx.restore();
      } else if(a.kind==="drone"){
        ctx.save();ctx.translate(x,y);
        ctx.fillStyle="#b06ad4";ctx.strokeStyle="#241a2e";ctx.lineWidth=1.8;
        ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fill();ctx.stroke();
        ctx.strokeStyle="rgba(176,106,212,.4)";ctx.lineWidth=1.2;
        ctx.beginPath();ctx.arc(0,0,11+Math.sin(performance.now()/150)*2,0,7);ctx.stroke();
        // 吸取半径虚线
        const R=this.syn("legion")?220:110;
        ctx.setLineDash([4,8]);ctx.lineDashOffset=-performance.now()/80;
        ctx.strokeStyle="rgba(176,106,212,.22)";
        ctx.beginPath();ctx.arc(player.x-camX,player.y-camY,R,0,7);ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if(a.kind==="spike"){
        ctx.save();
        ctx.globalAlpha=.55+.2*Math.sin(performance.now()/200);
        ctx.fillStyle="#ff8fab";
        for(let k=0;k<5;k++){
          const sx=x+Math.cos(k/5*6.28)*a.r*.6,sy=y+Math.sin(k/5*6.28)*a.r*.6;
          ctx.beginPath();ctx.moveTo(sx,sy-7);ctx.lineTo(sx-5,sy+4);ctx.lineTo(sx+5,sy+4);
          ctx.closePath();ctx.fill();
        }
        ctx.restore();
      }
    }
    // 护盾圈
    if(this.shieldHp>0){
      ctx.strokeStyle="rgba(126,217,87,.65)";ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(player.x-camX,player.y-camY,player.r+9+Math.sin(performance.now()/180)*1.5,0,7);ctx.stroke();
      ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillStyle="#7ed957";
      ctx.fillText(Math.ceil(this.shieldHp),player.x-camX,player.y-camY-player.r-16);
    }
  },

  // 幽灵预览（瞄准态）：范围圈 + 图标 + 有效/越界着色
  drawGhost(ctx,camX,camY){
    const id=this.armed;if(!id)return;
    const def=this._def(id);
    const wx=mouse.x+camX,wy=mouse.y+camY;
    const out=wx<20||wx>WORLD.w-20||wy<20||wy>WORLD.h-20;
    const sx=mouse.x,sy=mouse.y;
    ctx.save();
    if(def.aim==="point"||def.aim==="direction"){
      const R=def.range||90;
      ctx.globalAlpha=.9;
      ctx.fillStyle=out?"rgba(255,90,90,.1)":"rgba(255,255,255,.07)";
      ctx.beginPath();ctx.arc(sx,sy,R,0,7);ctx.fill();
      ctx.strokeStyle=out?"rgba(255,90,90,.8)":"rgba(255,255,255,.55)";
      ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.lineDashOffset=-performance.now()/40;
      ctx.beginPath();ctx.arc(sx,sy,R,0,7);ctx.stroke();
      ctx.setLineDash([]);
      if(def.aim==="direction"){
        // 激光方向预览：玩家→准星延伸线
        const px=player.x-camX,py=player.y-camY;
        const a=Math.atan2(wy-player.y,wx-player.x);
        ctx.strokeStyle="rgba(255,92,92,.5)";ctx.lineWidth=3;
        ctx.setLineDash([12,8]);
        ctx.beginPath();ctx.moveTo(px,py);
        ctx.lineTo(px+Math.cos(a)*560,py+Math.sin(a)*560);ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.font="24px sans-serif";ctx.textAlign="center";
      ctx.fillText(def.icon,sx,sy+8);
    } else {
      // 自施放类：玩家身上高亮
      const px=player.x-camX,py=player.y-camY;
      ctx.strokeStyle="rgba(126,217,87,.6)";ctx.lineWidth=2;
      ctx.setLineDash([6,6]);
      ctx.beginPath();ctx.arc(px,py,player.r+12,0,7);ctx.stroke();
      ctx.setLineDash([]);
    }
    // 操作提示
    ctx.globalAlpha=1;
    ctx.font="bold 14px sans-serif";ctx.textAlign="center";
    ctx.fillStyle=out?"#ff6b6b":"#ffe66d";
    ctx.fillText(out?"超出战场范围":(def.name+" · 左键放置 · 右键取消"),sx,sy-(def.range||60)-(out?18:34));
    ctx.restore();
  },

  // HUD 快捷栏：底部中央 1~6 槽位（图标+层数点+回充进度）
  drawHUD(ctx){
    if(!this.owned.length)return;
    const n=this.owned.length,sw=52,gap=8;
    const total=n*sw+(n-1)*gap;
    const x0=(VIEW_W-total)/2,y0=VIEW_H-64;
    for(let i=0;i<n;i++){
      const id=this.owned[i],def=this._def(id);
      const x=x0+i*(sw+gap),y=y0;
      const c=this.charges[id]||0;
      const armed=this.armed===id;
      // 槽底
      ctx.save();
      if(armed){ctx.shadowColor=def.color;ctx.shadowBlur=14;}
      ctx.fillStyle=c>0?"rgba(255,255,255,.09)":"rgba(0,0,0,.35)";
      ctx.strokeStyle=armed?def.color:(c>0?"rgba(255,255,255,.4)":"rgba(255,255,255,.15)");
      ctx.lineWidth=armed?3:1.6;
      ctx.beginPath();ctx.roundRect(x,y,sw,sw,10);ctx.fill();ctx.stroke();
      ctx.restore();
      // 快捷键角标
      ctx.fillStyle="rgba(255,255,255,.5)";ctx.font="bold 10px sans-serif";ctx.textAlign="left";
      ctx.fillText(String(i+1),x+4,y+13);
      // 图标
      ctx.font="20px sans-serif";ctx.textAlign="center";
      ctx.globalAlpha=c>0?1:.35;
      ctx.fillText(def.icon,x+sw/2,y+34);
      ctx.globalAlpha=1;
      // 层数点 ●●●
      for(let k=0;k<MAX_CHARGES;k++){
        ctx.fillStyle=k<c?def.color:"rgba(255,255,255,.18)";
        ctx.beginPath();ctx.arc(x+sw/2+(k-1)*9,y+48,3,0,7);ctx.fill();
      }
      // 回充进度（未满层时顶部细条）
      if(c<MAX_CHARGES){
        const pct=1-Math.min(1,(this.rechargeT[id]??0)/(def.cd));
        ctx.fillStyle="rgba(255,255,255,.15)";
        ctx.fillRect(x+4,y+4,sw-8,3);
        ctx.fillStyle=def.color;
        ctx.fillRect(x+4,y+4,(sw-8)*pct,3);
      }
    }
    // 瞄准提示
    if(this.armed){
      const def=this._def(this.armed);
      ctx.font="bold 13px sans-serif";ctx.textAlign="center";
      ctx.fillStyle=def.color;
      ctx.fillText("放置模式："+def.name+" · 点击战场放置 · 右键取消",VIEW_W/2,y0-10);
    }
  },

  // 受击先扣盾
  absorb(dmg){
    if(this.shieldHp<=0)return dmg;
    const used=Math.min(this.shieldHp,dmg);
    this.shieldHp-=used;
    return dmg-used;
  },
};
