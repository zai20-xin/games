#!/usr/bin/env node
/**
 * tools/shot-garden.mjs —— garden-defense 的 L2 定向截图工具。
 * 用 __phaser 钩子切换场景后截图，验证战斗贴图/HUD 与成就、商店等新场景。
 * 用法：node tools/shot-garden.mjs [day|achievements|shop]（默认 day = 战斗场景）
 * 产物：games/garden-defense/docs/shot-<mode>.png
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME_URL = "http://127.0.0.1:4103/";
const OUT_DIR = path.join(ROOT, "games", "garden-defense", "docs");
const mode = process.argv[2] || "day";
const SCENE_KEYS = { day: "game", achievements: "Achievements", shop: "Shop", codex: "Codex", select: null, fusion: "game" };
if (!SCENE_KEYS.hasOwnProperty(mode)) {
  console.error(`未知模式 "${mode}"，可用：day | achievements | shop | codex | select | fusion`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));

try {
  await page.goto(GAME_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(3000);

  if (mode === "day") {
    await page.evaluate(() => {
      const g = window.__phaser;
      const deck = ["rose", "daffodil", "crabapple", "chrysanthemum", "lotus", "orchid"];
      const sm = g.scene;
      sm.stop("select");
      sm.start("game", { levelId: "day", deck });
      sm.start("ui");
    });
    await page.waitForTimeout(6000); // 等待传送带刷牌 + UiScene 订阅完成

    // 放置 6 朵不同花卉到网格（免扣卡），并触发一波宠物
    await page.evaluate(() => {
      const g = window.__phaser;
      const game = g.scene.getScene("game");
      if (!game) return;

      game.freeSelect = true;
      const kinds = ["rose", "daffodil", "crabapple", "chrysanthemum", "lotus", "orchid"];
      kinds.forEach((k, i) => {
        const row = i % 5;
        const col = i + 1;
        try { game.tryPlant(k, row, col); } catch {}
      });

      // 启动第一波，让宠物生成
      try { game.startNextWave(); } catch {}
      // 若已有波次生成，强制生成几个宠物到草地上
      try { if (game.spawnTimer) { game.spawnTimer.remove(); game.spawnTimer = null; } } catch {}
      try { game.spawnOne(); } catch {}
    });
    await page.waitForTimeout(3000);

    const diag = await page.evaluate(() => {
      const g = window.__phaser;
      const game = g.scene.getScene("game");
      return {
        flowerCount: game?.flowers?.length ?? -1,
        petCount: game?.pets?.length ?? -1,
        wave: game?.wave?.current ?? game?.currentWave ?? -1,
        beltIcons: g.scene.getScene("ui")?.beltIcons?.size ?? -1,
        scene: g.scene.getScenes(true).map((s) => s.scene.key),
      };
    });
    console.log(`诊断:`, JSON.stringify(diag));
  } else if (mode === "fusion") {
    // 双轨融合预览：种两株花，选中 rose 后分别悬停验证"同名升阶"与"异名嫁接"面板
    await page.evaluate(() => {
      const g = window.__phaser;
      const deck = ["rose", "daffodil", "crabapple", "chrysanthemum", "lotus", "orchid"];
      const sm = g.scene;
      sm.stop("select");
      sm.start("game", { levelId: "day", deck });
      sm.start("ui");
    });
    await page.waitForTimeout(6000);

    await page.evaluate(() => {
      const game = window.__phaser.scene.getScene("game");
      if (!game) return;
      game.freeSelect = true;
      game.tryPlant("rose", 0, 1);      // 同名升阶靶子
      game.tryPlant("daffodil", 2, 1);  // 异名嫁接靶子
    });
    await page.waitForTimeout(800);

    const hoverCell = async (row, col) => {
      await page.evaluate(
        ({ r, c }) => {
          const game = window.__phaser.scene.getScene("game");
          const cell = game.grid.cellCenter(r, c);
          game.armSelect("rose", true);
          game.updateGhost({ x: cell.x, y: cell.y });
        },
        { r: row, c: col }
      );
      await page.waitForTimeout(400);
    };

    const gradeShot = path.join(OUT_DIR, "shot-fusion-grade.png");
    await hoverCell(0, 1);
    await page.screenshot({ path: gradeShot, type: "png" });
    console.log(`✓ 已截图 ${gradeShot} (${(fs.statSync(gradeShot).size / 1024).toFixed(1)}KB)`);

    const graftShot = path.join(OUT_DIR, "shot-fusion-graft.png");
    await hoverCell(2, 1);
    await page.screenshot({ path: graftShot, type: "png" });
    console.log(`✓ 已截图 ${graftShot} (${(fs.statSync(graftShot).size / 1024).toFixed(1)}KB)`);

    const diag = await page.evaluate(() => {
      const game = window.__phaser.scene.getScene("game");
      return {
        flowerCount: game?.flowers?.length ?? -1,
        tipVisible: game?.fusionTip?.visible ?? false,
        selected: game?.selected ?? null,
      };
    });
    console.log(`诊断:`, JSON.stringify(diag));
  } else if (mode === "select") {
    // 首屏即选关场景，无需切换
    const diag = await page.evaluate(() => {
      const g = window.__phaser;
      return { scene: g.scene.getScenes(true).map((s) => s.scene.key) };
    });
    console.log(`诊断:`, JSON.stringify(diag));
  } else {
    await page.evaluate((key) => {
      window.__phaser.scene.stop("select");
      window.__phaser.scene.start(key);
    }, SCENE_KEYS[mode]);
    await page.waitForTimeout(2000);

    const diag = await page.evaluate((key) => {
      const g = window.__phaser;
      return { scene: g.scene.getScenes(true).map((s) => s.scene.key), target: key };
    }, SCENE_KEYS[mode]);
    console.log(`诊断:`, JSON.stringify(diag));
  }

  // fusion 模式已自行产出两张截图，跳过通用命名
  if (mode !== "fusion") {
    const out = path.join(OUT_DIR, `shot-${mode}.png`);
    await page.screenshot({ path: out, type: "png" });
    console.log(`✓ 已截图 ${out} (${(fs.statSync(out).size / 1024).toFixed(1)}KB)`);
  }
} finally {
  await browser.close();
}