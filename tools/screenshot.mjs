#!/usr/bin/env node
/**
 * tools/screenshot.mjs —— 用 Playwright 无头浏览器给所有 web 游戏截取真实首屏封面。
 *
 * 用途：
 *   遍历 dashboard API 中 type==="web" 的游戏，逐个启动（已在线的跳过启动）、
 *   直连端口截取 1280x720 首屏，保存为 games/<id>/cover.png，
 *   并把该游戏 game.json 的 cover 字段更新为 "cover.png"（保留其余字段与格式）。
 *
 * 运行方式（需先启动 dashboard）：
 *   cd tools && npm install            # 安装 playwright
 *   npx playwright install chromium    # 安装浏览器（国内可加 PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright）
 *   node tools/screenshot.mjs          # 在仓库根目录执行；可选 --only <id> 只截指定游戏
 *
 * 说明：
 *   - 复用单个 browser 实例跑完全部游戏；单个失败不中断整体，最后打印汇总表。
 *   - 已处于 running/portLive 的游戏不重复 start，截图后保持原状（不 stop）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DASHBOARD = process.env.DASHBOARD_URL || "http://localhost:4000";
const VIEWPORT = { width: 1280, height: 720 };
const START_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 600;
const SETTLE_MS = 2_000;

const onlyArg = (() => {
  const i = process.argv.indexOf("--only");
  return i !== -1 ? process.argv[i + 1] : null;
})();

async function apiGet(p) {
  const res = await fetch(`${DASHBOARD}${p}`);
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}`);
  return res.json();
}

async function apiPost(p) {
  const res = await fetch(`${DASHBOARD}${p}`, { method: "POST" });
  const body = await res.text();
  if (!res.ok) throw new Error(`POST ${p} -> ${res.status} ${body.slice(0, 120)}`);
  return body;
}

function findGame(list, id) {
  const g = list.find((x) => x.id === id);
  if (!g) throw new Error("在 /api/games 列表中找不到该游戏");
  return g;
}

/** 轮询直到目标游戏 portLive，超时抛错。 */
async function waitForPortLive(id, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await apiGet("/api/games");
    const g = findGame(list, id);
    if (g.portLive) return g;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`等待端口上线超时（${timeoutMs / 1000}s）`);
}

/** 更新 game.json 的 cover 字段，保留其他字段、2 空格缩进、结尾换行。 */
function updateCoverField(gameId, coverValue) {
  const mfPath = path.join(ROOT, "games", gameId, "game.json");
  const manifest = JSON.parse(fs.readFileSync(mfPath, "utf8"));
  manifest.cover = coverValue;
  fs.writeFileSync(mfPath, JSON.stringify(manifest, null, 2) + "\n");
}

/** 打开页面并截图，networkidle 优先，超时降级 domcontentloaded。 */
async function capture(browser, url, outPath) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  try {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
    } catch {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(SETTLE_MS);
    }
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: outPath, type: "png" });
  } finally {
    await context.close();
  }
}

async function main() {
  const games = (await apiGet("/api/games")).filter((g) => g.type === "web");
  const targets = onlyArg ? games.filter((g) => g.id === onlyArg) : games;
  if (targets.length === 0) {
    console.log(`没有匹配的 web 游戏（--only ${onlyArg}）`);
    process.exit(1);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    console.log("⚠ 内置 Chromium 启动失败，改用系统 Chrome（channel:chrome）");
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  }

  const results = [];
  try {
    for (const g of targets) {
      const { id, name, port, entry } = g;
      const url = `http://127.0.0.1:${port}${entry || "/"}`;
      const rec = { id, name, url, ok: false, note: "" };
      let startedByUs = false;
      console.log(`\n▶ ${id} (${name}) -> ${url}`);

      try {
        // 已在线的游戏不重复 start；否则先启动再轮询上线
        let current = findGame(await apiGet("/api/games"), id);
        if (!current.portLive && !current.running) {
          await apiPost(`/api/games/${id}/start`);
          startedByUs = true;
        }
        current = await waitForPortLive(id, START_TIMEOUT_MS);
        if (startedByUs) current.startedByUs = true;

        const outPath = path.join(ROOT, "games", id, "cover.png");
        await capture(browser, url, outPath);
        const size = fs.statSync(outPath).size;
        if (size < 1024) throw new Error(`截图异常偏小（${size}B），疑似空白页`);
        updateCoverField(id, "cover.png");
        rec.ok = true;
        rec.note = `${(size / 1024).toFixed(1)}KB`;
        console.log(`  ✓ 截图成功 ${rec.note} -> games/${id}/cover.png`);
      } catch (err) {
        rec.note = err.message.replace(/\s+/g, " ").slice(0, 160);
        console.log(`  ✗ 失败：${rec.note}`);
      } finally {
        // 只有本次由我们启动的才停止，恢复原状
        if (startedByUs) {
          try {
            await apiPost(`/api/games/${id}/stop`);
            console.log("  ↩ 已停止（保持原状）");
          } catch (err) {
            console.log(`  ⚠ 停止失败：${err.message.slice(0, 80)}`);
          }
        }
      }
      results.push(rec);
    }
  } finally {
    await browser.close();
  }

  console.log("\n========== 汇总 ==========");
  const okCount = results.filter((r) => r.ok).length;
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.id.padEnd(20)} ${r.ok ? r.note : r.note}`);
  }
  console.log(`\n共 ${results.length} 个 web 游戏：成功 ${okCount}，失败 ${results.length - okCount}`);
  process.exit(okCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(`致命错误：${err.message}`);
  process.exit(1);
});
