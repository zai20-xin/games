import Phaser from 'phaser';
import { readSettings, updateSettings } from '../utils/settings';

/**
 * 安全的音效播放工具。
 *
 * 关键约束：
 * - 用 `scene.sound.get(key).play()` 而不是 `scene.sound.play(key)`。
 *   前者从 manifest 加载好的 Sound 对象里取（O(1)），后者会按 key 重新走 add+play，
 *   在未通过 BootScene 预加载的 key 上会抛错。
 * - 浏览器自动播放策略要求"首次用户交互后才能播 Audio"；
 *   Phaser 在 unlock 之前调用 .play() 不会抛错，但也没声音。我们不抛错，避免拖垮 e2e。
 * - headless / jsdom 环境下 SoundBaseContext 不存在，调用 .play() 会抛错；
 *   用 try/catch 包裹，失败时静默，保证单元测试与 e2e 都能跑过。
 */
export function playSfx(scene: Phaser.Scene, key: string, volume = 1.0): void {
  try {
    const sfx = scene.sound.get(key) as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound | undefined;
    if (!sfx) return;
    if (!sfx.isPlaying) {
      sfx.play({ volume });
    }
  } catch {
    // 静默：headless / autoplay-blocked / sound missing 都吞掉
  }
}

/**
 * 启动/恢复一首 BGM 循环。
 * - 已经在播就不重复 play()（否则 Phaser 会把播放指针重置，体验不好）。
 * - 跨 scene 持续：调用方负责 stop。
 * - 用 volume=0.5 默认值。
 */
export function startBgm(scene: Phaser.Scene, key: string, volume = 0.5): void {
  try {
    const bgm = scene.sound.get(key) as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound | undefined;
    if (!bgm) return;
    if (bgm.isPlaying) return;
    bgm.play({ loop: true, volume });
  } catch {
    // 静默
  }
}

/** 停一首 BGM。失败/不存在都静默。 */
export function stopBgm(scene: Phaser.Scene, key: string): void {
  try {
    const bgm = scene.sound.get(key);
    if (bgm && bgm.isPlaying) {
      bgm.stop();
    }
  } catch {
    // 静默
  }
}

/** 开机时应用持久化的静音设置（BootScene.create 调用）。 */
export function applyStoredMute(scene: Phaser.Scene): void {
  try {
    scene.sound.mute = readSettings().muted;
  } catch {
    // 静默
  }
}

/**
 * 切换全局静音并持久化到 localStorage（contra-remake:settings）。
 * 返回切换后是否处于静音。同时广播 game.events 'mute-changed' 供 HUD 更新。
 */
export function toggleMute(scene: Phaser.Scene): boolean {
  let muted = false;
  try {
    muted = !scene.sound.mute;
    scene.sound.mute = muted;
  } catch {
    // 静默
  }
  updateSettings({ muted });
  scene.game.events.emit('mute-changed', muted);
  return muted;
}
