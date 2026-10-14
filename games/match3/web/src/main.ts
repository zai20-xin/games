import Phaser from "phaser";
import { SaveManager } from "./ui/save";
import { loadAppSettings, saveAppSettings } from "./ui/settings";
import { Sfx } from "./ui/sfx";
import { MainMenuScene } from "./ui/scenes/MainMenu";
import { LevelMapScene } from "./ui/scenes/LevelMap";
import { GameScene } from "./ui/scenes/GameScene";

SaveManager.load();
Sfx.setMuted(loadAppSettings().muted);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 720,
  height: 1280,
  backgroundColor: "#131234",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MainMenuScene, LevelMapScene, GameScene],
});

// M 键全局静音切换（持久化 match3:settings）
window.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") {
    Sfx.setMuted(!Sfx.isMuted());
    saveAppSettings({ muted: Sfx.isMuted() });
    if (!Sfx.isMuted()) Sfx.play("sparkle");
  }
});

// 调试句柄（自动化测试用）
declare global {
  interface Window { __m3?: unknown }
}
window.__m3 = { game, SaveManager };
