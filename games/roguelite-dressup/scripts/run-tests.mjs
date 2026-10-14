// 静态版测试门禁：串行跑 test/test_*.js + smoke（node 原生断言，靠 exitCode 判通过）
// 排除：helpers.js（设施）、debug_bias.js（调试）、stress.js（压测，不放门禁）
import { readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(__dirname, "..", "test");
const EXCLUDE = new Set(["helpers.js", "debug_bias.js", "stress.js"]);

const files = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith(".js") && !EXCLUDE.has(f))
  .sort();

let passTotal = 0;
let failTotal = 0;
const failures = [];

for (const f of files) {
  const r = spawnSync(process.execPath, [resolve(TEST_DIR, f)], { cwd: TEST_DIR, encoding: "utf8" });
  const ok = r.status === 0;
  if (ok) passTotal++;
  else {
    failTotal++;
    failures.push(f);
    // 只输出失败尾巴，避免绿色噪音
    const tail = (r.stdout || "").trim().split("\n").slice(-5).join("\n");
    process.stdout.write(`\n=== FAIL: ${f} ===\n${tail}\n${(r.stderr || "").slice(-300)}\n`);
  }
}

console.log(`\n测试门禁: ${passTotal} passed, ${failTotal} failed (共 ${files.length} 个文件)`);
if (failures.length) {
  console.log("失败文件: " + failures.join(", "));
  process.exit(1);
}