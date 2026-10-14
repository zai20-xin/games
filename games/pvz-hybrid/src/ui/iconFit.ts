import Phaser from "phaser";

/** 贴图 icon 统一视觉框（内容主体最大边长 px） */
export const ICON_BOX = 36;

/** 贴图内容主体包围盒（贴图像素坐标），按贴图 key 缓存 */
const contentBoxCache = new Map<string, { cx: number; cy: number; w: number; h: number }>();

/**
 * 测量贴图不透明内容的包围盒（中心 + 宽高）。
 * 各植物贴图留白差异大（SVG 精修贴图松散、程序化纹理紧凑），
 * 按外框统一缩放必然"有的大有的小" → 以内容包围盒为准归一。
 */
export function contentBox(scene: Phaser.Scene, key: string): { cx: number; cy: number; w: number; h: number } {
  const cached = contentBoxCache.get(key);
  if (cached) return cached;
  const src = scene.textures.get(key).getSourceImage() as CanvasImageSource & {
    width: number;
    height: number;
  };
  const cv = document.createElement("canvas");
  cv.width = src.width;
  cv.height = src.height;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let minX = cv.width;
  let minY = cv.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if ((data[(y * cv.width + x) * 4 + 3] ?? 0) > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const box =
    maxX < 0
      ? { cx: cv.width / 2, cy: cv.height / 2, w: cv.width, h: cv.height }
      : { cx: (minX + maxX + 1) / 2, cy: (minY + maxY + 1) / 2, w: maxX - minX + 1, h: maxY - minY + 1 };
  contentBoxCache.set(key, box);
  return box;
}

/** 内容主体等比装入 ICON_BOX：返回缩放与内容中心相对贴图中心的偏移（显示 px） */
export function iconFit(scene: Phaser.Scene, key: string): { scale: number; offX: number; offY: number } {
  const tex = scene.textures.get(key);
  const src = tex.getSourceImage() as CanvasImageSource & { width: number; height: number };
  const box = contentBox(scene, key);
  const scale = Math.min(ICON_BOX / box.w, ICON_BOX / box.h);
  return {
    scale,
    offX: (box.cx - src.width / 2) * scale,
    offY: (box.cy - src.height / 2) * scale,
  };
}
