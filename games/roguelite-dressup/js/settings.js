// ===== v0.16 设置菜单：BGM/SFX 音量分级 + 震屏开关 =====
// 标题界面 [⚙设置] 进入；配置持久化。

const Settings = {
  bgmVol:0.7, sfxVol:0.8, shake:true, muted:false,
  _storage:null,
  setStorage(s){this._storage=s;},
  load(){
    try{
      const s=this._storage||((typeof localStorage!=="undefined")?localStorage:null);
      if(!s)return;
      const raw=s.getItem("huanzhuang_settings_v1");
      if(raw){
        const o=JSON.parse(raw);
        if(o&&typeof o==="object"){
          if(typeof o.bgmVol==="number")this.bgmVol=o.bgmVol;
          if(typeof o.sfxVol==="number")this.sfxVol=o.sfxVol;
          this.shake=!!o.shake;
          if(typeof o.muted==="boolean")this.muted=o.muted;
        }
      }
    }catch(e){}
    this.apply();
  },
  save(){
    try{
      const s=this._storage||((typeof localStorage!=="undefined")?localStorage:null);
      if(s)s.setItem("huanzhuang_settings_v1",JSON.stringify({bgmVol:this.bgmVol,sfxVol:this.sfxVol,shake:this.shake,muted:this.muted}));
    }catch(e){}
  },
  apply(){
    // BGM 音量
    if(typeof BGM!=="undefined"&&typeof SFX!=="undefined"&&SFX.ac&&SFX.master){
      try{ BGM._gain=BGM._gain||null; }catch(e){}
    }
    if(typeof BGM!=="undefined")BGM.vol=this.bgmVol;
    // SFX 音量 + 静音状态（master 未初始化时仅记标记，SFX.init 会按 muted 设增益）
    if(typeof SFX!=="undefined"){
      SFX.userVol=this.sfxVol;
      if(typeof this.muted==="boolean"&&this.muted!==SFX.muted){
        SFX.muted=this.muted;
        if(SFX.master)SFX.master.gain.value=SFX.muted?0:0.25;
      }
    }
    // 震屏开关
    window.__shakeOff=!this.shake;
  },
  setMuted(m){ this.muted=!!m; this.save(); },
  toggleShake(){ this.shake=!this.shake; window.__shakeOff=!this.shake; this.save(); return this.shake; },
};

// 震屏开关接入 Shake
if(typeof Shake!=="undefined"){
  const __origAdd=Shake.add.bind(Shake);
  Shake.add=function(n){
    if(window.__shakeOff)return 0;
    return __origAdd(n);
  };
}

// 设置界面状态
let SettingsUI={ open:false, bars:{bgm:null,sfx:null} };

function drawSettingsScreen(ctx){
  ctx.fillStyle="rgba(10,8,20,.92)";ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.textAlign="center";
  ctx.fillStyle="#ffe66d";ctx.font="bold 38px sans-serif";
  ctx.fillText("⚙ 设 置",VIEW_W/2,110);

  const rows=[
    {key:"bgm", label:"🎵 音乐音量", get:()=>Settings.bgmVol, set:v=>{Settings.bgmVol=v;}},
    {key:"sfx", label:"🔊 音效音量", get:()=>Settings.sfxVol, set:v=>{Settings.sfxVol=v;}},
  ];
  SettingsUI.rows=rows.map(r=>{
    const val=r.get();
    const bx=VIEW_W/2-220,by=190+rows.indexOf(r)*120,bw=440,bh=26;
    return {r,bx,by,bw,bh};
  });
  for(const row of SettingsUI.rows){
    ctx.fillStyle="#fff";ctx.font="bold 20px sans-serif";ctx.textAlign="left";
    ctx.fillText(row.r.label,row.bx,row.by-12);
    // 音量条
    const val=row.r.get();
    ctx.fillStyle="rgba(255,255,255,.12)";
    ctx.beginPath();ctx.roundRect(row.bx,row.by,row.bw,row.bh,13);ctx.fill();
    const g=ctx.createLinearGradient(row.bx,0,row.bx+row.bw,0);
    g.addColorStop(0,"#7ed957");g.addColorStop(1,"#ffe66d");
    ctx.fillStyle=g;
    ctx.beginPath();ctx.roundRect(row.bx+3,row.by+3,(row.bw-6)*val,row.bh-6,11);ctx.fill();
    // 刻度块（10格）
    for(let k=1;k<10;k++){
      ctx.fillStyle="rgba(20,16,32,.55)";
      ctx.fillRect(row.bx+k*row.bw/10-1.5,row.by+2,3,row.bh-4);
    }
    ctx.fillStyle="#fff";ctx.font="bold 15px sans-serif";ctx.textAlign="right";
    ctx.fillText(Math.round(val*100)+"%",row.bx+row.bw,row.by-12);
  }

  // 震屏开关
  const sy=430;
  ctx.textAlign="left";
  ctx.fillStyle="#fff";ctx.font="bold 20px sans-serif";
  ctx.fillText("📳 屏幕震动",VIEW_W/2-220,sy-12);
  const on=Settings.shake;
  ctx.fillStyle=on?"rgba(126,217,87,.25)":"rgba(255,255,255,.08)";
  ctx.strokeStyle=on?"#7ed957":"rgba(255,255,255,.35)";ctx.lineWidth=2.2;
  ctx.beginPath();ctx.roundRect(VIEW_W/2-220,sy,440,44,22);ctx.fill();ctx.stroke();
  // 滑块位置
  ctx.fillStyle=on?"#7ed957":"rgba(255,255,255,.5)";
  ctx.beginPath();
  if(on)ctx.roundRect(VIEW_W/2-220+440-46+2,sy+3,42,38,18);
  else ctx.roundRect(VIEW_W/2-220+4,sy+3,42,38,18);
  ctx.fill();
  ctx.fillStyle="#14121f";ctx.font="bold 14px sans-serif";ctx.textAlign="center";
  if(on){ctx.fillText("开",VIEW_W/2-220+440-24,sy+27);ctx.fillStyle="rgba(255,255,255,.5)";ctx.fillText("关",VIEW_W/2-220+26,sy+27);}
  else{ctx.fillStyle="rgba(255,255,255,.5)";ctx.fillText("开",VIEW_W/2-220+440-24,sy+27);ctx.fillStyle="#fff";ctx.fillText("关",VIEW_W/2-220+26,sy+27);}

  ctx.fillStyle="rgba(255,255,255,.45)";ctx.font="15px sans-serif";ctx.textAlign="center";
  ctx.fillText("点击音量条设定 · 点击震屏行切换 · [Q] 返回标题",VIEW_W/2,560);
}

function settingsClick(x,y){
  for(const row of (SettingsUI.rows||[])){
    if(x>=row.bx&&x<=row.bx+row.bw&&y>=row.by-30&&y<=row.by+row.bh+6){
      const v=Math.min(1,Math.max(0,(x-row.bx)/row.bw));
      const snapped=Math.round(v*10)/10;
      row.r.set(snapped);
      Settings.apply(); Settings.save();
      if(typeof SFX!=="undefined")SFX.play("ui");
      return true;
    }
  }
  // 震屏行
  if(y>=430&&y<=474&&x>=VIEW_W/2-220&&x<=VIEW_W/2+220){
    Settings.toggleShake(); Settings.save();
    if(Settings.shake)Shake.add(6);
    if(typeof SFX!=="undefined")SFX.play("ui");
    return true;
  }
  return false;
}
