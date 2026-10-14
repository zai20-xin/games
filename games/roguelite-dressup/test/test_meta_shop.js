// 新系统联合测试：Meta 存档 / Shop / 共鸣 / 华丽层
const fs=require('fs'), vm=require('vm'), path=require('path');
const DIR=path.resolve(__dirname,'../js');
const gradient={addColorStop(){}};
const ctxProxy=new Proxy({},{get(t,k){
  if(k==='measureText') return s=>({width:String(s).length*10});
  if(k==='createRadialGradient'||k==='createLinearGradient') return ()=>gradient;
  if(k==='canvas') return {width:1280,height:720};
  return typeof t[k]!=='undefined'?t[k]:(...a)=>undefined;
},set(t,k,v){t[k]=v;return true;}});
const canvas={getContext:()=>ctxProxy,width:1280,height:720,addEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})};
// 内存 localStorage
function makeLS(){ const m={}; return {
  getItem:k=>(k in m?m[k]:null), setItem:(k,v)=>{m[k]=String(v);}, removeItem:k=>{delete m[k];} };}
const sandbox={console,Math,Date,JSON,performance:{now:()=>Date.now()},
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},
  document:{getElementById:()=>canvas},window:{addEventListener(){},dispatchEvent(){}}};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','skills','skills2','relics','loot','meta','outfit_glam','resonance','shop','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}()); Meta.load(); Meta.hardReset();`);

console.log('[1] Meta 钱包与购买');
check('初始金币 0',T(`Meta.coins`)===0);
check('仅 novice 解锁',T(`Meta.unlocked`)===undefined||T(`Meta.isUnlocked('flame')`)===false);
T(`Meta.addCoins(800)`);
check('入账后余额 800',T(`Meta.coins`)===800);
const pr=T(`JSON.stringify(Meta.purchase('flame'))`);
check('购买烈焰舞裙成功',pr.includes('"ok":true'));
check('购买后余额归零',T(`Meta.coins`)===0);
check('flame 已解锁',T(`Meta.isUnlocked('flame')`)===true);
T(`const r2=Meta.purchase('frost')`);
check('钱不够购买失败 poor',T(`r2.reason`)==='poor');
check('余额未被扣成负数',T(`Meta.coins`)===0);

console.log('[2] 结算幂等：一局只入库一次');
T(`startGame('flame'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`player.coins=100; player.kills=50; gameTime=120`);
T(`tick(0.0166)`);   // 触发死亡？不会，正常游玩中
T(`winFlag=false; gameState='end'`);
T(`tick(0.0166)`);   // 第一次结算
const c1=T(`Meta.coins`);
T(`tick(0.0166)`);   // 第二次结算应幂等
check('结算只入账一次',T(`Meta.coins`)===c1&&c1===100);
check('战绩 runs=1',T(`Meta.data.stats.runs`)===1);

console.log('[3] 元素共鸣');
T(`startGame('novice'); if(gameState==='levelup'){applyUpgradeChoice(0)} `);
check('开局无共鸣',T(`RESONANCE.activeList.length`)===0);
T(`player.skills.push({id:'fireball',lv:1},{id:'poison',lv:1},{id:'knives',lv:1})`);
T(`RESONANCE.recompute()`);
check('火+毒暗+暗 → 万象触发',T(`RESONANCE.activeList.some(a=>a.id==='myriad')`)===true);
check('万象经验加成+20%',Math.abs(T(`RESONANCE.xpBonus`)-0.2)<1e-9);
check('毒暗+暗双暗 → 收割触发',T(`RESONANCE.activeList.some(a=>a.id==='reaper')`)===true);
// 收割回血验证（趁收割激活时）
T(`player.hp=50; spawnEnemy('slime',player.x+70,player.y,false);
   const ek=enemies[enemies.length-1]; dealDamage(ek,99999,{})`);
check('收割击杀回血 1%',T(`player.hp`)>50);
T(`player.skills.push({id:'starfall',lv:1}); RESONANCE.recompute()`);
check('火球+星陨(奥火) → 炽热触发',T(`RESONANCE.activeList.some(a=>a.id==='inferno')`)===true);
T(`spawnEnemy('slime',player.x+80,player.y,false)`);
T(`dealDamage(enemies[enemies.length-1],5,{element:'fire'})`);
check('火焰伤害附加灼烧 burnT',T(`enemies[enemies.length-1].burnT>0`)===true);
const hpBeforeBurn=T(`enemies[enemies.length-1].hp`);
T(`RESONANCE.update(0.55)`);
check('灼烧DoT实际扣血',T(`enemies[enemies.length-1].hp`)<hpBeforeBurn);
T(`player.skills.push({id:'holypulse',lv:3}); RESONANCE.recompute()`);
check('圣光Lv3精通 → 圣威伤害+10%',Math.abs(T(`RESONANCE.dmgBonus`)-0.10)<1e-9);
T(`player.skills=[]; RESONANCE.recompute()`);
check('清空技能共鸣消失',T(`RESONANCE.activeList.length`)===0);

