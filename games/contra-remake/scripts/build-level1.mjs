// 用纯数据数组避免引入 Tiled 二进制依赖；M6 可替换为 .json
export const WIDTH = 320, HEIGHT = 15;
export function generateLevel1() {
  const arr = new Array(WIDTH * HEIGHT).fill(0);
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 13; y < HEIGHT; y++) arr[y * WIDTH + x] = 1;
  }
  // 几个平台（y=10..11 行），用脚底锚点摆放玩家/敌人时能直接读"y*8"作为脚底目标：
  //   - 第一平台 y=10 顶面 y=80：玩家一启动向右就能看到右边的 Grunt 站在这上面
  //   - 第二平台 y=9  顶面 y=72：稍高一点，让画面有 3 个高度节奏
  //   - 第三平台 y=11 顶面 y=88：低一点的跳台，鼓励连续跳跃
  for (let x = 30; x < 38; x++) arr[10 * WIDTH + x] = 1;
  for (let x = 60; x < 72; x++) arr[9 * WIDTH + x] = 1;
  for (let x = 110; x < 125; x++) arr[11 * WIDTH + x] = 1;
  return arr;
}
