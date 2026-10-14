#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { lintWorkspace } from "./lib/lint.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_DIR = path.join(ROOT, "games");
const TEMPLATES_DIR = path.join(ROOT, "shared", "templates");
const REGISTRY = path.join(ROOT, ".games-registry.json");
const PORT_START = 4100;
const PORT_END = 4999;
const TODAY = new Date().toISOString().slice(0, 10);
const TEXT_EXTS = new Set([".json", ".md", ".html", ".ts", ".js", ".mjs", ".css", ".toml", ".py", ".txt"]);

function parseArgs(argv) {
  const args = { _: [], tags: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") args.name = argv[++i];
    else if (a === "--desc") args.desc = argv[++i];
    else if (a === "--template") args.template = argv[++i];
    else if (a === "--tag") args.tags.push(argv[++i]);
    else args._.push(a);
  }
  return args;
}

function usage() {
  console.log(`用法: node tools/new.mjs <id> --name <中文名> [选项]
       node tools/new.mjs --adopt <已有目录名>

选项:
  --name <名称>        展示名（默认用 id）
  --desc <一句话简介>   游戏描述
  --template <模板>     vanilla-js | vite-phaser-ts | pygame（默认 vanilla-js）
  --tag <标签>          可重复，如 --tag arcade --tag puzzle`);
}

function updateRegistry(id, port) {
  let reg = { version: 1, updatedAt: "", games: {} };
  try {
    reg = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  } catch {}
  reg.games = reg.games || {};
  reg.games[id] = {
    ...(reg.games[id] || {}),
    port,
    registeredAt: reg.games[id]?.registeredAt || new Date().toISOString().slice(0, 10),
  };
  reg.updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + "\n");
}

function reportLintFor(id) {
  const lint = lintWorkspace(GAMES_DIR);
  const mine = [...lint.errors, ...lint.warnings].filter((i) => i.id === id);
  if (mine.length) console.log(`⚠ 契约提醒:\n${mine.map((i) => `  - ${i.msg}`).join("\n")}`);
  else console.log("✓ 契约校验通过");
}

async function adopt(dirName) {
  const target = path.join(GAMES_DIR, dirName);
  const mfPath = path.join(target, "game.json");
  if (!fs.existsSync(mfPath)) {
    console.error("✗ 目标目录缺少 game.json，无法收编（可先手写一份再 --adopt）");
    process.exitCode = 1;
    return;
  }
  const m = JSON.parse(fs.readFileSync(mfPath, "utf8"));
  if (!m.id) m.id = dirName;
  if (m.id !== dirName) {
    console.error(`✗ id "${m.id}" 与目录名 "${dirName}" 不一致，先修正 game.json`);
    process.exitCode = 1;
    return;
  }
  if (m.type !== "web") {
    m.port = null;
  } else if (typeof m.port !== "number") {
    m.port = await findFreePort();
    console.log(`✓ 自动分配端口 ${m.port}`);
  } else {
    const taken = usedPorts({ excludeId: m.id });
    if (taken.has(Number(m.port)) || (await portUp(Number(m.port)))) {
      const old = m.port;
      m.port = await findFreePort();
      console.log(`⚠ 端口 ${old} 已被占用，重新分配为 ${m.port}`);
    }
  }
  fs.writeFileSync(mfPath, JSON.stringify(m, null, 2) + "\n");
  updateRegistry(m.id, m.port ?? null);
  const hasQs = ensureQualityStandard(target, m.id, m.name);
  console.log(`✓ 已收编注册: games/${dirName}`);
  if (hasQs) console.log(`✓ 已补生成质量标准 docs/quality-standard.md`);
  reportLintFor(m.id);
}

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

function usedPorts({ excludeId } = {}) {
  const used = new Set();
  if (!fs.existsSync(GAMES_DIR)) return used;
  for (const name of fs.readdirSync(GAMES_DIR)) {
    if (name === excludeId) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(GAMES_DIR, name, "game.json"), "utf8"));
      if (m.port) used.add(Number(m.port));
    } catch {}
  }
  return used;
}

