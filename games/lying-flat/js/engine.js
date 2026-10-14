import {
  BED_COST,
  BED_MAX,
  BED_RATE,
  DIFFICULTY,
  DOOR_COST,
  DOOR_HP,
  DOOR_MAX,
  MINES,
  SLOTS,
  TOTAL_NIGHTS,
  TRANSFORM,
  TURRETS,
  ghostStats,
  rollBuffs,
  rollMine,
} from "./balance.js";

let uid = 1;
const nextId = () => uid++;

function makeRoom(col, row, id) {
  return {
    id,
    col,
    row,
    label: `${row === 0 ? "A" : "B"}${col + 1}`,
    door: { level: 1, hp: DOOR_HP[1], maxHp: DOOR_HP[1] },
    bed: { level: 1 },
    slots: Array.from({ length: SLOTS }, () => null),
    mine: MINES.none,
    occupant: null,
    alive: true,
    name: "",
    box: null,
    bedFlatBonus: 0,
    bedMul: 1,
    doorMul: 1,
    turretDmgMul: 1,
  };
}

export function createWorld(diffKey = "normal") {
  const diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
  uid = 1;

  const rooms = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      rooms.push(makeRoom(c, r, nextId()));
    }
  }

  return {
    phase: "title",
    diff,
    night: 1,
    dayLeft: diff.daySec,
    rooms,
    gold: diff.startGold,
    selectedRoomId: null,
    selectedSlot: -1,
    selectedTurret: "gun",
    ghost: null,
    projectiles: [],
    particles: [],
    floats: [],
    time: 0,
    banner: null,
    playerDmg: 0,
    muted: false,
    won: false,
    npcTimer: 0,
    // buff 系统
    pendingBuffs: null,
    playerBuffs: [],
    dayBonus: 0,
    ghostDebuff: 1,
  };
}

export function bedRate(roomOrLevel) {
  if (typeof roomOrLevel === "number") {
    return BED_RATE[Math.min(BED_MAX, Math.max(1, roomOrLevel))];
  }
  const room = roomOrLevel;
  const base = BED_RATE[Math.min(BED_MAX, Math.max(1, room.bed.level))];
  const mineMul = room.mine?.mul || 1;
  return (base + (room.bedFlatBonus || 0)) * (room.bedMul || 1) * mineMul;
}

export function playerRoom(w) {
  return w.rooms.find((r) => r.occupant === "player" && r.alive) || null;
}

export function doorUpgradeCost(level) {
  if (level >= DOOR_MAX) return null;
  return DOOR_COST[level + 1];
}

export function bedUpgradeCost(level) {
  if (level >= BED_MAX) return null;
  return BED_COST[level + 1];
}

export function setDoorLevel(room, level) {
  room.door.level = level;
  room.door.maxHp = Math.round(DOOR_HP[level] * (room.doorMul || 1));
  room.door.hp = room.door.maxHp;
}

export function startSelect(w) {
  w.phase = "select";
  w.rooms.forEach((r) => {
    r.occupant = null;
    r.alive = true;
    r.door.level = 1;
    r.door.maxHp = DOOR_HP[1];
    r.door.hp = DOOR_HP[1];
    r.bed.level = 1;
    r.slots = Array.from({ length: SLOTS }, () => null);
    r.mine = rollMine();
    r.bedFlatBonus = 0;
    r.bedMul = 1;
    r.doorMul = 1;
    r.turretDmgMul = 1;
  });
  w.ghost = null;
  w.projectiles = [];
  w.particles = [];
  w.floats = [];
  w.night = 1;
  w.dayLeft = w.diff.daySec;
  w.gold = w.diff.startGold;
  w.playerDmg = 0;
  w.selectedRoomId = null;
  w.selectedSlot = -1;
  w.pendingBuffs = null;
  w.playerBuffs = [];
  w.dayBonus = 0;
  w.ghostDebuff = 1;
}

