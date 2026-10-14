/**
 * 躺平 headless smoke
 * node games/lying-flat/test/smoke.mjs
 */
import {
  createWorld,
  occupyRoom,
  startSelect,
  step,
  tryBuildTurret,
  tryUpgradeBed,
  tryUpgradeDoor,
  playerRoom,
  doorUpgradeCost,
  chooseBuff,
  bedRate,
} from "../js/engine.js";
import { layout } from "../js/render.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("ok:", msg);
  }
}

const w = createWorld("normal");
startSelect(w);
assert(w.phase === "select", "进入选房阶段");
assert(w.rooms.length === 6, "6 间宿舍");
assert(w.rooms.every((r) => r.mine), "房间已刷矿脉");

layout(w, 720, 540);
const ok = occupyRoom(w, w.rooms[0].id);
assert(ok && w.phase === "day", "入住房间进入白天");

const me = playerRoom(w);
w.gold = 800;
me.door.hp = 40;
assert(tryUpgradeDoor(w), "可升门");
assert(me.door.hp === me.door.maxHp, "升门回满血");
assert(doorUpgradeCost(8) === null, "满级门不可再升");
assert(tryUpgradeBed(w), "可升床");
assert(tryBuildTurret(w, 0, "gun"), "可建机枪");
assert(tryBuildTurret(w, 1, "arcade"), "可建游戏机");
assert(bedRate(me) > 0, "产金速率 > 0");

let buffPicked = 0;
let transformedSeen = false;
for (let i = 0; i < 20000 && w.phase !== "win" && w.phase !== "lose"; i++) {
  if (w.phase === "buff" && w.pendingBuffs?.length) {
    chooseBuff(w, w.pendingBuffs[0].id);
    buffPicked++;
    continue;
  }
  if (w.phase === "day") {
    w.dayLeft = Math.min(w.dayLeft, 0.02);
    const room = playerRoom(w);
    if (room) {
      w.gold += 400;
      tryUpgradeDoor(w);
      tryUpgradeBed(w);
      for (let s = 0; s < 4; s++) tryBuildTurret(w, s, "laser");
    }
  }
  if (i % 8 === 0) layout(w, 720, 540);
  step(w, 0.05);
  if (w.ghost?.transformed) transformedSeen = true;
}

assert(buffPicked >= 1, `至少选过一次 buff（${buffPicked}）`);
assert(
  w.phase === "win" || w.phase === "lose",
  `对局应结束 phase=${w.phase} night=${w.night} dmg=${Math.round(w.playerDmg)}`
);
assert(transformedSeen || w.night < 2 || w.phase === "lose", "后几夜可见变身或已终局");
assert(w.playerBuffs.length >= 1, "已获得技能");

console.log(
  "result:",
  w.phase,
  "night=",
  w.night,
  "buffs=",
  w.playerBuffs.join("|"),
  "dmg=",
  Math.round(w.playerDmg),
  "mine=",
  me.mine?.id
);
console.log(process.exitCode ? "smoke failed" : "smoke passed");
