// audio.js —— WebAudio 程序化音效 + 电音 BGM（原创无版权）
// 所有音频均为运行时合成，无需音频文件；本地 bgm.mp3 接口保留（见 ensureBgm）。
import * as storage from './storage.js';

let audioCtx = null;
const SFX_ON = true;         // 音效总开关：开启所有程序化音效（连击/过门/雪崩/任务/破纪录/落地等）
let muted = storage.getSettings().muted;   // M 键主静音（持久化 ski-adventure:settings）

export function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  ensureBgm();
}

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  storage.saveSettings({ muted });
  if (muted) stopBgm(); else ensureBgm();
  return muted;
}

function tone(freq, dur, type, vol, delay) {
  if (!audioCtx) return;
  if (!SFX_ON || muted) return;        // 音效已关闭 / 主静音
  const t0 = audioCtx.currentTime + (delay || 0);
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}
function sweep(f1, f2, dur, type, vol) {
  if (!audioCtx) return;
  if (!SFX_ON || muted) return;        // 音效已关闭 / 主静音
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || 'sawtooth';
  osc.frequency.setValueAtTime(f1, t0);
  osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(vol || 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

export function sfxCoin(combo) {
  // 连击音调递增（ Mario 式爽感，封顶防刺耳）
  const step = Math.min(12, (combo || 0));
  const base = 880 + step * 55;
  tone(base, 0.08, 'square', 0.18);
  tone(base + 440, 0.09, 'square', 0.14, 0.05);
}
export function sfxStar() { [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.12, 'triangle', 0.18, i * 0.06)); }
export function sfxBoost() { sweep(300, 1200, 0.35, 'sawtooth', 0.22); }
export function sfxLane() { tone(520, 0.04, 'sine', 0.08); }
export function sfxJump() { tone(520, 0.12, 'sine', 0.12); tone(780, 0.1, 'sine', 0.1, 0.06); }

// ---- 沉浸感音效：风声 / 切雪 / 落地 ----
let windSrc = null, windGain = null, windFilter = null;
function ensureWind() {
  if (!audioCtx || windSrc) return;
  windSrc = audioCtx.createBufferSource();
  windSrc.buffer = bgmNoiseBuf();
  windSrc.loop = true;
  windFilter = audioCtx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 300;
  windFilter.Q.value = 0.9;
  windGain = audioCtx.createGain();
  windGain.gain.value = 0;
  windSrc.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(audioCtx.destination);
  windSrc.start();
}
// 每帧调用：level 0~1 速度比，air 腾空时呼啸增强
export function setWind(level, air) {
  ensureWind();
  if (!audioCtx || !windGain) return;
  if (muted || !bgmOn) { windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2); return; }
  const t = audioCtx.currentTime;
  const l = Math.max(0, Math.min(1, level));
  const g = l * l * 0.34 + (air ? l * 0.12 : 0);           // 平方曲线：低速安静、高速呼啸
  windGain.gain.setTargetAtTime(g, t, 0.18);
  windFilter.frequency.setTargetAtTime(260 + l * 1500 + (air ? 900 : 0), t, 0.25);
}
// 切雪声：压弯/急转弯时雪板刃切雪的"沙"声，strength 0~1
export function sfxCarve(strength) {
  if (!audioCtx) return;
  if (!SFX_ON) return;
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  src.playbackRate.value = 0.65 + Math.random() * 0.5;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 850 + strength * 700;
  bp.Q.value = 0.7;
  const g = audioCtx.createGain();
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05 + strength * 0.1, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.24);
}
// 落地闷响：低频 thud + 雪面扑噪声，power 0~1
export function sfxLand(power) {
  if (!audioCtx) return;
  if (!SFX_ON) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14 + power * 0.16, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.18);
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1400;
  const g2 = audioCtx.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.1 + power * 0.12, t + 0.012);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  src.connect(lp); lp.connect(g2); g2.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.22);
}
export function sfxQuestDone() { tone(523, 0.1, 'triangle', 0.22); tone(784, 0.12, 'triangle', 0.22, 0.09); tone(1047, 0.18, 'triangle', 0.24, 0.18); }
export function sfxCrash() {
  if (!audioCtx || muted) return;
  sweep(400, 80, 0.5, 'sawtooth', 0.3);
  tone(120, 0.4, 'square', 0.18, 0.02);
}
export function sfxNearMiss() { tone(1400, 0.07, 'square', 0.12); tone(2100, 0.08, 'square', 0.08, 0.04); }
export function sfxClear() {                 // 跳过/钻过障碍的专属爽感音效：上扬 whoosh + 清脆 ding
  if (!audioCtx || !SFX_ON || muted) return;
  sweep(700, 1700, 0.13, 'triangle', 0.16);
  tone(1500, 0.07, 'square', 0.12);
  tone(2000, 0.09, 'square', 0.09, 0.04);
}
export function sfxMilestone() { tone(523, 0.09, 'triangle', 0.2); tone(659, 0.09, 'triangle', 0.2, 0.08); tone(784, 0.14, 'triangle', 0.22, 0.16); }
export function sfxGate() { tone(1100, 0.05, 'square', 0.11); tone(1500, 0.06, 'square', 0.1, 0.04); }
export function sfxAvalancheWarn() { tone(180, 0.5, 'sawtooth', 0.22); tone(140, 0.6, 'sawtooth', 0.18, 0.15); }
export function sfxAvalancheEscape() { tone(660, 0.1, 'triangle', 0.2); tone(880, 0.12, 'triangle', 0.2, 0.09); tone(1100, 0.16, 'triangle', 0.22, 0.18); }
export function sfxNewBest() { tone(523, 0.12, 'triangle', 0.22); tone(659, 0.12, 'triangle', 0.22, 0.1); tone(784, 0.14, 'triangle', 0.24, 0.2); tone(1047, 0.22, 'triangle', 0.26, 0.32); }
export function sfxFever() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.2, i * 0.07)); sweep(400, 1600, 0.8, 'sawtooth', 0.15); }
export function sfxShield() { sweep(900, 200, 0.2, 'square', 0.2); }
export function sfxPower() { tone(660, 0.09, 'square', 0.18); tone(990, 0.12, 'square', 0.15, 0.06); }
export function sfxFall() { sweep(300, 60, 0.4, 'sawtooth', 0.25); tone(80, 0.3, 'sine', 0.15, 0.02); }
export function sfxStun() { sweep(520, 170, 0.4, 'square', 0.25); tone(140, 0.32, 'sine', 0.12, 0.05); }
export function sfxSurge() { sweep(180, 720, 0.55, 'sawtooth', 0.24); sweep(720, 180, 0.55, 'square', 0.14, 0.05); }

