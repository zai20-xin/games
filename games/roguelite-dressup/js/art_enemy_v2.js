// ===== 怪物美术 v2：手绘感全面重绘 =====
// 覆写全局 drawEnemies。特点：果冻半透明高光/膜翼骨骼/岩石裂纹/菌盖斑点/Boss披风獠牙

(function(){
const OUT="#241a2e";

function dotEyes(c,ox,oy,r,gap){
  for(const s of[-1,1]){
    c.fillStyle=OUT;c.beginPath();c.arc(s*gap+ox,oy,r,0,7);c.fill();
    c.fillStyle="rgba(255,255,255,.9)";
    c.beginPath();c.arc(s*gap+ox+r*.3,oy-r*.3,r*.34,0,7);c.fill();
  }
}
function angryEye(c,x,y,r,col){
  c.fillStyle=col||"#ffd93d";c.strokeStyle=OUT;c.lineWidth=1.4;
  c.beginPath();c.arc(x,y,r,0,7);c.fill();c.stroke();
  c.fillStyle=OUT;c.beginPath();c.arc(x,y-r*.15,r*.42,0,7);c.fill();
}

window.drawEnemies=function(ctx,camX,camY){
  const t=performance.now()/1000;
  for(const e of enemies){
    const x=e.x-camX,y=e.y-camY;
    if(x<-90||y<-90||x>VIEW_W+90||y>VIEW_H+90)continue;

    ctx.save();
    ctx.translate(x,y);
    // 影子
    ctx.fillStyle="rgba(0,0,0,.28)";
    ctx.beginPath();ctx.ellipse(0,e.r*.92,e.r*.95,e.r*.32,0,0,7);ctx.fill();

    // 精英光环（双圈）
    if(e.isElite||e.isBoss){
      ctx.rotate(0);
      ctx.strokeStyle=e.isBoss?"rgba(255,80,80,.85)":"rgba(255,215,0,.8)";
      ctx.lineWidth=2.6;ctx.setLineDash([9,6]);ctx.lineDashOffset=-t*26;
      ctx.beginPath();ctx.arc(0,e.r*.25,e.r+8+Math.sin(t*3)*2,0,7);ctx.stroke();
      ctx.setLineDash([]);
    }

    // 受击闪白 / 冰冻 / 中毒 染色
    let body=e.color;
    if(e.freezeT>0)body="#a5e3f7";
    else if(e.poisonT>0)body=mixColor(e.color,"#7ac74f",.45);
    if(e.hitFlash>0)body="#ffffff";

    ctx.lineJoin="round";

    switch(e.type){
      case "slime":{
        // 果冻弹跳：挤压拉伸
        const sq=1+Math.sin(e.wobble)*.09;
        const h=e.r*1.05/sq,w=e.r*sq;
        ctx.globalAlpha=.88;
        ctx.fillStyle=body;ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
        ctx.beginPath();
        ctx.moveTo(-w,h*.28);
        ctx.quadraticCurveTo(-w*1.02,-h*.86,0,-h*.92);
        ctx.quadraticCurveTo(w*1.02,-h*.86,w,h*.28);
        ctx.quadraticCurveTo(w*.5,h*.62,0,h*.62);
        ctx.quadraticCurveTo(-w*.5,h*.62,-w,h*.28);
        ctx.closePath();ctx.fill();ctx.stroke();
        ctx.globalAlpha=1;
        // 果冻高光
        ctx.fillStyle="rgba(255,255,255,.55)";
        ctx.beginPath();ctx.ellipse(-w*.36,-h*.44,w*.24,h*.16,-.5,0,7);ctx.fill();
        ctx.beginPath();ctx.arc(w*.18,-h*.58,w*.07,0,7);ctx.fill();
        dotEyes(ctx,0,-h*.14,2.1,e.r*.3);
        // 嘴
        ctx.strokeStyle=OUT;ctx.lineWidth=1.4;ctx.lineCap="round";
        ctx.beginPath();ctx.arc(e.r*.06,h*.12,2,.2*Math.PI,.8*Math.PI);ctx.stroke();
        break;}

      case "bat":{
        const flap=Math.sin(performance.now()/38);
        // 后翼（膜）
        for(const s of[-1,1]){
          ctx.fillStyle=s<0?mixColor(body,"#000000",.22):body;
          ctx.strokeStyle=OUT;ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(s*e.r*.35,-e.r*.15);
          ctx.quadraticCurveTo(s*e.r*1.5,-flap*e.r*.85,s*e.r*1.85,flap*e.r*.3);
          // 膜下缘两指
          ctx.quadraticCurveTo(s*e.r*1.45,flap*e.r*.42-e.r*.1,s*e.r*1.1,e.r*.28);
          ctx.quadraticCurveTo(s*e.r*.72,e.r*.3,s*e.r*.35,e.r*.3);
          ctx.closePath();ctx.fill();ctx.stroke();
          // 翼骨
          ctx.strokeStyle="rgba(36,26,46,.5)";ctx.lineWidth=1.1;
          ctx.beginPath();ctx.moveTo(s*e.r*.4,-e.r*.1);
          ctx.quadraticCurveTo(s*e.r*1.2,flap*e.r*.3,s*e.r*1.7,flap*e.r*.22);ctx.stroke();
        }
        // 圆身+耳
        ctx.fillStyle=body;ctx.strokeStyle=OUT;ctx.lineWidth=2.2;
        ctx.beginPath();ctx.arc(0,0,e.r*.82,0,7);ctx.fill();ctx.stroke();
        for(const s of[-1,1]){
          ctx.beginPath();ctx.moveTo(s*e.r*.5,-e.r*.5);
          ctx.lineTo(s*e.r*.78,-e.r*1.12);ctx.lineTo(s*e.r*.16,-e.r*.74);
          ctx.closePath();ctx.fill();ctx.stroke();
        }
        dotEyes(ctx,0,-e.r*.08,1.9,e.r*.26);
        ctx.fillStyle="#fff"; // 小獠牙
        for(const s of[-1,1]){ctx.beginPath();
          ctx.moveTo(s*e.r*.2,e.r*.22);ctx.lineTo(s*e.r*.28,e.r*.48);ctx.lineTo(s*e.r*.09,e.r*.24);
          ctx.closePath();ctx.fill();}
        break;}

      case "golem":{
        const sway=Math.sin(e.wobble*.5)*.03;
        ctx.rotate(sway);
        // 身体：不规则岩石块
        ctx.fillStyle=body;ctx.strokeStyle=OUT;ctx.lineWidth=2.6;
        ctx.beginPath();
        ctx.moveTo(-e.r*.85,e.r*.75);
        ctx.lineTo(-e.r*.98,-e.r*.2);
        ctx.lineTo(-e.r*.6,-e.r*.92);
        ctx.lineTo(e.r*.55,-e.r*.98);
        ctx.lineTo(e.r*.95,-e.r*.1);
        ctx.lineTo(e.r*.8,e.r*.78);
        ctx.closePath();ctx.fill();ctx.stroke();
        // 岩石裂纹
        ctx.strokeStyle="rgba(36,26,46,.45)";ctx.lineWidth=1.4;
        ctx.beginPath();ctx.moveTo(-e.r*.4,-e.r*.6);ctx.lineTo(-e.r*.15,-e.r*.25);ctx.lineTo(-e.r*.42,e.r*.1);ctx.stroke();
        ctx.beginPath();ctx.moveTo(e.r*.4,-e.r*.4);ctx.lineTo(e.r*.22,e.r*.05);ctx.stroke();
        // 苔藓斑
        ctx.fillStyle="rgba(110,160,90,.5)";
        ctx.beginPath();ctx.ellipse(e.r*.45,e.r*.45,e.r*.2,e.r*.12,.5,0,7);ctx.fill();
        ctx.beginPath();ctx.ellipse(-e.r*.55,e.r*.5,e.r*.14,e.r*.09,-.4,0,7);ctx.fill();
        // 发光眼窝
        angryEye(ctx,-e.r*.26,-e.r*.3,e.r*.13,"#ffd93d");
        angryEye(ctx,e.r*.26,-e.r*.3,e.r*.13,"#ffd93d");
        break;}

      case "shroom":{
        const pulse=(e.fuse>=0&&Math.floor(e.fuse*10)%2===0);
        const bc=pulse?"#ffffff":(e.freezeT>0?"#a5e3f7":(e.poisonT>0?mixColor(e.color,"#7ac74f",.45):(e.hitFlash>0?"#ffffff":body)));
        // 菌柄（微弯）
        ctx.fillStyle=pulse?"#ffffff":"#ffe8f0";ctx.strokeStyle=OUT;ctx.lineWidth=2.2;
        ctx.beginPath();ctx.roundRect(-e.r*.4,-e.r*.15,e.r*.8,e.r*.95,e.r*.25);ctx.fill();ctx.stroke();
        // 菌盖：大帽檐
        ctx.fillStyle=bc;
        ctx.beginPath();
        ctx.moveTo(-e.r*1.08,-e.r*.1);
        ctx.quadraticCurveTo(-e.r*1.05,-e.r*1.15,0,-e.r*1.2);
        ctx.quadraticCurveTo(e.r*1.05,-e.r*1.15,e.r*1.08,-e.r*.1);
        ctx.quadraticCurveTo(0,e.r*.22,-e.r*1.08,-e.r*.1);
        ctx.closePath();ctx.fill();ctx.stroke();
        // 斑点
        if(!pulse){
          ctx.fillStyle="rgba(255,255,255,.85)";
          ctx.beginPath();ctx.arc(-e.r*.42,-e.r*.62,e.r*.17,0,7);ctx.fill();
          ctx.beginPath();ctx.arc(e.r*.34,-e.r*.5,e.r*.13,0,7);ctx.fill();
          ctx.beginPath();ctx.arc(e.r*.02,-e.r*.88,e.r*.11,0,7);ctx.fill();
        } else { // 引信警示圈
          ctx.strokeStyle="#ff5c5c";ctx.lineWidth=2;
          ctx.beginPath();ctx.arc(0,-e.r*.55,e.r*1.2,0,7);ctx.stroke();
        }
        // 傻脸
        dotEyes(ctx,0,e.r*.3,1.8,e.r*.24);
        ctx.strokeStyle=OUT;ctx.lineWidth=1.3;
        ctx.beginPath();ctx.arc(0,e.r*.52,1.6,.15*Math.PI,.85*Math.PI);ctx.stroke();
        break;}

      case "boss":{
        const bob=Math.sin(e.wobble*.5)*3;
        ctx.translate(0,bob);
        const R=e.r;
        // 披风（身后，随移动飘）
        ctx.fillStyle="#5a1420";ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
        const cw=R*1.5+Math.sin(e.wobble)*R*.12;
        ctx.beginPath();
        ctx.moveTo(-R*.7,-R*.5);
        ctx.quadraticCurveTo(-cw,R*.2,-cw*.82,R*.95);
        ctx.quadraticCurveTo(0,R*.68,cw*.82,R*.95);
        ctx.quadraticCurveTo(cw,R*.2,R*.7,-R*.5);
        ctx.closePath();ctx.fill();ctx.stroke();
        // 双角（带环纹）
        ctx.fillStyle="#7a1f1f";ctx.strokeStyle=OUT;ctx.lineWidth=2.2;
        for(const s of[-1,1]){
          ctx.beginPath();
          ctx.moveTo(s*R*.5,-R*.62);
          ctx.quadraticCurveTo(s*R*.95,-R*1.05,s*R*.72,-R*1.5);
          ctx.quadraticCurveTo(s*R*.62,-R*1.12,s*R*.22,-R*.92);
          ctx.closePath();ctx.fill();ctx.stroke();
          ctx.strokeStyle="rgba(255,220,180,.35)";ctx.lineWidth=1.2;
          ctx.beginPath();ctx.moveTo(s*R*.56,-R*.94);ctx.lineTo(s*R*.68,-R*1.06);ctx.stroke();
          ctx.strokeStyle=OUT;
        }
        // 巨体
        ctx.fillStyle=body;ctx.strokeStyle=OUT;ctx.lineWidth=2.8;
        ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.fill();ctx.stroke();
        // 腹部暗纹
        ctx.fillStyle="rgba(0,0,0,.18)";
        ctx.beginPath();ctx.ellipse(0,R*.42,R*.55,R*.3,0,0,7);ctx.fill();
        // 阶段标记：P2 双肩刺 / P3 全身火纹
        if(e.phase>=2){for(const s of[-1,1]){
          ctx.fillStyle="#ff8080";ctx.strokeStyle=OUT;ctx.lineWidth=1.6;
          ctx.beginPath();ctx.moveTo(s*R*.85,-R*.1);ctx.lineTo(s*R*1.18,-R*.34);ctx.lineTo(s*R*.8,-R*.42);
          ctx.closePath();ctx.fill();ctx.stroke();}}
        if(e.phase>=3){ctx.strokeStyle="rgba(255,179,71,.65)";ctx.lineWidth=1.6;
          for(let k=0;k<3;k++){const a=t*2+k*2.1;
            ctx.beginPath();ctx.arc(Math.cos(a)*R*.6,Math.sin(a)*R*.5,R*.16,0,7);ctx.stroke();}}
        // 脸：怒目獠牙
        angryEye(ctx,-R*.3,-R*.16,R*.14,"#ffd93d");
        angryEye(ctx,R*.3,-R*.16,R*.14,"#ffd93d");
        ctx.fillStyle="#fff";ctx.strokeStyle=OUT;ctx.lineWidth=1;
        for(const s of[-1,1]){ // 下弯獠牙×2
          ctx.beginPath();ctx.moveTo(s*R*.34,R*.2);ctx.lineTo(s*R*.4,R*.44);ctx.lineTo(s*R*.22,R*.24);ctx.closePath();ctx.fill();ctx.stroke();
          ctx.beginPath();ctx.moveTo(s*R*.14,R*.26);ctx.lineTo(s*R*.17,R*.46);ctx.lineTo(s*R*.04,R*.28);ctx.closePath();ctx.fill();ctx.stroke();}
        ctx.strokeStyle=OUT;ctx.lineWidth=2.4;
        ctx.beginPath();ctx.arc(0,R*.18,R*.34,.2*Math.PI,.8*Math.PI);ctx.stroke();
        break;}
    }

    // 冻结冰壳
    if(e.freezeT>0){
      ctx.strokeStyle="rgba(255,255,255,.85)";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,e.r+3,0,7);ctx.stroke();
    }
    // 血条
    if(e.hp<e.maxHp&&!e.isBoss){
      const w=e.r*2.1;
      ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(-w/2,-e.r-12,w,4);
      ctx.fillStyle="#7ed957";ctx.fillRect(-w/2,-e.r-12,w*Math.max(0,e.hp/e.maxHp),4);
    }
    // 词缀徽章
    if(e.affixes&&typeof AFFIXES!=="undefined") AFFIXES.drawBadge(ctx,e,camX,camY);
    ctx.restore();
  }
};
})();
