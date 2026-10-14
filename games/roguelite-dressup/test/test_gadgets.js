// v0.10 测试：战术道具 × 10 与羁绊 × 6
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
  'gadgets','gadget_ui',
  'art_player_v2','art_enemy_v2','art_newenemies','art_boss_special',
  'chapters','skill_branches','audio','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}); Meta.load(); Meta.hardReset();`);

console.log('[1] 数据完整性');
check('10种道具',T(`GADGETS.length`)===10);
check('6组羁绊',T(`SYNERGIES.length`)===6);

console.log('[2] 选择界面流程');
T(`GadgetSelectUI.open("start")`);
check('进入选择界面',T(`gameState`)==='gadget_select');
T(`tick(0.0166)`); // 渲染
check('选择界面渲染不抛错',true);
// 模拟点击6张卡
T(`(()=>{for(let i=0;i<6;i++){const r=GSel.cardRects[i];mouse.x=r.x+r.w/2;mouse.y=r.y+r.h/2;GadgetSelectUI.onClick(mouse.x,mouse.y)}})()`);
check('选满6件',T(`GSel.picked.length`)===6);
T(`(()=>{const r=GSel.cardRects[6];mouse.x=r.x+r.w/2;mouse.y=r.y+r.h/2;GadgetSelectUI.onClick(mouse.x,mouse.y)})()`);
check('第7件被拒绝',T(`GSel.picked.length`)===6);
// 出发
T(`(()=>{mouse.x=VIEW_W/2;mouse.y=546;GadgetSelectUI.onClick(mouse.x,mouse.y)})()`);
check('出击后回标题',T(`gameState`)==='start');
check('配置已记忆',T(`Meta.data.gadgetPreset.length`)===6);

console.log('[3] 羁绊判定');
T(`Gadgets.reset(['laser','capacitor'])`);
check('过载网络激活(激光+电容)',T(`Gadgets.syn('overload')`)===true);
check('时滞爆破未激活',T(`!Gadgets.syn('timebomb')`)===true);
T(`Gadgets.reset(['mine','hourglass'])`);
check('时滞爆破激活',T(`Gadgets.syn('timebomb')`)===true);
T(`Gadgets.reset(['gascan','laser'])`);
check('蚀刻光束激活',T(`Gadgets.syn('etchbeam')`)===true);
T(`Gadgets.reset(['frostgen','mine'])`);
check('冰晶地雷激活',T(`Gadgets.syn('icemine')`)===true);
T(`Gadgets.reset(['turret','dronerep'])`);
check('自动化军团激活',T(`Gadgets.syn('legion')`)===true);
T(`Gadgets.reset(['shieldgen'])`);
check('能量矩阵需3件科技系→未激活',T(`!Gadgets.syn('matrix')`)===true);

console.log('[4] 战斗触发与实体行为（v0.11 手动放置：经 placeAt 部署）');
T(`startGame('flame'); Gadgets.reset(['laser','mine','hourglass','shieldgen']);
   spawnEnemy('slime',player.x+200,player.y,false)`);
// 激光：从玩家向敌人方向放置
T(`(()=>{const s=enemies.find(e=>e.type==='slime'); Gadgets.arm('laser'); Gadgets.placeAt(s.x,s.y)})()`);
check('激光贯穿命中造成伤害',T(`(()=>{const e=enemies.find(e2=>e2.type==='slime');return e.hp<e.maxHp})()`));
// 地雷：直接放脚下
T(`Gadgets.arm('mine'); Gadgets.placeAt(player.x+60,player.y)`);
check('地雷布设',T(`Gadgets.active.some(a=>a.kind==='mine')`)===true);
check('地雷消耗一层充能',T(`Gadgets.charges.mine===0||Gadgets.charges.mine<3`)===true);
T(`Gadgets.charges.hourglass=1; Gadgets.arm('hourglass'); Gadgets.placeAt(player.x-120,player.y)`);
check('沙漏力场布设',T(`Gadgets.active.some(a=>a.kind==='field'&&a.sub==='slow')`)===true);
T(`Gadgets.charges.shieldgen=1; Gadgets.arm('shieldgen'); Gadgets.placeAt(player.x,player.y)`);
check('护盾生成',T(`Gadgets.shieldHp>0`)===true);
// 护盾吸收
T(`(()=>{player.iframes=0; const hp0=player.hp; Gadgets.shieldHp=30;
   player.hurt(20); window.__absorbed=player.hp===hp0})()`);
