// 静态版 build：把可静态托管的产物汇总到 dist/（拷贝 index.html + js/ + 封面等）
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, "js"), { recursive: true });

cpSync(join(ROOT, "index.html"), join(DIST, "index.html"));
cpSync(join(ROOT, "js"), join(DIST, "js"), { recursive: true });
for (const f of ["cover.png", "favicon.ico"]) {
  if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(DIST, f));
}
console.log(`build 完成 → ${DIST}`);