#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lintWorkspace, issuesForGame } from "../tools/lib/lint.mjs";

const DASH_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DASH_DIR, "..");
const GAMES_DIR = path.join(ROOT, "games");

// launchd 托管的 dashboard 进程 PATH 精简（无 npm），spawn 游戏时必须注入 node bin 目录
// process.execPath = <node bin>/node → dirname 即 npm 所在目录
const NODE_BIN_DIR = path.dirname(process.execPath);
const spawnEnv = {
  ...process.env,
  PATH: `${NODE_BIN_DIR}:${process.env.PATH || "/usr/bin:/bin:/usr/sbin:/sbin"}`,
};
const RUN_DIR = path.join(DASH_DIR, ".run");
const PUBLIC_DIR = path.join(DASH_DIR, "public");
const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT || 4000);
const START_TIMEOUT_MS = 20000;

const running = new Map();

function log(msg) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killTree(pid, sig = "SIGTERM") {
  try {
    process.kill(-pid, sig);
  } catch {
    try {
      process.kill(pid, sig);
    } catch {}
  }
}

async function portUp(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    const done = (ok) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(700);
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
  });
}

async function tcpWait(port, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await portUp(port)) return true;
    await sleep(350);
  }
  return false;
}

function runCmd(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 4000 }, (err, stdout) => resolve({ err, out: String(stdout || "").trim() }));
  });
}

async function portPids(port) {
  const { out } = await runCmd("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN", "-n", "-P"]);
  if (!out) return [];
  return [...new Set(out.split(/\s+/).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

async function portFree(port, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (!(await portUp(port))) return true;
    await sleep(250);
  }
  return !(await portUp(port));
}

// 占用清理：先 SIGTERM 等待释放，仍占用再 SIGKILL 兜底；只处理监听该端口的进程
async function freePort(port, reason) {
  if (!(await portUp(port))) return { ok: true, killed: [] };
  const killed = [];
  for (let round = 0; round < 2; round++) {
    const sig = round === 0 ? "SIGTERM" : "SIGKILL";
    const pids = (await portPids(port)).filter((p) => p !== process.pid);
    for (const pid of pids) {
      if (killed.includes(pid)) continue;
      killed.push(pid);
      log(`端口 ${port} 被 pid=${pid} 占用（${reason}）→ ${sig}`);
      killTree(pid, sig);
    }
    if (await portFree(port, round === 0 ? 5000 : 3000)) return { ok: true, killed };
  }
  const remain = (await portPids(port)).filter((p) => p !== process.pid);
  return { ok: false, killed, remain };
}

function loadManifests() {
  const out = [];
  if (!fs.existsSync(GAMES_DIR)) return out;
  for (const name of fs.readdirSync(GAMES_DIR)) {
    const dir = path.join(GAMES_DIR, name);
    const mf = path.join(dir, "game.json");
    if (!fs.statSync(dir).isDirectory() || !fs.existsSync(mf)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(mf, "utf8"));
      out.push({ ...m, dir });
    } catch (e) {
      out.push({ id: name, name, broken: true, error: String(e.message || e), dir });
    }
  }
  return out;
}

function getManifest(id) {
  return loadManifests().find((m) => m.id === id && !m.broken) || null;
}

function pidFile(id) {
  return path.join(RUN_DIR, `${id}.json`);
}

function persistRun(id, info) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(pidFile(id), JSON.stringify(info));
}

function clearRun(id) {
  running.delete(id);
  try {
    fs.unlinkSync(pidFile(id));
  } catch {}
}