export function occupyRoom(w, roomId) {
  const room = w.rooms.find((r) => r.id === roomId);
  if (!room || room.occupant) return false;
  room.occupant = "player";
  room.name = "你";
  w.selectedRoomId = room.id;

  const npcNames = ["阿伟", "小美", "老张", "豆豆", "Ken", "王姐", "摸鱼怪"];
  let ni = 0;
  for (const r of w.rooms) {
    if (r.occupant) continue;
    r.occupant = "npc";
    r.name = npcNames[ni++ % npcNames.length];
    if (Math.random() < 0.45) r.bed.level = 2;
  }

  w.phase = "day";
  w.dayLeft = w.diff.daySec + (w.dayBonus || 0);
  const mineName = room.mine.name ? `（${room.mine.name}）` : "";
  w.banner = { text: `躺下了${mineName}，赶紧发育！`, kind: "ok", t: 2.4 };
  return true;
}

export function tryUpgradeDoor(w) {
  const room = playerRoom(w);
  if (!room) return false;
  const cost = doorUpgradeCost(room.door.level);
  if (cost == null || w.gold < cost) return false;
  w.gold -= cost;
  setDoorLevel(room, room.door.level + 1);
  burst(w, room, "door", "#9db4d0");
  floatText(w, room, `门 Lv${room.door.level}`, "#c9d5ea");
  return true;
}

export function tryUpgradeBed(w) {
  const room = playerRoom(w);
  if (!room) return false;
  const cost = bedUpgradeCost(room.bed.level);
  if (cost == null || w.gold < cost) return false;
  w.gold -= cost;
  room.bed.level += 1;
  burst(w, room, "bed", "#e8c27a");
  floatText(w, room, `床 Lv${room.bed.level} +${Math.floor(bedRate(room))}/s`, "#e8c27a");
  return true;
}

export function tryBuildTurret(w, slotIndex, type) {
  const room = playerRoom(w);
  if (!room) return false;
  if (slotIndex < 0 || slotIndex >= SLOTS) return false;
  if (room.slots[slotIndex]) return false;
  const def = TURRETS[type] || TURRETS.gun;
  if (w.gold < def.cost) return false;
  w.gold -= def.cost;
  room.slots[slotIndex] = { type: def.id, level: 1, cd: 0 };
  burst(w, room, `slot${slotIndex}`, def.color);
  floatText(w, room, `${def.name}就位`, def.color);
  return true;
}

export function chooseBuff(w, buffId) {
  if (!w.pendingBuffs) return false;
  const buff = w.pendingBuffs.find((b) => b.id === buffId);
  if (!buff) return false;
  const room = playerRoom(w);
  if (!room) return false;
  buff.apply(w, room);
  if (!w.playerBuffs.includes(buff.name) && buff.id !== "slow_dream" && buff.id !== "long_day") {
    w.playerBuffs.push(buff.name);
  }
  w.pendingBuffs = null;
  w.phase = "day";
  w.dayLeft = w.diff.daySec + (w.dayBonus || 0);
  w.dayBonus = 0;
  setBanner(w, `获得「${buff.name}」`, "ok", 2);
  return true;
}

function roomDoorWorldPos(room) {
  if (!room.box) return { x: 0, y: 0 };
  return { x: room.box.doorX, y: room.box.doorY };
}

function slotWorldPos(room, i) {
  if (!room.box) return { x: 0, y: 0 };
  const s = room.box.slots[i];
  return { x: s.x, y: s.y };
}

function burst(w, room, kind, color) {
  const p =
    kind === "door"
      ? roomDoorWorldPos(room)
      : kind === "bed"
        ? { x: room.box?.bedX || 0, y: room.box?.bedY || 0 }
        : slotWorldPos(room, Number(kind.replace("slot", "")) || 0);
  for (let i = 0; i < 10; i++) {
    w.particles.push({
      x: p.x,
      y: p.y,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 80,
      life: 0.45 + Math.random() * 0.25,
      max: 0.7,
      color,
      r: 2 + Math.random() * 2,
    });
  }
}

function floatText(w, room, text, color) {
  const p = room?.box
    ? { x: (room.box.x + room.box.w) / 2, y: room.box.y + 18 }
    : { x: 0, y: 0 };
  w.floats.push({ x: p.x, y: p.y, text, color, life: 1.1, max: 1.1 });
}

