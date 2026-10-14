import { SaveManager, todayStr } from "./save";

interface HistoryEntry {
  ms: number;
}
type History = Record<string, HistoryEntry>;

/** 由 history 自今天（或昨天，若今天未解）向前回溯连续命中日，返回当前连胜日期集合 */
export function streakDates(history: History, today: string): Set<string> {
  const set = new Set<string>();
  let cur: string | null = history[today] ? today : prevDay(today);
  while (cur && history[cur]) {
    set.add(cur);
    cur = prevDay(cur);
  }
  return set;
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

interface Month {
  y: number;
  m: number; // 0-11
}

function parseMonth(dateStr: string): Month {
  const [y, m] = dateStr.split("-").map(Number);
  return { y, m: m - 1 };
}

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function monthLabel(m: Month): string {
  return `${m.y} 年 ${m.m + 1} 月`;
}

/** 初始化历史日历面板：折叠式，点击切换按钮显隐；已解日可点击回放 */
export function initCalendar(panel: HTMLElement, toggleBtn: HTMLElement): void {
  const today = todayStr();
  const history = SaveManager.data.history;
  const solvedCount = Object.keys(history).length;
  const streak = streakDates(history, today);
  const todayMonth = parseMonth(today);
  let view: Month = { ...todayMonth };

  function renderPanel(): void {
    const firstDow = new Date(view.y, view.m, 1).getDay(); // 0=日
    const lead = (firstDow + 6) % 7; // 周一为首
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells: string[] = [];
    const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
    for (const w of weekdays) cells.push(`<div class="cal-wd">${w}</div>`);
    for (let i = 0; i < lead; i++) cells.push(`<div class="cal-cell blank"></div>`);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${view.y}-${pad2(view.m + 1)}-${pad2(d)}`;
      const future = ds > today;
      const solved = !future && !!history[ds];
      const hot = solved && streak.has(ds);
      let cls = "cal-cell";
      if (future) cls += " future";
      else if (solved) cls += hot ? " solved hot" : " solved";
      else cls += " empty";
      const title = solved ? `已解 · ${ds}` : future ? "" : `未解 · ${ds}`;
      const crown = solved ? `<span class="cal-crown">👑</span>` : "";
      const nav = solved ? ` data-date="${ds}" role="button" tabindex="0" title="${title}"` : ` title="${title}"`;
      cells.push(`<div class="${cls}"${nav}>${d}${crown}</div>`);
    }
    const canNext = view.y < todayMonth.y || (view.y === todayMonth.y && view.m < todayMonth.m);

    panel.innerHTML = `
      <div class="cal-head">
        <button class="cal-nav" id="cal-prev" aria-label="上一月">‹</button>
        <span class="cal-title">${monthLabel(view)}</span>
        <button class="cal-nav" id="cal-next" aria-label="下一月" ${canNext ? "" : "disabled"}>›</button>
      </div>
      <div class="cal-grid">${cells.join("")}</div>
      <div class="cal-foot">已解 <b>${solvedCount}</b> 天 · 当前连胜 <b>${SaveManager.getStreak()}</b></div>
      <div class="cal-legend"><span class="lg hot">连胜日</span><span class="lg solved">已解</span><span class="lg empty">未解</span></div>
    `;

    panel.querySelector("#cal-prev")?.addEventListener("click", () => {
      view = view.m === 0 ? { y: view.y - 1, m: 11 } : { y: view.y, m: view.m - 1 };
      renderPanel();
    });
    const nextBtn = panel.querySelector("#cal-next") as HTMLButtonElement | null;
    if (nextBtn && canNext) {
      nextBtn.addEventListener("click", () => {
        view = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };
        renderPanel();
      });
    }
    panel.querySelectorAll<HTMLElement>(".cal-cell.solved").forEach((el) => {
      const go = () => {
        const ds = el.dataset.date!;
        location.href = `?date=${ds}`;
      };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    });
  }

  toggleBtn.addEventListener("click", () => {
    const hidden = panel.classList.toggle("hidden");
    if (!hidden) renderPanel();
  });
}
