// 从精修版 zombie.svg（机器人猫咪·实验体遗骸）派生 3 个 variant：各自叠加机械化头饰。
// 身体真源只在 zombie.svg 一份，变体仅覆盖头顶饰，避免四份身体漂移。
// 用法：node scripts/build-zombies.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(dir, "../assets-src/svg/zombies/zombie.svg");
const outDir = path.resolve(dir, "../assets-src/svg/zombies");
const svg = fs.readFileSync(src, "utf8");

// 变体头饰一律绘制在 body 之后（压在最上），但底部边缘停在眼屏上方，露出发光双眼。
// 插入锚点：收尾的 </svg> 之前。
const insertProp = (body, propBlock) => body.replace("</svg>", propBlock + "\n</svg>");

const coneProp = `  <!-- 施工锥帽：亮橙三角头盔罩住头顶+猫耳，底部停在眼屏上方，露出双眼（外层磨损+内层病毒裂纹） -->
  <defs>
    <linearGradient id="coneG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ef7a33"/>
      <stop offset="100%" stop-color="#b04c12"/>
    </linearGradient>
  </defs>
  <g transform="rotate(-5 58 20)">
    <path d="M 43 20 L 58 2 L 73 20 Z" fill="url(#coneG)" stroke="#181c22" stroke-width="4" stroke-linejoin="round"/>
    <path d="M 46 13.5 L 58 4.5 L 70 13.5" fill="none" stroke="#ffe9c0" stroke-width="3.2" opacity="0.85" stroke-linecap="round"/>
    <path d="M 49 18 L 58 9.5 L 67 18" fill="none" stroke="#fff2d8" stroke-width="1.6" opacity="0.4" stroke-linecap="round"/>
    <ellipse cx="58" cy="20" rx="17" ry="4" fill="#b45313" stroke="#181c22" stroke-width="3.4"/>
    <path d="M 43 18.6 Q 50 17.6 58 18 Q 66 18.6 73 18.6" fill="none" stroke="#8a3f0e" stroke-width="2" opacity="0.6"/>
    <!-- 际部磨破 + 病毒裂纹外渗 -->
    <path d="M 56 11 q 3 2 2 5" fill="none" stroke="#181c22" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M 63 14 Q 60 16 62 19" fill="none" stroke="#96ff60aa" stroke-width="1.8" stroke-linecap="round"/>
  </g>`;

const bucketProp = `  <!-- 密封实验罐罩：亮银铁桶罩住头顶+猫耳，比锥更厚更硬；边缘在眼屏上方，带锈蚀与沿体渗漏 -->
  <defs>
    <linearGradient id="bucketG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d4dbe4"/>
      <stop offset="55%" stop-color="#a2aab6"/>
      <stop offset="100%" stop-color="#6f7784"/>
    </linearGradient>
  </defs>
  <g transform="rotate(-4 58 18)">
    <!-- 桶身：圆角金属罐 -->
    <path d="M 40 21 L 76 21 L 73 4.5 C 72 3 68 2 61 2 L 55 2 C 48 2 44 3 43 4.5 Z" fill="url(#bucketG)" stroke="#181c22" stroke-width="3.4" stroke-linejoin="round"/>
    <!-- 桶身纵肋（铁皮卷边） -->
    <path d="M 47 3.5 v 15 M 55 2.5 v 16 M 63 2.5 v 16 M 71 4 v 15" stroke="#39414c" stroke-width="1.6"/>
    <path d="M 47 3.5 v 15 M 55 2.5 v 16 M 63 2.5 v 16 M 71 4 v 15" stroke="#ffffff44" stroke-width="1.1" transform="translate(1,0)"/>
    <!-- 顶部桶沿 -->
    <ellipse cx="58" cy="6" rx="19" ry="3" fill="#7b8490" stroke="#181c22" stroke-width="2.6"/>
    <ellipse cx="58" cy="6" rx="13" ry="1.8" fill="#39414c"/>
    <!-- 底部重边（压在头部） -->
    <path d="M 40 21 L 76 21" stroke="#181c22" stroke-width="3.4" stroke-linecap="round"/>
    <!-- 锈蚀斑 -->
    <path d="M 52 14 q 2 -2 4 0 q -2 2 -4 0" fill="#7a4a2a" opacity="0.55"/>
    <!-- 沿体渗漏的病毒液滴 -->
    <path d="M 66 20 q 2 4 0 8" fill="none" stroke="#96ff60" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="66.6" cy="28.5" r="1.5" fill="#96ff60" opacity="0.9"/>
  </g>`;

const flagProp = `  <!-- 丧旗：旗杆自后肩斜插向上，红色残旗在上方空区飘扬，不遮面屏 -->
  <defs>
    <linearGradient id="flagG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#cb4538"/>
      <stop offset="100%" stop-color="#8f1f1a"/>
    </linearGradient>
  </defs>
  <path d="M 88 46 L 122 12" stroke="#5a4f3d" stroke-width="4.4" stroke-linecap="round"/>
  <path d="M 109 19 L 127 10 L 123 26 L 107 24 Z" fill="url(#flagG)" stroke="#181c22" stroke-width="3" stroke-linejoin="round"/>
  <path d="M 112 17 l 8 -5 M 110 20 l 6 -3" stroke="#ffd0c4" opacity="0.5"/>
  <path d="M 116 28 l 4 -2" stroke="#ffd0c4" opacity="0.4"/>
  <path d="M 90 44 q 3 -3 5 -1" stroke="#96ff60aa" stroke-width="1.8" stroke-linecap="round"/>`;

const jobs = [
  ["zombie_cone.svg", coneProp],
  ["zombie_bucket.svg", bucketProp],
  ["zombie_flag.svg", flagProp],
];

for (const [outRel, prop] of jobs) {
  const body = insertProp(svg, prop);
  fs.writeFileSync(path.join(outDir, outRel), body);
  console.log(`built ${outRel}`);
}
console.log("done");