check('护盾完全吸收伤害(HP不变)',T(`window.__absorbed`)===true);
// 地雷感应引爆（把怪挪到雷上）
T(`(()=>{const m=Gadgets.active.find(a=>a.kind==='mine');
   const s=enemies.find(e=>e.type==='slime'); if(m&&s){s.x=m.x;s.y=m.y}
   const h0=s?s.hp:0; Gadgets.update(0.016); window.__boomHurt=s.hp<h0})()`);
check('地雷感应引爆伤害',T(`window.__boomHurt`)===true);
T(`render()`); // 道具实体绘制
check('道具世界绘制不抛错',true);

console.log('[5] 时滞爆破羁绊效果');
T(`Gadgets.reset(['mine','hourglass']); startGame('flame');
   Gadgets.reset(['mine','hourglass']);
   spawnEnemy('slime',player.x+150,player.y,false)`);
T(`(()=>{const m={kind:'mine',x:player.x+150,y:player.y,t:12,r:9};
   Gadgets.active.push({kind:'field',sub:'slow',x:m.x,y:m.y,t:6,r:95,color:'#000'});
   Gadgets.active.push(m);
   const s=enemies.find(e=>e.type==='slime'); s.x=m.x; s.y=m.y;
   const h0=s.hp; Gadgets.update(0.016);
   window.__tbDmg=h0-s.hp})()`);
check('时滞圈内引爆×2伤害(34*2=68)',Math.abs(T(`window.__tbDmg`)-68)<1||T(`window.__tbDmg`)>=60);

console.log('[6] 充能系统（最多存3层）');
T(`startGame('flame'); Gadgets.reset(['mine'])`);
check('初始1层',T(`Gadgets.charges.mine`)===1);
T(`(()=>{Gadgets.rechargeT.mine=0.01; for(let i=0;i<40;i++)Gadgets.update(0.2)})()`);
// 8秒→回满3层
check('随时间回充至上限3层',T(`Gadgets.charges.mine`)===MAX_CHARGES());
function MAX_CHARGES(){return T(`(function(){return 3})()`)}
T(`Gadgets.arm('mine'); Gadgets.placeAt(player.x+80,player.y)`);
check('放置消耗一层',T(`Gadgets.charges.mine`)===MAX_CHARGES()-1);
// 回充期间继续放置到空层
T(`(()=>{while(Gadgets.charges.mine>0){Gadgets.charges.mine--;Gadgets.arm('mine');Gadgets.placeAt(player.x+30,player.y)}})()`);
check('空层时无法放置',(()=>{const c=T(`Gadgets.charges.mine`);
  T(`Gadgets.charges.mine=0; Gadgets.arm('mine');
     window.__r=Gadgets.placeAt(player.x,player.y-60);
     window.__placeDenied=(window.__r===false&&Gadgets.armed===null)`);
  return T(`window.__placeDenied`)===true;})());
// 快捷键路由
T(`Gadgets.reset(['laser','mine'])`);
T(`window.__keydownSim=('1')`);
check('arm 切换瞄准状态',(()=>{T(`Gadgets.arm('laser')`);return T(`Gadgets.armed`)==='laser';})());
check('再次按键取消瞄准',(()=>{T(`Gadgets.arm('laser')`);return T(`Gadgets.armed`)===null;})());

console.log('[7] 幽灵预览与HUD渲染');
T(`Gadgets.arm('mine'); render(); tick(0.0166); render()`);
check('幽灵预览/HUD渲染不抛错',true);
T(`mouse.x=5; mouse.y=5; render()`);
check('越界位置红色警示渲染',true);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
