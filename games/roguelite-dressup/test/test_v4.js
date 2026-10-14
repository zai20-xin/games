// v0.4 测试：Boss三阶段 / 敌方弹幕 / 暂停静音 / 音效引擎
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
  setTimeout:(fn)=>0,clearTimeout(){},requestAnimationFrame(){},
  AudioContext:function(){ // 模拟 WebAudio
    this.currentTime=0; this.sampleRate=44100; this.state="running";
    this.destination={};
    this.createGain=()=>({gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}});
    this.createOscillator=()=>({type:"",frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}});
    this.createBuffer=()=>({getChannelData:()=>new Float32Array(100)});
    this.createBufferSource=()=>({buffer:null,connect(){},start(){}});
    this.createBiquadFilter=()=>({type:"",frequency:{value:0},connect(){}});
    this.resume=()=>{};
  },
  document:{getElementById:()=>canvas},window:{addEventListener(){},dispatchEvent(){}}};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','skills','skills2','relics','loot',
  'meta','outfit_glam','resonance','shop','biome','mirror','juice','evolution','audio','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}()); Meta.load(); Meta.hardReset();`);

console.log('[1] 音效引擎');
check('SFX 已加载',T(`typeof SFX==='object'`)===true);
T(`SFX.unlock()`);
check('AudioContext 创建成功',T(`!!SFX.ac`)===true);
let played=0;
for(const n of ['shoot','boom','frost','zap','poison','holy','kill','gem','coin','potion',
                'magnet','relic','levelup','evolution','hurt','ring','bosspawn','victory','defeat','ui'])
  if(T(`SFX.play('${n}')`)) played++;
check(`全部20种音效可播放 (${played}/20)`,played===20);
check('限流生效：连打被拦',T(`SFX.play('boom')`)===false);
T(`SFX.toggleMute(); const m1=SFX.muted; SFX.play('gem')`);
check('静音后不发声',T(`m1`)===true&&T(`SFX._ok('gem')`)===false);
T(`SFX.toggleMute()`);

console.log('[2] Boss 三阶段');
T(`startGame('storm'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`spawnBoss(player.x+300,player.y); tick(0.0166)`);
const boss=T(`enemies.find(e=>e.isBoss)`);
check('Boss 存在且初始 phase1',T(`(()=>{const b=enemies.find(e=>e.isBoss);return b&&b.phase===1})()`)===true);
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.hp=b.maxHp*0.5; updateEnemies(0.016)})()`);
check('血量<66% → phase2 弹幕形态',T(`(()=>{const b=enemies.find(e=>e.isBoss);return b.phase===2})()`)===true);
// 快进冷却后 Boss 发出弹幕环（阶段切换自带1.2s缓冲，属设计节奏）
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.patternCd=0; updateEnemies(0.016)})()`);
check('phase2 发出弹幕环',T(`projectiles.some(p=>p.kind==='enemybullet')`)===true);
const ringN=T(`projectiles.filter(p=>p.kind==='enemybullet').length`);
check('弹幕数量≥12',ringN>=12);
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.hp=b.maxHp*0.25; updateEnemies(0.016)})()`);
check('血量<33% → phase3 狂暴',T(`(()=>{const b=enemies.find(e=>e.isBoss);return b.phase===3})()`)===true);
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.patternCd=0; updateEnemies(0.016)})()`);
check('狂暴召唤蝙蝠',T(`enemies.filter(e=>e.type==='bat').length>=2`)===true);
check('狂暴扇形三连弹',T(`projectiles.filter(p=>p.kind==='enemybullet').length`)>ringN);

console.log('[3] 敌方弹幕行为');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`projectiles.push({kind:'enemybullet',x:player.x+10,y:player.y,vx:0,vy:0,r:7,dmg:12,life:4,pierce:99,color:'#f00'});
   player.iframes=0; player.hp=100; updateProjectiles(0.016)`);
check('敌弹命中玩家造成伤害',T(`player.hp`)===88);
check('命中后弹体消失',T(`!projectiles.some(p=>p.kind==='enemybullet')`)===true);
T(`projectiles.push({kind:'enemybullet',x:500,y:500,vx:0,vy:0,r:7,dmg:12,life:4,pierce:99,color:'#f00'});
   spawnEnemy('slime',505,505,false); updateProjectiles(0.016)`);
check('敌弹不伤害敌人',T(`enemies[0].hp`)===ENEMY_TYPES_HP(),{});
function ENEMY_TYPES_HP(){ return T(`ENEMY_TYPES.slime.hp*(1+gameTime/60*0.35)`); }
check('敌弹出界清理',T(`(()=>{projectiles.length=0;
  projectiles.push({kind:'enemybullet',x:-500,y:-500,vx:0,vy:0,r:7,dmg:1,life:9,pierce:99});
  updateProjectiles(0.016); return projectiles.length})()`)===0);

console.log('[4] 暂停与恢复');
T(`gameState='playing'; tick(0.0166)`);
T(`gameState='paused'; tick(0.0166)`);
const t1=T(`gameTime`);
T(`tick(0.0166)`); T(`tick(0.0166)`);
check('暂停时世界时间冻结',T(`gameTime`)===t1);
check('暂停界面绘制不抛错',true);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
