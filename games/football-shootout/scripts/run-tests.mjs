// 静态版测试门禁（通用）：串行跑 test/test_*.js + smoke；无 test 目录则 skip（exit 0）
import { readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(__dirname, "..", "test");

if (!existsSync(TEST_DIR)) {
  console.log("测试门禁: 无 test/ 目录，skip（0 文件）");
  process.exit(0);
}

const EXCLUDE = new Set(["helpers.js", "debug_bias.js", "stress.js"]);
const files = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith(".js") && !EXCLUDE.has(f) && f !== "smoke.js")
  .concat(existsSync(join(TEST_DIR, "smoke.js")) ? ["smoke.js"] : [])
  .sort();

let passTotal = 0;
let failTotal = 0;
const failures = [];

for (const f of files) {
  const r = spawnSync(process.execPath, [join(TEST_DIR, f)], { cwd: TEST_DIR, encoding: "utf8" });
  if (r.status === 0) passTotal++;
  else {
    failTotal++;
    failures.push(f);
    const tail = (r.stdout || "").trim().split("\n").slice(-5).join("\n");
    process.stdout.write(`\n=== FAIL: ${f} ===\n${tail}\n${(r.stderr || "").slice(-300)}\n`);
  }
}

console.log(`测试门禁: ${passTotal} passed, ${failTotal} failed (共 ${files.length} 个文件)`);
if (failures.length) {
  console.log("失败文件: " + failures.join(", "));
  process.exit(1);
}