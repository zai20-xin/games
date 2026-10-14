import {
  chooseBuff,
  createWorld,
  occupyRoom,
  startSelect,
  step,
  tryBuildTurret,
  tryUpgradeBed,
  tryUpgradeDoor,
} from "./engine.js";
import { hitTest, render } from "./render.js";
import { bindBanner, bindUI } from "./ui.js";

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");

let w = createWorld("normal");
let ui = null;
let last = performance.now();
let pausedFrom = null;

// 触屏：禁止画布滚动抢手势
canvas.style.touchAction = "manipulation";
document.body.style.touchAction = "manipulation";

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, rect.width);
  const height = Math.max(280, rect.height);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  return { width, height, dpr };
}

let view = resize();
window.addEventListener("resize", () => {
  view = resize();
});

function cssPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches?.[0] || e.changedTouches?.[0] || e;
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

function onMapPointer(e) {
  if (e.cancelable) e.preventDefault();
  if (w.phase === "select") {
    const hit = hitTest(w, cssPoint(e).x, cssPoint(e).y);
    if (hit) occupyRoom(w, hit.room.id);
    return;
  }
  if (w.phase !== "day" && w.phase !== "night" && w.phase !== "pause") return;
  const p = cssPoint(e);
  const hit = hitTest(w, p.x, p.y);
  if (!hit) return;
  if (hit.room.occupant !== "player" || !hit.room.alive) {
    w.selectedRoomId = hit.room.id;
    w.selectedSlot = -1;
    return;
  }
  w.selectedRoomId = hit.room.id;
  w.selectedSlot = hit.slotIndex;
  if (hit.slotIndex >= 0 && !hit.room.slots[hit.slotIndex]) {
    tryBuildTurret(w, hit.slotIndex, w.selectedTurret);
  }
}

canvas.addEventListener("click", onMapPointer);
canvas.addEventListener(
  "touchend",
  (e) => {
    onMapPointer(e);
  },
  { passive: false }
);

const actions = {
  onStart(diff) {
    w = createWorld(diff);
    startSelect(w);
  },
  onRestart() {
    const diff = w.diff.id;
    w = createWorld(diff);
    startSelect(w);
  },
  onTitle() {
    w = createWorld(w.diff.id);
    w.phase = "title";
  },
  onUpgradeDoor() {
    tryUpgradeDoor(w);
  },
  onUpgradeBed() {
    tryUpgradeBed(w);
  },
  onBuild() {
    if (w.selectedSlot >= 0) tryBuildTurret(w, w.selectedSlot, w.selectedTurret);
  },
  onChooseBuff(id) {
    chooseBuff(w, id);
  },
  onTogglePause() {
    if (w.phase === "pause") {
      w.phase = pausedFrom || "day";
      pausedFrom = null;
    } else if (w.phase === "day" || w.phase === "night") {
      pausedFrom = w.phase;
      w.phase = "pause";
    }
  },
  onToggleMute() {
    w.muted = !w.muted;
  },
};

ui = bindUI(w, actions);

addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") actions.onRestart();
  if (e.key === "p" || e.key === "P" || e.key === "Escape") actions.onTogglePause();
  if (e.key === "m" || e.key === "M") actions.onToggleMute();
});

let audioCtx = null;
function beep(freq, dur = 0.05, type = "sine", gain = 0.03) {
  if (w.muted) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime;
    o.start(t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.stop(t0 + dur + 0.02);
  } catch {
    /* ignore */
  }
}

let lastPhase = w.phase;
let lastNight = w.night;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (w.phase !== "pause") step(w, dt);

  if (w.phase !== lastPhase) {
    if (w.phase === "night") beep(110, 0.18, "sawtooth", 0.04);
    if (w.phase === "buff") beep(520, 0.12, "triangle", 0.035);
    if (w.phase === "day" && lastPhase === "night") beep(520, 0.1, "triangle", 0.03);
    if (w.phase === "win") beep(660, 0.2, "triangle", 0.04);
    if (w.phase === "lose") beep(90, 0.3, "sawtooth", 0.04);
    lastPhase = w.phase;
  }
  if (w.night !== lastNight) {
    beep(180, 0.12, "square", 0.03);
    lastNight = w.night;
  }

  render(ctx, w, view.width, view.height, view.dpr);
  bindBanner(w);
  ui.frame(w);
  requestAnimationFrame(loop);
}

requestAnimationFrame((t) => {
  last = t;
  loop(t);
});
