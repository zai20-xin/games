import { Settings } from "./settings";

export type Sfx = "place" | "remove" | "win" | "error" | "click";

interface Tone {
  f: number;
  type: OscillatorType;
  dur: number;
  gain: number;
}

const TONES: Record<Sfx, Tone> = {
  place: { f: 660, type: "sine", dur: 0.12, gain: 0.18 },
  remove: { f: 440, type: "sine", dur: 0.1, gain: 0.14 },
  win: { f: 880, type: "triangle", dur: 0.42, gain: 0.22 },
  error: { f: 180, type: "square", dur: 0.14, gain: 0.12 },
  click: { f: 520, type: "sine", dur: 0.06, gain: 0.1 },
};

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** 在用户手势内调用，触发一次短音效；音效关闭或不支持时静默降级 */
export function playSound(type: Sfx): void {
  if (!Settings.get().sound) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const t = TONES[type];
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = t.type;
  osc.frequency.value = t.f;
  const now = c.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(t.gain, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + t.dur);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + t.dur + 0.02);
}
