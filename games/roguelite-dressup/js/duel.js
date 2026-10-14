// ===== v0.8b 决斗调律：Boss战专属手感强化 =====
// 解决「技能面向群怪设计，打单体Boss不爽」：
//  1) 全局攻速+35% / 冷却-25%（挑战局自动生效）
//  2) 连击会心：命中同一目标每5次伤害→一次会心(×2.2大数字+特效)
//  3) 空窗回能：0.8秒未命中→下次技能必会心
//  4) 单体特化：火球/冰环/雷链在挑战局变为单体强化形态

const DuelTuning = {
  hitChain:0,          // 对当前目标的连击计数
  lastTarget:null,
  lastHitTime:-99,
  readyBurst:false,    // 空窗回能标记

  reset(){
    this.hitChain=0;this.lastTarget=null;this.lastHitTime=-99;this.readyBurst=false;
    window.__duelAtkSpeed=1.35;   // 攻速倍率（挑战局）
    window.__duelCdCut=0.25;      // 冷却缩减
  },

  // 每次对敌伤害调用（由 dealDamage 包装触发）
  onHit(e){
    if(typeof chState==="undefined"||chState.levelId<=0)return false;
    const now=performance.now()/1000;
    if(now-this.lastHitTime>0.8)this.readyBurst=true;   // 空窗回能
    this.lastHitTime=now;
    if(e!==this.lastTarget){this.lastTarget=e;this.hitChain=1;}
    else this.hitChain++;
    // 每5连击→会心
    if(this.readyBurst||this.hitChain%5===0){
      this.readyBurst=false;
      burst(e.x,e.y-e.r,10,{r0:3,r1:12,life:.4,color:"#ffd93d",glow:true,
        shape:"spark",spdMin:80,spdMax:240,vrot:6});
      spawnDmgText(e.x,e.y-e.r-16,"会心!","#ffd93d");
      if(typeof SFX!=="undefined")SFX.play("coin");
      return true;   // true = 本次是会心
    }
    return false;
  },
};

(function(){
  // 包装 dealDamage：挑战局应用调律
  const __origDD=dealDamage;
  dealDamage=function(e,dmg,opt){
    opt=opt||{};
    const inChallenge=(typeof chState!=="undefined"&&chState.levelId>0);
    if(inChallenge&&window.__duelAtkSpeed)dmg*=1+(window.__duelAtkSpeed-1)*0.5; // 调律基础增伤+17.5%
    let crit=false;
    if(inChallenge&&typeof DuelTuning!=="undefined")crit=DuelTuning.onHit(e);
    if(crit)dmg*=2.2;
    return __origDD(e,dmg,Object.assign({},opt,{__crit:crit}));
  };
})();

// 会心大数字：spawnDmgText 支持 __crit 标记放大（在 utils 层处理颜色）
