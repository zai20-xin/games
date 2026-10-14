// ===================== Coastal Skate · 主模块 =====================
import { CFG } from './config.js';
import { rand, randInt, clamp, lerp, PI, TAU, lerpColor } from './utils.js';
import { Audio2 } from './audio.js';
import { loadBest, saveBest, loadSettings, saveSettings } from './save.js';

// ===================== Canvas =====================
const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d');
let W=0,H=0,GROUND_Y=0,DPR=1;
function resize(){DPR=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;H=window.innerHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);GROUND_Y=H*CFG.GROUND_RATIO}
window.addEventListener('resize',resize);resize();

// ===================== Game State =====================
let state='menu',score=0,distance=0,shells=0,bestScore=loadBest(),speed=CFG.BASE_SPEED,scrollX=0,frameCount=0,spawnTimer=0,nextSpawn=CFG.SPAWN_MIN,screenShake=0,dayProgress=0,lastMilestone=0;
let obstacles=[],collectibles=[],enemies=[],powerups=[],springs=[],particles=[],floatTexts=[];
let clouds=[],mountains=[],trees=[],birds=[],foamPatches=[],waveOffset=0,roadOffset=0,speedLineOffset=0;
let combo=0,comboTimer=0,maxCombo=0;
let boat={x:0,init:false};
let isJumpHeld=false;
const char={y:0,vy:0,onGround:true,rotation:0,runFrame:0,hairWave:0,health:CFG.MAX_HEALTH,invincible:0,jumpsLeft:2,dashTimer:0,dashCooldown:0,magnetTimer:0,shield:false,doubleScoreTimer:0,speedBoostTimer:0,slideTimer:0};

// ===================== Init Scenery =====================
function initScenery(){
clouds=[];for(let i=0;i<12;i++)clouds.push({x:rand(0,W*2.5),y:rand(20,H*0.32),scale:rand(0.5,1.4),speed:rand(0.08,0.22),puffs:genCloudPuffs(rand(5,9))});
mountains=[];for(let i=0;i<8;i++)mountains.push({x:i*200+rand(-30,30),h:rand(80,160),w:rand(180,300),color:i%2==0?'#3A5A4E':'#4A6A5A',layer:i<4?0:1});
trees=[];for(let i=0;i<30;i++){const l=randInt(0,2);trees.push({x:rand(0,W*3),h:rand(40,80)*(1-l*0.25),type:randInt(0,2),sway:rand(0,TAU),layer:l})}
birds=[];for(let i=0;i<5;i++)birds.push({x:rand(0,W),y:rand(40,H*0.25),speed:rand(0.3,0.6),flap:rand(0,TAU),size:rand(6,10)});
foamPatches=[];for(let i=0;i<20;i++)foamPatches.push({x:rand(0,W*2),w:rand(15,50),a:rand(0.3,0.7)});
boat={x:W*0.4,init:true};
}
function genCloudPuffs(n){const p=[];for(let i=0;i<n;i++)p.push({x:(i/n-0.5)*80+rand(-10,10),y:rand(-15,10),r:rand(20,40)});return p}
initScenery();

