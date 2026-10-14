import type { Puzzle } from "../engine/solver";

const REGION_EMOJI = ["🟪", "🟦", "🟩", "🟨", "🟧", "🟥", "🟫", "⬛", "⬜"];

export function fmtTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function buildShareText(
  puzzle: Puzzle,
  marks: Uint8Array,
  ms: number,
  streak: number,
): string {
  const lines: string[] = [];
  lines.push(`👑 皇后谜题 #${puzzle.dateStr}`);
  lines.push(`⏱ ${fmtTime(ms)} · 🔥 连胜 ${streak}`);
  for (let r = 0; r < puzzle.n; r++) {
    let row = "";
    for (let c = 0; c < puzzle.n; c++) {
      const idx = r * puzzle.n + c;
      row += marks[idx] === 1 ? "👑" : REGION_EMOJI[puzzle.regions[idx] % REGION_EMOJI.length];
    }
    lines.push(row);
  }
  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  }
}
