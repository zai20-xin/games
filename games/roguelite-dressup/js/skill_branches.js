// ===== v0.6 技能分支：升级到 Lv3/Lv5 时二选一，改变玩法而非数值 =====
// 分支通过 SKILL_BRANCHES[id][tier] = [{id,name,desc,mod}] 定义；
// mod 在 applyBranch 中实现为运行时开关，由各技能更新函数读取。

const SKILL_BRANCHES = {
  fireball: {
    3:[ {id:"fb_burn", name:"烈焰余烬", desc:"爆炸留下燃烧地带(3秒)",
         mod:p=>{ p.__fbBurnGround=true; } },
       {id:"fb_split", name:"分裂火心", desc:"爆炸再分裂2枚小火球",
         mod:p=>{ p.__fbSplit=true; } } ],
    5:[ {id:"fb_triple", name:"三重爆裂", desc:"爆炸连炸三次",
         mod:p=>{ p.__fbTriple=true; } },
       {id:"fb_meteor", name:"天降火雨", desc:"爆炸后落下一颗小陨石",
         mod:p=>{ p.__fbMeteor=true; } } ],
  },
  frostnova: {
    3:[ {id:"fn_shards", name:"冰棱飞散", desc:"环命中时射出6枚冰棱",
         mod:p=>{ p.__fnShards=true; } },
       {id:"fn_deepfreeze",name:"极寒透骨", desc:"冻结期间敌人受伤+30%",
         mod:p=>{ p.__fnDeep=true; } } ],
    5:[ {id:"fn_spirit", name:"冰灵环绕", desc:"召唤冰灵持续环绕伤害",
         mod:p=>{ p.__fnSpirit=true; } },
       {id:"fn_blizzard",name:"暴风雪", desc:"环内敌人持续受冻伤",
         mod:p=>{ p.__fnBlizzard=true; } } ],
  },
  knives: {
    3:[ {id:"kn_ricochet", name:"回旋镖刃", desc:"飞刀命中后弹向下一个敌人",
         mod:p=>{ p.__knRicochet=true; } },
       {id:"kn_heavy", name:"影袭重刃", desc:"单发大伤害穿透",
         mod:p=>{ p.__knHeavy=true; } } ],
    5:[ {id:"kn_fan", name:"死亡扇面", desc:"七连发扇形齐射",
         mod:p=>{ p.__knFan=true; } },
       {id:"kn_shadowclone", name:"影子分身", desc:"背后幻影同步投刀",
         mod:p=>{ p.__knClone=true; } } ],
  },
  // ---- v0.16 补齐剩余 6 技能分支 ----
  blades: {
    3:[ {id:"bl_third", name:"三刃归一", desc:"刃数+1 且转速提升，近身绞肉机",
         mod:p=>{ p.__blThird=true; } },
       {id:"bl_giant", name:"巨刃回廊", desc:"单刃伤害+60%、半径+25%",
         mod:p=>{ p.atkMul+=0.6*0.4; /* 净增24% */ p.__blGiant=true; } } ],
    5:[ {id:"bl_orbit", name:"刃之领域", desc:"刃命中时吸引敌人向你聚拢",
         mod:p=>{ p.__blOrbit=true; } },
       {id:"bl_blood", name:"饮血旋刃", desc:"刃击杀回复2点生命",
         mod:p=>{ p.__blBlood=true; } } ],
  },
  poison: {
    3:[ {id:"po_spread", name:"孢子蔓延", desc:"毒雾消散时向外扩散新毒圈",
         mod:p=>{ p.__poSpread=true; } },
       {id:"po_focus", name:"浓缩毒素", desc:"毒伤翻倍但范围-30%",
         mod:p=>{ p.__poFocus=true; } } ],
    5:[ {id:"po_plague", name:"瘟疫之心", desc:"中毒敌人死亡时爆出毒爆",
         mod:p=>{ p.__poPlague=true; } },
       {id:"po_miasma", name:"瘴气护体", desc:"毒雾中的敌人对你伤害-40%",
         mod:p=>{ p.__poMiasma=true; } } ],
  },
  holypulse: {
    3:[ {id:"hp_burn", name:"圣炎冲击", desc:"冲击波附带灼烧",
         mod:p=>{ p.__hpBurn=true; } },
       {id:"hp_guard", name:"圣盾姿态", desc:"释放后获得1秒无敌",
         mod:p=>{ p.__hpGuard=true; } } ],
    5:[ {id:"hp_judgment", name:"圣光审判", desc:"对精英/Boss伤害+50%",
         mod:p=>{ p.__hpJudge=true; } },
       {id:"hp_aegis", name:"永恒圣域", desc:"脉冲范围内友军(你)持续回血",
         mod:p=>{ p.hpRegen+=0.01; p.__hpAegis=true; } } ],
  },
  chainbolt: {
    3:[ {id:"cb_storm", name:"过载风暴", desc:"弹射次数+3",
         mod:p=>{ p.__cbStorm=true; } },
       {id:"cb_lance", name:"雷霆贯日", desc:"不再弹射，单体伤害×2.5",
         mod:p=>{ p.__cbLance=true; } } ],
    5:[ {id:"cb_paralyze", name:"麻痹电网", desc:"被雷链命中的敌人定身0.8秒",
         mod:p=>{ p.__cbPara=true; } },
       {id:"cb_conductor", name:"导体共鸣", desc:"每多一个敌人在场，伤害+8%",
         mod:p=>{ p.__cbConductor=true; } } ],
  },
  quake: {
    3:[ {id:"qk_fissure", name:"地裂峡谷", desc:"地刺留下裂缝持续伤害",
         mod:p=>{ p.__qkFissure=true; } },
       {id:"qk_erupt", name:"岩浆喷发", desc:"地刺命中后喷出火石",
         mod:p=>{ p.__qkErupt=true; } } ],
    5:[ {id:"qk_titan", name:"泰坦震击", desc:"击飞高度和落点伤害翻倍",
         mod:p=>{ p.__qkTitan=true; } },
       {id:"qk_chain", name:"连环震", desc:"地刺命中后引发二次地震",
         mod:p=>{ p.__qkChain=true; } } ],
  },
  starfall: {
    3:[ {id:"sf_split", name:"陨石碎裂", desc:"流星落地后分裂3块碎片",
         mod:p=>{ p.__sfSplit=true; } },
       {id:"sf_burn", name:"星焰灼地", desc:"落点留下一片星火燃烧带",
         mod:p=>{ p.__sfBurn=true; } } ],
    5:[ {id:"sf_comet", name:"彗星撞月", desc:"流星更大更亮，范围+50%",
         mod:p=>{ p.__sfComet=true; } },
       {id:"sf_starguide", name:"星辰指引", desc:"流星优先砸向精英与Boss",
         mod:p=>{ p.__sfGuide=true; } } ],
  },
};

