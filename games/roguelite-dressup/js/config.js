// ===== 幻装旅者 · 全局配置 =====
const VIEW_W = 1280, VIEW_H = 720;
const WORLD = { w: 2600, h: 2600 };

// ---- 六套时装：外观配色 + 专属被动 ----
const OUTFITS = [
  { id:"novice", name:"见习冒险家", desc:"学徒好运：经验获取 +15%",
    body:"#f2c9a0", cloth:"#7a9e5f", cloth2:"#5c7a45", accent:"#c9a86a", hair:"#6b4a2f",
    mods:{ xpGain:0.15 } },
  { id:"flame", name:"烈焰舞裙", desc:"炎之亲和：火焰伤害+25%，爆炸范围+20%",
    body:"#ffd9c4", cloth:"#e04a3a", cloth2:"#a82c1f", accent:"#ffb347", hair:"#8c2f1b",
    mods:{ fireDmg:0.25, fireAoe:0.20 } },
  { id:"frost", name:"寒霜斗篷", desc:"凝霜之息：冰系减速+50%，持续+30%",
    body:"#eaf6fc", cloth:"#7ec8e3", cloth2:"#4a92b8", accent:"#ffffff", hair:"#a9d6ea",
    mods:{ iceSlow:0.50, iceDur:0.30 } },
  { id:"storm", name:"雷霆战衣", desc:"过载核心：雷链弹射+1 次，冷却-10%",
    body:"#ffe9b8", cloth:"#5b4a9e", cloth2:"#3d3268", accent:"#ffd700", hair:"#2e2748",
    mods:{ chainExtra:1, haste:0.10 } },
  { id:"shadow", name:"暗影夜行衣", desc:"影袭：移速+15%，暗影飞刀 +1 枚",
    body:"#e8d8e8", cloth:"#3a2d52", cloth2:"#241c38", accent:"#b06ad4", hair:"#171126",
    mods:{ moveSpeed:0.15, daggerExtra:1 } },
  { id:"holy", name:"圣辉礼服", desc:"圣愈光辉：生命上限+20%，每秒回复1%",
    body:"#ffeef2", cloth:"#fdf6e3", cloth2:"#e8d9a8", accent:"#ffd700", hair:"#f0dfa0",
    mods:{ maxHp:0.20, regenPct:0.01 } },
];

// ---- 九个技能元数据（数值逻辑在 skills*.js）----
const SKILLS_META = {
  fireball:  { name:"烈焰火球", element:"火", color:"#ff6b35", maxLv:5,
    lvDesc:["发射火球，命中爆炸","伤害+30%，范围+15%","一次发射 2 枚火球","伤害+40%","三连爆：爆炸后再炸两次"] },
  frostnova: { name:"冰霜新星", element:"冰", color:"#7ec8e3", maxLv:5,
    lvDesc:["以自身为中心放出冰环，减速敌人","伤害+40%，范围+20%","减速效果增强","持续时间+50%","冻结：敌人完全定身 1 秒"] },
  chainbolt: { name:"雷链术", element:"雷", color:"#ffd93d", maxLv:5,
    lvDesc:["闪电在敌群间弹射 4 次","伤害+30%","弹射次数+2","伤害+30%，射程提升","弹射 8 次，终点落雷爆炸"] },
  blades:    { name:"回旋刃", element:"风", color:"#a8e6cf", maxLv:5,
    lvDesc:["两柄飞刃环绕自身旋转","转速+30%","第三刃加入！","伤害+40%","第四刃 + 半径扩大 50%"] },
  poison:    { name:"剧毒瘴气", element:"毒", color:"#7ac74f", maxLv:5,
    lvDesc:["掷出毒雾圈，持续侵蚀","伤害+30%","毒雾范围+30%","持续时间+50%","消散时爆裂释放孢子"] },
  holypulse: { name:"圣光脉冲", element:"光", color:"#ffe66d", maxLv:5,
    lvDesc:["金色冲击波推开周围敌人","伤害+40%","冷却-25%","击退距离+50%","击退翻倍并致盲敌人 1.5 秒"] },
  knives:    { name:"暗影飞刀", element:"暗", color:"#b06ad4", maxLv:5,
    lvDesc:["快速掷出 2 枚暗影飞刀","伤害+30%","一次 3 枚扇形齐射","伤害+40%","七连发死亡扇面！"] },
  quake:     { name:"大地震击", element:"地", color:"#c49a6c", maxLv:5,
    lvDesc:["地刺破土刺穿敌人并击飞","伤害+30%","可同时刺出 2 根地刺","伤害+40%","刺阵成排推进！"] },
  starfall:  { name:"星陨术", element:"奥", color:"#c084fc", maxLv:5,
    lvDesc:["流星坠落轰击密集敌群","伤害+30%","同时坠落 2 颗流星","范围+30%","三星连坠！"] },
};

// ---- 属性符文（升级池 20%）----
const RUNES = [
  { id:"atk",    name:"力量符文", color:"#e05b5b", desc:"攻击力 +10%",      apply:p=>{ p.atkMul+=0.10; } },
  { id:"spd",    name:"疾风符文", color:"#6dd47e", desc:"移动速度 +8%",     apply:p=>{ p.spdMul+=0.08; } },
  { id:"hp",     name:"生命符文", color:"#ff9e9e", desc:"生命上限 +15% 并回复同值",
    apply:p=>{ const add=p.maxHp*0.15; p.maxHp+=add; p.hp=Math.min(p.maxHp,p.hp+add); } },
  { id:"magnet", name:"磁石符文", color:"#7db8e8", desc:"拾取范围 +30%",    apply:p=>{ p.pickupR*=1.30; } },
];

// ---- 敌人类型 ----
const ENEMY_TYPES = {
  slime:  { hp:18, speed:72,  r:13, dmg:8,  xp:1, coin:1, color:"#7ed957" },
  bat:    { hp:12, speed:132, r:10, dmg:6,  xp:1, coin:1, color:"#9b6bb3", sine:true },
  golem:  { hp:95, speed:38,  r:20, dmg:16, xp:4, coin:3, color:"#8d99ae" },
  shroom: { hp:26, speed:96,  r:12, dmg:14, xp:2, coin:2, color:"#ff7bac", explode:true },
};
const BOSS_TIME = 600;   // 10 分钟出 Boss
const ELITE_EVERY = 90;  // 每 90 秒一个精英
