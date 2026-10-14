// ===== UI：开始选装 / HUD / 升级三选一 / 结算 =====
let ctx=null;

// ---------- 开始界面：选择时装 ----------
function drawStartScreen(){
  ctx.fillStyle="#14121f"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.textAlign="center";
  ctx.fillStyle="#ffe66d";
  ctx.font="bold 52px sans-serif";
  ctx.fillText("幻 装 旅 者",VIEW_W/2,110);
  ctx.fillStyle="#b8a9d9"; ctx.font="20px sans-serif";
  ctx.fillText("时装决定你是谁 · 符文决定你怎么打",VIEW_W/2,150);

  const cardW=180,gap=18;
  const totalW=OUTFITS.length*cardW+(OUTFITS.length-1)*gap;
  let x0=(VIEW_W-totalW)/2, y0=210;
  for(let i=0;i<OUTFITS.length;i++){
    const o=OUTFITS[i];
    const cx=x0+i*(cardW+gap);
    const hovered=mouse.x>=cx&&mouse.x<=cx+cardW&&mouse.y>=y0&&mouse.y<=y0+300;
    ctx.save();
    if(hovered){ ctx.shadowColor=o.accent; ctx.shadowBlur=22; }
    ctx.fillStyle=hovered?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.05)";
    ctx.strokeStyle=hovered?o.accent:"rgba(255,255,255,0.25)";
    ctx.lineWidth=hovered?3:1.5;
    ctx.beginPath(); ctx.roundRect(cx,y0,cardW,300,14); ctx.fill(); ctx.stroke();
    // 稀有度顶部色带
    ctx.globalAlpha=0.5; ctx.fillStyle=o.accent;
    ctx.beginPath(); ctx.roundRect(cx+1.5,y0+1.5,cardW-3,7,[7,7,0,0]); ctx.fill();
    ctx.restore();
    // 时装预览小人
    drawOutfitPreview(ctx,o,cx+cardW/2,y0+95);
    ctx.textAlign="center";
    ctx.fillStyle="#fff"; ctx.font="bold 19px sans-serif";
    ctx.fillText(o.name,cx+cardW/2,y0+185);
    ctx.fillStyle=o.accent; ctx.font="13px sans-serif";
    wrapText(ctx,o.desc,cx+cardW/2,y0+215,cardW-24,17);
    // 小元素图标点
    const ownedNow=Meta.isUnlocked(o.id);
    drawOutfitBiasTag(ctx,o.id,cx+cardW/2,y0+172);   // v0.15 流派标签
    ctx.font="12px sans-serif";
    if(!ownedNow){ ctx.fillStyle="rgba(200,180,255,0.55)";
      ctx.fillText("🔒 商店 · ◉"+Meta.outfitPrice(o.id),cx+cardW/2,y0+284); }
    else {
      const eq=Meta.getEquipped&&Meta.getEquipped()===o.id;
      ctx.fillStyle=eq?"#ffe66d":(hovered?"#7ed957":"rgba(126,217,87,0.75)");
      ctx.fillText(eq?"★ 当前装备 · 点此出战":(hovered?"▶ 点击出战":"✓ 已拥有"),cx+cardW/2,y0+284);
    }
  }
  ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font="16px sans-serif";
  ctx.fillText("WASD 移动 · P暂停 · M静音 · 技能全自动",VIEW_W/2,556);
  // 底部功能按钮：无尽 / 挑战 / 商店 / 衣柜 / 道具
  const bw=170,bh=48,bgap=12;
  const bTotal=bw*5+bgap*4;
  const bx0=(VIEW_W-bTotal)/2;
  START_BUTTONS=[
    {x:bx0,y:600,w:bw,h:bh,label:"▶ 无尽模式",action:"__endless"},
    {x:bx0+(bw+bgap),y:600,w:bw,h:bh,label:"⚔ 魔王挑战",action:"ch_select"},
    {x:bx0+(bw+bgap)*2,y:600,w:bw,h:bh,label:"🛒 商店",action:"shop"},
    {x:bx0+(bw+bgap)*3,y:600,w:bw,h:bh,label:"👗 衣柜",action:"wardrobe"},
  ];
  // 第 5 入口：战术道具
  START_BUTTONS.push({x:bx0+(bw+bgap)*4,y:600,w:bw,h:bh,label:"🧰 战术道具",action:"__gadgets"});
  // 第 6 入口：设置（小按钮放右上角金币下方）
  START_BUTTONS.push({x:VIEW_W-96,y:64,w:66,h:34,label:"⚙",action:"__settings"});
  ctx.textAlign="right"; ctx.fillStyle="#ffd700"; ctx.font="bold 20px sans-serif";
  ctx.fillText("◉ "+Meta.data.coins,VIEW_W-30,50);
  for(const b of START_BUTTONS){
    if(b.action==="__endless") continue;   // 无尽主入口由 tick 绘制绿色高亮版，避免文字重叠
    const hov=mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
    ctx.fillStyle=hov?"rgba(255,215,0,0.16)":"rgba(255,255,255,0.06)";
    ctx.strokeStyle=hov?"#ffd700":"rgba(255,255,255,0.3)";
    ctx.lineWidth=hov?2.5:1.5;
    ctx.beginPath(); ctx.roundRect(b.x,b.y,b.w,b.h,12); ctx.fill(); ctx.stroke();
    ctx.fillStyle=hov?"#ffd700":"rgba(255,255,255,0.75)";
    ctx.font="bold 19px sans-serif";
    ctx.fillText(b.label,b.x+b.w/2,b.y+31);
  }
}

