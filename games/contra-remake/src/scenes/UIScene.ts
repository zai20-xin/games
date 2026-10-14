import Phaser from 'phaser';

/**
 * HUD + 全局键：P 暂停/继续、R 整局重开。
 * Game 被 pause 后自身 input 失效，所以 P/R 必须由整局常驻的 UI 场景接管；
 * M 静音在 Game/Menu 内各自接（见 InputManager / MenuScene），HUD 只负责显示。
 */
export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private lifeText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;

  constructor(cfg?: Phaser.Types.Scenes.SettingsConfig) { super({ key: 'UI', ...cfg }); }

  create(): void {
    // GameScene 每次 create 都会 launch 本场景；先清旧监听防止重启后叠加
    this.events.off('score');
    this.events.off('life');
    this.events.off('weapon');

    this.scoreText = this.add.text(4, 4, 'SCORE 0', { color: '#fff' });
    this.lifeText = this.add.text(4, 14, 'LIFE x3', { color: '#fff' });
    this.weaponText = this.add.text(4, 24, 'WPN:1', { color: '#fff' });
    this.muteText = this.add.text(252, 4, '', { color: '#888' }).setOrigin(1, 0);
    this.pauseText = this.add
      .text(128, 104, 'PAUSED\nP 继续 · R 重开', { color: '#ff0', align: 'center' })
      .setOrigin(0.5)
      .setVisible(false);

    this.events.on('score', (n: number) => this.scoreText.setText(`SCORE ${n}`));
    this.events.on('life', (n: number) => this.lifeText.setText(`LIFE x${n}`));
    this.events.on('weapon', (n: number) => this.weaponText.setText(`WPN:${n}`));

    // 静音指示：状态由 toggleMute 广播的 game.events 驱动（shutdown 时解除）
    const onMuteChanged = (muted: boolean) => this.muteText.setText(muted ? 'MUTED (M)' : '');
    this.game.events.on('mute-changed', onMuteChanged);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('mute-changed', onMuteChanged);
    });
    onMuteChanged(this.sound.mute);

    const pKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    pKey.on('down', () => this.togglePause());
    const rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    rKey.on('down', () => this.restartGame());
  }

  /** P：暂停/继续。 */
  private togglePause(): void {
    const running = this.scene.isActive('Game');
    const paused = this.scene.isPaused('Game');
    if (!running && !paused) return;
    if (paused) {
      this.scene.resume('Game');
      this.pauseText.setVisible(false);
    } else {
      this.scene.pause('Game');
      this.pauseText.setVisible(true);
    }
  }

  /** R：整局重开（暂停中也生效）。stop + start 保证 Game 全新启动并重新 launch UI。 */
  private restartGame(): void {
    if (!this.scene.isActive('Game') && !this.scene.isPaused('Game')) return;
    this.scene.stop('Game');
    this.scene.start('Game'); // ScenePlugin.start 会同时停掉本 UI 场景
  }
}