async function findFreePort() {
  const used = usedPorts();
  for (let p = PORT_START; p <= PORT_END; p++) {
    if (used.has(p)) continue;
    if (!(await portUp(p))) return p;
  }
  throw new Error(`端口段 ${PORT_START}-${PORT_END} 已耗尽`);
}

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

/** 为新游戏生成 docs/quality-standard.md（交付前自检基线），已存在则不覆盖。 */
function ensureQualityStandard(target, id, name) {
  const src = path.join(TEMPLATES_DIR, "quality-standard-web-game.md");
  if (!fs.existsSync(src)) return false;
  const out = path.join(target, "docs", "quality-standard.md");
  if (fs.existsSync(out)) return false;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const content = fs
    .readFileSync(src, "utf8")
    .replaceAll("__ID__", id)
    .replaceAll("__NAME__", name)
    .replaceAll("__DATE__", TODAY);
  fs.writeFileSync(out, content);
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args._[0] === "--adopt") {
    const dirName = args._[1];
    if (!dirName) {
      usage();
      process.exitCode = 1;
      return;
    }
    await adopt(dirName);
    return;
  }

  const id = args._[0];

  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    usage();
    process.exitCode = 1;
    return;
  }
  const target = path.join(GAMES_DIR, id);
  if (fs.existsSync(target)) {
    console.error(`✗ 目录已存在: games/${id}（路径即接口，禁止覆盖注册）`);
    process.exitCode = 1;
    return;
  }

  const template = args.template || "vanilla-js";
  const tplDir = path.join(TEMPLATES_DIR, template);
  if (!fs.existsSync(path.join(tplDir, "game.json"))) {
    console.error(`✗ 模板不存在: ${template}（可用: ${fs.existsSync(TEMPLATES_DIR) ? fs.readdirSync(TEMPLATES_DIR).join(", ") : "无"}）`);
    process.exitCode = 1;
    return;
  }

  const port = JSON.parse(fs.readFileSync(path.join(tplDir, "game.json"), "utf8")).type === "native" ? null : await findFreePort();
  const name = args.name || id;
  const desc = args.desc || "";

  fs.cpSync(tplDir, target, { recursive: true });
  const hasQs = ensureQualityStandard(target, id, name);
  walk(target, (file) => {
    if (!TEXT_EXTS.has(path.extname(file))) return;
    const src = fs.readFileSync(file, "utf8");
    const out = src.replaceAll("__ID__", id).replaceAll("__NAME__", name).replaceAll("__DESC__", desc).replaceAll("__DATE__", TODAY);
    if (out !== src) fs.writeFileSync(file, out);
  });

  const mfPath = path.join(target, "game.json");
  const manifest = JSON.parse(fs.readFileSync(mfPath, "utf8"));
  manifest.id = id;
  manifest.name = name;
  manifest.description = desc;
  manifest.port = manifest.type === "native" ? null : port;
  if (args.tags.length) manifest.tags = [...new Set([...(manifest.tags || []), ...args.tags])];
  fs.writeFileSync(mfPath, JSON.stringify(manifest, null, 2) + "\n");

  updateRegistry(manifest.id, manifest.port);

  console.log(`✓ 游戏已创建: games/${id}`);
  console.log(`  名称: ${name}`);
  console.log(`  模板: ${template}`);
  console.log(`  端口: ${manifest.port ?? "(native 无需端口)"}`);
  if (hasQs) console.log(`  质量标准: docs/quality-standard.md（交付前自检基线）`);
  reportLintFor(id);
  console.log("");
  console.log(`下一步:`);
  console.log(`  cd games/${id} && 按 README 开发`);
  console.log(`  node dashboard/server.mjs   # 打开 http://localhost:4000 点「启动」`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exitCode = 1;
});
