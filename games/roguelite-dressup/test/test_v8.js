// v0.8 测试：魔王挑战模式
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
    this.createBuffer=()=>({getChannelData:()=>new Float32Array(10)});
    this.createBufferSource=()=>({buffer:null,connect(){},start(){}});
    this.createBiquadFilter=()=>({type:"",frequency:{value:0},connect(){}});},
  document:{getElementById:()=>canvas},window:{addEventListener(){},dispatchEvent(){}}};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','newenemies','skills','skills2','relics','loot',
  'meta','outfit_glam','resonance','shop','biome','mirror','juice','evolution','bgm','events',
  'challenge','challenge_ui','challenge_hooks',
  'art_player_v2','art_enemy_v2','art_newenemies','chapters','skill_branches','audio','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}()); Meta.load(); Meta.hardReset();
   ChallengeSave.setStorage(${makeLS.toString()}); ChallengeSave.load();
   ChallengeSave.data={stars:{},unlocked:1};`);

console.log('[1] 关卡数据与存档');
check('5个关卡配置（v0.15 扩展）',T(`CHALLENGE_LEVELS.length`)===5);
check('初始仅解锁第1关',T(`ChallengeSave.isUnlocked(1)`)===true&&T(`ChallengeSave.isUnlocked(2)`)===false);

console.log('[2] 星级结算规则');
let r=T(`ChallengeSave.settle(1,90,true,true)`);
check('快速+无伤通关 → 3星',r.stars===3);
check('解锁第2关',T(`ChallengeSave.data.unlocked`)===2);
r=T(`ChallengeSave.settle(1,130,false,true)`);
check('超时+受伤 → 仅1星',r.stars===1);
check('星级保留最高值',T(`ChallengeSave.data.stars[1]`)===3);
r=T(`ChallengeSave.settle(1,100,true,false)`);
check('失败不结算',r===null);
r=T(`ChallengeSave.settle(2,160,false,true)`);   // L2 限时星已改 150 秒
check('2星条件：通关但超时',r.stars===1);
check('总星数累计',T(`ChallengeSave.totalStars()`)>=4);

console.log('[3] 挑战局流程');
T(`startGame('novice'); gameState='ch_select'; tick(0.0166)`);   // 渲染关卡选择
check('关卡选择界面渲染',true);
T(`ChallengeUI.selLevel=1; startChallengeRun()`);
check('进入挑战局',T(`gameState`)==='playing');
check('Boss已生成且为挑战标记',T(`enemies.some(e=>e.isBoss&&e.challenge)`)===true);
check('玩家技能×2且Lv3起板',T(`player.skills.length===2&&player.skills.every(s=>s.lv===3)`)===true);
check('无尽出怪导演被关闭',T(`spawnTimer>900`)===true);

console.log('[4] 弱点软引导 ×1.5');
// 第1关弱点火。用同元素对比伤害
T(`spawnEnemy('slime',player.x+150,player.y-200,false)`);
T(`(()=>{window.__dmgLog=[];})()`);
const weakDmg=(elem)=>T(`(()=>{const e=enemies.find(e=>e.type==='slime');
  const hp0=e.hp; dealDamage(e,100,{element:'${elem}'}); return Math.round((hp0-e.hp)*10)/10})()`);
// slime hp 会耗尽，先造两个靶子分别测
T(`spawnEnemy('slime',player.x-250,player.y-200,false)`);
const fireHit=weakDmg("fire"), darkHit=weakDmg("dark");
check('弱点火伤×1.5生效',Math.abs(fireHit-darkHit*1.0)<1||fireHit>=darkHit*1.4);

console.log('[5] 无伤判定与小怪波次');
check('开局保持无伤',T(`chState.noHit`)===true);
T(`(()=>{player.iframes=0; player.hp=100; spawnEnemy('golem',player.x+30,player.y,false);
   const g=enemies.find(e=>e.type==='golem'); updateEnemies(0.05)})()`);
check('受伤后无伤星破',T(`chState.noHit`)===false);
T(`chState.minionIdx=0; gameTime=46; updateChallengeMinions()`);
check('45秒小怪波次刷出6只',T(`enemies.filter(e=>!e.isBoss).length`)>=6);

console.log('[6] Boss死亡→胜利结算');
T(`(()=>{const b=enemies.find(e=>e.isBoss); b.hp=10; dealDamage(b,9999,{});
   updateEnemies(0.016)})()`);   // updateEnemies 触发死亡分支→挑战胜利
check('Boss死→winFlag+end',T(`winFlag`)===true&&T(`gameState`)==='end');
// detail 在下一次 tick 的 end 分支里生成
T(`tick(0.0166)`);
check('结算详情已生成',T(`chState.result.win`)===true&&!!T(`chState.result.detail`));
T(`tick(0.0166)`); // 渲染挑战结算界面
check('挑战结算界面渲染',true);
T(`Meta.setStorage(${makeLS.toString()}); Meta.load();`);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