export function setBanner(w, text, kind = "ok", t = 2) {
  w.banner = { text, kind, t };
}

function enterNight(w) {
  w.phase = "night";
  const st = ghostStats(w.night, {
    hp: w.diff.ghostHpMul,
    dmg: w.diff.ghostDmgMul,
  });
  w.ghost = {
    x: -40,
    y: 0,
    hp: st.hp,
    maxHp: st.hp,
    dmg: st.dmg,
    speed: st.speed,
    attackCd: st.attackCd / (w.ghostDebuff || 1),
    attackTimer: 0,
    targetRoomId: null,
    state: "walk",
    dieT: 0,
    phase: Math.random() * Math.PI * 2,
    form: 0, // 0 原形 | 1 变身
    transformed: false,
  };
  pickGhostTarget(w);
  setBanner(w, `第 ${w.night} 夜 · 猎梦者来了！`, "danger", 2.2);
}

function maybeTransform(w) {
  const g = w.ghost;
  if (!g || g.transformed || g.state === "die") return;
  if (w.night < TRANSFORM.minNight) return;
  // 血量掉到阈值以下变身；第 4 夜开场不久直接变身
  const ratio = g.hp / g.maxHp;
  const lateNightRush = w.night >= TOTAL_NIGHTS - 1;
  if (!lateNightRush && ratio > TRANSFORM.hpRatio) return;
  g.transformed = true;
  g.form = 1;
  g.dmg = Math.round(g.dmg * TRANSFORM.dmgMul);
  g.speed *= TRANSFORM.speedMul;
  g.maxHp = Math.round(g.maxHp * TRANSFORM.hpMul);
  g.hp = Math.min(g.maxHp, g.hp + Math.round(g.maxHp * 0.2));
  g.attackCd = Math.max(0.3, g.attackCd * 0.9);
  setBanner(w, "猎梦者变身了！拆门更快！", "danger", 2.4);
  for (let i = 0; i < 24; i++) {
    w.particles.push({
      x: g.x,
      y: g.y,
      vx: (Math.random() - 0.5) * 140,
      vy: (Math.random() - 0.5) * 140,
      life: 0.6,
      max: 0.6,
      color: "#ff2d55",
      r: 3,
    });
  }
}

function pickGhostTarget(w) {
  const candidates = w.rooms.filter((r) => r.alive && r.occupant);
  if (!candidates.length) {
    if (w.ghost) w.ghost.targetRoomId = null;
    return;
  }
  candidates.sort((a, b) => {
    const sa = a.door.hp / a.door.maxHp + (a.occupant === "player" ? 0.08 : 0);
    const sb = b.door.hp / b.door.maxHp + (b.occupant === "player" ? 0.08 : 0);
    return sa - sb;
  });
  const pick =
    Math.random() < 0.7
      ? candidates[0]
      : candidates[Math.floor(Math.random() * candidates.length)];
  if (w.ghost) {
    w.ghost.targetRoomId = pick.id;
    w.ghost.state = "walk";
  }
}

function damageDoor(w, room, dmg) {
  room.door.hp = Math.max(0, room.door.hp - dmg);
  maybeTransform(w);
  if (room.door.hp <= 0 && room.alive) {
    room.alive = false;
    burst(w, room, "door", "#ff4d6d");
    if (room.occupant === "player") {
      w.phase = "lose";
      w.won = false;
      setBanner(w, "门破了……躺平失败", "danger", 3);
    } else {
      setBanner(w, `${room.name} 的门被破了！`, "danger", 1.8);
      if (w.ghost) {
        w.ghost.hp = Math.min(w.ghost.maxHp, w.ghost.hp + 40);
        w.ghost.dmg = Math.round(w.ghost.dmg * 1.08);
      }
      pickGhostTarget(w);
    }
  }
}

