// ===== v0.6 章节制：把一局拆成 3 章，每章换怪+换规则 =====
// 章节切换演出：大字播报+震屏；每章开始送「章节祝福」改规则三选一。

const CHAPTERS = [
  { id:1, name:"第一章 · 苏醒之径", endTime:180,
    spawnPool:["slime","bat"], shroomAfter:75,
    desc:"基础怪潮，热身走位" },
  { id:2, name:"第二章 · 变异林谷", endTime:390,
    spawnPool:["mage","boar","slime","bat"], shroomAfter:200,
    desc:"新变异种登场！" },
  { id:3, name:"第三章 · 深渊前庭", endTime:600,
    spawnPool:["mage","boar","summoner","golem","shroom"], shroomAfter:1e9,
    desc:"全怪物混合，精英潮将至" },
];

// 章节祝福池：改规则而非小数值
const CHAPTER_BOONS = [
  { id:"wide",   name:"广阔领域", color:"#7db8e8",
    desc:"技能范围 +40%，移速 -10%",
    apply:p=>{ if(typeof hasRelic==="function") {} p.atkMul+=0; p.pickupR*=1.2;
               // 范围加成通过全局倍率实现
               window.__boonAoe=(window.__boonAoe||0)+0.4;
               p.spdMul-=0.10; } },
  { id:"glass",  name:"玻璃大炮", color:"#ff6b6b",
    desc:"伤害 +45%，生命上限 -25%",
    apply:p=>{ p.atkMul+=0.45; const cut=p.maxHp*0.25;
               p.maxHp-=cut; p.hp=Math.min(p.hp,p.maxHp); } },
  { id:"regen",  name:"不灭意志", color:"#7ed957",
    desc:"每秒回复 2%，但受到伤害 +20%",
    apply:p=>{ p.regenPct+=0.02; window.__boonFragile=(window.__boonFragile||0)+0.20; } },
  { id:"haste",  name:"极速咏唱", color:"#ffd93d",
    desc:"冷却 -20%，技能伤害 -12%",
    apply:p=>{ p.haste+=0.20; p.atkMul-=0.12; } },
  { id:"greed",  name:"贪婪契约", color:"#ffd700",
    desc:"经验 +35%，敌人速度 +15%",
    apply:p=>{ p.xpGain+=0.35; window.__boonEnemySpd=(window.__boonEnemySpd||0)+0.15; } },
];

