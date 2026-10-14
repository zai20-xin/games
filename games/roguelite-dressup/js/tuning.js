// ===== v0.14 架构加固：SystemRegistry 统一生命周期 + TUNING 数值中心 =====

// ---------- TUNING：全游戏数值常量唯一事实源 ----------
const TUNING = {
  xp:      { base:4, perLevel:6 },                       // xpNext = base+lv*perLevel
  spawn:   { intervalBase:1.25, intervalDecay:0.9, intervalMin:0.25,
             batchEvery:120, waveEvery:178, eliteEvery:90, bossAt:600 },
  enemyHp: { timeScalePerMin:0.35 },                     // 1+t/60*k
  drops:   { potion:0.04, potionLow:0.08, magnet:0.006, pityKills:300 },
  relic:   { weights:{common:55,rare:28,epic:13,legendary:4} },
  duel:    { atkSpeed:1.35, cdCut:0.25, critEvery:5, critMul:2.2, windowGap:0.8 },
  gadget:  { maxCharges:3, maxCarry:6 },
  mirror:  { everySec:75, lifeSec:30, transformSec:60 },
};

// ---------- SystemRegistry：系统自注册，统一 reset ----------
// 每个带 reset 的系统启动时调用 SysReg.add(name, obj)；
// startGame/startChallengeRun 只需 SysReg.resetAll()。
const SysReg = {
  _systems:[],
  add(name,obj){
    if(this._systems.some(s=>s.name===name))return;
    this._systems.push({name,obj});
  },
  resetAll(){
    for(const s of this._systems){
      if(s.obj&&typeof s.obj.reset==="function"){
        try{s.obj.reset();}
        catch(err){console.error("[SysReg] reset failed:",s.name,err);}
      }
    }
  },
};
