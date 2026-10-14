import type Phaser from "phaser";

/** 极简 WebAudio 程序音效 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private muted = false;

  setMuted(m: boolean): void {
    this.muted = m;
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.04, slide?: number): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  place(): void {
    this.tone(520, 0.08, "triangle", 0.05, 680);
  }

  shoot(): void {
    this.tone(880, 0.04, "square", 0.02, 620);
  }

  hit(): void {
    this.tone(220, 0.05, "triangle", 0.03, 140);
  }

  kill(): void {
    this.tone(180, 0.1, "sawtooth", 0.03, 80);
  }

  sun(): void {
    this.tone(740, 0.12, "sine", 0.045, 990);
  }

  upgrade(): void {
    this.tone(523, 0.1, "sine", 0.05);
    window.setTimeout(() => this.tone(659, 0.1, "sine", 0.05), 90);
    window.setTimeout(() => this.tone(784, 0.14, "sine", 0.055), 180);
  }

  hurt(): void {
    this.tone(160, 0.18, "sawtooth", 0.05, 70);
  }

  wave(): void {
    this.tone(392, 0.12, "triangle", 0.04);
    window.setTimeout(() => this.tone(523, 0.16, "triangle", 0.04), 100);
  }

  gameOver(): void {
    this.tone(330, 0.2, "sine", 0.05, 220);
    window.setTimeout(() => this.tone(196, 0.35, "sine", 0.05, 130), 180);
  }

  unlock(): void {
    this.tone(660, 0.08, "sine", 0.04);
  }
}

export function destroySfx(_sfx: Sfx): void {
  // AudioContext 由浏览器回收；无强制 close 以避免 iOS 静音键问题
}

export type SceneLike = Phaser.Scene;