// ===================== Background =====================
function getSkyColors(t){const ph=[['#5B9BD5','#87CEEB','#C6E2FF'],['#4A90D9','#7EC8E3','#B0E0E6'],['#6A8EBF','#9DB4D8','#E8C4A8'],['#4A6B8A','#7B9AB5','#D4A574']];const c=t%4,i=Math.floor(c),n=(i+1)%4,f=c-i;return[lerpColor(ph[i][0],ph[n][0],f),lerpColor(ph[i][1],ph[n][1],f),lerpColor(ph[i][2],ph[n][2],f)]}
function drawSky(t){const[top,mid,hor]=getSkyColors(dayProgress);const g=ctx.createLinearGradient(0,0,0,GROUND_Y);g.addColorStop(0,top);g.addColorStop(0.5,mid);g.addColorStop(1,hor);ctx.fillStyle=g;ctx.fillRect(0,0,W,GROUND_Y+2);const sx=W*0.72,sy=H*0.16;const gl=ctx.createRadialGradient(sx,sy,0,sx,sy,160);gl.addColorStop(0,'rgba(255,248,200,0.5)');gl.addColorStop(0.5,'rgba(255,230,150,0.15)');gl.addColorStop(1,'rgba(255,230,150,0)');ctx.fillStyle=gl;ctx.fillRect(sx-160,sy-160,320,320);ctx.fillStyle='rgba(255,250,220,0.95)';ctx.beginPath();ctx.arc(sx,sy,35,0,TAU);ctx.fill();ctx.save();ctx.translate(sx,sy);ctx.rotate(t*0.0003);for(let i=0;i<8;i++){ctx.rotate(TAU/8);ctx.fillStyle='rgba(255,248,200,0.06)';ctx.beginPath();ctx.moveTo(0,-40);ctx.lineTo(-15,-120);ctx.lineTo(15,-120);ctx.fill()}ctx.restore()}
function drawGhibliCloud(cx,cy,s,ps){ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);ctx.fillStyle='rgba(160,175,190,0.25)';for(const p of ps){ctx.beginPath();ctx.arc(p.x,p.y+8,p.r*0.95,0,TAU);ctx.fill()}ctx.fillStyle='rgba(255,255,255,0.92)';for(const p of ps){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill()}ctx.fillStyle='rgba(255,255,255,0.6)';for(const p of ps){ctx.beginPath();ctx.arc(p.x-p.r*0.2,p.y-p.r*0.3,p.r*0.5,0,TAU);ctx.fill()}ctx.restore()}
function drawClouds(dt){for(const c of clouds){c.x-=speed*c.speed*dt;if(c.x<-150)c.x=W+rand(50,300);drawGhibliCloud(c.x,c.y,c.scale,c.puffs)}}
function drawMountains(dt){for(const m of mountains){const px=m.layer===0?0.12:0.2;m.x-=speed*px*dt;if(m.x<-m.w-50){m.x=W+rand(0,200);m.h=rand(80,160);m.w=rand(180,300)}const dx=m.x,by=GROUND_Y-H*0.02,a=m.layer===0?0.5:0.7;ctx.fillStyle=m.color;ctx.globalAlpha=a;ctx.beginPath();ctx.moveTo(dx,by);ctx.lineTo(dx+m.w*0.15,by-m.h*0.5);ctx.lineTo(dx+m.w*0.3,by-m.h*0.7);ctx.lineTo(dx+m.w*0.5,by-m.h);ctx.lineTo(dx+m.w*0.7,by-m.h*0.65);ctx.lineTo(dx+m.w*0.85,by-m.h*0.4);ctx.lineTo(dx+m.w,by);ctx.closePath();ctx.fill();ctx.globalAlpha=a*0.8;ctx.fillStyle='rgba(255,255,255,0.6)';ctx.beginPath();ctx.moveTo(dx+m.w*0.35,by-m.h*0.78);ctx.lineTo(dx+m.w*0.5,by-m.h);ctx.lineTo(dx+m.w*0.65,by-m.h*0.72);ctx.quadraticCurveTo(dx+m.w*0.5,by-m.h*0.65,dx+m.w*0.35,by-m.h*0.78);ctx.fill()}ctx.globalAlpha=1}
function drawDistantTown(){const ty=GROUND_Y-H*0.025;ctx.save();ctx.globalAlpha=0.18;const ts=(scrollX*0.18)%600;for(let c=0;c<2;c++){const bx=c*600-ts;ctx.fillStyle='#3A5A6A';for(let i=0;i<8;i++){const x=bx+i*70,bh=15+(i*37)%25;ctx.fillRect(x,ty-bh,50,bh);ctx.beginPath();ctx.moveTo(x-2,ty-bh);ctx.lineTo(x+25,ty-bh-6);ctx.lineTo(x+52,ty-bh);ctx.closePath();ctx.fill()}}ctx.restore()}
function drawSpeedLines(dt){if(speed<7)return;const i=clamp((speed-7)/5,0,1);speedLineOffset+=speed*dt*2;ctx.strokeStyle=`rgba(255,255,255,${0.12*i})`;ctx.lineWidth=1.5;const n=Math.floor(10*i);for(let i2=0;i2<n;i2++){const s=i2*137.5,y=H*0.15+((s*73)%(H*0.55)),len=30+(s%40),x=((s+speedLineOffset)%(W+100))-50;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-len,y);ctx.stroke()}}
function drawBoat(dt){if(!boat.init){boat.x=W*0.4;boat.init=true}boat.x-=speed*0.05*dt;if(boat.x<-60)boat.x=W+rand(100,400);const ot=GROUND_Y-H*0.05,by=ot+4;ctx.fillStyle='rgba(255,255,255,0.7)';ctx.beginPath();ctx.moveTo(boat.x-12,by);ctx.lineTo(boat.x+12,by);ctx.lineTo(boat.x+8,by+4);ctx.lineTo(boat.x-8,by+4);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(255,250,240,0.8)';ctx.beginPath();ctx.moveTo(boat.x,by);ctx.lineTo(boat.x,by-16);ctx.lineTo(boat.x+8,by-2);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(120,100,80,0.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(boat.x,by);ctx.lineTo(boat.x,by-17);ctx.stroke()}
function drawOcean(dt){const ot=GROUND_Y-H*0.05,oh=H*0.08;const g=ctx.createLinearGradient(0,ot,0,ot+oh);g.addColorStop(0,'#48D1CC');g.addColorStop(0.5,'#20B2AA');g.addColorStop(1,'#1E6FA8');ctx.fillStyle=g;ctx.fillRect(0,ot,W,oh+2);waveOffset+=speed*0.3*dt;ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1.5;for(let r=0;r<4;r++){const y=ot+4+r*(oh/5);ctx.beginPath();for(let x=0;x<=W;x+=8){const wy=y+Math.sin((x+waveOffset*(1+r*0.3))*0.02)*2.5;if(x===0)ctx.moveTo(x,wy);else ctx.lineTo(x,wy)}ctx.stroke()}const srx=W*0.72;const rg=ctx.createLinearGradient(0,ot,0,ot+oh);rg.addColorStop(0,'rgba(255,240,200,0.35)');rg.addColorStop(1,'rgba(255,240,200,0)');ctx.fillStyle=rg;ctx.beginPath();ctx.moveTo(srx-8,ot);ctx.lineTo(srx+8,ot);ctx.lineTo(srx+30,ot+oh);ctx.lineTo(srx-30,ot+oh);ctx.closePath();ctx.fill();for(let i=0;i<5;i++){const sy=ot+i*(oh/6),sw=10+i*6,fl=Math.sin(frameCount*0.1+i*1.5)*0.5+0.5;ctx.fillStyle=`rgba(255,250,220,${0.15*fl})`;ctx.fillRect(srx-sw,sy-1,sw*2,2)}for(const f of foamPatches){f.x-=speed*0.4*dt;if(f.x<-60)f.x=W+rand(50,200);ctx.fillStyle=`rgba(240,255,255,${f.a})`;ctx.beginPath();ctx.ellipse(f.x,ot+2,f.w/2,3,0,0,TAU);ctx.fill()}ctx.fillStyle='rgba(255,255,255,0.5)';for(let i=0;i<10;i++){const sx2=((i*137+waveOffset*0.5)%W+W)%W,sy2=ot+3+((i*53)%(oh-6)),tw=Math.sin(frameCount*0.08+i*1.7);if(tw>0.3){ctx.fillRect(sx2,sy2,tw>0.8?2.5:1.5,1)}}}
function drawBeach(){const bt=GROUND_Y-H*0.005,bh=H*0.02;const g=ctx.createLinearGradient(0,bt,0,bt+bh);g.addColorStop(0,'#F5DEB3');g.addColorStop(1,'#DEB887');ctx.fillStyle=g;ctx.fillRect(0,bt,W,bh+2)}
function drawBirds(dt){for(const b of birds){b.x-=b.speed*dt;b.flap+=dt*0.15;if(b.x<-20)b.x=W+rand(50,200);const wy=Math.sin(b.flap)*4;ctx.strokeStyle='rgba(60,60,80,0.5)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(b.x-b.size,b.y+wy);ctx.quadraticCurveTo(b.x-b.size*0.4,b.y-2+wy,b.x,b.y);ctx.quadraticCurveTo(b.x+b.size*0.4,b.y-2+wy,b.x+b.size,b.y+wy);ctx.stroke()}}
function drawRoad(dt){const rt=GROUND_Y,rh=H-GROUND_Y;const g=ctx.createLinearGradient(0,rt,0,H);g.addColorStop(0,'#3C3C44');g.addColorStop(0.5,'#2E2E34');g.addColorStop(1,'#1E1E24');ctx.fillStyle=g;ctx.fillRect(0,rt,W,rh);
// Bright boundary lines - amber
ctx.fillStyle='rgba(255,200,80,0.9)';ctx.fillRect(0,rt-3,W,4);ctx.fillStyle='rgba(255,180,50,0.4)';ctx.fillRect(0,rt+1,W,2);
roadOffset+=speed*dt;ctx.fillStyle='rgba(255,215,0,0.5)';const dl=30,gl=40,tt=dl+gl,off=roadOffset%tt,my=rt+rh*0.15;for(let x=-off;x<W;x+=tt)ctx.fillRect(x,my,dl,3);
ctx.fillStyle='rgba(0,0,0,0.08)';for(let i=0;i<30;i++){const tx=(i*53+roadOffset*0.7)%W,ty=rt+10+(i*31)%(rh-20);ctx.fillRect(tx,ty,2,1)}}
function drawTrees(dt){const sorted=[...trees].sort((a,b)=>a.layer-b.layer);for(const t of sorted){const px=[0.35,0.6,1.0][t.layer];t.x-=speed*px*dt;if(t.x<-60){t.x=W+rand(30,200);t.type=randInt(0,2);t.h=rand(40,80)*(1-t.layer*0.25);t.sway=rand(0,TAU)}if(t.x>W+60)continue;const by=GROUND_Y+[0,5,15][t.layer],sw=Math.sin(frameCount*0.02+t.sway)*2;ctx.globalAlpha=t.layer===2?0.35:t.layer===1?0.55:0.8;if(t.type===0)drawPalm(t.x,by,t.h,sw);else if(t.type===1)drawBush(t.x,by,t.h,sw);else drawFlower(t.x,by,t.h,sw)}ctx.globalAlpha=1}
function drawPalm(x,by,h,sw){ctx.strokeStyle='#4A3828';ctx.lineWidth=Math.max(3,h*0.06);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,by);ctx.quadraticCurveTo(x+sw*0.5,by-h*0.5,x+sw,by-h);ctx.stroke();ctx.fillStyle='#1A4A2A';const lx=x+sw,ly=by-h;for(let i=0;i<6;i++){const a=(i/6)*PI-PI*0.1,ll=h*0.45;ctx.save();ctx.translate(lx,ly);ctx.rotate(a+sw*0.02);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(ll*0.3,-ll*0.15,ll,0);ctx.quadraticCurveTo(ll*0.3,ll*0.12,0,2);ctx.fill();ctx.restore()}ctx.fillStyle='#3A2818';ctx.beginPath();ctx.arc(lx-3,ly+2,3,0,TAU);ctx.arc(lx+2,ly+4,3,0,TAU);ctx.fill()}
function drawBush(x,by,h,sw){ctx.fillStyle='#1A3A1A';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(x+(i-1)*h*0.2+sw,by-h*0.2,h*0.25,0,TAU);ctx.fill()}ctx.fillStyle='#2A4A2A';ctx.beginPath();ctx.arc(x-h*0.1+sw,by-h*0.28,h*0.15,0,TAU);ctx.fill()}
function drawFlower(x,by,h,sw){}
function drawForegroundGrass(){const go=(scrollX*1.2)%80;ctx.fillStyle='#2A4A1A';for(let x=-go;x<W;x+=80){const s=Math.floor((x+go)/80),h=8+(s*37)%12,sw=Math.sin(frameCount*0.03+s)*3;ctx.beginPath();ctx.moveTo(x,H);ctx.quadraticCurveTo(x+sw*0.5,H-h*0.6,x+sw,H-h);ctx.lineTo(x+2,H-h*0.8);ctx.quadraticCurveTo(x+sw*0.5+2,H-h*0.5,x+2,H);ctx.fill();ctx.beginPath();ctx.moveTo(x+5,H);ctx.quadraticCurveTo(x+5+sw*0.4,H-h*0.7,x+5+sw,H-h*0.9);ctx.lineTo(x+7,H-h*0.7);ctx.quadraticCurveTo(x+5+sw*0.4+2,H-h*0.5,x+7,H);ctx.fill()}}

// ===================== Character =====================
function drawCharacter(dt){
const cx=W*CFG.CHAR_X,cy=GROUND_Y+char.y;
ctx.save();ctx.translate(cx,cy);ctx.rotate(char.rotation);
const bob=char.onGround?Math.sin(char.runFrame*0.3)*1.2:0;ctx.translate(0,bob);
if(char.slideTimer>0){ctx.scale(1,0.4)}
// Invincibility blink
if(char.invincible>0&&Math.floor(frameCount/4)%2===0){ctx.globalAlpha=0.4}
// Shadow
if(char.onGround){ctx.fillStyle='rgba(0,0,0,0.22)';ctx.beginPath();ctx.ellipse(0,2,30,5,0,0,TAU);ctx.fill()}
else{const hf=clamp(1-Math.abs(char.y)/150,0.25,1);ctx.fillStyle=`rgba(0,0,0,${0.22*hf})`;ctx.beginPath();ctx.ellipse(0,-char.y+2,30*hf,4*hf,0,0,TAU);ctx.fill()}
// Shield bubble
if(char.shield){ctx.strokeStyle='rgba(100,200,255,0.6)';ctx.lineWidth=2;ctx.fillStyle='rgba(100,200,255,0.12)';ctx.beginPath();ctx.arc(0,-28,32,0,TAU);ctx.fill();ctx.stroke();ctx.strokeStyle='rgba(150,220,255,0.4)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-28,28,0,TAU);ctx.stroke()}
// Magnet aura
if(char.magnetTimer>0){ctx.strokeStyle=`rgba(255,200,50,${0.2+Math.sin(frameCount*0.1)*0.1})`;ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,-28,50,0,TAU);ctx.stroke();ctx.setLineDash([])}
// Dash trail
if(char.dashTimer>0){ctx.fillStyle='rgba(100,200,255,0.2)';for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(-15-i*12,-28,12,20,0,0,TAU);ctx.fill()}}
const by=-2;
// Longboard
ctx.fillStyle='#D2691E';ctx.beginPath();ctx.ellipse(0,by,28,4,0,0,TAU);ctx.fill();ctx.fillStyle='#A0522D';ctx.beginPath();ctx.ellipse(0,by+1,28,3,0,0,TAU);ctx.fill();
ctx.fillStyle='#333';ctx.beginPath();ctx.arc(-18,by+4,3,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(18,by+4,3,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(-8,by+4,3,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(8,by+4,3,0,TAU);ctx.fill();
// Legs
ctx.strokeStyle='#3A5A80';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-5,by-2);ctx.lineTo(-12,by-22);ctx.lineTo(-18,by-2);ctx.stroke();ctx.fillStyle='#2F2F2F';ctx.beginPath();ctx.ellipse(-18,by,6,3,0,0,TAU);ctx.fill();
ctx.strokeStyle='#4A6FA5';ctx.beginPath();ctx.moveTo(5,by-2);ctx.lineTo(12,by-24);ctx.lineTo(20,by-2);ctx.stroke();ctx.fillStyle='#2F2F2F';ctx.beginPath();ctx.ellipse(20,by,6,3,0,0,TAU);ctx.fill();
// Torso
ctx.fillStyle='#F5F5F5';ctx.beginPath();ctx.moveTo(-8,by-22);ctx.lineTo(-6,by-48);ctx.lineTo(8,by-50);ctx.lineTo(10,by-22);ctx.closePath();ctx.fill();ctx.fillStyle='#5BA3D0';ctx.fillRect(-8,by-24,18,3);ctx.fillStyle='rgba(0,0,0,0.05)';ctx.beginPath();ctx.moveTo(-8,by-22);ctx.lineTo(-6,by-48);ctx.lineTo(-2,by-48);ctx.lineTo(-4,by-22);ctx.closePath();ctx.fill();
// Arms
ctx.strokeStyle='#F5F5F5';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-4,by-40);ctx.lineTo(-14,by-32);ctx.lineTo(-20,by-28);ctx.stroke();ctx.fillStyle='#FFCBA4';ctx.beginPath();ctx.arc(-20,by-28,2.5,0,TAU);ctx.fill();
ctx.strokeStyle='#F5F5F5';ctx.beginPath();ctx.moveTo(4,by-42);ctx.lineTo(14,by-36);ctx.lineTo(22,by-32);ctx.stroke();ctx.fillStyle='#FFCBA4';ctx.beginPath();ctx.arc(22,by-32,2.5,0,TAU);ctx.fill();
// Head
const hx=4,hy=by-58;ctx.strokeStyle='#FFCBA4';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(2,by-48);ctx.lineTo(hx,hy+8);ctx.stroke();
ctx.fillStyle='#FFCBA4';ctx.beginPath();ctx.arc(hx,hy,10,0,TAU);ctx.fill();
// Rosy cheeks
ctx.fillStyle='rgba(255,150,150,0.45)';ctx.beginPath();ctx.arc(hx-4,hy+2,2.5,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(hx+8,hy+2,2.5,0,TAU);ctx.fill();
// Eyes - cute round
ctx.fillStyle='#2A2A3E';ctx.beginPath();ctx.arc(hx+2,hy-1,1.8,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(hx+7,hy-1,1.8,0,TAU);ctx.fill();
ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx+2.5,hy-1.5,0.6,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(hx+7.5,hy-1.5,0.6,0,TAU);ctx.fill();
// Smile
ctx.strokeStyle='#C97B63';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(hx+5,hy+3,2.5,0.15*PI,0.85*PI);ctx.stroke();
// Hair - cute bob with ponytail, warm brown
char.hairWave+=dt*0.06*(speed/5);
const HC='#6B4836',HC2='#5C3D2E',HC3='#7A5544';
// Back hair - short bob shape
ctx.fillStyle=HC2;ctx.beginPath();ctx.moveTo(hx-9,hy-6);ctx.bezierCurveTo(hx-13,hy-2,hx-12,hy+8,hx-8,hy+8);ctx.bezierCurveTo(hx-4,hy+8,hx-1,hy+6,hx+1,hy+6);ctx.lineTo(hx+1,hy-6);ctx.closePath();ctx.fill();
// Top hair
ctx.fillStyle=HC;ctx.beginPath();ctx.arc(hx,hy-4,11,PI*1.05,PI*1.95);ctx.lineTo(hx+9,hy-2);ctx.bezierCurveTo(hx+6,hy-8,hx-4,hy-9,hx-9,hy-6);ctx.closePath();ctx.fill();
// Bangs
ctx.fillStyle=HC3;ctx.beginPath();ctx.moveTo(hx-8,hy-6);ctx.quadraticCurveTo(hx-4,hy-2,hx,hy-4);ctx.quadraticCurveTo(hx+4,hy-6,hx+9,hy-2);ctx.quadraticCurveTo(hx+8,hy-9,hx+2,hy-10);ctx.quadraticCurveTo(hx-5,hy-9,hx-8,hy-6);ctx.closePath();ctx.fill();
// Ponytail - short with gentle wave
const pw=Math.sin(char.hairWave)*2.5;
ctx.strokeStyle=HC;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(hx-7,hy-3);ctx.quadraticCurveTo(hx-14+pw,hy+4+pw,hx-19+pw*1.5,hy+14+pw);ctx.stroke();
ctx.fillStyle=HC3;ctx.beginPath();ctx.ellipse(hx-19+pw*1.5,hy+15+pw,3,4,0.2,0,TAU);ctx.fill();
// Headband - cute pink
ctx.fillStyle='#FF7B9C';ctx.beginPath();ctx.ellipse(hx+2,hy-7,10,3,0,0,TAU);ctx.fill();
ctx.fillStyle='#FF9DBA';ctx.beginPath();ctx.ellipse(hx+2,hy-7.5,10,2,0,0,TAU);ctx.fill();
ctx.fillStyle='#FF6B8C';ctx.beginPath();ctx.arc(hx-7,hy-7,2.5,0,TAU);ctx.fill();
// Speed lines (subtle, only when fast)
if(speed>6){const sa=clamp((speed-6)/6,0,0.1);ctx.strokeStyle=`rgba(180,200,255,${sa})`;ctx.lineWidth=1.5;for(let i=0;i<3;i++){const sy2=by-25+i*10;ctx.beginPath();ctx.moveTo(-20,sy2);ctx.lineTo(-42,sy2);ctx.stroke()}}
ctx.restore();
}

// ===================== Obstacles =====================
function drawObstacle(o){const y=GROUND_Y;ctx.save();ctx.translate(o.x,y);
// White backplate - separates from dark background
ctx.fillStyle='rgba(255,250,240,0.2)';ctx.beginPath();ctx.ellipse(0,-o.h*0.4,o.w*0.85,o.h*0.75,0,0,TAU);ctx.fill();
// Shadow
ctx.fillStyle='rgba(0,0,0,0.35)';ctx.beginPath();ctx.ellipse(0,3,o.w*0.55,5,0,0,TAU);ctx.fill();
// Danger glow - pulsing red
const pu=Math.sin(frameCount*0.06)*0.5+0.5;ctx.fillStyle=`rgba(255,50,30,${0.18+pu*0.12})`;ctx.beginPath();ctx.ellipse(0,-o.h*0.4,o.w*0.8,o.h*0.7,0,0,TAU);ctx.fill();
const OL='#0a0a14',OLW=3;
switch(o.type){
case 0:ctx.fillStyle='#C0392B';ctx.beginPath();ctx.moveTo(-o.w/2,0);ctx.lineTo(-o.w*0.35,-o.h*0.5);ctx.lineTo(-o.w*0.15,-o.h*0.85);ctx.lineTo(o.w*0.2,-o.h);ctx.lineTo(o.w*0.4,-o.h*0.65);ctx.lineTo(o.w/2,0);ctx.closePath();ctx.fill();ctx.strokeStyle=OL;ctx.lineWidth=OLW;ctx.stroke();ctx.fillStyle='#E74C3C';ctx.beginPath();ctx.moveTo(-o.w*0.2,-o.h*0.3);ctx.lineTo(-o.w*0.1,-o.h*0.7);ctx.lineTo(o.w*0.1,-o.h*0.55);ctx.lineTo(o.w*0.05,-o.h*0.25);ctx.closePath();ctx.fill();ctx.strokeStyle='#7A1A12';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-o.w*0.1,-o.h*0.7);ctx.lineTo(0,-o.h*0.3);ctx.moveTo(o.w*0.15,-o.h*0.6);ctx.lineTo(o.w*0.25,-o.h*0.2);ctx.stroke();break;
case 1:ctx.strokeStyle='#6A4028';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-o.h);ctx.stroke();ctx.fillStyle='#E74C3C';ctx.beginPath();ctx.ellipse(0,-o.h,o.w/2,16,0,PI,TAU);ctx.fill();ctx.strokeStyle=OL;ctx.lineWidth=OLW;ctx.stroke();ctx.fillStyle='#FF6B5E';ctx.beginPath();ctx.ellipse(0,-o.h,o.w/2*0.85,11,0,PI,TAU);ctx.fill();ctx.fillStyle='#FFF8F0';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.ellipse(0,-o.h,o.w*0.08,16,0,PI*(0.4+i*0.2),PI*(0.5+i*0.2));ctx.fill()}ctx.fillStyle='#6A4028';ctx.beginPath();ctx.arc(0,-o.h-14,3,0,TAU);ctx.fill();break;
case 2:ctx.fillStyle='#C0392B';ctx.save();ctx.translate(0,-o.h/2);ctx.rotate(0.12);ctx.beginPath();ctx.ellipse(0,0,o.w/2,o.h/3.5,0,0,TAU);ctx.fill();ctx.strokeStyle=OL;ctx.lineWidth=OLW;ctx.stroke();ctx.fillStyle='#E74C3C';ctx.beginPath();ctx.ellipse(0,o.h/12,o.w/2*0.9,o.h/5,0,0,TAU);ctx.fill();ctx.strokeStyle='#7A1A12';ctx.lineWidth=1.5;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(-o.w/2+4,i*3);ctx.lineTo(o.w/2-4,i*3);ctx.stroke()}ctx.fillStyle='#7A1A12';ctx.beginPath();ctx.arc(-o.w*0.2,-2,2.5,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(o.w*0.15,1,2,0,TAU);ctx.fill();ctx.restore();break;
case 3:ctx.fillStyle='#E67E22';ctx.beginPath();ctx.moveTo(0,-o.h);ctx.lineTo(-o.w/2,0);ctx.lineTo(o.w/2,0);ctx.closePath();ctx.fill();ctx.strokeStyle=OL;ctx.lineWidth=OLW;ctx.stroke();ctx.fillStyle='#F39C12';ctx.beginPath();ctx.moveTo(0,-o.h);ctx.lineTo(-o.w*0.3,-o.h*0.5);ctx.lineTo(0,-o.h*0.4);ctx.closePath();ctx.fill();ctx.fillStyle='#FFF';ctx.fillRect(-o.w*0.38,-o.h*0.65,o.w*0.76,4);ctx.fillRect(-o.w*0.3,-o.h*0.35,o.w*0.6,3.5);ctx.fillStyle='#7A4A0A';ctx.beginPath();ctx.ellipse(0,0,o.w/2,3,0,0,TAU);ctx.fill();break;
case 4:
// Ground slide zone
ctx.fillStyle='rgba(255,50,30,0.2)';ctx.fillRect(-o.w/2-6,0,o.w+12,10);
ctx.fillStyle='rgba(255,215,0,0.35)';ctx.fillRect(-o.w/2-3,0,o.w+6,4);
// Thin support posts - semi-transparent
ctx.fillStyle='rgba(120,40,20,0.4)';ctx.fillRect(-o.w/2,-o.h,4,o.h);ctx.fillRect(o.w/2-4,-o.h,4,o.h);
// Clearance zone - translucent showing slide-through space
ctx.fillStyle='rgba(100,200,255,0.08)';ctx.fillRect(-o.w/2+4,-o.h+18,o.w-8,o.h-18);
// Down chevrons showing slide direction
ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=2;ctx.lineCap='round';
for(let j=0;j<2;j++){const cy2=-o.h*0.6+j*12;ctx.beginPath();ctx.moveTo(-8,cy2-3);ctx.lineTo(0,cy2+3);ctx.lineTo(8,cy2-3);ctx.stroke()}
// Horizontal bar - the actual barrier at top
for(let i=0;i<6;i++){ctx.fillStyle=i%2===0?'#E74C3C':'#FFD700';ctx.fillRect(-o.w/2+i*(o.w/6),-o.h,o.w/6,18)}
ctx.strokeStyle=OL;ctx.lineWidth=OLW;ctx.strokeRect(-o.w/2,-o.h,o.w,18);
// Pulsing glow on bar
ctx.fillStyle=`rgba(255,50,30,${0.1+pu*0.1})`;ctx.fillRect(-o.w/2-4,-o.h-4,o.w+8,26);
// Slide hint in the gap below the bar
ctx.fillStyle='#fff';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('\u6ED1\u94F2',0,-o.h*0.45);
break}
// Warning marker (skip for type 4 - has its own slide hint)
if(o.type!==4){
const wy=-o.h-18+Math.sin(frameCount*0.1)*3;
ctx.fillStyle='rgba(255,40,40,0.95)';ctx.beginPath();ctx.arc(0,wy,10,0,TAU);ctx.fill();
ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
ctx.fillStyle='#fff';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillText('!',0,wy+5)}
ctx.restore()}

