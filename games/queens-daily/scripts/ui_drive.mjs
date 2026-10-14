/** 皇后谜题 E2E：渲染 → 真实点击 → 通关面板 → 控制台检查 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import WebSocket from "ws";

const PORT = process.argv[2] ?? "9223";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_BASE = "http://localhost:8091";

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
    } else if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push(msg.params.exceptionDetails.text ?? "exception");
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
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

  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true });
    return res.result?.result?.value;
  };
  const shot = async (name) => {
    const res = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`/tmp/q_${name}.png`, Buffer.from(res.result.data, "base64"));
    console.log(`shot: ${name}`);
  };
  const clickCell = async (idx) => {
    const raw = await evaluate(
      `JSON.stringify((() => { const b = document.querySelectorAll("#board .cell")[${idx}]; const r = b.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; })())`,
    );
    const { x, y } = JSON.parse(raw);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      await sleep(50);
    }
  };

  await send("Page.navigate", { url: URL_BASE });
  await sleep(2000);

  const n = await evaluate("window.__q.n");
  const solution = await evaluate("window.__q.solution()");
  console.log(`board n=${n} solution=${JSON.stringify(solution)}`);
  await shot("01_board");

  // 真实点击一个非提示格 → 应变为皇后
  const state0 = await evaluate("window.__q.state()");
  let probeCell = 0;
  while (state0.marks[probeCell] === 1) probeCell++;
  await clickCell(probeCell);
  await sleep(200);
  const state1 = await evaluate("window.__q.state()");
  console.log(
    state1.marks[probeCell] === 1 ? `real-click ok (cell ${probeCell} → queen)` : `REAL-CLICK FAILED cell ${probeCell}`,
  );

  // 清掉探针皇后（再点两次回到空），然后按解放置全部 → 通关
  await clickCell(probeCell);
  await sleep(100);
  await clickCell(probeCell);
  await sleep(100);
  for (let r = 0; r < n; r++) {
    await evaluate(`window.__q.place(${r * n + solution[r]})`);
  }
  await sleep(400);
  const finalState = await evaluate("window.__q.state()");
  console.log("solved:", finalState.solved);
  await shot("02_win");

  const winPanelVisible = await evaluate(
    `!!document.querySelector(".overlay .panel h2")`,
  );
  console.log("win panel:", winPanelVisible);

  console.log(consoleErrors.length === 0 ? "CONSOLE_CLEAN" : `CONSOLE_ERRORS(${consoleErrors.length}):`);
  for (const e of consoleErrors.slice(0, 5)) console.log("  " + e);

  ws.close();
  chrome.kill();
  process.exit(consoleErrors.length === 0 && finalState.solved ? 0 : 1);
}

main().catch((e) => {
  console.error("driver failed:", e);
  chrome.kill();
  process.exit(1);
});