async function startGame(m) {
  if (running.has(m.id)) throw new Error("已在运行中");
  if (!m.run || typeof m.run !== "string") throw new Error("game.json 缺少 run 字段");

  let cmd = m.run;
  let port = null;
  let freed = null;
  if (m.type === "native") {
    log(`${m.id} 启动 native 进程: ${cmd}`);
  } else {
    port = Number(m.port);
    if (!port) throw new Error("web 游戏缺少端口，请重新运行 tools/new.mjs 或手动补 port");
    if (await portUp(port)) {
      freed = await freePort(port, `启动 ${m.id} 前清理`);
      if (!freed.ok) {
        const hint = freed.remain?.length ? `（残留 pid: ${freed.remain.join(", ")}，可能无权限 kill）` : "";
        throw new Error(`端口 ${port} 被占用且自动清理失败${hint}，请手动处理后重试`);
      }
    }
    cmd = cmd.replaceAll("{port}", String(port));
    log(`${m.id} 启动: ${cmd}`);
  }

  const proc = spawn(cmd, { cwd: m.dir, shell: true, detached: true, env: spawnEnv, stdio: ["ignore", "pipe", "pipe"] });
  let errTail = "";
  proc.stderr.on("data", (d) => {
    errTail = (errTail + d.toString()).slice(-2000);
  });
  const info = { pid: proc.pid, port, startedAt: Date.now() };
  running.set(m.id, info);
  persistRun(m.id, info);

  proc.once("exit", (code) => {
    if (running.get(m.id)?.pid === proc.pid) {
      clearRun(m.id);
      log(`${m.id} 进程退出 code=${code}${errTail ? " | " + errTail.split("\n").filter(Boolean).slice(-2).join(" / ") : ""}`);
    }
  });

  if (m.type === "native") return { ok: true };

  const up = await tcpWait(port, START_TIMEOUT_MS);
  if (!up) throw new Error(`启动超时：端口 ${port} 未就绪（进程仍在跑，可看 dashboard 终端日志）`);
  log(`${m.id} 就绪 → http://localhost:${port} (代理 /g/${m.id}/)`);
  return { ok: true, port, killed: freed?.killed || [] };
}

async function stopGame(m) {
  const id = m.id;
  let pid = running.get(id)?.pid;
  if (!pid) {
    try {
      pid = JSON.parse(fs.readFileSync(pidFile(id), "utf8")).pid;
    } catch {}
  }
  if (pid && !isPidAlive(pid)) {
    clearRun(id);
    pid = null;
  }
  if (pid) {
    killTree(pid, "SIGTERM");
    const t0 = Date.now();
    while (isPidAlive(pid) && Date.now() - t0 < 5000) await sleep(150);
    if (isPidAlive(pid)) killTree(pid, "SIGKILL");
  }
  clearRun(id);

  // 兜底：dashboard 重启失忆/进程树残留时，杀掉仍监听该端口的孤儿进程
  let note = "";
  const port = m.type === "native" ? null : Number(m.port);
  if (port > 0 && (await portUp(port))) {
    const freed = await freePort(port, `停止 ${id} 后清理残留`);
    if (!freed.ok) {
      const hint = freed.remain?.length ? `（pid: ${freed.remain.join(", ")}，可能无权限 kill）` : "";
      note = `端口 ${port} 仍被残留进程占用${hint}，请手动处理`;
      log(`${id} ${note}`);
    } else if (freed.killed.length) {
      note = `已清理残留进程 pid=${freed.killed.join(", ")}`;
    }
  }
  log(`${id} 已停止${pid ? `（pid=${pid}）` : "（无记录进程）"}${note ? "；" + note : ""}`);
  return { ok: true, ...(note ? { note } : {}) };
}

async function restoreRuns() {
  if (!fs.existsSync(RUN_DIR)) return;
  for (const f of fs.readdirSync(RUN_DIR)) {
    if (!f.endsWith(".json")) continue;
    const id = f.replace(/\.json$/, "");
    try {
      const info = JSON.parse(fs.readFileSync(path.join(RUN_DIR, f), "utf8"));
      if (isPidAlive(info.pid) && (info.port == null || (await portUp(info.port)))) {
        running.set(id, info);
        log(`恢复运行中的游戏: ${id} (pid=${info.pid})`);
      } else {
        fs.unlinkSync(path.join(RUN_DIR, f));
      }
    } catch {
      try {
        fs.unlinkSync(path.join(RUN_DIR, f));
      } catch {}
    }
  }
}

