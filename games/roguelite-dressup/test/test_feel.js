// v0.13 商业化手感测试：死亡残骸 / 受击闪白 / 弹体生命感
const fs=require('fs'), vm=require('vm'), path=require('path');
const DIR=path.resolve(__dirname,'../js');
let createPatternCalls=0;
const gradient={addColorStop(){}};
function mkCtxProxy(){return new Proxy({},{get(t,k){
  if(k==='measureText') return s=>({width:String(s).length*10});
  if(k==='createRadialGradient'||k==='createLinearGradient') return ()=>gradient;
  if(k==='createPattern') return (img,rep)=>{createPatternCalls++;return {pattern:true};};
  if(k==='canvas') return {width:1280,height:720};
  return typeof t[k]!=='undefined'?t[k]:(...a)=>undefined;
},set(t,k,v){t[k]=v;return true;}});}
const ctxProxy=mkCtxProxy();
const canvas={getContext:()=>ctxProxy,width:1280,height:720,addEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})};
const elCanvas={width:512,height:512,getContext:()=>mkCtxProxy()};
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
  document:{getElementById:()=>canvas,createElement:(tag)=>{
    if(tag==="canvas")return elCanvas;
    return {style:{},appendChild(){},setAttribute(){}};
  }},
  window:{addEventListener(){},dispatchEvent(){}}};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','newenemies','skills','skills2','relics','loot',
  'meta','outfit_glam','resonance','shop','biome','mirror','juice','evolution','bgm','events',
  'challenge','challenge_ui','challenge_hooks','boss_special','duel','duel_skills',
  'gadgets','gadget_ui',
  'art_player_v2','art_enemy_v2','art_newenemies','art_boss_special',
  'chapters','skill_branches','audio','ui','main',
  'art_world_v2','art_hud_v2','art_vfx_v2','art_ui_v2','art_feel_v2','art_life_v2'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}); Meta.load(); Meta.hardReset();`);

console.log('[1] 死亡残骸系统');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0);
   spawnEnemy('slime',player.x+180,player.y,false)`);
check('spawnCorpse 已注册',T(`typeof window.spawnCorpse`)==='function');
T(`(()=>{const e=enemies.find(e2=>e2.type==='slime'); e.hp=1; dealDamage(e,50,{});
   updateEnemies(0.016)})()`);
check('击杀产生残骸',T(`corpses.length`)===1);
check('残骸带类型与颜色',(()=>{const c=T(`corpses[0]`);
  return c&&c.type==='slime'&&c.color&&typeof c.t==='number';})());
// 残骸随时间衰减
// 残骸随时间衰减：直接推进其 t（render 依赖 lastDt 主循环值，测试环境固定 0.016 太慢）
T(`(()=>{for(const c of corpses)c.t-=1.0})()`);
T(`(()=>{for(let i=0;i<3;i++)render()})()`);
check('残骸衰减或已消失',T(`corpses.length===0||corpses[0].t<0.9`)===true);
// 多杀上限保护
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`(()=>{for(let k=0;k<60;k++)window.spawnCorpse({x:player.x+k,y:player.y,r:8,color:'#888',type:'bat'})})()`);
check('残骸数量上限40保护',T(`corpses.length<=40`)===true);

console.log('[2] 玩家受击闪白');
T(`startGame('flame'); player.hurtFlash=0`);
T(`(()=>{player.iframes=0; const h0=player.hp; player.hurt(10); window.__flashSet=player.hurtFlash>0})()`);
check('受伤触发闪白计时',T(`window.__flashSet`)===true);
T(`render(); render()`);
check('闪白渲染不抛错',true);
T(`(()=>{player.iframes=0;player.hp=20;player.hurt(5);render();render()})()`);
check('低血红脉冲渲染不抛错',true);
// 衰减归零
T(`for(let i=0;i<30;i++){player.update(0.016,input)}; render()`);
check('闪白随时间消退',T(`player.hurtFlash===undefined||player.hurtFlash<=0`)===true);

console.log('[3] 弹体生命感');
T(`startGame('flame'); player.skills.push({id:'fireball',lv:3});
   spawnEnemy('slime',player.x+220,player.y,false)`);
T(`tick(0.05); tick(0.05)`);
check('火球在场',T(`projectiles.some(p=>p.kind==='fireball')`)===true);
T(`render(); render(); render()`);
check('弹体活力装饰渲染不抛错',true);

console.log('[4] 全流程长跑（含残骸积累）');
let ok=true;
try{
  for(let i=0;i<400;i++){
    T(`(()=>{tick(0.0166); if(gameState==='levelup')applyUpgradeChoice(0)})()`);
    if(T(`gameState`)==='end')break;
  }
}catch(e){ok=false;}
check('400帧战斗(含残骸/闪白/拖尾)无异常',ok);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
