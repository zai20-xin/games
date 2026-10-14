// ===== v0.8 魔王挑战模式：关卡数据 + 挑战存档 =====
// 设计：软引导弱点(×1.5)、无限重开、星级评价(通关/限时/无伤)、星星解锁新技能入奖池。

const CHALLENGE_LEVELS = [
  { id:1, bossName:"深渊魔王·觉醒", bossColor:"#c0392b",
    weak:"fire", weakText:"🔥 弱点：火（伤害+50%）",
    hpMul:33, timeLimitStar:120,   // 2分钟内击杀得限时星（满配DPS≈950 → ~90秒）
    minionWaveAt:[45,90],           // 第45/90秒刷一波小怪调剂
    reward:{ type:"skill", id:"chainbolt", name:"解锁技能：雷链术" },
    intro:"深渊魔王苏醒。它记住了每一个闯入者的气味。" },
  { id:2, bossName:"寒霜巨像", bossColor:"#7ec8e3",
    weak:"fire", weakText:"🔥 弱点：火（伤害+50%）",
    hpMul:44, timeLimitStar:150,
    minionWaveAt:[50],
    reward:{ type:"relic", id:"prism", name:"解锁圣物：弹射棱镜" },
    intro:"远古冰封造物苏醒，寒气冻结一切鲁莽者。" },
  { id:3, bossName:"影武者", bossColor:"#5a3280",
    weak:"dark", weakText:"🌑 弱点：暗（伤害+50%）；它会模仿你的招式",
    hpMul:48, timeLimitStar:180,
    minionWaveAt:[40,80,110],
    reward:{ type:"skill", id:"holypulse", name:"解锁技能：圣光脉冲" },
    intro:"影子中的影子。你看到的每一道残影，都是它的刀。" },
  { id:4, bossName:"雷霆君王", bossColor:"#ffd93d",
    weak:"ice", weakText:"❄ 弱点：冰（伤害+50%）；狂暴倒计时 150 秒",
    hpMul:60, timeLimitStar:210, enrageAt:150,
    minionWaveAt:[60,120],
    reward:{ type:"gadget", id:"capacitor", name:"强化道具：电容线圈充能+1" },
    intro:"天空是他的领地。雷云汇聚之处，万物俯首。" },
  { id:5, bossName:"双生魔像 · 晖与晦", bossColor:"#ff8fab",
    weak:"bolt", weakText:"⚡ 弱点：雷（伤害+50%）；双子共享生命，同时狂暴",
    hpMul:62, timeLimitStar:240, enrageAt:180,
    minionWaveAt:[45,90,135],
    reward:{ type:"outfit", id:"holy", name:"解锁时装：圣辉礼服" },
    intro:"一日一月，一明一暗。它们从未分开，也从未同时存在。" },
];

const ChallengeSave = {
  _key:"huanzhuang_challenge_v1",
  data:{ stars:{}, unlocked:1, cleared:{} },   // stars: {levelId:0~3}
  _storage:null,
  setStorage(s){this._storage=s;},
  load(){
    try{
      const s=this._storage||((typeof localStorage!=="undefined")?localStorage:null);
      if(!s)return this.data;
      const raw=s.getItem(this._key);
      if(raw){
        const o=JSON.parse(raw);
        if(o&&typeof o==="object"){
          this.data.stars=o.stars||{};
          this.data.unlocked=Math.max(1,Math.min(CHALLENGE_LEVELS.length,+o.unlocked||1));
        }
      }
    }catch(e){}
    return this.data;
  },
  save(){
    try{
      const s=this._storage||((typeof localStorage!=="undefined")?localStorage:null);
      if(s)s.setItem(this._key,JSON.stringify(this.data));
    }catch(e){}
  },
  isUnlocked(id){ return id<=this.data.unlocked; },
  totalStars(){ let n=0;for(const k in this.data.stars)n+=this.data.stars[k];return n; },
  // 结算：返回 {stars, newUnlock}
  settle(levelId,time,noHit,win){
    if(!win)return null;
    const lv=CHALLENGE_LEVELS.find(l=>l.id===levelId);
    let st=0;
    if(win)st++;
    if(win&&time<=lv.timeLimitStar)st++;
    if(win&&noHit)st++;
    const old=this.data.stars[levelId]||0;
    if(st>old)this.data.stars[levelId]=st;
    let newUnlock=null;
    // 首次通关奖励
    const firstWin=!(this.data.cleared&&this.data.cleared[levelId]);
    if(firstWin){
      this.data.cleared=this.data.cleared||{};
      this.data.cleared[levelId]=true;
      if(lv.reward)newUnlock=lv.reward;
      this._grantReward(lv.reward);
    }
    const next=CHALLENGE_LEVELS.find(l=>l.id===levelId+1);
    if(next&&this.data.unlocked<next.id){this.data.unlocked=next.id;if(!newUnlock)newUnlock="关卡"+next.id;}
    // 星级里程碑金币：每颗新星 +150 金币（直接进钱包）
    let bonusCoins=0;
    if(st>old){
      bonusCoins=(st-old)*150;
      if(typeof Meta!=="undefined"){Meta.addCoins(bonusCoins);}
    }
    this.save();
    return {stars:st,best:this.data.stars[levelId],newUnlock,bonusCoins};
  },
  _grantReward(rw){
    if(!rw)return;
    if(rw.type==="skill"&&typeof Meta!=="undefined"){
      Meta.data.unlockedSkills=Meta.data.unlockedSkills||[];
      if(!Meta.data.unlockedSkills.includes(rw.id))Meta.data.unlockedSkills.push(rw.id);
      Meta.save();
    }
    // relic/gadget/outfit 奖励在结算界面展示（占位：后续接入对应系统）
  },
};
ChallengeSave.load();
