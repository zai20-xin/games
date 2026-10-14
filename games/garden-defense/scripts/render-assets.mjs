import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";

// 花卉与宠物采用手绘 SVG 源 → 渲染成透明 PNG。
// weak/super 形态由 scripts/derive-forms.mjs 现先生成 SVG，再走同一渲染链路。
// 花瓣弹丸由本清单渲染成 PNG（每花专属造型）；UI/其他特效仍由 BootScene 程序化生成。
const FLOWERS = ["rose", "daffodil", "crabapple", "chrysanthemum", "lotus", "orchid"];
const FORMS = ["" , "_weak", "_super"];
// 名贵品种贴图（珍稀/名贵 专属真实品种造型），渲染到 flowers/<kind>_epic|legendary.png
const CULTIVARS = ["epic", "legendary"];
const PETS = ["cat", "duck", "dog"];
// 花瓣弹丸：每朵花的专属花瓣造型（由 SVG 派生，替代原程序化椭圆）
const PETALS = FLOWERS.map((k) => [`projectiles/petal_${k}.svg`, `projectiles/petal_${k}.png`, 96]);
// 技能徽章：11 个技能的品阶色环图标（图鉴列头 / tooltip 用）
const SKILL_IDS = ["slow", "crit", "stun", "knockback", "pierce", "burn", "thorns", "bounce", "rapidfire", "explode", "regen"];

const jobs = [
  ...FLOWERS.flatMap((k) => FORMS.map((f) => [`flowers/${k}${f}.svg`, `flowers/${k}${f}.png`, 384])),
  ...FLOWERS.flatMap((k) => CULTIVARS.map((g) => [`cultivars/${k}_${g}.svg`, `flowers/${k}_${g}.png`, 384])),
  ...PETS.map((k) => [`pets/${k}.svg`, `pets/${k}.png`, 256]),
  ...PETALS,
  ...SKILL_IDS.map((s) => [`skills/${s}.svg`, `skills/${s}.png`, 96]),
  ["misc/boom.svg", "misc/boom.png", 256],
  ["misc/shovel.svg", "misc/shovel.png", 160],
];

const srcDir = path.resolve("assets-src/svg");
const outDir = path.resolve("public/assets");

for (const [rel, outRel, width] of jobs) {
  const svgPath = path.join(srcDir, rel);
  if (!fs.existsSync(svgPath)) {
    console.warn(`跳过缺失源: ${rel}`);
    continue;
  }
  const svg = fs.readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "rgba(0,0,0,0)",
  });
  const png = resvg.render().asPng();
  const outPath = path.join(outDir, outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log(`rendered ${outRel} (${width}px wide)`);
}