// 开始界面可点按钮（由 drawStartScreen 填充）
let START_BUTTONS=[];

function drawOutfitPreview(c,o,x,y){
  c.save(); c.translate(x,y); c.scale(2.6,2.6);
  c.lineWidth=1.2; c.lineJoin="round"; c.strokeStyle="#241a2e";
  c.fillStyle="rgba(0,0,0,0.2)";
  c.beginPath(); c.ellipse(0,15,10,3.5,0,0,Math.PI*2); c.fill();
  c.fillStyle=o.cloth2;
  c.beginPath(); c.roundRect(-6,5,4.5,9,2); c.fill();
  c.beginPath(); c.roundRect(2,5,4.5,9,2); c.fill();
  // 身体
  switch(o.id){
    case "flame": case "holy":
      c.fillStyle=o.cloth;
      c.beginPath(); c.moveTo(-5,-2);
      c.quadraticCurveTo(-11,8,-9,13); c.lineTo(9,13);
      c.quadraticCurveTo(11,8,5,-2); c.closePath(); c.fill(); break;
    case "frost":
      c.fillStyle=o.cloth;
      c.beginPath(); c.moveTo(-7,-3);
      c.quadraticCurveTo(-10,9,-7,13); c.lineTo(7,13);
      c.quadraticCurveTo(10,9,7,-3); c.closePath(); c.fill(); break;
    default:
      c.fillStyle=o.cloth;
      c.beginPath(); c.roundRect(-7,-3,14,10,3); c.fill();
  }
  if(o.id==="storm"){ c.fillStyle=o.accent;
    c.beginPath(); c.arc(0,2,2.5,0,Math.PI*2); c.fill(); }
  if(o.id==="shadow"){ c.fillStyle=o.accent; c.fillRect(-8,-4,16,3.5); }
  if(o.id==="holy"){ c.fillStyle=o.accent;
    c.beginPath(); c.arc(0,1,1.6,0,Math.PI*2); c.fill(); }
  // 头
  c.fillStyle=o.body;
  c.beginPath(); c.arc(0,-12,10.5,0,Math.PI*2); c.fill();
  c.fillStyle=o.hair;
  c.beginPath(); c.arc(0,-15,10.5,Math.PI*1.05,Math.PI*1.95);
  c.lineTo(8.5,-13); c.quadraticCurveTo(0,-19,-8.5,-13); c.closePath(); c.fill();
  c.fillStyle="#241a2e";
  c.beginPath(); c.arc(3.5,-12,1.4,0,Math.PI*2); c.fill();
  c.beginPath(); c.arc(-1.5,-12,1.4,0,Math.PI*2); c.fill();
  c.strokeStyle="#241a2e"; c.lineWidth=1.2;
  c.beginPath(); c.arc(1,-9,2.2,0.15*Math.PI,0.85*Math.PI); c.stroke();
  c.restore();
}

