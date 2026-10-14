// ================================================================
// 像素 Sprite 数据 + 加载 + 缓存
//
// 真实素材来源：FreeGameSprites.com (CC0 公共领域)
//   - lightningBolt: https://freegamesprites.com/en/assets/thunder-crack-effect
//     原图 8×12 像素，4× 放大到 32×48，存放在 public/assets/effects/lightning-bolt.png
//     包含 2 色：黄色（主色）+ 蓝色（电晕）
//     3 帧动画通过运行时 scale + alpha + 颜色叠加实现
//
//   - sparkBurst: 程序化生成（暂无合适 CC0 资源，使用自定义 24×24 风格）
// ================================================================

export const PIXEL_COLORS = {
  '.': null,
  'W': '#ffffff',
  'Y': '#ffe066',
  'O': '#ff9933',
  'B': '#5b9eff',
  'b': '#2b5fb8',
  'C': '#aef0ff',
};

/**
 * 3 帧冲击光斑 (24x24)，用于第一击（比 chain 节点更亮）
 * 保留程序化实现 - 暂无合适的 CC0 替代
 */
const SPARK_BURST_FRAMES = [
  // Frame 0
  [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........Y............',
    '..........YYY...........',
    '.........YYWY...........',
    '..........YYY...........',
    '...........Y............',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  // Frame 1
  [
    '........................',
    '..............Y.........',
    '.............YYY........',
    '............YWWWY.......',
    '...........YWCWWY.......',
    '..........YWCCCWY.......',
    '..........YWCCCWY.......',
    '..........YWCCCWY.......',
    '..........YWCCCWY.......',
    '..........YWCCCWY.......',
    '..........YWCCCWY.......',
    '..........YWCCCWY.......',
    '...........YWCWWY.......',
    '............YWWWY.......',
    '.............YYY........',
    '..............Y.........',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  // Frame 2
  [
    '..............Y.........',
    '.............YYY........',
    '............YOOOY.......',
    '...........YOWWOY.......',
    '..........YOWWWWOY......',
    '.........YOWBCCBWOY.....',
    '........YOWBCCCCBWOY....',
    '........YOWBCCCCBWOY....',
    '........YOWBCCCCBWOY....',
    '.......YOWBCCCCCCBWOY...',
    '.......YOWBCCCCCCBWOY...',
    '.......YOWBCCCCCCBWOY...',
    '.......YOWBCCCCCCBWOY...',
    '........YOWBCCCCBWOY....',
    '........YOWBCCCCBWOY....',
    '........YOWBCCCCBWOY....',
    '.........YOWBCCBWOY.....',
    '..........YOWWWWOY......',
    '...........YOWWOY.......',
    '............YOOOY.......',
    '.............YYY........',
    '..............Y.........',
    '........................',
    '........................',
  ],
];

/** sprite 注册表 */
const SPRITE_DEFS = {
  // 真实 PNG（FreeGameSprites CC0 雷电）
  'lightningBolt': { type: 'image', url: 'assets/effects/lightning-bolt.png' },
  // 程序化多帧
  'sparkBurst': { type: 'procedural', frames: SPARK_BURST_FRAMES },
};

/** 缓存：spriteName -> { frames, width, height, frameCount, type } */
const _cache = new Map();

/**
 * 异步加载 sprite
 * @param {string} name
 * @returns {Promise<{frames, width, height, frameCount, type} | null>}
 */
export async function loadPixelSprite(name) {
  if (_cache.has(name)) return _cache.get(name);

  const def = SPRITE_DEFS[name];
  if (!def) {
    console.warn(`[PixelSprites] Unknown sprite: ${name}`);
    return null;
  }

  let cached = null;

  if (def.type === 'image') {
    // 真实 PNG：用 Image 加载后画到离屏 canvas
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = def.url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    cached = {
      frames: [canvas],
      width: img.naturalWidth,
      height: img.naturalHeight,
      frameCount: 1,
      type: 'image',
    };
  } else if (def.type === 'procedural') {
    // 程序化：每帧一个 canvas
    const width = def.frames[0][0].length;
    const height = def.frames[0].length;
    const frames = [];
    for (let f = 0; f < def.frames.length; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const frame = def.frames[f];
      for (let y = 0; y < height; y++) {
        const row = frame[y];
        for (let x = 0; x < width; x++) {
          const ch = row[x];
          const color = PIXEL_COLORS[ch];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      frames.push(canvas);
    }
    cached = { frames, width, height, frameCount: frames.length, type: 'procedural' };
  }

  _cache.set(name, cached);
  return cached;
}

/**
 * 同步获取 sprite（如果未加载完则返回 null，调用方需重试）
 * 用于游戏主循环（每帧调用），配合 preload 预加载
 */
export function getPixelSprite(name) {
  return _cache.get(name) || null;
}

/**
 * 预加载所有 sprite（游戏启动时调用一次）
 * @returns {Promise<void>}
 */
export async function preloadAllPixelSprites() {
  const names = Object.keys(SPRITE_DEFS);
  await Promise.all(names.map(n => loadPixelSprite(n)));
}

/**
 * 清理缓存
 */
export function clearPixelSpriteCache() {
  _cache.clear();
}
