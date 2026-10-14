// 无头冒烟测试：stub 浏览器 API，真实加载游戏代码并模拟游玩
const fs=require('fs'), vm=require('vm'), path=require('path');
const DIR=path.resolve(__dirname,'../js');

// ---- 浏览器环境 stub ----
const gradient={addColorStop(){}};
const ctxProxy=new Proxy({},{
  get(t,k){
    if(k==='measureText') return (s)=>({width:String(s).length*10});
    if(k==='createRadialGradient'||k==='createLinearGradient') return ()=>gradient;
    return typeof t[k]!=='undefined'?t[k]:(...a)=>undefined;
  },
  set(t,k,v){ t[k]=v; return true; }
});
const canvas={getContext:()=>ctxProxy,width:1280,height:720,
  addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})};
const sandbox={
  console, Math, Date, JSON, performance:{now:()=>Date.now()},
  setTimeout:(fn)=>0, clearTimeout(){},
  requestAnimationFrame(){}, // 不启动真实循环，手动驱动 tick
  document:{getElementById:()=>canvas},
  window:{addEventListener(){}},
};
sandbox.window.dispatchEvent=()=>{};
vm.createContext(sandbox);

for(const f of ['config','tuning','outfit_bias','utils','player','enemies','skills','skills2','relics','loot','meta','outfit_glam','resonance','shop','ui','main']){
  const code=fs.readFileSync(path.join(DIR,f+'.js'),'utf8');
  try{ vm.runInContext(code,sandbox,{filename:f+'.js'}); }
  catch(e){ console.log(`LOAD FAIL ${f}: ${e.message}`); process.exit(1); }
}
console.log('all modules loaded');

const T=(expr)=>vm.runInContext(expr,sandbox);

// 场景1：烈焰时装 + 前四技能，跑 1200 帧（约20秒游戏时间）
try{
  T(`startGame('flame')`);
  T(`player.skills.push({id:'fireball',lv:5},{id:'frostnova',lv:5},{id:'chainbolt',lv:3},{id:'blades',lv:2})`);
  // 手动撒一圈敌人
  T(`for(let i=0;i<25;i++){const a=i/25*Math.PI*2;spawnEnemy(i%5===0?'golem':'slime',player.x+Math.cos(a)*rand(150,400),player.y+Math.sin(a)*rand(150,400),false)}`);
  // 模拟玩家绕圈走位拾取经验
  let levelups=0;
  const keys=['right','down','left','up'];
  for(let i=0;i<1200;i++){
    const dir=keys[Math.floor(i/90)%4];
    T(`input.${dir}=true; input.${keys[(Math.floor(i/90)+3)%4]}=false`);
    T(`tick(0.0166)`);
    const st=T(`gameState`);
    if(st==='levelup'){ T(`applyUpgradeChoice(0)`); levelups++; }
    if(st==='end'){ console.log('early end at frame',i); break; }
    // 每隔一段补怪，维持压力
    if(i%200===199){ T(`for(let i=0;i<10;i++){spawnEnemy(pick(['slime','bat','shroom']),player.x+rand(-500,500),player.y+rand(-500,500),false)}`); }
  }
  console.log('scene1 done | kills=',T(`player.kills`),'| lvl=',T(`player.level`),'| hp=',Math.round(T(`player.hp`)),'| enemies alive=',T(`enemies.length`),'| levelups picked=',levelups);
}catch(e){ console.log('SCENE1 FAIL:',e.message,'\n',e.stack.split('\n').slice(0,4).join('\n')); process.exitCode=1; }

// 场景2：暗影时装 + 后五技能（飞刀/毒/圣光/地刺/星陨），跑 900 帧
try{
  T(`startGame('shadow')`);
  T(`player.skills.push({id:'knives',lv:5},{id:'poison',lv:5},{id:'holypulse',lv:2},{id:'quake',lv:5},{id:'starfall',lv:3})`);
  T(`for(let i=0;i<30;i++){spawnEnemy(pick(['slime','bat','shroom']),player.x+rand(-450,450),player.y+rand(-450,450),false)}`);
  for(let i=0;i<900;i++){
    const dir=['up','right','down','left'][Math.floor(i/80)%4];
    T(`input.${dir}=true; input.${['left','up','right','down'][Math.floor(i/80)%4]}=false`);
    T(`tick(0.0166)`);
    const st=T(`gameState`);
    if(st==='levelup'){ T(`applyUpgradeChoice(upgradeChoices.length-1)`); } // 也测符文路径
    if(st==='end') break;
    if(i%150===149){ T(`for(let i=0;i<8;i++){spawnEnemy('slime',player.x+rand(-480,480),player.y+rand(-480,480),false)}`); }
  }
  console.log('scene2 done | kills=',T(`player.kills`),'| lvl=',T(`player.level`),'| enemies alive=',T(`enemies.length`));
}catch(e){ console.log('SCENE2 FAIL:',e.message,'\n',e.stack.split('\n').slice(0,4).join('\n')); process.exitCode=1; }

// 场景3：Boss 战与胜利结算
try{
  T(`startGame('holy')`);
  T(`player.skills.push({id:'fireball',lv:5})`);
  T(`spawnBoss(player.x+200,player.y)`);
  T(`tick(0.0166)`); T(`tick(0.0166)`);
  // 按 isBoss 精确锁定并秒杀，验证胜利路径
  T(`const b=enemies.find(e=>e.isBoss); b.hp=1; dealDamage(b,999,{})`);;
  T(`tick(0.0166)`);
  console.log('scene3 | state=',T(`gameState`),'winFlag=',T(`winFlag`));
}catch(e){ console.log('SCENE3 FAIL:',e.message); process.exitCode=1; }

// 场景4：升级选牌池合法性 ×200
try{
  T(`startGame('novice')`);
  T(`player.skills.push({id:'fireball',lv:5})`);
  let bad=0;
  for(let i=0;i<200;i++){
    T(`buildUpgradeChoices()`);
    const n=T(`upgradeChoices.length`);
    const ids=T(`JSON.stringify(upgradeChoices.map(c=>c.id))`);
    if(n!==3||ids.includes('undefined')) bad++;
  }
  console.log('scene4 upgrade pool | bad draws =',bad);
}catch(e){ console.log('SCENE4 FAIL:',e.message); process.exitCode=1; }

console.log('SMOKE TEST COMPLETE');