// ===================== Collectibles =====================
function drawCollectible(c){const y=GROUND_Y+c.y+Math.sin(c.bob+frameCount*0.05)*5;ctx.save();ctx.translate(c.x,y);
const pu=Math.sin(frameCount*0.08+c.bob)*0.5+0.5,gr=46+pu*10;
// Unified gold glow for all collectible types
const gl=ctx.createRadialGradient(0,0,0,0,0,gr);gl.addColorStop(0,'rgba(255,215,0,0.5)');gl.addColorStop(0.5,'rgba(255,200,50,0.2)');gl.addColorStop(1,'rgba(255,200,50,0)');ctx.fillStyle=gl;ctx.fillRect(-gr,-gr,gr*2,gr*2);
// Gold ring
ctx.strokeStyle=`rgba(255,215,0,${0.35+pu*0.2})`;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,22+pu*4,0,TAU);ctx.stroke();
const WOL='rgba(255,255,255,0.9)',WOLW=2.5;
switch(c.type){
case 0:ctx.fillStyle='#FFB6C1';ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(-14,12);ctx.lineTo(14,12);ctx.closePath();ctx.fill();ctx.strokeStyle=WOL;ctx.lineWidth=WOLW;ctx.stroke();ctx.strokeStyle='#FF69B4';ctx.lineWidth=2;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(i*4,12);ctx.stroke()}ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.moveTo(-3,-12);ctx.lineTo(-8,8);ctx.lineTo(-4,8);ctx.lineTo(-1,-12);ctx.closePath();ctx.fill();break;
case 1:ctx.fillStyle='#FFD700';ctx.beginPath();for(let i=0;i<5;i++){const a=(i/5)*TAU-PI/2,a2=a+PI/5;ctx.lineTo(Math.cos(a)*16,Math.sin(a)*16);ctx.lineTo(Math.cos(a2)*6,Math.sin(a2)*6)}ctx.closePath();ctx.fill();ctx.strokeStyle=WOL;ctx.lineWidth=WOLW;ctx.stroke();ctx.fillStyle='#FFA500';ctx.beginPath();ctx.arc(0,0,5,0,TAU);ctx.fill();ctx.fillStyle='#FF8C00';for(let i=0;i<5;i++){const a=(i/5)*TAU-PI/2;ctx.beginPath();ctx.arc(Math.cos(a)*9,Math.sin(a)*9,2,0,TAU);ctx.fill()}break;
case 2:ctx.fillStyle='#40E0D0';ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(12,0);ctx.lineTo(0,14);ctx.lineTo(-12,0);ctx.closePath();ctx.fill();ctx.strokeStyle=WOL;ctx.lineWidth=WOLW;ctx.stroke();ctx.fillStyle='#80EFE5';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,0);ctx.lineTo(0,10);ctx.lineTo(-7,0);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(255,255,255,0.7)';ctx.beginPath();ctx.moveTo(-3,-7);ctx.lineTo(0,-3);ctx.lineTo(3,-7);ctx.lineTo(0,-5);ctx.closePath();ctx.fill();break}
// Sparkle
const sp=Math.sin(frameCount*0.1+c.bob);
if(sp>0.5){ctx.fillStyle='rgba(255,255,255,0.9)';ctx.beginPath();ctx.arc(gr*0.6,-gr*0.5,1.5+sp,0,TAU);ctx.fill()}
ctx.restore()}

