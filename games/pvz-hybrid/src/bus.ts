import Phaser from "phaser";

// 跨场景事件总线：GameScene <-> UiScene（独立模块，保证 config 可在 node 测试环境导入）
export const bus = new Phaser.Events.EventEmitter();
