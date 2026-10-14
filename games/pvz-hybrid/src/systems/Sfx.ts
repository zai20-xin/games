// Web Audio 合成音效：零素材、零版权，全部程序生成
export class Sfx {
  private ctx: AudioContext | null = null;

  resume(): void {
    if (!this.ctx) {
      const AC = window.AudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    vol = 0.06,
    slideTo?: number,
    detuneCents = 0
  ): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t);
    if (detuneCents) osc.detune.value = detuneCents;
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    }
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private randDetune(cents: number): number {
    return (Math.random() * 2 - 1) * cents;
  }

  private noise(dur: number, vol = 0.1, cutoff = 1200): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t);
  }

  place(): void {
    this.tone(190, 0.12, "triangle", 0.1, 120);
  }

  shoot(): void {
    this.tone(880, 0.07, "square", 0.035, 620, this.randDetune(120));
  }

  splat(): void {
    this.noise(0.06, 0.08, 1400 + Math.random() * 600);
  }

  /** 击杀音：随连杀数音调递增，营造连击爽感 */
  kill(combo: number): void {
    const base = 300 + Math.min(combo, 12) * 45;
    this.tone(base, 0.1, "square", 0.07, base * 1.4);
    this.noise(0.05, 0.06, 1800);
  }

  comboReward(): void {
    [660, 880, 1100].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.12, "triangle", 0.08), i * 70);
    });
  }

  jalapeno(): void {
    this.noise(0.7, 0.22, 900);
    this.tone(200, 0.6, "sawtooth", 0.12, 60);
  }

  sun(): void {
    this.tone(660, 0.1, "sine", 0.07, 990);
    this.tone(990, 0.14, "sine", 0.05, 1320);
  }

  chomp(): void {
    this.tone(95, 0.09, "sawtooth", 0.1, 55);
  }

  explode(): void {
    this.noise(0.5, 0.28, 350);
    this.tone(70, 0.4, "sine", 0.2, 30);
  }

  mower(): void {
    this.tone(110, 0.9, "sawtooth", 0.12, 220);
    this.noise(0.7, 0.06, 500);
  }

  shovel(): void {
    this.noise(0.09, 0.1, 2200);
  }

  waveHorn(): void {
    this.tone(220, 0.5, "square", 0.07, 170);
  }

  lose(): void {
    this.tone(330, 0.3, "triangle", 0.1, 250);
    this.tone(250, 0.35, "triangle", 0.1, 180);
    this.tone(180, 0.6, "triangle", 0.1, 90);
  }

  win(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.22, "triangle", 0.09), i * 140);
    });
  }
}
