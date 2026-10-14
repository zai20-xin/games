import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";

// [源 svg 相对路径, 输出文件名, 渲染宽度(px)]
const jobs = [
  ["plants/sunflower.svg", "plants/sunflower.png", 256],
  ["plants/sunflower_weak.svg", "plants/sunflower_weak.png", 256],
  ["plants/sunflower_super.svg", "plants/sunflower_super.png", 256],
  ["plants/peashooter.svg", "plants/peashooter.png", 256],
  ["plants/peashooter_super.svg", "plants/peashooter_super.png", 256],
  ["plants/peashooter_weak.svg", "plants/peashooter_weak.png", 256],
  ["plants/snowpea.svg", "plants/snowpea.png", 256],
  ["plants/snowpea_weak.svg", "plants/snowpea_weak.png", 256],
  ["plants/snowpea_super.svg", "plants/snowpea_super.png", 256],
  ["plants/repeater.svg", "plants/repeater.png", 256],
  ["plants/repeater_weak.svg", "plants/repeater_weak.png", 256],
  ["plants/repeater_super.svg", "plants/repeater_super.png", 256],
  ["plants/threepeater.svg", "plants/threepeater.png", 256],
  ["plants/threepeater_weak.svg", "plants/threepeater_weak.png", 256],
  ["plants/threepeater_super.svg", "plants/threepeater_super.png", 256],
  ["plants/wallnut.svg", "plants/wallnut.png", 256],
  ["plants/wallnut_cracked.svg", "plants/wallnut_cracked.png", 256],
  ["plants/cherrybomb.svg", "plants/cherrybomb.png", 256],
  ["plants/potatomine.svg", "plants/potatomine.png", 256],
  ["plants/jalapeno.svg", "plants/jalapeno.png", 256],
  ["zombies/zombie.svg", "zombies/zombie.png", 256],
  ["zombies/zombie_cone.svg", "zombies/zombie_cone.png", 256],
  ["zombies/zombie_bucket.svg", "zombies/zombie_bucket.png", 256],
  ["zombies/zombie_flag.svg", "zombies/zombie_flag.png", 256],
  ["misc/pea.svg", "misc/pea.png", 64],
  ["misc/icepea.svg", "misc/icepea.png", 64],
  ["misc/sun.svg", "misc/sun.png", 144],
  ["misc/mower.svg", "misc/mower.png", 320],
  ["misc/shovel.svg", "misc/shovel.png", 160],
  ["misc/boom.svg", "misc/boom.png", 256],
];

const srcDir = path.resolve("assets-src/svg");
const outDir = path.resolve("public/assets");

for (const [rel, outRel, width] of jobs) {
  const svg = fs.readFileSync(path.join(srcDir, rel), "utf8");
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
console.log(`done: ${jobs.length} assets`);
