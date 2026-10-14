// v0.3 联合测试：进化配方 / 手感打磨 / 魔镜变身
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
function makeLS(){ const m={}; return {
  getItem:k=>(k in m?m[k]:null), setItem:(k,v)=>{m[k]=String(v);}, removeItem:k=>{delete m[k];} };}
const sandbox={console,Math,Date,JSON,performance:{now:()=>Date.now()},
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},
  document:{getElementById:()=>canvas},window:{addEventListener(){},dispatchEvent(){}}};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','skills','skills2','relics','loot',
  'meta','outfit_glam','resonance','shop','biome','mirror','juice','evolution','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}()); Meta.load(); Meta.hardReset();`);

console.log('[1] 进化配方系统');
T(`startGame('flame'); if(gameState==='levelup') applyUpgradeChoice(0)`);
check('初始无进化',T(`EVOLUTION.activeCount()`)===0);
check('未满足配方不触发',T(`(()=>{EVOLUTION.check(); return EVOLUTION.activeCount()})()`)===0);
T(`player.skills.push({id:'fireball',lv:5});
   player.relics.push({id:'bracer',name:'力量护腕',rarity:'common'});
   RELICS.find(r=>r.id==='bracer').apply(player);   // 模拟真实拾取：护腕 +12%攻击
   window.__atkBefore=player.atkMul;                // 基准：基础1+护腕0.12+可能的BIOME加成
   EVOLUTION.check()`);
check('火球Lv5+护腕 → 陨星法典触发',T(`EVOLUTION.has('meteorcodex')`)===true);
check('进化攻击加成+30% 已应用',Math.abs(T(`player.atkMul`)-(T(`window.__atkBefore`)+0.30))<1e-9);
T(`EVOLUTION.check()`);
check('幂等：不重复触发',T(`EVOLUTION.activeCount()`)===1);
T(`player.skills.push({id:'quake',lv:5});
   player.relics.push({id:'amulet',name:'生命坠饰',rarity:'common'});
   RELICS.find(r=>r.id==='amulet').apply(player);   // 模拟真实拾取：坠饰 +25HP
   EVOLUTION.check()`);
check('地刺Lv5+坠饰 → 大地震怒触发',T(`EVOLUTION.has('earthwrath')`)===true);
check('HP上限+40',Math.abs(T(`player.maxHp`)-(100+25+40))<0.01); // flame基础100+坠饰25+震怒40
T(`drawHUD(); RESONANCE.drawHUD(); EVOLUTION.drawHUD()`);
check('进化徽章绘制不抛错',true);

console.log('[2] 手感打磨包');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`Juice.reset()`);
check('初始无顿帧',T(`Juice.update(0.016)`)===1);
T(`spawnEnemy('slime',player.x+100,player.y,false)`);
T(`dealDamage(enemies[0],5,{})`);
check('普通怪命中不顿帧',T(`Juice.hitStopT`)===0);
T(`spawnEnemy('golem',player.x-150,player.y,true)`); // 精英
T(`dealDamage(enemies[enemies.length-1],5,{})`);
check('精英命中触发顿帧',T(`Juice.hitStopT`)>0);
check('update 返回 0（世界冻结）',T(`Juice.update(0.01)`)===0);
T(`Juice.update(0.05)`);
check('顿帧结束后恢复正常',T(`Juice.update(0.01)`)===1);
// 连杀：快速击杀30只
T(`for(let i=0;i<30;i++){spawnEnemy('slime',player.x+i%3*40,player.y-i*10,false);
   dealDamage(enemies[enemies.length-1],99999,{})}`);
check('连杀30触发横幅',T(`Juice.banner&&Juice.banner.text.includes('30')`)===true);
T(`player.hp=player.maxHp*0.2; Juice.drawOverlays(ctx)`);
check('低血渐晕/横幅绘制不抛错',true);
T(`spawnBoss(player.x+300,player.y); render()`);
check('Boss血条渲染不抛错',true);

console.log('[3] 魔镜变身系统');
T(`startGame('frost'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`MIRROR.reset(); MIRROR._spawnT=MIRROR.spawnEvery; MIRROR.update(0.016)`);
check('计时到点生成魔镜',T(`MIRROR.mirrors.length`)===1);
T(`MIRROR.mirrors[0].x=player.x; MIRROR.mirrors[0].y=player.y; MIRROR.update(0.016)`);
check('触碰弹出二选一',T(`MIRROR.pendingChoice&&MIRROR.pendingChoice.length===2`)===true);
check('选牌不含当前时装',T(`MIRROR.pendingChoice.every(c=>c.id!=='frost')`)===true);
const origHp=T(`player.maxHp`);
const origId=T(`player.outfit.id`);
// 选第一个（可能是 holy 有 maxHp 加成，也可能没有——只验证引用变化与可回退）
T(`MIRROR.choose(0)`);
check('变身后时装引用切换',T(`player.outfit.id`)!==origId);
check('变身倒计时60s',Math.abs(T(`MIRROR.tempT`)-60)<0.02);
T(`render()`); // 含 drawWorld 镜子绘制
T(`MIRROR.drawOverlay(ctx)`);
check('镜门与选牌绘制不抛错',true);
// 数值可逆性验证：无论选了谁，快进到结束必须精确回到原值
T(`while(MIRROR.tempT>0){ MIRROR.update(0.5); }`);
check('到期自动换回原装',T(`player.outfit.id`)==='frost');
check('maxHp 精确复原',Math.abs(T(`player.maxHp`)-origHp)<1e-9);
// 变身中再触镜：先回原装再切新装，无叠加
T(`MIRROR.tempT=60; MIRROR.switchTo('storm');
   const midHp=player.maxHp; MIRROR.switchTo('holy')`);
check('连续切换不叠加（先revert再switch）',T(`player.outfit.id`)==='holy');
T(`while(MIRROR.tempT>0){ MIRROR.update(0.5); }`);
check('二次切换后仍能精确复原',Math.abs(T(`player.maxHp`)-origHp)<1e-6);
T(`MIRROR.reset()`);
check('reset 干净',T(`MIRROR.mirrors.length`)===0&&T(`MIRROR.pendingChoice`)===null);

console.log('[4] BIOME 集成回归');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
check('开局已应用地图主题',T(`BIOME.current&&BIOME.list.includes(BIOME.current)`)===true);
T(`tick(0.0166)`);
check('主循环带主题运行不抛错',true);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
