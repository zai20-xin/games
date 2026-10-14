'use strict';
/* ============ 音效合成（Web Audio API）+ 语音播报 + 静音开关 ============ */
const Sound = (function () {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('chess_muted') === '1'; } catch (e) {}

  function isMuted() { return muted; }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('chess_muted', m ? '1' : '0'); } catch (e) {}
  }
  function toggleMuted() { setMuted(!muted); return muted; }

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, opts = {}) {
    const c = init();
    if (!c || muted) return;
    const { type = 'sine', gain = 0.25, when = 0, slideTo = null, attack = 0.006 } = opts;
    const t0 = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(30, freq), t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.06);
  }

  function noise(dur, opts = {}) {
    const c = init();
    if (!c || muted) return;
    const { gain = 0.25, when = 0, filter = 1200, type = 'lowpass', slide = null } = opts;
    const t0 = c.currentTime + when;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filter, t0);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t0);
  }

  // 万马奔腾：连续快节奏蹄声
  function hooves() {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const t = i * 0.07;
      noise(0.05, { gain: 0.3 - i * 0.03, filter: 500, when: t });
      tone(120 + Math.random() * 40, 0.05, { type: 'sine', gain: 0.18 - i * 0.02, when: t, slideTo: 70 });
    }
  }

  // 语音播报走法名（Web Speech API）
  function speak(text) {
    if (muted) return;
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.9;
      u.pitch = 1.1;
      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find(v => v.lang && v.lang.indexOf('zh') === 0);
      if (zh) u.voice = zh;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  return {
    init, isMuted, setMuted, toggleMuted, speak,
    tap() { tone(620, 0.05, { type: 'triangle', gain: 0.12 }); },
    select() { tone(520, 0.1, { type: 'triangle', gain: 0.2, slideTo: 800 }); },
    move(type) {
      noise(0.09, { gain: 0.32, filter: 900 }); // 落子木质轻响
      if (type === 'h') { // 马：双蹄 + 上滑
        noise(0.07, { gain: 0.28, filter: 700, when: 0.14 });
        tone(280, 0.18, { type: 'triangle', gain: 0.2, slideTo: 620, when: 0.06 });
      } else if (type === 'e') { // 象：呼呼风声
        noise(0.3, { gain: 0.28, filter: 500, slide: 200 });
        tone(210, 0.32, { type: 'sine', gain: 0.12, slideTo: 110 });
      } else if (type === 'c') { // 炮：低鸣滑膛
        tone(150, 0.2, { type: 'sawtooth', gain: 0.11, slideTo: 230 });
      } else if (type === 'p') { // 兵：轻快小步
        tone(430, 0.08, { type: 'triangle', gain: 0.2, slideTo: 340 });
      } else { // 车/士/将：沉稳
        tone(240, 0.13, { type: 'sine', gain: 0.2, slideTo: 175 });
      }
    },
    capture(type) {
      noise(0.24, { gain: 0.55, filter: 1800, slide: 250 });
      tone(90, 0.26, { type: 'sine', gain: 0.45, slideTo: 48 });
      noise(0.3, { gain: 0.3, filter: 3000, slide: 200, when: 0.05, type: 'highpass' });
      if (type === 'h') { // 马吃子：马蹄声
        hooves();
      }
      if (type === 'c') { // 炮轰加重：双重爆炸
        noise(0.5, { gain: 0.65, filter: 500, slide: 70, when: 0.03 });
        tone(70, 0.5, { type: 'sine', gain: 0.55, slideTo: 38 });
        noise(0.45, { gain: 0.45, filter: 2500, slide: 400, when: 0.06 });
        tone(50, 0.6, { type: 'sine', gain: 0.5, slideTo: 30, when: 0.02 }); // 低频轰鸣
      }
    },
    // 万马奔腾：连续马蹄声
    hooves,
    check() {
      tone(880, 0.16, { type: 'square', gain: 0.1 });
      tone(660, 0.16, { type: 'square', gain: 0.1, when: 0.19 });
      tone(880, 0.18, { type: 'square', gain: 0.1, when: 0.38 });
    },
    win() {
      const n = [523, 659, 784, 1046, 1318];
      n.forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.2, when: i * 0.15 }));
      noise(0.6, { gain: 0.12, filter: 4000, when: 0.05, type: 'highpass' });
    },
    lose() {
      const n = [440, 349, 262, 196];
      n.forEach((f, i) => tone(f, 0.32, { type: 'triangle', gain: 0.18, when: i * 0.19, slideTo: f * 0.85 }));
    },
    undo() { tone(520, 0.13, { type: 'triangle', gain: 0.18, slideTo: 300 }); },
    invalid() { tone(200, 0.16, { type: 'square', gain: 0.09, slideTo: 130 }); },
    flip() { tone(700, 0.1, { type: 'sine', gain: 0.1, slideTo: 480 }); },
  };
})();
