/**
 * CDP 驱动无头 Chrome 走通：领礼包 → 主菜单 → 选关 → 简报 → 教学 → 棋盘
 * 用法: node tools/ui_drive.mjs [port]
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import WebSocket from "ws";

const PORT = process.argv[2] ?? "9223";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_BASE = "http://localhost:8123";

// 设计坐标 → 屏幕坐标：基于 canvas 实际 boundingRect
let RECT = { left: 0, top: 0, width: 720, height: 1280 };
const sx = (dx) => RECT.left + (dx / 720) * RECT.width;
const sy = (dy) => RECT.top + (dy / 1280) * RECT.height;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  "--window-size=760,1320",
  "about:blank",
], { stdio: "ignore" });

const consoleErrors = [];

async function main() {
  // 等待调试端口
  let targets = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      targets = await res.json();
      if (targets.some((t) => t.type === "page")) break;
    } catch { /* retry */ }
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
  await new Promise((r) => ws.on("open", r));

  let msgId = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.consoleAPICalled") {
      const line = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      if (msg.params.type === "error") consoleErrors.push(line);
      if (line.includes("[m3]")) console.log("[page]", line);
    } else if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push(msg.params.exceptionDetails.text ?? "exception");
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++msgId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Log.enable");

  const shot = async (name) => {
    const res = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`/tmp/m3_${name}.png`, Buffer.from(res.result.data, "base64"));
    console.log(`shot: ${name}`);
  };
  const click = async (dx, dy) => {
    const x = sx(dx);
    const y = sy(dy);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
    await sleep(40);
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", {
        type, x, y, button: "left", clickCount: 1,
      });
      await sleep(60);
    }
  };
  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true });
    return res.result?.result?.value;
  };
  const syncRect = async () => {
    const raw = await evaluate(
      `JSON.stringify(document.querySelector("canvas").getBoundingClientRect())`,
    );
    RECT = JSON.parse(raw);
    console.log(`canvas rect: ${RECT.left},${RECT.top} ${RECT.width}x${RECT.height}`);
  };
  const nav = async (url) => {
    await send("Page.navigate", { url });
    await sleep(2200);
    await syncRect();
  };

  await nav(URL_BASE);
  await shot("01_daily");
  console.log("registry@menu:", await evaluate("window.__m3btn()"), "rawlen:", await evaluate("window.__m3btnraw.length"), "scenes:", await evaluate("Object.keys(window.__m3.game.scene.keys).join(',')"))

  await click(360, 745);      // 收下了
  await sleep(400);
  console.log("after-claim reg:", await evaluate("window.__m3btn()"), "modal:", await evaluate("window.__m3modal"));
  console.log("registry@menu-after:", JSON.stringify(await evaluate("window.__m3btn()")));
  await shot("02_menu");

  await click(360, 560);      // 开始游戏
  await sleep(1200);
  await shot("03_map");

  // 第 1 关节点：scrollY 被 clamp 到 worldH-1280=4345，节点屏幕 y=5350-4345≈1005
  await click(360, 1005);
  await sleep(1200);
  await shot("04_briefing");

  await click(360, 830);      // 开始
  await sleep(600);
  await shot("05_tutorial");

  await click(360, 745);      // 知道了
  await sleep(1800);          // 等发牌动画
  await shot("06_board");

  console.log(consoleErrors.length === 0 ? "CONSOLE_CLEAN" : `CONSOLE_ERRORS(${consoleErrors.length}):`);
  for (const e of consoleErrors.slice(0, 5)) console.log("  " + e);

  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error("driver failed:", e);
  chrome.kill();
  process.exit(1);
});
