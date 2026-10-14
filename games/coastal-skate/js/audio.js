// ===================== Audio =====================
// Web Audio 合成音效；muted 状态由 main 持久化到 <id>:settings
export const Audio2={
  ctx:null,muted:false,
  init(){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}},
  beep(f,d,t,v){if(!this.ctx||this.muted)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=t||'sine';o.frequency.value=f;g.gain.setValueAtTime(0,this.ctx.currentTime);g.gain.linearRampToValueAtTime(v||0.08,this.ctx.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+d);o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d)},
  jump(){this.beep(520,0.12,'sine',0.06)},
  djump(){this.beep(680,0.1,'sine',0.06)},
  land(){this.beep(180,0.06,'triangle',0.04)},
  collect(){this.beep(880,0.08,'sine',0.07);setTimeout(()=>this.beep(1320,0.12,'sine',0.05),50)},
  hit(){this.beep(120,0.25,'sawtooth',0.08)},
  stomp(){this.beep(440,0.06,'square',0.06);setTimeout(()=>this.beep(220,0.1,'square',0.05),40)},
  powerup(){this.beep(523,0.08,'sine',0.08);setTimeout(()=>this.beep(659,0.08,'sine',0.08),60);setTimeout(()=>this.beep(784,0.15,'sine',0.06),120)},
  dash(){this.beep(200,0.15,'sawtooth',0.05)},
  slide(){this.beep(280,0.15,'sawtooth',0.05)},
  gameover(){this.beep(200,0.3,'triangle',0.08);setTimeout(()=>this.beep(150,0.4,'triangle',0.06),200);setTimeout(()=>this.beep(100,0.6,'triangle',0.05),500)}
};
