import Phaser from "phaser";

export const PALETTE = [0xff5a5f, 0x4cc9f0, 0x7ae582, 0xffc043, 0xb388ff, 0xff8fab];

export const SHAPE_VERTICES: Record<number, [number, number][]> = {
  1: [[-0.82, -0.82], [0.82, -0.82], [0.82, 0.82], [-0.82, 0.82]],
  2: [[0, -0.95], [0.85, 0.5], [-0.85, 0.5]],
  3: [[0, -1], [0.9, 0], [0, 1], [-0.9, 0]],
  4: [[0, -1], [0.95, -0.31], [0.59, 0.81], [-0.59, 0.81], [-0.95, -0.31]],
  5: [[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]],
};

export const COMBO_WORDS: Record<number, string> = {
  2: "Good!",
  3: "Great!",
  4: "Amazing!",
};

export function comboWord(round: number): string {
  return COMBO_WORDS[round] ?? (round >= 5 ? "甜蜜狂欢!" : COMBO_WORDS[Math.min(round, 4)]);
}

// ---------------------------------------------------------------------------
// 集中式输入：所有按钮命中判定走同一条场景级指针管线，杜绝容器交互的浏览器差异
// ---------------------------------------------------------------------------

let current: Phaser.Scene | null = null;

interface ButtonRecord {
  seq: number;
  w: number;
  h: number;
  enabled: boolean;
  fire: () => void;
  setPressed: (v: boolean) => void;
  container: Phaser.GameObjects.Container;
}

const buttonRegistry: ButtonRecord[] = [];
const modalStack: number[] = [];
let pressedRec: ButtonRecord | null = null;
let seqCounter = 0;

const tmpPoint = new Phaser.Math.Vector2();

function sc(): Phaser.Scene {
  if (!current) throw new Error("UIKit.attachScene 未调用");
  return current;
}

function worldCenter(rec: ButtonRecord): Phaser.Math.Vector2 {
  rec.container.getWorldTransformMatrix().transformPoint(0, 0, tmpPoint);
  return tmpPoint;
}

function containsPointer(rec: ButtonRecord, screenX: number, screenY: number): boolean {
  const c = worldCenter(rec);
  const cam = current!.cameras.main;
  const sx = c.x - cam.scrollX * rec.container.scrollFactorX;
  const sy = c.y - cam.scrollY * rec.container.scrollFactorY;
  return Math.abs(screenX - sx) <= rec.w / 2 && Math.abs(screenY - sy) <= rec.h / 2;
}

function topAllowedButton(x: number, y: number): ButtonRecord | null {
  const modalSeq = modalStack.length > 0 ? modalStack[modalStack.length - 1] : -1;
  let hit: ButtonRecord | null = null;
  for (const rec of buttonRegistry) {
    if (!rec.enabled) continue;
    if (rec.seq <= modalSeq) continue;
    if (containsPointer(rec, x, y)) hit = rec;
  }
  return hit;
}

export function attachScene(scene: Phaser.Scene): void {
  current = scene;
  buttonRegistry.length = 0;
  modalStack.length = 0;
  pressedRec = null;
  seqCounter = 0;
  (window as unknown as Record<string, unknown>).__m3btn = () =>
    buttonRegistry.map((r) => {
      const c = worldCenter(r);
      return { seq: r.seq, x: Math.round(c.x), y: Math.round(c.y), w: r.w, h: r.h, enabled: r.enabled };
    });

  scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
    const ring = scene.add.circle(p.x, p.y, 6, 0xffffff, 0.9).setDepth(9999);
    scene.tweens.add({
      targets: ring,
      radius: 42,
      alpha: 0,
      duration: 320,
      onComplete: () => ring.destroy(),
    });
    pressedRec = topAllowedButton(p.x, p.y);
    if (pressedRec) {
      pressedRec.setPressed(true);
      pressedRec.container.setScale(0.93);
    }
  });

  const release = (p: Phaser.Input.Pointer) => {
    const rec = pressedRec;
    pressedRec = null;
    if (!rec) return;
    rec.setPressed(false);
    rec.container.setScale(1);
    if (rec.enabled && containsPointer(rec, p.x, p.y)) {
      rec.container.setScale(0.93);
      scene.tweens.add({
        targets: rec.container,
        scale: 1,
        duration: 180,
        ease: "Back.easeOut",
      });
      rec.fire();
    }
  };
  scene.input.on("pointerup", release);
  scene.input.on("pointerupoutside", release);
}

