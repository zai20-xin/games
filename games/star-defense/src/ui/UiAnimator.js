// star-defense/src/ui/UiAnimator.js
export const EASE = {
  linear: t => t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outBack: t => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export class UiAnimator {
  constructor() {
    this._anims = new Map();
    this._nextId = 1;
  }
  get activeCount() { return this._anims.size; }
  play({ duration = 0.3, delay = 0, ease = EASE.outQuad, onUpdate, onComplete }) {
    const id = this._nextId++;
    const start = performance.now() + delay * 1000;
    const end = start + duration * 1000;
    this._anims.set(id, { start, end, ease, onUpdate, onComplete, done: false });
    if (this._anims.size === 1) this._tick();
    return id;
  }
  stop(id) { this._anims.delete(id); }
  stopAll() { this._anims.clear(); }
  _tick = () => {
    if (this._anims.size === 0) return;
    const now = performance.now();
    for (const [id, a] of this._anims) {
      if (now < a.start) continue;
      const t = Math.min(1, (now - a.start) / (a.end - a.start));
      a.onUpdate && a.onUpdate(a.ease(t), t);
      if (t >= 1 && !a.done) {
        a.done = true;
        a.onComplete && a.onComplete();
        this._anims.delete(id);
      }
    }
    if (this._anims.size > 0) requestAnimationFrame(this._tick);
  };
}
