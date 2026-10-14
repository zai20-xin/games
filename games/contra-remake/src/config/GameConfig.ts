import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { GameScene } from '../scenes/GameScene';
import { UIScene } from '../scenes/UIScene';

export function buildGameConfig(
  gameId: string,
  parent: Phaser.Types.Core.GameConfig['parent'] | { parent: string }
): Phaser.Types.Core.GameConfig & { scene: Phaser.Scene[] } {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#000',
    gameTitle: 'Contra · Level 1 Demo',
    gameURL: 'https://example.com/contra',
    version: '0.1.0',
    width: 256,
    height: 240,
    pixelArt: true,
    zoom: 3,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 }, // 自管重力
        debug: false,
      },
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [
      (Object.assign(new BootScene({ key: 'Boot' }), { key: 'Boot' }) as Phaser.Scene),
      (Object.assign(new MenuScene({ key: 'Menu' }), { key: 'Menu' }) as Phaser.Scene),
      (Object.assign(new GameScene({ key: 'Game' }), { key: 'Game' }) as Phaser.Scene),
      (Object.assign(new UIScene({ key: 'UI' }), { key: 'UI' }) as Phaser.Scene),
    ],
  } as unknown as Phaser.Types.Core.GameConfig & { scene: Phaser.Scene[] };
}