// ---------------------------------------------------------------------------
// 视觉组件
// ---------------------------------------------------------------------------

/** 深靛渐变 + 光斑 + 暗角纹理（一次生成复用）；mode=candy 时改亮粉糖果风（仅主菜单用） */
function backdropTexture(scene: Phaser.Scene, mode: "dark" | "candy" = "dark"): string {
  const key = mode === "candy" ? "backdrop-candy" : "backdrop";
  if (scene.textures.exists(key)) return key;
  const w = 360;
  const h = 640;
  const canvasTex = scene.textures.createCanvas(key, w, h)!;
  const ctx = canvasTex.getContext();
  const blob = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  if (mode === "candy") {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#ffeaf4");
    grad.addColorStop(1, "#ffd1e8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    blob(w * 0.2, h * 0.22, 200, "rgba(255,140,180,0.50)");
    blob(w * 0.82, h * 0.72, 180, "rgba(255,180,90,0.45)");
    blob(w * 0.55, h * 0.45, 160, "rgba(200,140,255,0.35)");
  } else {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, "#281845");
    grad.addColorStop(1, "#131234");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    blob(w * 0.25, h * 0.32, 190, "rgba(90,50,160,0.55)");
    blob(w * 0.8, h * 0.62, 170, "rgba(30,90,160,0.45)");
    blob(w * 0.58, h * 0.12, 150, "rgba(150,40,90,0.35)");
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.22, w / 2, h / 2, h * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }
  canvasTex.refresh();
  return key;
}

function dotTexture(scene: Phaser.Scene): string {
  const key = "softdot";
  if (scene.textures.exists(key)) return key;
  const size = 96;
  const canvasTex = scene.textures.createCanvas(key, size, size)!;
  const ctx = canvasTex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.75)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  canvasTex.refresh();
  return key;
}

export function makeBackdrop(scene: Phaser.Scene, mode: "dark" | "candy" = "dark"): void {
  const img = scene.add.image(360, 640, backdropTexture(scene, mode)).setDisplaySize(720, 1280);
  img.setScrollFactor(0).setDepth(-100);

  const tint = mode === "candy" ? 0xff9ec7 : 0xbfb7ff;
  const bubbles = scene.add.particles(0, 0, dotTexture(scene), {
    x: { min: 0, max: 720 },
    y: 1300,
    lifespan: 9000,
    speedY: { min: 26, max: 64 },
    speedX: { min: -12, max: 12 },
    scale: { min: 0.35, max: 1.15 },
    alpha: { start: 0.22, end: 0 },
    frequency: 700,
    tint,
  });
  bubbles.setScrollFactor(0).setDepth(-99);
}

export function panelStyle(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.fillStyle(0x171a2e, 0.94);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
  g.lineStyle(2, 0xffffff, 0.12);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
}

export function makePanel(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  depth = 100,
): Phaser.GameObjects.Container {
  const c = scene.add.container(centerX, centerY).setDepth(depth);
  const g = scene.add.graphics();
  panelStyle(g, width, height);
  c.add(g);
  return c;
}

export interface JuiceButton {
  container: Phaser.GameObjects.Container;
  setText(text: string): void;
  setEnabled(v: boolean): void;
}

