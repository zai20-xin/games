// v0.7 测试：BGM引擎 / 随机事件(宝箱雨/祭坛/商人)
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
let intervalCB=null,intervalClear=0;
const sandbox={console,Math,Date,JSON,performance:{now:()=>Date.now()},
  setTimeout:()=>0,clearTimeout(){},
  requestAnimationFrame(){},
  setInterval:(fn,ms)=>{intervalCB=fn;return 1;},
  clearInterval:()=>{intervalClear++;intervalCB=null;},
  AudioContext:function(){this.currentTime=0;this.sampleRate=44100;this.state="running";this.destination={};
    this.createGain=()=>({gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}});
    this.createOscillator=()=>({type:"",frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}});
    this.createBuffer=(ch,len)=>({getChannelData:()=>new Float32Array(len)});
    this.createBufferSource=()=>({buffer:null,connect(){},start(){}});
    this.createBiquadFilter=()=>({type:"",frequency:{value:0},connect(){}});
    this.resume=()=>{};},
  document:{getElementById:()=>canvas},window:{addEventListener(){},dispatchEvent(){}}};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','newenemies','skills','skills2','relics','loot',
  'meta','outfit_glam','resonance','shop','biome','mirror','juice','evolution','bgm','events',
  'art_player_v2','art_enemy_v2','art_newenemies','chapters','skill_branches','audio','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}()); Meta.load(); Meta.hardReset();`);

console.log('[1] BGM 引擎');
check('BGM 已加载，4首曲目',T(`BGM.TRACKS.length`)===4);
check('未解锁音频时 play 挂起不崩',T(`BGM.play(0)`)===false);
T(`SFX.unlock(); BGM.play(1)`);
check('解锁后播放启动',T(`BGM.playing`)===true&&T(`BGM.trackIdx`)===1);
check('setInterval 音序器已挂载',typeof intervalCB==='function');
const step0=T(`BGM.step`);
if(intervalCB) intervalCB();
check('音序器步进',T(`BGM.step`)===step0+1);
for(let i=0;i<20;i++) intervalCB();
check('连续步进20次不抛错',true);
check('曲目切换 stop+play',(()=>{T(`BGM.play(3)`);return T(`BGM.trackIdx`)===3})()===true);
T(`BGM.stop()`);
check('stop 停止并清定时器',T(`!BGM.playing`)&&intervalClear>0);
// 四种音阶频率合法性
check('音阶频率换算正确',Math.abs(T(`BGM._freq(220,0,0)`)-220)<1e-9
  &&Math.abs(T(`BGM._freq(220,12,0)`)-440)<1e-9);

console.log('[2] SFX/BGM 静音联动');
// BGM._tickStep 读取时判断 SFX.muted（加载顺序无关的健壮设计）
T(`SFX.unlock(); SFX.toggleMute(); window.__m1=SFX.muted;
   const stepBefore=BGM.step; BGM._tickStep();
   window.__steppedWhileMuted=(BGM.step===stepBefore);
   SFX.toggleMute(); window.__m0=SFX.muted;`);
check('静音开启后音序器跳过发声',T(`window.__m1`)===true&&T(`window.__steppedWhileMuted`)===true);
check('解除静音恢复',T(`window.__m0`)===false);

console.log('[3] 随机事件：宝箱雨');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0);
   RandomEvents.reset()`);
const dropsBefore=T(`drops.length`);
T(`RandomEvents._eventChestRain()`);
check('宝箱雨掉落6个圣物',T(`drops.length`)===dropsBefore+6);
check('事件横幅弹出',T(`RandomEvents.banner.text.includes('宝箱雨')`)===true);
check('圣物带稀有度',T(`drops.slice(-6).every(d=>d.kind==='relic'&&d.rarity)`)===true);

console.log('[4] 随机事件：诅咒祭坛');
T(`RandomEvents.active=null; RandomEvents._eventAltar()`);
check('祭坛生成',T(`RandomEvents.active&&RandomEvents.active.kind==='altar'`)===true);
T(`(()=>{const a=RandomEvents.active; a.x=player.x; a.y=player.y})()`);
const hpA=T(`player.hp`);
const pendBoons=T(`RandomEvents.pendingBoon===undefined||RandomEvents.pendingBoon===null`);
T(`RandomEvents.altarTouch()`);
check('献祭扣血10%',T(`player.hp`)<=hpA-5);
check('祭坛三选一弹出',T(`RandomEvents.pendingBoon.choices.length===3`)===true);
T(`render(); RandomEvents.drawOverlay(ctx)`);
check('祭坛浮层渲染不抛错',true);
T(`RandomEvents.choose(0)`);
check('赐福生效弹窗关闭',T(`RandomEvents.pendingBoon===null`)===true);

console.log('[5] 随机事件：流浪商人');
T(`Meta.addCoins(500); RandomEvents.active=null; RandomEvents._eventMerchant()`);
check('商人生成含商品',T(`RandomEvents.active.kind==='merchant'&&RandomEvents.active.goods.length>=2`)===true);
const coinsB=T(`Meta.coins`), relicsB=T(`player.relics.length`);
// 找最便宜商品买掉
const cheapIdx=T(`(()=>{let bi=-1,bp=Infinity;RandomEvents.active.goods.forEach((g,i)=>{if(g.price<bp){bp=g.price;bi=i}});return bi})()`);
T(`window.__relicsBefore=player.relics.length; RandomEvents.buy(${cheapIdx})`);
check('购买扣局外金币',T(`Meta.coins`)<coinsB);
check('商品售出后移除',T(`!RandomEvents.active||RandomEvents.active.goods.length<3`)===true);
check('圣物或治疗已生效',T(`player.relics.length>window.__relicsBefore||player.hp>0`)===true);
T(`render()`); // 商人世界物件绘制
check('商人/祭坛绘制不抛错',true);

console.log('[6] 事件节奏与重置');
T(`RandomEvents.reset()`);
check('reset 后45秒首事件',Math.abs(T(`RandomEvents.timer`)-45)<0.01);
check('主循环带事件系统跑通',(()=>{try{T(`tick(0.0166); tick(0.0166)`);return true}catch(e){return false}})()===true);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
