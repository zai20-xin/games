export const TOTAL_NIGHTS = 5;

export const DIFFICULTY = {
  easy: {
    id: "easy",
    label: "摸鱼",
    hint: "猎梦者较弱，适合熟悉",
    startGold: 80,
    ghostHpMul: 0.75,
    ghostDmgMul: 0.8,
    daySec: 22,
  },
  normal: {
    id: "normal",
    label: "躺平",
    hint: "标准节奏",
    startGold: 50,
    ghostHpMul: 1,
    ghostDmgMul: 1,
    daySec: 18,
  },
  hard: {
    id: "hard",
    label: "内卷",
    hint: "猎梦者更凶，发育要快",
    startGold: 35,
    ghostHpMul: 1.3,
    ghostDmgMul: 1.25,
    daySec: 15,
  },
};

export const DOOR_MAX = 8;
export const BED_MAX = 8;
export const SLOTS = 4;

export const DOOR_TIER = [
  "",
  "木门",
  "木门",
  "铁门",
  "铁门",
  "钢门",
  "合金门",
  "金库门",
  "堡垒门",
];

/** 床：每秒产金 */
export const BED_RATE = [0, 4, 7, 12, 18, 26, 36, 50, 70];
export const BED_COST = [0, 0, 30, 55, 90, 140, 210, 300, 420];

/** 门：最大 HP */
export const DOOR_HP = [0, 220, 340, 500, 720, 1000, 1380, 1900, 2600];
export const DOOR_COST = [0, 0, 25, 45, 75, 120, 180, 260, 380];

/** 房间矿脉：躺床上也能吃矿（对齐原作铜/钻石矿） */
export const MINES = {
  none: { id: "none", name: "", mul: 1, color: null, weight: 0.55 },
  copper: { id: "copper", name: "铜矿", mul: 1.25, color: "#c47b3a", weight: 0.3 },
  gold: { id: "gold", name: "金矿", mul: 1.55, color: "#f0c14b", weight: 0.12 },
  diamond: { id: "diamond", name: "钻石矿", mul: 2.1, color: "#7ef0ff", weight: 0.03 },
};

export const TURRETS = {
  gun: {
    id: "gun",
    name: "机枪",
    icon: "🔫",
    cost: 30,
    dmg: 8,
    cd: 0.28,
    range: 220,
    color: "#4cc9f0",
    desc: "射速快，单体",
  },
  cannon: {
    id: "cannon",
    name: "榴弹",
    icon: "💣",
    cost: 55,
    dmg: 22,
    cd: 0.85,
    range: 200,
    color: "#f0c14b",
    desc: "高伤，略慢",
  },
  laser: {
    id: "laser",
    name: "激光",
    icon: "⚡",
    cost: 90,
    dmg: 14,
    cd: 0.18,
    range: 250,
    color: "#c77dff",
    desc: "射程远，持续",
  },
  tesla: {
    id: "tesla",
    name: "电塔",
    icon: "🌩",
    cost: 120,
    dmg: 28,
    cd: 0.55,
    range: 180,
    color: "#5cf2c7",
    desc: "近距高伤电击",
  },
  arcade: {
    id: "arcade",
    name: "游戏机",
    icon: "🕹",
    cost: 80,
    dmg: 0,
    cd: 999,
    range: 0,
    color: "#ff8fab",
    goldPerSec: 6,
    desc: "不打人，产金 +6/s",
  },
};

/** 天亮三选一 buff（对齐原作「勤俭持家/躺着赚钱」等） */
export const BUFFS = [
  {
    id: "thrifty",
    name: "勤俭持家",
    icon: "🛏",
    desc: "床产金 +3/s",
    apply(w, room) {
      room.bedFlatBonus = (room.bedFlatBonus || 0) + 3;
    },
  },
  {
    id: "lazy_money",
    name: "躺着赚钱",
    icon: "😴",
    desc: "产金速度 +20%",
    apply(w, room) {
      room.bedMul = (room.bedMul || 1) * 1.2;
    },
  },
  {
    id: "iron_door",
    name: "铁门工",
    icon: "🚪",
    desc: "门上限 +15% 并回满",
    apply(w, room) {
      room.door.maxHp = Math.round(room.door.maxHp * 1.15);
      room.door.hp = room.door.maxHp;
      room.doorMul = (room.doorMul || 1) * 1.15;
    },
  },
  {
    id: "armory",
    name: "军火商",
    icon: "🔫",
    desc: "炮台伤害 +18%",
    apply(w, room) {
      room.turretDmgMul = (room.turretDmgMul || 1) * 1.18;
    },
  },
  {
    id: "repair",
    name: "紧急维修",
    icon: "🔧",
    desc: "门立即回满",
    apply(w, room) {
      room.door.hp = room.door.maxHp;
    },
  },
  {
    id: "slow_dream",
    name: "摸鱼结界",
    icon: "🌫",
    desc: "猎梦者攻速 -15%",
    apply(w) {
      w.ghostDebuff = (w.ghostDebuff || 1) * 0.85;
      w.playerBuffs.push("摸鱼结界");
    },
  },
  {
    id: "long_day",
    name: "赖床",
    icon: "⏰",
    desc: "下一夜白天 +4s",
    apply(w) {
      w.dayBonus = (w.dayBonus || 0) + 4;
      w.playerBuffs.push("赖床");
    },
  },
];

export function rollMine(MathRand = Math.random) {
  const entries = Object.values(MINES);
  const total = entries.reduce((s, m) => s + m.weight, 0);
  let r = MathRand() * total;
  for (const m of entries) {
    r -= m.weight;
    if (r <= 0) return m;
  }
  return MINES.none;
}

export function rollBuffs(n = 3, MathRand = Math.random) {
  const pool = [...BUFFS];
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(MathRand() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export const GHOST_BASE = {
  hp: 280,
  dmg: 18,
  speed: 42,
  attackCd: 0.7,
  goldOnRetreat: 40,
};

/** 猎梦者变身阈值：血量比例或第几夜 */
export const TRANSFORM = {
  hpRatio: 0.55,
  minNight: 2,
  hpMul: 1.15,
  dmgMul: 1.35,
  speedMul: 1.25,
};

export function ghostStats(night, mul = { hp: 1, dmg: 1 }) {
  const n = Math.max(1, night);
  return {
    hp: Math.round(GHOST_BASE.hp * (1 + (n - 1) * 0.55) * mul.hp),
    dmg: Math.round(GHOST_BASE.dmg * (1 + (n - 1) * 0.35) * mul.dmg),
    speed: GHOST_BASE.speed + (n - 1) * 4,
    attackCd: Math.max(0.42, GHOST_BASE.attackCd - (n - 1) * 0.04),
    goldOnRetreat: Math.round(GHOST_BASE.goldOnRetreat * n * 0.9),
  };
}

export const ROOM_COLS = 3;
export const ROOM_ROWS = 2;
