import Phaser from 'phaser';

/**
 * 地面 tile 尺寸与 dungeon atlas 像素尺寸。
 *   - 逻辑地图每格 8 像素（保持原关卡数据粒度）
 *   - Kenney Tiny Dungeon atlas 每格 16 像素
 *   - 因此渲染时需要 setScale(0.5) 把 16x16 缩到 8x8
 */
const TILE_SIZE = 8;
const TILE_PX = 16;

/**
 * Kenney Tiny Dungeon 泥土 tile（atlas 内第 24 格），最贴合"丛林"主题，
 * 用作关卡最常见的可走地面。
 */
const DUNGEON_TILE_IDX = 24;

/**
 * 在场景里绘制地面图块并为每个非 0 图块生成一个静态物理体。
 *
 * 视觉：每个 solid tile 用 Kenney Tiny Dungeon atlas 中 idx=24（泥土）贴图渲染。
 * 物理：对每一行连续的实心 tile 合并为一个矩形 physics body，把物理体数量从
 *       ~320 减到 ~4 段，物理步进更快；视觉与物理仍按 8x8 像素对齐。
 *
 * 返回：{ graphics, bodies }
 *   - graphics: 视觉 tile 数组（image 列表），调用方可按需销毁
 *   - bodies:   staticGroup，可被 `physics.add.collider(player, bodies)` 直接使用
 */
export function buildGroundTiles(
  scene: Phaser.Scene,
  data: number[],
  width: number,
  tileSize = TILE_SIZE
): { graphics: Phaser.GameObjects.GameObject[]; bodies: Phaser.Physics.Arcade.StaticGroup } {
  // 1) 视觉绘制：用 atlas 中的泥土 tile 替换纯色矩形
  const tiles: Phaser.GameObjects.GameObject[] = [];
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] !== 1) continue;
      // 16x16 atlas tile 缩放到 8x8 区域（setScale(0.5)）
      const tile = scene.add
        .image(x * tileSize, y * tileSize, 'dungeon', DUNGEON_TILE_IDX)
        .setOrigin(0, 0)
        .setScale(tileSize / TILE_PX);
      tiles.push(tile);
    }
  }

  // 2) 物理 body：每行合并连续区间（保持原有逻辑）
  const bodies = scene.physics.add.staticGroup();
  for (let y = 0; y < 15; y++) {
    let runStart = -1;
    for (let x = 0; x <= width; x++) {
      const solid = x < width && data[y * width + x] === 1;
      if (solid && runStart < 0) {
        runStart = x;
      } else if (!solid && runStart >= 0) {
        const runLen = x - runStart;
        const rx = runStart * tileSize;
        const ry = y * tileSize;
        const rw = runLen * tileSize;
        const rh = tileSize;
        // 用不可见的 rectangle 作为可视占位，再 add.existing 到 staticGroup
        const rect = scene.add.rectangle(rx, ry, rw, rh, 0x000000, 0).setOrigin(0, 0);
        rect.setVisible(false);
        scene.physics.add.existing(rect, true); // true => static body
        bodies.add(rect);
        runStart = -1;
      }
    }
  }

  return { graphics: tiles, bodies };
}
