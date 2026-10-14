import { AI, SCALE } from '../config/tuning';
import { Enemy } from './Enemy';

export class Turret extends Enemy {
  lastFireAt = 0;
  /** tilesheet sprite（单帧 stand 静态展示） */
  gfx: Phaser.GameObjects.Sprite;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(x, y, 2);
    // 脚底锚点 (0.5, 1)：y 表示"脚底所在像素"，与 Player/Grunt/Boss 统一。
    // 用 adventurer_ts 的 frame 10 (stand) 静态展示，turret 不放动画。
    this.gfx = scene.add.sprite(x, y, 'adventurer-ts', 10).setOrigin(0.5, 1);
    // 缩放到 18x22 视觉（静态炮台）
    this.gfx.setScale(SCALE.character);
  }
  tickAI(playerX: number, _playerY: number, time: number): 'idle' | 'fire' {
    // 静态炮台始终朝玩家方向（flipX）
    this.gfx.setFlipX(playerX < this.x);
    if (time - this.lastFireAt >= AI.turretFireIntervalMs) { this.lastFireAt = time; return 'fire'; }
    return 'idle';
  }
  fireDir(playerX: number): number { return playerX >= this.x ? 1 : -1; }
}
