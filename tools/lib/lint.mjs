import fs from "node:fs";
import path from "node:path";

export const STATUSES = ["idea", "prototype", "demo", "playable", "archived"];
export const PORT_START = 4100;
export const PORT_END = 4999;

// 工作区根目录合法顶层项（依据 AGENTS.md 第 2 节目录结构）
export const ROOT_ALLOWED_DIRS = new Set(["games", "dashboard", "tools"]);
export const ROOT_ALLOWED_FILES = new Set(["AGENTS.md", "CLAUDE.md", "README.md", "LICENSE", ".gitignore", ".games-registry.json", ".DS_Store"]);
// 工具/系统自建目录，不参与结构校验；shared/knowledge 为本地私有目录（git 不跟踪，仅本机留存）
const ROOT_IGNORED = new Set([".git", ".shots", ".workbuddy", "node_modules", "shared", "knowledge"]);

/**
 * 根目录结构校验：捕捉「游戏被建到根目录」这类事故。
 * 2026-08-31 事故：批量补 docs/quality-standard.md 时用了相对路径，
 * 在根目录生成了 14 个与 games/ 同名的空壳目录（每个只有 docs/ 一个文件），
 * 而 lintWorkspace 只扫 games/，巡检 exit 0 却完全看不见。此函数补上该盲区。
 */
export function lintRoot(ROOT) {
  const errors = [];
  const warnings = [];
  if (!fs.existsSync(ROOT)) return { errors, warnings };

  for (const name of fs.readdirSync(ROOT)) {
    if (ROOT_IGNORED.has(name)) continue;
    const full = path.join(ROOT, name);
    let isDir;
    try {
      isDir = fs.statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      if (ROOT_ALLOWED_DIRS.has(name)) continue;
      // 与 games/ 下已有游戏同名 → 极可能是路径写错的空壳，报 ERROR
      const twin = path.join(ROOT, "games", name);
      if (fs.existsSync(twin)) {
        errors.push({
          id: name,
          label: name,
          msg: `根目录出现与 games/${name} 同名的目录（游戏只能建在 games/ 下，疑似脚本相对路径写错，核对后清理）`,
        });
      } else {
        errors.push({
          id: name,
          label: name,
          msg: `根目录出现未登记目录（AGENTS.md 只允许 games/dashboard/tools，改用 tools/new.mjs 或清理）`,
        });
      }
    } else if (!ROOT_ALLOWED_FILES.has(name)) {
      warnings.push({ id: name, label: name, msg: "根目录出现未登记文件（疑似临时产物，确认后清理或登记）" });
    }
  }
  return { errors, warnings };
}