// ===================== Enemies =====================
function drawEnemy(e){const y=GROUND_Y;ctx.save();ctx.translate(e.x,y);e.bob+=0.08;
// Purple glow
const pu=Math.sin(frameCount*0.06)*0.5+0.5;ctx.fillStyle=`rgba(155,48,255,${0.12+pu*0.08})`;ctx.beginPath();ctx.ellipse(0,-e.r*0.5,e.r*1.6,e.r*1.3,0,0,TAU);ctx.fill();
// Shadow
ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.ellipse(0,3,e.r*1.2,4,0,0,TAU);ctx.fill();
// Legs
ctx.strokeStyle='#5A1080';ctx.lineWidth=2.5;ctx.lineCap='round';
for(let i=-1;i<=1;i+=2){const lx=i*e.r*0.5,ly2=8+Math.sin(frameCount*0.15+i*PI)*2;ctx.beginPath();ctx.moveTo(lx-3,0);ctx.lineTo(lx-5,ly2);ctx.moveTo(lx+3,0);ctx.lineTo(lx+5,ly2);ctx.stroke()}
// Body
ctx.fillStyle=e.color;ctx.beginPath();ctx.ellipse(0,-e.r*0.5,e.r,e.r*0.7,0,PI,TAU);ctx.fill();ctx.strokeStyle='#0a0a14';ctx.lineWidth=2.5;ctx.stroke();ctx.fillStyle=e.colorDark;ctx.beginPath();ctx.ellipse(0,-e.r*0.2,e.r*0.9,e.r*0.4,0,0,TAU);ctx.fill();
// Claws
ctx.fillStyle=e.colorDark;ctx.beginPath();ctx.ellipse(-e.r*1.1,-e.r*0.3,e.r*0.3,e.r*0.2,-0.3,0,TAU);ctx.fill();ctx.strokeStyle='#0a0a14';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.ellipse(e.r*1.1,-e.r*0.3,e.r*0.3,e.r*0.2,0.3,0,TAU);ctx.fill();ctx.stroke();
// Eyes
ctx.fillStyle='#FFF';ctx.beginPath();ctx.arc(-e.r*0.3,-e.r*0.7,4,0,TAU);ctx.arc(e.r*0.3,-e.r*0.7,4,0,TAU);ctx.fill();
ctx.fillStyle='#300040';ctx.beginPath();ctx.arc(-e.r*0.3+Math.sin(frameCount*0.05)*1,-e.r*0.7,2,0,TAU);ctx.arc(e.r*0.3+Math.sin(frameCount*0.05)*1,-e.r*0.7,2,0,TAU);ctx.fill();
// Mouth
ctx.strokeStyle='#300040';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-e.r*0.4,3,0.2*PI,0.8*PI);ctx.stroke();
// Defeat flash
if(e.hitFlash>0){ctx.fillStyle=`rgba(255,255,255,${e.hitFlash})`;ctx.beginPath();ctx.ellipse(0,-e.r*0.5,e.r,e.r*0.7,0,PI,TAU);ctx.fill()}
ctx.restore()}

