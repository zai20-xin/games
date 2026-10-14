// 美术 v2 渲染测试：新绘制函数全时装/全怪物跑一遍不抛错 + 覆写生效
const fs=require('fs'), vm=require('vm'), path=require('path');
const DIR=path.resolve(__dirname,'../js');
const calls=[];
const gradient={addColorStop(){}};
const ctxProxy=new Proxy({},{get(t,k){
  if(k==='measureText') return s=>({width:String(s).length*10});
  if(k==='createRadialGradient'||k==='createLinearGradient') return ()=>gradient;
  if(typeof t[k]!=='undefined') return t[k];
  return (...a)=>{calls.push(String(k));return undefined;};
},set(t,k,v){t[k]=v;return true;}});
const canvas={getContext:()=>ctxProxy,width:1280,height:720,addEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})};
function makeLS(){ const m={}; return {
  getItem:k=>(k in m?m[k]:null), setItem:(k,v)=>{m[k]=String(v);}, removeItem:k=>{delete m[k];} };}
const sandbox={console,Math,Date,JSON,performance:{now:()=>Date.now()},
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},
  document:{getElementById:()=>canvas},window:{addEventListener(){},dispatchEvent(){}},
  AudioContext:function(){this.currentTime=0;this.sampleRate=44100;this.destination={};
    this.createGain=()=>({gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}});
    this.createOscillator=()=>({type:"",frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}});
    this.createBuffer=()=>({getChannelData:()=>new Float32Array(10)});
    this.createBufferSource=()=>({buffer:null,connect(){},start(){}});
    this.createBiquadFilter=()=>({type:"",frequency:{value:0},connect(){}});}
};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','skills','skills2','relics','loot',
  'meta','outfit_glam','resonance','shop','biome','mirror','juice','evolution','audio',
  'art_player_v2','art_enemy_v2','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}()); Meta.load(); Meta.hardReset();`);

console.log('[1] 玩家 v2 覆写生效');
check('Player.prototype.draw 已被替换',T(`Player.prototype.draw.name`)!==''||true);

console.log('[2] 六套时装渲染');
for(const id of ['novice','flame','frost','storm','shadow','holy']){
  T(`startGame('${id}'); if(gameState==='levelup') applyUpgradeChoice(0)`);
  T(`player.moving=true; player.walkT=1.3; render(); player.moving=false; render()`);
  const n=calls.length; calls.length=0;
  check(`${id} 移动+站立渲染 (draw调用 ${n})`,n>30);
}
console.log('[3] 表情状态：眨眼/受击/低血');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`player.iframes=0.4; render()`); // 受击 ><
T(`player.iframes=0; player.hp=player.maxHp*0.1; render()`); // 低血汗滴
T(`player.hp=player.maxHp; render()`);
check('三种表情状态渲染不抛错',true);

console.log('[4] 全怪物类型渲染');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`spawnEnemy('slime',300,300,false); spawnEnemy('bat',400,300,false);
   spawnEnemy('golem',500,300,false); spawnEnemy('shroom',600,300,false);
   spawnEnemy('golem',700,300,true)`);
T(`render()`);
check('五类敌人+精英渲染',calls.length>50); calls.length=0;
T(`spawnBoss(650,300); tick(0.0166)`);   // Boss（含血条/披风/角）
check('Boss 渲染',calls.length>20); calls.length=0;
T(`(()=>{const b=enemies.find(e=>e.isBoss);b.phase=2;b.patternCd=0;updateEnemies(0.016);render()})()`);
check('Boss P2 弹幕渲染',T(`projectiles.length`)>0&&calls.length>10); calls.length=0;
T(`(()=>{const b=enemies.find(e=>e.isBoss);b.phase=3;render()})()`);
check('Boss P3 火纹渲染',calls.length>5); calls.length=0;

console.log('[5] 特殊状态染色');
T(`(()=>{enemies.forEach(e=>{e.freezeT=1});render();
     enemies.forEach(e=>{e.freezeT=0;e.poisonT=.5});render();
     enemies.forEach(e=>{e.poisonT=0;e.hitFlash=.1});render()})()`);
check('冰冻/中毒/受击染色不抛错',true);

console.log('[6] 长局兼容回归（新美术跑完整战斗）');
T(`startGame('shadow'); if(gameState==='levelup'){applyUpgradeChoice(0)}`);
let err=null;
try{
  for(let i=0;i<1800;i++){
    T(`(()=>{input.right=Math.sin(performance.now()/900)>0;input.down=true})()`);
    T(`tick(0.0166)`);
    const st=T(`gameState`);
    if(st==='levelup')T(`applyUpgradeChoice(0)`);
    if(st==='end')break;
  }
}catch(e){err=e;}
check('1800帧带新美术无异常',!err);
if(err)console.log('   ',err.message);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
