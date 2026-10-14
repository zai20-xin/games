import Phaser from "phaser";
import { H, W } from "./config";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { UiScene } from "./scenes/UiScene";
import { SelectScene } from "./scenes/SelectScene";

// e2e/debug：暴露 game 实例供自动化诊断 input/scale 状态
(window as unknown as { __phaser?: Phaser.Game }).__phaser = new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: "#243d12",
  parent: "app",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  roundPixels: true,
  scene: [BootScene, SelectScene, GameScene, UiScene],
});