// ===================== Power-ups =====================
function drawPowerup(pu2){const y=GROUND_Y-50+Math.sin(pu2.bob+frameCount*0.05)*6;ctx.save();ctx.translate(pu2.x,y);
const pu3=0.4+Math.sin(frameCount*0.1)*0.15;
const puc=[['rgba(255,180,50,0.5)','rgba(255,150,30,0)'],['rgba(80,180,255,0.5)','rgba(50,150,255,0)'],['rgba(255,220,50,0.5)','rgba(255,200,30,0)'],['rgba(100,255,200,0.5)','rgba(50,220,180,0)']];
const gl=ctx.createRadialGradient(0,0,0,0,0,35);gl.addColorStop(0,puc[pu2.type][0]);gl.addColorStop(1,puc[pu2.type][1]);ctx.fillStyle=gl;ctx.fillRect(-35,-35,70,70);
ctx.lineWidth=2.5;ctx.strokeStyle=puc[pu2.type][0].replace('0.5','0.6');ctx.beginPath();ctx.arc(0,0,18,0,TAU);ctx.stroke();
ctx.strokeStyle='#1a1a2a';ctx.lineWidth=2;
switch(pu2.type){case 0:ctx.strokeStyle='#E8400C';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(-8,-4);ctx.lineTo(-8,4);ctx.lineTo(0,4);ctx.lineTo(0,-4);ctx.lineTo(8,-4);ctx.lineTo(8,4);ctx.stroke();ctx.fillStyle='#606060';ctx.fillRect(-8,4,8,3);ctx.fillRect(0,4,8,3);break;
case 1:ctx.fillStyle='#3399FF';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(10,-4);ctx.lineTo(8,8);ctx.lineTo(-8,8);ctx.lineTo(-10,-4);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#66BBFF';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(10,-4);ctx.lineTo(0,0);ctx.closePath();ctx.fill();break;
case 2:ctx.fillStyle='#FFD700';ctx.beginPath();for(let i=0;i<5;i++){const a=(i/5)*TAU-PI/2;ctx.lineTo(Math.cos(a)*10,Math.sin(a)*10);ctx.lineTo(Math.cos(a+PI/5)*4,Math.sin(a+PI/5)*4)}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#FFA000';ctx.beginPath();ctx.arc(0,0,2,0,TAU);ctx.fill();break;
case 3:ctx.fillStyle='#00E0C0';ctx.beginPath();ctx.moveTo(-3,-10);ctx.lineTo(6,-2);ctx.lineTo(0,-2);ctx.lineTo(3,10);ctx.lineTo(-6,2);ctx.lineTo(0,2);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#80FFE0';ctx.beginPath();ctx.moveTo(-2,-7);ctx.lineTo(3,-2);ctx.lineTo(0,-2);ctx.lineTo(1,7);ctx.lineTo(-4,2);ctx.lineTo(0,2);ctx.closePath();ctx.fill();break}
// Label
const labels=['磁铁','护盾','2x分','加速'];ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(-14,20,28,12);ctx.fillStyle='#fff';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText(labels[pu2.type],0,29);
ctx.restore()}

// ===================== Springs =====================
function drawSpring(sp){const y=GROUND_Y;ctx.save();ctx.translate(sp.x,y);
// Backplate
ctx.fillStyle='rgba(100,200,255,0.12)';ctx.beginPath();ctx.ellipse(0,-12,22,30,0,0,TAU);ctx.fill();
ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.ellipse(0,2,18,4,0,0,TAU);ctx.fill();
const pp=1+Math.sin(frameCount*0.1)*0.1;ctx.fillStyle='#2090C0';ctx.beginPath();ctx.ellipse(0,-4*pp,16,4,0,0,TAU);ctx.fill();ctx.strokeStyle='#1a1a2a';ctx.lineWidth=2;ctx.stroke();
ctx.strokeStyle='#40B0E0';ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,-8-i*5,12,3,0,0,TAU);ctx.stroke()}
ctx.fillStyle='#80D0FF';ctx.beginPath();ctx.ellipse(0,-26*pp,14,5,0,0,TAU);ctx.fill();ctx.strokeStyle='#1a1a2a';ctx.lineWidth=2;ctx.stroke();
ctx.fillStyle='rgba(255,255,255,0.6)';ctx.beginPath();ctx.ellipse(-3,-27*pp,6,2,0,0,TAU);ctx.fill();
for(let i=0;i<3;i++){const dy=-22-i*8;if(Math.random()<0.3){ctx.fillStyle='rgba(160,220,255,0.6)';ctx.beginPath();ctx.arc(rand(-10,10),dy,1.5,0,TAU);ctx.fill()}}
// Label
ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(-14,-40,28,12);ctx.fillStyle='#80D0FF';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText('弹跳',0,-31);
ctx.restore()}

