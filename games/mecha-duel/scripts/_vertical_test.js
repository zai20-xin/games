// 垂直运动回归测试：验证跳跃/升龙能正常升空并回落（修复 jy-=vy 符号 bug）
const fs=require('fs'), vm=require('vm'), path=require('path');
let src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const mkCtx=()=>new Proxy(function(){return mkCtx();},{get:(t,k)=>mkCtx(),set:()=>true});
const canvas={width:960,height:540,getContext:()=>mkCtx()};
const mkNode=()=>({addEventListener:()=>{},dataset:{}});
const AC = function(){ this.state='running'; this.destination={}; };
AC.prototype.resume=function(){};
AC.prototype.createGain=function(){ return {gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}; };
AC.prototype.createOscillator=function(){ return {type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},stop(){},start(){}}; };
AC.prototype.createBiquadFilter=function(){ return {type:'',frequency:{value:0},connect(){}}; };
AC.prototype.createBuffer=function(){ return {getChannelData:()=>new Float32Array(10)}; };
AC.prototype.createBufferSource=function(){ return {connect(){},start(){},buffer:null}; };
const sb={console,Math,setTimeout,clearTimeout,performance:{now:()=>Date.now()},Image:class{},requestAnimationFrame:()=>{},
  window:{addEventListener:()=>{},AudioContext:AC,webkitAudioContext:AC},
  document:{getElementById:id=>id==='cv'?canvas:mkNode(),querySelectorAll:()=>[],addEventListener:()=>{}}};
const w=vm.createContext(sb); src+='\n;globalThis.__G=G;';
vm.runInContext(src,w,{filename:'game.js'}); const G=w.__G;

function stepN(n){ for(let i=0;i<n;i++){ G.step(1/60); G.fx.update(1/60); } }
let pass=true;
function check(name,cond){ console.log((cond?'PASS':'FAIL')+' — '+name); if(!cond)pass=false; }

// 先选择角色
G.state='charSelect';
G.charSelect.playerIdx=0; // 选择第一个角色
G.charSelect.enemyIdx=1;  // 选择第二个角色
G.startMatch(); // 开始比赛
stepN(120); G.state='battle';
const P=G.player;
// 测试1：普通跳跃应升空
P.onGround=true; P.vy=0; P.jy=0;
P.update(1/60, G.enemy, G, {dir:0,attack:false,defend:false,jump:true,skill:null});
stepN(15);
check('跳跃后升空 (jy>0)', P.jy>5);
const peak=P.jy;
stepN(120);
check('跳跃后回落地面 (jy==0 && onGround)', P.jy===0 && P.onGround===true);

// 测试2：升龙应升空（srd 状态）
G.enemy.x=P.x+40; P.x=300; P.y=0; P.jy=0; P.vy=0; P.onGround=true;
P.state='idle';
P.doSrd(G.enemy, G);
let maxJy=0;
for(let i=0;i<30;i++){ P.update(1/60, G.enemy, G, {dir:0,attack:false,defend:false,jump:false,skill:null}); maxJy=Math.max(maxJy,P.jy); }
check('升龙升空 (srd 上冲 jy>15)', maxJy>15);

console.log(pass?'\nALL OK':'\nSOME FAILED');
process.exit(pass?0:1);