function npcAI(w, dt) {
  w.npcTimer -= dt;
  if (w.npcTimer > 0) return;
  w.npcTimer = 0.55 + Math.random() * 0.35;

  for (const room of w.rooms) {
    if (!room.alive || room.occupant !== "npc") continue;
    room._gold = (room._gold || 0) + bedRate(room) * 0.6;

    const doorCost = doorUpgradeCost(room.door.level);
    const hpRatio = room.door.hp / room.door.maxHp;
    const underAttack =
      w.phase === "night" && w.ghost && w.ghost.targetRoomId === room.id;

    if (
      doorCost != null &&
      (hpRatio < 0.55 || (underAttack && hpRatio < 0.85)) &&
      room._gold >= doorCost
    ) {
      room._gold -= doorCost;
      setDoorLevel(room, room.door.level + 1);
      continue;
    }

    const emptySlots = room.slots
      .map((s, i) => (s ? -1 : i))
      .filter((i) => i >= 0);
    const wantTurret =
      emptySlots.length &&
      (room.slots.every((s) => !s) || (underAttack && Math.random() < 0.5));
    if (wantTurret && room._gold >= 30) {
      const roll = Math.random();
      let type = "gun";
      if (room.bed.level >= 5 && roll < 0.2) type = "tesla";
      else if (room.bed.level >= 4 && roll < 0.45) type = "cannon";
      else if (room.bed.level >= 3 && roll < 0.65) type = "laser";
      else if (roll > 0.9) type = "arcade";
      const def = TURRETS[type];
      if (room._gold >= def.cost) {
        room._gold -= def.cost;
        room.slots[emptySlots[0]] = { type, level: 1, cd: 0 };
        continue;
      }
    }

    const bedCost = bedUpgradeCost(room.bed.level);
    if (bedCost != null && room._gold >= bedCost && !underAttack) {
      room._gold -= bedCost;
      room.bed.level += 1;
    }
  }
}

function stepArcade(w, dt) {
  const me = playerRoom(w);
  for (const room of w.rooms) {
    if (!room.alive) continue;
    for (const t of room.slots) {
      if (!t || t.type !== "arcade") continue;
      const gps = TURRETS.arcade.goldPerSec;
      if (room.occupant === "player") {
        w.gold += gps * dt;
      } else {
        room._gold = (room._gold || 0) + gps * dt;
      }
    }
  }
  if (me && me.mine && me.mine.id !== "none") {
    // 矿脉已含在 bedRate；此处仅作视觉浮动提示节流
  }
}

function fireTurrets(w, dt) {
  if (!w.ghost || w.ghost.state === "die") return;
  const g = w.ghost;
  const gx = g.x;
  const gy = g.y;

  for (const room of w.rooms) {
    if (!room.alive || !room.box) continue;
    const dmgMul = room.turretDmgMul || 1;
    for (let i = 0; i < room.slots.length; i++) {
      const t = room.slots[i];
      if (!t) continue;
      const def = TURRETS[t.type] || TURRETS.gun;
      if (!def.dmg) continue;
      t.cd -= dt;
      const sp = slotWorldPos(room, i);
      const dist = Math.hypot(sp.x - gx, sp.y - gy);
      if (dist > def.range) continue;
      if (t.cd > 0) continue;
      t.cd = def.cd;
      w.projectiles.push({
        x: sp.x,
        y: sp.y,
        tx: gx,
        ty: gy,
        speed: t.type === "tesla" ? 900 : 420,
        dmg: def.dmg * dmgMul,
        color: def.color,
        fromPlayer: room.occupant === "player",
        kind: t.type,
      });
    }
  }
}

function stepProjectiles(w, dt) {
  if (!w.ghost) return;
  const g = w.ghost;
  const list = w.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const dx = g.x - p.x;
    const dy = g.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = p.speed * dt;
    if (dist <= step + 4) {
      if (g.state !== "die") {
        g.hp -= p.dmg;
        if (p.fromPlayer) w.playerDmg += p.dmg;
        maybeTransform(w);
        for (let k = 0; k < 4; k++) {
          w.particles.push({
            x: g.x,
            y: g.y,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            life: 0.3,
            max: 0.3,
            color: p.color,
            r: 2,
          });
        }
        if (g.hp <= 0) {
          g.hp = 0;
          g.state = "die";
          g.dieT = 0.9;
          setBanner(w, "猎梦者被打退！", "ok", 1.6);
        }
      }
      list.splice(i, 1);
      continue;
    }
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
    p.tx = g.x;
    p.ty = g.y;
  }
}