// ---------- 升级三选一 ----------
let upgradeChoices=[];
function buildUpgradeChoices(){
  upgradeChoices=[];
  const pool=[];
  // v0.15 时装流派化：出战时装决定技能权重偏向
  const bias=(typeof outfitSkillBias==="function")?outfitSkillBias(player.outfit.id):null;
  // 已有技能可升级
  for(const s of player.skills)
    if(s.lv<SKILLS_META[s.id].maxLv) pool.push({type:"skillUp",id:s.id});
  // 新技能（未满6个）
  if(player.skills.length<6){
    const owned=new Set(player.skills.map(s=>s.id));
    const newOnes=Object.keys(SKILLS_META).filter(k=>!owned.has(k));
    for(const id of newOnes) pool.push({type:"skillNew",id});
  }
  for(const r of RUNES) pool.push({type:"rune",id:r.id});

  // 抽 3 个不重复：时装流派加成 + 保底（非偏向技能仍可出现）
  const weights=c=>{
    if(c.type==="rune")return 2;
    let w=5;
    if(bias&&c.type==="skillNew"&&bias.skills[c.id])w*=bias.skills[c.id];
    return w;
  };
  const chosen=[];
  const avail=[...pool];
  while(chosen.length<3&&avail.length>0){
    let tw=0; for(const a of avail) tw+=weights(a);
    let roll=Math.random()*tw, idx=0;
    for(let i=0;i<avail.length;i++){ roll-=weights(avail[i]); if(roll<=0){ idx=i; break; } }
    chosen.push(avail[idx]); avail.splice(idx,1);
  }
  upgradeChoices=chosen;
}

function applyUpgradeChoice(i){
  const c=upgradeChoices[i]; if(!c) return;
  if(c.type==="skillNew") player.skills.push({id:c.id,lv:1});
  else if(c.type==="skillUp"){
    const s=player.skills.find(s=>s.id===c.id); s.lv++;
    // 升级形态进化特效
    if(s.lv===SKILLS_META[c.id].maxLv)
      burst(player.x,player.y,30,{r0:3,r1:18,life:0.7,color:SKILLS_META[c.id].color,glow:true,spdMin:80,spdMax:260});
  }
  else { const r=RUNES.find(r=>r.id===c.id); r.apply(player); }
  pendingLevelUps--;
  upgradeChoices=[];
  if(typeof SFX!=="undefined") SFX.play("levelup");
  // v0.6：技能达到 Lv3/Lv5 → 弹出分支二选一
  if(c.type==="skillNew"||c.type==="skillUp"){
    if(typeof SkillBranchSys!=="undefined"){
      const s=player.skills.find(s=>s.id===c.id);
      SkillBranchSys.maybeOffer(c.id,s?s.lv:1);
    }
  }
}

function drawUpgradeScreen(){
  ctx.fillStyle="rgba(10,8,20,0.82)"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.textAlign="center";
  ctx.fillStyle="#ffe66d"; ctx.font="bold 40px sans-serif";
  ctx.fillText("✦ 升级！选择一项 ✦",VIEW_W/2,130);
  const cardW=280,cardH=330,gap=30;
  const x0=VIEW_W/2-(cardW*3+gap*2)/2, y0=190;
  for(let i=0;i<upgradeChoices.length;i++){
    const c=upgradeChoices[i];
    const cx=x0+i*(cardW+gap);
    const hovered=mouse.x>=cx&&mouse.x<=cx+cardW&&mouse.y>=y0&&mouse.y<=y0+cardH;
    let name,color,desc,lvText="";
    if(c.type==="skillNew"||c.type==="skillUp"){
      const m=SKILLS_META[c.id];
      name=m.name; color=m.color;
      lvText=c.type==="skillNew"?"新技能!":`Lv ${player.skillLv(c.id)} → ${player.skillLv(c.id)+1}`;
      desc=c.type==="skillNew"?m.lvDesc[0]:m.lvDesc[player.skillLv(c.id)];
    } else {
      const r=RUNES.find(r=>r.id===c.id);
      name=r.name; color=r.color; desc=r.desc; lvText="属性符文";
    }
    ctx.save();
    if(hovered){ ctx.shadowColor=color; ctx.shadowBlur=26; }
    ctx.fillStyle=hovered?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.06)";
    ctx.strokeStyle=color; ctx.lineWidth=hovered?4:2;
    ctx.beginPath(); ctx.roundRect(cx,y0,cardW,cardH,16); ctx.fill(); ctx.stroke();
    ctx.restore();
    // 图标
    ctx.save(); ctx.translate(cx+cardW/2,y0+90);
    ctx.fillStyle=color; ctx.globalAlpha=0.25;
    ctx.beginPath(); ctx.arc(0,0,44,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle=color;
    ctx.beginPath(); ctx.arc(0,0,26,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.85)";
    ctx.font="bold 24px sans-serif"; ctx.textAlign="center";
    ctx.fillText(name[0],0,9);
    ctx.restore();
    ctx.textAlign="center";
    // 类型徽章（区分 新技能/升级/符文，白字彩色底跳出）
    let btxt,bbg;
    if(c.type==="rune"){ btxt="属性符文"; bbg="#d99a2b"; }
    else if(c.type==="skillUp"){ const lv=player.skillLv(c.id); btxt=`升级 · Lv${lv}→${lv+1}`; bbg="#4ea1ff"; }
    else { btxt="新技能"; bbg=color; }
    ctx.font="bold 13px sans-serif";
    const bw=ctx.measureText(btxt).width+28;
    ctx.fillStyle=bbg;
    ctx.beginPath(); ctx.roundRect(cx+cardW/2-bw/2, y0+139, bw, 24, 12); ctx.fill();
    ctx.fillStyle="#fff";
    ctx.fillText(btxt,cx+cardW/2,y0+156);
    ctx.fillStyle="#fff"; ctx.font="bold 24px sans-serif";
    ctx.fillText(name,cx+cardW/2,y0+195);
    ctx.fillStyle="rgba(255,255,255,0.75)"; ctx.font="15px sans-serif";
    wrapText(ctx,desc||"",cx+cardW/2,y0+230,cardW-36,20);
    ctx.fillStyle="rgba(255,255,255,0.35)"; ctx.font="13px sans-serif";
    ctx.fillText(`[${i+1}]`,cx+cardW/2,y0+305);
  }
}