async function listGames() {
  const manifests = loadManifests();
  const lint = lintWorkspace(GAMES_DIR);
  return Promise.all(
    manifests.map(async (m) => {
      const info = running.get(m.id);
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        status: m.status,
        type: m.type,
        tags: m.tags || [],
        tech: m.tech || [],
        port: m.port ?? null,
        entry: m.entry || "/",
        runnable: Boolean(m.run),
        next: Array.isArray(m.next) ? m.next : [],
        hasCover: Boolean(m.cover && fs.existsSync(path.join(m.dir, m.cover))),
        broken: Boolean(m.broken),
        error: m.error,
        running: Boolean(info),
        portLive: info?.port != null ? await portUp(info.port) : false,
        issues: m.id ? issuesForGame(lint, m.id) : [],
      };
    })
  );
}

function serveIndex(res) {
  const file = path.join(PUBLIC_DIR, "index.html");
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  fs.createReadStream(file).pipe(res);
}

function serveCover(res, id) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return json(res, 400, { error: "非法 id" });
  const m = getManifest(id);
  const cover = m?.cover ? path.join(m.dir, m.cover) : null;
  if (!cover || !fs.existsSync(cover) || !cover.startsWith(GAMES_DIR)) {
    res.writeHead(404);
    return res.end();
  }
  const ext = path.extname(cover).toLowerCase();
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" }[ext] || "application/octet-stream";
  res.writeHead(200, { "content-type": mime });
  fs.createReadStream(cover).pipe(res);
}