function stepGhost(w, dt) {
  const g = w.ghost;
  if (!g) return;

  if (g.state === "die") {
    g.dieT -= dt;
    if (g.dieT <= 0) {
      const reward = ghostStats(w.night, {
        hp: w.diff.ghostHpMul,
        dmg: w.diff.ghostDmgMul,
      }).goldOnRetreat;
      w.gold += reward;
      floatText(w, playerRoom(w) || w.rooms[0], `+${reward}`, "#f0c14b");
      w.ghost = null;
      w.projectiles.length = 0;

      if (w.night >= TOTAL_NIGHTS) {
        w.phase = "win";
        w.won = true;
      } else {
        w.night += 1;
        // 天亮三选一
        w.pendingBuffs = rollBuffs(3);
        w.phase = "buff";
        setBanner(w, `第 ${w.night} 夜前 · 选一项躺平技能`, "ok", 2.2);
      }
    }
    return;
  }

  maybeTransform(w);

  if (!g.targetRoomId) pickGhostTarget(w);
  const room = w.rooms.find((r) => r.id === g.targetRoomId && r.alive);
  if (!room) {
    pickGhostTarget(w);
    return;
  }

  const door = roomDoorWorldPos(room);
  const dx = door.x - g.x;
  const dy = door.y - g.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (g.state === "walk") {
    if (dist > 18) {
      g.x += (dx / dist) * g.speed * dt;
      g.y += (dy / dist) * g.speed * dt;
    } else {
      g.state = "attack";
      g.attackTimer = 0;
    }
  } else if (g.state === "attack") {
    if (!room.alive) {
      pickGhostTarget(w);
      return;
    }
    if (dist > 22) {
      g.state = "walk";
      return;
    }
    g.attackTimer -= dt;
    if (g.attackTimer <= 0) {
      g.attackTimer = g.attackCd;
      damageDoor(w, room, g.dmg);
      for (let i = 0; i < 5; i++) {
        w.particles.push({
          x: door.x + (Math.random() - 0.5) * 10,
          y: door.y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 40,
          vy: -20 - Math.random() * 30,
          life: 0.35,
          max: 0.35,
          color: "#ff4d6d",
          r: 2,
        });
      }
    }
  }
}

function stepFx(w, dt) {
  for (let i = w.particles.length - 1; i >= 0; i--) {
    const p = w.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    if (p.life <= 0) w.particles.splice(i, 1);
  }
  for (let i = w.floats.length - 1; i >= 0; i--) {
    const f = w.floats[i];
    f.life -= dt;
    f.y -= 28 * dt;
    if (f.life <= 0) w.floats.splice(i, 1);
  }
  if (w.banner) {
    w.banner.t -= dt;
    if (w.banner.t <= 0) w.banner = null;
  }
}

export function step(w, dt) {
  if (
    w.phase === "pause" ||
    w.phase === "title" ||
    w.phase === "select" ||
    w.phase === "buff"
  ) {
    stepFx(w, dt);
    return;
  }
  if (w.phase === "win" || w.phase === "lose") {
    stepFx(w, dt);
    return;
  }

  w.time += dt;

  const me = playerRoom(w);
  if (me) {
    w.gold += bedRate(me) * dt;
  }
  for (const r of w.rooms) {
    if (r.alive && r.occupant === "npc") {
      r._gold = (r._gold || 0) + bedRate(r) * dt * 0.35;
    }
  }
  stepArcade(w, dt);

  if (w.phase === "day") {
    w.dayLeft -= dt;
    if (w.dayLeft <= 0) {
      w.dayLeft = 0;
      enterNight(w);
    }
  } else if (w.phase === "night") {
    npcAI(w, dt);
    fireTurrets(w, dt);
    stepProjectiles(w, dt);
    stepGhost(w, dt);
  }

  stepFx(w, dt);
}

export function aliveCount(w) {
  return w.rooms.filter((r) => r.alive && r.occupant).length;
}
