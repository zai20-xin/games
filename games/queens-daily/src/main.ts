import { generateDaily } from "./engine/generator";
import { PALETTE_QUEENS } from "./ui/palette";
import { SaveManager, todayStr } from "./ui/save";
import { buildShareText, copyText, fmtTime } from "./ui/share";
import { computeHint, conflictReasons, reasonText } from "./ui/assist";
import { QUEEN_SVG } from "./ui/art";
import { initCalendar } from "./ui/calendar";
import { initScores, refreshScores } from "./ui/scores";
import { Settings } from "./ui/settings";
import { playSound } from "./ui/sound";

declare global {
  interface Window { __q?: unknown }
}

const params = new URLSearchParams(location.search);
const today = todayStr();
const rawDate = params.get("date");
const dateParam =
  rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate <= today ? rawDate : null;
const dateStr = dateParam ?? today;
const isArchive = dateParam !== null && dateParam !== today;

const puzzle = generateDaily(dateStr);
const n = puzzle.n;
const clueSet = new Set(puzzle.clues);

let marks: Uint8Array<ArrayBufferLike> = new Uint8Array(n * n);
for (const clue of puzzle.clues) marks[clue] = 1;

let startedAt: number | null = null;
let finishedAt: number | null = null;
let solved = false;
let cursor = 0;
let hintCell: number | null = null;
const undoStack: Uint8Array<ArrayBufferLike>[] = [];
const redoStack: Uint8Array<ArrayBufferLike>[] = [];

const boardEl = document.getElementById("board")!;
const dateChip = document.getElementById("datechip")!;
const timerEl = document.getElementById("timer")!;
const streakEl = document.getElementById("streak")!;
const progressEl = document.getElementById("progress")!;
const difficultyEl = document.getElementById("difficulty")!;
const subtitleEl = document.getElementById("subtitle")!;
const undoTopBtn = document.getElementById("btn-undo-top") as HTMLButtonElement | null;
const hintTopBtn = document.getElementById("btn-hint-top") as HTMLButtonElement | null;
const hintBanner = document.getElementById("hint-banner") as HTMLDivElement | null;
const archiveInput = document.getElementById("archive-date") as HTMLInputElement | null;
const archiveBtn = document.getElementById("btn-archive") as HTMLButtonElement | null;
const todayBtn = document.getElementById("btn-today") as HTMLButtonElement | null;
const historyBtn = document.getElementById("btn-history") as HTMLButtonElement | null;
const calendarPanel = document.getElementById("calendar-panel") as HTMLDivElement | null;
const scoresBtn = document.getElementById("btn-scores") as HTMLButtonElement | null;
const scoresPanel = document.getElementById("scores-panel") as HTMLDivElement | null;

SaveManager.load();
if (archiveInput) {
  archiveInput.max = today;
  if (dateParam) archiveInput.value = dateParam;
}
// 加载并应用用户偏好（主题立即生效，音效后续交互触发）
Settings.load();
applyTheme();

if (historyBtn && calendarPanel) {
  initCalendar(calendarPanel, historyBtn);
}

if (scoresBtn && scoresPanel) {
  initScores(scoresPanel, scoresBtn);
}

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", Settings.get().theme);
}

subtitleEl.textContent =
  `第 #${dateStr} 期 · ${n}×${n}` + (isArchive ? " · 往期回放（不计连胜）" : "");
dateChip.textContent = dateStr;
streakEl.textContent = String(SaveManager.getStreak());
difficultyEl.textContent = "★".repeat(puzzle.level) + "☆".repeat(3 - puzzle.level);

function conflictSetNow(): Set<number> {
  return new Set(conflictReasons(n, puzzle.regions, marks).keys());
}

function isWin(conflicts: Set<number>): boolean {
  let count = 0;
  for (let i = 0; i < n * n; i++) if (marks[i] === 1) count++;
  return count === n && conflicts.size === 0;
}

