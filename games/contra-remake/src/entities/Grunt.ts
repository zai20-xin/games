import { PHYSICS } from '../utils/constants';
import { AI, SCALE } from '../config/tuning';
import { Enemy } from './Enemy';

export class Grunt extends Enemy {
  lastFireAt = 0;
  patrolDir: 1 | -1 = 1;
  /** tilesheet sprite（带动画） */
  gfx: Phaser.GameObjects.Sprite;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(x, y, 1);
    // 脚底锚点 (0.5, 1)：y 表示"脚底所在像素"，让 Grunt 视觉上站在台阶/地面顶面。
    this.gfx = scene.add.sprite(x, y, 'soldier-ts', 0).setOrigin(0.5, 1);
    // 缩放到 18x22 视觉（与 player 同尺寸）。setScale 会让 body 跟着缩，但 Grunt
    // 不用物理 body（GameScene 不用 collider），所以 setScale 是安全的。
    this.gfx.setScale(SCALE.character);
    this.gfx.play('grunt-idle');
  }
  tickAI(playerX: number, _playerY: number, time: number): 'idle' | 'fire' | 'patrol' {
    const dist = Math.abs(playerX - this.x);
    if (dist <= PHYSICS.gruntSight) {
      if (time - this.lastFireAt >= AI.gruntFireIntervalMs) {
        this.lastFireAt = time;
        this.gfx.play('grunt-attack', true);
        return 'fire';
      }
      this.gfx.play('grunt-idle', true);
      return 'idle';
    }
    this.gfx.play('grunt-walk', true);
    return 'patrol';
  }
  move(dx: number) {
    this.x += dx;
    this.gfx.x = this.x;
    if (dx !== 0) this.gfx.setFlipX(dx < 0);
  }
}