// ===================== Particles =====================
function spawnParticle(x,y,type,count){const cfgs={dust:['rgba(200,180,150,0.5)',-2,3,30,3],spark:['rgba(255,215,0,0.8)',-3,0,40,2],petal:['#FFB6C1',0.5,-1,200,4],spray:['rgba(255,255,255,0.6)',-4,0,25,2],stomp:['rgba(255,200,100,0.6)',-5,2,35,3],heal:['rgba(100,255,150,0.6)',-4,0,40,3]};const c=cfgs[type]||cfgs.dust;const n=count||c[3];for(let i=0;i<n;i++)particles.push({x:x+rand(-5,5),y:y+rand(-5,5),vx:rand(-c[2],c[2]*0.3)+(type==='dust'||type==='spray'||type==='stomp'?-speed*0.3:0),vy:rand(c[1],0.5),life:c[3],maxLife:c[3],size:c[4]+rand(-1,1),color:c[0],type:type,rot:rand(0,TAU),rotSpd:rand(-0.1,0.1)})}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=0.15*dt;p.life-=dt;p.rot+=p.rotSpd*dt;if(p.life<=0||p.y>H+20)particles.splice(i,1)}if(Math.random()<0.02*dt)spawnParticle(rand(0,W),-10,'petal',1)}
function drawParticles(){for(const p of particles){const a=p.life/p.maxLife;ctx.save();ctx.globalAlpha=a;ctx.translate(p.x,p.y);ctx.rotate(p.rot);if(p.type==='petal'){ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*0.5,0,0,TAU);ctx.fill()}else if(p.type==='spark'||p.type==='stomp'){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,p.size,0,TAU);ctx.fill();ctx.strokeStyle=p.color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-p.size*2,0);ctx.lineTo(p.size*2,0);ctx.moveTo(0,-p.size*2);ctx.lineTo(0,p.size*2);ctx.stroke()}else{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,p.size,0,TAU);ctx.fill()}ctx.restore()}ctx.globalAlpha=1}

// ===================== Float Text =====================
function showFloatText(x,y,text,color,size){const el=document.createElement('div');el.className='float-text';el.textContent=text;el.style.left=x+'px';el.style.top=y+'px';el.style.color=color||'#FFD700';el.style.fontSize=(size||20)+'px';document.body.appendChild(el);setTimeout(()=>el.remove(),1000)}

// ===================== Spawning =====================
function spawnObject(){
const r=Math.random();
if(r<0.22){const t=randInt(0,4);obstacles.push({x:W+50,type:t,w:[52,68,58,46,80][t],h:[42,78,56,36,48][t],passed:false})}
else if(r<0.38){const t=randInt(0,2),cnt=randInt(3,6),gap=36;for(let i=0;i<cnt;i++)collectibles.push({x:W+50+i*gap,y:-rand(0,15),type:t,collected:false,bob:rand(0,TAU)})}
else if(r<0.52){const cnt=7;for(let i=0;i<cnt;i++){const t=i/(cnt-1),ay=-Math.sin(t*PI)*70;collectibles.push({x:W+50+i*30,y:ay,type:1,collected:false,bob:rand(0,TAU)})}}
else if(r<0.62){enemies.push({x:W+60,r:18,range:40,bob:0,defeated:false,hitFlash:0,color:'#9B30FF',colorDark:'#5A1080'})}
else if(r<0.72){springs.push({x:W+50,bob:0})}
else if(r<0.82){const t=randInt(0,3);powerups.push({x:W+50,y:-60,type:t,bob:rand(0,TAU)})}
else if(r<0.91){const t=randInt(0,3);obstacles.push({x:W+50,type:t,w:[52,68,58,46][t],h:[42,78,56,36][t],passed:false});for(let i=0;i<5;i++){const ay=-Math.sin((i/4)*PI)*60;collectibles.push({x:W+110+i*28,y:ay,type:1,collected:false,bob:rand(0,TAU)})}}
else{obstacles.push({x:W+50,type:4,w:80,h:48,passed:false});for(let i=0;i<3;i++)collectibles.push({x:W+65+i*22,y:-5,type:1,collected:false,bob:rand(0,TAU)})}
}

