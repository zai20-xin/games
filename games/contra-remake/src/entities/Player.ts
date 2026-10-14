import Phaser from 'phaser';
import { PHYSICS, WEAPON, WeaponId } from '../utils/constants';
import { SCALE, TIMING } from '../config/tuning';
import type { InputManager } from '../systems/InputManager';

export class PlayerState {
  lives = 3;
  weaponId: number = WEAPON.single.id;
  score = 0;
  invincibleUntil = 0;
  alive = true;

  setWeapon(id: number) {
    this.weaponId = Math.max(1, Math.min(5, id));
  }
  setWeaponByKey(k: WeaponId) { this.weaponId = WEAPON[k].id; }

  takeDamage(now = performance.now()): boolean {
    if (now < this.invincibleUntil || !this.alive) return false;
    this.lives -= 1;
    this.invincibleUntil = now + TIMING.playerInvincibleMs;
    if (this.lives <= 0) this.alive = false;
    return true;
  }
  addScore(n: number) { this.score += n; }
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  // Phaser.GameObjects.GameObject has `state: number | string`; we shadow it
  // with a richer PlayerState object. Cast at write site to satisfy strict TS.
  // @ts-expect-error - intentionally widening the inherited `state` field
  readonly state: PlayerState = new PlayerState();
  private lastFireAt = 0;
  private onGround = false;
  private crouching = false;

  /** tilesheet 帧高 110；body 仍保持 16×16（站立）/ 16×8（下蹲）以匹配旧 hitbox */
  private static readonly FRAME_W = 90;
  private static readonly FRAME_H = 110;
  /** 视觉 sprite 尺寸（setDisplaySize 用）。**不要用 setScale，否则 body 会被缩。 */
  private static readonly DISPLAY_W = 18;
  private static readonly DISPLAY_H = 22;
  private static readonly BODY_W = 16;
  private static readonly BODY_H_STAND = 16;
  private static readonly BODY_H_DUCK = 8;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-ts', 0);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    // 锚点设到中下（feet），让玩家"站在地上"
    this.setOrigin(0.5, 1);
    // ⚠️ Phaser Arcade 物理：body.width = w × gameObject.scaleX。setSize(16, 16) 总是
    // 按当前 scale 缩放赋值。**唯一办法**：先 setScale，再传放大过的尺寸
    // (w / scale, h / scale)，这样 body 算出来 = (w/scale) * scale = w。
    //   16 / 0.2 = 80，setSize(80, 80) → body.width = 80 * 0.2 = 16 ✓
    this.setScale(SCALE.character);                     // 视觉 0.2（18×22）
    this.applyBodySize(false);                         // setSize(80, 80) → body 16×16
    this.setCollideWorldBounds(true);
    this.setMaxVelocity(PHYSICS.playerSpeed, PHYSICS.maxFallSpeed);
  }

  /** 把物理 body 设为 16×N（视觉尺寸），居中放在视觉 sprite (18×22) 内部。
   *  关键：Phaser 内部 body.width = w * scale。所以 setSize 必须传 w/scale 才行。
   *  但 scale 又是动态的……这里用反向计算。设 body 视觉 16×16：传 16/0.2 = 80。 */
  private applyBodySize(duck: boolean): void {
    const w = Player.BODY_W;
    const h = duck ? Player.BODY_H_DUCK : Player.BODY_H_STAND;
    // 视觉 sprite 18×22 在锚点 (0.5, 1) 下：center = (9, 11)
    // body 16×16 居中放在视觉 sprite 内部：body 中心 y = 22 - 8 = 14（脚底上方 8）
    // body 顶 y = 6, body 底 y = 22 = 脚底。offset x = 1。
    // offset 也需要按 scale 反推：offset 视觉 1 = Phaser 内部 1/scale
    const offX = (Player.DISPLAY_W - w) / 2;             // 视觉 1
    const bodyCenterY = Player.DISPLAY_H - 8;             // 视觉 14
    const offY = bodyCenterY - h / 2;                     // 视觉 6 (stand) / 10 (duck)
    // Phaser body 内部用 sprite 坐标系（原 90×110 frame）。setSize 反向放大：
    const s = this.scaleX; // 0.2
    if (this.body) {
      this.body.setSize(w / s, h / s);                     // 80 × 80 → 16×16
      this.body.setOffset(offX / s, offY / s);             // 5, 30 → 视觉 (1, 6)
    } else {
      this.setSize(w, h);
      this.setOffset(offX, offY);
    }
  }

  handleInput(input: InputManager, time: number) {
    if (!this.state.alive) return;
    const vx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    // 始终让 sprite 方向与移动方向一致（即便 vx=0，也按上一次方向保持）。
    if (vx !== 0) this.setFlipX(vx < 0);
    const crouch = input.isDown('crouch');
    if (crouch !== this.crouching) {
      this.crouching = crouch;
      this.applyBodySize(crouch);
    }
    const speed = crouch ? PHYSICS.crouchSpeed : PHYSICS.playerSpeed;
    this.setVelocityX(vx * speed);

    if (input.isDown('jump') && this.onGround && !crouch) {
      this.setVelocityY(PHYSICS.jumpVelocity);
      this.onGround = false;
    }
    if (input.isDown('fire') && time - this.lastFireAt >= this.fireInterval()) {
      this.lastFireAt = time;
      this.scene.events.emit('player-fire', { x: this.x, y: this.y, dir: this.flipX ? -1 : 1, weaponId: this.state.weaponId });
    }
    // 动画状态机
    this.updateAnim(vx, crouch);
  }

  /** 根据 vx/onGround/crouch 切换动画。优先 idle > walk > jump/fall > duck。 */
  private updateAnim(vx: number, crouch: boolean) {
    if (!this.state.alive) {
      if (this.anims.currentAnim?.key !== 'player-hurt') this.play('player-hurt', true);
      return;
    }
    let key: string;
    if (!this.onGround) {
      key = (this.body?.velocity.y ?? 0) < 0 ? 'player-jump' : 'player-fall';
    } else if (crouch) {
      key = 'player-duck';
    } else if (vx !== 0) {
      key = 'player-walk';
    } else {
      key = 'player-idle';
    }
    if (this.anims.currentAnim?.key !== key) this.play(key, true);
  }

  private fireInterval(): number {
    const w = Object.values(WEAPON).find((v) => v.id === this.state.weaponId) ?? WEAPON.single;
    return w.fireIntervalMs;
  }

  setOnGround(b: boolean) { this.onGround = b; }
  isCrouching() { return this.crouching; }
}
