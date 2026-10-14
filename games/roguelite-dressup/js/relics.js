// ===== 十二圣物数据表：4 稀有度 × 构筑向被动 =====
const RELIC_RARITY = {
  common:    { name:"普通", color:"#cfd8dc", weight:55 },
  rare:      { name:"稀有", color:"#4fc3f7", weight:28 },
  epic:      { name:"史诗", color:"#ba68c8", weight:13 },
  legendary: { name:"传说", color:"#ffd54f", weight:4  },
};

const RELICS = [
  // ---- 白·普通 ----
  { id:"bracer", name:"力量护腕", rarity:"common", icon:"拳", color:"#e05b5b",
    desc:"所有伤害 +12%", apply:p=>{ p.atkMul+=0.12; } },
  { id:"boots", name:"疾风之靴", rarity:"common", icon:"靴", color:"#6dd47e",
    desc:"移动速度 +10%", apply:p=>{ p.spdMul+=0.10; } },
  { id:"amulet", name:"生命坠饰", rarity:"common", icon:"心", color:"#ff9e9e",
    desc:"生命上限 +25 并回复等量", apply:p=>{ p.maxHp+=25; p.hp=Math.min(p.maxHp,p.hp+25); } },
  // ---- 蓝·稀有 ----
  { id:"vampfang", name:"吸血匕首", rarity:"rare", icon:"牙", color:"#b06ad4",
    desc:"每次击杀回复 2 点生命", hook:"onKill" },
  { id:"prism", name:"弹射棱镜", rarity:"rare", icon:"棱", color:"#7db8e8",
    desc:"投射物额外弹跳 1 次", hook:"projectileBounce", value:1 },
  { id:"hourglass", name:"时之沙漏", rarity:"rare", icon:"沙", color:"#a1887f",
    desc:"技能冷却 -10%", apply:p=>{ p.haste+=0.10; } },
  // ---- 紫·史诗 ----
  { id:"giantslayer", name:"巨人杀手", rarity:"epic", icon:"斩", color:"#ffb74d",
    desc:"对精英与 Boss 伤害 +35%", hook:"eliteDmg", value:0.35 },
  { id:"thorns", name:"荆棘胸甲", rarity:"epic", icon:"棘", color:"#8d99ae",
    desc:"受击反弹 15 伤害并延长无敌 0.3 秒", hook:"onHurt", value:15 },
  { id:"compass", name:"黄金罗盘", rarity:"epic", icon:"罗", color:"#ffd700",
    desc:"拾取范围 +60%，金币获取 +50%", apply:p=>{ p.pickupR*=1.6; }, coinMul:0.5 },
  // ---- 金·传说 ----
  { id:"soulmask", name:"噬魂面具", rarity:"legendary", icon:"魂", color:"#9d6ff0",
    desc:"击杀有 15% 几率使周围经验晶体价值翻倍", hook:"xpBurst", value:0.15 },
  { id:"dragonheart", name:"龙心", rarity:"legendary", icon:"龙", color:"#ff5252",
    desc:"生命上限 +50，受击后无敌 1 秒，每秒回复 1 点",
    apply:p=>{ p.maxHp+=50; p.hp=Math.min(p.maxHp,p.hp+50); p.regenFlat=(p.regenFlat||0)+1; }, hurtIframes:1.0 },
  { id:"astralens", name:"星界透镜", rarity:"legendary", icon:"星", color:"#80deea",
    desc:"所有技能作用范围 +20%", hook:"aoeMul", value:0.20 },
];

function rollRelicRarity(bonusLuck){
  const luck=bonusLuck||0;
  const w=Object.entries(RELIC_RARITY);
  // 幸运加成把高稀有度权重放大
  const weights=w.map(([k,v],i)=>v.weight*(k==="common"?1:(1+luck*i)));
  let total=weights.reduce((a,b)=>a+b,0), roll=Math.random()*total;
  for(let i=0;i<w.length;i++){ roll-=weights[i]; if(roll<=0) return w[i][0]; }
  return "common";
}
function pickRelicByRarity(rarity){
  return pick(RELICS.filter(r=>r.rarity===rarity));
}