function wrapText(c,text,x,y,maxW,lh){
  const chars=text.split(""); let line="",yy=y;
  for(const ch of chars){
    if(c.measureText(line+ch).width>maxW){ c.fillText(line,x,yy); line=ch; yy+=lh; }
    else line+=ch;
  }
  if(line) c.fillText(line,x,yy);
}

// ---------- HUD ----------
function drawHUD(){
  // 血条
  ctx.fillStyle="rgba(0,0,0,0.55)";
  ctx.beginPath(); ctx.roundRect(20,20,320,34,10); ctx.fill();
  ctx.fillStyle="#3a2030";
  ctx.fillRect(28,27,304,20);
  const hpk=Math.max(0,player.hp/player.maxHp);
  ctx.fillStyle=hpk>0.35?"#7ed957":"#ff5c5c";
  ctx.fillRect(28,27,304*hpk,20);
  ctx.fillStyle="#fff"; ctx.font="bold 14px sans-serif"; ctx.textAlign="left";
  ctx.fillText(`${Math.ceil(player.hp)} / ${Math.ceil(player.maxHp)}`,32,41);
  // 等级与经验（宽度让位于顶部计时胶囊，避免重叠）
  ctx.fillStyle="rgba(0,0,0,0.55)";
  ctx.beginPath(); ctx.roundRect(350,20,196,34,10); ctx.fill();
  ctx.fillStyle="#134e4a"; ctx.fillRect(358,27,180,20);
  const xpk=player.xp/player.xpNext();
  ctx.fillStyle="#5eead4"; ctx.fillRect(358,27,180*Math.min(1,xpk),20);
  ctx.fillStyle="#fff"; ctx.font="bold 14px sans-serif";
  ctx.fillText(`Lv.${player.level}`,364,41);
  // 时间胶囊
  ctx.save();
  const tg=ctx.createLinearGradient(VIEW_W/2-85,8,VIEW_W/2-85,54);
  tg.addColorStop(0,"rgba(30,24,48,0.62)");tg.addColorStop(1,"rgba(14,10,26,0.62)");
  ctx.fillStyle=tg;
  ctx.beginPath();ctx.roundRect(VIEW_W/2-85,8,170,46,23);ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.16)";ctx.lineWidth=1.4;ctx.stroke();
  ctx.restore();
  const remain=Math.max(0,BOSS_TIME-gameTime);
  ctx.textAlign="center";
  ctx.fillStyle=remain<60?"#ff8080":"#fff";
  ctx.font="bold 30px monospace";
  const mm=String(Math.floor(remain/60)).padStart(2,"0"), ss=String(Math.floor(remain%60)).padStart(2,"0");
  ctx.fillText(`${mm}:${ss}`,VIEW_W/2,44);
  // 右侧战绩面板
  ctx.save();
  const rg=ctx.createLinearGradient(VIEW_W-224,8,VIEW_W-224,102);
  rg.addColorStop(0,"rgba(30,24,48,0.62)");rg.addColorStop(1,"rgba(14,10,26,0.62)");
  ctx.fillStyle=rg;
  ctx.beginPath();ctx.roundRect(VIEW_W-224,8,212,94,14);ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.16)";ctx.lineWidth=1.4;ctx.stroke();
  ctx.restore();
  ctx.textAlign="right"; ctx.fillStyle="#fff"; ctx.font="bold 16px sans-serif";
  ctx.fillText(`☠ ${player.kills}`,VIEW_W-28,32);
  ctx.fillStyle="#ffd700";
  ctx.fillText(`◉ ${player.coins}`,VIEW_W-28,56);
  ctx.fillStyle="#ffe66d"; ctx.font="bold 19px sans-serif";
  ctx.shadowColor="rgba(0,0,0,.8)";ctx.shadowBlur=5;
  ctx.fillText(player.outfit.name,VIEW_W-28,82);
  ctx.shadowBlur=0;
  // 技能栏
  let sx=20;
  for(const s of player.skills){
    const m=SKILLS_META[s.id];
    ctx.fillStyle="rgba(0,0,0,0.55)";
    ctx.beginPath(); ctx.roundRect(sx,66,54,54,10); ctx.fill();
    ctx.strokeStyle=m.color; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.roundRect(sx,66,54,54,10); ctx.stroke();
    ctx.fillStyle=m.color;
    ctx.beginPath(); ctx.arc(sx+27,88,14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.font="bold 15px sans-serif"; ctx.textAlign="center";
    ctx.fillText(m.name[0],sx+27,94);
    ctx.fillStyle="#ffe66d"; ctx.font="bold 12px sans-serif";
    ctx.fillText("Lv"+s.lv,sx+27,112);
    sx+=62;
  }
  // 圣物栏（第二行）：稀有度描边 + 图标字
  if(player.relics&&player.relics.length>0){
    let rx=20;
    for(const r of player.relics){
      const col=RELIC_RARITY[r.rarity].color;
      ctx.fillStyle="rgba(0,0,0,0.55)";
      ctx.beginPath(); ctx.roundRect(rx,128,40,40,8); ctx.fill();
      ctx.strokeStyle=col; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(rx,128,40,40,8); ctx.stroke();
      const def=RELICS.find(d=>d.id===r.id);
      ctx.fillStyle=col; ctx.font="bold 16px sans-serif"; ctx.textAlign="center";
      ctx.fillText(def?def.icon:"?",rx+20,152);
      rx+=46;
    }
  }
}

