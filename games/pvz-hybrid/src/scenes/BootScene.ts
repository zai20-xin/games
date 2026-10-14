import Phaser from "phaser";

const IMAGES: [string, string][] = [
  ["peashooter", "assets/plants/peashooter.png"],
  ["peashooter_weak", "assets/plants/peashooter_weak.png"],
  ["peashooter_super", "assets/plants/peashooter_super.png"],
  ["snowpea", "assets/plants/snowpea.png"],
  ["snowpea_weak", "assets/plants/snowpea_weak.png"],
  ["snowpea_super", "assets/plants/snowpea_super.png"],
  ["repeater", "assets/plants/repeater.png"],
  ["repeater_weak", "assets/plants/repeater_weak.png"],
  ["repeater_super", "assets/plants/repeater_super.png"],
  ["threepeater", "assets/plants/threepeater.png"],
  ["threepeater_weak", "assets/plants/threepeater_weak.png"],
  ["threepeater_super", "assets/plants/threepeater_super.png"],
  ["wallnut", "assets/plants/wallnut.png"],
  ["wallnut_cracked", "assets/plants/wallnut_cracked.png"],
  ["cherrybomb", "assets/plants/cherrybomb.png"],
  ["potatomine", "assets/plants/potatomine.png"],
  ["jalapeno", "assets/plants/jalapeno.png"],
  ["cactus", "assets/plants/cactus.png"],
  ["spikeweed", "assets/plants/spikeweed.png"],
  ["flakcannon", "assets/plants/flakcannon.png"],
  ["cactusball", "assets/plants/cactusball.png"],
  ["fireflower", "assets/plants/fireflower.png"],
  ["zombie", "assets/zombies/zombie.png"],
  ["zombie_cone", "assets/zombies/zombie_cone.png"],
  ["zombie_bucket", "assets/zombies/zombie_bucket.png"],
  ["zombie_flag", "assets/zombies/zombie_flag.png"],
  ["zombie_giant", "assets/zombies/zombie_giant.png"],
  ["zombie_dancer", "assets/zombies/zombie_dancer.png"],
  ["zombie_digger", "assets/zombies/zombie_digger.png"],
  ["zombie_balloon", "assets/zombies/zombie_balloon.png"],
  ["zombie_catapult", "assets/zombies/zombie_catapult.png"],
  ["pea", "assets/misc/pea.png"],
  ["icepea", "assets/misc/icepea.png"],
  ["mower", "assets/misc/mower.png"],
  ["shovel", "assets/misc/shovel.png"],
  ["boom", "assets/misc/boom.png"],
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const [key, file] of IMAGES) this.load.image(key, file);
  }

  create(): void {
    const g = this.add.graphics();

    // 卡片底：优化版（更丰富的细节和层次感）
    g.fillStyle(0xd8c9a3, 1);
    g.fillRoundedRect(0, 0, 64, 86, 8);
    // 高光
    g.fillStyle(0xf0e6d2, 0.6);
    g.fillRoundedRect(4, 4, 56, 20, 6);
    // 木纹纹理
    g.fillStyle(0xc4b08a, 0.4);
    g.fillRect(6, 30, 52, 2);
    g.fillRect(8, 40, 48, 1);
    g.fillRect(6, 50, 52, 1);
    g.fillRect(8, 60, 48, 1);
    // 底部阴影
    g.fillStyle(0x8a7a5a, 0.3);
    g.fillRoundedRect(4, 70, 56, 12, 4);
    // 描边
    g.lineStyle(3, 0x5a4630, 1);
    g.strokeRoundedRect(1.5, 1.5, 61, 83, 8);
    // 外发光
    g.lineStyle(1, 0xf0e6d2, 0.3);
    g.strokeRoundedRect(0, 0, 64, 86, 8);
    g.generateTexture("card", 64, 86);
    g.clear();

    // 铲子槽底：优化版（更丰富的细节和层次感）
    g.clear();
    g.fillGradientStyle(0xcdbb92, 0xe6d3a8, 0xb89c6e, 0x9c825c, 1);
    g.fillRoundedRect(0, 0, 56, 86, 8);
    // 木纹纹理
    g.fillStyle(0xb8a07a, 0.4);
    g.fillRect(4, 30, 48, 2);
    g.fillRect(6, 40, 44, 1);
    g.fillRect(4, 50, 48, 1);
    g.fillRect(6, 60, 44, 1);
    // 顶部高光
    g.fillStyle(0xffffff, 0.32);
    g.fillRoundedRect(4, 4, 48, 20, 6);
    // 底部阴影
    g.fillStyle(0x7a5c34, 0.3);
    g.fillRoundedRect(4, 70, 48, 12, 4);
    // 描边
    g.lineStyle(3, 0x8a6b45, 1);
    g.strokeRoundedRect(1.5, 1.5, 53, 83, 8);
    g.lineStyle(1.5, 0xfff3d9, 0.7);
    g.strokeRoundedRect(4, 4, 48, 78, 6);
    // 外发光
    g.lineStyle(1, 0xe6d3a8, 0.3);
    g.strokeRoundedRect(0, 0, 56, 86, 8);
    g.generateTexture("shovel_slot", 56, 86);
    g.clear();

    // 传送带卡槽：优化版（更丰富的细节和层次感）
    g.fillGradientStyle(0xfdf6e6, 0xf8ecd0, 0xe9d3a6, 0xd7bc8f, 1);
    g.fillRoundedRect(0, 0, 64, 88, 12);
    // 磨砂斜纹（横向细线，营造木纹/瓷釉质感）
    g.fillStyle(0xffffff, 0.1);
    for (let sy = 30; sy < 86; sy += 10) g.fillRect(6, sy, 52, 2);
    // 底部内影，提升立体
    g.fillStyle(0x7a5c34, 0.14);
    g.fillRect(4, 79, 56, 7);
    // 顶部瓷釉高光
    g.fillStyle(0xffffff, 0.5);
    g.fillRoundedRect(4, 4, 56, 20, 9);
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(32, 10, 34, 8);
    // 中部高光
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(8, 30, 48, 10, 4);
    // 双层描边：外深内亮
    g.lineStyle(3, 0xb3945f, 1);
    g.strokeRoundedRect(1.5, 1.5, 61, 85, 12);
    g.lineStyle(2, 0xfff9ec, 1);
    g.strokeRoundedRect(4.5, 4.5, 55, 79, 9);
    // 外发光
    g.lineStyle(1, 0xfdf6e6, 0.3);
    g.strokeRoundedRect(0, 0, 64, 88, 12);
    g.generateTexture("belt_tile", 64, 88);
    g.clear();

    // 按钮：优化版（更丰富的细节和层次感）
    g.fillGradientStyle(0xffce4f, 0xffce4f, 0xd69a18, 0x9c6b0c, 1);
    g.fillRoundedRect(0, 0, 200, 56, 12);
    // 高光
    g.fillStyle(0xffe9a8, 0.85);
    g.fillRoundedRect(7, 4, 186, 20, 10);
    g.fillEllipse(100, 8, 168, 14);
    // 中部高光
    g.fillStyle(0xffec8b, 0.4);
    g.fillRoundedRect(10, 24, 180, 8, 4);
    // 底部阴影
    g.fillStyle(0x5c3c08, 0.5);
    g.fillRect(7, 46, 186, 5);
    // 描边
    g.lineStyle(4, 0x6b4512, 1);
    g.strokeRoundedRect(2, 2, 196, 52, 12);
    g.lineStyle(2, 0xfff3d0, 0.95);
    g.strokeRoundedRect(5, 5, 190, 46, 10);
    // 外发光
    g.lineStyle(1, 0xffe9a8, 0.3);
    g.strokeRoundedRect(0, 0, 200, 56, 12);
    g.generateTexture("btn", 200, 56);
    g.destroy();

    // 特效纹理：优化版（更丰富的细节和层次感）
    const fx = this.add.graphics();
    // 圆点
    fx.fillStyle(0xffffff, 1);
    fx.fillCircle(4, 4, 4);
    fx.fillStyle(0xffffff, 0.6);
    fx.fillCircle(3, 3, 2);
    fx.generateTexture("dot", 8, 8);
    fx.clear();
    // 扩散环
    fx.lineStyle(7, 0xffffff, 1);
    fx.strokeCircle(48, 48, 44);
    fx.lineStyle(4, 0xffffff, 0.6);
    fx.strokeCircle(48, 48, 48);
    fx.lineStyle(2, 0xffffff, 0.3);
    fx.strokeCircle(48, 48, 52);
    fx.generateTexture("ring", 96, 96);
    fx.clear();
    // 烧痕
    fx.fillStyle(0xffffff, 1);
    fx.fillEllipse(64, 32, 120, 52);
    fx.fillStyle(0xffffff, 0.6);
    fx.fillEllipse(64, 30, 100, 40);
    fx.fillStyle(0xffffff, 0.3);
    fx.fillEllipse(64, 28, 80, 30);
    fx.generateTexture("scorch", 128, 64);
    fx.clear();
    // 火团
    fx.fillStyle(0xffffff, 1);
    fx.fillCircle(8, 8, 8);
    fx.fillCircle(4, 5, 5);
    fx.fillCircle(11, 5, 5);
    fx.fillStyle(0xffffff, 0.6);
    fx.fillCircle(7, 7, 5);
    fx.fillStyle(0xffffff, 0.3);
    fx.fillCircle(6, 6, 3);
    fx.generateTexture("flame", 16, 16);
    fx.clear();
    // 融合变体光环：金色圆环（super tier 脉冲用）
    fx.lineStyle(6, 0xffd94d, 0.8);
    fx.strokeCircle(48, 48, 42);
    fx.lineStyle(4, 0xffd94d, 0.5);
    fx.strokeCircle(48, 48, 46);
    fx.lineStyle(2, 0xffd94d, 0.3);
    fx.strokeCircle(48, 48, 50);
    fx.generateTexture("aura_gold", 96, 96);
    fx.clear();
    fx.lineStyle(5, 0x9fe8ff, 0.7);
    fx.strokeCircle(44, 44, 40);
    fx.lineStyle(3, 0x9fe8ff, 0.4);
    fx.strokeCircle(44, 44, 44);
    fx.lineStyle(1, 0x9fe8ff, 0.2);
    fx.strokeCircle(44, 44, 48);
    fx.generateTexture("aura_ice", 88, 88);
    fx.clear();
    // 形态弹丸光环：火焰/灵魂/毒素/裂隙
    fx.lineStyle(4, 0xff6b3d, 0.7);
    fx.strokeCircle(44, 44, 38);
    fx.lineStyle(2, 0xff6b3d, 0.4);
    fx.strokeCircle(44, 44, 42);
    fx.lineStyle(1, 0xff6b3d, 0.2);
    fx.strokeCircle(44, 44, 46);
    fx.generateTexture("aura_fire", 88, 88);
    fx.clear();
    fx.lineStyle(4, 0xc9a0ff, 0.7);
    fx.strokeCircle(44, 44, 38);
    fx.lineStyle(2, 0xc9a0ff, 0.4);
    fx.strokeCircle(44, 44, 42);
    fx.lineStyle(1, 0xc9a0ff, 0.2);
    fx.strokeCircle(44, 44, 46);
    fx.generateTexture("aura_soul", 88, 88);
    fx.clear();
    fx.lineStyle(4, 0x7ddf64, 0.6);
    fx.strokeCircle(44, 44, 38);
    fx.lineStyle(2, 0x7ddf64, 0.3);
    fx.strokeCircle(44, 44, 42);
    fx.lineStyle(1, 0x7ddf64, 0.15);
    fx.strokeCircle(44, 44, 46);
    fx.generateTexture("aura_toxic", 88, 88);
    fx.clear();
    fx.lineStyle(4, 0xff4444, 0.7);
    fx.strokeCircle(44, 44, 38);
    fx.lineStyle(2, 0xff4444, 0.4);
    fx.strokeCircle(44, 44, 42);
    fx.lineStyle(1, 0xff4444, 0.2);
    fx.strokeCircle(44, 44, 46);
    fx.generateTexture("aura_rift", 88, 88);
    fx.destroy();

    // Repeater / Three-peater：由 assets-src/svg 渲染的 PNG（见 render-assets.mjs），不再是程序化生成

    // Tall-nut：高坚果（优化版 - 更丰富的细节和层次感）
    const tn = this.add.graphics();
    // 主体阴影
    tn.fillStyle(0x5c4228, 1);
    tn.fillRoundedRect(16, 6, 52, 78, 12);
    // 主体
    tn.fillStyle(0xa07840, 1);
    tn.fillRoundedRect(14, 4, 52, 76, 10);
    // 顶部高光
    tn.fillStyle(0xc49a5c, 0.6);
    tn.fillRoundedRect(18, 8, 44, 20, 8);
    // 木纹纹理
    tn.fillStyle(0x8a6832, 0.4);
    tn.fillRect(20, 30, 40, 3);
    tn.fillRect(22, 40, 36, 2);
    tn.fillRect(18, 50, 44, 2);
    // 脸部区域
    tn.fillStyle(0x8a6832, 1);
    tn.fillRoundedRect(20, 12, 40, 28, 8);
    // 眼睛
    tn.fillStyle(0xffffff, 0.95);
    tn.fillCircle(32, 24, 6);
    tn.fillCircle(50, 24, 6);
    tn.fillStyle(0x1a1a1a, 1);
    tn.fillCircle(32, 24, 3);
    tn.fillCircle(50, 24, 3);
    // 眉毛
    tn.lineStyle(2, 0x5c4228, 0.8);
    tn.lineBetween(26, 18, 38, 20);
    tn.lineBetween(44, 20, 56, 18);
    // 嘴巴
    tn.lineStyle(2, 0x5c4228, 0.7);
    tn.beginPath();
    tn.arc(41, 34, 8, 0.3, Math.PI - 0.3);
    tn.strokePath();
    // 描边
    tn.lineStyle(4, 0x6b4a2b, 1);
    tn.strokeRoundedRect(16, 6, 48, 72, 10);
    // 外发光
    tn.lineStyle(2, 0xc49a5c, 0.3);
    tn.strokeRoundedRect(12, 2, 56, 80, 12);
    tn.generateTexture("tallnut", 80, 84);
    tn.destroy();

    // 大嘴花：优化版（更丰富的细节和层次感）
    const ch = this.add.graphics();
    // 茎管阴影
    ch.fillStyle(0x1a5c14, 1);
    ch.fillRoundedRect(18, 8, 48, 78, 12);
    // 茎管
    ch.fillStyle(0x2e7a28, 1);
    ch.fillRoundedRect(16, 6, 48, 78, 12);
    // 茎管纹理
    ch.fillStyle(0x3a8a32, 0.4);
    ch.fillRect(20, 20, 40, 3);
    ch.fillRect(22, 35, 36, 2);
    ch.fillRect(18, 50, 44, 2);
    ch.fillRect(20, 65, 40, 2);
    // 下颚球阴影
    ch.fillStyle(0x2a7a24, 1);
    ch.fillCircle(42, 58, 26);
    // 下颚球
    ch.fillStyle(0x3f9a37, 1);
    ch.fillCircle(40, 56, 26);
    // 下颚高光
    ch.fillStyle(0x58bb4a, 0.5);
    ch.fillEllipse(36, 50, 16, 10);
    // 头冠阴影
    ch.fillStyle(0x3a8a32, 1);
    ch.fillCircle(42, 26, 24);
    // 头冠
    ch.fillStyle(0x58bb4a, 1);
    ch.fillCircle(40, 24, 24);
    // 头冠高光
    ch.fillStyle(0x7acc6a, 0.6);
    ch.fillEllipse(36, 18, 14, 8);
    // 上排牙
    ch.fillStyle(0xffffff, 1);
    ch.fillTriangle(34, 22, 38, 30, 30, 30);
    ch.fillTriangle(44, 22, 48, 30, 40, 30);
    // 下排牙
    ch.fillTriangle(34, 92, 38, 84, 30, 84);
    ch.fillTriangle(44, 92, 48, 84, 40, 84);
    // 牙齿高光
    ch.fillStyle(0xffffff, 0.4);
    ch.fillTriangle(35, 23, 37, 28, 31, 28);
    ch.fillTriangle(45, 23, 47, 28, 41, 28);
    // 眼睛
    ch.fillStyle(0xffffff, 0.95);
    ch.fillCircle(34, 20, 5);
    ch.fillCircle(46, 20, 5);
    ch.fillStyle(0x1a1a1a, 1);
    ch.fillCircle(34, 20, 2.5);
    ch.fillCircle(46, 20, 2.5);
    // 嘴巴内部
    ch.fillStyle(0x8b0000, 0.8);
    ch.fillEllipse(40, 60, 20, 12);
    // 描边
    ch.lineStyle(3, 0x1f5c19, 1);
    ch.strokeEllipse(40, 56, 52, 30);
    // 外发光
    ch.lineStyle(2, 0x58bb4a, 0.3);
    ch.strokeEllipse(40, 56, 56, 34);
    ch.generateTexture("chomper", 84, 108);
    ch.destroy();

    // 冰西瓜：优化版（更丰富的细节和层次感）
    const wm = this.add.graphics();
    // 主体阴影
    wm.fillStyle(0x2a6aa8, 1);
    wm.fillCircle(42, 42, 32);
    // 主体
    wm.fillStyle(0x3f8fd6, 1);
    wm.fillCircle(40, 40, 32);
    // 高光
    wm.fillStyle(0x6ab4e8, 0.6);
    wm.fillEllipse(32, 30, 16, 10);
    wm.fillStyle(0x88ccff, 0.4);
    wm.fillEllipse(28, 26, 10, 6);
    // 冰霜纹理
    wm.fillStyle(0xdff4ff, 0.9);
    wm.fillEllipse(26, 26, 18, 10);
    wm.fillEllipse(52, 50, 14, 8);
    wm.fillEllipse(34, 58, 10, 6);
    // 冰晶点缀
    wm.fillStyle(0xffffff, 0.6);
    wm.fillCircle(30, 28, 3);
    wm.fillCircle(48, 45, 2);
    wm.fillCircle(32, 52, 2);
    // 藤蔓
    wm.fillStyle(0x2a5c1e, 1);
    wm.fillTriangle(40, 4, 34, 14, 46, 14);
    wm.lineStyle(2, 0x1a4a14, 1);
    wm.lineBetween(40, 8, 40, 2);
    // 描边
    wm.lineStyle(4, 0x2a6aa8, 1);
    wm.strokeCircle(40, 40, 32);
    // 外发光
    wm.lineStyle(2, 0x88ccff, 0.3);
    wm.strokeCircle(40, 40, 36);
    wm.generateTexture("wintermelon", 80, 80);
    wm.destroy();

    // 冰西瓜弹丸（优化版 - 小号蓝瓜）
    const ml = this.add.graphics();
    // 主体阴影
    ml.fillStyle(0x2a6aa8, 1);
    ml.fillCircle(17, 17, 14);
    // 主体
    ml.fillStyle(0x4a9fe0, 1);
    ml.fillCircle(16, 16, 14);
    // 高光
    ml.fillStyle(0x6ab4e8, 0.6);
    ml.fillEllipse(12, 12, 8, 5);
    // 冰霜
    ml.fillStyle(0xdff4ff, 0.9);
    ml.fillEllipse(10, 10, 9, 5);
    // 冰晶
    ml.fillStyle(0xffffff, 0.5);
    ml.fillCircle(11, 9, 2);
    // 描边
    ml.lineStyle(2, 0x2a6aa8, 1);
    ml.strokeCircle(16, 16, 14);
    // 外发光
    ml.lineStyle(1, 0x88ccff, 0.3);
    ml.strokeCircle(16, 16, 16);
    ml.generateTexture("melon", 32, 32);
    ml.destroy();

    // 仙人掌：优化版（更丰富的细节和层次感）
    const ct = this.add.graphics();
    // 主体阴影
    ct.fillStyle(0x1a6b1a, 1);
    ct.fillCircle(42, 42, 28);
    // 主体
    ct.fillStyle(0x228b22, 1);
    ct.fillCircle(40, 40, 28);
    // 内部
    ct.fillStyle(0x32cd32, 0.9);
    ct.fillCircle(40, 40, 18);
    // 高光
    ct.fillStyle(0x58d858, 0.6);
    ct.fillEllipse(34, 34, 12, 8);
    // 尖刺
    ct.fillStyle(0x90ee90, 1);
    ct.fillTriangle(40, 8, 36, 18, 44, 18);
    ct.fillTriangle(40, 72, 36, 62, 44, 62);
    ct.fillTriangle(8, 40, 18, 36, 18, 44);
    ct.fillTriangle(72, 40, 62, 36, 62, 44);
    // 尖刺高光
    ct.fillStyle(0xb8f0b8, 0.6);
    ct.fillTriangle(40, 10, 38, 16, 42, 16);
    ct.fillTriangle(40, 70, 38, 64, 42, 64);
    ct.fillTriangle(10, 40, 16, 38, 16, 42);
    ct.fillTriangle(70, 40, 64, 38, 64, 42);
    // 眼睛
    ct.fillStyle(0xffffff, 0.95);
    ct.fillCircle(34, 36, 4);
    ct.fillCircle(46, 36, 4);
    ct.fillStyle(0x1a1a1a, 1);
    ct.fillCircle(34, 36, 2);
    ct.fillCircle(46, 36, 2);
    // 嘴巴
    ct.lineStyle(2, 0x1a1a1a, 0.8);
    ct.beginPath();
    ct.arc(40, 46, 6, 0.2, Math.PI - 0.2);
    ct.strokePath();
    // 描边
    ct.lineStyle(3, 0x1a6b1a, 1);
    ct.strokeCircle(40, 40, 28);
    // 外发光
    ct.lineStyle(2, 0x58d858, 0.3);
    ct.strokeCircle(40, 40, 32);
    ct.generateTexture("cactus", 80, 80);
    ct.destroy();

    // 地刺：优化版（更丰富的细节和层次感）
    const sw = this.add.graphics();
    // 主体阴影
    sw.fillStyle(0x5c3a1f, 1);
    sw.fillEllipse(42, 52, 60, 20);
    // 主体
    sw.fillStyle(0x8b4513, 1);
    sw.fillEllipse(40, 50, 60, 20);
    // 内部
    sw.fillStyle(0xcd853f, 0.9);
    sw.fillEllipse(40, 48, 40, 12);
    // 高光
    sw.fillStyle(0xdaa520, 0.6);
    sw.fillEllipse(36, 46, 20, 6);
    // 尖刺
    sw.fillStyle(0xdaa520, 1);
    sw.fillTriangle(20, 40, 18, 30, 22, 30);
    sw.fillTriangle(40, 35, 38, 25, 42, 25);
    sw.fillTriangle(60, 40, 58, 30, 62, 30);
    // 尖刺高光
    sw.fillStyle(0xf0c060, 0.6);
    sw.fillTriangle(20, 38, 19, 32, 21, 32);
    sw.fillTriangle(40, 33, 39, 27, 41, 27);
    sw.fillTriangle(60, 38, 59, 32, 61, 32);
    // 眼睛
    sw.fillStyle(0xffffff, 0.95);
    sw.fillCircle(34, 46, 3);
    sw.fillCircle(46, 46, 3);
    sw.fillStyle(0x1a1a1a, 1);
    sw.fillCircle(34, 46, 1.5);
    sw.fillCircle(46, 46, 1.5);
    // 描边
    sw.lineStyle(2, 0x5c3a1f, 1);
    sw.strokeEllipse(40, 50, 60, 20);
    // 外发光
    sw.lineStyle(1, 0xdaa520, 0.3);
    sw.strokeEllipse(40, 50, 64, 24);
    sw.generateTexture("spikeweed", 80, 60);
    sw.destroy();

    // 高射炮：优化版（更丰富的细节和层次感）
    const fc = this.add.graphics();
    // 底座阴影
    fc.fillStyle(0x3a3a3a, 1);
    fc.fillRoundedRect(12, 32, 60, 40, 8);
    // 底座
    fc.fillStyle(0x696969, 1);
    fc.fillRoundedRect(10, 30, 60, 40, 8);
    // 内部
    fc.fillStyle(0x808080, 0.9);
    fc.fillRoundedRect(15, 35, 50, 30, 6);
    // 高光
    fc.fillStyle(0xa0a0a0, 0.5);
    fc.fillRoundedRect(18, 38, 44, 12, 4);
    // 炮管阴影
    fc.fillStyle(0x3a3a3a, 1);
    fc.fillRoundedRect(52, 42, 30, 12, 4);
    // 炮管
    fc.fillStyle(0x505050, 1);
    fc.fillRoundedRect(50, 40, 30, 12, 4);
    // 炮口
    fc.fillStyle(0x2a2a2a, 1);
    fc.fillRoundedRect(76, 42, 6, 8, 2);
    // 炮口高光
    fc.fillStyle(0x808080, 0.6);
    fc.fillRoundedRect(52, 42, 24, 4, 2);
    // 眼睛
    fc.fillStyle(0xffffff, 0.95);
    fc.fillCircle(28, 42, 4);
    fc.fillCircle(42, 42, 4);
    fc.fillStyle(0x1a1a1a, 1);
    fc.fillCircle(28, 42, 2);
    fc.fillCircle(42, 42, 2);
    // 描边
    fc.lineStyle(3, 0x3a3a3a, 1);
    fc.strokeRoundedRect(10, 30, 60, 40, 8);
    // 外发光
    fc.lineStyle(2, 0x808080, 0.3);
    fc.strokeRoundedRect(8, 28, 64, 44, 10);
    fc.generateTexture("flakcannon", 80, 80);
    fc.destroy();

    // 仙人球：优化版（更丰富的细节和层次感）
    const cb = this.add.graphics();
    // 主体阴影
    cb.fillStyle(0x228b22, 1);
    cb.fillCircle(13, 13, 10);
    // 主体
    cb.fillStyle(0x32cd32, 1);
    cb.fillCircle(12, 12, 10);
    // 内部
    cb.fillStyle(0x90ee90, 0.9);
    cb.fillCircle(12, 12, 6);
    // 高光
    cb.fillStyle(0xb8f0b8, 0.6);
    cb.fillEllipse(10, 10, 4, 3);
    // 尖刺
    cb.fillStyle(0xffffff, 1);
    cb.fillTriangle(12, 2, 10, 6, 14, 6);
    cb.fillTriangle(12, 22, 10, 18, 14, 18);
    cb.fillTriangle(2, 12, 6, 10, 6, 14);
    cb.fillTriangle(22, 12, 18, 10, 18, 14);
    // 尖刺高光
    cb.fillStyle(0xffffff, 0.6);
    cb.fillTriangle(12, 3, 11, 5, 13, 5);
    cb.fillTriangle(12, 21, 11, 19, 13, 19);
    cb.fillTriangle(3, 12, 5, 11, 5, 13);
    cb.fillTriangle(21, 12, 19, 11, 19, 13);
    // 描边
    cb.lineStyle(2, 0x228b22, 1);
    cb.strokeCircle(12, 12, 10);
    // 外发光
    cb.lineStyle(1, 0x90ee90, 0.3);
    cb.strokeCircle(12, 12, 12);
    cb.generateTexture("cactusball", 24, 24);
    cb.destroy();

    // 火焰花：优化版（更丰富的细节和层次感）
    const ff = this.add.graphics();
    // 主体阴影
    ff.fillStyle(0xcc0000, 1);
    ff.fillCircle(42, 42, 28);
    // 主体
    ff.fillStyle(0xff4500, 1);
    ff.fillCircle(40, 40, 28);
    // 内部
    ff.fillStyle(0xff6347, 0.9);
    ff.fillCircle(40, 40, 18);
    // 高光
    ff.fillStyle(0xff8c69, 0.6);
    ff.fillEllipse(34, 34, 12, 8);
    // 花蕊
    ff.fillStyle(0xffd700, 1);
    ff.fillCircle(40, 40, 8);
    // 花蕊高光
    ff.fillStyle(0xffec8b, 0.6);
    ff.fillEllipse(38, 38, 4, 3);
    // 花瓣尖
    ff.fillStyle(0xff0000, 0.8);
    ff.fillTriangle(40, 12, 36, 22, 44, 22);
    ff.fillTriangle(40, 68, 36, 58, 44, 58);
    ff.fillTriangle(12, 40, 22, 36, 22, 44);
    ff.fillTriangle(68, 40, 58, 36, 58, 44);
    // 花瓣尖高光
    ff.fillStyle(0xff6347, 0.6);
    ff.fillTriangle(40, 14, 38, 20, 42, 20);
    ff.fillTriangle(40, 66, 38, 60, 42, 60);
    ff.fillTriangle(14, 40, 20, 38, 20, 42);
    ff.fillTriangle(66, 40, 60, 38, 60, 42);
    // 眼睛
    ff.fillStyle(0xffffff, 0.95);
    ff.fillCircle(34, 36, 4);
    ff.fillCircle(46, 36, 4);
    ff.fillStyle(0x1a1a1a, 1);
    ff.fillCircle(34, 36, 2);
    ff.fillCircle(46, 36, 2);
    // 嘴巴
    ff.lineStyle(2, 0x1a1a1a, 0.8);
    ff.beginPath();
    ff.arc(40, 46, 6, 0.2, Math.PI - 0.2);
    ff.strokePath();
    // 描边
    ff.lineStyle(3, 0xcc0000, 1);
    ff.strokeCircle(40, 40, 28);
    // 外发光
    ff.lineStyle(2, 0xff6347, 0.3);
    ff.strokeCircle(40, 40, 32);
    ff.generateTexture("fireflower", 80, 80);
    ff.destroy();

    // ─── 进化形态弹丸贴图 ───
    // fireball：火焰弹（优化版 - 更丰富的细节和层次感）
    const fb = this.add.graphics();
    // 主体阴影
    fb.fillStyle(0xcc4400, 1);
    fb.fillCircle(17, 17, 13);
    // 主体
    fb.fillStyle(0xff6b3d, 1);
    fb.fillCircle(16, 16, 13);
    // 内部
    fb.fillStyle(0xffd94d, 0.9);
    fb.fillCircle(16, 16, 7);
    // 高光
    fb.fillStyle(0xffec8b, 0.7);
    fb.fillEllipse(14, 14, 6, 4);
    // 核心
    fb.fillStyle(0xffffff, 0.7);
    fb.fillCircle(14, 13, 3);
    // 火焰外焰
    fb.lineStyle(3, 0xff4400, 0.6);
    fb.strokeCircle(16, 16, 15);
    // 火焰光晕
    fb.lineStyle(2, 0xff8c00, 0.3);
    fb.strokeCircle(16, 16, 17);
    fb.generateTexture("fireball", 32, 32);
    fb.destroy();

    // axe：冰斧（优化版 - 更丰富的细节和层次感）
    const ax = this.add.graphics();
    // 主体阴影
    ax.fillStyle(0x336699, 1);
    ax.fillCircle(17, 17, 12);
    // 主体
    ax.fillStyle(0x4488cc, 1);
    ax.fillCircle(16, 16, 12);
    // 内部
    ax.fillStyle(0x88ccff, 0.9);
    ax.fillCircle(16, 16, 6);
    // 高光
    ax.fillStyle(0xaaddff, 0.7);
    ax.fillEllipse(14, 14, 4, 3);
    // 斧刃形状
    ax.lineStyle(2, 0xaaddff, 0.8);
    ax.lineBetween(8, 8, 24, 24);
    ax.lineBetween(24, 8, 8, 24);
    // 斧刃高光
    ax.lineStyle(1, 0xffffff, 0.5);
    ax.lineBetween(9, 9, 23, 23);
    ax.lineBetween(23, 9, 9, 23);
    // 描边
    ax.lineStyle(2, 0x6699cc, 0.6);
    ax.strokeCircle(16, 16, 14);
    // 外发光
    ax.lineStyle(1, 0x88ccff, 0.3);
    ax.strokeCircle(16, 16, 16);
    ax.generateTexture("axe", 32, 32);
    ax.destroy();

    // chain：闪电链（优化版 - 更丰富的细节和层次感）
    const cn = this.add.graphics();
    // 主体阴影
    cn.fillStyle(0xccbb00, 1);
    cn.fillCircle(17, 17, 10);
    // 主体
    cn.fillStyle(0xffee44, 1);
    cn.fillCircle(16, 16, 10);
    // 内部
    cn.fillStyle(0xffffff, 0.9);
    cn.fillCircle(16, 16, 5);
    // 高光
    cn.fillStyle(0xffffff, 0.7);
    cn.fillEllipse(14, 14, 4, 3);
    // 电弧线
    cn.lineStyle(2, 0xffee44, 0.8);
    cn.lineBetween(4, 16, 12, 10);
    cn.lineBetween(12, 10, 20, 22);
    cn.lineBetween(20, 22, 28, 14);
    // 电弧高光
    cn.lineStyle(1, 0xffffff, 0.5);
    cn.lineBetween(5, 16, 11, 11);
    cn.lineBetween(11, 11, 19, 21);
    cn.lineBetween(19, 21, 27, 15);
    // 描边
    cn.lineStyle(2, 0xccbb00, 0.6);
    cn.strokeCircle(16, 16, 12);
    // 外发光
    cn.lineStyle(1, 0xffee44, 0.3);
    cn.strokeCircle(16, 16, 14);
    cn.generateTexture("chain", 32, 32);
    cn.destroy();

    // beam：激光（优化版 - 更丰富的细节和层次感）
    const bm = this.add.graphics();
    // 主体阴影
    bm.fillStyle(0xcc0000, 1);
    bm.fillRoundedRect(5, 13, 24, 8, 4);
    // 主体
    bm.fillStyle(0xff2222, 1);
    bm.fillRoundedRect(4, 12, 24, 8, 4);
    // 内部
    bm.fillStyle(0xffffff, 0.8);
    bm.fillRoundedRect(6, 14, 20, 4, 2);
    // 高光
    bm.fillStyle(0xffffff, 0.6);
    bm.fillRoundedRect(8, 15, 16, 2, 1);
    // 描边
    bm.lineStyle(1.5, 0xff6644, 0.6);
    bm.strokeRoundedRect(3, 11, 26, 10, 5);
    // 外发光
    bm.lineStyle(1, 0xff2222, 0.3);
    bm.strokeRoundedRect(2, 10, 28, 12, 6);
    bm.generateTexture("beam", 32, 32);
    bm.destroy();

    // missile：导弹（优化版 - 更丰富的细节和层次感）
    const ms = this.add.graphics();
    // 弹体阴影
    ms.fillStyle(0x884422, 1);
    ms.fillRoundedRect(7, 11, 20, 12, 4);
    // 弹体
    ms.fillStyle(0xcc6633, 1);
    ms.fillRoundedRect(6, 10, 20, 12, 4);
    // 内部
    ms.fillStyle(0xff8844, 0.9);
    ms.fillRoundedRect(8, 12, 16, 8, 3);
    // 高光
    ms.fillStyle(0xffaa66, 0.6);
    ms.fillRoundedRect(10, 13, 12, 3, 2);
    // 尾翼
    ms.fillStyle(0x884422, 1);
    ms.fillTriangle(6, 10, 2, 6, 6, 10);
    ms.fillTriangle(6, 22, 2, 26, 6, 22);
    // 尾翼高光
    ms.fillStyle(0xaa6644, 0.6);
    ms.fillTriangle(6, 11, 3, 7, 6, 11);
    ms.fillTriangle(6, 21, 3, 25, 6, 21);
    // 弹头
    ms.fillStyle(0xff4444, 0.8);
    ms.fillCircle(26, 16, 4);
    // 弹头高光
    ms.fillStyle(0xff6666, 0.6);
    ms.fillCircle(25, 15, 2);
    // 描边
    ms.lineStyle(2, 0x884422, 0.6);
    ms.strokeRoundedRect(5, 9, 22, 14, 5);
    // 外发光
    ms.lineStyle(1, 0xff8844, 0.3);
    ms.strokeRoundedRect(4, 8, 24, 16, 6);
    ms.generateTexture("missile", 32, 32);
    ms.destroy();

    // drone：自曝无人机（优化版 - 更丰富的细节和层次感）
    const dr = this.add.graphics();
    // 主体阴影
    dr.fillStyle(0x228844, 1);
    dr.fillCircle(17, 17, 10);
    // 主体
    dr.fillStyle(0x33aa55, 1);
    dr.fillCircle(16, 16, 10);
    // 内部
    dr.fillStyle(0x66dd88, 0.9);
    dr.fillCircle(16, 16, 5);
    // 高光
    dr.fillStyle(0x88ffaa, 0.6);
    dr.fillEllipse(14, 14, 4, 3);
    // 旋翼
    dr.lineStyle(2, 0x88ccaa, 0.7);
    dr.lineBetween(4, 16, 28, 16);
    dr.lineBetween(16, 4, 16, 28);
    // 旋翼高光
    dr.lineStyle(1, 0xaaddcc, 0.5);
    dr.lineBetween(5, 16, 27, 16);
    dr.lineBetween(16, 5, 16, 27);
    // LED眼
    dr.fillStyle(0xff4444, 0.8);
    dr.fillCircle(20, 14, 2);
    // LED眼高光
    dr.fillStyle(0xff6666, 0.6);
    dr.fillCircle(19, 13, 1);
    // 描边
    dr.lineStyle(2, 0x228844, 0.6);
    dr.strokeCircle(16, 16, 12);
    // 外发光
    dr.lineStyle(1, 0x66dd88, 0.3);
    dr.strokeCircle(16, 16, 14);
    dr.generateTexture("drone", 32, 32);
    dr.destroy();

    // ─── 新僵尸贴图 ───
    // 巨人僵尸：优化版（更丰富的细节和层次感）
    const giant = this.add.graphics();
    // 头部阴影
    giant.fillStyle(0x4a2a10, 1);
    giant.fillCircle(42, 37, 20);
    // 头部
    giant.fillStyle(0x8b4513, 1);
    giant.fillCircle(40, 35, 20);
    // 头部高光
    giant.fillStyle(0xa0522d, 0.6);
    giant.fillEllipse(36, 30, 10, 6);
    // 身体阴影
    giant.fillStyle(0x3a1a08, 1);
    giant.fillRoundedRect(22, 52, 40, 50, 8);
    // 身体
    giant.fillStyle(0x6b3410, 1);
    giant.fillRoundedRect(20, 50, 40, 50, 8);
    // 身体高光
    giant.fillStyle(0x8a4a20, 0.5);
    giant.fillRoundedRect(24, 54, 32, 16, 6);
    // 肌肉
    giant.fillStyle(0xa0522d, 0.8);
    giant.fillCircle(15, 65, 12); // 左臂
    giant.fillCircle(65, 65, 12); // 右臂
    // 肌肉高光
    giant.fillStyle(0xc06a3a, 0.6);
    giant.fillEllipse(12, 62, 6, 4);
    giant.fillEllipse(62, 62, 6, 4);
    // 眼睛
    giant.fillStyle(0xff0000, 0.8);
    giant.fillCircle(34, 32, 4);
    giant.fillCircle(46, 32, 4);
    // 眼睛高光
    giant.fillStyle(0xff4444, 0.6);
    giant.fillCircle(33, 31, 2);
    giant.fillCircle(45, 31, 2);
    // 嘴巴
    giant.fillStyle(0x1a1a1a, 1);
    giant.fillRoundedRect(32, 40, 16, 6, 3);
    // 描边
    giant.lineStyle(3, 0x4a2a10, 1);
    giant.strokeCircle(40, 35, 20);
    // 外发光
    giant.lineStyle(2, 0x8b4513, 0.3);
    giant.strokeCircle(40, 35, 24);
    giant.generateTexture("zombie_giant", 80, 100);
    giant.destroy();

    // 舞王僵尸：优化版（更丰富的细节和层次感）
    const dancer = this.add.graphics();
    // 头部阴影
    dancer.fillStyle(0x6600aa, 1);
    dancer.fillCircle(42, 32, 18);
    // 头部
    dancer.fillStyle(0x9932cc, 1);
    dancer.fillCircle(40, 30, 18);
    // 头部高光
    dancer.fillStyle(0xbb66ee, 0.6);
    dancer.fillEllipse(36, 26, 10, 6);
    // 身体阴影
    dancer.fillStyle(0x5500aa, 1);
    dancer.fillRoundedRect(24, 47, 36, 45, 8);
    // 身体
    dancer.fillStyle(0x7b00cc, 1);
    dancer.fillRoundedRect(22, 45, 36, 45, 8);
    // 身体高光
    dancer.fillStyle(0x9932cc, 0.5);
    dancer.fillRoundedRect(26, 49, 28, 16, 6);
    // 舞蹈手臂
    dancer.fillStyle(0x9932cc, 0.9);
    dancer.fillTriangle(22, 55, 5, 40, 22, 70); // 左臂
    dancer.fillTriangle(58, 55, 75, 40, 58, 70); // 右臂
    // 手臂高光
    dancer.fillStyle(0xbb66ee, 0.6);
    dancer.fillTriangle(20, 54, 8, 42, 20, 68);
    dancer.fillTriangle(60, 54, 72, 42, 60, 68);
    // 眼睛
    dancer.fillStyle(0xffffff, 0.9);
    dancer.fillCircle(34, 28, 4);
    dancer.fillCircle(46, 28, 4);
    dancer.fillStyle(0x1a1a1a, 1);
    dancer.fillCircle(34, 28, 2);
    dancer.fillCircle(46, 28, 2);
    // 嘴巴（微笑）
    dancer.lineStyle(2, 0xffffff, 0.8);
    dancer.beginPath();
    dancer.arc(40, 36, 8, 0.2, Math.PI - 0.2);
    dancer.strokePath();
    // 描边
    dancer.lineStyle(3, 0x6600aa, 1);
    dancer.strokeCircle(40, 30, 18);
    // 外发光
    dancer.lineStyle(2, 0x9932cc, 0.3);
    dancer.strokeCircle(40, 30, 22);
    dancer.generateTexture("zombie_dancer", 80, 90);
    dancer.destroy();

    // 矿工僵尸：优化版（更丰富的细节和层次感）
    const digger = this.add.graphics();
    // 头部阴影
    digger.fillStyle(0x4a2a10, 1);
    digger.fillCircle(42, 32, 16);
    // 头部
    digger.fillStyle(0x8b4513, 1);
    digger.fillCircle(40, 30, 16);
    // 头部高光
    digger.fillStyle(0xa0522d, 0.6);
    digger.fillEllipse(36, 26, 8, 5);
    // 身体阴影
    digger.fillStyle(0x3a1a08, 1);
    digger.fillRoundedRect(26, 46, 32, 40, 6);
    // 身体
    digger.fillStyle(0x6b3410, 1);
    digger.fillRoundedRect(24, 44, 32, 40, 6);
    // 身体高光
    digger.fillStyle(0x8a4a20, 0.5);
    digger.fillRoundedRect(28, 48, 24, 12, 4);
    // 安全帽阴影
    digger.fillStyle(0xcc9900, 1);
    digger.fillRoundedRect(30, 16, 24, 12, 4);
    // 安全帽
    digger.fillStyle(0xffd700, 1);
    digger.fillRoundedRect(28, 14, 24, 12, 4);
    // 安全帽高光
    digger.fillStyle(0xffec8b, 0.6);
    digger.fillRoundedRect(32, 18, 16, 4, 2);
    // 安全帽内部
    digger.fillStyle(0xffa500, 0.8);
    digger.fillRoundedRect(30, 16, 20, 8, 3);
    // 眼睛
    digger.fillStyle(0xffffff, 0.9);
    digger.fillCircle(34, 28, 3);
    digger.fillCircle(46, 28, 3);
    digger.fillStyle(0x1a1a1a, 1);
    digger.fillCircle(34, 28, 1.5);
    digger.fillCircle(46, 28, 1.5);
    // 镐
    digger.fillStyle(0x808080, 1);
    digger.fillRoundedRect(60, 40, 4, 30, 2);
    digger.fillStyle(0x696969, 1);
    digger.fillTriangle(58, 40, 62, 40, 60, 30);
    // 镐高光
    digger.fillStyle(0xa0a0a0, 0.6);
    digger.fillRoundedRect(61, 42, 2, 26, 1);
    // 描边
    digger.lineStyle(2, 0x4a2a10, 1);
    digger.strokeCircle(40, 30, 16);
    // 外发光
    digger.lineStyle(1, 0x8b4513, 0.3);
    digger.strokeCircle(40, 30, 20);
    digger.generateTexture("zombie_digger", 80, 84);
    digger.destroy();

    // 气球僵尸：优化版（更丰富的细节和层次感）
    const balloon = this.add.graphics();
    // 气球阴影
    balloon.fillStyle(0x5a8aaa, 1);
    balloon.fillCircle(42, 27, 20);
    // 气球
    balloon.fillStyle(0x87ceeb, 0.9);
    balloon.fillCircle(40, 25, 20);
    // 气球高光
    balloon.fillStyle(0xa8d8ea, 0.6);
    balloon.fillEllipse(36, 20, 10, 6);
    // 气球内部
    balloon.fillStyle(0xb0e0e6, 0.6);
    balloon.fillCircle(35, 20, 8);
    // 气球反光
    balloon.fillStyle(0xffffff, 0.4);
    balloon.fillEllipse(34, 18, 6, 4);
    // 绳子
    balloon.lineStyle(1, 0x8b4513, 0.8);
    balloon.lineBetween(40, 45, 40, 55);
    // 僵尸头部阴影
    balloon.fillStyle(0x4a2a10, 1);
    balloon.fillCircle(42, 62, 10);
    // 僵尸头部
    balloon.fillStyle(0x8b4513, 1);
    balloon.fillCircle(40, 60, 10);
    // 头部高光
    balloon.fillStyle(0xa0522d, 0.6);
    balloon.fillEllipse(37, 57, 5, 3);
    // 身体阴影
    balloon.fillStyle(0x3a1a08, 1);
    balloon.fillRoundedRect(34, 72, 16, 20, 4);
    // 身体
    balloon.fillStyle(0x6b3410, 1);
    balloon.fillRoundedRect(32, 70, 16, 20, 4);
    // 身体高光
    balloon.fillStyle(0x8a4a20, 0.5);
    balloon.fillRoundedRect(35, 73, 10, 8, 3);
    // 眼睛
    balloon.fillStyle(0xffffff, 0.9);
    balloon.fillCircle(37, 58, 2);
    balloon.fillCircle(43, 58, 2);
    balloon.fillStyle(0x1a1a1a, 1);
    balloon.fillCircle(37, 58, 1);
    balloon.fillCircle(43, 58, 1);
    // 描边
    balloon.lineStyle(2, 0x5a9bd5, 0.8);
    balloon.strokeCircle(40, 25, 20);
    // 外发光
    balloon.lineStyle(1, 0x87ceeb, 0.3);
    balloon.strokeCircle(40, 25, 24);
    balloon.generateTexture("zombie_balloon", 80, 90);
    balloon.destroy();

    // 投石车僵尸：优化版（更丰富的细节和层次感）
    const catapult = this.add.graphics();
    // 投石车阴影
    catapult.fillStyle(0x3a3a3a, 1);
    catapult.fillRoundedRect(12, 52, 60, 30, 6);
    // 投石车
    catapult.fillStyle(0x696969, 1);
    catapult.fillRoundedRect(10, 50, 60, 30, 6);
    // 投石车高光
    catapult.fillStyle(0xa0a0a0, 0.5);
    catapult.fillRoundedRect(14, 54, 52, 10, 4);
    // 内部
    catapult.fillStyle(0x808080, 0.9);
    catapult.fillRoundedRect(15, 55, 50, 20, 4);
    // 轮子阴影
    catapult.fillStyle(0x1a1a1a, 1);
    catapult.fillCircle(22, 82, 8);
    catapult.fillCircle(62, 82, 8);
    // 轮子
    catapult.fillStyle(0x333333, 1);
    catapult.fillCircle(20, 80, 8);
    catapult.fillCircle(60, 80, 8);
    // 轮子高光
    catapult.fillStyle(0x555555, 0.6);
    catapult.fillEllipse(18, 78, 4, 3);
    catapult.fillEllipse(58, 78, 4, 3);
    // 投石臂阴影
    catapult.fillStyle(0x4a2a10, 1);
    catapult.fillRoundedRect(52, 32, 4, 25, 2);
    // 投石臂
    catapult.fillStyle(0x8b4513, 1);
    catapult.fillRoundedRect(50, 30, 4, 25, 2);
    // 投石臂高光
    catapult.fillStyle(0xa0522d, 0.6);
    catapult.fillRoundedRect(51, 32, 2, 21, 1);
    // 投石球
    catapult.fillStyle(0x808080, 1);
    catapult.fillCircle(52, 30, 6);
    // 投石球高光
    catapult.fillStyle(0xa0a0a0, 0.6);
    catapult.fillEllipse(50, 28, 4, 3);
    // 僵尸头部阴影
    catapult.fillStyle(0x4a2a10, 1);
    catapult.fillCircle(32, 42, 8);
    // 僵尸头部
    catapult.fillStyle(0x8b4513, 1);
    catapult.fillCircle(30, 40, 8);
    // 头部高光
    catapult.fillStyle(0xa0522d, 0.6);
    catapult.fillEllipse(28, 38, 4, 3);
    // 身体阴影
    catapult.fillStyle(0x3a1a08, 1);
    catapult.fillRoundedRect(26, 50, 12, 12, 3);
    // 身体
    catapult.fillStyle(0x6b3410, 1);
    catapult.fillRoundedRect(24, 48, 12, 12, 3);
    // 身体高光
    catapult.fillStyle(0x8a4a20, 0.5);
    catapult.fillRoundedRect(27, 51, 6, 5, 2);
    // 眼睛
    catapult.fillStyle(0xffffff, 0.9);
    catapult.fillCircle(28, 38, 2);
    catapult.fillCircle(32, 38, 2);
    catapult.fillStyle(0x1a1a1a, 1);
    catapult.fillCircle(28, 38, 1);
    catapult.fillCircle(32, 38, 1);
    // 描边
    catapult.lineStyle(2, 0x4a4a4a, 1);
    catapult.strokeRoundedRect(10, 50, 60, 30, 6);
    // 外发光
    catapult.lineStyle(1, 0x696969, 0.3);
    catapult.strokeRoundedRect(8, 48, 64, 34, 8);
    catapult.generateTexture("zombie_catapult", 80, 90);
    catapult.destroy();

    this.scene.start("select");
  }
}