const SkillBranchSys = {
  pending:null,     // 待选分支 {skillId,tier,choices}
  cardRects:[],
  taken:{},         // {"fireball:3":"fb_burn"}

  reset(){ this.pending=null; this.cardRects=[]; this.taken={};
    // 清理玩家身上的运行时分支标记
    for(const k of Object.keys(player||{})) if(k.startsWith("__")) delete player[k]; },

  // 升级时调用：若达到分支等级且未选过 → 返回 true 表示需要弹分支选择
  maybeOffer(skillId,newLv){
    const tiers=SKILL_BRANCHES[skillId];
    if(!tiers) return false;
    const tier=(newLv===3||newLv===5)?newLv:null;
    if(!tier) return false;
    if(this.taken[skillId+":"+tier]) return false;
    this.pending={ skillId, tier,
      choices:tiers[tier].map(b=>({id:b.id,name:b.name,desc:b.desc})) };
    return true;
  },

  choose(i){
    if(!this.pending) return;
    const c=this.pending.choices[i]; if(!c){return;}
    const tierDef=SKILL_BRANCHES[this.pending.skillId][this.pending.tier]
      .find(b=>b.id===c.id);
    if(tierDef){
      tierDef.mod(player);
      this.taken[this.pending.skillId+":"+this.pending.tier]=c.id;
      burst(player.x,player.y,20,{r0:3,r1:14,life:.55,color:"#ffe66d",glow:true,spdMin:60,spdMax:220});
      spawnDmgText(player.x,player.y-42,"分支："+c.name,"#ffe66d");
      if(typeof SFX!=="undefined") SFX.play("relic");
    }
    this.pending=null; this.cardRects=[];
  },

  drawOverlay(ctx){
    if(!this.pending) return;
    const sk=SKILLS_META[this.pending.skillId];
    ctx.save();
    ctx.fillStyle="rgba(10,8,20,.66)"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.textAlign="center";
    ctx.fillStyle=sk.color; ctx.font="bold 32px sans-serif";
    ctx.fillText("✦ "+sk.name+" 进阶 · 选择分支 ✦",VIEW_W/2,116);
    this.cardRects=[];
    const cw=270,ch=250,gap=28;
    const x0=VIEW_W/2-(cw*2+gap)/2, y0=165;
    for(let i=0;i<this.pending.choices.length;i++){
      const c=this.pending.choices[i];
      const cx=x0+i*(cw+gap);
      this.cardRects.push({x:cx,y:y0,w:cw,h:ch});
      const hov=mouse.x>=cx&&mouse.x<=cx+cw&&mouse.y>=y0&&mouse.y<=y0+ch;
      ctx.shadowColor=sk.color; ctx.shadowBlur=hov?26:12;
      ctx.fillStyle="rgba(255,255,255,.07)";
      ctx.strokeStyle=sk.color; ctx.lineWidth=hov?4:2.5;
      ctx.beginPath(); ctx.roundRect(cx,y0,cw,ch,16); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0;
      ctx.fillStyle="#fff"; ctx.font="bold 22px sans-serif";
      ctx.fillText(c.name,cx+cw/2,y0+92);
      ctx.fillStyle="rgba(255,255,255,.82)"; ctx.font="16px sans-serif";
      wrapText(ctx,c.desc,cx+cw/2,y0+132,cw-36,22);
      ctx.fillStyle="rgba(255,255,255,.4)"; ctx.font="13px sans-serif";
      ctx.fillText(`[${i+1}]`,cx+cw/2,y0+228);
    }
    ctx.restore();
  },
};

// v0.14 系统注册
if(typeof SysReg!=="undefined")SysReg.add("branches",SkillBranchSys);
