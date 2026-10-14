// 静态版 lint 门禁（通用）：对 js/ 与 test/ 全部 .js 做 node --check 语法检查
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function collectJs(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...collectJs(full));
    else if (e.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const files = [...collectJs(join(ROOT, "js")), ...collectJs(join(ROOT, "test")), ...collectJs(join(ROOT, "tools"))];
let fail = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status !== 0) {
    fail++;
    process.stdout.write(`\n✗ ${f}\n${r.stderr || r.stdout}\n`);
  }
}
console.log(`\n语法检查: ${files.length} 个文件, ${fail} 个失败`);
process.exit(fail ? 1 : 0);