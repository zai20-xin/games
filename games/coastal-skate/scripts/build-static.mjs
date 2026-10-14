// 静态版 build（通用）：把可静态托管的整套资源汇总到 dist/（按存在性拷贝）
// 拷贝：index.html + js/ + css/ + 其余常见根级静态资源（封面/图标/manifest/sw/favicon）
import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

rmSync(DIST, { recursive: true, force: true });

// index.html + js/ 必备
mkdirSync(join(DIST, "js"), { recursive: true });
cpSync(join(ROOT, "index.html"), join(DIST, "index.html"));
cpSync(join(ROOT, "js"), join(DIST, "js"), { recursive: true });

// css/（若存在）
if (existsSync(join(ROOT, "css"))) {
  mkdirSync(join(DIST, "css"), { recursive: true });
  cpSync(join(ROOT, "css"), join(DIST, "css"), { recursive: true });
}

// 其余确定性单文件：存在则拷贝
const EXTRAS = ["style.css", "cover.png", "favicon.ico", "manifest.json", "sw.js",
  "icon-192.png", "icon-512.png", "App_icon_for_a_Chinese_chess_g_2026-08-18T14-16-56.png"];
for (const f of EXTRAS) {
  if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(DIST, f));
}

console.log(`build 完成 → ${DIST}`);