// ---- 打雪仗音效 ----
export function sfxThrow() {           // 投雪球的"噗"声（带通噪声短促）
  if (!audioCtx || !SFX_ON || muted) return;
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2;
  const g = audioCtx.createGain();
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.14);
}
export function sfxHit() {             // 雪球命中闷响
  if (!audioCtx || !SFX_ON || muted) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.1);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.16);
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.12, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(lp); lp.connect(g2); g2.connect(audioCtx.destination); src.start(t); src.stop(t + 0.14);
}
export function sfxKill() { tone(520, 0.06, 'square', 0.16); tone(780, 0.07, 'square', 0.13, 0.05); tone(1040, 0.1, 'square', 0.1, 0.1); }
export function sfxHurt() { sweep(300, 70, 0.3, 'sawtooth', 0.26); tone(90, 0.25, 'sine', 0.18, 0.02); }
export function sfxUpgrade() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.2, i * 0.06)); }
export function sfxWave() { tone(440, 0.1, 'square', 0.18); tone(660, 0.14, 'square', 0.16, 0.1); }
export function sfxBoss() { sweep(110, 55, 0.8, 'sawtooth', 0.3); tone(70, 0.7, 'sine', 0.2, 0.05); }
export function sfxLose() { [660, 540, 420, 300].forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, i * 0.12)); }
export function sfxShoot() { tone(900, 0.05, 'sawtooth', 0.1); tone(500, 0.06, 'sawtooth', 0.08, 0.04); }