export function makeButton(
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  onClick: () => void,
  fontSize = 26,
): JuiceButton {
  const sc_ = sc();
  const container = sc_.add.container(x, y);
  const bg = sc_.add.graphics();
  let enabled = true;

  const draw = (mode: "normal" | "hover" | "pressed" | "disabled") => {
    bg.clear();
    const colors: Record<string, [number, number]> = {
      normal: [0x323a68, 0xffffff],
      hover: [0x3e4880, 0xffffff],
      pressed: [0x272e54, 0xd8dcff],
      disabled: [0x22263f, 0x555c88],
    };
    const [fill, border] = colors[mode];
    bg.fillStyle(fill, enabled ? 0.98 : 0.85);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 18);
    bg.lineStyle(2, border, mode === "disabled" ? 0.15 : 0.16);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 18);
    if (enabled && mode !== "pressed") {
      bg.fillStyle(0x000000, 0.3);
      bg.fillRoundedRect(-width / 2 + 2, -height / 2 + 4, width - 4, height, 17);
      bg.fillStyle(fill, 0.98);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height - 3, 18);
      bg.lineStyle(2, border, 0.16);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 18);
    }
  };

  const label = sc_
    .add
    .text(0, 0, text, {
      fontSize: `${fontSize}px`,
      color: "#ffffff",
      fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      align: "center",
    })
    .setOrigin(0.5)
    .setLineSpacing(4);

  draw("normal");
  container.add([bg, label]);

  const rec: ButtonRecord = {
    seq: ++seqCounter,
    w: width,
    h: height,
    enabled: true,
    fire: () => onClick(),
    setPressed: (v: boolean) => draw(v ? "pressed" : "normal"),
    container,
  };
  buttonRegistry.push(rec);

  return {
    container,
    setText(t: string) {
      label.setText(t);
    },
    setEnabled(v: boolean) {
      enabled = v;
      rec.enabled = v;
      draw(v ? "normal" : "disabled");
      label.setAlpha(v ? 1 : 0.4);
    },
  };
}

/** 自绘控件的透明命中区（如地图节点），同样走集中式判定 */
export function registerHitZone(
  x: number,
  y: number,
  width: number,
  height: number,
  onClick: () => void,
): { setEnabled(v: boolean): void } {
  const rec: ButtonRecord = {
    seq: ++seqCounter,
    w: width,
    h: height,
    enabled: true,
    fire: onClick,
    setPressed: () => {},
    container: sc().add.container(x, y),
  };
  buttonRegistry.push(rec);
  return {
    setEnabled(v: boolean) {
      rec.enabled = v;
    },
  };
}

export function makeLabel(
  x: number,
  y: number,
  text: string,
  fontSize: number,
  color = "#ffffff",
): Phaser.GameObjects.Text {
  return sc()
    .add.text(x, y, text, {
      fontSize: `${fontSize}px`,
      color,
      fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
    })
    .setOrigin(0, 0);
}

/** 场景淡入黑幕 */
export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(280, 0, 0, 0);
}

/** 全屏遮罩 + 面板弹窗基座；打开期间屏蔽此前注册的按钮 */
export function makePopupBase(
  width: number,
  height: number,
): { panel: Phaser.GameObjects.Container; close(): void } {
  const scene = sc();
  const dim = scene.add.rectangle(360, 640, 720, 1280, 0x000000, 0.6).setDepth(90);
  const panel = makePanel(scene, 360, 640, width, height, 100);
  modalStack.push(seqCounter);
  const close = () => {
    modalStack.pop();
    dim.destroy();
    panel.destroy();
  };
  return { panel, close };
}

export const UIKit = {
  attach: attachScene,
  backdrop: (scene: Phaser.Scene, mode: "dark" | "candy" = "dark") => makeBackdrop(scene, mode),
  fade: () => {
    if (current) fadeIn(current);
  },
  button: makeButton,
  hitzone: registerHitZone,
  label: makeLabel,
  popup: makePopupBase,
};
