import { BOSS_PHASE_HP } from '../utils/constants';
import { BOSS, SCALE } from '../config/tuning';

export class BossState {
  hp: number; maxHp: number; phase: 1 | 2 | 3 = 1; alive = true;
  constructor(hp: number = BOSS.defaultHp) { this.hp = hp; this.maxHp = hp; }
  takeDamage(n: number) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - n);
    const pct = (this.hp / this.maxHp) * 100;
    if (pct <= BOSS_PHASE_HP.phase2) this.phase = 3;
    else if (pct <= BOSS_PHASE_HP.phase1) this.phase = 2;
    if (this.hp === 0) this.alive = false;
  }
}

export class Boss {
  state: BossState;
  x: number; y: number;
  /** tilesheet sprite（带动画） */
  gfx: Phaser.GameObjects.Sprite;
  private currentAnim = '';
  private hitFlashUntil = 0;
  constructor(scene: Phaser.Scene, x: number, y: number, hp = 100) {
    this.x = x; this.y = y; this.state = new BossState(hp);
    // 脚底锚点 (0.5, 1)：y 表示"脚底所在像素"。
    this.gfx = scene.add.sprite(x, y, 'zombie-ts', 0).setOrigin(0.5, 1);
    // Boss 比玩家大 2x：90x110 → 36x44 视觉
    this.gfx.setScale(SCALE.boss);
    this.play('boss-idle');
  }

  /** 强制设置当前动画（仅在 key 真的变了时才 play）。 */
  private play(key: string) {
    if (this.currentAnim === key) return;
    this.gfx.play(key, true);
    this.currentAnim = key;
  }

  /** 同步 phase 到 sprite 动画。phase 1 idle，phase 2 walk，phase 3 attack。
   *  受伤时短暂切到 hurt（0.15s）再回到 phase 默认动画。 */
  syncAnim(time: number) {
    if (!this.state.alive) return;
    if (time < this.hitFlashUntil) {
      this.play('boss-hurt');
      return;
    }
    if (this.state.phase === 1) this.play('boss-idle');
    else if (this.state.phase === 2) this.play('boss-walk');
    else this.play('boss-attack');
  }

  /** 受伤时由 GameScene 调用，标记短时间 hurt 动画。 */
  takeHit(now: number) {
    this.hitFlashUntil = now + BOSS.hurtAnimMs;
  }

  firePattern(time: number): { dir: number; spread: number }[] {
    const out: { dir: number; spread: number }[] = [];
    const { fireIntervalMs, fireSpread } = BOSS;
    if (this.state.phase === 1) {
      if (time % fireIntervalMs.phase1 < 16) out.push({ dir: -1, spread: 0 });
    } else if (this.state.phase === 2) {
      if (time % fireIntervalMs.phase2 < 16) {
        for (const s of fireSpread.phase2) out.push({ dir: -1, spread: s });
      }
    } else {
      if (time % fireIntervalMs.phase3 < 16) {
        for (const s of fireSpread.phase3) out.push({ dir: -1, spread: s });
      }
    }
    return out;
  }
}