// ---- 背景音乐：程序化原创电音 BGM（非原曲，无版权问题）----
// 想用《滑雪大冒险》(Drill Remix)：将合法拥有的 mp3 重命名为 bgm.mp3 放进 public/，并给 <audio id="bgm"> 加 src。
let bgmOn = storage.getBgmOn();
let bgmTimer = null;
let bgmNextTime = 0;
let bgmStep = 0;
let bgmUsingFile = false;
const bgmEl = document.getElementById('bgm');
const BGM_STEP = 0.18;                         // 8 分音符步长（约 167 BPM）
const BGM_LEN = 64;
const bgmSongs = [
  { chords: [110.00, 87.31, 130.81, 98.00],
    chordFreqs: [[220.00,261.63,329.63],[174.61,220.00,261.63],[261.63,329.63,392.00],[196.00,246.94,293.66]],
    build:  [440.00,0,0,0, 523.25,0,0,0, 659.25,0,0,0, 587.33,0,0,0],
    drop:   [440.00,0,523.25,0, 659.25,0,783.99,0, 698.46,0,783.99,0, 659.25,0,523.25,440.00],
    outro:  [440.00,0,0,0, 0,0,523.25,0, 0,0,659.25,0, 0,0,523.25,0] },
  { chords: [82.41, 65.41, 98.00, 73.42],
    chordFreqs: [[164.81,196.00,246.94],[261.63,329.63,392.00],[196.00,246.94,293.66],[146.83,220.00,293.66]],
    build:  [329.63,0,0,0, 392.00,0,0,0, 493.88,0,0,0, 440.00,0,0,0],
    drop:   [329.63,0,392.00,0, 493.88,0,587.33,0, 523.25,0,587.33,0, 493.88,0,392.00,329.63],
    outro:  [329.63,0,0,0, 0,0,392.00,0, 0,0,493.88,0, 0,0,392.00,0] },
];
let bgmSong = 0;
let bgmNoise = null;

