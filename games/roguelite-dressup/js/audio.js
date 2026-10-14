// ===== 程序化音效引擎：WebAudio 合成，零音频素材 =====
// 浏览器策略要求首次用户交互后才能出声：unlock() 在首次按键/点击时调用。
// SFX.play(name) 带每音效最小间隔限流，防止怪潮时音频刷屏；toggleMute 全局静音。

const SFX = {
  ac:null,            // AudioContext（懒创建）
  master:null,        // 主增益
  muted:false,
  _last:{},           // 每音效上次播放时刻（限流用）

  MIN_INTERVAL:{      // 秒
    gem:0.05, kill:0.07, shoot:0.09, boom:0.10, hurt:0.15,
    potion:0.2, magnet:0.3, relic:0.25, ring:0.15,
    levelup:0.3, evolution:0.5, bosspawn:1.0, victory:1.0, defeat:1.0, ui:0.05,
  },

  unlock(){
    if(this.ac) { if(this.ac.state==="suspended") this.ac.resume(); return; }
    try{
      if(typeof AudioContext==="undefined") return;
      this.ac=new AudioContext();
      this.master=this.ac.createGain();
      this.master.gain.value=this.muted?0:0.25;
      this.master.connect(this.ac.destination);
    }catch(e){ this.ac=null; }
  },
  toggleMute(){
    this.muted=!this.muted;
    if(this.master) this.master.gain.value=this.muted?0:0.25;
    return this.muted;
  },

  _ok(name){
    if(this.muted||!this.ac) return false;
    const now=performance.now()/1000;
    const iv=this.MIN_INTERVAL[name]||0.08;
    if(this._last[name]&&now-this._last[name]<iv) return false;
    this._last[name]=now;
    return true;
  },

  // 基础合成器：振荡器滑音 + 包络
  _tone(opt){
    const t=this.ac.currentTime;
    const o=this.ac.createOscillator(), g=this.ac.createGain();
    o.type=opt.type||"sine";
    o.frequency.setValueAtTime(opt.f0,t);
    if(opt.f1) o.frequency.exponentialRampToValueAtTime(Math.max(1,opt.f1),t+opt.dur);
    g.gain.setValueAtTime(opt.vol||0.5,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+opt.dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t+opt.dur+0.02);
  },
  // 噪声爆发（爆炸/受击质感）
  _noise(opt){
    const t=this.ac.currentTime, sr=this.ac.sampleRate;
    const len=Math.floor(sr*opt.dur);
    const buf=this.ac.createBuffer(1,len,sr);
    const d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const src=this.ac.createBufferSource(); src.buffer=buf;
    const g=this.ac.createGain(); g.gain.value=opt.vol||0.4;
    const f=this.ac.createBiquadFilter();
    f.type=opt.hp?"highpass":"lowpass"; f.frequency.value=opt.cut||800;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  play(name){
    if(!this._ok(name)) return false;
    switch(name){
      case "shoot":   this._tone({type:"triangle",f0:520,f1:180,dur:0.09,vol:0.22}); break;
      case "boom":    this._noise({dur:0.28,cut:500,vol:0.5});
                      this._tone({type:"sawtooth",f0:140,f1:40,dur:0.22,vol:0.4}); break;
      case "frost":   this._tone({type:"sine",f0:1320,f1:1980,dur:0.14,vol:0.25}); break;
      case "zap":     this._tone({type:"square",f0:900,f1:120,dur:0.11,vol:0.22});
                      this._noise({dur:0.08,cut:2400,hp:true,vol:0.18}); break;
      case "poison":  this._tone({type:"sine",f0:220,f1:110,dur:0.16,vol:0.3}); break;
      case "holy":    this._tone({type:"sine",f0:784,dur:0.2,vol:0.3});
                      this._tone({type:"sine",f0:1175,dur:0.26,vol:0.22}); break;
      case "kill":    this._noise({dur:0.09,cut:900,vol:0.3}); break;
      case "gem":     this._tone({type:"sine",f0:880,f1:1318,dur:0.07,vol:0.16}); break;
      case "coin":    this._tone({type:"square",f0:1568,dur:0.06,vol:0.14}); break;
      case "potion":  this._tone({type:"triangle",f0:520,f1:1040,dur:0.16,vol:0.32}); break;
      case "magnet":  this._tone({type:"sine",f0:392,f1:1568,dur:0.3,vol:0.3}); break;
      case "relic":   this._tone({type:"sine",f0:659,dur:0.24,vol:0.32});
                      this._tone({type:"sine",f0:988,dur:0.34,vol:0.26});
                      this._tone({type:"sine",f0:1319,dur:0.42,vol:0.2}); break;
      case "levelup": [523,659,784].forEach((f,i)=>{
                        setTimeout(()=>{try{this._tone({type:"triangle",f0:f,dur:0.16,vol:0.34});}catch(e){}},i*80);}); break;
      case "evolution":this._tone({type:"sawtooth",f0:110,f1:880,dur:0.55,vol:0.4});
                       this._noise({dur:0.4,cut:1600,hp:true,vol:0.22});
                       [784,988,1175].forEach((f,i)=>{
                         setTimeout(()=>{try{this._tone({type:"sine",f0:f,dur:0.3,vol:0.3});}catch(e){}},250+i*90);}); break;
      case "hurt":    this._tone({type:"sawtooth",f0:130,f1:55,dur:0.18,vol:0.5});
                      this._noise({dur:0.12,cut:400,vol:0.35}); break;
      case "ring":    this._tone({type:"square",f0:330,f1:220,dur:0.13,vol:0.3}); break;
      case "bosspawn":this._tone({type:"sawtooth",f0:65,f1:38,dur:0.9,vol:0.55});
                      this._noise({dur:0.7,cut:260,vol:0.5}); break;
      case "victory": [523,659,784,1047].forEach((f,i)=>{
                        setTimeout(()=>{try{this._tone({type:"triangle",f0:f,dur:0.22,vol:0.36});}catch(e){}},i*130);}); break;
      case "defeat":  [392,311,233].forEach((f,i)=>{
                        setTimeout(()=>{try{this._tone({type:"sawtooth",f0:f,dur:0.3,vol:0.34});}catch(e){}},i*160);}); break;
      case "ui":      this._tone({type:"sine",f0:988,dur:0.04,vol:0.12}); break;
      default: return false;
    }
    return true;
  },
};
