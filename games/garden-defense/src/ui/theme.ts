import type Phaser from "phaser";
import { W, H } from "../config";

export const C = {
  sky: 0xfff8f2,
  skyDeep: 0xf3ebe0,
  lawn: 0xa8d5a2,
  lawnAlt: 0x97c890,
  lawnEdge: 0x6aaa68,
  fence: 0xf7f2e8,
  fenceShade: 0xe8dfd0,
  panel: 0xfffcf7,
  panel2: 0xf3ebe0,
  ink: "#2F4A3E",
  ink2: "#5A7268",
  ink3: "#8A9A92",
  pollen: 0xf5c84c,
  pollenDeep: 0xd4a83a,
  heart: 0xe86b5c,
  heartSoft: 0xffc4bb,
  dew: 0x6ec8e0,
  sage: 0x8fbf8a,
  lav: 0xc4a8e8,
  ok: 0x6dbf7a,
  danger: 0xe86b5c,
  select: 0xffe08a,
} as const;

export const FONT = "'PingFang SC', 'Microsoft YaHei', 'Segoe UI', system-ui, sans-serif";

export function titleStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: "bold",
    color: C.ink,
    stroke: "#fffcf7",
    strokeThickness: Math.max(2, Math.round(size / 14)),
  };
}

export function bodyStyle(size: number, color: string = C.ink2): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
  };
}

export function hudStyle(size: number, color: string = C.ink): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: "bold",
    color,
  };
}

export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; alpha?: number; stroke?: number; radius?: number } = {}
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const radius = opts.radius ?? 16;
  const fill = opts.fill ?? C.panel;
  const alpha = opts.alpha ?? 0.96;
  const stroke = opts.stroke ?? 0xe0d4c4;
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(2, stroke, 0.9);
  g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, radius);
  g.lineStyle(1, 0xffffff, 0.55);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, Math.max(4, radius - 2));
  return g;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: { w?: number; h?: number; variant?: "honey" | "sage" | "blush" | "soft"; fontSize?: number } = {}
): Phaser.GameObjects.Container {
  const w = opts.w ?? 220;
  const h = opts.h ?? 56;
  const variant = opts.variant ?? "honey";
  const fills = {
    honey: { a: 0xf5c84c, b: 0xffe08a, s: 0xd4a83a },
    sage: { a: 0x8fbf8a, b: 0xc8e4c4, s: 0x5e8f5a },
    blush: { a: 0xf5a0b8, b: 0xffc4d4, s: 0xc47890 },
    soft: { a: 0xffe8dc, b: 0xfff6ee, s: 0xe0c4b0 },
  }[variant];
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(fills.a, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
  g.fillStyle(fills.b, 0.85);
  g.fillRoundedRect(-w / 2 + 8, -h / 2 + 4, w - 16, 18, 12);
  g.fillStyle(0xffffff, 0.28);
  g.fillRoundedRect(-w / 2 + 12, -h / 2 + 6, w - 24, 10, 8);
  g.lineStyle(3, fills.s, 0.9);
  g.strokeRoundedRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 16);
  g.lineStyle(1.5, 0xfffcf7, 0.85);
  g.strokeRoundedRect(-w / 2 + 4.5, -h / 2 + 4.5, w - 9, h - 9, 13);
  const t = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 18}px`,
      fontStyle: "bold",
      color: C.ink,
    })
    .setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on("pointerdown", () => {
    scene.tweens.add({ targets: c, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true });
    onClick();
  });
  return c;
}

export function drawSceneBackdrop(scene: Phaser.Scene): void {
  scene.add.rectangle(W / 2, H / 2, W, H, C.sky);
  const tile = scene.textures.get("wood_bg");
  if (tile && tile.key !== "__MISSING") {
    scene.add
      .tileSprite(W / 2, H / 2, W, H, "wood_bg")
      .setAlpha(0.55);
  }
}
