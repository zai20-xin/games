import Phaser from 'phaser';

/**
 * 每个 tilesheet 在 Phaser 里的帧尺寸（Kenney CC0 多角色包：8 列 × 3 行 × 90×110）。
 * Phaser 会按从左到右、从上到下自动编号 0..23。
 */
export const TILESHEET_FRAME = { width: 90, height: 110 } as const;

/** 常用帧索引。参考 Kenney Player/Soldier/Adventurer/Zombie pack 实际布局测过：
 *  - row 0 (frames 0..7):  front idle/wave/walk/action/climb/etc.
 *  - row 1 (frames 8..15): side view (left/right profile)
 *  - row 2 (frames 16..23): back/3/4 view
 *  下面这些是各 pack 实际可识别的具名 pose（fallback 仍用 0/3/8/9/10/11）。
 */
export const FRAME = {
  idle:    0,
  jump:    1,
  fall:    2,
  hurt:    3,
  walk1:   8,
  walk2:   9,
  stand:   10,
  duck:    11,
  slide:   17,
  kick:    18,
  attack:  19,
} as const;

/** 在 BootScene 里集中创建所有 tilesheet 上的角色动画。
 *  任何角色 sprite（Player/Grunt/Turret/Boss）都用动画 key 切换。 */
export function createAnims(scene: Phaser.Scene): void {
  const make = (
    texKey: string,
    animKey: string,
    frames: number[],
    frameRate = 8,
    repeat = -1
  ): void => {
    if (scene.anims.exists(animKey)) return;
    // 纹理缺失时不建 anim：空 frames 的 anim 会让 play() 在 getFirstTick 里
    // 读 undefined.duration 直接抛 pageerror；不建 anim 时 play() 只 console.warn。
    if (!scene.textures.exists(texKey)) return;
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(texKey, { frames }),
      frameRate,
      repeat,
    });
  };

  // ---------- Player (Kenney Player pack) ----------
  make('player-ts', 'player-idle', [FRAME.idle], 1, 0);
  make('player-ts', 'player-walk', [FRAME.walk1, FRAME.walk2, FRAME.walk1, FRAME.stand], 8);
  make('player-ts', 'player-jump', [FRAME.jump], 1, 0);
  make('player-ts', 'player-fall', [FRAME.fall], 1, 0);
  make('player-ts', 'player-duck', [FRAME.duck], 1, 0);
  make('player-ts', 'player-hurt', [FRAME.hurt], 1, 0);

  // ---------- Grunt (Kenney Soldier pack) ----------
  make('soldier-ts', 'grunt-idle', [FRAME.idle], 1, 0);
  make('soldier-ts', 'grunt-walk', [FRAME.walk1, FRAME.walk2, FRAME.walk1, FRAME.stand], 8);
  make('soldier-ts', 'grunt-hurt', [FRAME.hurt], 1, 0);
  make('soldier-ts', 'grunt-attack', [FRAME.kick], 1, 0);

  // ---------- Turret (Kenney Adventurer pack，单帧 stand 静态展示) ----------
  // 不放动画；用单 frame 10 (stand)。
  // (在 Turret 构造时直接 scene.add.sprite(..., 10))

  // ---------- Boss (Kenney Zombie pack) ----------
  make('zombie-ts', 'boss-idle',   [FRAME.idle], 2, 0);     // 慢速呼吸
  make('zombie-ts', 'boss-walk',   [FRAME.walk1, FRAME.walk2, FRAME.walk1, FRAME.stand], 6);
  make('zombie-ts', 'boss-hurt',   [FRAME.hurt], 1, 0);
  make('zombie-ts', 'boss-attack', [FRAME.attack], 1, 0);
}