const ChapterSys = {
  idx:0,            // 当前章（0起）
  boonChoices:[],   // 待选祝福
  cardRects:[],
  banner:null,      // {text,color,t}

  get current(){ return CHAPTERS[Math.min(this.idx,CHAPTERS.length-1)]; },

  reset(){ this.idx=0; this.boonChoices=[]; this.cardRects=[];
    this.banner=null; window.__boonAoe=0; window.__boonFragile=0; window.__boonEnemySpd=0; },

  update(dt){
    // 章节推进
    if(this.idx < CHAPTERS.length-1 && gameTime >= CHAPTERS[this.idx].endTime){
      this.idx++;
      const c=this.current;
      this.banner={text:c.name, color:"#ffe66d", t:2.8};
      Shake.add(6);
      if(typeof SFX!=="undefined") SFX.play("levelup");
      burst(player.x,player.y,26,{r0:3,r1:18,life:.7,color:"#ffe66d",glow:true,spdMin:80,spdMax:260});
      // 弹出章节祝福
      this.boonChoices=this._rollBoons();
    }
    if(this.banner){ this.banner.t-=dt; if(this.banner.t<=0) this.banner=null; }
  },

  _rollBoons(){
    const pool=[...CHAPTER_BOONS];
    const out=[];
    while(out.length<3&&pool.length)
      out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    return out.map(b=>({id:b.id,name:b.name,desc:b.desc,color:b.color}));
  },

  chooseBoon(i){
    const c=this.boonChoices[i]; if(!c) return;
    const def=CHAPTER_BOONS.find(b=>b.id===c.id);
    if(def) def.apply(player);
    if(typeof SFX!=="undefined") SFX.play("relic");
    burst(player.x,player.y,24,{r0:3,r1:16,life:.6,color:c.color,glow:true,spdMin:70,spdMax:240});
    spawnDmgText(player.x,player.y-46,"祝福："+c.name,c.color);
    this.boonChoices=[]; this.cardRects=[];
  },

  // ---- 统一弹窗契约别名（与 SkillBranchSys/Mirror 保持鸭子类型一致）----
  drawOverlay(ctx){ this.drawBoonOverlay(ctx); },
  choose(i){ this.chooseBoon(i); },

  drawBanner(ctx){
    if(!this.banner) return;
    const b=this.banner;
    const a=Math.min(1,b.t/.5);
    ctx.save();
    ctx.globalAlpha=a; ctx.textAlign="center";
    ctx.font="bold 42px sans-serif";
    ctx.lineWidth=7; ctx.strokeStyle="#3a2000";
    ctx.strokeText(b.text,VIEW_W/2,190);
    ctx.fillStyle=b.color;
    ctx.fillText(b.text,VIEW_W/2,190);
    ctx.restore();
  },

  drawBoonOverlay(ctx){
    if(!this.boonChoices.length) return;
    ctx.save();
    ctx.fillStyle="rgba(10,8,20,.66)"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.textAlign="center";
    ctx.fillStyle="#ffe66d"; ctx.font="bold 34px sans-serif";
    ctx.fillText("✦ 章节祝福 · 选择一项 ✦",VIEW_W/2,110);
    ctx.fillStyle="rgba(255,255,255,.65)"; ctx.font="15px sans-serif";
    ctx.fillText("祝福将改变本局规则 [1]/[2]/[3] 或点击",VIEW_W/2,140);
    this.cardRects=[];
    const cw=250,ch=280,gap=26;
    const x0=VIEW_W/2-(cw*3+gap*2)/2, y0=175;
    for(let i=0;i<this.boonChoices.length;i++){
      const c=this.boonChoices[i];
      const cx=x0+i*(cw+gap);
      this.cardRects.push({x:cx,y:y0,w:cw,h:ch});
      const hov=mouse.x>=cx&&mouse.x<=cx+cw&&mouse.y>=y0&&mouse.y<=y0+ch;
      ctx.shadowColor=c.color; ctx.shadowBlur=hov?28:14;
      ctx.fillStyle="rgba(255,255,255,.07)";
      ctx.strokeStyle=c.color; ctx.lineWidth=hov?4:2.5;
      ctx.beginPath(); ctx.roundRect(cx,y0,cw,ch,16); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0;
      // 图标圆
      ctx.fillStyle=c.color; ctx.globalAlpha=.22;
      ctx.beginPath(); ctx.arc(cx+cw/2,y0+78,44,0,7); ctx.fill();
      ctx.globalAlpha=1;
      ctx.beginPath(); ctx.arc(cx+cw/2,y0+78,27,0,7); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="bold 22px sans-serif";
      ctx.fillText(c.name[0],cx+cw/2,y0+86);
      ctx.fillStyle=c.color; ctx.font="bold 21px sans-serif";
      ctx.fillText(c.name,cx+cw/2,y0+150);
      ctx.fillStyle="rgba(255,255,255,.8)"; ctx.font="15px sans-serif";
      wrapText(ctx,c.desc,cx+cw/2,y0+186,cw-32,20);
      ctx.fillStyle="rgba(255,255,255,.4)"; ctx.font="13px sans-serif";
      ctx.fillText(`[${i+1}]`,cx+cw/2,y0+258);
    }
    ctx.restore();
  },
};

// v0.14 系统注册
if(typeof SysReg!=="undefined")SysReg.add("chapters",ChapterSys);