function makeDistCurve(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * 2 / n - 1;
    c[i] = Math.tanh(k * x);
  }
  return c;
}
function bgmNoiseBuf() {
  if (bgmNoise) return bgmNoise;
  bgmNoise = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
  const d = bgmNoise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return bgmNoise;
}
function bgmKick(t, vol) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.15);
}
function bgmSnare(t, vol) {
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.14);
}
function bgmHat(t, vol) {
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 8000;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.06);
}
function bgmBass(freq, t, vol) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sawtooth'; o.frequency.value = freq;
  const sh = audioCtx.createWaveShaper();
  sh.curve = makeDistCurve(50);
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 720; lp.Q.value = 0.6;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(sh); sh.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.18);
  const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
  o2.type = 'sine'; o2.frequency.value = freq;
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o2.connect(g2); g2.connect(audioCtx.destination);
  o2.start(t); o2.stop(t + 0.18);
}
function bgmLead(freq, t, vol, dur) {
  const g = audioCtx.createGain();
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 1.2;
  const d = dur || 0.14;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  lp.connect(g); g.connect(audioCtx.destination);
  for (const det of [0, 9]) {
    const o = audioCtx.createOscillator();
    o.type = 'square'; o.frequency.value = freq;
    o.detune.value = det;
    o.connect(lp);
    o.start(t); o.stop(t + d + 0.02);
  }
}
function bgmCrash(t, vol) {
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 6000;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  src.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.42);
}
function bgmBoom(t, vol) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(115, t);
  o.frequency.exponentialRampToValueAtTime(25, t + 0.28);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.32);
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 2500;
  const g2 = audioCtx.createGain();
  g2.gain.setValueAtTime(vol * 0.6, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  src.connect(hp); hp.connect(g2); g2.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.16);
  const src2 = audioCtx.createBufferSource(); src2.buffer = bgmNoiseBuf();
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.2;
  const g3 = audioCtx.createGain();
  g3.gain.setValueAtTime(vol * 0.4, t + 0.02);
  g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  src2.connect(bp); bp.connect(g3); g3.connect(audioCtx.destination);
  src2.start(t); src2.stop(t + 0.12);
}
function bgmRiser(t, vol) {
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(4200, t + 0.35);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  src.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.38);
}
function bgmCrack(t, vol) {
  const src = audioCtx.createBufferSource(); src.buffer = bgmNoiseBuf();
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 5000;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + 0.06);
}
function bgmGrowl(freq, t, vol) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq * 1.4, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.09);
  const sh = audioCtx.createWaveShaper();
  sh.curve = makeDistCurve(60);
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(sh); sh.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.12);
}
function bgmChord(freqs, t, dur, vol) {
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
  g.gain.setValueAtTime(vol, t + Math.max(0.1, dur - 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.4;
  lp.connect(g); g.connect(audioCtx.destination);
  for (const f of freqs) {
    const o = audioCtx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f;
    o.connect(lp);
    o.start(t); o.stop(t + dur + 0.02);
  }
}
function bgmArp(freqs, t, vol) {
  for (let i = 0; i < freqs.length; i++) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sawtooth'; o.frequency.value = freqs[i] * 2;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1300;
    const tt = t + i * (BGM_STEP / 2);
    g.gain.setValueAtTime(0.0001, tt);
    g.gain.exponentialRampToValueAtTime(vol, tt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06);
    o.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
    o.start(tt); o.stop(tt + 0.08);
  }
}
function bgmTick() {
  if (!audioCtx || !bgmOn || bgmUsingFile) return;
  const ahead = audioCtx.currentTime + 0.35;
  while (bgmNextTime < ahead) {
    const s = bgmStep % BGM_LEN;
    if (bgmStep > 0 && s === 0) bgmSong = 1 - bgmSong;
    const song = bgmSongs[bgmSong];
    const bar = Math.floor(s / 16);
    const b = s % 16;
    const t = bgmNextTime;
    const dyn = [0.55, 0.9, 1.15, 0.7][bar];
    const acc = b === 0 ? 1.3 : (b === 8 ? 1.1 : (b % 2 === 0 ? 1.0 : 0.7));
    if (b % 2 === 0) bgmKick(t, 0.6 * dyn * (b === 0 ? 1.25 : 1));
    if ((bar === 1 || bar === 2) && (b === 2 || b === 6 || b === 10 || b === 14))
      bgmSnare(t, 0.3 * dyn * (b === 2 ? 1.2 : 1));
    if ((bar === 1 || bar === 2) && b === 15) {
      bgmSnare(t + BGM_STEP * 0.5, 0.13 * dyn);
      bgmSnare(t + BGM_STEP * 0.75, 0.18 * dyn);
    }
    bgmHat(t, (b % 2 === 0 ? 0.16 : 0.08) * dyn);
    if (bar === 1 && b % 2 === 0) bgmHat(t + BGM_STEP / 2, (0.03 + (b / 16) * 0.11) * dyn);
    else if (bar === 2 && b % 2 === 0) bgmHat(t + BGM_STEP / 2, 0.07 * dyn);
    const root = song.chords[Math.floor(b / 4)];
    if (bar === 0 || bar === 3) {
      if (b % 2 === 0) bgmBass(root, t, 0.3 * dyn * (b === 0 ? 1.25 : 1));
    } else {
      bgmBass(root, t, 0.16 * dyn * (b === 0 ? 1.3 : 1));
      if (b % 2 === 1) bgmBass(root * 2, t, 0.08 * dyn);
      if (bar === 2 && b % 2 === 0) bgmGrowl(root, t + BGM_STEP / 2, 0.13 * dyn);
    }
    if (bar === 2 && b % 2 === 0) bgmChord(song.chordFreqs[Math.floor(b / 4)], t, 0.15, 0.06 * dyn);
    if (bar === 2 && b % 2 === 0) bgmArp(song.chordFreqs[Math.floor(b / 4)], t, 0.08 * dyn);
    let lf = 0;
    if (bar === 1) lf = song.build[b];
    else if (bar === 2) lf = song.drop[b];
    else if (bar === 3) lf = song.outro[b];
    if (lf && !(bar === 2 && b === 12)) {
      bgmLead(lf, t, 0.13 * dyn * (b === 0 ? 1.2 : 1));
      if (bar === 2) {
        bgmLead(lf * 2, t, 0.05 * dyn, 0.09);
        bgmLead(lf, t + BGM_STEP * 0.75, 0.035 * dyn, 0.06);
      }
    }
    if ((bar === 1 || bar === 3) && b === 15) bgmRiser(t, (bar === 1 ? 0.2 : 0.12) * dyn);
    if (b === 0 && bar === 2) bgmBoom(t, 0.55 * dyn);
    if (bar === 2 && (b === 2 || b === 10)) bgmCrack(t, 0.13 * dyn);
    bgmNextTime += BGM_STEP;
    bgmStep++;
  }
}
export function ensureBgm() {
  if (!audioCtx || !bgmOn || muted) return;
  if (!bgmTimer) {
    bgmNextTime = audioCtx.currentTime + 0.1;
    bgmTimer = setInterval(bgmTick, 80);
  }
  if (bgmEl.getAttribute('src') && !bgmUsingFile) {
    bgmEl.volume = 0.5;
    bgmEl.play().then(() => {
      bgmUsingFile = true;
      if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    }).catch(() => { bgmUsingFile = false; });
  }
}
export function stopBgm() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  if (bgmEl && !bgmEl.paused) bgmEl.pause();
}
export function toggleBgm() {
  bgmOn = !bgmOn;
  storage.setBgmOn(bgmOn);
  if (bgmOn) ensureBgm(); else stopBgm();
  return bgmOn;
}
export function getBgmOn() { return bgmOn; }
