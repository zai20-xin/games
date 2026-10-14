/** 荒诞文案 / 随机事件 / 出锅鉴定 —— 恶搞转移注意力 */

export const FORMS_FUN = [
  { min: 0, max: 19, emoji: "🧑", nick: "淡定脸", line: "我就静静地看着你。", accessory: "", art: "chef" },
  { min: 20, max: 39, emoji: "😅", nick: "心虚包子", line: "我…我也是被逼的啊！", accessory: "💧", art: "bun" },
  { min: 40, max: 59, emoji: "😤", nick: "上头章鱼", line: "你再搅我就要骂人了啊！", accessory: "💢", art: "octo" },
  { min: 60, max: 79, emoji: "🤡", nick: "小丑南瓜", line: "好，好，都是我的错，行了吧？", accessory: "🎪", art: "clown" },
  { min: 80, max: 99, emoji: "🧟", nick: "疯球土豆", line: "锅里这么热，不如加点蒜。", accessory: "🔥", art: "potato" },
  { min: 100, max: Infinity, emoji: "🦞", nick: "被做成菜", line: "……我觉得我还能抢救一下。", accessory: "⭐", art: "lobster" },
];

export const COMBO_TITLES = [
  { at: 3, title: "小试牛刀", line: "手感来了！" },
  { at: 6, title: "行云流水", line: "锅开始跳舞了。" },
  { at: 10, title: "炉火纯青", line: "你是懂解压的。" },
  { at: 15, title: "癫狂大厨", line: "锅气外泄，小心笑出声。" },
  { at: 25, title: "传说掌勺人", line: "这锅已经载入史册（假的）。" },
];

export function comboTitle(n) {
  let cur = null;
  for (const c of COMBO_TITLES) {
    if (n >= c.at) cur = c;
  }
  return cur;
}

export const STAR_LINES = {
  5: "五星好评：建议直接上市。",
  4: "四星：差一星是因为锅还想再炖。",
  3: "三星：合格的快乐搅拌机。",
  2: "两星：味道还行，笑果一般。",
  1: "一星：火候不够，建议再胡闹一会儿。",
};

export const POKE_LINES = [
  "哎哟，别戳了！",
  "有话好好说，先放我出去！",
  "你这样我很没面子的。",
  "我招了，我真的招了。",
  "再戳我就报警了！锅里怎么报警啊？",
  "这一下算工伤。",
  "我错了，虽然我不知道错哪了。",
  "要不…我们点个外卖冷静一下？",
  "你消消气，我变小丑给你看。",
  "我只是个锅里的倒霉蛋。",
];

export const STIR_LINES = [
  "晕了晕了，眼冒金星！",
  "这是洗衣机还是锅？",
  "你要的圆舞曲来了！",
  "我头好晕，但心里好爽（不是）。",
  "搅吧搅吧，大不了化成汤。",
  "我投降，先停三秒行不行？",
];

export const INGREDIENT_ITEMS = [
  {
    id: "bossCake",
    emoji: "🫓",
    name: "老板的饼",
    heat: 6,
    quip: "又大又圆，就是不顶饿。",
    art: "bossCake",
  },
  {
    id: "clientMouth",
    emoji: "🤐",
    name: "甲方的嘴硬",
    heat: 8,
    quip: "比锅底还硬，建议小火慢炖。",
    art: "clientMouth",
  },
  {
    id: "mondayAlarm",
    emoji: "⏰",
    name: "周一的闹钟",
    heat: 5,
    quip: "听见这个声音，锅都清醒了。",
    art: "mondayAlarm",
  },
  {
    id: "expiredDream",
    emoji: "💤",
    name: "过期的梦想",
    heat: 7,
    quip: "泡沫很大，一戳就破。",
    art: "expiredDream",
  },
  {
    id: "uselessCs",
    emoji: "📞",
    name: "打不通的客服",
    heat: 6,
    quip: "正在为您转接……一辈子。",
    art: "uselessCs",
  },
  {
    id: "missedTakeout",
    emoji: "🍜",
    name: "点不到的外卖",
    heat: 5,
    quip: "骑手正在爬山，锅也饿了。",
    art: "missedTakeout",
  },
  {
    id: "endlessMeeting",
    emoji: "📊",
    name: "拉通对齐会",
    heat: 7,
    quip: "会开完了吗？没有，还有下一场。",
    art: "endlessMeeting",
  },
  {
    id: "coldJoke",
    emoji: "🧊",
    name: "冷笑话冰块",
    heat: 3,
    quip: "冷，但没什么用。正好垫垫锅。",
    art: "coldJoke",
  },
];

/** 道具栏出现顺序：常用靠前 */
export const WEAPON_ORDER = INGREDIENT_ITEMS.map((x) => x.id);

