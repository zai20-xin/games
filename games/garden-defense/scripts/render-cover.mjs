// 生成游戏封面 cover.png（dashboard 卡片用）：草坪背景 + 花卉 + 宠物 拼版。
// 用法：node scripts/render-cover.mjs
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";

const assets = path.resolve("public/assets");
const fmt = (p) => {
  // SVG 里 href 需要 URL 编码，这里直接给绝对路径字符串即可（resvg 支持 file 路径）
  return p;
};

const flowers = ["rose", "daffodil", "orchid"].map((k) => `flowers/${k}.png`);
const pets = ["cat", "duck", "dog"].map((k) => `pets/${k}.png`);

// 拼一个 1280x720 的草坪花园封面
let flowerSvg = "";
flowers.forEach((f, i) => {
  const imgW = 170;
  const x = 120 + i * 230;
  const y = 470 - 100 + (i % 2) * 10; // 底部错落
  flowerSvg += `<image href="${fmt(path.join(assets, f))}" x="${x}" y="${y}" width="${imgW}" height="${imgW * (90 / 80)}"/>`;
});
let petSvg = "";
pets.forEach((p, i) => {
  const imgW = 150;
  const x = 778 + i * 150;
  const y = 442 + (i % 2) * 18;
  petSvg += `<image href="${fmt(path.join(assets, p))}" x="${x}" y="${y}" width="${imgW}" height="${imgW * (90 / 80)}"/>`;
});

const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fd3f4"/>
      <stop offset="0.55" stop-color="#cdeecb"/>
      <stop offset="0.62" stop-color="#9ccb6b"/>
      <stop offset="1" stop-color="#5d9442"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff6c8"/>
      <stop offset="1" stop-color="#ffd93d"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#sky)"/>
  <!-- 太阳 + 光晕 -->
  <circle cx="1100" cy="110" r="150" fill="#fff8d0" opacity="0.5"/>
  <circle cx="1100" cy="110" r="72" fill="url(#sun)"/>
  <!-- 草地色带 -->
  <rect x="0" y="520" width="1280" height="200" fill="#5d9442"/>
  <ellipse cx="640" cy="720" rx="900" ry="140" fill="#4a7a38"/>
  <!-- 前景草丛装饰 -->
  <path d="M0 560 Q80 500 150 560 Z" fill="#6fae52" opacity="0.7"/>
  <path d="M1130 560 Q1200 510 1280 565 L1280 600 L1130 600 Z" fill="#6fae52" opacity="0.6"/>
  <!-- 小露珠 -->
  <ellipse cx="760" cy="470" rx="18" ry="14" fill="#d8f2ff" opacity="0.9"/>
  <ellipse cx="756" cy="467" rx="6" ry="4" fill="#ffffff"/>
  <ellipse cx="980" cy="430" rx="22" ry="17" fill="#d8f2ff" opacity="0.8"/>
  <ellipse cx="975" cy="426" rx="7" ry="5" fill="#ffffff"/>
  <!-- 花卉 -->
  ${flowerSvg}
  <!-- 宠物 -->
  ${petSvg}
</svg>`;

fs.writeFileSync(path.resolve("assets-src/cover.svg"), svg);
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1280 } }).render().asPng();
fs.writeFileSync(path.resolve("cover.png"), png);
console.log("written cover.png (" + png.length + " bytes) + assets-src/cover.svg");