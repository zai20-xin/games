// ===== v0.7 程序化 BGM：chiptune 循环，随章节/Boss 切换 =====
// 结构：低音方波贝斯 + 三角波琶音旋律 + 噪声打击，16步音序器循环。
// 每章不同调式与速度；Boss 战切换小调紧张曲。M 键静音同样作用于 BGM。
// 注意：SFX 静音联动采用「读取时判断」而非包装，避免脚本加载顺序问题。

const BGM = {
  playing:false, muted:false, timer:null,
  step:0, bpm:112, trackIdx:0,
  // 音阶（半音偏移，基于根音）
  SCALES:{
    major:[0,2,4,7,9],        // 五声音阶大调
    dorian:[0,2,3,7,9],       // 多利亚
    minor:[0,3,5,7,10],       // 小调五声
    phrygian:[0,1,3,7,8],     // 弗里吉亚（紧张）
  },
  // 各章节曲目配置
  TRACKS:[
    { name:"翠野晨风", root:220.0, scale:"major",   bpm:104, bassPat:[0,0,4,4,2,2,4,4],
      arpPat:[0,4,2,4, 0,4,2,7, 0,4,2,4, 9,7,4,2] },
    { name:"林谷低语", root:196.0, scale:"dorian",  bpm:116, bassPat:[0,0,3,3,5,5,3,3],
      arpPat:[0,3,5,3, 7,5,3,5, 0,3,5,3, 10,7,5,3] },
    { name:"深渊前庭", root:174.6, scale:"minor",   bpm:126, bassPat:[0,0,5,5,3,3,7,7],
      arpPat:[0,5,3,5, 7,10,7,5, 0,5,3,5, 12,10,7,5] },
    { name:"魔王逼近", root:155.6, scale:"phrygian",bpm:140, bassPat:[0,0,1,1,0,0,3,3],
      arpPat:[0,3,1,3, 5,3,1,3, 0,3,1,3, 8,7,5,1] },
  ],

  _ac(){ return (typeof SFX!=="undefined"&&SFX.ac)?SFX.ac:null; },

  // 频率换算：root * 2^(semitone/12) * 2^(octave)
  _freq(root,semi,oct){ return root*Math.pow(2,semi/12)*Math.pow(2,oct); },

  _note(type,freq,dur,vol){
    const ac=this._ac(); if(!ac||this.muted||(typeof SFX!=="undefined"&&SFX.muted)) return;
    try{
      const t=ac.currentTime;
      const o=ac.createOscillator(),g=ac.createGain();
      o.type=type; o.frequency.value=freq;
      g.gain.setValueAtTime(vol,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+dur);
      o.connect(g); g.connect(SFX.master);
      o.start(t); o.stop(t+dur+0.02);
    }catch(e){}
  },
  _drum(kind){
    const ac=this._ac(); if(!ac||this.muted||(typeof SFX!=="undefined"&&SFX.muted)) return;
    try{
      const t=ac.currentTime,sr=ac.sampleRate;
      if(kind==="kick"){
        const o=ac.createOscillator(),g=ac.createGain();
        o.type="sine";o.frequency.setValueAtTime(130,t);
        o.frequency.exponentialRampToValueAtTime(38,t+.11);
        g.gain.setValueAtTime(.34,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);
        o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+.14);
      } else {
        const len=Math.floor(sr*(kind==="hat"?.03:.07));
        const buf=ac.createBuffer(1,len,sr),d=buf.getChannelData(0);
        for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
        const s=ac.createBufferSource();s.buffer=buf;
        const f=ac.createBiquadFilter();f.type="highpass";
        f.frequency.value=kind==="hat"?7000:1800;
        const g=ac.createGain();g.gain.value=kind==="hat"?.09:.17;
        s.connect(f);f.connect(g);g.connect(SFX.master);s.start(t);
      }
    }catch(e){}
  },

  // 音序器每步
  _tickStep(){
    // 读取时判断 SFX.muted（不包装，避免加载顺序问题）
    if(typeof SFX!=="undefined"&&SFX.muted) return;
    const tr=this.TRACKS[this.trackIdx];
    const sc=this.SCALES[tr.scale];
    const st=this.step%16;
    // 贝斯：每2步一个音
    if(st%2===0){
      const semi=tr.bassPat[(st/2)%8];
      this._note("square",this._freq(tr.root,semi,-1),.22,.13);
    }
    // 琶音旋律
    const semi=tr.arpPat[st];
    if(semi!==null&&semi!==undefined)
      this._note("triangle",this._freq(tr.root,semi,st%8>=4?1:0),.13,.085);
    // 打击
    if(st%4===0)this._drum("kick");
    if(st%4===2)this._drum("snare");
    if(st%2===1)this._drum("hat");
    this.step++;
  },

  play(trackIdx){
    const ac=this._ac();
    if(!ac){ // AudioContext 未建（用户还没交互），挂起待解锁
      this.trackIdx=trackIdx!==undefined?trackIdx:this.trackIdx;
      return false;
    }
    if(trackIdx!==undefined)this.trackIdx=trackIdx;
    if(this.playing)return true;
    this.playing=true; this.step=0;
    const tr=this.TRACKS[this.trackIdx];
    this.bpm=tr.bpm;
    const interval=60000/this.bpm/2;   // 8分音符步长
    const self=this;
    this.timer=setInterval(function(){ self._tickStep(); },interval);
    return true;
  },
  stop(){
    this.playing=false;
    if(this.timer){clearInterval(this.timer);this.timer=null;}
  },
  toggleMute(){ this.muted=!this.muted; return this.muted; },
};

// 与 SFX.muted 联动：BGM 播放时实时读取 SFX.muted（见 _tickStep/_note/_drum），
// 不再包装 SFX.toggleMute —— 避免脚本加载顺序导致包装丢失。
