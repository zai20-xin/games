/** Deterministic seeded RNG (mulberry32) mirroring the GDScript RNG API surface. */
export class Rng {
  private state: number;

  constructor(seed: number = Date.now() >>> 0) {
    this.state = seed >>> 0;
  }

  reseed(seed: number): void {
    this.state = seed >>> 0;
  }

  /** uniform integer in [min, max] inclusive */
  randiRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  randf(): number {
    return this.next();
  }

  private next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
