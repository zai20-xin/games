import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { InputManager } from '../systems/InputManager';
import { LEVEL_1 } from '../config/Levels';
import { generateLevel1 } from '../../scripts/build-level1.mjs';
import { buildGroundTiles } from '../systems/CollisionSystem';
import { BulletPool } from '../entities/Bullet';
import { Grunt } from '../entities/Grunt';
import { Turret } from '../entities/Turret';
import { PowerUp } from '../entities/PowerUp';
import { WEAPON, PHYSICS } from '../utils/constants';
import { AI, COMBAT, POOL, SPAWN, TIMING } from '../config/tuning';
import { readHighScore, writeHighScore } from '../utils/persistence';
import { playSfx, startBgm, stopBgm, toggleMute } from '../systems/Audio';

/** e2e 通过 window.__GAMESCENE__ 检查内部状态（见 tests/e2e/gameplay.spec.ts） */
declare global {
  interface Window { __GAMESCENE__?: GameScene | undefined }
}

interface EnemyRef {
  obj: Grunt | Turret;
  alive: () => boolean;
  die: () => void;
}

interface FireEvent {
  x: number;
  y: number;
  dir: number;
  weaponId?: number;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputMgr!: InputManager;
  private playerBullets!: BulletPool;
  private enemyBullets!: BulletPool;
  private groundBodies!: Phaser.Physics.Arcade.StaticGroup;
  private enemies: EnemyRef[] = [];
  /** 防止在死亡后重复调度 delayedCall */
  private dyingTriggered = false;
  /** 场景级订阅的解绑函数；Phaser shutdown 不会自动清 scene.events 监听，
   *  不清理的话重启后同一批监听会叠加（子弹双倍速、事件双发等）。 */
  private disposers: Array<() => void> = [];

