// 从花卉基础 SVG 源派生 weak（灰败垂头）与 super（明亮放大）两个形态的 SVG。
// 基础形态即"正常"，三形态分别对应用户强化的 tierTexture 体系：
//   weak  → 灰败垂头：去饱和 + 压暗 + 轻微收缩前倾（运行时还会再 ×0.85）
//   super → 明亮放大：提亮 + 增饱和 + 放大（运行时再叠加金色光环与星屑）
// 用法：node scripts/derive-forms.mjs
import fs from "node:fs";
import path from "node:path";

const flowersDir = path.resolve("assets-src/svg/flowers");
const KINDS = ["rose", "daffodil", "crabapple", "chrysanthemum", "lotus", "orchid"];

const WEAK_FILTER =
  '<defs><filter id="WEAKFORM" x="-20%" y="-20%" width="140%" height="140%"><feColorMatrix type="matrix" values="0.55 0.3 0.15 0 0 0.55 0.3 0.15 0 0 0.55 0.3 0.15 0 0 0 0 0 1 0"/><feColorMatrix type="matrix" values="0.82 0 0 0 0 0 0.82 0 0 0 0 0 0.82 0 0 0 0 0 1 0"/></filter></defs>';

const SUPER_FILTER =
  '<defs><filter id="SUPERFORM" x="-20%" y="-20%" width="140%" height="140%"><feColorMatrix type="matrix" values="1.12 0 0 0 0 0 1.12 0 0 0 0 0 1.12 0 0 0 0 0 1 0"/><feColorMatrix type="saturate" values="1.25"/></filter></defs>';

function parseRoot(svg) {
  const m = svg.match(/^<svg\b[^>]*>/);
  if (!m) throw new Error("bad svg: " + svg.slice(0, 60));
  const tag = m[0];
  let w = 80;
  let h = 90;
  let viewBox = tag.match(/viewBox="([^"]*)"/);
  if (viewBox) {
    const [x, y, vw, vh] = viewBox[1].trim().split(/\s+/).map(Number);
    w = vw;
    h = vh;
  } else {
    const wm = tag.match(/width="([\d.]+)"/);
    const hm = tag.match(/height="([\d.]+)"/);
    if (wm) w = parseFloat(wm[1]);
    if (hm) h = parseFloat(hm[1]);
  }
  // 去掉根标签里的 viewBox/width/height，防止派生时与内部坐标冲突；保留必要属性
  const cleaned = tag.replace(/\s(viewBox|width|height|y|x)="[^"]*"/g, "");
  return { tag: cleaned, w, h, body: svg.slice(m[0].length).replace(/<\/svg>\s*$/, "") };
}

for (const kind of KINDS) {
  const file = path.join(flowersDir, `${kind}.svg`);
  const src = fs.readFileSync(file, "utf8");
  const { tag, w, h, body } = parseRoot(src);
  const cx = w / 2;
  const cy = h / 2;

  // weak：灰、暗、小、前倾
  const weak = `${tag}\n${WEAK_FILTER}\n<g transform="translate(${cx} ${cy}) scale(0.9) rotate(-5) translate(${-cx} ${-cy})" filter="url(#WEAKFORM)">\n${body}\n</g>\n</svg>`;
  // super：明亮、放大
  const sup = `${tag}\n${SUPER_FILTER}\n<g transform="translate(${cx} ${cy}) scale(1.12) translate(${-cx} ${-cy})" filter="url(#SUPERFORM)">\n${body}\n</g>\n</svg>`;

  fs.writeFileSync(path.join(flowersDir, `${kind}_weak.svg`), weak);
  fs.writeFileSync(path.join(flowersDir, `${kind}_super.svg`), sup);
  console.log(`derived ${kind}_weak.svg / ${kind}_super.svg`);
}