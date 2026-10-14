// ===== v0.10 道具选择界面（无尽备战 & 挑战备战共用）=====
// gameState='gadget_select'：从 GADGETS 选 ≤6 个，显示羁绊预览。
let GSel={picked:[],cardRects:[],backTo:"start"};

const GadgetSelectUI = {
  open(backTo){ GSel.picked=[]; GSel.backTo=backTo||"start"; gameState="gadget_select"; },

  draw(ctx){
    ctx.fillStyle="#14121f";ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.textAlign="center";
    ctx.fillStyle="#7ed957";ctx.font="bold 36px sans-serif";
    ctx.fillText("战 术 道 具",VIEW_W/2,64);
    ctx.fillStyle="#b8a9d9";ctx.font="15px sans-serif";
    ctx.fillText(`选择最多 6 件 · 战斗中自动触发 · 组合触发羁绊`,VIEW_W/2,94);
    // 已选羁绊预览
    const syn=SYNERGIES.filter(s=>this._match(s));
    if(syn.length){
      let txt="✦ 羁绊：";
      for(const s of syn)txt+=`${s.name} `;
      ctx.fillStyle="#ffd93d";ctx.font="bold 17px sans-serif";
      ctx.fillText(txt,VIEW_W/2,124);
    } else {
      ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="14px sans-serif";
      ctx.fillText("尚未组成任何羁绊",VIEW_W/2,124);
    }
    GSel.cardRects=[];
    const cw=176,ch=150,gx=10,gy=12;
    const cols=5;
    const x0=(VIEW_W-(cw*cols+gx*(cols-1)))/2,y0=146;
    GADGETS.forEach((g,i)=>{
      const col=i%cols,row=Math.floor(i/cols);
      const cx=x0+col*(cw+gx),cy=y0+row*(ch+gy);
      const picked=GSel.picked.includes(g.id);
      const hov=mouse.x>=cx&&mouse.x<=cx+cw&&mouse.y>=cy&&mouse.y<=cy+ch;
      GSel.cardRects.push({x:cx,y:cy,w:cw,h:ch,id:g.id});
      // 相关羁绊高亮
      const inSyn=SYNERGIES.some(s=>s.need.includes(g.id)&&GSel.picked.filter(p=>s.need.includes(p)).length>0||SYNERGIES.some(ss=>ss.id==="matrix"));
      ctx.save();
      if(picked){ctx.shadowColor=g.color;ctx.shadowBlur=16;}
      ctx.fillStyle=picked?"rgba(255,255,255,.13)":"rgba(255,255,255,.05)";
      ctx.strokeStyle=picked?g.color:(hov?"rgba(255,255,255,.55)":"rgba(255,255,255,.22)");
      ctx.lineWidth=picked?3.2:(hov?2.4:1.5);
      ctx.beginPath();ctx.roundRect(cx,cy,cw,ch,12);ctx.fill();ctx.stroke();
      ctx.restore();
      ctx.textAlign="center";
      ctx.font="26px sans-serif";
      ctx.fillText(g.icon,cx+cw/2,cy+40);
      ctx.fillStyle=picked?"#ffe66d":"#fff";ctx.font="bold 15px sans-serif";
      ctx.fillText(g.name,cx+cw/2,cy+68);
      ctx.fillStyle="rgba(255,255,255,.62)";ctx.font="11.5px sans-serif";
      wrapText(ctx,g.desc,cx+cw/2,cy+90,cw-20,14);
      // CD 标注
      ctx.fillStyle="rgba(178,169,217,.8)";ctx.font="11px sans-serif";
      ctx.fillText("CD "+g.cd+"s",cx+cw/2,cy+138);
      if(picked){
        ctx.fillStyle="#ffe66d";ctx.font="bold 13px sans-serif";
        ctx.fillText("✓ "+(GSel.picked.indexOf(g.id)+1),cx+18,cy+22);
      }
    });
    // 出发按钮
    const ok=GSel.picked.length>0;
    ctx.save();
    if(ok){ctx.shadowColor="#7ed957";ctx.shadowBlur=14;}
    ctx.fillStyle=ok?"rgba(126,217,87,.18)":"rgba(255,255,255,.05)";
    ctx.strokeStyle=ok?"#7ed957":"rgba(255,255,255,.25)";
    ctx.lineWidth=2.4;
    ctx.beginPath();ctx.roundRect(VIEW_W/2-140,520,280,52,13);ctx.fill();ctx.stroke();
    ctx.restore();
    ctx.fillStyle=ok?"#a5f08c":"#777";ctx.font="bold 21px sans-serif";
    ctx.fillText(ok?`出 击（${GSel.picked.length}/6）`:"至少选择 1 件道具",VIEW_W/2,553);
    ctx.fillStyle="rgba(255,255,255,.45)";ctx.font="14px sans-serif";
    ctx.fillText("[Q] 跳过直接出击 · [C] 清空选择",VIEW_W/2,600);
  },

  _match(s){
    if(s.minCount)return GSel.picked.length>0&&s.need.every(n=>true)&&GSel.picked.length>=(s.minCount-1)&&s.need.every(id=>GSel.picked.includes(id)||GSel.picked.length>=3);
    return s.need.every(id=>GSel.picked.includes(id));
  },

  onClick(x,y){
    for(const r of GSel.cardRects){
      if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h){
        const at=GSel.picked.indexOf(r.id);
        if(at>=0)GSel.picked.splice(at,1);
        else{
          if(GSel.picked.length>=6){
            this.toast("最多携带 6 件");
            return;
          }
          GSel.picked.push(r.id);
        }
        if(typeof SFX!=="undefined")SFX.play("ui");
        return;
      }
    }
    // 出发按钮
    if(x>=VIEW_W/2-140&&x<=VIEW_W/2+140&&y>=520&&y<=572&&GSel.picked.length>0){
      this.launch();
    }
  },
  toast(t){
    spawnDmgText(VIEW_W/2,300,t,"#ff9e9e");
  },
  launch(){
    Gadgets.reset(GSel.picked);
    try{Meta.data.gadgetPreset=GSel.picked.slice();Meta.save();}catch(e){}
    gameState=GSel.backTo;
    if(typeof SFX!=="undefined")SFX.play("levelup");
  },
};
