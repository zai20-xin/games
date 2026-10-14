import { SaveManager } from "./save";
import { fmtTime } from "./share";

export interface ScoreEntry {
  date: string;
  ms: number;
}

/** 个人最佳用时（毫秒）；无记录返回 null */
export function bestScore(history: Record<string, { ms: number }>): number | null {
  const vals = Object.values(history).map((h) => h.ms);
  if (vals.length === 0) return null;
  return Math.min(...vals);
}

/** 用时最短的 TopN（升序）；并列时按日期升序稳定排序 */
export function leaderboard(
  history: Record<string, { ms: number }>,
  limit = 10,
): ScoreEntry[] {
  return Object.entries(history)
    .map(([date, h]) => ({ date, ms: h.ms }))
    .sort((a, b) => a.ms - b.ms || a.date.localeCompare(b.date))
    .slice(0, limit);
}

let panelRef: HTMLElement | null = null;

/** 初始化成绩面板：btn 切换 panel 显隐，展开时即渲染 */
export function initScores(panel: HTMLElement, btn: HTMLElement): void {
  panelRef = panel;
  btn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) renderScores(panel);
  });
}

/** 若面板处于打开状态则重新渲染（通关后调用） */
export function refreshScores(): void {
  if (panelRef && !panelRef.classList.contains("hidden")) renderScores(panelRef);
}

function renderScores(panel: HTMLElement): void {
  const hist = SaveManager.data.history;
  const best = bestScore(hist);
  const board = leaderboard(hist, 10);
  const medals = ["🥇", "🥈", "🥉"];
  const rows = board.length
    ? board
        .map(
          (e, i) =>
            `<div class="sc-row"><span class="sc-rank">${medals[i] ?? i + 1}</span>` +
            `<span class="sc-date">${e.date}</span><span class="sc-time">${fmtTime(e.ms)}</span></div>`,
        )
        .join("")
    : `<div class="sc-empty">还没有通关记录，先解出第一题吧！</div>`;
  panel.innerHTML = `
    <div class="sc-head">
      <span class="sc-title">🏆 最佳成绩榜</span>
      <span class="sc-best">个人最佳 <b>${best === null ? "—" : fmtTime(best)}</b></span>
    </div>
    <div class="sc-list">${rows}</div>
    <div class="sc-foot">仅统计首次通关用时，回放不计入</div>`;
}
