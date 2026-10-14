// ===== 局外存档经济系统：金币银行 / 时装解锁 / 结算入库 =====
// 设计依据 DESIGN.md §6 经济：击杀金币 1~3、精英 30、Boss 200；时装售价 800~2500 梯度。
// 本文件只负责数据与规则，不含绘制（绘制在 shop.js）。

const META_SAVE_KEY = "huanzhuang_meta_v1";

// ---- 时装售价梯度（见习为初始赠送，其余 800→2500）----
const OUTFIT_PRICES = {
  novice: 0,      // 初始解锁
  flame: 800,
  frost: 1200,
  storm: 1600,
  shadow: 2000,
  holy: 2500,
};

const Meta = {
  version: 1,
  data: null,
  _storage: null,       // 注入的存储后端 {getItem,setItem,removeItem}
  _runSettled: true,    // 本局是否已结算（防重复入账）

  // ---------- 存储后端 ----------
  // 浏览器默认 localStorage；无头/隐私环境自动退化为内存。
  setStorage(backend){ this._storage=backend; },
  _detectStorage(){
    try{
      if(typeof localStorage!=="undefined"&&localStorage){
        const k="__meta_probe__"; localStorage.setItem(k,"1"); localStorage.removeItem(k);
        return localStorage;
      }
    }catch(e){}
    return null;
  },
  _store(){ return this._storage!==null ? this._storage : (this._storage=this._detectStorage()); },

  // ---------- 存档结构 ----------
  defaults(){
    return {
      v:this.version,
      coins:0, totalEarned:0,
      unlocked:["novice"],
      equipped:"novice",
      stats:{ runs:0, wins:0, kills:0, bestTime:0, bestKills:0 },
      updatedAt:Date.now(),
    };
  },

  load(){
    let raw=null;
    try{ raw=this._store()?this._store().getItem(META_SAVE_KEY):null; }catch(e){ raw=null; }
    if(raw){
      try{ this.data=this._migrate(JSON.parse(raw)); }
      catch(e){ this.data=this.defaults(); }        // 存档损坏 → 重置而非崩溃
    } else this.data=this.defaults();
    return this.data;
  },
  // 兼容旧版本字段缺失 / 未来升级
  _migrate(obj){
    const d=this.defaults();
    if(!obj||typeof obj!=="object") return d;
    const out=Object.assign({},d,obj);
    out.v=this.version;
    out.coins=Math.max(0,Math.floor(Number(out.coins)||0));
    out.totalEarned=Math.max(0,Math.floor(Number(out.totalEarned)||0));
    if(!Array.isArray(out.unlocked)) out.unlocked=[];
    out.unlocked=out.unlocked.filter(id=>typeof id==="string"&&OUTFIT_PRICES[id]!==undefined);
    if(!out.unlocked.includes("novice")) out.unlocked.unshift("novice");   // 新手装永不丢失
    if(!out.unlocked.includes(out.equipped)) out.equipped=out.unlocked[0];
    out.stats=Object.assign({runs:0,wins:0,kills:0,bestTime:0,bestKills:0},obj.stats||{});
    for(const k of ["runs","wins","kills","bestKills"]) out.stats[k]=Math.max(0,Math.floor(Number(out.stats[k])||0));
    out.stats.bestTime=Math.max(0,Number(out.stats.bestTime)||0);
    return out;
  },
  save(){
    if(!this.data) return false;
    this.data.updatedAt=Date.now();
    try{
      const s=this._store();
      if(s) s.setItem(META_SAVE_KEY,JSON.stringify(this.data));
      return true;
    }catch(e){ return false; }   // 写失败不阻塞游戏
  },

  // ---------- 钱包 ----------
  get coins(){ return this.data?this.data.coins:0; },
  addCoins(n){
    if(!this.data) this.load();
    n=Math.floor(Number(n)||0);
    this.data.coins=Math.max(0,this.data.coins+n);
    if(n>0) this.data.totalEarned+=n;
    this.save();
    return this.data.coins;
  },
  // 原子扣款：成功返回余额，失败返回 -1
  spendCoins(n){
    if(!this.data) this.load();
    n=Math.floor(Number(n)||0);
    if(n<0||this.data.coins<n) return -1;
    this.data.coins-=n; this.save();
    return this.data.coins;
  },

  // ---------- 时装解锁 / 装备 ----------
  outfitPrice(id){ return OUTFIT_PRICES[id]!==undefined?OUTFIT_PRICES[id]:-1; },
  isUnlocked(id){ return !!this.data&&this.data.unlocked.includes(id); },
  canAfford(id){ return this.outfitPrice(id)>=0&&this.coins>=this.outfitPrice(id); },
  unlock(id){
    if(!this.data) this.load();
    if(OUTFIT_PRICES[id]===undefined) return false;
    if(this.isUnlocked(id)) return false;
    this.data.unlocked.push(id); this.save();
    return true;
  },
  // 购买 = 校验 + 扣款 + 解锁（原子）
  purchase(id){
    if(OUTFIT_PRICES[id]===undefined) return {ok:false,reason:"unknown"};
    if(this.isUnlocked(id))            return {ok:false,reason:"owned"};
    const price=this.outfitPrice(id);
    if(this.spendCoins(price)<0)       return {ok:false,reason:"poor"};
    this.unlock(id);                   // unlock 内部已 save
    return {ok:true,price};
  },
  equip(id){
    if(!this.data) this.load();
    if(!this.isUnlocked(id)) return false;
    this.data.equipped=id; this.save();
    return true;
  },
  getEquipped(){ return this.data?this.data.equipped:"novice"; },

  // ---------- 单局结算 ----------
  // startGame 后调用一次标记新局；局结束 settleRun 只入账一次
  beginRun(){ this._runSettled=false; },
  settleRun(run,timeSec,win){
    if(!this.data) this.load();
    if(this._runSettled) return null;          // 幂等：一局只结算一次
    this._runSettled=true;
    const banked=Math.max(0,Math.floor(Number(run.coins)||0));
    this.addCoins(banked);
    const st=this.data.stats;
    st.runs++; st.kills+=Math.max(0,Math.floor(Number(run.kills)||0));
    if(win) st.wins++;
    if(timeSec>st.bestTime) st.bestTime=timeSec;
    if(Math.floor(Number(run.kills)||0)>st.bestKills) st.bestKills=Math.floor(Number(run.kills)||0);
    this.save();
    return {banked,total:this.data.coins,win:!!win};
  },

  // ---------- 调试 ----------
  hardReset(){
    this.data=this.defaults(); this._runSettled=true; this.save();
    try{ const s=this._store(); if(s&&s.removeItem) s.removeItem(META_SAVE_KEY); }catch(e){}
  },
};

// 启动即加载存档（无头环境下自动退化内存模式）
Meta.load();
