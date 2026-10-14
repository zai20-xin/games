/** 轻量 WebAudio 音效，默认静音，可开关 */

let ctx = null;
let enabled = false;

export function isSoundOn() {
  return enabled;
}

export function setSoundOn(on) {
  enabled = !!on;
  try {
    localStorage.setItem("emotion-pot:sound", enabled ? "1" : "0");
  } catch { /* ignore */ }
}

export function initSound() {
  try {
    enabled = localStorage.getItem("emotion-pot:sound") === "1";
  } catch {
    enabled = false;
  }
}

function ac() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** 极短低音量合成音，避免刺激 */
function blip({ freq = 220, dur = 0.08, type = "sine", gain = 0.04, slide = 0 }) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function play(name) {
  if (!enabled) return;
  switch (name) {
    case "dump":
      blip({ freq: 120, dur: 0.18, type: "triangle", gain: 0.06, slide: -60 });
      break;
    case "stir":
      blip({ freq: 180 + Math.random() * 40, dur: 0.05, type: "sine", gain: 0.03 });
      break;
    case "ing":
      blip({ freq: 520, dur: 0.07, type: "square", gain: 0.025, slide: -80 });
      break;
    case "fire":
      blip({ freq: 90, dur: 0.12, type: "sawtooth", gain: 0.03, slide: 40 });
      break;
    case "braise":
      blip({ freq: 140, dur: 0.1, type: "triangle", gain: 0.035, slide: 20 });
      break;
    case "lid":
      blip({ freq: 320, dur: 0.06, type: "square", gain: 0.03 });
      break;
    case "done":
      blip({ freq: 440, dur: 0.1, type: "sine", gain: 0.04 });
      setTimeout(() => blip({ freq: 660, dur: 0.12, type: "sine", gain: 0.04 }), 80);
      break;
    case "serve":
      blip({ freq: 780, dur: 0.15, type: "sine", gain: 0.045, slide: 200 });
      break;
    default:
      break;
  }
}
