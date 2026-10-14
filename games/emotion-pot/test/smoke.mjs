/** 冒烟测试：纯逻辑 + localStorage 数据闭环 */

import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const heat = await import("../js/heat.js");
const store = await import("../js/store.js");
const gags = await import("../js/gags.js");

// forms / fun
assert.equal(heat.formForHeat(0).emoji, "🧑");
assert.equal(heat.formForHeat(100).emoji, "👾");
assert.equal(gags.formFun(0).nick, "淡定脸");
assert.equal(gags.formFun(120).nick, "被做成菜");
assert.ok(gags.dishTitle(10, 80).includes("上头版"));
assert.ok(gags.dishReview().length > 0);
assert.ok(gags.maybeEvent(8)?.id === "apology");
assert.ok(gags.maybeEvent(12)?.id === "apology"); // >= 会一直命中，直到标记已触发
assert.equal(gags.maybeEvent(12, ["apology"]), null);
assert.equal(gags.maybeEvent(7), null);

// create + poke/chaos
const obj = store.createObject("周一早会");
assert.equal(obj.status, "cooking");

store.applyHeatDelta(obj.id, 1);
store.addAction(obj.id, { type: "poke", value: 1 });
store.addAction(obj.id, { type: "chaos", value: 2 });
store.addAction(obj.id, { type: "bossCake", value: 6 });
let o = store.getObject(obj.id);
assert.equal(o.heat, 1);
assert.equal(o.history.length, 3);

const line = heat.releaseLine(o);
assert.match(line, /戳 1 下/);
assert.match(line, /乱炖 2 秒/);
assert.match(line, /老板的饼/);

// cooldown with dish name
store.startCooldown(obj.id, 3, { dishName: "上头版 · 周一限定乱炖", dishReview: "笑" });
o = store.getObject(obj.id);
assert.equal(o.status, "cooling");
assert.equal(o.dishName, "上头版 · 周一限定乱炖");
assert.equal(o.initialHeat, 1);

// decay
const partial = heat.coolingHeat(o, o.cooldownStartAt + 1.5 * 86400000);
assert.ok(Math.abs(partial - 0.5) < 0.01, `partial=${partial}`);

// reopen
store.reopenForCooking(obj.id);
o = store.getObject(obj.id);
assert.equal(o.status, "cooking");
assert.equal(o.cookCount, 2);

// early release keeps dish
store.startCooldown(obj.id, 1, { dishName: "测试菜" });
store.manualForgive(obj.id);
o = store.getObject(obj.id);
assert.equal(o.status, "forgiven");
assert.equal(o.dishName, "测试菜");

// auto tick
const obj2 = store.createObject("甲方嘴硬");
store.startCooldown(obj2.id, 1);
const data = JSON.parse(mem.get("emotion-pot:v1"));
const rec = data.objects.find((x) => x.id === obj2.id);
rec.cooldownEndAt = Date.now() - 1000;
rec.cooldownStartAt = Date.now() - 2 * 86400000;
mem.set("emotion-pot:v1", JSON.stringify(data));
assert.equal(store.tickCooldowns().length, 1);
assert.equal(store.getObject(obj2.id).status, "forgiven");

// events
const events = store.getEvents();
assert.ok(events.some((e) => e.event === "object_created"));
assert.ok(events.some((e) => e.event === "object_forgiven"));

// helpers
assert.equal(heat.formatClock(60000), "01:00");
assert.equal(gags.INGREDIENT_ITEMS.length, 8);
assert.ok(gags.HOME_CHIPS.length >= 4);
assert.equal(gags.starsFor(5, 10), 1);
assert.equal(gags.starsFor(30, 100), 5);
assert.ok(gags.comboTitle(12)?.title === "炉火纯青");

console.log("✓ smoke: all assertions passed");
