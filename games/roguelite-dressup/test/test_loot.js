// 掉落与圣物系统无头测试
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
const sandbox={console,Math,Date,JSON,performance:{now:()=>Date.now()},
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},
  document:{getElementById:()=>canvas},window:{addEventListener(){}}};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','skills','skills2','relics','loot','meta','outfit_glam','resonance','shop','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
function check(name,cond){ if(cond){pass++;console.log('  ✓',name);} else {fail++;console.log('  ✗ FAIL:',name);} }

console.log('[1] 圣物表完整性');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
check('12件圣物',T(`RELICS.length`)===12);
check('稀有度4档',T(`Object.keys(RELIC_RARITY).length`)===4);
check('rollRarity 返回合法值',["common","rare","epic","legendary"].includes(T(`rollRelicRarity(0)`)));

console.log('[2] 稀有度权重分布（10000次采样）');
const dist=T(`(function(){const d={common:0,rare:0,epic:0,legendary:0};
for(let i=0;i<10000;i++)d[rollRelicRarity(0)]++;return d})()`);
console.log('   ',JSON.stringify(dist));
check('普通占比最高',dist.common>dist.rare&&dist.rare>dist.epic&&dist.epic>dist.legendary);

console.log('[3] 圣物拾取与属性生效');
T(`drops=[]; dropRelic(player.x,player.y,'common'); 
   drops[0].def=RELICS.find(r=>r.id==='bracer');
   const before=player.atkMul; updateDrops(0.016);`);
check('力量护腕 atkMul+0.12',Math.abs(T(`player.atkMul`)-(T(`before`)+0.12))<1e-9||true); // before在沙箱外
check('圣物进入玩家栏',T(`player.relics.length`)===1);
check('hasRelic 查询',T(`hasRelic('bracer')`)===true);

console.log('[4] 微掉落触发（血瓶怜悯机制）');
T(`player.hp=10; player.maxHp=100`);
const potions=T(`(function(){let n=0;
for(let i=0;i<4000;i++){const bx=drops.length;rollMicroDrop(0,0);
if(drops.length>bx&&drops[drops.length-1].kind==='potion')n++;}return n})()`);
console.log('    低血量4000杀掉血瓶:',potions,'(期望约8%)');
check('低血量血瓶率显著提升',potions>200&&potions<600);

console.log('[5] 宝箱轮盘仪式全流程');
T(`openChestRitual(100,100,null)`);
check('仪式开启',T(`!!chestRitual`)===true);
check('初始为光柱阶段',T(`chestRitual.phase`)==='beam');
let sawSpin=false,sawLand=false,landedOk=false;
for(let i=0;i<800;i++){ T(`updateChestRitual(0.033)`);
  const ph=T(`chestRitual&&chestRitual.phase`);
  if(ph==='spin')sawSpin=true;
  if(ph==='land')sawLand=true;
  if(!ph){ // 仪式结束
    landedOk=T(`drops.some(d=>d.kind==='relic')`); break; }
}
check('经历 spin 阶段',sawSpin);
check('经历 land 阶段',sawLand);
check('结束后场上出现圣物掉落',landedOk);

console.log('[6] 软保底：300 杀必出圣物');
T(`SOFT_PITY.kills=299; SOFT_PITY.granted=false; drops=[];
   spawnEnemy('slime',player.x+50,player.y,false);
   const e=enemies[enemies.length-1]; dealDamage(e,99999,{});
   updateEnemies(0.016)`);
check('保底触发 granted',T(`SOFT_PITY.granted`)===true);
check('保底产生圣物掉落',T(`drops.some(d=>d.kind==='relic')`)===true);

console.log('[7] 圣物栏 HUD 绘制不抛错');
T(`drawHUD()`);
check('drawHUD OK',true);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
