import Phaser from 'phaser';
import { ASSETS } from '../assets/manifest';
import { TILESHEET_FRAME, createAnims } from '../assets/spritesheets';
import { applyStoredMute } from '../systems/Audio';

export class BootScene extends Phaser.Scene {
  constructor(cfg?: Phaser.Types.Scenes.SettingsConfig) { super({ key: 'Boot', ...cfg }); }

  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn('[asset] missing', file.key));

    // 角色 tilesheet：作为 sprite sheet 切帧（24 帧 90×110）
    // load.spritesheet 会在 textures 里建好 sprite sheet
    const ts = TILESHEET_FRAME;
    const tsKeys = ['player-ts', 'soldier-ts', 'adventurer-ts', 'zombie-ts'] as const;
    for (const k of tsKeys) {
      this.load.spritesheet(k, ASSETS.images[k], { frameWidth: ts.width, frameHeight: ts.height });
    }
    // dungeon atlas: 132 个 16x16 tile，必须按 spritesheet 加载才能用 frame index
    this.load.spritesheet('dungeon', ASSETS.images['dungeon'], { frameWidth: 16, frameHeight: 16 });
    // 剩余静态图（子弹/道具等）
    const staticKeys = Object.keys(ASSETS.images).filter(
      (k) => !(tsKeys as readonly string[]).includes(k) && k !== 'dungeon'
    );
    for (const k of staticKeys) {
      this.load.image(k, ASSETS.images[k as keyof typeof ASSETS.images]);
    }
    // 音频
    Object.entries(ASSETS.audio).forEach(([k, p]) => this.load.audio(k, p));
  }

  create(): void {
    // 给每张 tilesheet 建 idle/walk/jump/duck/hurt/attack 动画
    createAnims(this);
    // 恢复上次会话的静音设置（localStorage contra-remake:settings）
    applyStoredMute(this);
    this.scene.start('Menu');
  }
}
