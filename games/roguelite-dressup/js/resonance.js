// ===== 元素共鸣系统：同元素技能组合触发构筑词条 =====
// 共鸣表（同类取最高档不叠加；多共鸣可并存）：
//   火×2「炽热」火焰伤害附加灼烧DoT   冰×2「凛冬」冰系减速翻倍、冻结+50%
//   雷×2「过载」雷链弹射+2、冷却-15%  暗×2「收割」击杀回复1%最大生命
//   光×2「圣威」全部伤害+10%          三种不同元素「万象」经验获取+20%

const RESONANCE_DEFS = [
  { id:"inferno", match:{element:"火",need:2}, name:"炽热", color:"#ff6b35",
    desc:"火焰伤害附加灼烧（3/s·受攻击力加成）" },
  { id:"winter",  match:{element:"冰",need:2}, name:"凛冬", color:"#7ec8e3",
    desc:"冰系减速效果翻倍，冻结时间+50%" },
  { id:"overload",match:{skill:"chainbolt",lv:3}, name:"过载", color:"#ffd93d",
    desc:"雷链术精通 Lv3：弹射+2，冷却-15%" },
  { id:"reaper",  match:{element:"暗",need:2}, name:"收割", color:"#b06ad4",
    desc:"击杀任意敌人回复 1% 最大生命" },
  { id:"majesty", match:{skill:"holypulse",lv:3}, name:"圣威", color:"#ffe66d",
    desc:"圣光脉冲精通 Lv3：所有伤害 +10%" },
  { id:"myriad",  match:{distinct:3}, name:"万象", color:"#c084fc",
    desc:"持有三种不同元素：经验获取 +20%" },
];

// 技能元素表（含双属性；未列出的回落到 SKILLS_META.element）
// 双属性让「同元素×2」共鸣在 9 技能池内可达成
const SKILL_ELEMENTS = {
  fireball:  ["火"],
  frostnova: ["冰"],
  chainbolt: ["雷"],
  blades:    ["风","冰"],   // 风霜刃：高速切割卷起寒气
  poison:    ["毒","暗"],   // 阴蚀之毒
  holypulse: ["光"],
  knives:    ["暗"],
  quake:     ["地","火"],   // 地火喷发
  starfall:  ["奥","火"],   // 天坠星火
};
function skillElementsOf(id){
  if(SKILL_ELEMENTS[id]) return SKILL_ELEMENTS[id];
  const m=SKILLS_META[id];
  return m&&m.element?[m.element]:[];
}

