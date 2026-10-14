// 资源清单。每个角色 tilesheet 是 720x330 RGBA，8 列 × 3 行 × 90×110 像素。
// 加载时由 BootScene 切成 24 帧（按从左到右、从上到下编号 0..23）。
// 动画/帧配置见 src/assets/spritesheets.ts。
//
// URL 必须以 Vite 的 BASE_URL 为前缀：dashboard 以 /g/<id>/ 前缀代理本游戏
// （GAME_BASE=/g/contra-remake/ → base 同值），裸绝对路径 /images/... 会 404。
// BASE_URL 自带结尾斜杠，两种部署形态（根路径 / 前缀路径）都正确。
const url = (rel: string): string => `${import.meta.env.BASE_URL}${rel}`;

export const ASSETS = {
  images: {
    'player-ts':     url('images/player_tilesheet.png'),
    'soldier-ts':    url('images/soldier_tilesheet.png'),
    'adventurer-ts': url('images/adventurer_tilesheet.png'),
    'zombie-ts':     url('images/zombie_tilesheet.png'),
    'dungeon':       url('images/dungeon_tiles.png'),
    'bullet-player': url('images/bullet_player.png'),
    'bullet-enemy':  url('images/bullet_enemy.png'),
    'powerup':       url('images/powerup.png'),
  },
  audio: {
    'sfx-fire':  url('audio/fire.ogg'),
    'sfx-hit':   url('audio/hit.ogg'),
    'bgm-1':     url('audio/stage1.wav'),
  },
} as const;
