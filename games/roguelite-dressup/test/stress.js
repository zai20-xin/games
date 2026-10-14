// 长局压力测试：模拟完整 10 分钟到 Boss 出现，以及死亡路径
const fs=require('fs'), vm=require('vm'), path=require('path');
const DIR=path.resolve(__dirname,'../js');
const gradient={addColorStop(){}};
const ctxProxy=new Proxy({},{get(t,k){
  if(k==='measureText') return s=>({width:String(s).length*10});
  if(k==='createRadialGradient'||k==='createLinearGradient') return ()=>gradient;
  return typeof t[k]!=='undefined'?t[k]:(...a)=>undefined;
},set(t,k,v){t[k]=v;return true;}});
const canvas={getContext:()=>ctxProxy,width:1280,height:720,addEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})};
const sandbox={console,Math,Date,JSON,performance:{now:()=>Date.now()},
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},
  document:{getElementById:()=>canvas},window:{addEventListener(){}}};
vm.createContext(sandbox);
for(const f of ['config','tuning','outfit_bias','utils','player','enemies','skills','skills2','relics','loot','meta','outfit_glam','resonance','shop','ui','main'])
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f});
const T=e=>vm.runInContext(e,sandbox);

// ---- 完整 10 分钟：自动选牌，风筝走位 AI ----
T(`startGame('storm')`);
const KITE = `(function(){
  const px=player.x, py=player.y;
  let fx=Math.cos(gameTime*0.7)*0.8, fy=Math.sin(gameTime*0.7)*0.8;
  for(const e of enemies){
    const dx=px-e.x, dy=py-e.y;
    const d2=dx*dx+dy*dy;
    if(d2<140*140 && d2>1){
      const inv=(140-Math.sqrt(d2))/140/Math.sqrt(d2)*2.2;
      fx+=dx*inv; fy+=dy*inv;
    }
  }
  const m=Math.hypot(fx,fy)||1;
  fx/=m; fy/=m;
  if(px<300)fx=1; if(px>WORLD.w-300)fx=-1; if(py<300)fy=1; if(py>WORLD.h-300)fy=-1;
  return {left:fx<-0.3,right:fx>0.3,up:fy<-0.3,down:fy>0.3};
})()`;
let picks=0, maxEnemies=0, maxParticles=0, err=null;
for(let i=0;i<36500;i++){
  T(`(()=>{const k=${KITE}; input.left=k.left; input.right=k.right; input.up=k.up; input.down=k.down})()`);
  T(`tick(0.0166)`);
    const st=T(`gameState`);
    if(st==='levelup'){ T(`(()=>{const i=upgradeChoices.findIndex(c=>c.type!=='rune'); applyUpgradeChoice(i<0?0:i)})()`); picks++; }
    if(st==='end'){ console.log('game ended naturally @', T(`gameTime`).toFixed(1)+'s'); break; }
    if(i%600===0){
      maxEnemies=Math.max(maxEnemies,T(`enemies.length`));
      maxParticles=Math.max(maxParticles,T(`particles.length`));
    }
  }
console.log('boss spawned:',T(`bossSpawned`),'| final time:',T(`gameTime`).toFixed(1)+'s');
console.log('total picks:',picks,'| skills:',T(`JSON.stringify(player.skills.map(s=>s.id+':'+s.lv))`));
console.log('peak enemies:',maxEnemies,'| peak particles:',maxParticles);
console.log('kills:',T(`player.kills`),'| state:',T(`gameState`),'| win:',T(`winFlag`));
if(err){ console.log('LONG RUN FAIL:',err.message); process.exitCode=1; }

// ---- 死亡路径（选掉开局赠礼，若中途再升级也继续选，最终必须死亡）----
T(`startGame('novice')`);
T(`spawnEnemy('golem',player.x+30,player.y,false)`);
T(`player.hp=1`);
for(let i=0;i<600;i++){
  const st=T(`gameState`);
  if(st==='levelup'){ T(`applyUpgradeChoice(0)`); continue; }
  T(`tick(0.0166)`);
  if(T(`gameState`)==='end') break;
}
console.log('death path | state=',T(`gameState`),'winFlag=',T(`winFlag`));

// ---- 结束后重开路径 ----
T(`startGame('frost')`);
T(`tick(0.0166)`);   // 触发开局赠礼弹窗
if(T(`gameState`)==='levelup'){ T(`applyUpgradeChoice(0)`); }
T(`tick(0.0166)`);
console.log('restart | state=',T(`gameState`),'| enemies reset:',T(`enemies.length`)<=5);
console.log('STRESS TEST COMPLETE');