export function lintWorkspace(GAMES_DIR) {
  const errors = [];
  const warnings = [];
  const manifests = [];
  const seenIds = new Map();
  const seenPorts = new Map();

  const push = (list, id, label, msg) => list.push({ id, label, msg });

  if (!fs.existsSync(GAMES_DIR)) {
    warnings.push({ id: null, label: "工作区", msg: "games/ 目录不存在" });
    return { errors, warnings, manifests };
  }

  for (const dirName of fs.readdirSync(GAMES_DIR)) {
    const dir = path.join(GAMES_DIR, dirName);
    if (!fs.statSync(dir).isDirectory()) continue;
    const mfPath = path.join(dir, "game.json");
    if (!fs.existsSync(mfPath)) {
      warnings.push({ id: dirName, label: dirName, msg: "缺少 game.json，dashboard 无法识别（禁止手工裸建目录，用 tools/new.mjs）" });
      continue;
    }
    let m;
    try {
      m = JSON.parse(fs.readFileSync(mfPath, "utf8"));
    } catch (e) {
      errors.push({ id: dirName, label: dirName, msg: `game.json 解析失败: ${e.message}` });
      continue;
    }
    const label = m.id || dirName;

    if (m.id !== dirName) push(errors, m.id, label, `id "${m.id}" 与目录名 "${dirName}" 不一致`);
    if (seenIds.has(m.id)) push(errors, m.id, label, `id 与 ${seenIds.get(m.id)} 重复`);
    seenIds.set(m.id, dirName);

    for (const f of ["name", "description", "status", "type"]) {
      if (!m[f]) push(errors, m.id, label, `缺少必填字段 ${f}`);
    }
    if (m.status && !STATUSES.includes(m.status)) push(errors, m.id, label, `status "${m.status}" 不合法（${STATUSES.join("/")}）`);
    if (m.next != null && !Array.isArray(m.next)) push(errors, m.id, label, "next 必须是字符串数组");

    if (m.type === "web") {
      if (typeof m.port !== "number") {
        push(errors, m.id, label, "web 游戏缺少数字端口");
      } else {
        if (m.port < PORT_START || m.port > PORT_END) push(errors, m.id, label, `端口 ${m.port} 超出专用段 ${PORT_START}-${PORT_END}`);
        if (seenPorts.has(m.port)) push(errors, m.id, label, `端口 ${m.port} 与 ${seenPorts.get(m.port)} 冲突`);
        seenPorts.set(m.port, label);
      }
      if (!m.run) push(errors, m.id, label, "缺少 run 启动命令");
      if (m.prefix === true && !(m.run || "").includes("GAME_BASE")) {
        push(errors, m.id, label, '声明了 prefix:true 但 run 未注入 GAME_BASE（代理会死循环）');
      }
      const serveRoot = m.root ? path.join(dir, m.root) : dir;
      if (m.root && !fs.existsSync(serveRoot)) {
        push(errors, m.id, label, `root 目录不存在（${m.root}）`);
      } else {
        const entryFile = path.join(serveRoot, m.entry === "/" ? "index.html" : m.entry || "index.html");
        if (!fs.existsSync(entryFile)) push(errors, m.id, label, `入口 ${m.entry || "/"} 对应文件不存在`);
      }
    } else if (m.type === "native") {
      if (m.port != null) push(warnings, m.id, label, "native 游戏建议 port=null");
      if (m.prefix === true) push(warnings, m.id, label, "native 游戏无需 prefix");
      if (!m.run) push(warnings, m.id, label, "未配置 run 启动命令（面板将禁用启动按钮）");
    } else {
      push(errors, m.id, label, `type "${m.type}" 不合法（web|native）`);
    }

    if (!fs.existsSync(path.join(dir, "README.md"))) push(warnings, m.id, label, "缺少 README.md");
    if (!fs.existsSync(path.join(dir, "docs"))) push(warnings, m.id, label, "缺 docs/（设计文档）");
    if (!(m.tags || []).length) push(warnings, m.id, label, "无 tags");
    if (m.cover && !fs.existsSync(path.join(dir, m.cover))) push(warnings, m.id, label, `cover 声明了 ${m.cover} 但文件不存在`);

    manifests.push({ ...m, dir, label });
  }

  return { errors, warnings, manifests };
}

export function lintAgainstRegistry(lint, registryPath) {
  const { errors, warnings, manifests } = lint;
  let reg = null;
  try {
    reg = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  } catch {
    return { errors, warnings, manifests, registryLoaded: false };
  }
  const live = new Map(manifests.map((m) => [m.id, m]));
  for (const [id, entry] of Object.entries(reg.games || {})) {
    if (!live.has(id)) {
      errors.push({ id, label: id, msg: `已注册游戏 "${id}" 目录消失或被改名（路径即接口，恢复原名或人工修订 .games-registry.json）` });
      continue;
    }
    if (entry.port != null && live.get(id).port !== entry.port) {
      errors.push({ id, label: id, msg: `端口漂移：注册时 ${entry.port}，现为 ${live.get(id).port}（端口锚定面板链接，改回或走人工修订）` });
    }
  }
  for (const m of manifests) {
    if (!(m.broken || false) && !reg.games?.[m.id]) {
      errors.push({ id: m.id, label: m.label, msg: "存在 game.json 但未在 .games-registry.json 登记（用 tools/new.mjs --adopt 收编）" });
    }
  }
  return { errors, warnings, manifests, registryLoaded: true };
}

export function issuesForGame(lint, id) {
  const out = [];
  for (const e of lint.errors) if (e.id === id) out.push(`✗ ${e.msg}`);
  for (const w of lint.warnings) if (w.id === id) out.push(`⚠ ${w.msg}`);
  return out;
}
