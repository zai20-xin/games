/// <reference types="vite/client" />
import Phaser from "phaser";
import { W, H } from "../config";

const IMG_URLS = import.meta.glob("../../public/assets/**/*.png", {
  query: "?url",
  eager: true,
  import: "default",
}) as Record<string, string>;

function resolveImage(file: string): string {
  const key = "../../public/" + file;
  return IMG_URLS[key] ?? file;
}

const IMAGES: [string, string][] = [
  ["flower_rose", "assets/flowers/rose.png"],
  ["flower_daffodil", "assets/flowers/daffodil.png"],
  ["flower_crabapple", "assets/flowers/crabapple.png"],
  ["flower_lotus", "assets/flowers/lotus.png"],
  ["flower_orchid", "assets/flowers/orchid.png"],
  ["flower_rose_super", "assets/flowers/rose_super.png"],
  ["flower_daffodil_super", "assets/flowers/daffodil_super.png"],
  ["flower_crabapple_super", "assets/flowers/crabapple_super.png"],
  ["flower_lotus_super", "assets/flowers/lotus_super.png"],
  ["flower_orchid_super", "assets/flowers/orchid_super.png"],
  ["flower_rose_epic", "assets/flowers/rose_epic.png"],
  ["flower_daffodil_epic", "assets/flowers/daffodil_epic.png"],
  ["flower_crabapple_epic", "assets/flowers/crabapple_epic.png"],
  ["flower_lotus_epic", "assets/flowers/lotus_epic.png"],
  ["flower_orchid_epic", "assets/flowers/orchid_epic.png"],
  ["flower_rose_legendary", "assets/flowers/rose_legendary.png"],
  ["flower_daffodil_legendary", "assets/flowers/daffodil_legendary.png"],
  ["flower_crabapple_legendary", "assets/flowers/crabapple_legendary.png"],
  ["flower_lotus_legendary", "assets/flowers/lotus_legendary.png"],
  ["flower_orchid_legendary", "assets/flowers/orchid_legendary.png"],
  ["pet_cat", "assets/pets/cat.png"],
  ["pet_duck", "assets/pets/duck.png"],
  ["pet_dog", "assets/pets/dog.png"],
  ["petal_rose", "assets/projectiles/petal_rose.png"],
  ["petal_daffodil", "assets/projectiles/petal_daffodil.png"],
  ["petal_crabapple", "assets/projectiles/petal_crabapple.png"],
  ["petal_lotus", "assets/projectiles/petal_lotus.png"],
  ["petal_orchid", "assets/projectiles/petal_orchid.png"],
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor("#FFF8F2");
    for (const [key, file] of IMAGES) this.load.image(key, resolveImage(file));
  }

  create(): void {
    this.makePet("pet_hedgehog", 0xc4a574);
    this.makePet("pet_hamster", 0xd4a574);

    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture("dot", 8, 8);
    g.clear();
    g.lineStyle(6, 0xffffff, 1);
    g.strokeCircle(32, 32, 28);
    g.generateTexture("ring", 64, 64);
    g.clear();
    g.fillStyle(0xfff8f2, 1);
    g.fillRect(0, 0, 256, 256);
    g.lineStyle(1, 0xf0e4d8, 0.5);
    for (let i = 0; i <= 4; i++) {
      const p = (i * 256) / 4;
      g.lineBetween(p, 0, p, 256);
      g.lineBetween(0, p, 256, p);
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x8fbf8a, 0.06);
      g.fillCircle(40 + (i % 3) * 80, 40 + Math.floor(i / 3) * 100, 12);
    }
    g.generateTexture("wood_bg", 256, 256);
    g.destroy();

    const vt = this.textures.createCanvas("vignette", W, H);
    if (vt) {
      const ctx = vt.getContext();
      const grad = ctx.createRadialGradient(W / 2, H / 2, 280, W / 2, H / 2, 720);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(120,90,70,0.12)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      vt.refresh();
    }

    this.scene.start("menu");
  }

  private makePet(key: string, body: number): void {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    const isHedge = key.includes("hedge");
    if (isHedge) {
      for (let i = 0; i < 9; i++) {
        const x = 10 + i * 5.5;
        const h = 22 + (i % 3) * 6;
        g.fillStyle(0x6b4f2a, 1);
        g.fillTriangle(x, 48, x + 4, 48 - h, x + 8, 48);
      }
    } else {
      g.fillStyle(0xc49060, 1);
      g.fillCircle(16, 28, 8);
      g.fillCircle(48, 28, 8);
    }
    g.fillStyle(body, 1);
    g.fillEllipse(32, isHedge ? 58 : 50, isHedge ? 52 : 48, isHedge ? 36 : 52);
    g.fillStyle(0xf0e0c0, 1);
    g.fillEllipse(32, isHedge ? 66 : 62, isHedge ? 40 : 32, isHedge ? 18 : 28);
    g.fillStyle(0x1a1008, 1);
    g.fillCircle(24, 44, 2.4);
    g.fillCircle(40, 44, 2.4);
    g.fillCircle(32, 52, 1.8);
    g.generateTexture(key, 64, 80);
    g.destroy();
  }
}