/** 依据视口宽度计算格子边长：窄屏收紧留白，尽量把触控目标做到 ≥44px */
function fitCellSize(): void {
  const mobile = window.innerWidth <= 520;
  const chrome =
    (mobile ? 16 : 32) + // body 左右留白
    (mobile ? 20 : 28) + // 棋盘内边距
    (n - 1) * (mobile ? 4 : 5); // 格间距
  const size = Math.max(30, Math.min(56, Math.floor((window.innerWidth - chrome) / n)));
  boardEl.style.setProperty("--cell", `${size}px`);
}

function render(): void {
  const reasons = conflictReasons(n, puzzle.regions, marks);
  const conflicts = new Set(reasons.keys());
  fitCellSize();
  boardEl.style.gridTemplateColumns = `repeat(${n}, auto)`;
  boardEl.innerHTML = "";
  let placed = 0;
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    const btn = document.createElement("button");
    let cls = "cell";
    if (conflicts.has(i)) cls += " conflict";
    // 色区描边：右侧/下侧邻格属于不同色区时画分隔线
    if (c + 1 < n && puzzle.regions[i] !== puzzle.regions[i + 1]) cls += " edge-r";
    if (r + 1 < n && puzzle.regions[i] !== puzzle.regions[i + n]) cls += " edge-b";
    // 色盲冗余纹理编码（4 组方向）
    cls += ` tex-${puzzle.regions[i] % 4}`;
    if (clueSet.has(i)) cls += " clue";
    if (i === cursor) cls += " cursor";
    if (i === hintCell) cls += " hint";
    btn.className = cls;
    btn.style.background = PALETTE_QUEENS[puzzle.regions[i] % PALETTE_QUEENS.length];
    btn.setAttribute("role", "gridcell");
    let aria = `第${r + 1}行 第${c + 1}列`;
    if (clueSet.has(i)) aria += "（给定皇后）";
    if (reasons.has(i)) aria += ` 冲突:${reasonText(reasons.get(i)!)}`;
    btn.setAttribute("aria-label", aria);
    if (marks[i] === 1) {
      placed++;
      const queen = document.createElement("span");
      queen.className = "queen";
      queen.innerHTML = QUEEN_SVG;
      btn.appendChild(queen);
      if (reasons.has(i)) {
        const badge = document.createElement("span");
        badge.className = "ctype";
        badge.textContent = reasonText(reasons.get(i)!);
        btn.appendChild(badge);
      }
    } else if (marks[i] === 2) {
      const ex = document.createElement("span");
      ex.className = "ex";
      ex.textContent = "✕";
      btn.appendChild(ex);
    }
    btn.addEventListener("click", () => {
      cursor = i;
      onCellClick(i);
    });
    boardEl.appendChild(btn);
  }
  progressEl.textContent = `${placed}/${n}`;
  if (solved) {
    for (const btn of boardEl.querySelectorAll("button")) {
      (btn as HTMLButtonElement).disabled = true;
    }
  }
  if (undoTopBtn) undoTopBtn.disabled = solved || undoStack.length === 0;
  if (hintTopBtn) hintTopBtn.disabled = solved;
}

function pushUndo(): void {
  undoStack.push(marks.slice());
}

function clearRedo(): void {
  redoStack.length = 0;
}

function afterChange(): void {
  if (startedAt === null) startedAt = Date.now();
  const conflicts = conflictSetNow();
  render();
  if (!solved && isWin(conflicts)) {
    finishedAt = Date.now();
    solved = true;
    const ms = startedAt !== null ? finishedAt - startedAt : 0;
    const result = SaveManager.recordWin(dateStr, ms, isArchive);
    streakEl.textContent = String(SaveManager.getStreak());
    render();
    showWin(ms, result);
  }
}

function onCellClick(i: number): void {
  if (solved) return;
  if (clueSet.has(i)) return; // 给定皇后锁定，不可移除/更改
  pushUndo();
  clearRedo();
  const before = marks[i];
  marks[i] = ((before + 1) % 3) as 0 | 1 | 2;
  playSound(marks[i] === 1 ? "place" : before === 1 ? "remove" : "click");
  hintCell = null;
  afterChange();
}

function showHintBanner(text: string): void {
  if (!hintBanner) return;
  hintBanner.textContent = text;
  hintBanner.classList.remove("hidden");
  window.clearTimeout((showHintBanner as unknown as { _t?: number })._t);
  (showHintBanner as unknown as { _t?: number })._t = window.setTimeout(
    () => hintBanner.classList.add("hidden"),
    4000,
  );
}

