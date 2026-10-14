import { SLOTS, TURRETS } from "./balance.js";

const C = {
  bg: "#0a0d14",
  corridor: "#121826",
  corridorLine: "#1e2a3d",
  wall: "#1a2233",
  wallEdge: "#2a3548",
  roomFill: "#141c2b",
  bed: "#e8c27a",
  bedSheet: "#f3d9a4",
  door: "#6b7c93",
  doorDamaged: "#ff6b8a",
  doorOk: "#8fa3bf",
  text: "#e8eef8",
  muted: "#8b97ad",
  gold: "#f0c14b",
  ghost: "#ff4d6d",
  ghostGlow: "rgba(255,77,109,0.25)",
  player: "#3ddc97",
  npc: "#9aa7bc",
  slot: "#0f1522",
  slotStroke: "#2a3548",
  selected: "#4cc9f0",
};

/** 根据画布尺寸计算房间与碰撞盒，写回 room.box */
export function layout(w, width, height) {
  const pad = 28;
  const gap = 16;
  const corridorH = Math.floor(height * 0.16);
  const topH = Math.floor((height - corridorH - pad * 2 - gap) / 2);
  const roomW = Math.floor((width - pad * 2 - gap * 2) / 3);

  const corridorY = pad + topH + gap / 2;

  let i = 0;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const room = w.rooms[i++];
      const x = pad + c * (roomW + gap);
      const y = r === 0 ? pad : corridorY + corridorH + gap / 2;
      const h = topH;

      // 门在走廊一侧
      const doorW = 14;
      const doorH = Math.min(48, h * 0.28);
      const doorX = x + roomW / 2;
      const doorY = r === 0 ? y + h - 2 : y + 2;

      const bedX = x + 28;
      const bedY = y + h * (r === 0 ? 0.72 : 0.28);
      const bedW = Math.min(70, roomW * 0.38);
      const bedH = Math.min(36, h * 0.22);

      const slots = [];
      const sx0 = x + roomW * 0.55;
      const sy0 = y + h * 0.28;
      for (let s = 0; s < SLOTS; s++) {
        const col = s % 2;
        const row = Math.floor(s / 2);
        slots.push({
          x: sx0 + col * (roomW * 0.18),
          y: sy0 + row * (h * 0.28),
          r: 14,
        });
      }

      room.box = {
        x,
        y,
        w: roomW,
        h,
        doorX,
        doorY,
        doorW,
        doorH,
        bedX,
        bedY,
        bedW,
        bedH,
        slots,
      };
    }
  }

  // 鬼的走廊 y
  if (w.ghost && w.ghost.y === 0) {
    w.ghost.y = corridorY + corridorH / 2;
  }
  w._corridor = { y: corridorY, h: corridorH, x: pad, w: width - pad * 2 };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawGhost(ctx, g, t) {
  const bob = Math.sin(t * 6 + g.phase) * 3;
  const x = g.x;
  const y = g.y + bob;
  const form = g.form || 0;
  const bodyColor = form ? "#ff2d55" : g.state === "die" ? "#a33" : C.ghost;
  const glow = form ? "rgba(255,45,85,0.35)" : C.ghostGlow;
  const scale = form ? 1.2 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.fillStyle = glow;
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(0, -4, 16, Math.PI, 0);
  ctx.lineTo(16, 14);
  for (let i = 0; i < 4; i++) {
    const x1 = 16 - i * 8;
    ctx.quadraticCurveTo(x1 - 4, 18 + (i % 2) * 4, x1 - 8, 14);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = form ? "#ffe56a" : "#fff";
  ctx.beginPath();
  ctx.ellipse(-6, -6, 3.2, form ? 5.5 : 4.5, 0, 0, Math.PI * 2);
  ctx.ellipse(6, -6, 3.2, form ? 5.5 : 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  const look = g.state === "attack" ? 1.5 : Math.sin(t * 2) * 1.2;
  ctx.beginPath();
  ctx.arc(-6 + look, -6, 1.6, 0, Math.PI * 2);
  ctx.arc(6 + look, -6, 1.6, 0, Math.PI * 2);
  ctx.fill();

  if (form) {
    ctx.strokeStyle = "rgba(255,80,120,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -18);
    ctx.lineTo(-6, -28);
    ctx.moveTo(10, -18);
    ctx.lineTo(6, -28);
    ctx.stroke();
  }

  if (g.state === "attack") {
    ctx.strokeStyle = "rgba(255,77,109,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(t * 10) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function render(ctx, w, width, height, dpr) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // background grid
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, width, height);

  layout(w, width, height);

  // corridor
  if (w._corridor) {
    const { x, y, w: cw, h: ch } = w._corridor;
    ctx.fillStyle = C.corridor;
    ctx.fillRect(x - 8, y, cw + 16, ch);
    ctx.strokeStyle = C.corridorLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 0.5);
    ctx.lineTo(x + cw + 8, y + 0.5);
    ctx.moveTo(x - 8, y + ch - 0.5);
    ctx.lineTo(x + cw + 8, y + ch - 0.5);
    ctx.stroke();

    // floor dashes
    ctx.strokeStyle = "rgba(76,201,240,0.08)";
    for (let i = 0; i < 18; i++) {
      const dx = x + i * (cw / 18);
      ctx.beginPath();
      ctx.moveTo(dx, y + ch * 0.35);
      ctx.lineTo(dx + 10, y + ch * 0.35);
      ctx.moveTo(dx, y + ch * 0.65);
      ctx.lineTo(dx + 10, y + ch * 0.65);
      ctx.stroke();
    }
  }

  // rooms
  for (const room of w.rooms) {
    const b = room.box;
    if (!b) continue;

    // wall shell
    ctx.fillStyle = C.wall;
    roundRect(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 12);
    ctx.fill();

    ctx.fillStyle = room.alive ? C.roomFill : "#1a1218";
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill();

    ctx.strokeStyle = room.id === w.selectedRoomId ? C.selected : C.wallEdge;
    ctx.lineWidth = room.id === w.selectedRoomId ? 2 : 1;
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.stroke();

    // label
    ctx.fillStyle = C.muted;
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(room.label, b.x + 10, b.y + 18);

    if (room.mine && room.mine.id !== "none") {
      ctx.fillStyle = room.mine.color || C.gold;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(room.mine.name, b.x + 10, b.y + 34);
    }

    if (room.occupant) {
      ctx.fillStyle = room.occupant === "player" ? C.player : C.npc;
      ctx.font = room.occupant === "player" ? "bold 12px sans-serif" : "12px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(room.alive ? room.name : "已阵亡", b.x + b.w - 10, b.y + 18);
    }

    // bed
    if (room.alive && room.occupant) {
      const { bedX, bedY, bedW, bedH } = b;
      ctx.fillStyle = "#3a2f1d";
      roundRect(ctx, bedX, bedY, bedW, bedH, 6);
      ctx.fill();
      ctx.fillStyle = C.bed;
      roundRect(ctx, bedX + 2, bedY + 2, bedW - 4, bedH - 4, 5);
      ctx.fill();
      ctx.fillStyle = C.bedSheet;
      roundRect(ctx, bedX + 4, bedY + bedH * 0.35, bedW - 8, bedH * 0.5, 4);
      ctx.fill();
      // occupant dot (躺平)
      ctx.fillStyle = room.occupant === "player" ? "#1b3d32" : "#2a3142";
      ctx.beginPath();
      ctx.ellipse(bedX + bedW * 0.72, bedY + bedH * 0.55, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = room.occupant === "player" ? C.player : C.npc;
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`床${room.bed.level}`, bedX + bedW / 2, bedY - 4);
    }

    // slots
    for (let i = 0; i < b.slots.length; i++) {
      const s = b.slots[i];
      const selected = room.id === w.selectedRoomId && w.selectedSlot === i;
      ctx.fillStyle = C.slot;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = selected ? C.selected : C.slotStroke;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.stroke();

      const t = room.slots[i];
      if (t) {
        const def = TURRETS[t.type];
        ctx.fillStyle = def?.color || "#fff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0b0e14";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(def?.icon || "•", s.x, s.y);
        ctx.textBaseline = "alphabetic";
      } else if (room.occupant === "player" && room.alive) {
        ctx.fillStyle = "rgba(76,201,240,0.35)";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", s.x, s.y);
        ctx.textBaseline = "alphabetic";
      }
    }

    // door
    if (room.occupant) {
      const ratio = room.door.maxHp ? room.door.hp / room.door.maxHp : 0;
      const { doorX, doorY, doorW, doorH } = b;
      const dh = doorH * (0.35 + 0.65 * ratio);
      const dx = doorX - doorW / 2;
      const dy = room.row === 0 ? doorY - dh + 4 : doorY - 2;
      ctx.fillStyle = room.alive
        ? ratio > 0.35
          ? C.doorOk
          : C.doorDamaged
        : "#3a2430";
      roundRect(ctx, dx, dy, doorW, dh, 3);
      ctx.fill();
      ctx.strokeStyle = "#0b0e14";
      ctx.stroke();

      // hp pips
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(dx, dy + dh + 3, doorW, 3);
      ctx.fillStyle = ratio > 0.35 ? C.player : C.ghost;
      ctx.fillRect(dx, dy + dh + 3, doorW * Math.max(0, ratio), 3);
    }
  }

  // projectiles
  for (const p of w.projectiles) {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.kind === "cannon" ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(p.x - (p.tx - p.x) * 0.04, p.y - (p.ty - p.y) * 0.04);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.kind === "cannon" ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ghost
  if (w.ghost) drawGhost(ctx, w.ghost, w.time);

  // particles
  for (const p of w.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // floats
  ctx.textAlign = "center";
  ctx.font = "bold 13px sans-serif";
  for (const f of w.floats) {
    const a = Math.max(0, f.life / f.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  // select phase hints
  if (w.phase === "select") {
    ctx.fillStyle = "rgba(8,12,20,0.55)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = C.text;
    ctx.font = "600 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("点击一间空房，躺下开始发育", width / 2, height / 2 - 8);
    ctx.fillStyle = C.muted;
    ctx.font = "13px sans-serif";
    ctx.fillText("门破则出局 · 活过 5 夜即胜", width / 2, height / 2 + 18);
  }

  ctx.restore();
}

/** 命中测试：返回 {room, slotIndex} 或 null */
export function hitTest(w, x, y) {
  for (const room of w.rooms) {
    const b = room.box;
    if (!b) continue;
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
    for (let i = 0; i < b.slots.length; i++) {
      const s = b.slots[i];
      if (Math.hypot(x - s.x, y - s.y) <= s.r + 4) {
        return { room, slotIndex: i };
      }
    }
    return { room, slotIndex: -1 };
  }
  return null;
}