// ===================== Game Logic =====================
function resetGame(){
score=0;distance=0;shells=0;speed=CFG.BASE_SPEED;scrollX=0;frameCount=0;spawnTimer=0;nextSpawn=CFG.SPAWN_MIN;screenShake=0;dayProgress=0;
obstacles=[];collectibles=[];enemies=[];powerups=[];springs=[];particles=[];
combo=0;comboTimer=0;maxCombo=0;
char.y=0;char.vy=0;char.onGround=true;char.rotation=0;char.runFrame=0;char.hairWave=0;
char.health=CFG.MAX_HEALTH;char.invincible=0;char.jumpsLeft=2;
char.dashTimer=0;char.dashCooldown=0;char.magnetTimer=0;char.shield=false;char.doubleScoreTimer=0;char.speedBoostTimer=0;char.slideTimer=0;
lastMilestone=0;isJumpHeld=false;initScenery();updateHearts();updatePowerupBar();
}
function jump(){if(char.onGround){char.vy=CFG.JUMP_POWER;char.onGround=false;char.jumpsLeft=1;isJumpHeld=true;Audio2.jump();spawnParticle(W*CFG.CHAR_X,GROUND_Y,'dust')}else if(char.jumpsLeft>0){char.vy=CFG.DOUBLE_JUMP_POWER;char.jumpsLeft=0;Audio2.djump();spawnParticle(W*CFG.CHAR_X,GROUND_Y+char.y,'spray')}}
function dash(){if(char.dashCooldown<=0){char.dashTimer=CFG.DASH_DURATION;char.dashCooldown=CFG.DASH_COOLDOWN;Audio2.dash();spawnParticle(W*CFG.CHAR_X,GROUND_Y+char.y,'spray');screenShake=4}}
function slide(){if(char.onGround&&char.slideTimer<=0&&char.dashTimer<=0){char.slideTimer=CFG.SLIDE_DURATION;Audio2.slide();spawnParticle(W*CFG.CHAR_X,GROUND_Y,'dust',8)}}
function takeDamage(){if(char.invincible>0||char.dashTimer>0)return;if(char.shield){char.shield=false;char.invincible=40;Audio2.hit();screenShake=5;showFloatText(W*CFG.CHAR_X,GROUND_Y+char.y-40,'护盾破裂!','#3399FF',18);return}char.health--;char.invincible=CFG.INVINCIBLE;Audio2.hit();screenShake=8;updateHearts();if(char.health<=0){gameOver()}else{showFloatText(W*CFG.CHAR_X,GROUND_Y+char.y-30,'-1 ❤️','#FF4040',22)}}
function comboAdd(){combo++;comboTimer=CFG.COMBO_TIMEOUT;if(combo>maxCombo)maxCombo=combo;updateCombo()}
function comboMult(){return Math.min(1+Math.floor(combo/5),CFG.MAX_COMBO_MULT)}
function updateGame(dt){
if(state!=='playing')return;frameCount+=dt;dayProgress=(frameCount*0.0003)%4;
let effSpeed=speed+((char.speedBoostTimer>0)?4:0);speed=Math.min(CFG.MAX_SPEED,speed+CFG.SPEED_ACCEL*dt);scrollX+=effSpeed*dt;distance+=effSpeed*dt*0.1;
char.runFrame+=dt*(effSpeed/5);
// Timers
if(char.invincible>0)char.invincible-=dt;
if(char.dashTimer>0)char.dashTimer-=dt;
if(char.dashCooldown>0)char.dashCooldown-=dt;
if(char.magnetTimer>0)char.magnetTimer-=dt;
if(char.doubleScoreTimer>0)char.doubleScoreTimer-=dt;
if(char.speedBoostTimer>0)char.speedBoostTimer-=dt;
if(char.slideTimer>0)char.slideTimer-=dt;
if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0){combo=0;updateCombo()}}
// Physics
if(!char.onGround){if(isJumpHeld&&char.vy<0){char.vy+=CFG.JUMP_HOLD*dt}char.vy+=CFG.GRAVITY*dt;char.y+=char.vy*dt;char.rotation=clamp(char.vy*0.015,-0.3,0.3);if(char.y>=0){char.y=0;char.vy=0;char.onGround=true;char.rotation=0;char.jumpsLeft=2;isJumpHeld=false;Audio2.land();spawnParticle(W*CFG.CHAR_X,GROUND_Y,'dust');screenShake=2}}
// Spawn
spawnTimer+=effSpeed*dt;if(spawnTimer>=nextSpawn){spawnTimer=0;nextSpawn=rand(CFG.SPAWN_MIN,CFG.SPAWN_MAX)*(1-speed/45);spawnObject()}
// Milestone bonus
if(Math.floor(distance/500)>lastMilestone){lastMilestone=Math.floor(distance/500);for(let i=0;i<8;i++)collectibles.push({x:W+50+i*30,y:-rand(0,20),type:randInt(0,2),collected:false,bob:rand(0,TAU)});showFloatText(W*0.5,H*0.3,'里程碑 '+lastMilestone*500+'m!','#FFD700',24);Audio2.powerup()}
const charX=W*CFG.CHAR_X;
// Obstacles
for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];o.x-=effSpeed*dt;if(!o.passed&&o.x<charX){o.passed=true;score+=5}if(o.x<-60)obstacles.splice(i,1);const dx=Math.abs(o.x-charX);let hit=false;if(o.type===4){if(dx<o.w/2+6&&char.slideTimer<=0&&char.y>-42&&char.invincible<=0&&char.dashTimer<=0)hit=true}else{if(dx<o.w/2+8&&char.y>-o.h*0.55&&char.invincible<=0&&char.dashTimer<=0)hit=true}if(hit){takeDamage();if(char.dashTimer<=0)char.invincible=CFG.INVINCIBLE}}
// Collectibles
for(let i=collectibles.length-1;i>=0;i--){const c=collectibles[i];c.x-=effSpeed*dt;c.bob+=dt*0.05;if(c.x<-50){collectibles.splice(i,1);continue}
// Magnet
if(char.magnetTimer>0){const dx2=c.x-charX;if(Math.abs(dx2)<120){c.x-=dx2*0.08*dt}}
const cy=GROUND_Y+c.y,dx=Math.abs(c.x-charX),dy=Math.abs(cy-(GROUND_Y+char.y));if(dx<36&&dy<45){const pts=[10,20,50][c.type];const mult=comboMult();const total=Math.floor(pts*mult*(char.doubleScoreTimer>0?2:1));shells++;score+=total;comboAdd();Audio2.collect();spawnParticle(c.x,cy,'spark');const labels=['+'+total,'+'+total+'!','+'+total+'!!'];const cols=['#FFB6C1','#FFD700','#40E0D0'];showFloatText(c.x,cy-20,labels[c.type],cols[c.type],16+Math.min(mult*2,10));collectibles.splice(i,1)}}
// Enemies
for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.x-=effSpeed*dt*0.7;if(e.hitFlash>0)e.hitFlash-=dt*0.1;if(e.x<-60){enemies.splice(i,1);continue}
const dx=Math.abs(e.x-charX),stompY=char.y<0&&char.vy>0&&char.y>-e.r*2,above=char.y<-e.r*1.4;
if(dx<e.r+8){if(stompY||char.dashTimer>0){e.defeated=true;const pts=Math.floor(50*comboMult()*(char.doubleScoreTimer>0?2:1));score+=pts;shells++;comboAdd();Audio2.stomp();spawnParticle(e.x,GROUND_Y,'stomp',10);showFloatText(e.x,GROUND_Y-30,'+'+pts+' STOMP!','#FF8C00',18);char.vy=CFG.DOUBLE_JUMP_POWER;enemies.splice(i,1)}else if(!above&&char.invincible<=0){takeDamage()}}
}
// Powerups
for(let i=powerups.length-1;i>=0;i--){const pu2=powerups[i];pu2.x-=effSpeed*dt;pu2.bob+=dt*0.05;if(pu2.x<-40){powerups.splice(i,1);continue}const dx=Math.abs(pu2.x-charX),dy=Math.abs((GROUND_Y-50)-(GROUND_Y+char.y));if(dx<30&&dy<50){Audio2.powerup();flashScreen([['255,180,50','255,150,30'],['80,180,255','50,150,255'],['255,220,50','255,200,30'],['100,255,200','50,220,180']][pu2.type]);switch(pu2.type){case 0:char.magnetTimer=300;showFloatText(W*CFG.CHAR_X,GROUND_Y-60,'磁铁!','#E8400C',20);break;case 1:char.shield=true;showFloatText(W*CFG.CHAR_X,GROUND_Y-60,'护盾!','#3399FF',20);break;case 2:char.doubleScoreTimer=600;showFloatText(W*CFG.CHAR_X,GROUND_Y-60,'双倍分数!','#FFD700',20);break;case 3:char.speedBoostTimer=180;char.invincible=Math.max(char.invincible,180);showFloatText(W*CFG.CHAR_X,GROUND_Y-60,'加速冲刺!','#00E0C0',20);break}spawnParticle(pu2.x,GROUND_Y-50,'spark',12);updatePowerupBar();powerups.splice(i,1)}}
// Springs
for(let i=springs.length-1;i>=0;i--){const sp=springs[i];sp.x-=effSpeed*dt;sp.bob+=dt*0.05;if(sp.x<-40){springs.splice(i,1);continue}const dx=Math.abs(sp.x-charX);if(dx<22&&char.y>-5){char.vy=CFG.JUMP_POWER*1.3;char.onGround=false;char.jumpsLeft=2;Audio2.jump();spawnParticle(sp.x,GROUND_Y,'spray');showFloatText(sp.x,GROUND_Y-40,'弹跳!','#80D0FF',18)}}
// Particles
updateParticles(dt);if(screenShake>0)screenShake=Math.max(0,screenShake-0.5*dt);
// HUD
document.getElementById('scoreVal').textContent=score;document.getElementById('distVal').textContent=Math.floor(distance)+'m';document.getElementById('shellVal').textContent=shells;
updatePowerupBar();
}
function render(dt){
ctx.clearRect(0,0,W,H);ctx.save();if(screenShake>0)ctx.translate(rand(-screenShake,screenShake),rand(-screenShake,screenShake));
drawSky(frameCount);drawClouds(dt);drawMountains(dt);drawDistantTown();drawOcean(dt);drawBoat(dt);drawBeach();drawBirds(dt);drawRoad(dt);drawTrees(dt);drawSpeedLines(dt);
for(const s of springs)drawSpring(s);for(const c of collectibles)drawCollectible(c);for(const o of obstacles)drawObstacle(o);for(const e of enemies)drawEnemy(e);for(const pu2 of powerups)drawPowerup(pu2);
drawCharacter(dt);drawParticles();drawForegroundGrass();ctx.restore();
const vg=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(20,20,50,0.25)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
}
function gameOver(){
state='gameover';Audio2.gameover();screenShake=10;
if(score>bestScore){bestScore=score;saveBest(score)}
document.getElementById('finalDist').textContent=Math.floor(distance)+'m';document.getElementById('finalScore').textContent=score;document.getElementById('finalCombo').textContent='x'+maxCombo;document.getElementById('bestScore').textContent=bestScore;document.getElementById('gameOverScreen').classList.remove('hidden');document.getElementById('gameOverScreen').classList.add('active');document.getElementById('hud').style.display='none';document.getElementById('pauseBtn').classList.remove('show');document.getElementById('comboDisplay').classList.remove('show');document.getElementById('powerupBar').innerHTML=''}