setInterval(() => {
  if (startedAt !== null && finishedAt === null) {
    timerEl.textContent = fmtTime(Date.now() - startedAt);
  }
}, 400);

// 视口变化（转屏/缩放）时重算格子尺寸
window.addEventListener("resize", () => render());

function undoLast(): void {
  if (solved || undoStack.length === 0) return;
  redoStack.push(marks.slice());
  marks = undoStack.pop()!;
  hintCell = null;
  render();
}

{
  archiveBtn?.addEventListener("click", () => {
    const v = archiveInput?.value ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= today) {
      location.href = `?date=${v}`;
    }
  });

  if (isArchive) todayBtn?.classList.remove("hidden");
  todayBtn?.addEventListener("click", () => {
    location.href = location.pathname;
  });
}

// 顶部图标：撤销 / 提示 直接绑定
function showHint(): void {
  if (solved) return;
  const h = computeHint(n, puzzle.regions, marks);
  if (!h) {
    showHintBanner("当前无可安全放置的格子，请先消除红色冲突");
    return;
  }
  hintCell = h.cell;
  cursor = h.cell;
  showHintBanner("💡 " + h.reason);
  render();
}
if (undoTopBtn) undoTopBtn.addEventListener("click", undoLast);
if (hintTopBtn) hintTopBtn.addEventListener("click", showHint);

function showWin(
  ms: number,
  result: { replay: boolean; streak: number },
): void {
  timerEl.textContent = fmtTime(ms);
  spawnConfetti();
  playSound("win");
  refreshScores();
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>🎉 通关！</h2>
    <div class="line">用时 <b>${fmtTime(ms)}</b> · 谜题 <b>#${dateStr}</b></div>
    <div class="line ${
      result.replay || isArchive ? "" : "streak"
    }">${result.replay ? "当日战绩已记录，本次为回放" : isArchive ? "往期回放不计入连胜" : `🔥 连胜 <b>${result.streak}</b> 天`}</div>
    <div class="actions">
      <button id="win-share">📋 分享战绩</button>
      <button id="win-close">继续研究棋盘</button>
    </div>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  overlay.querySelector("#win-share")!.addEventListener("click", async () => {
    const ok = await copyText(buildShareText(puzzle, marks, ms, result.streak));
    const btn = overlay.querySelector("#win-share") as HTMLButtonElement;
    btn.textContent = ok ? "已复制 ✓" : "复制失败";
    setTimeout(() => (btn.textContent = "📋 分享战绩"), 1600);
  });
  overlay.querySelector("#win-close")!.addEventListener("click", () => overlay.remove());
}

const CONFETTI_EMOJI = ["🎉", "✨", "👑", "🌟", "🎊"];

function spawnConfetti(): void {
  const count = 24;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "confetti";
    el.textContent = CONFETTI_EMOJI[i % CONFETTI_EMOJI.length];
    el.style.left = `${Math.random() * 100}vw`;
    el.style.fontSize = `${16 + Math.random() * 18}px`;
    el.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    el.style.animationDelay = `${Math.random() * 0.5}s`;
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

// 键盘可达：方向键移动光标，空格/回车循环放置
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (solved) return;
  const r = Math.floor(cursor / n);
  const c = cursor % n;
  if (e.key === "ArrowUp") cursor = ((r - 1 + n) % n) * n + c;
  else if (e.key === "ArrowDown") cursor = ((r + 1) % n) * n + c;
  else if (e.key === "ArrowLeft") cursor = r * n + ((c - 1 + n) % n);
  else if (e.key === "ArrowRight") cursor = r * n + ((c + 1) % n);
  else if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    onCellClick(cursor);
    return;
  } else return;
  e.preventDefault();
  render();
});

render();

// 自动化测试钩子
window.__q = {
  solution: () => puzzle.solution,
  n,
  place(cell: number): void {
    marks[cell] = 1;
    afterChange();
  },
  state: () => ({ solved, marks: [...marks], dateStr, isArchive }),
};
