#!/usr/bin/env node
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lintWorkspace, lintAgainstRegistry, lintRoot } from "./lib/lint.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_DIR = path.join(ROOT, "games");
const REGISTRY = path.join(ROOT, ".games-registry.json");

async function portUp(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    const done = (ok) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(500);
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
  });
}

// 根目录结构校验（补 games/ 之外的盲区：游戏被建到根目录等）
const rootLint = lintRoot(ROOT);
const lint = lintAgainstRegistry(lintWorkspace(GAMES_DIR), REGISTRY);
lint.errors.unshift(...rootLint.errors);
lint.warnings.unshift(...rootLint.warnings);

for (const m of lint.manifests) {
  if (typeof m.port === "number" && (await portUp(m.port))) {
    lint.warnings.push({ id: m.id, label: m.label, msg: `端口 ${m.port} 当前在线（游戏运行中，或被其他进程占用）` });
  }
}

console.log("── games 巡检报告 ──────────────────────────");
if (!lint.registryLoaded) console.log("⚠ 基线 .games-registry.json 缺失或损坏——改名/删除保护未生效，运行 tools/new.mjs 或人工重建");
for (const w of lint.warnings) console.log(`⚠ ${w.label}: ${w.msg}`);
for (const e of lint.errors) console.log(`✗ ${e.label}: ${e.msg}`);
if (lint.errors.length === 0 && lint.warnings.length === 0) {
  console.log(`✓ 全部通过：${lint.manifests.length} 个游戏，契约完整，基线一致`);
} else {
  console.log("");
  console.log(`${lint.manifests.length} 个游戏 · ${lint.errors.length} 个问题 · ${lint.warnings.length} 个提醒`);
}
process.exitCode = lint.errors.length ? 1 : 0;