// ===================== UI =====================
function updateHearts(){const el=document.getElementById('hearts');el.innerHTML='';for(let i=0;i<CFG.MAX_HEALTH;i++){const h=document.createElement('span');h.className='heart'+(i>=char.health?' lost':'');h.textContent='❤️';el.appendChild(h)}}
function updateCombo(){const el=document.getElementById('comboDisplay');const m=comboMult();if(combo>=5){el.classList.add('show');document.getElementById('comboX').textContent='x'+m}else{el.classList.remove('show')}}
function updatePowerupBar(){const el=document.getElementById('powerupBar');el.innerHTML='';const pus=[{active:char.magnetTimer>0,max:300,color:'#E8400C',label:'🧲'},{active:char.shield,max:1,color:'#3399FF',label:'🛡️'},{active:char.doubleScoreTimer>0,max:600,color:'#FFD700',label:'⭐'},{active:char.speedBoostTimer>0,max:180,color:'#00E0C0',label:'⚡'}];for(const p of pus){if(!p.active)continue;const d=document.createElement('div');d.className='pu-timer';d.innerHTML=`<span>${p.label}</span><div class="pu-bar"><div class="pu-fill" style="width:100%;background:${p.color}"></div></div>`;el.appendChild(d);const fill=d.querySelector('.pu-fill');const timer=char.magnetTimer>0&&p.label==='🧲'?char.magnetTimer:char.shield&&p.label==='🛡️'?1:char.doubleScoreTimer>0&&p.label==='⭐'?char.doubleScoreTimer:char.speedBoostTimer>0&&p.label==='⚡'?char.speedBoostTimer:0;fill.style.width=(timer/p.max*100)+'%'}}
function flashScreen(c){const el=document.getElementById('flashOverlay');el.style.background=`rgba(${c[0]},0.3)`;el.style.opacity='1';setTimeout(()=>{el.style.opacity='0'},100)}

// ===================== Main Loop =====================
let lastTime=performance.now();function gameLoop(now){let dt=(now-lastTime)/16.67;lastTime=now;dt=Math.min(dt,3);if(state==='playing')updateGame(dt);render(dt);requestAnimationFrame(gameLoop)}requestAnimationFrame(gameLoop);

// ===================== Input =====================
function handleJumpStart(){if(state==='playing')jump()}
function handleJumpEnd(){isJumpHeld=false}
function handleDash(){if(state==='playing')dash()}
function handleSlide(){if(state==='playing')slide()}
function togglePause(){
if(state==='playing'){state='paused';document.getElementById('pauseBtn').textContent='▶'}
else if(state==='paused'){state='playing';document.getElementById('pauseBtn').textContent='⏸'}}
function restartRun(){
resetGame();state='playing';
document.getElementById('gameOverScreen').classList.remove('active');
document.getElementById('gameOverScreen').classList.add('hidden');
document.getElementById('hud').style.display='flex';
document.getElementById('pauseBtn').classList.add('show')}
function toggleMute(){
Audio2.muted=!Audio2.muted;
saveSettings({ ...loadSettings(), muted: Audio2.muted });
showFloatText(W*0.5,H*0.2,Audio2.muted?'🔇 已静音':'🔊 声音开启','#fff',18)}
window.addEventListener('keydown',e=>{
if(e.code==='Space'){e.preventDefault();handleJumpStart()}
if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();handleDash()}
if(e.code==='ArrowDown'||e.code==='KeyS'){e.preventDefault();handleSlide()}
if(e.code==='KeyP'){togglePause()}          // P 暂停/继续
if(e.code==='KeyR'){                         // R 重开
if(state==='paused'){togglePause()}
if(state!=='menu'&&state!=='gameover')restartRun();
else if(state==='gameover')restartRun()}
if(e.code==='KeyM'){toggleMute()}})          // M 静音
window.addEventListener('keyup',e=>{if(e.code==='Space')handleJumpEnd()})
canvas.addEventListener('mousedown',handleJumpStart);canvas.addEventListener('mouseup',handleJumpEnd);canvas.addEventListener('touchstart',e=>{e.preventDefault();handleJumpStart()},{passive:false});canvas.addEventListener('touchend',e=>{e.preventDefault();handleJumpEnd()},{passive:false});
// Double-tap for dash on touch
let lastTap=0;canvas.addEventListener('touchstart',e=>{const now=Date.now();if(now-lastTap<300)handleDash();lastTap=now},{passive:false});
// Swipe down for slide on touch
let touchStartY=0;canvas.addEventListener('touchstart',e=>{touchStartY=e.touches[0].clientY},{passive:true});canvas.addEventListener('touchmove',e=>{if(e.touches[0].clientY-touchStartY>40){handleSlide();touchStartY=-9999}},{passive:true});
document.getElementById('startBtn').addEventListener('click',()=>{Audio2.init();resetGame();state='playing';document.getElementById('startScreen').classList.remove('active');document.getElementById('startScreen').classList.add('hidden');document.getElementById('hud').style.display='flex';document.getElementById('pauseBtn').classList.add('show')});
document.getElementById('restartBtn').addEventListener('click',()=>{resetGame();state='playing';document.getElementById('gameOverScreen').classList.remove('active');document.getElementById('gameOverScreen').classList.add('hidden');document.getElementById('hud').style.display='flex';document.getElementById('pauseBtn').classList.add('show')});
document.getElementById('pauseBtn').addEventListener('click',togglePause);

// ===================== Boot：恢复持久化设置 =====================
Audio2.muted = Boolean(loadSettings().muted);




