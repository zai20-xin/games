import { LEVEL_1_SIZE } from '../utils/constants';

export const LEVEL_1 = {
  key: 'level1',
  mapKey: 'level1-map',
  tilesetKey: 'level1-tileset',
  bgmKey: 'bgm-stage1',
  width: LEVEL_1_SIZE.width,
  height: LEVEL_1_SIZE.height,
  // 脚底锚点：y=104 = 13*8 是地面顶面像素，玩家一出生就站在地面上。
  playerSpawn: { x: 32, y: 104 },
  bossTrigger: { x: 2300, y: 0, width: 32, height: LEVEL_1_SIZE.height },
  bossConfig: { hp: 100 },
} as const;
