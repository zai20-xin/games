import Phaser from 'phaser';
import { WEAPON, WeaponId } from '../utils/constants';

export class PowerUp {
  alive = true;
  /** 可视对象：powerup.png 精灵 + 静态物理 body（让 overlap 能正确触发）；
   *  headless / 桩场景下为 undefined。 */
  readonly gfx: Phaser.GameObjects.Image | undefined;

  constructor(public scene: Phaser.Scene | null, public x: number, public y: number, public weaponKey: WeaponId) {
    const add = scene?.add;
    if (!add || !scene?.physics) return; // gfx 保持 undefined（单测桩场景）

    // powerup.png 21x44 → 8x16 视觉，中心锚点
    const img = add.image(x, y, 'powerup').setOrigin(0.5, 0.5);
    img.setScale(8 / 21);
    this.gfx = img;

    // 静态 body（不参与重力下落），16×32 比视觉大一倍，更容易跟玩家 body 重叠。
    // add.existing(img, true) 挂的是 Arcade StaticBody；类型上 Image 没有 body 字段，
    // 用显式断言收窄（运行时由 Phaser 保证）。
    scene.physics.add.existing(img, true);
    const body = (img as unknown as Phaser.Physics.Arcade.Image).body as
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | undefined;
    if (body) {
      body.setSize(16, 32);
      body.setOffset(-8, -16);
    }
  }

  applyTo(state: { setWeaponByKey: (k: WeaponId) => void }): void {
    state.setWeaponByKey(this.weaponKey);
    this.alive = false;
    try { this.gfx?.destroy(); } catch { /* ignore */ }
  }
}