// ---------- 结算 ----------
function drawEndScreen(win){
  ctx.fillStyle="rgba(10,8,20,0.88)"; ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.textAlign="center";
  ctx.fillStyle=win?"#ffe66d":"#ff6b6b";
  ctx.font="bold 56px sans-serif";
  ctx.fillText(win?"★ 讨伐成功！ ★":"你被怪潮吞没了…",VIEW_W/2,220);
  ctx.fillStyle="#fff"; ctx.font="22px sans-serif";
  const mm=String(Math.floor(gameTime/60)).padStart(2,"0");
  const ss=String(Math.floor(gameTime%60)).padStart(2,"0");
  ctx.fillText(`存活 ${mm}:${ss}   击杀 ${player.kills}   等级 Lv.${player.level}`,VIEW_W/2,290);
  // 金币结算（局外经济）
  ctx.fillStyle="#ffd700"; ctx.font="bold 20px sans-serif";
  ctx.fillText(`◉ 本局金币 ${player.coins} → 钱包总额 ${Meta.data.coins}`,VIEW_W/2,330);
  // 本局构筑
  ctx.font="17px sans-serif"; ctx.fillStyle="rgba(255,255,255,0.8)";
  let names=player.skills.map(s=>`${SKILLS_META[s.id].name}Lv${s.lv}`).join(" · ");
  ctx.fillText(names||"（无技能）",VIEW_W/2,340);
  ctx.fillStyle="#b8a9d9"; ctx.font="18px sans-serif";
  ctx.fillText("按 [R] 再来一局 · 按 [Q] 返回选装",VIEW_W/2,430);
}
