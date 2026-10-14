import Phaser from "phaser";
import { H, W } from "./config";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";

(window as unknown as { __phaser?: Phaser.Game }).__phaser = new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: "#FFF8F2",
  parent: "app",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: "app",
    width: W,
    height: H,
  },
  roundPixels: true,
  scene: [BootScene, MenuScene, GameScene],
});

window.addEventListener("resize", () => {
  (window as unknown as { __phaser?: Phaser.Game }).__phaser?.scale.refresh();
});