  create(): void {
    // 重启语义：同实例复用，状态必须归零
    this.disposers = [];
    this.dyingTriggered = false;

    this.scene.launch('UI');
    this.cameras.main.setBounds(0, 0, LEVEL_1.width, LEVEL_1.height);
    this.physics.world.setBounds(0, 0, LEVEL_1.width, LEVEL_1.height);

    // 暴露到 window 上供 e2e 测试验证内部状态
    window.__GAMESCENE__ = this;

    const data = generateLevel1();
    const { bodies } = buildGroundTiles(this, data, SPAWN.groundTilesWidth);
    this.groundBodies = bodies;

    this.player = new Player(this, LEVEL_1.playerSpawn.x, LEVEL_1.playerSpawn.y);
    this.player.setOnGround(false);
    this.cameras.main.startFollow(this.player, true, SPAWN.cameraLerp, SPAWN.cameraLerp);

    this.inputMgr = new InputManager(this.input.keyboard!);

    // 玩家 vs 地面：玩家会真正地站在地上。
    // （as unknown 收窄回 Sprite 基类视角：Player.state 故意遮蔽了 GameObject.state）
    this.physics.add.collider(this.player as unknown as Phaser.Physics.Arcade.Sprite, this.groundBodies);

    // 子弹池（玩家 + 敌人各一个）
    this.playerBullets = new BulletPool({ capacity: POOL.bulletCapacity, scene: this });
    this.enemyBullets = new BulletPool({ capacity: POOL.bulletCapacity, scene: this });

    // ---- 场景事件订阅（统一走 disposer，shutdown 时解绑）----
    const onScene = (evt: string, fn: (...args: unknown[]) => void): void => {
      this.events.on(evt, fn);
      this.disposers.push(() => this.events.off(evt, fn));
    };

    onScene('player-fire', (e) => this.firePlayerBullet(e as FireEvent));
    onScene('enemy-fire', (e) => this.fireEnemyBullet(e as FireEvent));
    // 权威的 SFX 路径：GameScene 监听 player-fire 播 sfx-fire。
    // Player.handleInput 也会本地播一次（防御性冗余），try/catch 已包裹。
    onScene('player-fire', () => playSfx(this, 'sfx-fire', 1.0));

    // ---- 全局事件订阅（game.events 跨场景常驻，同样必须解绑）----
    const onScoreChanged = (n: number): void => {
      this.scene.get('UI')?.events.emit('score', n);
    };
    const onWeaponChanged = (id: number): void => {
      this.scene.get('UI')?.events.emit('weapon', id);
    };
    this.game.events.on('score-changed', onScoreChanged);
    this.game.events.on('weapon-changed', onWeaponChanged);
    this.disposers.push(() => this.game.events.off('score-changed', onScoreChanged));
    this.disposers.push(() => this.game.events.off('weapon-changed', onWeaponChanged));

    onScene('enemy-killed', (e) => {
      const { score } = e as { score: number };
      this.player.state.addScore(score);
      this.game.events.emit('score-changed', this.player.state.score);
      // 击杀反馈：音效 + 轻微震屏
      playSfx(this, 'sfx-hit', 1.0);
      this.cameras.main.shake(TIMING.killShakeMs, TIMING.killShakeIntensity);
    });

    // ---- 每帧逻辑（原 events.on('update') 三处合并进 update()，避免重复订阅）----

    // 放置敌人（脚底锚点：y 为"脚底所在像素"）
    const grunts = SPAWN.grunts.map((p) => new Grunt(this, p.x, p.y));
    const turrets = SPAWN.turrets.map((p) => new Turret(this, p.x, p.y));
    this.enemies = [...grunts, ...turrets].map((obj) => ({
      obj,
      alive: () => obj.alive,
      die: () => obj.takeDamage(COMBAT.executeDamage),
    }));

    // PowerUp 是浮空物，保留中心锚点；y 表示中心像素。
    const pu = new PowerUp(this, SPAWN.powerUp.x, SPAWN.powerUp.y, SPAWN.powerUp.weapon);
    const onPickup = (_playerObj: unknown, _puGfx: unknown): void => {
      if (!pu.alive) return;
      pu.applyTo(this.player.state);
      this.game.events.emit('weapon-changed', this.player.state.weaponId);
    };
    this.physics.add.overlap(
      this.player as unknown as Phaser.Physics.Arcade.Sprite,
      pu.gfx!,
      onPickup,
    );

    // Boss 死亡：写最高分 + 显示 'STAGE CLEAR!' + 延时回 Menu
    onScene('boss-killed', () => {
      writeHighScore(Math.max(readHighScore(), this.player.state.score));
      this.add.text(40, 100, 'STAGE CLEAR!', { color: '#fff' });
      this.time.delayedCall(TIMING.stageClearToMenuMs, () => this.scene.start('Menu'));
    });

    // M 静音（局内）；P/R 由常驻的 UIScene 接管（暂停中的 Game 收不到键盘）。
    this.inputMgr.on('mute', (down) => {
      if (down) toggleMute(this);
    });

    // BGM 循环：只在 GameScene 启动，跨 scene 持续到 shutdown 停止。
    // MenuScene 不播（用户 Z 进入 GameScene 算用户交互，浏览器 autoplay 策略解锁）。
    startBgm(this, 'bgm-1', 0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  /**
   * 场景退出（stop/sleep/restart）统一清理点：
   * 解绑所有订阅 + 停 BGM。原 `shutdown()` 方法从未被 Phaser 自动调用过，
   * 这里改为显式注册 SHUTDOWN 事件才真正生效。
   */
  private handleShutdown(): void {
    for (const d of this.disposers.splice(0)) d();
    stopBgm(this, 'bgm-1');
    window.__GAMESCENE__ = undefined;
  }

  /**
   * 玩家开火：根据当前武器设置发射 1/2/3 颗子弹。
   * 单/双/快速/激光：1 颗；霰弹：3 颗（扇形 spread）。
   */
  private firePlayerBullet(e: FireEvent): void {
    const w = (Object.values(WEAPON) as Array<{ id: number; bullets: number; spread: number }>)
      .find((v) => v.id === e.weaponId) ?? WEAPON.single;
    // 玩家是脚底锚点：枪管在 sprite 内部 SPAWN.muzzleHeight 处；
    // 子弹是中心锚点，直接用枪口 y 作为子弹中心。
    const muzzleY = e.y - SPAWN.muzzleHeight;
    for (let i = 0; i < w.bullets; i++) {
      const offset = w.bullets === 1 ? 0 : (i - (w.bullets - 1) / 2) * w.spread;
      const b = this.playerBullets.acquire(e.x, muzzleY, e.dir, 'player');
      if (b.gfx) b.gfx.y = muzzleY;
      if (offset !== 0 && b.gfx) b.gfx.x = e.x + offset * SPAWN.spreadPixelStep;
    }
  }

  /** 敌人开火：直接发一颗 enemy 子弹（owner='enemy'），枪口高度与玩家一致。 */
  private fireEnemyBullet(e: FireEvent): void {
    this.enemyBullets.acquire(e.x, e.y - SPAWN.muzzleHeight, e.dir, 'enemy');
  }

  /** 受击闪白（Phaser 内建 tintFill）：短暂全白后还原。gfx 可能已被销毁，需容错。 */
  private flashWhite(gfx: Phaser.GameObjects.Sprite | undefined): void {
    if (!gfx) return;
    gfx.setTintFill(0xffffff);
    this.time.delayedCall(TIMING.hitFlashWhiteMs, () => {
      try { gfx.clearTint(); } catch { /* 已销毁 */ }
    });
  }

  /** 每帧 AABB 命中检测：玩家子弹 vs 敌人。
   *  子弹是中心锚点；敌人是脚底锚点（16x16）→ 中心 y = obj.y - 8。 */
  private checkPlayerBulletHits(): void {
    for (let i = this.playerBullets.active.length - 1; i >= 0; i--) {
      const b = this.playerBullets.active[i];
      if (!b.active) continue;
      for (const e of this.enemies) {
        if (!e.alive()) continue;
        const ex = e.obj.x;
        const ey = e.obj.y - SPAWN.muzzleHeight; // 脚底 → 中心
        if (Math.abs(b.x - ex) < COMBAT.hitHalfWidth && Math.abs(b.y - ey) < COMBAT.hitHalfWidth) {
          e.obj.takeDamage(COMBAT.bulletDamage);
          if (!e.alive()) {
            // 击杀：销毁可视对象并发击杀事件
            try { e.obj.gfx.destroy(); } catch { /* ignore */ }
            this.events.emit('enemy-killed', { score: COMBAT.killScore });
          } else {
            // 未死：受击闪白
            this.flashWhite(e.obj.gfx);
          }
          this.playerBullets.release(b);
          break;
        }
      }
    }
  }

  /** 每帧 AABB 命中检测：敌人子弹 vs 玩家。
   *  子弹是中心锚点；玩家是脚底锚点（16x16）→ 中心 y = player.y - 8。 */
  private checkEnemyBulletHits(): void {
    for (let i = this.enemyBullets.active.length - 1; i >= 0; i--) {
      const b = this.enemyBullets.active[i];
      if (!b.active) continue;
      const px = this.player.x;
      const py = this.player.y - SPAWN.muzzleHeight; // 脚底 → 中心
      if (Math.abs(b.x - px) < COMBAT.hitHalfWidth && Math.abs(b.y - py) < COMBAT.playerHitHalfHeight) {
        const hit = this.player.state.takeDamage();
        if (hit) {
          // 受击反馈：全屏红闪 + 震屏 + 音效 + HUD 血量刷新
          this.cameras.main.flash(TIMING.hurtFlashMs, 255, 0, 0, false);
          this.cameras.main.shake(TIMING.hurtFlashMs, TIMING.hurtShakeIntensity);
          playSfx(this, 'sfx-hit', 1.0);
          this.game.events.emit('life-changed', this.player.state.lives);
          this.scene.get('UI')?.events.emit('life', this.player.state.lives);
        }
        this.enemyBullets.release(b);
      }
    }
  }

  /** 敌人 AI：开火 / 巡逻（Grunt 无物理体，水平平移）。 */
  private tickEnemies(time: number, delta: number): void {
    if (!this.player.state.alive) return;
    for (const e of this.enemies) {
      if (!e.alive()) continue;
      const action = e.obj.tickAI(this.player.x, this.player.y, time);
      if (action === 'fire') {
        const dir = e.obj instanceof Turret ? e.obj.fireDir(this.player.x) : (this.player.x >= e.obj.x ? 1 : -1);
        this.events.emit('enemy-fire', { x: e.obj.x, y: e.obj.y, dir, source: e.obj });
      } else if (action === 'patrol' && e.obj instanceof Grunt) {
        e.obj.move(PHYSICS.enemySpeed * (delta / 1000) * e.obj.patrolDir);
      }
    }
  }

  update(_time: number, delta: number): void {
    // 自管重力（GameConfig 里 arcade.gravity 设为 0）
    if (this.player.body) {
      this.player.setVelocityY(this.player.body.velocity.y + (PHYSICS.gravity * delta) / 1000);
    }
    this.player.handleInput(this.inputMgr, _time);
    // 把"碰到地面"的状态写回 player，让跳跃能重新触发
    this.player.setOnGround(!!this.player.body?.blocked.down);

    // 子弹推进（先于命中检测，位置保持新鲜）
    this.playerBullets.update(_time, delta, LEVEL_1.width);
    this.enemyBullets.update(_time, delta, LEVEL_1.width);

    this.tickEnemies(_time, delta);
    this.checkPlayerBulletHits();
    this.checkEnemyBulletHits();

    // 死亡只调度一次
    if (!this.player.state.alive && !this.dyingTriggered) {
      this.dyingTriggered = true;
      this.player.setVelocity(0, 0);
      this.time.delayedCall(TIMING.deathToMenuMs, () => this.scene.start('Menu'));
    }
  }
}
