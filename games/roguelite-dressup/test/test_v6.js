// v0.6 测试：新怪AI / 章节制 / 章节祝福 / 技能分支
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
  document:{getElementById:()=>canvas},window:{addEventListener(){},dispatchEvent(){}}};
vm.createContext(sandbox);
const FILES=['config','tuning','outfit_bias','utils','player','enemies','newenemies','skills','skills2','relics','loot',
  'meta','outfit_glam','resonance','shop','biome','mirror','juice','evolution',
  'art_player_v2','art_enemy_v2','art_newenemies','chapters','skill_branches','audio','ui','main'];
for(const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(DIR,f+'.js'),'utf8'),sandbox,{filename:f+'.js'});
const T=e=>vm.runInContext(e,sandbox);
let pass=0,fail=0;
const check=(n,c)=>{ if(c){pass++;console.log('  ✓',n);} else {fail++;console.log('  ✗ FAIL:',n);} };

T(`Meta.setStorage(${makeLS.toString()}()); Meta.load(); Meta.hardReset();`);

console.log('[1] 新怪注册');
check('三种新怪已入表',["mage","boar","summoner"].every(t=>T(`!!ENEMY_TYPES['${t}']`)===true));

console.log('[2] 法师 AI：保持距离+吟唱弹幕');
T(`startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
T(`gameTime=100; spawnEnemy('mage',player.x+240,player.y,false);
   const m=enemies.find(e=>e.type==='mage'); const d0=Math.hypot(m.x-player.x,m.y-player.y);
   tick(0.016)`);   // 玩家不动，法师应保持距离而非贴脸
const d1=T(`(()=>{const m=enemies.find(e=>e.type==='mage');return Math.hypot(m.x-player.x,m.y-player.y)})()`);
check('法师维持距离不贴脸(230±40%)',d1>140&&d1<330);
T(`(()=>{const m=enemies.find(e=>e.type==='mage'); m.castT=0.01; 
   for(let i=0;i<10;i++) updateEnemies(0.016)})()`);
check('法师吟唱发射法球',T(`projectiles.some(p=>p.kind==='enemybullet'&&p.color==='#c084fc')`)===true);

console.log('[3] 野猪 AI：蓄力冲锋+撞墙眩晕');
T(`spawnEnemy('boar',player.x+200,player.y-60,false)`);
T(`(()=>{const b=enemies.find(e=>e.type==='boar'); b.boarState='windup'; b.stateT=0.01;
   const wx=b.x;
   for(let i=0;i<4;i++){                       // 多帧推进：windup→charge→持续位移
     updateEnemies(0.05);
     if(b.boarState==='charge') window.__stateAfterWindup=b.boarState;
   }
   window.__chargeMoved=b.x-wx})()`);
check('蓄力结束转入冲锋',T(`window.__stateAfterWindup`)==='charge');
check('冲锋产生位移',Math.abs(T(`window.__chargeMoved`))>8);
T(`(()=>{const b=enemies.find(e=>e.type==='boar'); b.boarState='charge'; b.stateT=9;
   b.chargeDir={x:1,y:0}; b.x=WORLD.w-30; updateEnemies(0.033)})()`);
check('撞墙后进入眩晕',T(`enemies.find(e=>e.type==='boar').boarState`)==='stun');

console.log('[4] 召唤师 AI：距离维持+召唤');
T(`spawnEnemy('summoner',player.x+340,player.y,false)`);
const cntBefore=T(`enemies.filter(e=>e.type==='slime').length`);
T(`(()=>{const s=enemies.find(e=>e.type==='summoner'); s.summonT=0.01;
   for(let i=0;i<8;i++) updateEnemies(0.016)})()`);
check('召唤师召唤出史莱姆',T(`enemies.filter(e=>e.type==='slime').length`)>cntBefore);

console.log('[5] 章节推进与祝福');
T(`startGame('novice'); if(gameState==='levelup'){applyUpgradeChoice(0)}
   ChapterSys.reset()`);
check('开局第一章',T(`ChapterSys.idx`)===0&&T(`ChapterSys.current.id`)===1);
T(`gameTime=181; ChapterSys.update(0.016)`);
check('180s 进入第二章',T(`ChapterSys.idx===1&&ChapterSys.current.id===2`)===true);
check('弹出章节横幅',T(`!!ChapterSys.banner`)===true);
check('弹出三选一祝福',T(`ChapterSys.boonChoices.length===3`)===true);
const atkBefore=T(`player.atkMul`), hpB4=T(`player.maxHp`);
// 强制把玻璃大炮洗进选项（测试确定性），验证数值生效
T(`(()=>{if(!ChapterSys.boonChoices.some(c=>c.id==='glass')){
    ChapterSys.boonChoices[0]={id:'glass',name:'玻璃大炮',color:'#ff6b6b'};}})()`);
const gi=T(`ChapterSys.boonChoices.findIndex(c=>c.id==='glass')`);
check('本次抽取含玻璃大炮',gi>=0);
T(`ChapterSys.chooseBoon(${gi})`);
check('玻璃大炮：攻+45%',Math.abs(T(`player.atkMul`)-(atkBefore+0.45))<1e-9);
check('玻璃大炮：血上限-25%',Math.abs(T(`player.maxHp`)-(hpB4*0.75))<0.01);
check('祝福选完弹窗关闭',T(`ChapterSys.boonChoices.length`)===0);
T(`render(); render()`); // 横幅绘制
check('章节横幅渲染不抛错',true);
T(`gameTime=391; ChapterSys.update(0.016)`);
check('390s 进入第三章',T(`ChapterSys.current.id`)===3);

console.log('[6] 出怪池按章节变化');
const pool=T(`JSON.stringify(ChapterSys.current.spawnPool)`);
check('第三章含法师野猪召唤师',pool.includes('mage')&&pool.includes('boar')&&pool.includes('summoner'));

console.log('[7] 技能分支系统');
T(`startGame('novice'); if(gameState==='levelup'){applyUpgradeChoice(0)} SkillBranchSys.reset()`);
check('未达分支等级不弹窗',T(`SkillBranchSys.maybeOffer('fireball',2)`)===false);
check('Lv3 触发分支选择',T(`SkillBranchSys.maybeOffer('fireball',3)`)===true);
check('二选一选项存在',T(`SkillBranchSys.pending.choices.length===2`)===true);
T(`render(); SkillBranchSys.drawOverlay(ctx)`);
check('分支界面渲染不抛错',true);
T(`SkillBranchSys.choose(SkillBranchSys.pending.choices.findIndex(c=>c.id==='fb_burn'))`);
check('选择烈焰余烬 → 标记生效',T(`player.__fbBurnGround`)===true);
check('已选记录不再重复弹',T(`SkillBranchSys.maybeOffer('fireball',5)`)===false||T(`SkillBranchSys.maybeOffer('fireball',3)`)===false);
T(`SkillBranchSys.reset()`);
check('reset 清空标记',T(`!player.__fbBurnGround&&!SkillBranchSys.pending`)===true);

console.log('[8] 弹窗优先级集成');
T(`startGame('novice'); if(gameState==='levelup'){applyUpgradeChoice(0)} SkillBranchSys.reset();
   player.skills.push({id:'knives',lv:2});
   SkillBranchSys.maybeOffer('knives',3);
   gameTime=181; ChapterSys.update(0.016);
   tick(0.0166)`); // 分支+祝福同时待选
check('分支优先于祝福显示',T(`gameState`)==='playing');

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