function proxyGame(req, res, id, subPath) {
  const m = getManifest(id);
  if (!m) return json(res, 404, { error: `未注册的游戏: ${id}` });
  const port = running.get(id)?.port ?? null;
  if (!port) return json(res, 409, { error: `${id} 未运行，请在面板启动后再访问` });
  const upstreamPath = m.prefix ? `/g/${id}${subPath || "/"}` : subPath || "/";
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port,
      path: upstreamPath,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${port}` },
    },
    (pr) => {
      res.writeHead(pr.statusCode || 502, pr.headers);
      pr.pipe(res);
    }
  );
  upstream.on("error", () => json(res, 502, { error: `上游 127.0.0.1:${port} 无响应` }));
  req.pipe(upstream);
  req.on("error", () => upstream.destroy());
}

function latestDevlog(id) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return null;
  const m = getManifest(id);
  if (!m) return null;
  const file = path.join(m.dir, "docs", "devlog.md");
  if (!fs.existsSync(file)) return null;
  const txt = fs.readFileSync(file, "utf8");
  const sections = txt.split(/\n(?=## )/).filter((s) => s.startsWith("## "));
  if (sections.length === 0) return null;
  const last = sections[sections.length - 1];
  const nl = last.indexOf("\n");
  return { title: last.slice(3, nl).trim(), body: last.slice(nl + 1).trim() };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${DASHBOARD_PORT}`);
    const p = url.pathname;

    if (p === "/" && req.method === "GET") return serveIndex(res);

    if (p === "/api/games" && req.method === "GET") return json(res, 200, await listGames());

    if (p === "/api/check" && req.method === "GET") {
      const { errors, warnings } = lintWorkspace(GAMES_DIR);
      return json(res, 200, { ok: errors.length === 0, errors, warnings });
    }

    let match;
    if ((match = p.match(/^\/api\/games\/([a-z0-9-]+)\/(start|stop)$/)) && req.method === "POST") {
      const [, id, action] = match;
      const m = getManifest(id);
      if (!m) return json(res, 404, { error: `未注册的游戏: ${id}` });
      try {
        return json(res, 200, action === "start" ? await startGame(m) : await stopGame(m));
      } catch (e) {
        return json(res, 409, { error: String(e.message || e) });
      }
    }

    if ((match = p.match(/^\/api\/games\/([a-z0-9-]+)\/devlog$/)) && req.method === "GET") {
      const d = latestDevlog(match[1]);
      if (!d) return json(res, 404, { error: "无 devlog" });
      return json(res, 200, d);
    }

    // ─── 技能组合持久化 API ─────────────────────────
    if ((match = p.match(/^\/api\/games\/([a-z0-9-]+)\/combos$/))) {
      const id = match[1];
      const m = getManifest(id);
      if (!m) return json(res, 404, { error: `未注册的游戏: ${id}` });
      const combosFile = path.join(m.dir, "data", "combos.json");

      if (req.method === "GET") {
        if (!fs.existsSync(combosFile)) return json(res, 200, []);
        try {
          const data = JSON.parse(fs.readFileSync(combosFile, "utf8"));
          return json(res, 200, data);
        } catch {
          return json(res, 200, []);
        }
      }

      if (req.method === "POST") {
        const body = await readBody(req);
        let combo;
        try { combo = JSON.parse(body); } catch { return json(res, 400, { error: "无效 JSON" }); }
        if (!combo.id || !combo.name) return json(res, 400, { error: "缺少 id/name" });

        let combos = [];
        if (fs.existsSync(combosFile)) {
          try { combos = JSON.parse(fs.readFileSync(combosFile, "utf8")); } catch { combos = []; }
        }
        if (combos.length >= 8) return json(res, 409, { error: "最多保存 8 个组合" });
        combos.push(combo);

        const dir = path.dirname(combosFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(combosFile, JSON.stringify(combos, null, 2), "utf8");
        return json(res, 200, { ok: true });
      }

      if (req.method === "DELETE") {
        const body = await readBody(req);
        let payload;
        try { payload = JSON.parse(body); } catch { return json(res, 400, { error: "无效 JSON" }); }
        if (!payload.id) return json(res, 400, { error: "缺少 id" });

        if (!fs.existsSync(combosFile)) return json(res, 404, { error: "无保存的组合" });
        let combos = [];
        try { combos = JSON.parse(fs.readFileSync(combosFile, "utf8")); } catch { combos = []; }
        combos = combos.filter((c) => c.id !== payload.id);
        fs.writeFileSync(combosFile, JSON.stringify(combos, null, 2), "utf8");
        return json(res, 200, { ok: true });
      }

      if (req.method === "PUT") {
        const body = await readBody(req);
        let payload;
        try { payload = JSON.parse(body); } catch { return json(res, 400, { error: "无效 JSON" }); }
        if (!payload.id || !payload.name) return json(res, 400, { error: "缺少 id/name" });

        if (!fs.existsSync(combosFile)) return json(res, 404, { error: "无保存的组合" });
        let combos = [];
        try { combos = JSON.parse(fs.readFileSync(combosFile, "utf8")); } catch { combos = []; }
        const target = combos.find((c) => c.id === payload.id);
        if (!target) return json(res, 404, { error: "未找到该技能" });
        target.name = payload.name;
        fs.writeFileSync(combosFile, JSON.stringify(combos, null, 2), "utf8");
        return json(res, 200, { ok: true });
      }
    }

    if ((match = p.match(/^\/cover\/([a-z0-9-]+)$/)) && req.method === "GET") return serveCover(res, match[1]);

    if ((match = p.match(/^\/g\/([a-z0-9-]+)(\/.*)?$/))) {
      // 保留 query（如 vite dev 的 ?import / ?raw），否则 json 等模块经代理后 MIME 错
      return proxyGame(req, res, match[1], (match[2] || "/") + url.search);
    }

    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    log(`收到 ${sig}，正在停止所有游戏…`);
    for (const [id, info] of running) {
      if (isPidAlive(info.pid)) killTree(info.pid);
      clearRun(id);
    }
    setTimeout(() => process.exit(0), 500);
  });
}

await restoreRuns();
server.listen(DASHBOARD_PORT, () => {
  log(`dashboard 运行中 → http://localhost:${DASHBOARD_PORT}`);
  log(`游戏目录: ${GAMES_DIR}`);
});
