#!/usr/bin/env node
/**
 * tools/qa.mjs —— 交付前自检门禁。
 *
 * 用法:
 *   node tools/qa.mjs <id> [--build]
 *     <id>      游戏 id（games/<id>）
 *     --build   额外执行 npm run build（较慢，默认只跑 lint + test）
 *
 * 自检内容:
 *   1. 契约检查（game.json / 端口 / 基线，复用 tools/lib/lint.mjs）
 *   2. npm run lint / test（有则执行；--build 时含 build）
 *   3. 打印该游戏质量标准清单，提示 AI 逐项自查并记录证据
 *
 * 退出码: 自动化检查有失败项时 exit 1。
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lintWorkspace, issuesForGame } from "./lib/lint.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_DIR = path.join(ROOT, "games");
const TEMPLATE_QS = path.join(ROOT, "shared", "templates", "quality-standard-web-game.md");

function usage() {
  console.log(`用法: node tools/qa.mjs <id> [--build]
  <id>      游戏 id（games/<id>）
  --build   额外执行 npm run build（较慢，默认只跑 lint + test）

自检内容:
  1. 契约检查（game.json / 端口 / 基线）
  2. npm run lint / test（有则执行）
  3. 打印质量标准清单，供逐项自查并记录证据`);
}

function run(cmd, args, cwd) {
  console.log(`\n── $ ${cmd} ${args.join(" ")} ──`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  return r.status === 0;
}

function main() {
  const id = process.argv[2];
  const withBuild = process.argv.includes("--build");
  if (!id) {
    usage();
    process.exitCode = 1;
    return;
  }

  const gameDir = path.join(GAMES_DIR, id);
  if (!fs.existsSync(path.join(gameDir, "game.json"))) {
    console.error(`✗ 找不到游戏: games/${id}（缺 game.json）`);
    process.exitCode = 1;
    return;
  }

  let failed = false;

  console.log("── 契约检查 ──────────────────────────");
  const mine = issuesForGame(lintWorkspace(GAMES_DIR), id);
  if (mine.length) {
    for (const m of mine) console.log(m);
    failed = true;
  } else {
    console.log("✓ 契约通过");
  }

  const pkgPath = path.join(gameDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const scripts = JSON.parse(fs.readFileSync(pkgPath, "utf8")).scripts || {};
    for (const [name, enabled] of [["lint", true], ["test", true], ["build", withBuild]]) {
      if (!enabled || !scripts[name]) continue;
      if (!run("npm", ["run", name], gameDir)) failed = true;
    }
  } else {
    console.log("⚠ 无 package.json（纯静态/native 游戏，跳过 npm 检查）");
  }

  console.log("\n── 质量标准自查 ──────────────────────");
  const qsPath = path.join(gameDir, "docs", "quality-standard.md");
  const qs = fs.existsSync(qsPath) ? qsPath : TEMPLATE_QS;
  const content = fs.readFileSync(qs, "utf8");
  if (!fs.existsSync(qsPath)) {
    console.log(`⚠ 该游戏缺少 docs/quality-standard.md，以下为通用模板（新游戏脚手架会自动生成）`);
  }
  console.log(`请对照 ${path.relative(ROOT, qs)} 逐项自查，并在「六、自检记录」填写证据：`);
  console.log(content.split("## 六、")[0]);

  console.log(failed ? "\n✗ 自检未通过（见上方失败项）" : "\n✓ 自动化检查通过，请完成视觉/功能自查后交付");
  process.exitCode = failed ? 1 : 0;
}

main();