const RESONANCE = {
  activeList:[],          // [{id,name,color,desc}]
  slowMul:1,              // 凛冬：冰减速倍率
  freezeMul:1,            // 凛冬：冻结时长倍率
  chainBonus:0,           // 过载：雷链额外弹射
  hasteBonus:0,           // 过载：全局冷却缩减
  dmgBonus:0,             // 圣威：全伤害加成
  xpBonus:0,              // 万象：经验加成
  _installed:false,       // 防重复包装 dealDamage
  _origGainXp:null,
  _appliedHaste:0,        // 已叠加到 player.haste 的共鸣部分

  // 按玩家当前技能组重算共鸣
  recompute(){
    this.activeList=[];
    this.slowMul=1; this.freezeMul=1; this.chainBonus=0;
    this.hasteBonus=0; this.dmgBonus=0; this.xpBonus=0;
    if(!player||!player.skills){ this._syncHaste(); return; }
    // 展开每个技能的元素列表（含双属性）
    const allElems=[];
    for(const s of player.skills) allElems.push(...skillElementsOf(s.id));
    const elemCounts={};
    for(const el of allElems) elemCounts[el]=(elemCounts[el]||0)+1;
    for(const def of RESONANCE_DEFS){
      let ok=false;
      const m=def.match;
      if(m.element!==undefined) ok=(elemCounts[m.element]||0)>=m.need;
      else if(m.distinct) ok=new Set(allElems).size>=m.distinct;
      else if(m.skill){
        const s=player.skills.find(s=>s.id===m.skill);
        ok=!!s&&s.lv>=m.lv;
      }
      if(ok){
        this.activeList.push({id:def.id,name:def.name,color:def.color,desc:def.desc});
        switch(def.id){
          case "inferno": break;
          case "winter":  this.slowMul=2; this.freezeMul=1.5; break;
          case "overload":this.chainBonus=2; this.hasteBonus=0.15; break;
          case "reaper":  break;
          case "majesty": this.dmgBonus=0.10; break;
          case "myriad":  this.xpBonus=0.20; break;
        }
      }
    }
    this._syncHaste();
    this._installHooks();
  },

  // 把共鸣冷却缩减同步到 player.haste（只管理自己那份差值）
  _syncHaste(){
    if(!player) { this._appliedHaste=0; return; }
    // 换局后是新玩家对象：旧的已叠加值不再属于它，归零防止污染
    if(this._lastPlayer!==player){
      this._appliedHaste=0;
      this._lastPlayer=player;
    }
    player.haste+=this.hasteBonus-this._appliedHaste;
    this._appliedHaste=this.hasteBonus;
  },
  _lastPlayer:null,

  // 安全包装全局伤害入口与经验入口
  _installHooks(){
    // 经验：原型链包装一次
    if(!this._origGainXp&&typeof Player!=="undefined"){
      const R=this;
      R._origGainXp=Player.prototype.gainXp;
      Player.prototype.gainXp=function(v){
        return R._origGainXp.call(this,v*(1+(R.xBonus||0)));
      };
    }
    // 伤害：函数绑定重写一次
    if(this._installed) return;
    this._installed=true;
    const R=this;
    const __orig=dealDamage;
    dealDamage=function(e,dmg,opt){
      opt=opt||{};
      const wasAlive=e.hp>0;
      let d=dmg*(1+R.dmgBonus);
      __orig(e,dmg*(1+R.dmgBonus),opt);
      // 炽热：火焰伤害附加灼烧
      if(R.activeList.some(a=>a.id==="inferno")&&opt.element==="fire"&&e.hp>0){
        e.burnT=2; e.burnDps=3*player.atkMul; e.burnTick=e.burnTick||0;
      }
      // 收割：本次伤害完成击杀 → 回血
      if(wasAlive&&e.hp<=0&&R.activeList.some(a=>a.id==="reaper")&&player.hp>0){
        const heal=Math.max(1,Math.round(player.maxHp*0.01));
        player.hp=Math.min(player.maxHp,player.hp+heal);
        spawnDmgText(player.x,player.y-26,"+"+heal,"#b06ad4");
      }
      return d;
    };
  },

  // 灼烧 DoT 推进
  update(dt){
    if(!this.activeList.length) return;
    for(const e of enemies){
      if(e.burnT>0){
        e.burnT-=dt;
        e.burnTick-=dt;
        if(e.burnTick<=0){
          e.burnTick=0.5;
          e.hp-=e.burnDps*0.5;
          e.hitFlash=Math.min(e.hitFlash+0.05,0.1);
          spawnDmgText(e.x,e.y-e.r,e.burnDps*0.5,"#ff8c42");
          if(Math.random()<0.6)
            spawnParticle(e.x+rand(-6,6),e.y,{r0:2,r1:4,life:0.4,color:"#ff8c42",vy:-30,glow:true});
        }
      }
    }
  },

  // 右上角共鸣徽章
  drawHUD(){
    if(!this.activeList.length) return;
    ctx.save();
    ctx.textAlign="right";
    let y=130;
    for(const a of this.activeList){
      ctx.fillStyle="rgba(0,0,0,0.55)";
      ctx.beginPath(); ctx.roundRect(VIEW_W-118,y,98,30,8); ctx.fill();
      ctx.strokeStyle=a.color; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(VIEW_W-118,y,98,30,8); ctx.stroke();
      ctx.fillStyle=a.color; ctx.font="bold 14px sans-serif";
      ctx.fillText("✦ "+a.name,VIEW_W-28,y+20);
      y+=36;
    }
    ctx.restore();
  },
};