export const STIR_ONE_LINES = [
  "好痒，好痒！",
  "你点得我咯咯笑。",
  "干嘛呀～",
  "肉肉的，手感不错吧？",
  "不带这么欺负锅中物的！",
];

export const CHAOS_LINES = [
  "我在锅里蹦迪！",
  "旋转吧，小土豆！",
  "这就是自由（锅中限定）。",
  "来啊，一起发疯啊！",
  "我怀疑你在解压，我没有证据。",
  "锅气上来了，你也笑了吧。",
];

export const STEAM_LINES = [
  "嘘……安静。",
  "我先睡三分钟。",
  "焖一下，怨气变香气。",
  "锅盖是成年人的结界。",
  "世界和平（暂时）。",
];

/** 动作累计触发的小剧场 */
export const EVENTS = [
  {
    id: "apology",
    need: 8,
    title: "道歉火锅",
    body: "锅里那位突然跪了：「我道歉，虽然有点早，但求你别加料了。」",
    formBias: 3,
  },
  {
    id: "cake",
    need: 16,
    title: "画饼翻车",
    body: "一张巨大的饼盖住锅面……然后饼裂了，里面还是饼。无限套娃。",
    formBias: 4,
  },
  {
    id: "clock",
    need: 26,
    title: "周一闹钟二重奏",
    body: "闹钟在锅里响了，对象捂住耳朵大喊：「谁把周一丢进来了！」",
    formBias: 4,
  },
  {
    id: "gods",
    need: 40,
    title: "锅中哲学",
    body: "对象突然盘腿坐下：「施主，放下锅铲，立地成汤。」你愣了半秒，气消了一点。",
    formBias: 5,
  },
];

export const DISH_NAMES = [
  "小丑の同情火锅",
  "周一限定乱炖",
  "甲方嘴硬煲",
  "老板画饼刺身",
  "心虚包子汤",
  "过期梦想串串",
  "无语子佛跳墙",
  "气笑结合锅",
  "摆烂快乐锅",
  "嘴硬的心，软了",
];

export const DISH_REVIEWS = [
  "色香味俱全，尤其「色」字里的无力感。",
  "吃一口就忘了自己刚在气什么，不错。",
  "本锅鉴定：恶搞成功，注意力已转移。",
  "不是原谅，是忙着笑，顾不上恨。",
  "建议搭配深呼吸食用，效果更佳。",
  "火候到位，小丑精神饱满。",
  "这锅不是出气筒，是快乐搅拌机。",
];

export const HOME_CHIPS = [
  "临时改需求",
  "周一早会",
  "甲方：再改一版",
  "过期的梦想",
  "永远打不通的客服",
  "点不到的外卖",
];

export const PLACEHOLDERS = [
  "今天谁又惹你了？",
  "什么东西让你火大？",
  "先别忍，丢进锅。",
  "这口气，先让锅端着。",
  "有些话不能说，锅里可以怪叫。",
  "写下来，我帮你羞辱它（开玩笑）。",
];

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function formFun(heat) {
  const h = Number(heat) || 0;
  for (const f of FORMS_FUN) {
    if (h >= f.min && h <= f.max) return f;
  }
  return FORMS_FUN[0];
}

export function dishTitle(actionCount, maxHeat) {
  const base = pick(DISH_NAMES);
  const level =
    maxHeat >= 100 ? "终极版" : maxHeat >= 60 ? "上头版" : maxHeat >= 30 ? "微辣版" : "清淡版";
  return `${level} · ${base}`;
}

export function dishReview() {
  return pick(DISH_REVIEWS);
}

export function starsFor(actionCount, maxHeat) {
  let s = 1;
  if (actionCount >= 8) s++;
  if (actionCount >= 16) s++;
  if (maxHeat >= 40) s++;
  if (maxHeat >= 80 || actionCount >= 28) s++;
  return Math.min(5, s);
}

/** 按动作类型取吐槽 */
export function lineFor(kind) {
  switch (kind) {
    case "poke":
      return pick(POKE_LINES);
    case "stir":
      return pick(STIR_LINES);
    case "chaos":
      return pick(CHAOS_LINES);
    case "steam":
      return pick(STEM_LINES_SAFE());
    case "ing":
      return pick(INGREDIENT_ITEMS).quip;
    default:
      return pick(POKE_LINES);
  }
}

function STEM_LINES_SAFE() {
  return STEAM_LINES;
}

export function eventFor(actionCount) {
  // 返回「下一场未触发事件」进度用；触发由调用方判断
  let next = null;
  for (const e of EVENTS) {
    if (actionCount >= e.need) next = e;
    else return { next: e, progress: actionCount, justTriggered: false, current: next };
  }
  return { next: null, progress: actionCount, justTriggered: false, current: next };
}

export function maybeEvent(actionCount, triggered = []) {
  for (const e of EVENTS) {
    if (actionCount >= e.need && !triggered.includes(e.id)) return e;
  }
  return null;
}
