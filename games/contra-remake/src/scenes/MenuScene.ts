import Phaser from 'phaser';
import { readHighScore } from '../utils/persistence';
import { toggleMute } from '../systems/Audio';

export class MenuScene extends Phaser.Scene {
  constructor(cfg?: Phaser.Types.Scenes.SettingsConfig) { super({ key: 'Menu', ...cfg }); }
  create(): void {
    this.add.text(40, 60, `HI-SCORE: ${readHighScore()}`, { color: '#ff0' });
    this.add.text(40, 100, 'CONTRA\nLevel 1 Demo\n\nPress Z to Start', { color: '#fff' });
    this.add.text(40, 170, 'P pause · R restart · M mute', { color: '#666' });
    // 使用 Phaser 的 addKey + Key.on('down') 而不是字符串 keydown-Z 事件。
    // 字符串 keydown-X 事件在某些 Phaser 配置下不可靠，addKey 是官方推荐方式。
    const zKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    zKey.once('down', () => this.scene.start('Game'));
    // M 静音在菜单里也可用（与局内同一持久化设置）
    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mKey.on('down', () => toggleMute(this));
  }
}
