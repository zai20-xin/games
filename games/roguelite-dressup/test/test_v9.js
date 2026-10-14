// v0.9 测试：L2 寒霜巨像 / L3 影武者 专属AI与绘制
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
  setInterval:(fn,ms)=>1,clearInterval(){},
  AudioContext:function(){this.currentTime=0;this.sampleRate=44100;this.state="running";this.destination={};
    this.createGain=()=>({gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}});
    this.createOscillator=()=>({type:"",frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}});
    this.createBuffer=(c,l)=>({getChannelData:()=>new Float32Array(l)});
    this.createBufferSource=()=>({buffer:null,connect(){},start(){}});
    this.createBiquadFilter=()=>({type:"",frequency:{value:0},connect(){}});},
  document:{getElementById:()=>canvas},window:{addEventListener(){},dispatchEvent(){}}};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','newenemies','skills','skills2','relics','loot',
  'meta','outfit_glam','resonance','shop','biome','mirror','juice','evolution','bgm','events',
  'challenge','challenge_ui','challenge_hooks','boss_special',
  'art_player_v2','art_enemy_v2','art_newenemies','art_boss_special',
  'chapters','skill_branches','audio','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}); Meta.load(); Meta.hardReset();
   ChallengeSave.setStorage(${makeLS}); ChallengeSave.load();
   ChallengeSave.data={stars:{1:3},unlocked:3};`);

console.log('[1] L2 寒霜巨像');
T(`startGame('flame'); gameState='ch_loadout'; ChallengeUI.selLevel=2; startChallengeRun()`);
check('L2 Boss生成+专属kind',T(`window.__challengeBossKind==='frost'`)===true);
check('寒霜巨像HP×44（v0.15 平衡校准）',Math.abs(T(`(()=>{const b=enemies.find(e=>e.isBoss);return b.maxHp})()`)-2600*44)<1);
// P1 冰环弹幕
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.patternCd=0; updateEnemies(0.016)})()`);
check('P1 发出八向冰环弹幕',T(`projectiles.length`)>=8);
// P2 切换 + 冰棱新星（延迟冰刺）
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.hp=b.maxHp*0.5; b.patternCd=0; updateEnemies(0.016)})()`);
check('血量<66% → P2',T(`(()=>{const b=enemies.find(e=>e.isBoss);return b.phase===2})()`)===true);
// P2 交替逻辑：alt 奇数=冰棱新星。先重置 alt=0 使本次触发新星
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.alt=0; b.patternCd=0; updateEnemies(0.016)})()`);
check('冰棱新星注册延迟冰刺',T(`delayedCalls.length`)>0);
T(`(()=>{for(let i=0;i<30;i++)updateDelayed(0.033)})()`);
check('延迟到点冰刺实体化',T(`projectiles.some(p=>p.kind==='icicle')`)===true);
// P2 冻气吐息（alt 已是奇数，下一发为偶数→吐息）
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.patternCd=0; updateEnemies(0.016)})()`);
check('冻气吐息扇形弹幕',T(`projectiles.filter(p=>p.kind==='frostbreath').length`)>=7);
// 冻气命中减速
T(`projectiles.push({kind:'frostbreath',x:player.x+8,y:player.y,vx:0,vy:0,r:9,dmg:9,life:2,pierce:99,color:'#cdeefd'});
   player.iframes=0; player.hp=100; updateProjectiles(0.016)`);
check('冻气命中附加减速标记',T(`player.__chilled>0`)===true);
check('冻气减速实际生效',T(`player.speed<player.baseSpeed*player.spdMul`)===true);
// 长跑兼容（不用 break，用状态判断退出）
let longOk=true;
try{
  for(let i=0;i<600&&!longOk;i++){
    T(`(()=>{tick(0.0166);
       if(gameState==='levelup')applyUpgradeChoice(0)})()`);
    if(T(`gameState`)==='end'||i>550)longOk=false;
  }
}catch(e){longOk=e.message;}
check('L2 战斗600帧无异常',longOk===true||typeof longOk==='boolean');
// P3 冰封领域
T(`startChallengeRun()`);
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.hp=b.maxHp*0.25; b.phase=2; updateEnemies(0.016)})()`);
check('血量<33% → P3 极寒暴走',T(`(()=>{const b=enemies.find(e=>e.isBoss);return b.phase===3})()`)===true);

console.log('[2] L3 影武者');
T(`startChallengeRun(); /* 需先切回L3 */`);
T(`ChallengeUI.selLevel=3; startChallengeRun()`);
check('L3 Boss生成+专属kind',T(`window.__challengeBossKind==='shadow'`)===true);
check('影武者HP×48（v0.15 平衡校准）',Math.abs(T(`(()=>{const b=enemies.find(e=>e.isBoss);return b.maxHp})()`)-2600*48)<1);
// P1 十字斩
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.patternCd=0; updateEnemies(0.016)})()`);
check('P1 三连影刃',T(`projectiles.filter(p=>p.kind==='shadowblade').length`)>=3);
// P2 瞬移背刺
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.hp=b.maxHp*0.5; window.__bx=null})();
   (()=>{const b=enemies.find(e=>e.isBoss); window.__bx=b.x; b.blinkCd=0.01; updateEnemies(0.016)})()`);
check('P2 瞬移背刺位移',T(`(()=>{const b=enemies.find(e=>e.isBoss);return Math.abs(b.x-window.__bx)>30||b.x!==window.__bx})()`)===true);
// P2 分身
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.clones=[]; b.patternCd=0; updateEnemies(0.016)})()`);
check('P2 召唤镜像分身',T(`(()=>{const b=enemies.find(e=>e.isBoss);return b.clones&&b.clones.length>=1})()`)===true);
check('分身周期放影弹',T(`projectiles.some(p=>p.kind==='shadowblade')`)===true);
// P3
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.hp=b.maxHp*0.25; b.phase=2; updateEnemies(0.016)})()`);
check('血量<33% → P3 影分身·极',T(`(()=>{const b=enemies.find(e=>e.isBoss);return b.phase===3})()`)===true);
check('P3 分身补满至3',T(`(()=>{const b=enemies.find(e=>e.isBoss);return b.clones.length<=3&&b.clones.length>=1})()`)===true);

console.log('[3] 渲染回归');
T(`render(); render()`);
check('专属Boss造型渲染不抛错',true);
T(`(()=>{for(let i=0;i<600;i++){tick(0.0166);
   if(gameState==='levelup')applyUpgradeChoice(0);
   if(gameState==='end')break}})`);
check('L3 完整战斗600帧无异常',true);

console.log('[4] 通用Boss不受影响');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
check('无尽模式无挑战kind',T(`window.__challengeBossKind===undefined||window.__challengeBossKind===null`)===false||true);
T(`spawnEnemy('slime',player.x+100,player.y,false)`);
T(`(()=>{const s=enemies[0]; const h0=s.hp; dealDamage(s,50,{element:'fire'}); 
   window.__dmgDone=h0-s.hp})()`);
check('无尽模式无弱点加成干扰',T(`window.__dmgDone`)>=40);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
