import { Application, Container } from "pixi.js";
import { MainScene } from "./scenes/MainScene";
import { GameScene } from "./scenes/GameScene";

const W = 960;
const H = 640;

async function main() {
  const app = new Application();
  await app.init({
    width: W,
    height: H,
    backgroundColor: 0x0a0e1a,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  document.getElementById("app")?.appendChild(app.canvas);

  let currentScene: Container | null = null;

  function switchScene(scene: Container) {
    if (currentScene) {
      app.stage.removeChild(currentScene);
      if ("destroy" in currentScene && typeof currentScene.destroy === "function") {
        currentScene.destroy({ children: true });
      }
    }
    currentScene = scene;
    app.stage.addChild(scene);
  }

  function showMainScene() {
    const mainScene = new MainScene();
    mainScene.setOnEnterArena(() => {
      const gameScene = new GameScene(
        mainScene.getCurrentRole(),
        showMainScene
      );
      switchScene(gameScene);
    });
    switchScene(mainScene);
  }

  showMainScene();

  app.ticker.add((ticker) => {
    if (currentScene && "update" in currentScene) {
      (currentScene as { update: (dt: number) => void }).update(ticker.deltaTime);
    }
  });
}

main().catch(console.error);
