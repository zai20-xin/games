#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GAMES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "games");

const STATUS_COLORS = {
  idea: "#8b93a7",
  prototype: "#4c8dff",
  demo: "#e8a33d",
  playable: "#35c46f",
  archived: "#666f80",
};
const STATUS_LABELS = { idea: "构想", prototype: "原型", demo: "Demo", playable: "可玩", archived: "归档" };

const EMOJI_RULES = [
  [/snake|蛇/, "🐍"],
  [/evolution|进化/, "🧬"],
  [/pvz|植物|僵尸/, "🌻"],
  [/contra|魂斗罗/, "💥"],
  [/star|defense|塔防|防线/, "🛰️"],
  [/match3|三消/, "🧩"],
  [/xiangqi|象棋|chess/, "♟️"],
  [/dressup|换装/, "👗"],
  [/skate|滑板|跑酷|coastal/, "🛹"],
  [/huanyouyu|幻游|合集/, "🎮"],
  [/hello|示例/, "👋"],
];

function pickEmoji(id, name) {
  for (const [re, e] of EMOJI_RULES) {
    if (re.test(id) || re.test(name || "")) return e;
  }
  return "🎮";
}

function hashCode(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.codePointAt(0)) | 0;
  return Math.abs(h);
}

function svgCover({ name, id, status }) {
  const h = hashCode(id);
  const hue = h % 360;
  const hue2 = (hue + 40) % 360;
  const emoji = pickEmoji(id, name);
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.prototype;
  const statusLabel = STATUS_LABELS[status] || status || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue}, 32%, 22%)"/>
      <stop offset="100%" stop-color="hsl(${hue2}, 38%, 12%)"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#g)"/>
  <circle cx="${520 + (h % 60)}" cy="${60 + (h % 50)}" r="140" fill="hsl(${hue2}, 45%, 30%)" opacity="0.25"/>
  <circle cx="${90 + (h % 40)}" cy="${300 - (h % 40)}" r="100" fill="hsl(${hue}, 45%, 28%)" opacity="0.3"/>
  <text x="320" y="205" font-size="130" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="36" y="316" font-size="34" font-weight="700" fill="#e8ebf2" font-family="-apple-system, 'PingFang SC', sans-serif">${name}</text>
  <rect x="496" y="290" rx="14" width="112" height="30" fill="#0f1115" opacity="0.65"/>
  <text x="552" y="310" font-size="16" text-anchor="middle" fill="${statusColor}" font-family="-apple-system, 'PingFang SC', sans-serif">${statusLabel}</text>
</svg>
`;
}

for (const dirName of fs.readdirSync(GAMES_DIR)) {
  const dir = path.join(GAMES_DIR, dirName);
  const mfPath = path.join(dir, "game.json");
  if (!fs.statSync(dir).isDirectory() || !fs.existsSync(mfPath)) continue;
  const m = JSON.parse(fs.readFileSync(mfPath, "utf8"));
  if (!m.cover && !m.broken) {
    const file = path.join(dir, "cover.svg");
    fs.writeFileSync(file, svgCover(m));
    m.cover = "cover.svg";
    fs.writeFileSync(mfPath, JSON.stringify(m, null, 2) + "\n");
    console.log(`✓ ${m.id}: 生成 cover.svg`);
  } else if (m.cover && !fs.existsSync(path.join(dir, m.cover))) {
    console.log(`⚠ ${m.id}: 声明了 ${m.cover} 但文件缺失，未覆盖`);
  }
}
