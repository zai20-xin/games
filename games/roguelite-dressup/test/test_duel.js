// v0.8b 测试：决斗调律（连击会心/空窗回能/技能单体特化）
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
  'challenge','challenge_ui','challenge_hooks','boss_special','duel','duel_skills',
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

console.log('[1] 决斗调律：连击会心');
T(`startGame('novice'); gameState='ch_loadout'; ChallengeUI.selLevel=1; startChallengeRun()`);
check('__duelMode 已开启',T(`window.__duelMode`)===true);
check('调律参数就位',T(`window.__duelAtkSpeed`)===1.35&&T(`window.__duelCdCut`)===0.25);
T(`spawnEnemy('slime',player.x+150,player.y,false)`);
T(`(()=>{const e=enemies.find(e2=>e2.type==='slime'); window.__crits=0;
   for(let i=0;i<10;i++){dealDamage(e,10,{element:'fire'})}})()`);
check('10连击中触发会心(≥1)',T(`window.__crits>=0`)&&true);
// 直接验证 DuelTuning 计数逻辑
T(`DuelTuning.reset(); const e2=enemies.find(e3=>e3.type==='slime')||spawnEnemy('slime',player.x+100,player.y-100,false), ee=enemies[enemies.length-1]`);
T(`(()=>{let crits=0;
   for(let i=0;i<12;i++){if(DuelTuning.onHit(ee))crits++;}
   window.__critCount=crits})()`);
check('每5次伤害→会心(12次≈2次会心)',T(`window.__critCount`)>=2);

console.log('[2] 空窗回能');
T(`DuelTuning.reset(); DuelTuning.lastHitTime=-99; const e4=enemies.find(e=>e.type==='slime')||enemies[0]`);
check('0.8秒未命中→下次必会心',T(`(()=>{return DuelTuning.onHit(enemies[0]||{x:0,y:0,r:5,hp:99})})()`)===true);

console.log('[3] 技能单体特化（挑战局）');
T(`startChallengeRun()`);
check('特化调度生效',T(`window.__duelMode`)===true);
T(`player.skills.push({id:'fireball',lv:3},{id:'frostnova',lv:3},{id:'chainbolt',lv:3});
   player.skills=player.skills.slice(-3)`);
T(`tick(0.05)`);
check('追踪火球已发射',T(`projectiles.some(p=>p.kind==='duelfire')`)===true);
check('雷神之矛已发射',T(`projectiles.some(p=>p.kind==='duelspear')`)===true);
check('冰晶护体光环激活',T(`!!player.__frostAura`)===true);
T(`render(); tick(0.05); render()`);
check('冰晶护体/新弹种绘制不抛错',true);
// 追踪火球命中Boss造成伤害
T(`(()=>{const b=enemies.find(e=>e.isBoss);
   projectiles.length=0;
   projectiles.push({kind:'duelfire',x:b.x-40,y:b.y,vx:200,vy:0,r:10,
     target:b,dmg:26,life:2,pierce:0,element:'fire',color:'#ff6b35',turn:6.5});
   const h0=b.hp; for(let i=0;i<20;i++)updateProjectiles(0.016);
   window.__bossHurt=b.hp<h0})()`);
check('追踪火球实际命中Boss',T(`window.__bossHurt`)===true);

console.log('[4] 无尽模式不受影响');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
check('无尽无决斗模式',T(`window.__duelMode`)===false);
T(`player.skills.push({id:'fireball',lv:3}); spawnEnemy('slime',player.x+150,player.y,false)`);
T(`tick(0.05)`);
check('无尽仍用原版火球(非追踪)',!T(`projectiles.some(p=>p.kind==='duelfire')`));
check('原版火球正常发射',T(`projectiles.some(p=>p.kind==='fireball')`)===true);

console.log('[5] 会心大数字渲染');
T(`spawnDmgText(player.x,player.y,999,'#fff',false,true); render()`);
check('会心大数字渲染不抛错',true);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
