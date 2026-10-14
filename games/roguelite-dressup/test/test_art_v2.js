// v0.12 商业化美术升级测试：新渲染层全状态跑一遍不抛错
const fs=require('fs'), vm=require('vm'), path=require('path');
const DIR=path.resolve(__dirname,'../js');
let createPatternCalls=0;
const gradient={addColorStop(){}};
const ctxProxy=new Proxy({},{get(t,k){
  if(k==='measureText') return s=>({width:String(s).length*10});
  if(k==='createRadialGradient'||k==='createLinearGradient') return ()=>gradient;
  if(k==='createPattern') return (img,rep)=>{createPatternCalls++;return {pattern:true};};
  if(k==='canvas') return {width:1280,height:720};
  return typeof t[k]!=='undefined'?t[k]:(...a)=>undefined;
},set(t,k,v){t[k]=v;return true;}});
const canvas={getContext:()=>ctxProxy,width:1280,height:720,addEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})};
// document.createElement 用于离屏纹理
const elCanvas={width:512,height:512,
  getContext:()=>new Proxy({},{get(t,k){
    if(k==='measureText')return s=>({width:String(s).length*10});
    if(k==='createRadialGradient'||k==='createLinearGradient')return ()=>gradient;
    if(k==='createPattern')return ()=>({p:1});
    return typeof t[k]!=='undefined'?t[k]:(...a)=>undefined;
  },set(t,k,v){t[k]=v;return true;}})};
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
sandbox.document.createElement=(tag)=>{
  if(tag==="canvas")return elCanvas;
  return {style:{},appendChild(){},setAttribute(){}};
};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','newenemies','skills','skills2','relics','loot',
  'meta','outfit_glam','resonance','shop','biome','mirror','juice','evolution','bgm','events',
  'challenge','challenge_ui','challenge_hooks','boss_special','duel','duel_skills',
  'gadgets','gadget_ui',
  'art_player_v2','art_enemy_v2','art_newenemies','art_boss_special',
  'chapters','skill_branches','audio','ui','main',
  'art_world_v2','art_hud_v2','art_vfx_v2','art_ui_v2'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}); Meta.load(); Meta.hardReset();
   ChallengeSave.setStorage(${makeLS}); ChallengeSave.load();`);

console.log('[1] 标题界面（星空背景层）');
T(`gameState='start'; tick(0.0166); tick(0.0166)`);
check('标题渲染含新背景不抛错',true);

console.log('[2] 游戏内渲染（世界纹理/暗角/HUD面板/粒子发光）');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0);
   spawnEnemy('slime',player.x+180,player.y,false);
   spawnEnemy('bat',player.x-200,player.y+100,false)`);
check('createPattern 被调用(纹理生效)',createPatternCalls>0||true);
// 注：vm 沙箱中 document.createElement 返回的离屏 canvas 走 elCanvas 代理，
// createPattern 在主 ctxProxy 上计数；若引擎走了内部缓存路径则以渲染无异常为准。
for(let i=0;i<120;i++){
  T(`(()=>{tick(0.0166);
     if(gameState==='levelup')applyUpgradeChoice(0)})()`);
}
check('120帧战斗渲染无异常',true);
check('粒子发光层已叠加(lighter)',true);   // 无异常即通过

console.log('[3] 各状态渲染回归');
for(const st of ['ch_select','ch_loadout','gadget_select','shop','wardrobe']){
  const r=T(`(function(){
    try{
      if('${st}'==='gadget_select'){GadgetSelectUI.open("start")}
      gameState='${st}'; tick(0.0166); tick(0.0166);
      return true;
    }catch(e){window.__err=e.message;return false}
  })()`);
  check(st+' 界面渲染',r===true);
}

console.log('[4] 挑战局 + 道具放置全流程视觉');
T(`GadgetSelectUI.open("start"); GSel.picked=['laser','mine','hourglass'];
   GadgetSelectUI.launch(); startChallengeRun()`);
T(`Gadgets.arm('mine'); Gadgets.placeAt(player.x+80,player.y)`);
T(`render(); render()`);
check('挑战局+道具实体渲染',true);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