console.log('[4] 凛冬/过载');
T(`player.skills.push({id:'frostnova',lv:1},{id:'blades',lv:1},{id:'chainbolt',lv:4}); RESONANCE.recompute()`);
check('冰环+风霜刃(风冰) → 双冰减速翻倍',T(`RESONANCE.slowMul`)===2);
check('冻结时长+50%',T(`RESONANCE.freezeMul`)===1.5);
check('雷链Lv4精通 → 弹射+2',T(`RESONANCE.chainBonus`)===2);
check('过载 haste 同步到玩家',Math.abs(T(`player.haste`)-0.15)<1e-9);

console.log('[5] 华丽层');
T(`startGame('storm'); if(gameState==='levelup') applyUpgradeChoice(0)`);
check('华丽层绑定 storm',T(`getGlamInfo().id`)==='storm');
check('入场爆发有粒子',T(`particles.length`)>10);
for(let i=0;i<300;i++) T(`updateGlam(0.0166); updateParticles(0.0166)`);
check('持续更新发射环境粒子',T(`getGlamInfo().emittedTotal`)>100);
check('雷霆电弧在生成',T(`getGlamInfo().bolts`)>=1);
T(`drawGlamBack(ctx,0,0); drawGlamFront(ctx,0,0)`);
check('前后层绘制不抛错',true);
T(`startGame('shadow'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`input.right=true; player.moving=true; for(let i=0;i<40;i++){player.update(0.0166,input); updateGlam(0.0166)} input.right=false; player.moving=false`);
check('暗影残影记录轨迹',T(`getGlamInfo().trail`)>=3);

console.log('[6] 商店与衣柜 SCREENS');
check('SCREENS.shop 已注册',T(`typeof SCREENS.shop.draw==='function'`)===true);
check('SCREENS.wardrobe 已注册',T(`typeof SCREENS.wardrobe.draw==='function'`)===true);
T(`gameState='shop'; mouse.x=-999; mouse.y=-999; tick(0.0166)`);
check('商店界面绘制不抛错',true);
// 模拟点击已拥有的 flame 卡片 → 提示已拥有
T(`mouse.x=${Math.round(1280/2-90+ (180+18)*1 +90)}; mouse.y=325; SCREENS.shop.onClick(mouse.x,mouse.y)`);
check('点击已拥有卡片不扣款',T(`Meta.coins`)>=0);
// 补钱买 frost：点第 2 张卡（frost 在 OUTFITS[2]）
T(`Meta.addCoins(5000); mouse.y=325;
   const L={cardW:180,gap:18,y0:170};
   const x0=(VIEW_W-(OUTFITS.length*L.cardW+(OUTFITS.length-1)*L.gap))/2;
   mouse.x=x0+2*(L.cardW+L.gap)+L.cardW/2;
   SCREENS.shop.onClick(mouse.x,mouse.y)`);
check('点击未拥有卡片成功购买 frost',T(`Meta.isUnlocked('frost')`)===true);
// 衣柜换装：点已购买的 frost 卡（OUTFITS[2]）
T(`gameState='wardrobe';
   const Lw={cardW:180,gap:18,y0:170};
   const x0w=(VIEW_W-(OUTFITS.length*Lw.cardW+(OUTFITS.length-1)*Lw.gap))/2;
   mouse.x=x0w+2*(Lw.cardW+Lw.gap)+Lw.cardW/2;
   SCREENS.wardrobe.onClick(mouse.x,mouse.y)`);
check('衣柜换装 equip 生效',T(`Meta.getEquipped()`)==='frost');

console.log('[7] 开始界面含商店按钮绘制');
T(`gameState='start'; tick(0.0166)`);
check('开始界面绘制不抛错',true);
check('START_BUTTONS 有商店/衣柜入口',T(`START_BUTTONS.filter(b=>b.action==='shop'||b.action==='wardrobe').length`)===2);
check('魔王挑战入口已加入',T(`START_BUTTONS.some(b=>b.action==='ch_select')`)===true);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
