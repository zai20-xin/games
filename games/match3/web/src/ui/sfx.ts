/** WebAudio 程序化音效：零素材，事件合成 + 循环 BGM */
const MIX = 22050;

let ctx: AudioContext | null = null;
let sfxEnabled = true;
let musicEnabled = true;
let masterMuted = false; // M 键主静音（持久化 match3:settings，见 ui/settings.ts）
let musicSource: AudioBufferSourceNode | null = null;
const buffers = new Map<string, AudioBuffer>();

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function synthNote(freq: number, dur: number, wave: OscillatorType, volume: number): AudioBuffer {
  const ac = audio();
  const len = Math.floor(dur * MIX);
  const buffer = ac.createBuffer(1, len, MIX);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / MIX;
    const env = Math.pow(1 - i / len, 1.5);
    const v =
      wave === "square"
        ? Math.sign(Math.sin(2 * Math.PI * freq * t)) * 0.6
        : wave === "triangle"
          ? (Math.abs(((freq * t) % 1) * 2 - 1) * 2 - 1) * 0.8
          : Math.sin(2 * Math.PI * freq * t);
    data[i] = v * env * volume;
  }
  return buffer;
}

function synthChain(parts: { freq: number; dur: number; wave?: OscillatorType }[]): AudioBuffer {
  const ac = audio();
  const total = parts.reduce((n, p) => n + Math.floor(p.dur * MIX), 0);
  const buffer = ac.createBuffer(1, total, MIX);
  const data = buffer.getChannelData(0);
  let offset = 0;
  for (const p of parts) {
    const note = synthNote(p.freq, p.dur, p.wave ?? "sine", 0.55);
    data.set(note.getChannelData(0), offset);
    offset += note.length;
  }
  return buffer;
}

function explosion(): AudioBuffer {
  const ac = audio();
  const len = Math.floor(0.28 * MIX);
  const buffer = ac.createBuffer(1, len, MIX);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const progress = i / len;
    const env = Math.pow(1 - progress, 2.2);
    const noise = (Math.random() * 2 - 1) * env * 0.6;
    const boom = Math.sin(2 * Math.PI * (90 - 60 * progress) * (i / MIX)) * env * 0.8;
    data[i] = Math.max(-1, Math.min(1, noise + boom)) * 0.7;
  }
  return buffer;
}

function ensureBuffers(): void {
  if (buffers.size > 0 || !sfxEnabled && !musicEnabled) return;
  buffers.set("swap", synthNote(420, 0.08, "sine", 0.5));
  buffers.set("invalid", synthNote(160, 0.14, "square", 0.4));
  buffers.set("match", synthChain([
    { freq: 600, dur: 0.12 },
    { freq: 720, dur: 0.1 },
  ]));
  buffers.set("special", synthNote(760, 0.16, "triangle", 0.55));
  buffers.set("shuffle", synthNote(300, 0.25, "sine", 0.45));
  buffers.set("explosion", explosion());
  buffers.set("sparkle", synthChain(
    [0, 1, 2, 3, 4, 5].map((i) => ({ freq: 700 + i * 180, dur: 0.07 })),
  ));
  buffers.set("win", synthChain([
    { freq: 523, dur: 0.14 },
    { freq: 659, dur: 0.14 },
    { freq: 784, dur: 0.22 },
  ]));
  buffers.set("lose", synthChain([
    { freq: 330, dur: 0.18 },
    { freq: 262, dur: 0.18 },
    { freq: 196, dur: 0.3 },
  ]));
}

export const Sfx = {
  applySettings(sfx: boolean, music: boolean): void {
    sfxEnabled = sfx;
    musicEnabled = music;
    if (!music || masterMuted) this.stopMusic();
  },

  setMuted(muted: boolean): void {
    if (masterMuted === muted) return;
    masterMuted = muted;
    if (muted) {
      this.stopMusic();
    } else if (musicEnabled) {
      this.playMusic();
    }
  },

  isMuted(): boolean {
    return masterMuted;
  },

  play(event: string, pitchStep = 0): void {
    if (!sfxEnabled || masterMuted) return;
    ensureBuffers();
    let buffer = buffers.get(event);
    if (!buffer) return;
    const ac = audio();
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.pow(1.12, pitchStep);
    const gain = ac.createGain();
    gain.gain.value = 0.6;
    src.connect(gain).connect(ac.destination);
    src.start();
  },

  playMusic(): void {
    if (!musicEnabled || masterMuted || musicSource) return;
    ensureBuffers();
    const ac = audio();
    // C-G-Am-F 琶音循环，两遍变化共 7.68 秒
    const chords = [
      [261.63, 329.63, 392],
      [196, 246.94, 293.66],
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
    ];
    const noteDur = 0.24 * MIX;
    const orderSets = [
      [0, 1, 2, 1],
      [2, 1, 0, 1],
    ];
    const notes: number[] = [];
    for (let rep = 0; rep < 2; rep++) {
      for (const chord of chords) {
        for (const idx of orderSets[rep]) notes.push(chord[idx]);
      }
    }
    const len = Math.floor(noteDur) * notes.length;
    const buffer = ac.createBuffer(1, len, MIX);
    const data = buffer.getChannelData(0);
    for (let n = 0; n < notes.length; n++) {
      for (let i = 0; i < Math.floor(noteDur); i++) {
        const t = i / MIX;
        const env = Math.pow(1 - i / Math.floor(noteDur), 0.8) * 0.9 + 0.1;
        const wave = Math.sin(2 * Math.PI * notes[n] * t) * 0.35 + Math.sin(4 * Math.PI * notes[n] * t) * 0.12;
        data[n * Math.floor(noteDur) + i] = wave * env * 0.28;
      }
    }
    musicSource = ac.createBufferSource();
    musicSource.buffer = buffer;
    musicSource.loop = true;
    const gain = ac.createGain();
    gain.gain.value = 0.5;
    musicSource.connect(gain).connect(ac.destination);
    musicSource.start();
  },

  stopMusic(): void {
    if (musicSource) {
      try { musicSource.stop(); } catch { /* already stopped */ }
      musicSource = null;
    }
  },
};
