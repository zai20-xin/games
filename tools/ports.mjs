#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const GAMES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "games");

async function portUp(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    const done = (ok) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(400);
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
  });
}

const rows = [];
if (fs.existsSync(GAMES_DIR)) {
  for (const name of fs.readdirSync(GAMES_DIR)) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(GAMES_DIR, name, "game.json"), "utf8"));
      rows.push({ id: m.id, name: m.name, port: m.port ?? "-", type: m.type || "web", status: m.status });
    } catch {}
  }
}
rows.sort((a, b) => (a.port ?? 99999) - (b.port ?? 99999));

console.log("端口   类型     状态       在线   游戏");
console.log("─────  ───────  ─────────  ─────  ────────────");
for (const r of rows) {
  const live = typeof r.port === "number" ? (await portUp(r.port) ? "●" : "○") : " ";
  console.log(
    String(r.port).padEnd(5) + "  " +
    r.type.padEnd(8) + " " +
    String(r.status).padEnd(10) + " " +
    live.padEnd(6) + " " +
    `${r.name} (${r.id})`
  );
}
console.log(`\n共 ${rows.length} 个游戏 · 端口段 4100-4999 · dashboard :4000`);
